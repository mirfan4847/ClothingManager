using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClothingManager.Authorization;
using ClothingManager.Data;
using ClothingManager.DTOs;
using ClothingManager.Models;
using ClothingManager.Services;

namespace ClothingManager.Controllers;

/// <summary>Wage rates, calculation, and payment management</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[RequirePermission("canViewWages")]
[Produces("application/json")]
public class WagesController : ControllerBase
{
    private readonly WageService _svc;
    private readonly AccountsService _accounts;
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    public WagesController(WageService svc, AccountsService accounts, AppDbContext db, AuditService audit)
    { _svc = svc; _accounts = accounts; _db = db; _audit = audit; }

    // ── Rates ─────────────────────────────────────────────────────────────

    [HttpGet("rates")]
    public async Task<IActionResult> GetRates([FromQuery] int? workerId)
        => Ok(await _svc.GetRatesAsync(workerId));

    [HttpPost("rates")]
    [RequirePermission("canManageWages")]
    public async Task<IActionResult> UpsertRate([FromBody] WageRateCreateDto dto)
    {
        var rate = await _svc.UpsertRateAsync(dto);
        var worker = await _db.Workers.FindAsync(dto.WorkerId);
        await _audit.LogAsync("Update", "Wages", "WageRate", rate.Id, worker?.Name ?? $"Worker #{dto.WorkerId}", new() {
            new("Task Type",  null, dto.TaskType),
            new("Rate/Piece", null, dto.RatePerPiece.ToString("F2")),
        });
        return Ok(rate);
    }

    [HttpDelete("rates/{id}")]
    [RequirePermission("canManageWages")]
    public async Task<IActionResult> DeleteRate(int id)
    {
        var rate = await _db.WageRates.Include(r => r.Worker).FirstOrDefaultAsync(r => r.Id == id);
        if (!await _svc.DeleteRateAsync(id)) return NotFound();
        await _audit.LogAsync("Delete", "Wages", "WageRate", id, rate?.Worker?.Name ?? $"Rate #{id}", new() {
            new("Task Type",  rate?.TaskType, null),
            new("Rate/Piece", rate?.RatePerPiece.ToString("F2"), null),
        });
        return NoContent();
    }

    // ── Calculate ─────────────────────────────────────────────────────────

    [HttpGet("calculate")]
    public async Task<IActionResult> Calculate(
        [FromQuery] int workerId,
        [FromQuery] DateTime from,
        [FromQuery] DateTime to)
    {
        var result = await _svc.CalculateAsync(workerId, from, to.AddDays(1).AddTicks(-1));
        if (result == null) return NotFound(new { message = "Worker not found." });
        return Ok(result);
    }

    // ── Payments ──────────────────────────────────────────────────────────

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
        => Ok(await _svc.GetSummaryAsync());

    [HttpGet("payments")]
    public async Task<IActionResult> GetPayments(
        [FromQuery] int? workerId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
        => Ok(await _svc.GetPaymentsAsync(workerId, from, to));

    [HttpPost("payments")]
    [RequirePermission("canRecordPayment")]
    public async Task<IActionResult> CreatePayment([FromBody] WagePaymentCreateDto dto)
    {
        var payment = await _svc.CreatePaymentAsync(dto);
        await _audit.LogAsync("Create", "Wages", "Payment", payment.Id, payment.WorkerName, new() {
            new("Net Amount", null, dto.NetAmount.ToString("F2")),
            new("Period",     null, $"{dto.PeriodFrom:dd/MM/yyyy} – {dto.PeriodTo:dd/MM/yyyy}"),
            new("Notes",      null, dto.Notes),
        });

        var salaryAccount = await _accounts.GetOrCreateSalaryAccountAsync();
        var period = $"{dto.PeriodFrom:dd/MM/yyyy} – {dto.PeriodTo:dd/MM/yyyy}";
        // Unique reference per worker+period — prevents duplicates like lot numbers
        var refNo  = $"SAL-{dto.WorkerId}-{dto.PeriodFrom:yyyyMMdd}-{dto.PeriodTo:yyyyMMdd}";

        var alreadyExists = await _db.Transactions
            .AnyAsync(t => t.AccountId == salaryAccount.Id && t.ReferenceNo == refNo);

        if (!alreadyExists)
        {
            await _accounts.AddTransactionAsync(new TransactionCreateDto
            {
                AccountId   = salaryAccount.Id,
                Type        = "Debit",
                Amount      = dto.NetAmount,
                Description = $"Salary — {payment.WorkerName} ({period})",
                ReferenceNo = refNo,
                Date        = dto.PaidAt,
            });
        }

        return Ok(payment);
    }

    // Sync existing payroll payments to Finance — skips already-synced by reference number
    [HttpPost("sync-to-finance")]
    [RequirePermission("canManageWages")]
    public async Task<IActionResult> SyncToFinance()
    {
        var salaryAccount = await _accounts.GetOrCreateSalaryAccountAsync();
        var payments = await _db.WagePayments.Include(p => p.Worker).ToListAsync();
        var existingRefs = await _db.Transactions
            .Where(t => t.AccountId == salaryAccount.Id && t.ReferenceNo != null)
            .Select(t => t.ReferenceNo!)
            .ToListAsync();

        int synced = 0;
        foreach (var p in payments)
        {
            var refNo  = $"SAL-{p.WorkerId}-{p.PeriodFrom:yyyyMMdd}-{p.PeriodTo:yyyyMMdd}";
            if (existingRefs.Contains(refNo)) continue;

            var period = $"{p.PeriodFrom:dd/MM/yyyy} – {p.PeriodTo:dd/MM/yyyy}";
            await _accounts.AddTransactionAsync(new TransactionCreateDto
            {
                AccountId   = salaryAccount.Id,
                Type        = "Debit",
                Amount      = p.NetAmount,
                Description = $"Salary — {p.Worker?.Name} ({period})",
                ReferenceNo = refNo,
                Date        = p.PaidAt,
            });
            synced++;
        }

        return Ok(new { synced, message = $"{synced} payroll record(s) synced to Finance." });
    }

    // Remove duplicate Finance transactions for salary — keeps one per worker+period
    [HttpPost("cleanup-finance-duplicates")]
    [RequirePermission("canManageWages")]
    public async Task<IActionResult> CleanupFinanceDuplicates()
    {
        var salaryAccount = await _accounts.GetOrCreateSalaryAccountAsync();
        var salaryTxs = await _db.Transactions
            .Where(t => t.AccountId == salaryAccount.Id)
            .OrderBy(t => t.Id)
            .ToListAsync();

        // Group by Description, keep earliest (lowest Id), delete the rest
        var toDelete = salaryTxs
            .GroupBy(t => t.Description)
            .Where(g => g.Count() > 1)
            .SelectMany(g => g.Skip(1))
            .ToList();

        if (toDelete.Count == 0)
            return Ok(new { removed = 0, message = "No duplicate salary transactions found." });

        // Reverse the balance effect for each deleted transaction
        var account = await _db.Accounts.FindAsync(salaryAccount.Id);
        foreach (var tx in toDelete)
        {
            if (account != null)
                account.Balance -= tx.Type == "Credit" ? tx.Amount : -tx.Amount;
            _db.Transactions.Remove(tx);
        }
        await _db.SaveChangesAsync();

        return Ok(new { removed = toDelete.Count, message = $"{toDelete.Count} duplicate salary transaction(s) removed." });
    }

    [HttpDelete("payments/{id}")]
    [RequirePermission("canManageWages")]
    public async Task<IActionResult> DeletePayment(int id)
    {
        var payment = await _db.WagePayments.Include(p => p.Worker).FirstOrDefaultAsync(p => p.Id == id);
        if (!await _svc.DeletePaymentAsync(id)) return NotFound();
        await _audit.LogAsync("Delete", "Wages", "Payment", id, payment?.Worker?.Name ?? $"Payment #{id}", new() {
            new("Net Amount", payment?.NetAmount.ToString("F2"), null),
        });
        return NoContent();
    }

    // ── Bulk calculation ──────────────────────────────────────────────────

    [HttpGet("calculate-all")]
    public async Task<IActionResult> CalculateAll(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to)
        => Ok(await _svc.CalculateAllAsync(from, to.AddDays(1).AddTicks(-1)));

    // ── Worker Advances ───────────────────────────────────────────────────

    [HttpGet("advances")]
    public async Task<IActionResult> GetAdvances(
        [FromQuery] int? workerId,
        [FromQuery] bool unsettledOnly = false)
        => Ok(await _svc.GetAdvancesAsync(workerId, unsettledOnly));

    [HttpPost("advances")]
    [RequirePermission("canRecordPayment")]
    public async Task<IActionResult> CreateAdvance([FromBody] WorkerAdvanceCreateDto dto)
    {
        var advance = await _svc.CreateAdvanceAsync(dto);
        await _audit.LogAsync("Create", "Wages", "Advance", advance.Id, advance.WorkerName, new() {
            new("Amount", null, dto.Amount.ToString("F2")),
            new("Notes",  null, dto.Notes),
        });
        return Ok(advance);
    }

    [HttpPatch("advances/{id}/settle")]
    [RequirePermission("canRecordPayment")]
    public async Task<IActionResult> SettleAdvance(int id)
        => await _svc.SettleAdvanceAsync(id) ? NoContent() : NotFound();

    [HttpDelete("advances/{id}")]
    [RequirePermission("canManageWages")]
    public async Task<IActionResult> DeleteAdvance(int id)
    {
        var advance = await _db.WorkerAdvances.Include(a => a.Worker).FirstOrDefaultAsync(a => a.Id == id);
        if (!await _svc.DeleteAdvanceAsync(id)) return NotFound();
        await _audit.LogAsync("Delete", "Wages", "Advance", id, advance?.Worker?.Name ?? $"Advance #{id}", new() {
            new("Amount", advance?.Amount.ToString("F2"), null),
        });
        return NoContent();
    }

    [HttpGet("advances/balance/{workerId}")]
    public async Task<IActionResult> GetAdvanceBalance(int workerId)
    {
        var result = await _svc.GetAdvanceBalanceAsync(workerId);
        if (result == null) return NotFound(new { message = "Worker not found." });
        return Ok(result);
    }
}
