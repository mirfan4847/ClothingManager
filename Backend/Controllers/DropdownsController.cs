using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClothingManager.Authorization;
using ClothingManager.Data;
using ClothingManager.DTOs;
using ClothingManager.Models;
using ClothingManager.Services;

namespace ClothingManager.Controllers;

// ── Dropdowns (read-only) ────────────────────────────────────────────────────
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class DropdownsController : ControllerBase
{
    private readonly AppDbContext _db;
    public DropdownsController(AppDbContext db) => _db = db;

    [HttpGet("sizes")]
    public async Task<IActionResult> Sizes()
        => Ok(await _db.Sizes.Select(s => new DropdownDto { Id = s.Id, Name = s.Name }).ToListAsync());

    [HttpGet("colors")]
    public async Task<IActionResult> Colors()
        => Ok(await _db.Colors.Select(c => new DropdownDto { Id = c.Id, Name = c.Name }).ToListAsync());

    [HttpGet("machines")]
    public async Task<IActionResult> Machines()
        => Ok(await _db.Machines.Select(m => new DropdownDto { Id = m.Id, Name = m.Name }).ToListAsync());

    [HttpGet("workers")]
    public async Task<IActionResult> Workers()
        => Ok(await _db.Workers.Where(w => w.IsActive && w.PersonType == "Worker")
            .Select(w => new { w.Id, w.Name, w.SheetType }).ToListAsync());

    [HttpGet("all-staff")]
    public async Task<IActionResult> AllStaff()
        => Ok(await _db.Workers.Where(w => w.IsActive)
            .Select(w => new { w.Id, w.Name, w.SheetType, w.PersonType }).ToListAsync());
}

// ── Lots CRUD ────────────────────────────────────────────────────────────────
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class LotsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    public LotsController(AppDbContext db, AuditService audit) { _db = db; _audit = audit; }

    static readonly string[] ValidStatuses = ["Stitching", "Rafo", "Button", "Press", "Delivered"];

    LotDto ToDto(Lot l) => new()
    {
        Id          = l.Id,
        LotNumber   = l.LotNumber,
        SizeId      = l.SizeId,
        SizeName    = l.Size?.Name,
        Material    = l.Material,
        Status      = l.Status,
        PicturePath = l.PicturePath,
    };

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? sizeId, [FromQuery] string? material, [FromQuery] string? status)
    {
        var q = _db.Lots.Include(l => l.Size).AsQueryable();
        if (sizeId.HasValue) q = q.Where(l => l.SizeId == sizeId.Value);
        if (!string.IsNullOrWhiteSpace(material)) q = q.Where(l => l.Material == material);
        if (!string.IsNullOrWhiteSpace(status))   q = q.Where(l => l.Status == status);
        var lots = await q.OrderBy(l => l.SizeId).ThenBy(l => l.LotNumber).ToListAsync();
        return Ok(lots.Select(l => ToDto(l)));
    }

    [HttpPost]
    [RequirePermission("canAddLabour")]
    public async Task<IActionResult> Create([FromBody] LotCreateDto dto)
    {
        var lot = new Lot
        {
            LotNumber = dto.LotNumber.Trim(),
            SizeId    = dto.SizeId,
            Material  = dto.Material?.Trim(),
            Status    = ValidStatuses.Contains(dto.Status) ? dto.Status! : "Stitching",
        };
        _db.Lots.Add(lot);
        await _db.SaveChangesAsync();
        await _db.Entry(lot).Reference(l => l.Size).LoadAsync();
        await _audit.LogAsync("Create", "Lots", "Lot", lot.Id, lot.LotNumber, new() {
            new("Lot Number", null, lot.LotNumber),
            new("Material",   null, lot.Material),
            new("Status",     null, lot.Status),
        });
        return Ok(ToDto(lot));
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditLabour")]
    public async Task<IActionResult> Update(int id, [FromBody] LotCreateDto dto)
    {
        var lot = await _db.Lots.FindAsync(id);
        if (lot == null) return NotFound();
        var old = new { lot.LotNumber, lot.SizeId, lot.Material, lot.Status };
        lot.LotNumber = dto.LotNumber.Trim();
        lot.SizeId    = dto.SizeId;
        lot.Material  = dto.Material?.Trim();
        if (dto.Status != null && ValidStatuses.Contains(dto.Status)) lot.Status = dto.Status;
        await _db.SaveChangesAsync();
        await _db.Entry(lot).Reference(l => l.Size).LoadAsync();
        var changes = new List<FieldChange>();
        if (old.LotNumber != lot.LotNumber) changes.Add(new("Lot Number", old.LotNumber, lot.LotNumber));
        if (old.Material  != lot.Material)  changes.Add(new("Material",   old.Material,  lot.Material));
        if (old.Status    != lot.Status)    changes.Add(new("Status",     old.Status,    lot.Status));
        if (changes.Count > 0) await _audit.LogAsync("Update", "Lots", "Lot", lot.Id, lot.LotNumber, changes);
        return Ok(ToDto(lot));
    }

    [HttpPatch("{id}/status")]
    [RequirePermission("canEditLabour")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] LotStatusUpdateDto dto)
    {
        if (!ValidStatuses.Contains(dto.Status))
            return BadRequest(new { message = $"Invalid status. Valid values: {string.Join(", ", ValidStatuses)}" });
        var lot = await _db.Lots.Include(l => l.Size).FirstOrDefaultAsync(l => l.Id == id);
        if (lot == null) return NotFound();
        var oldStatus = lot.Status;
        lot.Status = dto.Status;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Update", "Lots", "Lot", lot.Id, lot.LotNumber, new() {
            new("Status", oldStatus, lot.Status),
        });
        return Ok(ToDto(lot));
    }

    [HttpPost("{id}/picture")]
    public async Task<IActionResult> UploadPicture(int id, IFormFile file)
    {
        var lot = await _db.Lots.Include(l => l.Size).FirstOrDefaultAsync(l => l.Id == id);
        if (lot == null) return NotFound();
        var env = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>();
        var uploads = Path.Combine(env.WebRootPath ?? "wwwroot", "uploads");
        Directory.CreateDirectory(uploads);
        var fileName = $"lot_{id}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        using var stream = new FileStream(Path.Combine(uploads, fileName), FileMode.Create);
        await file.CopyToAsync(stream);
        lot.PicturePath = $"/uploads/{fileName}";
        await _db.SaveChangesAsync();
        return Ok(ToDto(lot));
    }

    [HttpDelete("{id}")]
    [RequirePermission("canDeleteLabour")]
    public async Task<IActionResult> Delete(int id)
    {
        var lot = await _db.Lots.FindAsync(id);
        if (lot == null) return NotFound();
        var lotNumber = lot.LotNumber;
        _db.Lots.Remove(lot);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Delete", "Lots", "Lot", id, lotNumber, new() {
            new("Lot Number", lotNumber, null),
            new("Material",   lot.Material, null),
        });
        return NoContent();
    }
}

// ── Sizes CRUD ───────────────────────────────────────────────────────────────
[ApiController]
[Route("api/masters/sizes")]
[Authorize]
[Produces("application/json")]
public class SizesController : ControllerBase
{
    private readonly AppDbContext _db;
    public SizesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.Sizes.Select(s => new DropdownDto { Id = s.Id, Name = s.Name }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new Size { Name = dto.Name.Trim() };
        _db.Sizes.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.Sizes.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name });
    }

    [HttpDelete("{id}")]
    [RequirePermission("canDeleteSettings")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Sizes.FindAsync(id);
        if (item == null) return NotFound();
        _db.Sizes.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

// ── Colors CRUD ──────────────────────────────────────────────────────────────
[ApiController]
[Route("api/masters/colors")]
[Authorize]
[Produces("application/json")]
public class ColorsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ColorsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.Colors.Select(c => new DropdownDto { Id = c.Id, Name = c.Name }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new Color { Name = dto.Name.Trim() };
        _db.Colors.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.Colors.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name });
    }

    [HttpDelete("{id}")]
    [RequirePermission("canDeleteSettings")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Colors.FindAsync(id);
        if (item == null) return NotFound();
        _db.Colors.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

// ── Machines CRUD ────────────────────────────────────────────────────────────
[ApiController]
[Route("api/masters/machines")]
[Authorize]
[Produces("application/json")]
public class MachinesController : ControllerBase
{
    private readonly AppDbContext _db;
    public MachinesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.Machines.Select(m => new DropdownDto { Id = m.Id, Name = m.Name }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new Machine { Name = dto.Name.Trim() };
        _db.Machines.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.Machines.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name });
    }

    [HttpDelete("{id}")]
    [RequirePermission("canDeleteSettings")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Machines.FindAsync(id);
        if (item == null) return NotFound();
        _db.Machines.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
