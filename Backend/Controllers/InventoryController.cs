using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClothingManager.Data;
using ClothingManager.DTOs;
using ClothingManager.Models;

namespace ClothingManager.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class InventoryController : ControllerBase
{
    private readonly AppDbContext _db;
    public InventoryController(AppDbContext db) => _db = db;

    // ── Summary ──────────────────────────────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var purchases = await _db.BagPurchases.ToListAsync();
        var usages    = await _db.InventoryUsages.ToListAsync();

        var usedById  = usages.GroupBy(u => u.BagPurchaseId)
                              .ToDictionary(g => g.Key, g => g.Sum(u => u.QuantityUsed));

        var stocks = purchases.Select(p => {
            var used      = usedById.GetValueOrDefault(p.Id, 0);
            var remaining = p.Quantity - used;
            return (p.Quantity, used, remaining);
        }).ToList();

        return Ok(new InventorySummaryDto
        {
            TotalBagTypes   = purchases.Count,
            TotalPurchased  = stocks.Sum(s => s.Quantity),
            TotalUsed       = stocks.Sum(s => s.used),
            TotalRemaining  = stocks.Sum(s => s.remaining),
            LowStockCount   = stocks.Count(s => s.remaining > 0 && s.remaining < s.Quantity * 0.2m),
            OutOfStockCount = stocks.Count(s => s.remaining <= 0),
        });
    }

    // ── Stock levels per bag ──────────────────────────────────────────────────
    [HttpGet("stock")]
    public async Task<IActionResult> Stock([FromQuery] string? material)
    {
        var usages = await _db.InventoryUsages
            .GroupBy(u => u.BagPurchaseId)
            .Select(g => new { BagPurchaseId = g.Key, TotalUsed = g.Sum(u => u.QuantityUsed) })
            .ToListAsync();

        var usedById = usages.ToDictionary(x => x.BagPurchaseId, x => x.TotalUsed);

        var q = _db.BagPurchases.Include(p => p.Supplier).AsQueryable();
        if (!string.IsNullOrWhiteSpace(material)) q = q.Where(p => p.Material == material);

        var purchases = await q.OrderBy(p => p.Material).ThenBy(p => p.BagNumber).ToListAsync();

        var stock = purchases.Select(p => {
            var used = usedById.GetValueOrDefault(p.Id, 0);
            return new BagStockDto
            {
                BagPurchaseId  = p.Id,
                BagNumber      = p.BagNumber,
                Material       = p.Material,
                BagType        = p.BagType,
                SupplierName   = p.Supplier?.Name,
                PurchaseDate   = p.PurchaseDate,
                TotalPurchased = p.Quantity,
                TotalUsed      = used,
                RemainingStock = p.Quantity - used,
            };
        }).ToList();

        return Ok(stock);
    }

    // ── All usage records ─────────────────────────────────────────────────────
    [HttpGet("usages")]
    public async Task<IActionResult> GetUsages([FromQuery] int? lotId, [FromQuery] int? bagPurchaseId, [FromQuery] string? material)
    {
        var q = _db.InventoryUsages
            .Include(u => u.Lot).ThenInclude(l => l.Size)
            .Include(u => u.BagPurchase).ThenInclude(bp => bp.Supplier)
            .AsQueryable();

        if (lotId.HasValue)         q = q.Where(u => u.LotId == lotId.Value);
        if (bagPurchaseId.HasValue) q = q.Where(u => u.BagPurchaseId == bagPurchaseId.Value);
        if (!string.IsNullOrWhiteSpace(material))
            q = q.Where(u => u.BagPurchase.Material == material);

        var list = await q.OrderByDescending(u => u.UsageDate).ThenByDescending(u => u.CreatedAt).ToListAsync();
        return Ok(list.Select(u => ToDto(u)));
    }

    // ── Usages for one lot ────────────────────────────────────────────────────
    [HttpGet("lot/{lotId}")]
    public async Task<IActionResult> GetByLot(int lotId)
    {
        var lot = await _db.Lots.Include(l => l.Size).FirstOrDefaultAsync(l => l.Id == lotId);
        if (lot == null) return NotFound();

        var usages = await _db.InventoryUsages
            .Include(u => u.BagPurchase).ThenInclude(bp => bp.Supplier)
            .Where(u => u.LotId == lotId)
            .OrderByDescending(u => u.UsageDate)
            .ToListAsync();

        return Ok(new LotUsageSummaryDto
        {
            LotId         = lot.Id,
            LotNumber     = lot.LotNumber,
            SizeName      = lot.Size?.Name,
            TotalBagsUsed = usages.Sum(u => u.QuantityUsed),
            Usages        = usages.Select(u => ToDto(u, lot)).ToList(),
        });
    }

    // ── Create ────────────────────────────────────────────────────────────────
    [HttpPost("usages")]
    public async Task<IActionResult> Create([FromBody] InventoryUsageCreateDto dto)
    {
        var bag = await _db.BagPurchases.FindAsync(dto.BagPurchaseId);
        if (bag == null) return BadRequest("Bag not found.");

        // Check sufficient stock
        var used = await _db.InventoryUsages
            .Where(u => u.BagPurchaseId == dto.BagPurchaseId)
            .SumAsync(u => u.QuantityUsed);
        if (used + dto.QuantityUsed > bag.Quantity)
            return BadRequest($"Insufficient stock. Available: {bag.Quantity - used} bags.");

        var usage = new InventoryUsage
        {
            LotId         = dto.LotId,
            BagPurchaseId = dto.BagPurchaseId,
            QuantityUsed  = dto.QuantityUsed,
            UsageDate     = dto.UsageDate,
            Notes         = dto.Notes?.Trim(),
        };
        _db.InventoryUsages.Add(usage);
        await _db.SaveChangesAsync();

        await _db.Entry(usage).Reference(u => u.Lot).LoadAsync();
        await _db.Entry(usage.Lot).Reference(l => l.Size).LoadAsync();
        await _db.Entry(usage).Reference(u => u.BagPurchase).LoadAsync();
        await _db.Entry(usage.BagPurchase).Reference(bp => bp.Supplier).LoadAsync();

        return Ok(ToDto(usage));
    }

    // ── Update ────────────────────────────────────────────────────────────────
    [HttpPut("usages/{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] InventoryUsageCreateDto dto)
    {
        var usage = await _db.InventoryUsages.FindAsync(id);
        if (usage == null) return NotFound();

        var bag = await _db.BagPurchases.FindAsync(dto.BagPurchaseId);
        if (bag == null) return BadRequest("Bag not found.");

        var used = await _db.InventoryUsages
            .Where(u => u.BagPurchaseId == dto.BagPurchaseId && u.Id != id)
            .SumAsync(u => u.QuantityUsed);
        if (used + dto.QuantityUsed > bag.Quantity)
            return BadRequest($"Insufficient stock. Available: {bag.Quantity - used} bags.");

        usage.LotId         = dto.LotId;
        usage.BagPurchaseId = dto.BagPurchaseId;
        usage.QuantityUsed  = dto.QuantityUsed;
        usage.UsageDate     = dto.UsageDate;
        usage.Notes         = dto.Notes?.Trim();
        await _db.SaveChangesAsync();

        return Ok(await LoadDto(id));
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    [HttpDelete("usages/{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var usage = await _db.InventoryUsages.FindAsync(id);
        if (usage == null) return NotFound();
        _db.InventoryUsages.Remove(usage);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private async Task<InventoryUsageDto> LoadDto(int id)
    {
        var u = await _db.InventoryUsages
            .Include(x => x.Lot).ThenInclude(l => l.Size)
            .Include(x => x.BagPurchase).ThenInclude(bp => bp.Supplier)
            .FirstAsync(x => x.Id == id);
        return ToDto(u);
    }

    private static InventoryUsageDto ToDto(InventoryUsage u, Lot? lot = null) => new()
    {
        Id            = u.Id,
        LotId         = u.LotId,
        LotNumber     = (lot ?? u.Lot)?.LotNumber ?? "",
        SizeName      = (lot ?? u.Lot)?.Size?.Name,
        BagPurchaseId = u.BagPurchaseId,
        BagNumber     = u.BagPurchase?.BagNumber ?? "",
        Material      = u.BagPurchase?.Material ?? "",
        BagType       = u.BagPurchase?.BagType ?? "",
        SupplierName  = u.BagPurchase?.Supplier?.Name,
        QuantityUsed  = u.QuantityUsed,
        UsageDate     = u.UsageDate,
        Notes         = u.Notes,
        CreatedAt     = u.CreatedAt,
    };
}
