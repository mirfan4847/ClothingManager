using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ClothingManager.Data;
using ClothingManager.DTOs;

namespace ClothingManager.Services;

public class GeminiVisionService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public GeminiVisionService(HttpClient http, IConfiguration config, AppDbContext db, IWebHostEnvironment env)
    {
        _http = http;
        _config = config;
        _db = db;
        _env = env;
    }

    public string? GetApiKey(string? clientKey = null)
    {
        if (!string.IsNullOrWhiteSpace(clientKey)) return clientKey.Trim();
        var key = _config["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        return !string.IsNullOrWhiteSpace(key) ? key.Trim() : null;
    }

    public string GetModel() => _config["Gemini:Model"] ?? "gemini-1.5-flash";

    public async Task<bool> TestApiKeyAsync(string apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiKey)) return false;
        var model = GetModel();
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey.Trim()}";

        var body = new
        {
            contents = new[]
            {
                new
                {
                    parts = new object[]
                    {
                        new { text = "Ping. Reply with JSON: {\"status\": \"ok\"}" }
                    }
                }
            },
            generationConfig = new { responseMimeType = "application/json" }
        };

        var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var res = await _http.PostAsync(url, content);
        return res.IsSuccessStatusCode;
    }

    public async Task<SlipScanResultDto> ScanSlipAsync(Stream imageStream, string mimeType, int? defaultWorkerId, string? clientKey = null)
    {
        var apiKey = GetApiKey(clientKey);
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("Gemini API key is not configured. Please enter your Gemini API key in Settings or configure Gemini:ApiKey in appsettings.json.");
        }

        // Convert stream to base64
        using var ms = new MemoryStream();
        await imageStream.CopyToAsync(ms);
        var imageBytes = ms.ToArray();
        var base64Image = Convert.ToBase64String(imageBytes);

        var prompt = @"You are an expert AI data extraction assistant for a garment and clothing manufacturing factory.
You are inspecting a photo/scan of a production slip, daily stitching log sheet, work ticket, or worker record sheet.
Extract all tabular row entries and header information from this slip into clean structured JSON.

Extract:
1. workerNameHint: Name or ID of worker written on the slip (e.g. 'Ali Hassan', 'Faizan', 'Arslan', '1', etc.), or null.
2. slipDate: Date on the slip in YYYY-MM-DD format if visible, or null.
3. rows: An array of rows where each row contains:
   - lotNumber: Lot number identifier (e.g., '101', 'Mid-5', 'M-1', 'Summer-2024', 'L-2', '78'). Be very accurate!
   - size: Size name if mentioned (e.g. 'Mama', 'Short', 'Large', 'Medium', 'Small', 'M', 'L', 'XL'), or null.
   - color: Color name if mentioned (e.g. 'Black', 'Red', 'Navy', 'Falsa', 'White'), or null.
   - machine: Machine name/number if mentioned (e.g. 'G9-1', 'G8', 'Juki', '1'), or null.
   - front: integer piece count for Front, or null if blank/zero.
   - bazo: integer piece count for Bazo (Sleeves), or null if blank/zero.
   - tape: integer piece count for Tape, or null if blank/zero.
   - pocket: integer piece count for Pocket, or null if blank/zero.
   - gala: integer piece count for Gala (Neck), or null if blank/zero.
   - lable: integer piece count for Lable, or null if blank/zero.
   - moda: integer piece count for Moda (Armhole), or null if blank/zero.
   - quantity: general quantity value if given, or null.
   - totalPiece: total pieces completed for this row. If not explicitly written, compute or take the maximum of the task counts.
   - completed: boolean (true if marked done, completed, or filled with pieces; false otherwise).
   - dateCompleted: row-specific date in YYYY-MM-DD format if written, or null.
   - confidence: 'high', 'medium', or 'low'.
   - notes: remarks written for this row, or null.

Return JSON matching this exact structure:
{
  ""workerNameHint"": string or null,
  ""slipDate"": string or null,
  ""rows"": [
    {
      ""lotNumber"": ""string"",
      ""size"": ""string or null"",
      ""color"": ""string or null"",
      ""machine"": ""string or null"",
      ""front"": null,
      ""bazo"": null,
      ""tape"": null,
      ""pocket"": null,
      ""gala"": null,
      ""lable"": null,
      ""moda"": null,
      ""quantity"": null,
      ""totalPiece"": 0,
      ""completed"": true,
      ""dateCompleted"": null,
      ""confidence"": ""high"",
      ""notes"": null
    }
  ]
}";

        var model = GetModel();
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new object[]
                    {
                        new { text = prompt },
                        new
                        {
                            inlineData = new
                            {
                                mimeType = string.IsNullOrWhiteSpace(mimeType) ? "image/jpeg" : mimeType,
                                data = base64Image
                            }
                        }
                    }
                }
            },
            generationConfig = new
            {
                responseMimeType = "application/json",
                temperature = 0.1
            }
        };

        var requestContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(url, requestContent);

        if (!response.IsSuccessStatusCode)
        {
            var errText = await response.Content.ReadAsStringAsync();
            throw new Exception($"Gemini API error ({response.StatusCode}): {errText}");
        }

        var jsonStr = await response.Content.ReadAsStringAsync();
        var doc = JsonNode.Parse(jsonStr);

        var candidateText = doc?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.ToString();
        if (string.IsNullOrWhiteSpace(candidateText))
        {
            return new SlipScanResultDto
            {
                Success = false,
                Message = "Gemini returned an empty response. Please ensure the image is clear and readable."
            };
        }

        // Parse extracted JSON
        using var parsedDoc = JsonDocument.Parse(candidateText);
        var root = parsedDoc.RootElement;

        var result = new SlipScanResultDto
        {
            Success = true,
            WorkerNameHint = root.TryGetProperty("workerNameHint", out var wElem) && wElem.ValueKind == JsonValueKind.String ? wElem.GetString() : null,
            SlipDate = root.TryGetProperty("slipDate", out var dElem) && dElem.ValueKind == JsonValueKind.String ? dElem.GetString() : null,
            Rows = new List<ScannedSlipRowDto>()
        };

        // Cache Master tables for ultra-fast in-memory matching
        var lots = await _db.Lots.Where(l => l.IsActive).ToListAsync();
        var sizes = await _db.Sizes.Where(s => s.IsActive).ToListAsync();
        var colors = await _db.Colors.Where(c => c.IsActive).ToListAsync();
        var machines = await _db.Machines.Where(m => m.IsActive).ToListAsync();
        var workers = await _db.Workers.Where(w => w.IsActive).ToListAsync();

        // Worker matching
        if (defaultWorkerId.HasValue && defaultWorkerId.Value > 0)
        {
            var matchedW = workers.FirstOrDefault(w => w.Id == defaultWorkerId.Value);
            result.MatchedWorkerId = defaultWorkerId.Value;
            result.MatchedWorkerName = matchedW?.Name;
        }
        else if (!string.IsNullOrWhiteSpace(result.WorkerNameHint))
        {
            var hint = result.WorkerNameHint.Trim();
            var matchedW = workers.FirstOrDefault(w =>
                string.Equals(w.Name, hint, StringComparison.OrdinalIgnoreCase) ||
                w.Name.Contains(hint, StringComparison.OrdinalIgnoreCase) ||
                hint.Contains(w.Name, StringComparison.OrdinalIgnoreCase) ||
                w.Id.ToString() == hint);

            if (matchedW != null)
            {
                result.MatchedWorkerId = matchedW.Id;
                result.MatchedWorkerName = matchedW.Name;
            }
        }

        if (root.TryGetProperty("rows", out var rowsElem) && rowsElem.ValueKind == JsonValueKind.Array)
        {
            foreach (var r in rowsElem.EnumerateArray())
            {
                var row = new ScannedSlipRowDto
                {
                    LotNumber = GetStringProp(r, "lotNumber") ?? "",
                    Size = GetStringProp(r, "size"),
                    Color = GetStringProp(r, "color"),
                    Machine = GetStringProp(r, "machine"),
                    Front = GetIntProp(r, "front"),
                    Bazo = GetIntProp(r, "bazo"),
                    Tape = GetIntProp(r, "tape"),
                    Pocket = GetIntProp(r, "pocket"),
                    Gala = GetIntProp(r, "gala"),
                    Lable = GetIntProp(r, "lable"),
                    Moda = GetIntProp(r, "moda"),
                    Quantity = GetIntProp(r, "quantity"),
                    TotalPiece = GetIntProp(r, "totalPiece"),
                    Completed = r.TryGetProperty("completed", out var compEl) && compEl.ValueKind == JsonValueKind.True,
                    Notes = GetStringProp(r, "notes"),
                    Confidence = GetStringProp(r, "confidence") ?? "high",
                };

                // Date completed
                var dateStr = GetStringProp(r, "dateCompleted") ?? result.SlipDate;
                if (!string.IsNullOrWhiteSpace(dateStr) && DateTime.TryParse(dateStr, out var parsedDt))
                {
                    row.DateCompleted = parsedDt;
                }
                else
                {
                    row.DateCompleted = DateTime.Today;
                }

                // If totalPiece is 0 or null, calculate from task values
                if (row.TotalPiece == null || row.TotalPiece == 0)
                {
                    var taskNums = new[] { row.Front, row.Bazo, row.Tape, row.Pocket, row.Gala, row.Lable, row.Moda, row.Quantity }
                        .Where(x => x.HasValue && x.Value > 0)
                        .Select(x => x!.Value)
                        .ToList();
                    row.TotalPiece = taskNums.Count > 0 ? taskNums.Max() : 0;
                }

                // Smart Matching: Lot
                if (!string.IsNullOrWhiteSpace(row.LotNumber))
                {
                    var cleanLot = row.LotNumber.Trim();
                    var matchedLot = lots.FirstOrDefault(l =>
                        string.Equals(l.LotNumber, cleanLot, StringComparison.OrdinalIgnoreCase) ||
                        cleanLot.Equals(l.LotNumber.Replace("-", "").Replace(" ", ""), StringComparison.OrdinalIgnoreCase) ||
                        l.LotNumber.EndsWith(cleanLot, StringComparison.OrdinalIgnoreCase));

                    if (matchedLot != null)
                    {
                        row.MatchedLotId = matchedLot.Id;
                        row.MatchedLotNumber = matchedLot.LotNumber;
                    }
                }

                // Smart Matching: Size
                if (!string.IsNullOrWhiteSpace(row.Size))
                {
                    var cleanSize = row.Size.Trim();
                    var matchedSize = sizes.FirstOrDefault(s =>
                        string.Equals(s.Name, cleanSize, StringComparison.OrdinalIgnoreCase) ||
                        cleanSize.StartsWith(s.Name, StringComparison.OrdinalIgnoreCase));
                    if (matchedSize != null) row.MatchedSizeId = matchedSize.Id;
                }

                // Smart Matching: Color
                if (!string.IsNullOrWhiteSpace(row.Color))
                {
                    var cleanColor = row.Color.Trim();
                    var matchedColor = colors.FirstOrDefault(c =>
                        string.Equals(c.Name, cleanColor, StringComparison.OrdinalIgnoreCase) ||
                        cleanColor.Contains(c.Name, StringComparison.OrdinalIgnoreCase));
                    if (matchedColor != null) row.MatchedColorId = matchedColor.Id;
                }

                // Smart Matching: Machine
                if (!string.IsNullOrWhiteSpace(row.Machine))
                {
                    var cleanMach = row.Machine.Trim();
                    var matchedMach = machines.FirstOrDefault(m =>
                        string.Equals(m.Name, cleanMach, StringComparison.OrdinalIgnoreCase) ||
                        cleanMach.Contains(m.Name, StringComparison.OrdinalIgnoreCase));
                    if (matchedMach != null) row.MatchedMachineId = matchedMach.Id;
                }

                result.Rows.Add(row);
            }
        }

        return result;
    }

    private static string? GetStringProp(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var p) && p.ValueKind == JsonValueKind.String)
            return p.GetString()?.Trim();
        return null;
    }

    private static int? GetIntProp(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var p))
        {
            if (p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out var num)) return num;
            if (p.ValueKind == JsonValueKind.String && int.TryParse(p.GetString(), out var sNum)) return sNum;
        }
        return null;
    }
}
