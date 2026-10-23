using System.Security.Claims;
using System.Text.Json;
using ClothingManager.Data;
using ClothingManager.Models;

namespace ClothingManager.Services;

public record FieldChange(string Field, string? OldValue, string? NewValue);

public class AuditService
{
    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _http;

    public AuditService(AppDbContext db, IHttpContextAccessor http)
    {
        _db   = db;
        _http = http;
    }

    private (int? userId, string userName) GetCurrentUser()
    {
        var claims   = _http.HttpContext?.User;
        var userName = claims?.FindFirst("fullName")?.Value
                    ?? claims?.FindFirst(ClaimTypes.Name)?.Value
                    ?? "System";
        int? userId  = null;
        if (int.TryParse(claims?.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid))
            userId = uid;
        return (userId, userName);
    }

    public async Task LogAsync(
        string action, string module, string entityType,
        int? entityId, string? entityName,
        List<FieldChange>? changes = null)
    {
        try
        {
            var (userId, userName) = GetCurrentUser();
            _db.AuditLogs.Add(new AuditLog
            {
                UserId        = userId,
                UserName      = userName,
                Action        = action,
                Module        = module,
                EntityType    = entityType,
                EntityId      = entityId,
                EntityName    = entityName,
                ChangeSummary = changes?.Count > 0
                    ? JsonSerializer.Serialize(changes)
                    : null,
                Timestamp = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }
        catch
        {
            // Audit logging must never break the main operation
        }
    }
}
