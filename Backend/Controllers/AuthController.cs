using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ClothingManager.DTOs;
using ClothingManager.Services;

namespace ClothingManager.Controllers;

/// <summary>Authentication - Login and token management</summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly AuthService _svc;
    public AuthController(AuthService svc) => _svc = svc;

    /// <summary>Login and receive JWT token</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponseDto), 200)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto)
    {
        if (string.IsNullOrEmpty(dto.Username) || string.IsNullOrEmpty(dto.Password))
            return BadRequest(new { message = "Username and password are required" });

        var result = await _svc.LoginAsync(dto);
        if (result == null)
            return Unauthorized(new { message = "Invalid username or password" });

        return Ok(result);
    }

    /// <summary>Get current logged-in user info</summary>
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var userId   = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var username = User.FindFirst(ClaimTypes.Name)?.Value;
        var role     = User.FindFirst(ClaimTypes.Role)?.Value;
        var name     = User.FindFirst("fullName")?.Value;
        return Ok(new { userId, username, role, name });
    }

    /// <summary>Test endpoint - check if API is reachable</summary>
    [HttpGet("ping")]
    [AllowAnonymous]
    public IActionResult Ping() => Ok(new { message = "API is running", time = DateTime.UtcNow });
}

/// <summary>User management - Admin only</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly AuthService _svc;
    public UsersController(AuthService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _svc.GetAllUsersAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
    {
        var result = await _svc.CreateUserAsync(dto);
        if (result == null) return BadRequest(new { message = "Username already exists" });
        return CreatedAtAction(nameof(GetAll), result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateUserDto dto)
        => await _svc.UpdateUserAsync(id, dto) ? Ok() : NotFound();

    [HttpPatch("{id}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(int id)
        => await _svc.ToggleUserStatusAsync(id) ? Ok() : NotFound();

    [HttpPatch("{id}/change-password")]
    public async Task<IActionResult> ChangePassword(int id, [FromBody] ChangePasswordDto dto)
        => await _svc.ChangePasswordAsync(id, dto)
            ? Ok(new { message = "Password changed successfully" })
            : BadRequest(new { message = "Current password is incorrect" });
}

/// <summary>Role and permission management - Admin only</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
[Produces("application/json")]
public class RolesController : ControllerBase
{
    private readonly AuthService _svc;
    public RolesController(AuthService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _svc.GetAllRolePermissionsAsync());

    [HttpPut("{roleName}")]
    public async Task<IActionResult> UpdatePermissions(string roleName, [FromBody] Dictionary<string, bool> permissions)
        => await _svc.UpdateRolePermissionsAsync(roleName, permissions) ? Ok() : NotFound();
}
