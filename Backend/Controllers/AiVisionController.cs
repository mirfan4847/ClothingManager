using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ClothingManager.DTOs;
using ClothingManager.Services;

namespace ClothingManager.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
[Produces("application/json")]
public class AiVisionController : ControllerBase
{
    private readonly GeminiVisionService _gemini;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public AiVisionController(GeminiVisionService gemini, IConfiguration config, IWebHostEnvironment env)
    {
        _gemini = gemini;
        _config = config;
        _env = env;
    }

    [HttpGet("config")]
    public IActionResult GetConfig()
    {
        var rawKey = _gemini.GetApiKey();
        var isConfigured = !string.IsNullOrWhiteSpace(rawKey);
        string? masked = null;
        if (isConfigured && rawKey!.Length > 8)
        {
            masked = $"{rawKey[..4]}...{rawKey[^4..]}";
        }
        else if (isConfigured)
        {
            masked = "****";
        }

        return Ok(new GeminiConfigDto
        {
            IsConfigured = isConfigured,
            ApiKey = masked,
            Model = _gemini.GetModel()
        });
    }

    [HttpPost("test-key")]
    public async Task<IActionResult> TestKey([FromBody] TestGeminiRequestDto dto)
    {
        var key = !string.IsNullOrWhiteSpace(dto?.ApiKey) ? dto.ApiKey : _gemini.GetApiKey();
        if (string.IsNullOrWhiteSpace(key))
            return BadRequest(new { success = false, message = "API key cannot be empty." });

        try
        {
            var valid = await _gemini.TestApiKeyAsync(key);
            if (valid)
                return Ok(new { success = true, message = "Gemini API key is valid and connected successfully!" });
            return BadRequest(new { success = false, message = "Gemini API responded with an error. Please verify the key has Gemini API access enabled." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, message = $"Connectivity test failed: {ex.Message}" });
        }
    }

    [HttpPost("save-key")]
    public async Task<IActionResult> SaveKey([FromBody] TestGeminiRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto?.ApiKey))
            return BadRequest(new { success = false, message = "API key cannot be empty." });

        try
        {
            // Verify key first
            var valid = await _gemini.TestApiKeyAsync(dto.ApiKey);
            if (!valid)
            {
                return BadRequest(new { success = false, message = "Failed to connect with this key. Please double check that the key is valid." });
            }

            // Persist to appsettings.json if writable
            var appSettingsPath = Path.Combine(_env.ContentRootPath, "appsettings.json");
            if (System.IO.File.Exists(appSettingsPath))
            {
                var jsonStr = await System.IO.File.ReadAllTextAsync(appSettingsPath);
                var jsonObj = JsonNode.Parse(jsonStr)?.AsObject() ?? new JsonObject();
                if (!jsonObj.ContainsKey("Gemini"))
                {
                    jsonObj["Gemini"] = new JsonObject();
                }
                jsonObj["Gemini"]!["ApiKey"] = dto.ApiKey.Trim();
                jsonObj["Gemini"]!["Model"] = _gemini.GetModel();

                var options = new JsonSerializerOptions { WriteIndented = true };
                await System.IO.File.WriteAllTextAsync(appSettingsPath, jsonObj.ToJsonString(options));
            }

            return Ok(new { success = true, message = "Gemini API key verified and saved successfully!" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { success = false, message = $"Could not persist key: {ex.Message}" });
        }
    }
}
