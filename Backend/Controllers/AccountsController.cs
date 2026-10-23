using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClothingManager.Authorization;
using ClothingManager.Data;
using ClothingManager.DTOs;
using ClothingManager.Services;

namespace ClothingManager.Controllers;

/// <summary>Accounts - manage accounts and transactions</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[RequirePermission("canViewAccounts")]
[Produces("application/json")]
public class AccountsController : ControllerBase
{
    private readonly AccountsService _svc;
    public AccountsController(AccountsService svc) => _svc = svc;

    /// <summary>Get account summary (totals)</summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(AccountSummaryDto), 200)]
    public async Task<IActionResult> Summary()
        => Ok(await _svc.GetSummaryAsync());

    /// <summary>Get all account categories</summary>
    [HttpGet("categories")]
    [ProducesResponseType(typeof(List<AccountCategoryDto>), 200)]
    public async Task<IActionResult> GetCategories()
        => Ok(await _svc.GetCategoriesAsync());

    /// <summary>Get all accounts</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<AccountDto>), 200)]
    public async Task<IActionResult> GetAll()
        => Ok(await _svc.GetAccountsAsync());

    /// <summary>Get a single account</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(AccountDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetOne(int id)
    {
        var result = await _svc.GetAccountByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    /// <summary>Create a new account</summary>
    [HttpPost]
    [RequirePermission("canManageAccounts")]
    [ProducesResponseType(typeof(AccountDto), 201)]
    public async Task<IActionResult> Create([FromBody] AccountCreateDto dto)
    {
        var created = await _svc.CreateAccountAsync(dto);
        return CreatedAtAction(nameof(GetOne), new { id = created.Id }, created);
    }

    /// <summary>Update an account</summary>
    [HttpPut("{id}")]
    [RequirePermission("canManageAccounts")]
    [ProducesResponseType(typeof(AccountDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Update(int id, [FromBody] AccountCreateDto dto)
    {
        var result = await _svc.UpdateAccountAsync(id, dto);
        return result == null ? NotFound() : Ok(result);
    }

    /// <summary>Toggle account active/inactive</summary>
    [HttpPatch("{id}/toggle-status")]
    [RequirePermission("canManageAccounts")]
    [ProducesResponseType(200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> ToggleStatus(int id)
        => await _svc.ToggleAccountStatusAsync(id) ? Ok() : NotFound();
}

/// <summary>Transactions - credit and debit entries</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[RequirePermission("canViewAccounts")]
[Produces("application/json")]
public class TransactionsController : ControllerBase
{
    private readonly AccountsService _svc;
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    public TransactionsController(AccountsService svc, AppDbContext db, AuditService audit)
    { _svc = svc; _db = db; _audit = audit; }

    /// <summary>Get transactions with optional filters</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<TransactionDto>), 200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? accountId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
        => Ok(await _svc.GetTransactionsAsync(accountId, from, to));

    /// <summary>Add a new transaction (credit or debit)</summary>
    [HttpPost]
    [RequirePermission("canAddTransaction")]
    [ProducesResponseType(typeof(TransactionDto), 201)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Create([FromBody] TransactionCreateDto dto)
    {
        var result = await _svc.AddTransactionAsync(dto);
        if (result == null) return NotFound(new { message = "Account not found" });
        var account = await _db.Accounts.FindAsync(dto.AccountId);
        await _audit.LogAsync("Create", "Finance", "Transaction", result.Id,
            account?.Name ?? $"Account #{dto.AccountId}", new() {
                new("Type",        null, dto.Type),
                new("Amount",      null, dto.Amount.ToString("F2")),
                new("Description", null, dto.Description),
            });
        return CreatedAtAction(nameof(GetAll), result);
    }

    /// <summary>Delete a transaction and reverse its effect on balance</summary>
    [HttpDelete("{id}")]
    [RequirePermission("canDeleteTransaction")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Delete(int id)
    {
        var tx = await _db.Transactions.Include(t => t.Account).FirstOrDefaultAsync(t => t.Id == id);
        if (!await _svc.DeleteTransactionAsync(id)) return NotFound();
        await _audit.LogAsync("Delete", "Finance", "Transaction", id,
            tx?.Account?.Name ?? $"Transaction #{id}", new List<FieldChange> {
                new("Type",        tx?.Type, null),
                new("Amount",      tx?.Amount.ToString("F2"), null),
                new("Description", tx?.Description, null),
            });
        return NoContent();
    }
}
