namespace ClothingManager.DTOs;

public class ScannedSlipRowDto
{
    public string LotNumber { get; set; } = string.Empty;
    public int? MatchedLotId { get; set; }
    public string? MatchedLotNumber { get; set; }
    public string? Size { get; set; }
    public int? MatchedSizeId { get; set; }
    public string? Color { get; set; }
    public int? MatchedColorId { get; set; }
    public string? Machine { get; set; }
    public int? MatchedMachineId { get; set; }
    public int? Front { get; set; }
    public int? Bazo { get; set; }
    public int? Tape { get; set; }
    public int? Pocket { get; set; }
    public int? Gala { get; set; }
    public int? Lable { get; set; }
    public int? Moda { get; set; }
    public int? Quantity { get; set; }
    public int? TotalPiece { get; set; }
    public bool Completed { get; set; } = true;
    public DateTime? DateCompleted { get; set; }
    public string? Notes { get; set; }
    public string? Confidence { get; set; }
    public bool IsSelected { get; set; } = true;
}

public class SlipScanResultDto
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? WorkerNameHint { get; set; }
    public int? MatchedWorkerId { get; set; }
    public string? MatchedWorkerName { get; set; }
    public string? SlipDate { get; set; }
    public List<ScannedSlipRowDto> Rows { get; set; } = new();
    public int TotalRowsDetected => Rows.Count;
}

public class BulkWorkerEntryCreateDto
{
    public int WorkerId { get; set; }
    public List<WorkerEntryCreateDto> Entries { get; set; } = new();
}

public class GeminiConfigDto
{
    public string? ApiKey { get; set; }
    public bool IsConfigured { get; set; }
    public string Model { get; set; } = "gemini-1.5-flash";
}

public class TestGeminiRequestDto
{
    public string? ApiKey { get; set; }
}
