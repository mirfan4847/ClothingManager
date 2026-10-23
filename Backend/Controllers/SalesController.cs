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
public class SalesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AccountsService _accounts;
    private readonly AuditService _audit;
    public SalesController(AppDbContext db, AccountsService accounts, AuditService audit)
    { _db = db; _accounts = accounts; _audit = audit; }

    // ── Summary ──────────────────────────────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var sales = await _db.Sales.Include(s => s.Payments).ToListAsync();
        var totalPaid = sales.Sum(s => s.Payments.Sum(p => p.Amount));
        return Ok(new SaleSummaryDto
        {
            TotalSales    = sales.Count,
            TotalRevenue  = sales.Sum(s => s.NetAmount),
            TotalPaid     = totalPaid,
            TotalBalance  = sales.Sum(s => s.NetAmount) - totalPaid,
            PendingCount  = sales.Count(s => s.Status == "Pending"),
            PartialCount  = sales.Count(s => s.Status == "Partial"),
            PaidCount     = sales.Count(s => s.Status == "Paid"),
        });
    }

    // ── GetAll ────────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? customerId, [FromQuery] string? status,
        [FromQuery] DateTime? from,  [FromQuery] DateTime? to)
    {
        var q = _db.Sales
            .Include(s => s.Lot).ThenInclude(l => l.Size)
            .Include(s => s.Customer)
            .Include(s => s.Payments)
            .AsQueryable();

        if (customerId.HasValue)                   q = q.Where(s => s.CustomerId == customerId.Value);
        if (!string.IsNullOrWhiteSpace(status))    q = q.Where(s => s.Status == status);
        if (from.HasValue)                         q = q.Where(s => s.SaleDate >= from.Value);
        if (to.HasValue)                           q = q.Where(s => s.SaleDate <= to.Value);

        var list = await q.OrderByDescending(s => s.SaleDate).ThenByDescending(s => s.CreatedAt).ToListAsync();
        return Ok(list.Select(s => ToDto(s)));
    }

    // ── GetById ───────────────────────────────────────────────────────────────
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var sale = await LoadSale(id);
        if (sale == null) return NotFound();
        return Ok(ToDto(sale));
    }

    // ── Create ────────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaleCreateDto dto)
    {
        if (!await _db.Lots.AnyAsync(l => l.Id == dto.LotId))
            return BadRequest("Lot not found.");
        if (!await _db.Customers.AnyAsync(c => c.Id == dto.CustomerId))
            return BadRequest("Customer not found.");
        if (dto.TotalPieces <= 0)
            return BadRequest("Total pieces must be greater than 0.");
        if (dto.RatePerPiece <= 0)
            return BadRequest("Rate per piece must be greater than 0.");

        var totalAmount = dto.TotalPieces * dto.RatePerPiece;
        var netAmount   = totalAmount - dto.Discount;

        var sale = new Sale
        {
            LotId        = dto.LotId,
            CustomerId   = dto.CustomerId,
            SaleDate     = dto.SaleDate,
            TotalPieces  = dto.TotalPieces,
            RatePerPiece = dto.RatePerPiece,
            TotalAmount  = totalAmount,
            Discount     = dto.Discount,
            NetAmount    = netAmount,
            Status       = "Pending",
            Notes        = dto.Notes?.Trim(),
        };
        _db.Sales.Add(sale);
        await _db.SaveChangesAsync();
        var created = await LoadSale(sale.Id);
        var lotNum  = created?.Lot?.LotNumber ?? sale.LotId.ToString();
        var custName = created?.Customer?.Name ?? sale.CustomerId.ToString();
        await _audit.LogAsync("Create", "Sales", "Sale", sale.Id,
            $"Lot {lotNum} / {custName}", new() {
                new("Customer",   null, custName),
                new("Lot",        null, lotNum),
                new("Pieces",     null, dto.TotalPieces.ToString()),
                new("Net Amount", null, netAmount.ToString("F2")),
            });
        return Ok(ToDto(created!));
    }

    // ── Update ────────────────────────────────────────────────────────────────
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] SaleCreateDto dto)
    {
        var sale = await _db.Sales.Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == id);
        if (sale == null) return NotFound();

        if (!await _db.Lots.AnyAsync(l => l.Id == dto.LotId))
            return BadRequest("Lot not found.");
        if (!await _db.Customers.AnyAsync(c => c.Id == dto.CustomerId))
            return BadRequest("Customer not found.");

        var totalAmount = dto.TotalPieces * dto.RatePerPiece;
        var netAmount   = totalAmount - dto.Discount;
        var totalPaid   = sale.Payments.Sum(p => p.Amount);

        sale.LotId        = dto.LotId;
        sale.CustomerId   = dto.CustomerId;
        sale.SaleDate     = dto.SaleDate;
        sale.TotalPieces  = dto.TotalPieces;
        sale.RatePerPiece = dto.RatePerPiece;
        sale.TotalAmount  = totalAmount;
        sale.Discount     = dto.Discount;
        sale.NetAmount    = netAmount;
        sale.Status       = CalcStatus(netAmount, totalPaid);
        sale.Notes        = dto.Notes?.Trim();
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Update", "Sales", "Sale", id,
            $"Sale #{id}", new List<FieldChange> {
                new("Pieces",     dto.TotalPieces.ToString(), null),
                new("Net Amount", netAmount.ToString("F2"), null),
            });
        return Ok(ToDto(await LoadSale(id)!));
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var sale = await _db.Sales.Include(s => s.Payments)
            .Include(s => s.Customer).Include(s => s.Lot)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (sale == null) return NotFound();
        if (sale.Payments.Any())
            return BadRequest("Cannot delete a sale with recorded payments. Remove payments first.");
        var label = $"Lot {sale.Lot?.LotNumber} / {sale.Customer?.Name}";
        _db.Sales.Remove(sale);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Delete", "Sales", "Sale", id, label, new() {
            new("Net Amount", sale.NetAmount.ToString("F2"), null),
        });
        return NoContent();
    }

    // ── Add Payment ───────────────────────────────────────────────────────────
    [HttpPost("{saleId}/payments")]
    public async Task<IActionResult> AddPayment(int saleId, [FromBody] SalePaymentCreateDto dto)
    {
        var sale = await _db.Sales.Include(s => s.Payments).FirstOrDefaultAsync(s => s.Id == saleId);
        if (sale == null) return NotFound("Sale not found.");
        if (dto.Amount <= 0) return BadRequest("Payment amount must be greater than 0.");

        var currentPaid = sale.Payments.Sum(p => p.Amount);
        var remaining   = sale.NetAmount - currentPaid;
        if (dto.Amount > remaining)
            return BadRequest($"Payment exceeds balance. Remaining: {remaining:F2}");

        var saleWithCustomer = await _db.Sales.Include(s => s.Customer).Include(s => s.Lot).FirstAsync(s => s.Id == saleId);

        _db.SalePayments.Add(new SalePayment
        {
            SaleId        = saleId,
            Amount        = dto.Amount,
            PaymentDate   = dto.PaymentDate,
            PaymentMethod = dto.PaymentMethod,
            ReferenceNo   = dto.ReferenceNo?.Trim(),
            Notes         = dto.Notes?.Trim(),
        });

        sale.Status = CalcStatus(sale.NetAmount, currentPaid + dto.Amount);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Create", "Sales", "SalePayment", saleId,
            $"Sale #{saleId} — {saleWithCustomer.Customer?.Name}", new() {
                new("Amount", null, dto.Amount.ToString("F2")),
                new("Method", null, dto.PaymentMethod),
            });

        // Auto-create Finance Credit transaction if account selected
        if (dto.AccountId.HasValue)
        {
            var description = $"Sale payment — {saleWithCustomer.Customer?.Name ?? "Customer"} / Lot {saleWithCustomer.Lot?.LotNumber ?? saleId.ToString()}";
            await _accounts.AddTransactionAsync(new TransactionCreateDto
            {
                AccountId   = dto.AccountId.Value,
                Type        = "Credit",
                Amount      = dto.Amount,
                Description = description,
                ReferenceNo = dto.ReferenceNo?.Trim(),
                Date        = dto.PaymentDate,
            });
        }

        return Ok(ToDto(await LoadSale(saleId)!));
    }

    // ── Delete Payment ────────────────────────────────────────────────────────
    [HttpDelete("payments/{id}")]
    public async Task<IActionResult> DeletePayment(int id)
    {
        var payment = await _db.SalePayments.FindAsync(id);
        if (payment == null) return NotFound();
        var saleId = payment.SaleId;
        var amount = payment.Amount;
        _db.SalePayments.Remove(payment);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Delete", "Sales", "SalePayment", id, $"Sale #{saleId}", new() {
            new("Amount", amount.ToString("F2"), null),
        });

        var sale     = await _db.Sales.Include(s => s.Payments).FirstAsync(s => s.Id == saleId);
        sale.Status  = CalcStatus(sale.NetAmount, sale.Payments.Sum(p => p.Amount));
        await _db.SaveChangesAsync();

        return Ok(ToDto(await LoadSale(saleId)!));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private async Task<Sale?> LoadSale(int id) =>
        await _db.Sales
            .Include(s => s.Lot).ThenInclude(l => l.Size)
            .Include(s => s.Customer)
            .Include(s => s.Payments)
            .FirstOrDefaultAsync(s => s.Id == id);

    private static string CalcStatus(decimal netAmount, decimal totalPaid) =>
        totalPaid <= 0 ? "Pending" : totalPaid >= netAmount ? "Paid" : "Partial";

    private static SaleDto ToDto(Sale s)
    {
        var totalPaid = s.Payments?.Sum(p => p.Amount) ?? 0;
        return new SaleDto
        {
            Id           = s.Id,
            LotId        = s.LotId,
            LotNumber    = s.Lot?.LotNumber ?? "",
            SizeName     = s.Lot?.Size?.Name,
            CustomerId   = s.CustomerId,
            CustomerName = s.Customer?.Name ?? "",
            SaleDate     = s.SaleDate,
            TotalPieces  = s.TotalPieces,
            RatePerPiece = s.RatePerPiece,
            TotalAmount  = s.TotalAmount,
            Discount     = s.Discount,
            NetAmount    = s.NetAmount,
            TotalPaid    = totalPaid,
            BalanceDue   = s.NetAmount - totalPaid,
            Status       = s.Status,
            Notes        = s.Notes,
            CreatedAt    = s.CreatedAt,
            Payments     = s.Payments?
                .OrderByDescending(p => p.PaymentDate)
                .Select(p => new SalePaymentDto
                {
                    Id            = p.Id,
                    SaleId        = p.SaleId,
                    Amount        = p.Amount,
                    PaymentDate   = p.PaymentDate,
                    PaymentMethod = p.PaymentMethod,
                    ReferenceNo   = p.ReferenceNo,
                    Notes         = p.Notes,
                    CreatedAt     = p.CreatedAt,
                }).ToList() ?? new(),
        };
    }
}
