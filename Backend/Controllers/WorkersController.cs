using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClothingManager.Authorization;
using ClothingManager.Data;
using ClothingManager.Models;
using ClothingManager.Services;

namespace ClothingManager.Controllers;

/// <summary>Workers CRUD for Labour Module</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class WorkersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    public WorkersController(AppDbContext db, AuditService audit) { _db = db; _audit = audit; }

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _db.Workers.Select(w => new {
            w.Id, w.Name, w.SheetType, w.IsActive, w.PersonType,
            Phone = w.Phone ?? "", JoinDate = w.JoinDate ?? ""
        }).ToListAsync());

    [HttpPost]
    [RequirePermission("canAddSettings")]
    public async Task<IActionResult> Create([FromBody] WorkerCreateDto dto)
    {
        var w = new Worker {
            Name = dto.Name,
            SheetType = dto.SheetType,
            IsActive = dto.IsActive,
            PersonType = dto.PersonType,
            Phone = dto.Phone,
            JoinDate = dto.JoinDate
        };
        _db.Workers.Add(w);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Create", "Labour", "Worker", w.Id, w.Name, new() {
            new("Name",        null, w.Name),
            new("Type",        null, w.PersonType),
            new("Sheet Type",  null, w.SheetType),
            new("Phone",       null, w.Phone),
            new("Status",      null, w.IsActive ? "Active" : "Inactive"),
        });
        return Ok(new { w.Id, w.Name, w.SheetType, w.IsActive, w.PersonType, Phone = w.Phone ?? "", JoinDate = w.JoinDate ?? "" });
    }

    [HttpPut("{id}")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> Update(int id, [FromBody] WorkerCreateDto dto)
    {
        var w = await _db.Workers.FindAsync(id);
        if (w == null) return NotFound();
        var old = new { w.Name, w.SheetType, w.IsActive, w.PersonType, w.Phone, w.JoinDate };
        w.Name = dto.Name;
        w.SheetType = dto.SheetType;
        w.IsActive = dto.IsActive;
        w.PersonType = dto.PersonType;
        w.Phone = dto.Phone;
        w.JoinDate = dto.JoinDate;
        await _db.SaveChangesAsync();
        var changes = new List<FieldChange>();
        if (old.Name       != w.Name)       changes.Add(new("Name",        old.Name,       w.Name));
        if (old.SheetType  != w.SheetType)  changes.Add(new("Sheet Type",  old.SheetType,  w.SheetType));
        if (old.PersonType != w.PersonType) changes.Add(new("Type",        old.PersonType, w.PersonType));
        if (old.Phone      != w.Phone)      changes.Add(new("Phone",       old.Phone,      w.Phone));
        if (old.IsActive   != w.IsActive)   changes.Add(new("Status",      old.IsActive ? "Active" : "Inactive", w.IsActive ? "Active" : "Inactive"));
        if (changes.Count > 0)
            await _audit.LogAsync("Update", "Labour", "Worker", w.Id, w.Name, changes);
        return Ok(new { w.Id, w.Name, w.SheetType, w.IsActive, w.PersonType, Phone = w.Phone ?? "", JoinDate = w.JoinDate ?? "" });
    }

    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canEditSettings")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var w = await _db.Workers.FindAsync(id);
        if (w == null) return NotFound();
        var oldStatus = w.IsActive;
        w.IsActive = !w.IsActive;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Toggle", "Labour", "Worker", w.Id, w.Name, new() {
            new("Status", oldStatus ? "Active" : "Inactive", w.IsActive ? "Active" : "Inactive"),
        });
        return Ok(new { w.Id, w.IsActive });
    }

    [HttpDelete("{id}")]
    [RequirePermission("canDeleteSettings")]
    public async Task<IActionResult> Delete(int id)
    {
        var w = await _db.Workers.FindAsync(id);
        if (w == null) return NotFound();
        var name = w.Name;
        _db.Workers.Remove(w);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Delete", "Labour", "Worker", id, name, new() {
            new("Name",  name,  null),
            new("Type",  w.PersonType, null),
        });
        return NoContent();
    }
}

public class WorkerCreateDto
{
    public string Name       { get; set; } = string.Empty;
    public string SheetType  { get; set; } = string.Empty;
    public string? Phone     { get; set; }
    public string? JoinDate  { get; set; }
    public bool   IsActive   { get; set; } = true;
    public string PersonType { get; set; } = "Worker"; // "Worker" | "Management"
}
