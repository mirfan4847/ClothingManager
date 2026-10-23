using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClothingManager.Data;

namespace ClothingManager.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ReportsController(AppDbContext db) => _db = db;

    private static (DateTime From, DateTime To) ParseRange(DateTime? from, DateTime? to)
    {
        var f = (from ?? new DateTime(DateTime.UtcNow.Year, 1, 1)).Date;
        var t = (to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1);
        return (f, t);
    }

    // ── Finance Summary (KPIs) ─────────────────────────────────────────────────
    [HttpGet("finance/summary")]
    public async Task<IActionResult> FinanceSummary(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var (f, t) = ParseRange(from, to);

        var sales = await _db.Sales
            .Include(s => s.Payments)
            .Where(s => s.SaleDate >= f && s.SaleDate <= t)
            .ToListAsync();

        var collected = await _db.SalePayments
            .Where(p => p.PaymentDate >= f && p.PaymentDate <= t)
            .SumAsync(p => (decimal?)p.Amount) ?? 0;

        var allSales = await _db.Sales.Include(s => s.Payments).ToListAsync();
        var outstanding = allSales.Sum(s => s.NetAmount - s.Payments.Sum(p => p.Amount));

        var purchases = await _db.BagPurchases
            .Where(p => p.PurchaseDate >= f && p.PurchaseDate <= t)
            .ToListAsync();
        var totalPurchases = purchases.Sum(p => p.Quantity * (p.UnitPrice ?? 0));

        var wages = await _db.WagePayments
            .Where(w => w.PaidAt >= f && w.PaidAt <= t)
            .SumAsync(w => (decimal?)w.NetAmount) ?? 0;

        var accountBalance = await _db.Accounts
            .Where(a => a.IsActive)
            .SumAsync(a => (decimal?)a.Balance) ?? 0;

        return Ok(new
        {
            TotalRevenue          = sales.Sum(s => s.NetAmount),
            TotalCollected        = collected,
            TotalOutstanding      = outstanding > 0 ? outstanding : 0m,
            TotalPurchaseExpenses = totalPurchases,
            TotalWagesExpenses    = wages,
            NetCashFlow           = collected - totalPurchases - wages,
            TotalAccountBalance   = accountBalance,
            SalesCount            = sales.Count,
            PaidCount             = sales.Count(s => s.Status == "Paid"),
            PartialCount          = sales.Count(s => s.Status == "Partial"),
            PendingCount          = sales.Count(s => s.Status == "Pending"),
        });
    }

    // ── Sales by Customer ──────────────────────────────────────────────────────
    [HttpGet("finance/sales-by-customer")]
    public async Task<IActionResult> SalesByCustomer(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var (f, t) = ParseRange(from, to);

        var sales = await _db.Sales
            .Include(s => s.Customer)
            .Include(s => s.Payments)
            .Where(s => s.SaleDate >= f && s.SaleDate <= t)
            .ToListAsync();

        var result = sales
            .GroupBy(s => new { s.CustomerId, Name = s.Customer?.Name ?? "Unknown" })
            .Select(g => new
            {
                CustomerId       = g.Key.CustomerId,
                CustomerName     = g.Key.Name,
                SalesCount       = g.Count(),
                TotalRevenue     = g.Sum(s => s.NetAmount),
                TotalCollected   = g.Sum(s => s.Payments.Sum(p => p.Amount)),
                TotalOutstanding = g.Sum(s => s.NetAmount - s.Payments.Sum(p => p.Amount)),
                PendingCount     = g.Count(s => s.Status == "Pending"),
                PartialCount     = g.Count(s => s.Status == "Partial"),
                PaidCount        = g.Count(s => s.Status == "Paid"),
            })
            .OrderByDescending(r => r.TotalRevenue)
            .ToList();

        return Ok(result);
    }

    // ── Monthly Cash Flow ──────────────────────────────────────────────────────
    [HttpGet("finance/monthly")]
    public async Task<IActionResult> MonthlyTrends(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var (f, t) = ParseRange(from, to);

        var payments  = await _db.SalePayments
            .Where(p => p.PaymentDate >= f && p.PaymentDate <= t).ToListAsync();
        var purchases = await _db.BagPurchases
            .Where(p => p.PurchaseDate >= f && p.PurchaseDate <= t).ToListAsync();
        var wages     = await _db.WagePayments
            .Where(w => w.PaidAt >= f && w.PaidAt <= t).ToListAsync();
        var sales     = await _db.Sales
            .Where(s => s.SaleDate >= f && s.SaleDate <= t).ToListAsync();

        var months = new List<(int Year, int Month)>();
        var cur = new DateTime(f.Year, f.Month, 1);
        var end = new DateTime(t.Year, t.Month, 1);
        while (cur <= end) { months.Add((cur.Year, cur.Month)); cur = cur.AddMonths(1); }

        var result = months.Select(m =>
        {
            var rev  = sales.Where(s => s.SaleDate.Year == m.Year && s.SaleDate.Month == m.Month).Sum(s => s.NetAmount);
            var coll = payments.Where(p => p.PaymentDate.Year == m.Year && p.PaymentDate.Month == m.Month).Sum(p => p.Amount);
            var pur  = purchases.Where(p => p.PurchaseDate.Year == m.Year && p.PurchaseDate.Month == m.Month).Sum(p => p.Quantity * (p.UnitPrice ?? 0));
            var wg   = wages.Where(w => w.PaidAt.Year == m.Year && w.PaidAt.Month == m.Month).Sum(w => w.NetAmount);
            return new
            {
                m.Year, m.Month,
                MonthName        = new DateTime(m.Year, m.Month, 1).ToString("MMM yyyy"),
                Revenue          = rev,
                Collected        = coll,
                PurchaseExpenses = pur,
                WageExpenses     = wg,
                TotalExpenses    = pur + wg,
                NetCashFlow      = coll - pur - wg,
            };
        }).ToList();

        return Ok(result);
    }

    // ── Payment Methods ────────────────────────────────────────────────────────
    [HttpGet("finance/payment-methods")]
    public async Task<IActionResult> PaymentMethods(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var (f, t) = ParseRange(from, to);

        var result = await _db.SalePayments
            .Where(p => p.PaymentDate >= f && p.PaymentDate <= t)
            .GroupBy(p => p.PaymentMethod)
            .Select(g => new { Method = g.Key, Count = g.Count(), Amount = g.Sum(p => p.Amount) })
            .OrderByDescending(g => g.Amount)
            .ToListAsync();

        return Ok(result);
    }

    // ── Account Ledger ─────────────────────────────────────────────────────────
    [HttpGet("finance/account-statement")]
    public async Task<IActionResult> AccountStatement(
        [FromQuery] int accountId,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var account = await _db.Accounts
            .Include(a => a.Category)
            .FirstOrDefaultAsync(a => a.Id == accountId);
        if (account == null) return NotFound();

        var f = from?.Date ?? DateTime.MinValue;
        var t = (to?.Date ?? DateTime.UtcNow.Date).AddDays(1).AddTicks(-1);

        var txns = await _db.Transactions
            .Where(tx => tx.AccountId == accountId && tx.Date >= f && tx.Date <= t)
            .OrderBy(tx => tx.Date).ThenBy(tx => tx.Id)
            .ToListAsync();

        var prevTxns = await _db.Transactions
            .Where(tx => tx.AccountId == accountId && tx.Date < f)
            .ToListAsync();
        var openingBalance = prevTxns.Sum(tx => tx.Type == "Credit" ? tx.Amount : -tx.Amount);

        var running = openingBalance;
        var lines = txns.Select(tx =>
        {
            running += tx.Type == "Credit" ? tx.Amount : -tx.Amount;
            return new
            {
                tx.Id, tx.Date, tx.Type, tx.Amount, tx.Description, tx.ReferenceNo,
                RunningBalance = running,
            };
        }).ToList();

        return Ok(new
        {
            AccountId      = account.Id,
            AccountName    = account.Name,
            CategoryName   = account.Category?.Name ?? "",
            OpeningBalance = openingBalance,
            ClosingBalance = running,
            Lines          = lines,
        });
    }

    // ── Payroll Report ─────────────────────────────────────────────────────────
    [HttpGet("payroll")]
    public async Task<IActionResult> PayrollReport(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var (f, t) = ParseRange(from, to);

        var payments = await _db.WagePayments
            .Include(w => w.Worker)
            .Where(w => w.PaidAt >= f && w.PaidAt <= t)
            .OrderByDescending(w => w.PaidAt)
            .ToListAsync();

        var advances = await _db.WorkerAdvances
            .Include(a => a.Worker)
            .Where(a => a.AdvanceDate >= f && a.AdvanceDate <= t)
            .ToListAsync();

        var workerIds = payments.Select(p => p.WorkerId)
            .Union(advances.Select(a => a.WorkerId)).Distinct();

        var byWorker = workerIds.Select(wid =>
        {
            var wPays = payments.Where(p => p.WorkerId == wid).ToList();
            var wAdvs = advances.Where(a => a.WorkerId == wid).ToList();
            var worker = wPays.FirstOrDefault()?.Worker ?? wAdvs.FirstOrDefault()?.Worker;
            return new
            {
                WorkerId          = wid,
                WorkerName        = worker?.Name ?? "Unknown",
                WorkerType        = worker?.PersonType ?? "Worker",
                PaymentsCount     = wPays.Count,
                TotalGross        = wPays.Sum(p => p.GrossAmount),
                TotalDeductions   = wPays.Sum(p => p.Deductions),
                TotalNet          = wPays.Sum(p => p.NetAmount),
                TotalAdvances     = wAdvs.Sum(a => a.Amount),
                UnsettledAdvances = wAdvs.Where(a => !a.IsSettled).Sum(a => a.Amount),
                Payments          = wPays.Select(p => new {
                    p.Id, p.GrossAmount, p.Deductions, p.NetAmount,
                    p.PeriodFrom, p.PeriodTo, p.PaidAt, p.Notes,
                }).ToList(),
                Advances = wAdvs.Select(a => new {
                    a.Id, a.Amount, a.AdvanceDate, a.IsSettled, a.Notes,
                }).ToList(),
            };
        }).OrderByDescending(w => w.TotalNet).ToList();

        // Monthly breakdown
        var months = new List<(int Year, int Month)>();
        var cur = new DateTime(f.Year, f.Month, 1);
        var end = new DateTime(t.Year, t.Month, 1);
        while (cur <= end) { months.Add((cur.Year, cur.Month)); cur = cur.AddMonths(1); }

        var monthly = months.Select(m =>
        {
            var mp = payments.Where(p => p.PaidAt.Year == m.Year && p.PaidAt.Month == m.Month).ToList();
            var ma = advances.Where(a => a.AdvanceDate.Year == m.Year && a.AdvanceDate.Month == m.Month).ToList();
            return new
            {
                m.Year, m.Month,
                MonthName   = new DateTime(m.Year, m.Month, 1).ToString("MMM yyyy"),
                Gross       = mp.Sum(p => p.GrossAmount),
                Deductions  = mp.Sum(p => p.Deductions),
                Net         = mp.Sum(p => p.NetAmount),
                Advances    = ma.Sum(a => a.Amount),
                WorkerCount = mp.Select(p => p.WorkerId).Distinct().Count(),
            };
        }).ToList();

        return Ok(new
        {
            TotalGross             = payments.Sum(p => p.GrossAmount),
            TotalDeductions        = payments.Sum(p => p.Deductions),
            TotalNet               = payments.Sum(p => p.NetAmount),
            TotalAdvances          = advances.Sum(a => a.Amount),
            TotalUnsettledAdvances = advances.Where(a => !a.IsSettled).Sum(a => a.Amount),
            WorkerCount            = byWorker.Count,
            PaymentsCount          = payments.Count,
            ByWorker               = byWorker,
            MonthlyBreakdown       = monthly,
        });
    }

    // ── Expense Summary ────────────────────────────────────────────────────────
    [HttpGet("finance/expenses")]
    public async Task<IActionResult> ExpenseSummary(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var (f, t) = ParseRange(from, to);

        var purchases = await _db.BagPurchases
            .Where(p => p.PurchaseDate >= f && p.PurchaseDate <= t)
            .ToListAsync();

        var wages = await _db.WagePayments
            .Include(w => w.Worker)
            .Where(w => w.PaidAt >= f && w.PaidAt <= t)
            .OrderByDescending(w => w.PaidAt)
            .ToListAsync();

        var totalPurchases = purchases.Sum(p => p.Quantity * (p.UnitPrice ?? 0));
        var totalWages     = wages.Sum(w => w.NetAmount);

        var byMaterial = purchases
            .GroupBy(p => p.Material)
            .Select(g => new
            {
                Material    = g.Key,
                TotalBags   = g.Sum(p => p.Quantity),
                TotalAmount = g.Sum(p => p.Quantity * (p.UnitPrice ?? 0)),
                Records     = g.Count(),
            })
            .OrderByDescending(m => m.TotalAmount)
            .ToList();

        return Ok(new
        {
            TotalPurchases = totalPurchases,
            TotalWages     = totalWages,
            GrandTotal     = totalPurchases + totalWages,
            ByMaterial     = byMaterial,
            WagePayments   = wages.Select(w => new
            {
                w.Id,
                WorkerName = w.Worker?.Name ?? "Unknown",
                w.GrossAmount, w.Deductions, w.NetAmount,
                w.PeriodFrom, w.PeriodTo, w.PaidAt,
            }).ToList(),
        });
    }
}
