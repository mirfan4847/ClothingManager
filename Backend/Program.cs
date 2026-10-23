using System.Reflection;
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

builder.WebHost.UseUrls("http://0.0.0.0:5001");

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
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
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorNumbersToAdd: null);
        sqlOptions.CommandTimeout(60);
    }));

builder.Services.AddScoped<WorkerEntryService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<WageService>();
builder.Services.AddScoped<AccountsService>();
builder.Services.AddScoped<AuditService>();
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
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Clothing Manager API v1");
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

// ✅ Safe migrate - won't crash if DB is already up to date
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    Console.WriteLine("✅ Database migration successful");

    // Create indexes if they don't exist (idempotent — safe to run on every startup)
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WorkerEntries_WorkerId' AND object_id = OBJECT_ID('WorkerEntries'))
            CREATE INDEX IX_WorkerEntries_WorkerId ON WorkerEntries(WorkerId);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WorkerEntries_LotId' AND object_id = OBJECT_ID('WorkerEntries'))
            CREATE INDEX IX_WorkerEntries_LotId ON WorkerEntries(LotId);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Transactions_AccountId' AND object_id = OBJECT_ID('Transactions'))
            CREATE INDEX IX_Transactions_AccountId ON Transactions(AccountId);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Transactions_Date' AND object_id = OBJECT_ID('Transactions'))
            CREATE INDEX IX_Transactions_Date ON Transactions(Date);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WagePayments_WorkerId' AND object_id = OBJECT_ID('WagePayments'))
            CREATE INDEX IX_WagePayments_WorkerId ON WagePayments(WorkerId);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WageRates_WorkerId' AND object_id = OBJECT_ID('WageRates'))
            CREATE INDEX IX_WageRates_WorkerId ON WageRates(WorkerId);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WorkerAdvances_WorkerId' AND object_id = OBJECT_ID('WorkerAdvances'))
            CREATE INDEX IX_WorkerAdvances_WorkerId ON WorkerAdvances(WorkerId);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Sales_CustomerId' AND object_id = OBJECT_ID('Sales'))
            CREATE INDEX IX_Sales_CustomerId ON Sales(CustomerId);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalePayments_SaleId' AND object_id = OBJECT_ID('SalePayments'))
            CREATE INDEX IX_SalePayments_SaleId ON SalePayments(SaleId);
    ");
    Console.WriteLine("✅ Database indexes verified");

    // Create any tables that may be missing (no migration files — idempotent)
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WageRates')
        CREATE TABLE WageRates (
            Id          INT IDENTITY(1,1) PRIMARY KEY,
            WorkerId    INT NOT NULL,
            TaskType    NVARCHAR(100) NOT NULL,
            RatePerPiece DECIMAL(18,2) NOT NULL,
            IsActive    BIT NOT NULL DEFAULT 1,
            CreatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            UpdatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_WageRates_Worker FOREIGN KEY (WorkerId) REFERENCES Workers(Id)
        );

        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WagePayments')
        CREATE TABLE WagePayments (
            Id          INT IDENTITY(1,1) PRIMARY KEY,
            WorkerId    INT NOT NULL,
            GrossAmount DECIMAL(18,2) NOT NULL,
            Deductions  DECIMAL(18,2) NOT NULL DEFAULT 0,
            NetAmount   DECIMAL(18,2) NOT NULL,
            Notes       NVARCHAR(MAX) NULL,
            PeriodFrom  DATETIME2 NOT NULL,
            PeriodTo    DATETIME2 NOT NULL,
            PaidAt      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CreatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_WagePayments_Worker FOREIGN KEY (WorkerId) REFERENCES Workers(Id)
        );

        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WorkerAdvances')
        CREATE TABLE WorkerAdvances (
            Id          INT IDENTITY(1,1) PRIMARY KEY,
            WorkerId    INT NOT NULL,
            Amount      DECIMAL(18,2) NOT NULL,
            Notes       NVARCHAR(MAX) NULL,
            AdvanceDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            IsSettled   BIT NOT NULL DEFAULT 0,
            SettledAt   DATETIME2 NULL,
            CreatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_WorkerAdvances_Worker FOREIGN KEY (WorkerId) REFERENCES Workers(Id)
        );

        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Customers')
        CREATE TABLE Customers (
            Id        INT IDENTITY(1,1) PRIMARY KEY,
            Name      NVARCHAR(200) NOT NULL,
            Phone     NVARCHAR(50)  NULL,
            Address   NVARCHAR(500) NULL,
            Notes     NVARCHAR(MAX) NULL,
            IsActive  BIT NOT NULL DEFAULT 1,
            CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );

        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Suppliers')
        CREATE TABLE Suppliers (
            Id            INT IDENTITY(1,1) PRIMARY KEY,
            Name          NVARCHAR(200) NOT NULL,
            Phone         NVARCHAR(50)  NULL,
            Address       NVARCHAR(500) NULL,
            Notes         NVARCHAR(MAX) NULL,
            IsActive      BIT NOT NULL DEFAULT 1,
            PurchaseCount INT NOT NULL DEFAULT 0,
            CreatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );

        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BagPurchases')
        CREATE TABLE BagPurchases (
            Id           INT IDENTITY(1,1) PRIMARY KEY,
            BagNumber    NVARCHAR(100) NOT NULL,
            Material     NVARCHAR(100) NOT NULL,
            BagType      NVARCHAR(100) NOT NULL,
            Quantity     INT NOT NULL,
            UnitPrice    DECIMAL(18,2) NULL,
            PurchaseDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            SupplierId   INT NULL,
            Notes        NVARCHAR(MAX) NULL,
            CreatedAt    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_BagPurchases_Supplier FOREIGN KEY (SupplierId) REFERENCES Suppliers(Id)
        );

        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryUsages')
        CREATE TABLE InventoryUsages (
            Id            INT IDENTITY(1,1) PRIMARY KEY,
            LotId         INT NOT NULL,
            BagPurchaseId INT NOT NULL,
            QuantityUsed  INT NOT NULL,
            UsageDate     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            Notes         NVARCHAR(MAX) NULL,
            CreatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_InventoryUsages_Lot         FOREIGN KEY (LotId)         REFERENCES Lots(Id),
            CONSTRAINT FK_InventoryUsages_BagPurchase FOREIGN KEY (BagPurchaseId) REFERENCES BagPurchases(Id)
        );

        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Sales')
        CREATE TABLE Sales (
            Id           INT IDENTITY(1,1) PRIMARY KEY,
            LotId        INT NOT NULL,
            CustomerId   INT NOT NULL,
            Quantity     INT NOT NULL,
            RatePerPiece DECIMAL(18,2) NOT NULL,
            TotalAmount  DECIMAL(18,2) NOT NULL,
            Discount     DECIMAL(18,2) NOT NULL DEFAULT 0,
            NetAmount    DECIMAL(18,2) NOT NULL,
            SaleDate     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            Notes        NVARCHAR(MAX) NULL,
            CreatedAt    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_Sales_Lot      FOREIGN KEY (LotId)       REFERENCES Lots(Id),
            CONSTRAINT FK_Sales_Customer FOREIGN KEY (CustomerId)  REFERENCES Customers(Id)
        );

        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SalePayments')
        CREATE TABLE SalePayments (
            Id          INT IDENTITY(1,1) PRIMARY KEY,
            SaleId      INT NOT NULL,
            Amount      DECIMAL(18,2) NOT NULL,
            PaymentDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            Notes       NVARCHAR(MAX) NULL,
            CreatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_SalePayments_Sale FOREIGN KEY (SaleId) REFERENCES Sales(Id)
        );
    ");
    Console.WriteLine("✅ Missing tables created (if any)");

    // Create AuditLogs table if missing
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuditLogs')
        CREATE TABLE AuditLogs (
            Id            INT IDENTITY(1,1) PRIMARY KEY,
            UserId        INT NULL,
            UserName      NVARCHAR(200) NOT NULL DEFAULT '',
            Action        NVARCHAR(50)  NOT NULL DEFAULT '',
            Module        NVARCHAR(100) NOT NULL DEFAULT '',
            EntityType    NVARCHAR(100) NOT NULL DEFAULT '',
            EntityId      INT NULL,
            EntityName    NVARCHAR(500) NULL,
            ChangeSummary NVARCHAR(MAX) NULL,
            Timestamp     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_Timestamp' AND object_id = OBJECT_ID('AuditLogs'))
            CREATE INDEX IX_AuditLogs_Timestamp ON AuditLogs(Timestamp DESC);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_Module' AND object_id = OBJECT_ID('AuditLogs'))
            CREATE INDEX IX_AuditLogs_Module ON AuditLogs(Module);
    ");
    Console.WriteLine("✅ AuditLogs table verified");

    // Add PersonType column to Workers if missing
    db.Database.ExecuteSqlRaw(@"
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Workers') AND name = 'PersonType')
            ALTER TABLE Workers ADD PersonType NVARCHAR(50) NOT NULL DEFAULT 'Worker';
    ");
    Console.WriteLine("✅ Workers.PersonType column verified");

    // Apply complete correct permission matrix — inserts missing AND corrects wrong values
    var correctPerms = new Dictionary<string, Dictionary<string, bool>>
    {
        ["Admin"] = new() {
            ["canViewLabour"]=true,  ["canAddLabour"]=true,  ["canEditLabour"]=true,  ["canDeleteLabour"]=true,
            ["canViewWorkers"]=true, ["canAddEntry"]=true,   ["canEditEntry"]=true,   ["canDeleteEntry"]=true,
            ["canManageRoles"]=true, ["canViewReports"]=true,
            ["canViewAccounts"]=true, ["canAddTransaction"]=true, ["canEditTransaction"]=true, ["canDeleteTransaction"]=true, ["canManageAccounts"]=true,
            ["canViewSettings"]=true, ["canAddSettings"]=true, ["canEditSettings"]=true, ["canDeleteSettings"]=true,
            ["canViewWages"]=true, ["canManageWages"]=true, ["canRecordPayment"]=true,
        },
        ["Manager"] = new() {
            ["canViewLabour"]=true,  ["canAddLabour"]=true,  ["canEditLabour"]=true,  ["canDeleteLabour"]=false,
            ["canViewWorkers"]=true, ["canAddEntry"]=true,   ["canEditEntry"]=true,   ["canDeleteEntry"]=false,
            ["canManageRoles"]=false, ["canViewReports"]=true,
            ["canViewAccounts"]=false, ["canAddTransaction"]=false, ["canEditTransaction"]=false, ["canDeleteTransaction"]=false, ["canManageAccounts"]=false,
            ["canViewSettings"]=true, ["canAddSettings"]=true, ["canEditSettings"]=true, ["canDeleteSettings"]=false,
            ["canViewWages"]=true, ["canManageWages"]=false, ["canRecordPayment"]=true,
        },
        ["Viewer"] = new() {
            ["canViewLabour"]=true,  ["canAddLabour"]=false, ["canEditLabour"]=false, ["canDeleteLabour"]=false,
            ["canViewWorkers"]=true, ["canAddEntry"]=false,  ["canEditEntry"]=false,  ["canDeleteEntry"]=false,
            ["canManageRoles"]=false, ["canViewReports"]=true,
            ["canViewAccounts"]=false, ["canAddTransaction"]=false, ["canEditTransaction"]=false, ["canDeleteTransaction"]=false, ["canManageAccounts"]=false,
            ["canViewSettings"]=true, ["canAddSettings"]=false, ["canEditSettings"]=false, ["canDeleteSettings"]=false,
            ["canViewWages"]=true, ["canManageWages"]=false, ["canRecordPayment"]=false,
        },
    };

    var roles = db.Roles.Include(r => r.Permissions).ToList();
    bool permChanged = false;
    foreach (var role in roles)
    {
        if (!correctPerms.TryGetValue(role.Name, out var permsForRole)) continue;
        foreach (var (perm, granted) in permsForRole)
        {
            var existing = role.Permissions.FirstOrDefault(p => p.Permission == perm);
            if (existing == null)
            {
                role.Permissions.Add(new RolePermission { RoleId = role.Id, Permission = perm, IsGranted = granted });
                permChanged = true;
            }
            else if (existing.IsGranted != granted)
            {
                existing.IsGranted = granted;
                permChanged = true;
            }
        }
    }
    if (permChanged) db.SaveChanges();
    Console.WriteLine("✅ Role permissions verified");
}
catch (Exception ex)
{
    Console.WriteLine($"⚠️ Migration warning: {ex.Message}");
    Console.WriteLine("Continuing startup...");
}

app.Run();
