using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ClothingManager.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccountCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    UserName = table.Column<string>(type: "text", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    Module = table.Column<string>(type: "text", nullable: false),
                    EntityType = table.Column<string>(type: "text", nullable: false),
                    EntityId = table.Column<int>(type: "integer", nullable: true),
                    EntityName = table.Column<string>(type: "text", nullable: true),
                    ChangeSummary = table.Column<string>(type: "text", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BagTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BagTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Colors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Colors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LotStages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LotStages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Machines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Machines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Materials",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Materials", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Sizes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sizes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Suppliers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TaskTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Username = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WorkerRoles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkerRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Workers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    SheetType = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: true),
                    JoinDate = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    PersonType = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Accounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    CategoryId = table.Column<int>(type: "integer", nullable: false),
                    Balance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Accounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Accounts_AccountCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "AccountCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RolePermissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RoleId = table.Column<int>(type: "integer", nullable: false),
                    Permission = table.Column<string>(type: "text", nullable: false),
                    IsGranted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RolePermissions_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Lots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LotNumber = table.Column<string>(type: "text", nullable: false),
                    SizeId = table.Column<int>(type: "integer", nullable: true),
                    Material = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    PicturePath = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Lots_Sizes_SizeId",
                        column: x => x.SizeId,
                        principalTable: "Sizes",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "BagPurchases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BagNumber = table.Column<string>(type: "text", nullable: false),
                    Material = table.Column<string>(type: "text", nullable: false),
                    BagType = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    PurchaseDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    SupplierId = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BagPurchases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BagPurchases_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "WagePayments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WorkerId = table.Column<int>(type: "integer", nullable: false),
                    GrossAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Deductions = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    PeriodFrom = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    PeriodTo = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WagePayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WagePayments_Workers_WorkerId",
                        column: x => x.WorkerId,
                        principalTable: "Workers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WageRates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WorkerId = table.Column<int>(type: "integer", nullable: false),
                    TaskType = table.Column<string>(type: "text", nullable: false),
                    RatePerPiece = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WageRates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WageRates_Workers_WorkerId",
                        column: x => x.WorkerId,
                        principalTable: "Workers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkerAdvances",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WorkerId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    AdvanceDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IsSettled = table.Column<bool>(type: "boolean", nullable: false),
                    SettledAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkerAdvances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkerAdvances_Workers_WorkerId",
                        column: x => x.WorkerId,
                        principalTable: "Workers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Transactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AccountId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    ReferenceNo = table.Column<string>(type: "text", nullable: true),
                    Date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Transactions_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LotId = table.Column<int>(type: "integer", nullable: false),
                    CustomerId = table.Column<int>(type: "integer", nullable: false),
                    SaleDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TotalPieces = table.Column<int>(type: "integer", nullable: false),
                    RatePerPiece = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sales", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sales_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Sales_Lots_LotId",
                        column: x => x.LotId,
                        principalTable: "Lots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkerEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WorkerId = table.Column<int>(type: "integer", nullable: false),
                    LotId = table.Column<int>(type: "integer", nullable: false),
                    SizeId = table.Column<int>(type: "integer", nullable: true),
                    ColorId = table.Column<int>(type: "integer", nullable: true),
                    MachineId = table.Column<int>(type: "integer", nullable: true),
                    Front = table.Column<int>(type: "integer", nullable: true),
                    Bazo = table.Column<int>(type: "integer", nullable: true),
                    Tape = table.Column<int>(type: "integer", nullable: true),
                    Pocket = table.Column<int>(type: "integer", nullable: true),
                    Gala = table.Column<int>(type: "integer", nullable: true),
                    Lable = table.Column<int>(type: "integer", nullable: true),
                    Moda = table.Column<int>(type: "integer", nullable: true),
                    Quantity = table.Column<int>(type: "integer", nullable: true),
                    TotalPiece = table.Column<int>(type: "integer", nullable: true),
                    Completed = table.Column<bool>(type: "boolean", nullable: false),
                    DateCompleted = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    PicturePath = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkerEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkerEntries_Colors_ColorId",
                        column: x => x.ColorId,
                        principalTable: "Colors",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_WorkerEntries_Lots_LotId",
                        column: x => x.LotId,
                        principalTable: "Lots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkerEntries_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_WorkerEntries_Sizes_SizeId",
                        column: x => x.SizeId,
                        principalTable: "Sizes",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_WorkerEntries_Workers_WorkerId",
                        column: x => x.WorkerId,
                        principalTable: "Workers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InventoryUsages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LotId = table.Column<int>(type: "integer", nullable: false),
                    BagPurchaseId = table.Column<int>(type: "integer", nullable: false),
                    QuantityUsed = table.Column<int>(type: "integer", nullable: false),
                    UsageDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryUsages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InventoryUsages_BagPurchases_BagPurchaseId",
                        column: x => x.BagPurchaseId,
                        principalTable: "BagPurchases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InventoryUsages_Lots_LotId",
                        column: x => x.LotId,
                        principalTable: "Lots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalePayments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SaleId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaymentDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    PaymentMethod = table.Column<string>(type: "text", nullable: false),
                    ReferenceNo = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalePayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalePayments_Sales_SaleId",
                        column: x => x.SaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "AccountCategories",
                columns: new[] { "Id", "CreatedAt", "Name", "Type" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 11, 19, 18, 45, 23, 45, DateTimeKind.Utc).AddTicks(2719), "Income", "Credit" },
                    { 2, new DateTime(2026, 11, 19, 18, 45, 23, 45, DateTimeKind.Utc).AddTicks(2722), "Expense", "Debit" },
                    { 3, new DateTime(2026, 11, 19, 18, 45, 23, 45, DateTimeKind.Utc).AddTicks(2724), "Asset", "Debit" },
                    { 4, new DateTime(2026, 11, 19, 18, 45, 23, 45, DateTimeKind.Utc).AddTicks(2724), "Liability", "Credit" },
                    { 5, new DateTime(2026, 11, 19, 18, 45, 23, 45, DateTimeKind.Utc).AddTicks(2725), "Cash", "Debit" }
                });

            migrationBuilder.InsertData(
                table: "Colors",
                columns: new[] { "Id", "IsActive", "Name" },
                values: new object[,]
                {
                    { 1, true, "Red" },
                    { 2, true, "Gray" },
                    { 3, true, "Falsa" },
                    { 4, true, "Black" }
                });

            migrationBuilder.InsertData(
                table: "Machines",
                columns: new[] { "Id", "IsActive", "Name" },
                values: new object[,]
                {
                    { 1, true, "G9-1" },
                    { 2, true, "G9-2" },
                    { 3, true, "G8" }
                });

            migrationBuilder.InsertData(
                table: "Roles",
                columns: new[] { "Id", "CreatedAt", "Name" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3772), "Admin" },
                    { 2, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3774), "Manager" },
                    { 3, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3774), "Viewer" }
                });

            migrationBuilder.InsertData(
                table: "Sizes",
                columns: new[] { "Id", "IsActive", "Name" },
                values: new object[,]
                {
                    { 1, true, "Mama" },
                    { 2, true, "Short" }
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "CreatedAt", "IsActive", "Name", "PasswordHash", "Role", "Username" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(4193), true, "Administrator", "admin123", "Admin", "admin" },
                    { 2, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(4196), true, "Manager", "manager123", "Manager", "manager" },
                    { 3, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(4198), true, "Viewer", "viewer123", "Viewer", "viewer" }
                });

            migrationBuilder.InsertData(
                table: "Workers",
                columns: new[] { "Id", "CreatedAt", "IsActive", "JoinDate", "Name", "PersonType", "Phone", "SheetType" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3736), true, null, "Ali Hassan", "Worker", null, "AliHassan" },
                    { 2, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3740), true, null, "Faizan", "Worker", null, "Faizan" },
                    { 3, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3741), true, null, "Gujjar Press", "Worker", null, "GujjarPress" },
                    { 4, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3742), true, null, "Arslan", "Worker", null, "Arslan" },
                    { 5, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3743), true, null, "Nazir", "Worker", null, "Nazir" },
                    { 6, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3743), true, null, "Umer Safty", "Worker", null, "UmerSafty" },
                    { 7, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3744), true, null, "Naveed Rafo", "Worker", null, "NaveedRafo" },
                    { 8, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3745), true, null, "Bhatti Kaj", "Worker", null, "BhattiKaj" },
                    { 9, new DateTime(2026, 11, 19, 18, 45, 23, 44, DateTimeKind.Utc).AddTicks(3746), true, null, "Button", "Worker", null, "Button" }
                });

            migrationBuilder.InsertData(
                table: "Accounts",
                columns: new[] { "Id", "Balance", "CategoryId", "CreatedAt", "Description", "IsActive", "Name" },
                values: new object[,]
                {
                    { 1, 0m, 5, new DateTime(2026, 11, 19, 18, 45, 23, 45, DateTimeKind.Utc).AddTicks(2754), "Main cash account", true, "Main Cash" },
                    { 2, 0m, 1, new DateTime(2026, 11, 19, 18, 45, 23, 45, DateTimeKind.Utc).AddTicks(2758), "Revenue from sales", true, "Sales Income" },
                    { 3, 0m, 2, new DateTime(2026, 11, 19, 18, 45, 23, 45, DateTimeKind.Utc).AddTicks(2760), "Labour payment expenses", true, "Labour Expense" },
                    { 4, 0m, 2, new DateTime(2026, 11, 19, 18, 45, 23, 45, DateTimeKind.Utc).AddTicks(2761), "Raw material costs", true, "Material Cost" }
                });

            migrationBuilder.InsertData(
                table: "RolePermissions",
                columns: new[] { "Id", "IsGranted", "Permission", "RoleId" },
                values: new object[,]
                {
                    { 1, true, "canViewLabour", 1 },
                    { 2, true, "canViewLabour", 2 },
                    { 3, true, "canViewLabour", 3 },
                    { 4, true, "canAddLabour", 1 },
                    { 5, true, "canAddLabour", 2 },
                    { 6, false, "canAddLabour", 3 },
                    { 7, true, "canEditLabour", 1 },
                    { 8, true, "canEditLabour", 2 },
                    { 9, false, "canEditLabour", 3 },
                    { 10, true, "canDeleteLabour", 1 },
                    { 11, false, "canDeleteLabour", 2 },
                    { 12, false, "canDeleteLabour", 3 },
                    { 13, true, "canViewWorkers", 1 },
                    { 14, true, "canViewWorkers", 2 },
                    { 15, true, "canViewWorkers", 3 },
                    { 16, true, "canAddEntry", 1 },
                    { 17, true, "canAddEntry", 2 },
                    { 18, false, "canAddEntry", 3 },
                    { 19, true, "canEditEntry", 1 },
                    { 20, true, "canEditEntry", 2 },
                    { 21, false, "canEditEntry", 3 },
                    { 22, true, "canDeleteEntry", 1 },
                    { 23, false, "canDeleteEntry", 2 },
                    { 24, false, "canDeleteEntry", 3 },
                    { 25, true, "canManageRoles", 1 },
                    { 26, false, "canManageRoles", 2 },
                    { 27, false, "canManageRoles", 3 },
                    { 28, true, "canViewReports", 1 },
                    { 29, true, "canViewReports", 2 },
                    { 30, true, "canViewReports", 3 },
                    { 31, true, "canViewAccounts", 1 },
                    { 32, false, "canViewAccounts", 2 },
                    { 33, false, "canViewAccounts", 3 },
                    { 34, true, "canAddTransaction", 1 },
                    { 35, false, "canAddTransaction", 2 },
                    { 36, false, "canAddTransaction", 3 },
                    { 37, true, "canEditTransaction", 1 },
                    { 38, false, "canEditTransaction", 2 },
                    { 39, false, "canEditTransaction", 3 },
                    { 40, true, "canDeleteTransaction", 1 },
                    { 41, false, "canDeleteTransaction", 2 },
                    { 42, false, "canDeleteTransaction", 3 },
                    { 43, true, "canManageAccounts", 1 },
                    { 44, false, "canManageAccounts", 2 },
                    { 45, false, "canManageAccounts", 3 },
                    { 46, true, "canViewSettings", 1 },
                    { 47, true, "canViewSettings", 2 },
                    { 48, true, "canViewSettings", 3 },
                    { 49, true, "canAddSettings", 1 },
                    { 50, true, "canAddSettings", 2 },
                    { 51, false, "canAddSettings", 3 },
                    { 52, true, "canEditSettings", 1 },
                    { 53, true, "canEditSettings", 2 },
                    { 54, false, "canEditSettings", 3 },
                    { 55, true, "canDeleteSettings", 1 },
                    { 56, false, "canDeleteSettings", 2 },
                    { 57, false, "canDeleteSettings", 3 },
                    { 58, true, "canViewWages", 1 },
                    { 59, true, "canViewWages", 2 },
                    { 60, true, "canViewWages", 3 },
                    { 61, true, "canManageWages", 1 },
                    { 62, false, "canManageWages", 2 },
                    { 63, false, "canManageWages", 3 },
                    { 64, true, "canRecordPayment", 1 },
                    { 65, true, "canRecordPayment", 2 },
                    { 66, false, "canRecordPayment", 3 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Accounts_CategoryId",
                table: "Accounts",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Module",
                table: "AuditLogs",
                column: "Module");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Timestamp",
                table: "AuditLogs",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_BagPurchases_SupplierId",
                table: "BagPurchases",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryUsages_BagPurchaseId",
                table: "InventoryUsages",
                column: "BagPurchaseId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryUsages_LotId",
                table: "InventoryUsages",
                column: "LotId");

            migrationBuilder.CreateIndex(
                name: "IX_Lots_SizeId",
                table: "Lots",
                column: "SizeId");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_RoleId",
                table: "RolePermissions",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_SalePayments_SaleId",
                table: "SalePayments",
                column: "SaleId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_CustomerId",
                table: "Sales",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_LotId",
                table: "Sales",
                column: "LotId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_AccountId",
                table: "Transactions",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_Date",
                table: "Transactions",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_WagePayments_WorkerId",
                table: "WagePayments",
                column: "WorkerId");

            migrationBuilder.CreateIndex(
                name: "IX_WageRates_WorkerId",
                table: "WageRates",
                column: "WorkerId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkerAdvances_WorkerId",
                table: "WorkerAdvances",
                column: "WorkerId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkerEntries_ColorId",
                table: "WorkerEntries",
                column: "ColorId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkerEntries_LotId",
                table: "WorkerEntries",
                column: "LotId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkerEntries_MachineId",
                table: "WorkerEntries",
                column: "MachineId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkerEntries_SizeId",
                table: "WorkerEntries",
                column: "SizeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkerEntries_WorkerId",
                table: "WorkerEntries",
                column: "WorkerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "BagTypes");

            migrationBuilder.DropTable(
                name: "InventoryUsages");

            migrationBuilder.DropTable(
                name: "LotStages");

            migrationBuilder.DropTable(
                name: "Materials");

            migrationBuilder.DropTable(
                name: "RolePermissions");

            migrationBuilder.DropTable(
                name: "SalePayments");

            migrationBuilder.DropTable(
                name: "TaskTypes");

            migrationBuilder.DropTable(
                name: "Transactions");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "WagePayments");

            migrationBuilder.DropTable(
                name: "WageRates");

            migrationBuilder.DropTable(
                name: "WorkerAdvances");

            migrationBuilder.DropTable(
                name: "WorkerEntries");

            migrationBuilder.DropTable(
                name: "WorkerRoles");

            migrationBuilder.DropTable(
                name: "BagPurchases");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropTable(
                name: "Sales");

            migrationBuilder.DropTable(
                name: "Accounts");

            migrationBuilder.DropTable(
                name: "Colors");

            migrationBuilder.DropTable(
                name: "Machines");

            migrationBuilder.DropTable(
                name: "Workers");

            migrationBuilder.DropTable(
                name: "Suppliers");

            migrationBuilder.DropTable(
                name: "Customers");

            migrationBuilder.DropTable(
                name: "Lots");

            migrationBuilder.DropTable(
                name: "AccountCategories");

            migrationBuilder.DropTable(
                name: "Sizes");
        }
    }
}
