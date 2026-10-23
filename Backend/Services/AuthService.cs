using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ClothingManager.Data;
using ClothingManager.DTOs;
using ClothingManager.Models;

namespace ClothingManager.Services;

public class AuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<LoginResponseDto?> LoginAsync(LoginRequestDto dto)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Username == dto.Username
                                   && u.PasswordHash == dto.Password
                                   && u.IsActive);
        if (user == null) return null;

        // Load permissions for the user's role
        var permissions = await _db.RolePermissions
            .Include(rp => rp.Role)
            .Where(rp => rp.Role.Name == user.Role)
            .ToDictionaryAsync(rp => rp.Permission, rp => rp.IsGranted);

        var token = GenerateToken(user, permissions);

        return new LoginResponseDto
        {
            Token       = token,
            Name        = user.Name,
            Username    = user.Username,
            Role        = user.Role,
            Permissions = permissions
        };
    }

    public async Task<List<UserDto>> GetAllUsersAsync()
        => await _db.Users.Select(u => new UserDto
        {
            Id        = u.Id,
            Username  = u.Username,
            Name      = u.Name,
            Role      = u.Role,
            IsActive  = u.IsActive,
            CreatedAt = u.CreatedAt
        }).ToListAsync();

    public async Task<UserDto?> CreateUserAsync(CreateUserDto dto)
    {
        if (await _db.Users.AnyAsync(u => u.Username == dto.Username))
            return null; // username taken

        var user = new User
        {
            Username     = dto.Username,
            PasswordHash = dto.Password,
            Name         = dto.Name,
            Role         = dto.Role,
            IsActive     = true
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return new UserDto { Id = user.Id, Username = user.Username, Name = user.Name, Role = user.Role, IsActive = user.IsActive, CreatedAt = user.CreatedAt };
    }

    public async Task<bool> UpdateUserAsync(int id, CreateUserDto dto)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return false;

        user.Name = dto.Name;
        user.Role = dto.Role;
        if (!string.IsNullOrEmpty(dto.Password))
            user.PasswordHash = dto.Password;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ToggleUserStatusAsync(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return false;
        user.IsActive = !user.IsActive;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ChangePasswordAsync(int userId, ChangePasswordDto dto)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return false;

        if (user.PasswordHash != dto.CurrentPassword)
            return false;

        user.PasswordHash = dto.NewPassword;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<RolePermissionDto>> GetAllRolePermissionsAsync()
    {
        var roles = await _db.Roles.Include(r => r.Permissions).ToListAsync();
        return roles.Select(r => new RolePermissionDto
        {
            Role        = r.Name,
            Permissions = r.Permissions.ToDictionary(p => p.Permission, p => p.IsGranted)
        }).ToList();
    }

    public async Task<bool> UpdateRolePermissionsAsync(string roleName, Dictionary<string, bool> permissions)
    {
        var role = await _db.Roles.Include(r => r.Permissions)
                                  .FirstOrDefaultAsync(r => r.Name == roleName);
        if (role == null) return false;

        foreach (var (key, value) in permissions)
        {
            var perm = role.Permissions.FirstOrDefault(p => p.Permission == key);
            if (perm != null) perm.IsGranted = value;
            else role.Permissions.Add(new RolePermission { RoleId = role.Id, Permission = key, IsGranted = value });
        }

        await _db.SaveChangesAsync();
        return true;
    }

    private string GenerateToken(User user, Dictionary<string, bool> permissions)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "ClothingManagerSecretKey2024!!"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name,           user.Username),
            new(ClaimTypes.Role,           user.Role),
            new("fullName",                user.Name),
        };

        // Encode granted permissions as claims so backend can enforce them without DB lookups
        foreach (var (perm, granted) in permissions.Where(p => p.Value))
            claims.Add(new Claim("perm:" + perm, "true"));

        var token = new JwtSecurityToken(
            issuer:             _config["Jwt:Issuer"] ?? "ClothingManager",
            audience:           _config["Jwt:Audience"] ?? "ClothingManagerApp",
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(8),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
