using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClothingManager.Data;

namespace ClothingManager.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class AuditLogsController : ControllerBase
{
    private readonly AppDbContext _db;
    public AuditLogsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? module,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] string? search,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page     = 1,
        [FromQuery] int pageSize = 50)
    {
        var q = _db.AuditLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(module))     q = q.Where(l => l.Module == module);
        if (!string.IsNullOrWhiteSpace(action))     q = q.Where(l => l.Action == action);
        if (!string.IsNullOrWhiteSpace(entityType)) q = q.Where(l => l.EntityType == entityType);
        if (from.HasValue) q = q.Where(l => l.Timestamp >= from.Value);
        if (to.HasValue)   q = q.Where(l => l.Timestamp <= to.Value.AddDays(1));
        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(l => l.UserName.Contains(search)
                           || (l.EntityName != null && l.EntityName.Contains(search))
                           || l.EntityType.Contains(search)
                           || l.Module.Contains(search));

        var total = await q.CountAsync();
        var items = await q
            .OrderByDescending(l => l.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new {
                l.Id, l.UserId, l.UserName, l.Action, l.Module,
                l.EntityType, l.EntityId, l.EntityName,
                l.ChangeSummary, l.Timestamp
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, items });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var q = _db.AuditLogs.AsQueryable();
        if (from.HasValue) q = q.Where(l => l.Timestamp >= from.Value);
        if (to.HasValue)   q = q.Where(l => l.Timestamp <= to.Value.AddDays(1));

        var all = await q.GroupBy(l => l.Action)
            .Select(g => new { Action = g.Key, Count = g.Count() })
            .ToListAsync();

        var byModule = await q.GroupBy(l => l.Module)
            .Select(g => new { Module = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .ToListAsync();

        return Ok(new { byAction = all, byModule });
    }

    [HttpGet("modules")]
    public async Task<IActionResult> GetModules()
        => Ok(await _db.AuditLogs.Select(l => l.Module).Distinct().OrderBy(m => m).ToListAsync());
}
