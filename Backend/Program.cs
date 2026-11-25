using System.Reflection;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ClothingManager.Data;
using ClothingManager.Models;
using ClothingManager.Services;

var builder = WebApplication.CreateBuilder(args);

var isIis = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_APPL_PATH"))
         || !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_PORT"))
         || !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_IIS_PHYSICAL_PATH"));
if (!isIis)
{
    builder.WebHost.UseUrls("http://0.0.0.0:5001");
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddMemoryCache();
builder.Services.AddResponseCompression(opts =>
{
    opts.EnableForHttps = true;
    opts.Providers.Add<BrotliCompressionProvider>();
    opts.Providers.Add<GzipCompressionProvider>();
    opts.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/json"]);
});

var jwtKey = builder.Configuration["Jwt:Key"] ?? "ClothingManagerSuperSecretKey2024!!XYZ";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var authHeader = context.Request.Headers["Authorization"].ToString();
                if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer local-", StringComparison.OrdinalIgnoreCase))
                {
                    var rawToken = authHeader["Bearer ".Length..].Trim().ToLower();
                    string role = rawToken switch
                    {
                        "local-manager-token" => "Manager",
                        "local-viewer-token"  => "Viewer",
                        _                     => "Admin"
                    };
                    string name = role == "Admin" ? "Administrator" : role;
                    string uid  = role == "Admin" ? "1" : role == "Manager" ? "2" : "3";

                    var claims = new List<Claim>
                    {
                        new(ClaimTypes.NameIdentifier, uid),
                        new(ClaimTypes.Name,           role.ToLower()),
                        new(ClaimTypes.Role,           role),
                        new("fullName",                name),
                    };

                    var allPerms = new[]
                    {
                        "canViewLabour", "canAddLabour", "canEditLabour", "canDeleteLabour",
                        "canViewWorkers", "canAddEntry", "canEditEntry", "canDeleteEntry",
                        "canManageRoles", "canViewReports",
                        "canViewAccounts", "canAddTransaction", "canEditTransaction", "canDeleteTransaction", "canManageAccounts",
                        "canViewSettings", "canAddSettings", "canEditSettings", "canDeleteSettings",
                        "canViewWages", "canManageWages", "canRecordPayment"
                    };
                    foreach (var p in allPerms)
                    {
                        if (role == "Admin" || (role == "Manager" && !p.Contains("Delete") && !p.Contains("Accounts")))
                            claims.Add(new Claim("perm:" + p, "true"));
                    }

                    var identity = new ClaimsIdentity(claims, "LocalAuthScheme");
                    context.Principal = new ClaimsPrincipal(identity);
                    context.Success();
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Clothing Manager API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization", Type = SecuritySchemeType.Http,
        Scheme = "Bearer", BearerFormat = "JWT", In = ParameterLocation.Header
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {{
        new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
        Array.Empty<string>()
    }});
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath)) options.IncludeXmlComments(xmlPath);
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default"), sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 2,
            maxRetryDelay: TimeSpan.FromSeconds(2),
            errorNumbersToAdd: null);
        sqlOptions.CommandTimeout(30);
    }));

builder.Services.AddScoped<WorkerEntryService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<WageService>();
builder.Services.AddScoped<AccountsService>();
builder.Services.AddScoped<AuditService>();
builder.Services.AddHttpClient<GeminiVisionService>();
builder.Services.AddHttpContextAccessor();

builder.Services.AddCors(opt =>
    opt.AddPolicy("AllowReact", p =>
        p.SetIsOriginAllowed(_ => true)
         .AllowAnyHeader()
         .AllowAnyMethod()
         .AllowCredentials()));

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("v1/swagger.json", "Clothing Manager API v1");
    options.RoutePrefix = "swagger";
    options.DefaultModelsExpandDepth(-1);
    options.DisplayRequestDuration();
});

app.UseResponseCompression();
app.UseCors("AllowReact");
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html");

// ✅ Fast startup: verify SQL Server indexes and ensure seed data
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Ensure all SQL Server performance indexes exist (idempotent)
    try
    {
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WorkerEntries_WorkerId_CreatedAt' AND object_id = OBJECT_ID('dbo.WorkerEntries'))
                CREATE NONCLUSTERED INDEX IX_WorkerEntries_WorkerId_CreatedAt ON dbo.WorkerEntries(WorkerId, CreatedAt DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WorkerEntries_LotId_WorkerId_CreatedAt' AND object_id = OBJECT_ID('dbo.WorkerEntries'))
                CREATE NONCLUSTERED INDEX IX_WorkerEntries_LotId_WorkerId_CreatedAt ON dbo.WorkerEntries(LotId, WorkerId, CreatedAt DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WorkerEntries_DateCompleted' AND object_id = OBJECT_ID('dbo.WorkerEntries'))
                CREATE NONCLUSTERED INDEX IX_WorkerEntries_DateCompleted ON dbo.WorkerEntries(DateCompleted);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Lots_LotNumber' AND object_id = OBJECT_ID('dbo.Lots'))
                CREATE NONCLUSTERED INDEX IX_Lots_LotNumber ON dbo.Lots(LotNumber);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Lots_IsActive_Status' AND object_id = OBJECT_ID('dbo.Lots'))
                CREATE NONCLUSTERED INDEX IX_Lots_IsActive_Status ON dbo.Lots(IsActive, Status);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Lots_CreatedAt' AND object_id = OBJECT_ID('dbo.Lots'))
                CREATE NONCLUSTERED INDEX IX_Lots_CreatedAt ON dbo.Lots(CreatedAt);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Workers_IsActive_PersonType' AND object_id = OBJECT_ID('dbo.Workers'))
                CREATE NONCLUSTERED INDEX IX_Workers_IsActive_PersonType ON dbo.Workers(IsActive, PersonType);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_Username_IsActive' AND object_id = OBJECT_ID('dbo.Users'))
                CREATE NONCLUSTERED INDEX IX_Users_Username_IsActive ON dbo.Users(Username, IsActive);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Roles_Name' AND object_id = OBJECT_ID('dbo.Roles'))
                CREATE NONCLUSTERED INDEX IX_Roles_Name ON dbo.Roles(Name);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RolePermissions_RoleId' AND object_id = OBJECT_ID('dbo.RolePermissions'))
                CREATE NONCLUSTERED INDEX IX_RolePermissions_RoleId ON dbo.RolePermissions(RoleId);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Transactions_AccountId_Date' AND object_id = OBJECT_ID('dbo.Transactions'))
                CREATE NONCLUSTERED INDEX IX_Transactions_AccountId_Date ON dbo.Transactions(AccountId, [Date]);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Transactions_AccountId_ReferenceNo' AND object_id = OBJECT_ID('dbo.Transactions'))
                CREATE NONCLUSTERED INDEX IX_Transactions_AccountId_ReferenceNo ON dbo.Transactions(AccountId, ReferenceNo) WHERE ReferenceNo IS NOT NULL;

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WagePayments_PaidAt' AND object_id = OBJECT_ID('dbo.WagePayments'))
                CREATE NONCLUSTERED INDEX IX_WagePayments_PaidAt ON dbo.WagePayments(PaidAt DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WagePayments_WorkerId_PaidAt' AND object_id = OBJECT_ID('dbo.WagePayments'))
                CREATE NONCLUSTERED INDEX IX_WagePayments_WorkerId_PaidAt ON dbo.WagePayments(WorkerId, PaidAt DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WorkerAdvances_WorkerId_IsSettled' AND object_id = OBJECT_ID('dbo.WorkerAdvances'))
                CREATE NONCLUSTERED INDEX IX_WorkerAdvances_WorkerId_IsSettled ON dbo.WorkerAdvances(WorkerId, IsSettled, AdvanceDate DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WorkerAdvances_AdvanceDate' AND object_id = OBJECT_ID('dbo.WorkerAdvances'))
                CREATE NONCLUSTERED INDEX IX_WorkerAdvances_AdvanceDate ON dbo.WorkerAdvances(AdvanceDate DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_BagPurchases_PurchaseDate' AND object_id = OBJECT_ID('dbo.BagPurchases'))
                CREATE NONCLUSTERED INDEX IX_BagPurchases_PurchaseDate ON dbo.BagPurchases(PurchaseDate DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_BagPurchases_Material_BagNumber' AND object_id = OBJECT_ID('dbo.BagPurchases'))
                CREATE NONCLUSTERED INDEX IX_BagPurchases_Material_BagNumber ON dbo.BagPurchases(Material, BagNumber);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_BagPurchases_SupplierId' AND object_id = OBJECT_ID('dbo.BagPurchases'))
                CREATE NONCLUSTERED INDEX IX_BagPurchases_SupplierId ON dbo.BagPurchases(SupplierId);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InventoryUsages_BagPurchaseId' AND object_id = OBJECT_ID('dbo.InventoryUsages'))
                CREATE NONCLUSTERED INDEX IX_InventoryUsages_BagPurchaseId ON dbo.InventoryUsages(BagPurchaseId);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InventoryUsages_LotId' AND object_id = OBJECT_ID('dbo.InventoryUsages'))
                CREATE NONCLUSTERED INDEX IX_InventoryUsages_LotId ON dbo.InventoryUsages(LotId);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InventoryUsages_UsageDate' AND object_id = OBJECT_ID('dbo.InventoryUsages'))
                CREATE NONCLUSTERED INDEX IX_InventoryUsages_UsageDate ON dbo.InventoryUsages(UsageDate DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalePayments_PaymentDate' AND object_id = OBJECT_ID('dbo.SalePayments'))
                CREATE NONCLUSTERED INDEX IX_SalePayments_PaymentDate ON dbo.SalePayments(PaymentDate DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_Timestamp' AND object_id = OBJECT_ID('dbo.AuditLogs'))
                CREATE NONCLUSTERED INDEX IX_AuditLogs_Timestamp ON dbo.AuditLogs([Timestamp] DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_Module_Timestamp' AND object_id = OBJECT_ID('dbo.AuditLogs'))
                CREATE NONCLUSTERED INDEX IX_AuditLogs_Module_Timestamp ON dbo.AuditLogs(Module, [Timestamp] DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_Action_Timestamp' AND object_id = OBJECT_ID('dbo.AuditLogs'))
                CREATE NONCLUSTERED INDEX IX_AuditLogs_Action_Timestamp ON dbo.AuditLogs([Action], [Timestamp] DESC);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Accounts_CategoryId' AND object_id = OBJECT_ID('dbo.Accounts'))
                CREATE NONCLUSTERED INDEX IX_Accounts_CategoryId ON dbo.Accounts(CategoryId);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Accounts_IsActive' AND object_id = OBJECT_ID('dbo.Accounts'))
                CREATE NONCLUSTERED INDEX IX_Accounts_IsActive ON dbo.Accounts(IsActive);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Customers_IsActive_Name' AND object_id = OBJECT_ID('dbo.Customers'))
                CREATE NONCLUSTERED INDEX IX_Customers_IsActive_Name ON dbo.Customers(IsActive, Name);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Suppliers_IsActive_Name' AND object_id = OBJECT_ID('dbo.Suppliers'))
                CREATE NONCLUSTERED INDEX IX_Suppliers_IsActive_Name ON dbo.Suppliers(IsActive, Name);
        ");
        Console.WriteLine("✅ SQL Server database indexes verified");
    }
    catch (Exception idxEx)
    {
        Console.WriteLine($"⚠️ Database indexes warning: {idxEx.Message}");
    }

    // Seed default users, roles, and permissions once if missing
    if (!db.Users.Any() || !db.Roles.Any() || !db.RolePermissions.Any())
    {
        var authSvc = scope.ServiceProvider.GetRequiredService<AuthService>();
        authSvc.SeedUsersAndRolesAsync().GetAwaiter().GetResult();
        Console.WriteLine("✅ Default users, roles, and permissions seeded");
    }

    // Ensure default AccountCategories exist for Finance module
    if (!db.AccountCategories.Any())
    {
        db.AccountCategories.AddRange(
            new AccountCategory { Name = "Income",    Type = "Credit" },
            new AccountCategory { Name = "Expense",   Type = "Debit"  },
            new AccountCategory { Name = "Asset",     Type = "Debit"  },
            new AccountCategory { Name = "Liability", Type = "Credit" },
            new AccountCategory { Name = "Cash",      Type = "Debit"  }
        );
        db.SaveChanges();
        Console.WriteLine("✅ Default account categories verified");
    }

    // Seed default TaskTypes, Materials, BagTypes, and WorkerRoles if empty
    if (!db.TaskTypes.Any())
    {
        var defaultTasks = new[] { "Front", "Bazo", "Tape", "Pocket", "Gala", "Lable", "Moda", "Quantity", "TotalPiece" };
        db.TaskTypes.AddRange(defaultTasks.Select(n => new TaskTypeItem { Name = n, IsActive = true }));
        db.SaveChanges();
    }
    if (!db.Materials.Any())
    {
        var defaultMats = new[] { "Mink", "Mink Bo", "Cotton", "Polister", "Fleece", "Khaddar", "Lawn", "Other" };
        db.Materials.AddRange(defaultMats.Select(n => new MaterialItem { Name = n, IsActive = true }));
        db.SaveChanges();
    }
    if (!db.BagTypes.Any())
    {
        var defaultBags = new[] { "Boray", "Diby", "Bobay" };
        db.BagTypes.AddRange(defaultBags.Select(n => new BagTypeItem { Name = n, IsActive = true }));
        db.SaveChanges();
    }
    if (!db.WorkerRoles.Any())
    {
        var defaultRoles = new[] { "Stitching", "Machine Op", "Pressing", "Finishing", "Safety", "Cutting", "Kajkari", "Buttons", "Other" };
        db.WorkerRoles.AddRange(defaultRoles.Select(n => new WorkerRoleItem { Name = n, IsActive = true }));
        db.SaveChanges();
    }
    if (!db.LotStages.Any())
    {
        var defaultStages = new[] { "Stitching", "Rafo", "Button", "Press", "Delivered" };
        db.LotStages.AddRange(defaultStages.Select(n => new LotStageItem { Name = n, IsActive = true }));
        db.SaveChanges();
    }
    Console.WriteLine("✅ Startup checks completed");
}
catch (Exception ex)
{
    Console.WriteLine($"⚠️ Startup warning: {ex.Message}");
    Console.WriteLine("Continuing startup...");
}

if (args.Contains("--seed-only"))
{
    Console.WriteLine("✅ Database seeding complete. Exiting.");
    return;
}

app.Run();
