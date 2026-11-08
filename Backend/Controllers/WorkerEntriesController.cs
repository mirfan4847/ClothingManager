using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ClothingManager.Authorization;
using ClothingManager.DTOs;
using ClothingManager.Services;

namespace ClothingManager.Controllers;

/// <summary>
/// Manages worker production entries
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class WorkerEntriesController : ControllerBase
{
    private readonly WorkerEntryService _svc;
    private readonly AuditService _audit;
    private readonly GeminiVisionService _gemini;
    public WorkerEntriesController(WorkerEntryService svc, AuditService audit, GeminiVisionService gemini)
    {
        _svc = svc;
        _audit = audit;
        _gemini = gemini;
    }

    /// <summary>
    /// AI Vision: Scans a production slip image and extracts rows into structured preview data
    /// </summary>
    [HttpPost("scan-slip")]
    [RequirePermission("canAddEntry")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> ScanSlip([FromForm] IFormFile file, [FromQuery] int? workerId)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Please provide an image of the production slip." });

        try
        {
            var clientKey = Request.Headers["X-Gemini-Key"].FirstOrDefault();
            using var stream = file.OpenReadStream();
            var scanResult = await _gemini.ScanSlipAsync(stream, file.ContentType, workerId, clientKey);
            return Ok(scanResult);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message, isKeyMissing = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Image processing failed: {ex.Message}" });
        }
    }

    /// <summary>
    /// Bulk inserts verified entries after AI extraction preview
    /// </summary>
    [HttpPost("bulk-create")]
    [RequirePermission("canAddEntry")]
    public async Task<IActionResult> BulkCreate([FromBody] BulkWorkerEntryCreateDto dto)
    {
        if (dto == null || dto.Entries == null || dto.Entries.Count == 0)
            return BadRequest(new { message = "No valid entries provided to save." });

        try
        {
            var created = await _svc.BulkCreateAsync(dto.WorkerId, dto.Entries);
            await _audit.LogAsync("Create", "Labour", "BulkEntry", dto.WorkerId,
                $"AI Slip Import: {created.Count} entries created", new() {
                    new("WorkerId", null, dto.WorkerId.ToString()),
                    new("Count", null, created.Count.ToString())
                });
            return Ok(new { count = created.Count, entries = created });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Bulk creation failed: {ex.Message}" });
        }
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<WorkerEntryDto>), 200)]
    public async Task<IActionResult> GetAll([FromQuery] int workerId)
        => Ok(await _svc.GetByWorkerAsync(workerId));

    [HttpGet("by-lot")]
    [ProducesResponseType(typeof(List<WorkerEntryDto>), 200)]
    public async Task<IActionResult> GetByLot([FromQuery] int? lotId, [FromQuery] string? lotNumber)
        => Ok(await _svc.GetByLotAsync(lotId, lotNumber));

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(WorkerEntryDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetOne(int id)
    {
        var result = await _svc.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [RequirePermission("canAddEntry")]
    [ProducesResponseType(typeof(WorkerEntryDto), 201)]
    public async Task<IActionResult> Create([FromBody] WorkerEntryCreateDto dto)
    {
        try
        {
            var created = await _svc.CreateAsync(dto);
            await _audit.LogAsync("Create", "Labour", "Entry", created.Id,
                $"{created.WorkerName} / {created.LotNumber}", new() {
                    new("Worker", null, created.WorkerName),
                    new("Lot",    null, created.LotNumber),
                    new("Pieces", null, created.TotalPiece?.ToString() ?? created.Quantity?.ToString()),
                });
            return CreatedAtAction(nameof(GetOne), new { id = created.Id }, created);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditEntry")]
    [ProducesResponseType(typeof(WorkerEntryDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Update(int id, [FromBody] WorkerEntryCreateDto dto)
    {
        var before = await _svc.GetByIdAsync(id);
        var result = await _svc.UpdateAsync(id, dto);
        if (result == null) return NotFound();
        if (before != null)
        {
            var changes = new List<FieldChange>();
            if (before.TotalPiece != result.TotalPiece)
                changes.Add(new("Pieces", before.TotalPiece?.ToString(), result.TotalPiece?.ToString()));
            if (before.Quantity != result.Quantity)
                changes.Add(new("Quantity", before.Quantity?.ToString(), result.Quantity?.ToString()));
            if (before.Completed != result.Completed)
                changes.Add(new("Completed", before.Completed ? "Yes" : "No", result.Completed ? "Yes" : "No"));
            if (before.LotId != result.LotId)
                changes.Add(new("Lot", before.LotNumber, result.LotNumber));
            if (changes.Count > 0)
                await _audit.LogAsync("Update", "Labour", "Entry", id,
                    $"{result.WorkerName} / {result.LotNumber}", changes);
        }
        return Ok(result);
    }

    [HttpDelete("{id}")]
    [RequirePermission("canDeleteEntry")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Delete(int id)
    {
        var entry = await _svc.GetByIdAsync(id);
        if (!await _svc.DeleteAsync(id)) return NotFound();
        if (entry != null)
            await _audit.LogAsync("Delete", "Labour", "Entry", id,
                $"{entry.WorkerName} / {entry.LotNumber}", new() {
                    new("Worker", entry.WorkerName, null),
                    new("Lot",    entry.LotNumber,  null),
                    new("Pieces", entry.TotalPiece?.ToString() ?? entry.Quantity?.ToString(), null),
                });
        return NoContent();
    }

    [HttpPost("{id}/picture")]
    [ProducesResponseType(200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> UploadPicture(int id, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file provided.");
        var path = await _svc.UploadPictureAsync(id, file);
        return path == null ? NotFound() : Ok(new { picturePath = path });
    }
}
