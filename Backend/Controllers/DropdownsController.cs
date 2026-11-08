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
    public async Task<IActionResult> Sizes([FromQuery] bool includeInactive = false)
    {
        var q = _db.Sizes.AsQueryable();
        if (!includeInactive) q = q.Where(s => s.IsActive);
        return Ok(await q.Select(s => new DropdownDto { Id = s.Id, Name = s.Name, IsActive = s.IsActive }).ToListAsync());
    }

    [HttpGet("colors")]
    public async Task<IActionResult> Colors([FromQuery] bool includeInactive = false)
    {
        var q = _db.Colors.AsQueryable();
        if (!includeInactive) q = q.Where(c => c.IsActive);
        return Ok(await q.Select(c => new DropdownDto { Id = c.Id, Name = c.Name, IsActive = c.IsActive }).ToListAsync());
    }

    [HttpGet("machines")]
    public async Task<IActionResult> Machines([FromQuery] bool includeInactive = false)
    {
        var q = _db.Machines.AsQueryable();
        if (!includeInactive) q = q.Where(m => m.IsActive);
        return Ok(await q.Select(m => new DropdownDto { Id = m.Id, Name = m.Name, IsActive = m.IsActive }).ToListAsync());
    }

    [HttpGet("task-types")]
    public async Task<IActionResult> TaskTypes([FromQuery] bool includeInactive = false)
    {
        var q = _db.TaskTypes.AsQueryable();
        if (!includeInactive) q = q.Where(t => t.IsActive);
        return Ok(await q.Select(t => new DropdownDto { Id = t.Id, Name = t.Name, IsActive = t.IsActive }).ToListAsync());
    }

    [HttpGet("materials")]
    public async Task<IActionResult> Materials([FromQuery] bool includeInactive = false)
    {
        var q = _db.Materials.AsQueryable();
        if (!includeInactive) q = q.Where(m => m.IsActive);
        return Ok(await q.Select(m => new DropdownDto { Id = m.Id, Name = m.Name, IsActive = m.IsActive }).ToListAsync());
    }

    [HttpGet("bag-types")]
    public async Task<IActionResult> BagTypes([FromQuery] bool includeInactive = false)
    {
        var q = _db.BagTypes.AsQueryable();
        if (!includeInactive) q = q.Where(b => b.IsActive);
        return Ok(await q.Select(b => new DropdownDto { Id = b.Id, Name = b.Name, IsActive = b.IsActive }).ToListAsync());
    }

    [HttpGet("worker-roles")]
    public async Task<IActionResult> WorkerRoles([FromQuery] bool includeInactive = false)
    {
        var q = _db.WorkerRoles.AsQueryable();
        if (!includeInactive) q = q.Where(r => r.IsActive);
        return Ok(await q.Select(r => new DropdownDto { Id = r.Id, Name = r.Name, IsActive = r.IsActive }).ToListAsync());
    }

    [HttpGet("lot-stages")]
    public async Task<IActionResult> LotStages([FromQuery] bool includeInactive = false)
    {
        var q = _db.LotStages.AsQueryable();
        if (!includeInactive) q = q.Where(s => s.IsActive);
        return Ok(await q.Select(s => new DropdownDto { Id = s.Id, Name = s.Name, IsActive = s.IsActive }).ToListAsync());
    }

    [HttpGet("workers")]
    public async Task<IActionResult> Workers()
        => Ok(await _db.Workers.Where(w => w.IsActive && w.PersonType == "Worker")
            .Select(w => new { w.Id, w.Name, w.SheetType }).ToListAsync());

    [HttpGet("all-staff")]
    public async Task<IActionResult> AllStaff()
        => Ok(await _db.Workers.Where(w => w.IsActive)
            .Select(w => new { w.Id, w.Name, w.SheetType, w.PersonType, Phone = w.Phone ?? "" }).ToListAsync());
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
        IsActive    = l.IsActive,
    };

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? sizeId, [FromQuery] string? material, [FromQuery] string? status, [FromQuery] bool includeInactive = false)
    {
        var q = _db.Lots.Include(l => l.Size).AsQueryable();
        if (!includeInactive) q = q.Where(l => l.IsActive);
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
            Status    = !string.IsNullOrWhiteSpace(dto.Status) ? dto.Status.Trim() : "Stitching",
            IsActive  = dto.IsActive ?? true,
        };
        _db.Lots.Add(lot);
        await _db.SaveChangesAsync();
        await _db.Entry(lot).Reference(l => l.Size).LoadAsync();
        await _audit.LogAsync("Create", "Lots", "Lot", lot.Id, lot.LotNumber, new() {
            new("Lot Number", null, lot.LotNumber),
            new("Material",   null, lot.Material),
            new("Status",     null, lot.Status),
            new("Active",     null, lot.IsActive ? "Active" : "Inactive"),
        });
        return Ok(ToDto(lot));
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditLabour")]
    public async Task<IActionResult> Update(int id, [FromBody] LotCreateDto dto)
    {
        var lot = await _db.Lots.FindAsync(id);
        if (lot == null) return NotFound();
        var old = new { lot.LotNumber, lot.SizeId, lot.Material, lot.Status, lot.IsActive };
        lot.LotNumber = dto.LotNumber.Trim();
        lot.SizeId    = dto.SizeId;
        lot.Material  = dto.Material?.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Status)) lot.Status = dto.Status.Trim();
        if (dto.IsActive.HasValue) lot.IsActive = dto.IsActive.Value;
        await _db.SaveChangesAsync();
        await _db.Entry(lot).Reference(l => l.Size).LoadAsync();
        var changes = new List<FieldChange>();
        if (old.LotNumber != lot.LotNumber) changes.Add(new("Lot Number", old.LotNumber, lot.LotNumber));
        if (old.Material  != lot.Material)  changes.Add(new("Material",   old.Material,  lot.Material));
        if (old.Status    != lot.Status)    changes.Add(new("Status",     old.Status,    lot.Status));
        if (old.IsActive  != lot.IsActive)  changes.Add(new("Active",     old.IsActive ? "Active" : "Inactive", lot.IsActive ? "Active" : "Inactive"));
        if (changes.Count > 0) await _audit.LogAsync("Update", "Lots", "Lot", lot.Id, lot.LotNumber, changes);
        return Ok(ToDto(lot));
    }

    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> ToggleActiveStatus(int id)
    {
        var lot = await _db.Lots.Include(l => l.Size).FirstOrDefaultAsync(l => l.Id == id);
        if (lot == null) return NotFound();
        var oldActive = lot.IsActive;
        lot.IsActive = !lot.IsActive;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Toggle", "Lots", "Lot", lot.Id, lot.LotNumber, new() {
            new("Active", oldActive ? "Active" : "Inactive", lot.IsActive ? "Active" : "Inactive"),
        });
        return Ok(ToDto(lot));
    }

    [HttpPatch("{id}/status")]
    [RequirePermission("canEditLabour")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] LotStatusUpdateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Status))
            return BadRequest(new { message = "Status is required." });
        var lot = await _db.Lots.Include(l => l.Size).FirstOrDefaultAsync(l => l.Id == id);
        if (lot == null) return NotFound();
        var oldStatus = lot.Status;
        lot.Status = dto.Status.Trim();
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
    [HttpPost("{id}/delete")]
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
        => Ok(await _db.Sizes.Select(s => new DropdownDto { Id = s.Id, Name = s.Name, IsActive = s.IsActive }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new Size { Name = dto.Name.Trim(), IsActive = dto.IsActive };
        _db.Sizes.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.Sizes.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        item.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var item = await _db.Sizes.FindAsync(id);
        if (item == null) return NotFound();
        item.IsActive = !item.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpDelete("{id}")]
    [HttpPost("{id}/delete")]
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
        => Ok(await _db.Colors.Select(c => new DropdownDto { Id = c.Id, Name = c.Name, IsActive = c.IsActive }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new Color { Name = dto.Name.Trim(), IsActive = dto.IsActive };
        _db.Colors.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.Colors.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        item.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var item = await _db.Colors.FindAsync(id);
        if (item == null) return NotFound();
        item.IsActive = !item.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpDelete("{id}")]
    [HttpPost("{id}/delete")]
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
        => Ok(await _db.Machines.Select(m => new DropdownDto { Id = m.Id, Name = m.Name, IsActive = m.IsActive }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new Machine { Name = dto.Name.Trim(), IsActive = dto.IsActive };
        _db.Machines.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.Machines.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        item.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var item = await _db.Machines.FindAsync(id);
        if (item == null) return NotFound();
        item.IsActive = !item.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpDelete("{id}")]
    [HttpPost("{id}/delete")]
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

// ── TaskTypes CRUD ───────────────────────────────────────────────────────────
[ApiController]
[Route("api/masters/task-types")]
[Authorize]
[Produces("application/json")]
public class TaskTypesController : ControllerBase
{
    private readonly AppDbContext _db;
    public TaskTypesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.TaskTypes.Select(t => new DropdownDto { Id = t.Id, Name = t.Name, IsActive = t.IsActive }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new TaskTypeItem { Name = dto.Name.Trim(), IsActive = dto.IsActive };
        _db.TaskTypes.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.TaskTypes.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        item.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var item = await _db.TaskTypes.FindAsync(id);
        if (item == null) return NotFound();
        item.IsActive = !item.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpDelete("{id}")]
    [RequirePermission("canDeleteSettings")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.TaskTypes.FindAsync(id);
        if (item == null) return NotFound();
        _db.TaskTypes.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

// ── Materials CRUD ───────────────────────────────────────────────────────────
[ApiController]
[Route("api/masters/materials")]
[Authorize]
[Produces("application/json")]
public class MaterialsController : ControllerBase
{
    private readonly AppDbContext _db;
    public MaterialsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.Materials.Select(m => new DropdownDto { Id = m.Id, Name = m.Name, IsActive = m.IsActive }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new MaterialItem { Name = dto.Name.Trim(), IsActive = dto.IsActive };
        _db.Materials.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.Materials.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        item.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var item = await _db.Materials.FindAsync(id);
        if (item == null) return NotFound();
        item.IsActive = !item.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpDelete("{id}")]
    [RequirePermission("canDeleteSettings")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Materials.FindAsync(id);
        if (item == null) return NotFound();
        _db.Materials.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

// ── BagTypes CRUD ────────────────────────────────────────────────────────────
[ApiController]
[Route("api/masters/bag-types")]
[Authorize]
[Produces("application/json")]
public class BagTypesController : ControllerBase
{
    private readonly AppDbContext _db;
    public BagTypesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.BagTypes.Select(b => new DropdownDto { Id = b.Id, Name = b.Name, IsActive = b.IsActive }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new BagTypeItem { Name = dto.Name.Trim(), IsActive = dto.IsActive };
        _db.BagTypes.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.BagTypes.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        item.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var item = await _db.BagTypes.FindAsync(id);
        if (item == null) return NotFound();
        item.IsActive = !item.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpDelete("{id}")]
    [RequirePermission("canDeleteSettings")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.BagTypes.FindAsync(id);
        if (item == null) return NotFound();
        _db.BagTypes.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

// ── WorkerRoles CRUD ─────────────────────────────────────────────────────────
[ApiController]
[Route("api/masters/worker-roles")]
[Authorize]
[Produces("application/json")]
public class WorkerRolesController : ControllerBase
{
    private readonly AppDbContext _db;
    public WorkerRolesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.WorkerRoles.Select(r => new DropdownDto { Id = r.Id, Name = r.Name, IsActive = r.IsActive }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new WorkerRoleItem { Name = dto.Name.Trim(), IsActive = dto.IsActive };
        _db.WorkerRoles.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.WorkerRoles.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        item.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var item = await _db.WorkerRoles.FindAsync(id);
        if (item == null) return NotFound();
        item.IsActive = !item.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpDelete("{id}")]
    [RequirePermission("canDeleteSettings")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.WorkerRoles.FindAsync(id);
        if (item == null) return NotFound();
        _db.WorkerRoles.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

// ── LotStages CRUD ───────────────────────────────────────────────────────────
[ApiController]
[Route("api/masters/lot-stages")]
[Authorize]
[Produces("application/json")]
public class LotStagesController : ControllerBase
{
    private readonly AppDbContext _db;
    public LotStagesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.LotStages.Select(s => new DropdownDto { Id = s.Id, Name = s.Name, IsActive = s.IsActive }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] DropdownDto dto)
    {
        var item = new LotStageItem { Name = dto.Name.Trim(), IsActive = dto.IsActive };
        _db.LotStages.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] DropdownDto dto)
    {
        var item = await _db.LotStages.FindAsync(id);
        if (item == null) return NotFound();
        item.Name = dto.Name.Trim();
        item.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var item = await _db.LotStages.FindAsync(id);
        if (item == null) return NotFound();
        item.IsActive = !item.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new DropdownDto { Id = item.Id, Name = item.Name, IsActive = item.IsActive });
    }

    [HttpDelete("{id}")]
    [HttpPost("{id}/delete")]
    [RequirePermission("canDeleteSettings")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.LotStages.FindAsync(id);
        if (item == null) return NotFound();
        _db.LotStages.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
