using Microsoft.EntityFrameworkCore;
using ClothingManager.Data;
using ClothingManager.DTOs;
using ClothingManager.Models;

namespace ClothingManager.Services;

public class AccountsService
{
    private readonly AppDbContext _db;
    public AccountsService(AppDbContext db) => _db = db;

    // ── Categories ──────────────────────────────
    public async Task<List<AccountCategoryDto>> GetCategoriesAsync()
        => await _db.AccountCategories
            .Select(c => new AccountCategoryDto { Id = c.Id, Name = c.Name, Type = c.Type })
            .ToListAsync();

    // ── Accounts ────────────────────────────────
    public async Task<List<AccountDto>> GetAccountsAsync()
        => await _db.Accounts
            .Include(a => a.Category)
            .Select(a => new AccountDto
            {
                Id = a.Id, Name = a.Name, CategoryId = a.CategoryId,
                CategoryName = a.Category.Name, CategoryType = a.Category.Type,
                Balance = a.Balance, Description = a.Description,
                IsActive = a.IsActive, CreatedAt = a.CreatedAt
            }).ToListAsync();

    public async Task<AccountDto?> GetAccountByIdAsync(int id)
    {
        var a = await _db.Accounts.Include(a => a.Category).FirstOrDefaultAsync(a => a.Id == id);
        if (a == null) return null;
        return new AccountDto
        {
            Id = a.Id, Name = a.Name, CategoryId = a.CategoryId,
            CategoryName = a.Category.Name, CategoryType = a.Category.Type,
            Balance = a.Balance, Description = a.Description,
            IsActive = a.IsActive, CreatedAt = a.CreatedAt
        };
    }

    public async Task<AccountDto> CreateAccountAsync(AccountCreateDto dto)
    {
        var account = new Account
        {
            Name = dto.Name, CategoryId = dto.CategoryId,
            Balance = dto.OpeningBalance, Description = dto.Description
        };
        _db.Accounts.Add(account);
        await _db.SaveChangesAsync();

        // Record opening balance as first transaction if > 0
        if (dto.OpeningBalance > 0)
        {
            var cat = await _db.AccountCategories.FindAsync(dto.CategoryId);
            _db.Transactions.Add(new Transaction
            {
                AccountId   = account.Id,
                Type        = cat?.Type ?? "Debit",
                Amount      = dto.OpeningBalance,
                Description = "Opening Balance",
                Date        = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }

        return (await GetAccountByIdAsync(account.Id))!;
    }

    public async Task<AccountDto?> UpdateAccountAsync(int id, AccountCreateDto dto)
    {
        var account = await _db.Accounts.FindAsync(id);
        if (account == null) return null;
        account.Name = dto.Name; account.CategoryId = dto.CategoryId;
        account.Description = dto.Description;
        await _db.SaveChangesAsync();
        return await GetAccountByIdAsync(id);
    }

    public async Task<bool> ToggleAccountStatusAsync(int id)
    {
        var account = await _db.Accounts.FindAsync(id);
        if (account == null) return false;
        account.IsActive = !account.IsActive;
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Transactions ─────────────────────────────
    public async Task<List<TransactionDto>> GetTransactionsAsync(int? accountId, DateTime? from, DateTime? to)
    {
        var query = _db.Transactions.Include(t => t.Account).AsQueryable();

        if (accountId.HasValue) query = query.Where(t => t.AccountId == accountId);
        if (from.HasValue)      query = query.Where(t => t.Date >= from);
        if (to.HasValue)        query = query.Where(t => t.Date <= to);

        var list = await query.OrderBy(t => t.Date).ToListAsync();

        // Calculate running balance per account
        decimal running = 0;
        return list.Select(t =>
        {
            running += t.Type == "Credit" ? t.Amount : -t.Amount;
            return new TransactionDto
            {
                Id = t.Id, AccountId = t.AccountId, AccountName = t.Account?.Name ?? "",
                Type = t.Type, Amount = t.Amount, Description = t.Description,
                ReferenceNo = t.ReferenceNo, Date = t.Date, RunningBalance = running
            };
        }).ToList();
    }

    public async Task<TransactionDto?> AddTransactionAsync(TransactionCreateDto dto)
    {
        var account = await _db.Accounts.FindAsync(dto.AccountId);
        if (account == null) return null;

        var tx = new Transaction
        {
            AccountId   = dto.AccountId, Type = dto.Type, Amount = dto.Amount,
            Description = dto.Description, ReferenceNo = dto.ReferenceNo, Date = dto.Date
        };
        _db.Transactions.Add(tx);

        // Update account balance
        account.Balance += dto.Type == "Credit" ? dto.Amount : -dto.Amount;
        await _db.SaveChangesAsync();

        return new TransactionDto
        {
            Id = tx.Id, AccountId = tx.AccountId, AccountName = account.Name,
            Type = tx.Type, Amount = tx.Amount, Description = tx.Description,
            ReferenceNo = tx.ReferenceNo, Date = tx.Date, RunningBalance = account.Balance
        };
    }

    public async Task<bool> DeleteTransactionAsync(int id)
    {
        var tx = await _db.Transactions.Include(t => t.Account).FirstOrDefaultAsync(t => t.Id == id);
        if (tx == null) return false;

        // Reverse the balance effect
        if (tx.Account != null)
            tx.Account.Balance -= tx.Type == "Credit" ? tx.Amount : -tx.Amount;

        _db.Transactions.Remove(tx);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Salary account helper ────────────────────
    public async Task<Account> GetOrCreateSalaryAccountAsync()
    {
        var account = await _db.Accounts.FirstOrDefaultAsync(a => a.Name == "Salary & Wages");
        if (account != null) return account;

        // Find or create Expense category
        var expCat = await _db.AccountCategories.FirstOrDefaultAsync(c => c.Name == "Expense");
        if (expCat == null)
        {
            expCat = new AccountCategory { Name = "Expense", Type = "Debit" };
            _db.AccountCategories.Add(expCat);
            await _db.SaveChangesAsync();
        }

        account = new Account { Name = "Salary & Wages", CategoryId = expCat.Id, Balance = 0, Description = "Auto-created for payroll payments" };
        _db.Accounts.Add(account);
        await _db.SaveChangesAsync();
        return account;
    }

    // ── Summary ──────────────────────────────────
    public async Task<AccountSummaryDto> GetSummaryAsync()
    {
        // Always recalculate balances from actual transactions to avoid drift
        var accounts = await _db.Accounts.Include(a => a.Category).ToListAsync();
        var txSums = await _db.Transactions
            .GroupBy(t => t.AccountId)
            .Select(g => new {
                AccountId = g.Key,
                Balance   = g.Sum(t => t.Type == "Credit" ? t.Amount : -t.Amount)
            }).ToDictionaryAsync(x => x.AccountId, x => x.Balance);

        // Sync stored balance with real transaction sum
        bool anyChanged = false;
        foreach (var a in accounts)
        {
            var real = txSums.TryGetValue(a.Id, out var v) ? v : 0m;
            if (a.Balance != real) { a.Balance = real; anyChanged = true; }
        }
        if (anyChanged) await _db.SaveChangesAsync();

        var dtos        = accounts.Select(a => new AccountDto {
            Id = a.Id, Name = a.Name, CategoryId = a.CategoryId,
            CategoryName = a.Category.Name, CategoryType = a.Category.Type,
            Balance = a.Balance, Description = a.Description,
            IsActive = a.IsActive, CreatedAt = a.CreatedAt
        }).ToList();

        var income      = dtos.Where(a => a.CategoryName == "Income").Sum(a => a.Balance);
        var expense     = dtos.Where(a => a.CategoryName == "Expense").Sum(a => a.Balance);
        var assets      = dtos.Where(a => a.CategoryName is "Asset" or "Cash & Bank" or "Cash").Sum(a => a.Balance);
        var liabilities = dtos.Where(a => a.CategoryName == "Liability").Sum(a => a.Balance);

        // Expense accounts store negative balances (debit txns subtract from credit-centric balance),
        // so negate to get the actual amount spent as a positive number.
        // NetBalance = income + expense (expense is already negative, so this subtracts correctly).
        return new AccountSummaryDto
        {
            TotalIncome      = income,
            TotalExpense     = -expense,
            NetBalance       = income + expense,
            TotalAssets      = assets,
            TotalLiabilities = liabilities,
            Accounts         = dtos
        };
    }
}
