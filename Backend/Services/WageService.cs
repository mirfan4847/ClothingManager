using Microsoft.EntityFrameworkCore;
using ClothingManager.Data;
using ClothingManager.DTOs;
using ClothingManager.Models;

namespace ClothingManager.Services;

public class WageService
{
    private readonly AppDbContext _db;
    public WageService(AppDbContext db) => _db = db;

    // ── Wage Rates ──────────────────────────────────────────────────────────

    public async Task<List<WageRateDto>> GetRatesAsync(int? workerId = null)
    {
        var q = _db.WageRates.AsNoTracking().AsQueryable();
        if (workerId.HasValue) q = q.Where(r => r.WorkerId == workerId.Value);
        return await q.OrderBy(r => r.WorkerId).ThenBy(r => r.TaskType)
            .Select(r => new WageRateDto
            {
                Id           = r.Id,
                WorkerId     = r.WorkerId,
                WorkerName   = r.Worker.Name,
                TaskType     = r.TaskType,
                RatePerPiece = r.RatePerPiece,
                IsActive     = r.IsActive,
                UpdatedAt    = r.UpdatedAt,
            }).ToListAsync();
    }

    public async Task<WageRateDto> UpsertRateAsync(WageRateCreateDto dto)
    {
        var existing = await _db.WageRates
            .FirstOrDefaultAsync(r => r.WorkerId == dto.WorkerId && r.TaskType == dto.TaskType);

        if (existing != null)
        {
            existing.RatePerPiece = dto.RatePerPiece;
            existing.IsActive     = true;
            existing.UpdatedAt    = DateTime.UtcNow;
        }
        else
        {
            existing = new WageRate
            {
                WorkerId     = dto.WorkerId,
                TaskType     = dto.TaskType,
                RatePerPiece = dto.RatePerPiece,
            };
            _db.WageRates.Add(existing);
        }
        await _db.SaveChangesAsync();

        var worker = await _db.Workers.FindAsync(existing.WorkerId);
        return new WageRateDto
        {
            Id           = existing.Id,
            WorkerId     = existing.WorkerId,
            WorkerName   = worker?.Name ?? "",
            TaskType     = existing.TaskType,
            RatePerPiece = existing.RatePerPiece,
            IsActive     = existing.IsActive,
            UpdatedAt    = existing.UpdatedAt,
        };
    }

    public async Task<bool> DeleteRateAsync(int id)
    {
        var r = await _db.WageRates.FindAsync(id);
        if (r == null) return false;
        _db.WageRates.Remove(r);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Wage Calculation ────────────────────────────────────────────────────

    public async Task<WageCalculationResultDto?> CalculateAsync(int workerId, DateTime from, DateTime to)
    {
        var worker = await _db.Workers.AsNoTracking().FirstOrDefaultAsync(w => w.Id == workerId);
        if (worker == null) return null;

        var rates = await _db.WageRates
            .AsNoTracking()
            .Where(r => r.WorkerId == workerId && r.IsActive)
            .ToListAsync();

        var entries = await _db.WorkerEntries
            .AsNoTracking()
            .Where(e => e.WorkerId == workerId
                     && e.CreatedAt >= from
                     && e.CreatedAt <= to)
            .ToListAsync();

        return BuildCalculation(worker, rates, entries, from, to);
    }

    private static readonly Dictionary<string, Func<WorkerEntry, int?>> TaskColumns = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Front"]      = e => e.Front,
        ["Bazo"]       = e => e.Bazo,
        ["Tape"]       = e => e.Tape,
        ["Pocket"]     = e => e.Pocket,
        ["Gala"]       = e => e.Gala,
        ["Lable"]      = e => e.Lable,
        ["Moda"]       = e => e.Moda,
        ["Quantity"]   = e => e.Quantity,
        ["TotalPiece"] = e => e.TotalPiece,
    };

    private static WageCalculationResultDto BuildCalculation(
        Worker worker, List<WageRate> rates, List<WorkerEntry> entries, DateTime from, DateTime to)
    {
        var breakdown = new List<WageBreakdownItemDto>();
        decimal gross = 0;

        foreach (var rate in rates)
        {
            Func<WorkerEntry, int?> getter = TaskColumns.TryGetValue(rate.TaskType, out var colGetter)
                ? colGetter
                : (e => e.TotalPiece ?? e.Quantity);
            int totalPieces = entries.Sum(e => getter(e) ?? 0);
            if (totalPieces == 0) continue;

            decimal amount = totalPieces * rate.RatePerPiece;
            gross += amount;
            breakdown.Add(new WageBreakdownItemDto
            {
                TaskType     = rate.TaskType,
                TotalPieces  = totalPieces,
                RatePerPiece = rate.RatePerPiece,
                Amount       = amount,
            });
        }

        return new WageCalculationResultDto
        {
            WorkerId    = worker.Id,
            WorkerName  = worker.Name,
            WorkerPhone = worker.Phone,
            PeriodFrom  = from,
            PeriodTo    = to,
            GrossAmount = gross,
            Breakdown   = breakdown,
        };
    }

    // ── Wage Payments ───────────────────────────────────────────────────────

    public async Task<WageSummaryDto> GetSummaryAsync()
    {
        var payStats = await _db.WagePayments
            .AsNoTracking()
            .GroupBy(_ => 1)
            .Select(g => new
            {
                TotalPaid       = g.Sum(p => p.GrossAmount),
                TotalDeductions = g.Sum(p => p.Deductions),
                TotalNet        = g.Sum(p => p.NetAmount),
                TotalPayments   = g.Count(),
            })
            .FirstOrDefaultAsync();

        var totalOutstandingAdvances = await _db.WorkerAdvances
            .AsNoTracking()
            .Where(a => !a.IsSettled)
            .SumAsync(a => (decimal?)a.Amount) ?? 0m;

        var recentPayments = await _db.WagePayments
            .AsNoTracking()
            .Include(p => p.Worker)
            .OrderByDescending(p => p.PaidAt)
            .Take(10)
            .ToListAsync();

        return new WageSummaryDto
        {
            TotalPaid                = payStats?.TotalPaid ?? 0m,
            TotalDeductions          = payStats?.TotalDeductions ?? 0m,
            TotalNet                 = payStats?.TotalNet ?? 0m,
            TotalPayments            = payStats?.TotalPayments ?? 0,
            TotalOutstandingAdvances = totalOutstandingAdvances,
            RecentPayments           = recentPayments.Select(MapPayment).ToList(),
        };
    }

    public async Task<List<WagePaymentDto>> GetPaymentsAsync(int? workerId, DateTime? from, DateTime? to)
    {
        var q = _db.WagePayments.AsNoTracking().Include(p => p.Worker).AsQueryable();
        if (workerId.HasValue) q = q.Where(p => p.WorkerId == workerId.Value);
        if (from.HasValue)     q = q.Where(p => p.PaidAt >= from.Value);
        if (to.HasValue)       q = q.Where(p => p.PaidAt <= to.Value);
        return (await q.OrderByDescending(p => p.PaidAt).ToListAsync()).Select(MapPayment).ToList();
    }

    public async Task<WagePaymentDto> CreatePaymentAsync(WagePaymentCreateDto dto)
    {
        var payment = new WagePayment
        {
            WorkerId    = dto.WorkerId,
            GrossAmount = dto.GrossAmount,
            Deductions  = dto.Deductions,
            NetAmount   = dto.NetAmount,
            Notes       = dto.Notes,
            PeriodFrom  = dto.PeriodFrom,
            PeriodTo    = dto.PeriodTo,
            PaidAt      = dto.PaidAt,
        };
        _db.WagePayments.Add(payment);
        await _db.SaveChangesAsync();
        await _db.Entry(payment).Reference(p => p.Worker).LoadAsync();
        return MapPayment(payment);
    }

    public async Task<bool> DeletePaymentAsync(int id)
    {
        var p = await _db.WagePayments.FindAsync(id);
        if (p == null) return false;
        _db.WagePayments.Remove(p);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Bulk calculation (all workers — 3 batched queries instead of 3N+1) ──

    public async Task<AllWorkersWageDto> CalculateAllAsync(DateTime from, DateTime to)
    {
        var workers = await _db.Workers.AsNoTracking().Where(w => w.IsActive).ToListAsync();
        var workerIds = workers.Select(w => w.Id).ToList();

        var allRates = await _db.WageRates
            .AsNoTracking()
            .Where(r => workerIds.Contains(r.WorkerId) && r.IsActive)
            .ToListAsync();

        var allEntries = await _db.WorkerEntries
            .AsNoTracking()
            .Where(e => workerIds.Contains(e.WorkerId) && e.CreatedAt >= from && e.CreatedAt <= to)
            .ToListAsync();

        var ratesByWorker   = allRates.GroupBy(r => r.WorkerId).ToDictionary(g => g.Key, g => g.ToList());
        var entriesByWorker = allEntries.GroupBy(e => e.WorkerId).ToDictionary(g => g.Key, g => g.ToList());

        var results = new List<WageCalculationResultDto>();
        foreach (var w in workers)
        {
            if (!ratesByWorker.TryGetValue(w.Id, out var wRates) || wRates.Count == 0) continue;
            if (!entriesByWorker.TryGetValue(w.Id, out var wEntries) || wEntries.Count == 0) continue;

            var result = BuildCalculation(w, wRates, wEntries, from, to);
            if (result.GrossAmount > 0)
                results.Add(result);
        }

        return new AllWorkersWageDto
        {
            PeriodFrom  = from,
            PeriodTo    = to,
            TotalGross  = results.Sum(r => r.GrossAmount),
            WorkerCount = results.Count,
            Workers     = results.OrderByDescending(r => r.GrossAmount).ToList(),
        };
    }

    // ── Worker Advances ─────────────────────────────────────────────────────

    public async Task<List<WorkerAdvanceDto>> GetAdvancesAsync(int? workerId, bool unsettledOnly = false)
    {
        var q = _db.WorkerAdvances.AsNoTracking().Include(a => a.Worker).AsQueryable();
        if (workerId.HasValue) q = q.Where(a => a.WorkerId == workerId.Value);
        if (unsettledOnly)     q = q.Where(a => !a.IsSettled);
        return (await q.OrderByDescending(a => a.AdvanceDate).ToListAsync())
            .Select(MapAdvance)
            .ToList();
    }

    public async Task<WorkerAdvanceDto> CreateAdvanceAsync(WorkerAdvanceCreateDto dto)
    {
        var advance = new WorkerAdvance
        {
            WorkerId    = dto.WorkerId,
            Amount      = dto.Amount,
            Notes       = dto.Notes,
            AdvanceDate = dto.AdvanceDate,
        };
        _db.WorkerAdvances.Add(advance);
        await _db.SaveChangesAsync();
        await _db.Entry(advance).Reference(a => a.Worker).LoadAsync();
        return MapAdvance(advance);
    }

    public async Task<bool> SettleAdvanceAsync(int id)
    {
        var a = await _db.WorkerAdvances.FindAsync(id);
        if (a == null || a.IsSettled) return false;
        a.IsSettled = true;
        a.SettledAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAdvanceAsync(int id)
    {
        var a = await _db.WorkerAdvances.FindAsync(id);
        if (a == null) return false;
        _db.WorkerAdvances.Remove(a);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<WorkerAdvanceBalanceDto?> GetAdvanceBalanceAsync(int workerId)
    {
        var worker = await _db.Workers.FindAsync(workerId);
        if (worker == null) return null;

        var advances   = await _db.WorkerAdvances.Where(a => a.WorkerId == workerId).ToListAsync();
        var unsettled  = advances.Where(a => !a.IsSettled).ToList();

        return new WorkerAdvanceBalanceDto
        {
            WorkerId          = workerId,
            WorkerName        = worker.Name,
            TotalAdvanced     = advances.Sum(a => a.Amount),
            PendingBalance    = unsettled.Sum(a => a.Amount),
            UnsettledAdvances = unsettled.Select(MapAdvance).ToList(),
        };
    }

    private static WorkerAdvanceDto MapAdvance(WorkerAdvance a) => new()
    {
        Id          = a.Id,
        WorkerId    = a.WorkerId,
        WorkerName  = a.Worker?.Name ?? "",
        WorkerPhone = a.Worker?.Phone ?? "",
        Amount      = a.Amount,
        Notes       = a.Notes,
        AdvanceDate = a.AdvanceDate,
        IsSettled   = a.IsSettled,
        SettledAt   = a.SettledAt,
        CreatedAt   = a.CreatedAt,
    };

    // ── Helper ──────────────────────────────────────────────────────────────

    private static WagePaymentDto MapPayment(WagePayment p) => new()
    {
        Id          = p.Id,
        WorkerId    = p.WorkerId,
        WorkerName  = p.Worker?.Name ?? "",
        WorkerPhone = p.Worker?.Phone ?? "",
        GrossAmount = p.GrossAmount,
        Deductions  = p.Deductions,
        NetAmount   = p.NetAmount,
        Notes       = p.Notes,
        PeriodFrom  = p.PeriodFrom,
        PeriodTo    = p.PeriodTo,
        PaidAt      = p.PaidAt,
        CreatedAt   = p.CreatedAt,
    };
}
