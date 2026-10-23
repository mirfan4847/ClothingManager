using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClothingManager.Data;
using ClothingManager.DTOs;
using ClothingManager.Models;
using ClothingManager.Services;

namespace ClothingManager.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class SuppliersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    public SuppliersController(AppDbContext db, AuditService audit) { _db = db; _audit = audit; }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var suppliers = await _db.Suppliers
            .OrderBy(s => s.Name)
            .Select(s => new SupplierDto
            {
                Id            = s.Id,
                Name          = s.Name,
                Phone         = s.Phone,
                Address       = s.Address,
                Notes         = s.Notes,
                IsActive      = s.IsActive,
                PurchaseCount = s.Purchases.Count,
                CreatedAt     = s.CreatedAt,
            }).ToListAsync();
        return Ok(suppliers);
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActive()
    {
        var suppliers = await _db.Suppliers
            .Where(s => s.IsActive)
            .OrderBy(s => s.Name)
            .Select(s => new SupplierDto
            {
                Id        = s.Id,
                Name      = s.Name,
                Phone     = s.Phone,
                Address   = s.Address,
                Notes     = s.Notes,
                IsActive  = s.IsActive,
                CreatedAt = s.CreatedAt,
            }).ToListAsync();
        return Ok(suppliers);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SupplierCreateDto dto)
    {
        var supplier = new Supplier
        {
            Name    = dto.Name.Trim(),
            Phone   = dto.Phone?.Trim(),
            Address = dto.Address?.Trim(),
            Notes   = dto.Notes?.Trim(),
        };
        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Create", "Suppliers", "Supplier", supplier.Id, supplier.Name, new() {
            new("Name",  null, supplier.Name),
            new("Phone", null, supplier.Phone),
        });
        return Ok(ToDto(supplier));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] SupplierCreateDto dto)
    {
        var supplier = await _db.Suppliers.FindAsync(id);
        if (supplier == null) return NotFound();
        var old = new { supplier.Name, supplier.Phone, supplier.Address };
        supplier.Name    = dto.Name.Trim();
        supplier.Phone   = dto.Phone?.Trim();
        supplier.Address = dto.Address?.Trim();
        supplier.Notes   = dto.Notes?.Trim();
        await _db.SaveChangesAsync();
        var changes = new List<FieldChange>();
        if (old.Name    != supplier.Name)    changes.Add(new("Name",    old.Name,    supplier.Name));
        if (old.Phone   != supplier.Phone)   changes.Add(new("Phone",   old.Phone,   supplier.Phone));
        if (old.Address != supplier.Address) changes.Add(new("Address", old.Address, supplier.Address));
        if (changes.Count > 0) await _audit.LogAsync("Update", "Suppliers", "Supplier", supplier.Id, supplier.Name, changes);
        return Ok(ToDto(supplier));
    }

    [HttpPatch("{id}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var supplier = await _db.Suppliers.FindAsync(id);
        if (supplier == null) return NotFound();
        var oldStatus = supplier.IsActive;
        supplier.IsActive = !supplier.IsActive;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Toggle", "Suppliers", "Supplier", supplier.Id, supplier.Name, new() {
            new("Status", oldStatus ? "Active" : "Inactive", supplier.IsActive ? "Active" : "Inactive"),
        });
        return Ok(ToDto(supplier));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var supplier = await _db.Suppliers
            .Include(s => s.Purchases)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (supplier == null) return NotFound();
        if (supplier.Purchases.Any())
            return BadRequest("Cannot delete supplier with existing purchases. Deactivate it instead.");
        var name = supplier.Name;
        _db.Suppliers.Remove(supplier);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Delete", "Suppliers", "Supplier", id, name, new() {
            new("Name", name, null),
        });
        return NoContent();
    }

    private static SupplierDto ToDto(Supplier s, int purchaseCount = 0) => new()
    {
        Id            = s.Id,
        Name          = s.Name,
        Phone         = s.Phone,
        Address       = s.Address,
        Notes         = s.Notes,
        IsActive      = s.IsActive,
        PurchaseCount = purchaseCount,
        CreatedAt     = s.CreatedAt,
    };
}
