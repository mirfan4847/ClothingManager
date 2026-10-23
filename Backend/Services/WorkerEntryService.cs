using Microsoft.EntityFrameworkCore;
using ClothingManager.Data;
using ClothingManager.DTOs;
using ClothingManager.Models;

namespace ClothingManager.Services;

public class WorkerEntryService
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public WorkerEntryService(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    public async Task<List<WorkerEntryDto>> GetByWorkerAsync(int workerId)
    {
        return await _db.WorkerEntries
            .Include(e => e.Worker)
            .Include(e => e.Lot)
            .Include(e => e.Size)
            .Include(e => e.Color)
            .Include(e => e.Machine)
            .Where(e => e.WorkerId == workerId)
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => ToDto(e))
            .ToListAsync();
    }

    public async Task<WorkerEntryDto?> GetByIdAsync(int id)
    {
        var e = await _db.WorkerEntries
            .Include(e => e.Worker).Include(e => e.Lot)
            .Include(e => e.Size).Include(e => e.Color).Include(e => e.Machine)
            .FirstOrDefaultAsync(e => e.Id == id);
        return e == null ? null : ToDto(e);
    }

    public async Task<WorkerEntryDto> CreateAsync(WorkerEntryCreateDto dto)
    {
        if (!await _db.Workers.AnyAsync(w => w.Id == dto.WorkerId))
            throw new ArgumentException($"Worker ID {dto.WorkerId} not found. Please add the worker first.");
        if (dto.LotId <= 0 || !await _db.Lots.AnyAsync(l => l.Id == dto.LotId))
            throw new ArgumentException("Please select a valid Lot Number.");

        var entry = new WorkerEntry
        {
            WorkerId = dto.WorkerId, LotId = dto.LotId,
            SizeId = dto.SizeId, ColorId = dto.ColorId, MachineId = dto.MachineId,
            Front = dto.Front, Bazo = dto.Bazo, Tape = dto.Tape,
            Pocket = dto.Pocket, Gala = dto.Gala, Lable = dto.Lable,
            Moda = dto.Moda, Quantity = dto.Quantity, TotalPiece = dto.TotalPiece,
            Completed = dto.Completed, DateCompleted = dto.DateCompleted
        };
        _db.WorkerEntries.Add(entry);
        await _db.SaveChangesAsync();
        return await GetByIdAsync(entry.Id) ?? throw new Exception("Save failed");
    }

    public async Task<WorkerEntryDto?> UpdateAsync(int id, WorkerEntryCreateDto dto)
    {
        var entry = await _db.WorkerEntries.FindAsync(id);
        if (entry == null) return null;

        entry.LotId = dto.LotId; entry.SizeId = dto.SizeId;
        entry.ColorId = dto.ColorId; entry.MachineId = dto.MachineId;
        entry.Front = dto.Front; entry.Bazo = dto.Bazo; entry.Tape = dto.Tape;
        entry.Pocket = dto.Pocket; entry.Gala = dto.Gala; entry.Lable = dto.Lable;
        entry.Moda = dto.Moda; entry.Quantity = dto.Quantity; entry.TotalPiece = dto.TotalPiece;
        entry.Completed = dto.Completed; entry.DateCompleted = dto.DateCompleted;
        entry.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var entry = await _db.WorkerEntries.FindAsync(id);
        if (entry == null) return false;
        _db.WorkerEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<string?> UploadPictureAsync(int id, IFormFile file)
    {
        var entry = await _db.WorkerEntries.FindAsync(id);
        if (entry == null) return null;

        var uploads = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads");
        Directory.CreateDirectory(uploads);
        var fileName = $"{id}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var filePath = Path.Combine(uploads, fileName);

        using var stream = new FileStream(filePath, FileMode.Create);
        await file.CopyToAsync(stream);

        entry.PicturePath = $"/uploads/{fileName}";
        entry.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return entry.PicturePath;
    }

    private static WorkerEntryDto ToDto(WorkerEntry e) => new()
    {
        Id = e.Id, WorkerId = e.WorkerId,
        WorkerName = e.Worker?.Name ?? "", SheetType = e.Worker?.SheetType ?? "",
        LotId = e.LotId, LotNumber = e.Lot?.LotNumber ?? "", LotMaterial = e.Lot?.Material, LotPicturePath = e.Lot?.PicturePath,
        SizeId = e.SizeId, Size = e.Size?.Name,
        ColorId = e.ColorId, Color = e.Color?.Name,
        MachineId = e.MachineId, Machine = e.Machine?.Name,
        Front = e.Front, Bazo = e.Bazo, Tape = e.Tape,
        Pocket = e.Pocket, Gala = e.Gala, Lable = e.Lable,
        Moda = e.Moda, Quantity = e.Quantity, TotalPiece = e.TotalPiece,
        Completed = e.Completed, DateCompleted = e.DateCompleted,
        PicturePath = e.PicturePath, CreatedAt = e.CreatedAt
    };
}
