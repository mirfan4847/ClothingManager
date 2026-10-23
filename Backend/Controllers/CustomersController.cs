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
public class CustomersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    public CustomersController(AppDbContext db, AuditService audit) { _db = db; _audit = audit; }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var customers = await _db.Customers
            .OrderBy(c => c.Name)
            .Select(c => new CustomerDto
            {
                Id        = c.Id,
                Name      = c.Name,
                Phone     = c.Phone,
                Address   = c.Address,
                Notes     = c.Notes,
                IsActive  = c.IsActive,
                CreatedAt = c.CreatedAt,
            }).ToListAsync();
        return Ok(customers);
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActive()
    {
        var customers = await _db.Customers
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .Select(c => new CustomerDto
            {
                Id        = c.Id,
                Name      = c.Name,
                Phone     = c.Phone,
                Address   = c.Address,
                Notes     = c.Notes,
                IsActive  = c.IsActive,
                CreatedAt = c.CreatedAt,
            }).ToListAsync();
        return Ok(customers);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var c = await _db.Customers.FindAsync(id);
        if (c == null) return NotFound();
        return Ok(ToDto(c));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CustomerCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Customer name is required.");
        var customer = new Customer
        {
            Name    = dto.Name.Trim(),
            Phone   = dto.Phone?.Trim(),
            Address = dto.Address?.Trim(),
            Notes   = dto.Notes?.Trim(),
        };
        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Create", "Customers", "Customer", customer.Id, customer.Name, new() {
            new("Name",  null, customer.Name),
            new("Phone", null, customer.Phone),
        });
        return Ok(ToDto(customer));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CustomerCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Customer name is required.");
        var customer = await _db.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        var old = new { customer.Name, customer.Phone, customer.Address };
        customer.Name    = dto.Name.Trim();
        customer.Phone   = dto.Phone?.Trim();
        customer.Address = dto.Address?.Trim();
        customer.Notes   = dto.Notes?.Trim();
        await _db.SaveChangesAsync();
        var changes = new List<FieldChange>();
        if (old.Name    != customer.Name)    changes.Add(new("Name",    old.Name,    customer.Name));
        if (old.Phone   != customer.Phone)   changes.Add(new("Phone",   old.Phone,   customer.Phone));
        if (old.Address != customer.Address) changes.Add(new("Address", old.Address, customer.Address));
        if (changes.Count > 0) await _audit.LogAsync("Update", "Customers", "Customer", customer.Id, customer.Name, changes);
        return Ok(ToDto(customer));
    }

    [HttpPatch("{id}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var customer = await _db.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        var oldStatus = customer.IsActive;
        customer.IsActive = !customer.IsActive;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Toggle", "Customers", "Customer", customer.Id, customer.Name, new() {
            new("Status", oldStatus ? "Active" : "Inactive", customer.IsActive ? "Active" : "Inactive"),
        });
        return Ok(ToDto(customer));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var customer = await _db.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        var name = customer.Name;
        _db.Customers.Remove(customer);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("Delete", "Customers", "Customer", id, name, new() {
            new("Name", name, null),
        });
        return NoContent();
    }

    private static CustomerDto ToDto(Customer c) => new()
    {
        Id        = c.Id,
        Name      = c.Name,
        Phone     = c.Phone,
        Address   = c.Address,
        Notes     = c.Notes,
        IsActive  = c.IsActive,
        CreatedAt = c.CreatedAt,
    };
}
