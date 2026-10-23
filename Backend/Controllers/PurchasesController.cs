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
public class PurchasesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    public PurchasesController(AppDbContext db, AuditService audit) { _db = db; _audit = audit; }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? material,
        [FromQuery] string? bagType,
        [FromQuery] string? bagNumber,
        [FromQuery] int? supplierId)
    {
        var q = _db.BagPurchases.Include(p => p.Supplier).AsQueryable();
        if (!string.IsNullOrWhiteSpace(material))  q = q.Where(p => p.Material == material);
        if (!string.IsNullOrWhiteSpace(bagType))   q = q.Where(p => p.BagType == bagType);
        if (!string.IsNullOrWhiteSpace(bagNumber)) q = q.Where(p => p.BagNumber.Contains(bagNumber));
        if (supplierId.HasValue)                   q = q.Where(p => p.SupplierId == supplierId.Value);
        var list = await q
            .OrderByDescending(p => p.PurchaseDate)
            .ThenByDescending(p => p.CreatedAt)
            .ToListAsync();
        return Ok(list.Select(ToDto));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var all = await _db.BagPurchases.Include(p => p.Supplier).ToListAsync();
        var summary = new PurchaseSummaryDto
        {
            TotalBags    = all.Sum(p => p.Quantity),
            TotalValue   = all.Sum(p => (p.UnitPrice ?? 0) * p.Quantity),
            TotalRecords = all.Count,
            ByMaterial   = all
                .GroupBy(p => p.Material)
                .Select(g => new MaterialSummaryDto
                {
                    Material  = g.Key,
                    TotalBags = g.Sum(p => p.Quantity),
                    Records   = g.Count(),
                    BagNumbers = g.OrderBy(p => p.BagNumber)
                        .Select(p => new BagNumberInfoDto
                        {
                            BagNumber    = p.BagNumber,
                            BagType      = p.BagType,
                            Quantity     = p.Quantity,
                            PurchaseDate = p.PurchaseDate,
                        }).ToList()
                })
                .OrderBy(m => m.Material)
                .ToList()
        };
        return Ok(summary);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BagPurchaseCreateDto dto)
    {
        var p = new BagPurchase
        {
            BagNumber    = dto.BagNumber.Trim(),
            Material     = dto.Material.Trim(),
            BagType      = dto.BagType.Trim(),
            Quantity     = dto.Quantity,
            PurchaseDate = dto.PurchaseDate,
            UnitPrice    = dto.UnitPrice,
            SupplierId   = dto.SupplierId,
            Notes        = dto.Notes?.Trim(),
        };
        _db.BagPurchases.Add(p);
        await _db.SaveChangesAsync();
        await _db.Entry(p).Reference(x => x.Supplier).LoadAsync();
        await _audit.LogAsync("Create", "Purchases", "Purchase", p.Id, p.BagNumber, new() {
            new("Bag Number",  null, p.BagNumber),
            new("Material",    null, p.Material),
            new("Bag Type",    null, p.BagType),
            new("Quantity",    null, p.Quantity.ToString()),
            new("Unit Price",  null, p.UnitPrice?.ToString("F2")),
            new("Supplier",    null, p.Supplier?.Name),
        });
        return Ok(ToDto(p));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] BagPurchaseCreateDto dto)
    {
        var p = await _db.BagPurchases.Include(x => x.Supplier).FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return NotFound();
        var old = new { p.BagNumber, p.Material, p.BagType, p.Quantity, p.UnitPrice, p.SupplierId, p.Notes };
        p.BagNumber    = dto.BagNumber.Trim();
        p.Material     = dto.Material.Trim();
        p.BagType      = dto.BagType.Trim();
        p.Quantity     = dto.Quantity;
        p.PurchaseDate = dto.PurchaseDate;
        p.UnitPrice    = dto.UnitPrice;
        p.SupplierId   = dto.SupplierId;
        p.Notes        = dto.Notes?.Trim();
        await _db.SaveChangesAsync();
        await _db.Entry(p).Reference(x => x.Supplier).LoadAsync();
        var changes = new List<FieldChange>();
        if (old.BagNumber != p.BagNumber) changes.Add(new("Bag Number", old.BagNumber, p.BagNumber));
        if (old.Material  != p.Material)  changes.Add(new("Material",   old.Material,  p.Material));
        if (old.BagType   != p.BagType)   changes.Add(new("Bag Type",   old.BagType,   p.BagType));
        if (old.Quantity  != p.Quantity)  changes.Add(new("Quantity",   old.Quantity.ToString(), p.Quantity.ToString()));
        if (old.UnitPrice != p.UnitPrice) changes.Add(new("Unit Price", old.UnitPrice?.ToString("F2"), p.UnitPrice?.ToString("F2")));
        if (changes.Count > 0) await _audit.LogAsync("Update", "Purchases", "Purchase", p.Id, p.BagNumber, changes);
        return Ok(ToDto(p));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var p = await _db.BagPurchases.FindAsync(id);
        if (p == null) return NotFound();
        var bagNumber = p.BagNumber;
        _db.BagPurchases.Remove(p);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Delete", "Purchases", "Purchase", id, bagNumber, new() {
            new("Bag Number", bagNumber, null),
            new("Material",   p.Material, null),
            new("Quantity",   p.Quantity.ToString(), null),
        });
        return NoContent();
    }

    private static BagPurchaseDto ToDto(BagPurchase p) => new()
    {
        Id           = p.Id,
        BagNumber    = p.BagNumber,
        Material     = p.Material,
        BagType      = p.BagType,
        Quantity     = p.Quantity,
        PurchaseDate = p.PurchaseDate,
        UnitPrice    = p.UnitPrice,
        TotalAmount  = p.UnitPrice.HasValue ? p.UnitPrice * p.Quantity : null,
        SupplierId   = p.SupplierId,
        SupplierName = p.Supplier?.Name,
        Notes        = p.Notes,
        CreatedAt    = p.CreatedAt,
    };
}
