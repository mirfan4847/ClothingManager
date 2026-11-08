namespace ClothingManager.DTOs;

public class WorkerEntryDto
{
    public int Id { get; set; }
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public string SheetType { get; set; } = string.Empty;
    public int LotId { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public string? LotMaterial { get; set; }
    public string? LotPicturePath { get; set; }
    public int? SizeId { get; set; }
    public string? Size { get; set; }
    public int? ColorId { get; set; }
    public string? Color { get; set; }
    public int? MachineId { get; set; }
    public string? Machine { get; set; }
    public int? Front { get; set; }
    public int? Bazo { get; set; }
    public int? Tape { get; set; }
    public int? Pocket { get; set; }
    public int? Gala { get; set; }
    public int? Lable { get; set; }
    public int? Moda { get; set; }
    public int? Quantity { get; set; }
    public int? TotalPiece { get; set; }
    public bool Completed { get; set; }
    public DateTime? DateCompleted { get; set; }
    public string? PicturePath { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class WorkerEntryCreateDto
{
    public int WorkerId { get; set; }
    public int LotId { get; set; }
    public int? SizeId { get; set; }
    public int? ColorId { get; set; }
    public int? MachineId { get; set; }
    public int? Front { get; set; }
    public int? Bazo { get; set; }
    public int? Tape { get; set; }
    public int? Pocket { get; set; }
    public int? Gala { get; set; }
    public int? Lable { get; set; }
    public int? Moda { get; set; }
    public int? Quantity { get; set; }
    public int? TotalPiece { get; set; }
    public bool Completed { get; set; }
    public DateTime? DateCompleted { get; set; }
}

public class LotDto
{
    public int Id { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public int? SizeId { get; set; }
    public string? SizeName { get; set; }
    public string? Material { get; set; }
    public string Status { get; set; } = "Stitching";
    public string? PicturePath { get; set; }
    public bool IsActive { get; set; } = true;
}

public class LotCreateDto
{
    public string LotNumber { get; set; } = string.Empty;
    public int? SizeId { get; set; }
    public string? Material { get; set; }
    public string? Status { get; set; }
    public bool? IsActive { get; set; }
}

public class LotStatusUpdateDto
{
    public string Status { get; set; } = string.Empty;
}

public class DropdownDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class LoginRequestDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public Dictionary<string, bool> Permissions { get; set; } = new();
}

public class UserDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateUserDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

public class ChangePasswordDto
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class RolePermissionDto
{
    public string Role { get; set; } = string.Empty;
    public Dictionary<string, bool> Permissions { get; set; } = new();
}

// =============================================
// Wage Module DTOs
// =============================================

public class WageRateDto
{
    public int Id { get; set; }
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public string TaskType { get; set; } = string.Empty;
    public decimal RatePerPiece { get; set; }
    public bool IsActive { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class WageRateCreateDto
{
    public int WorkerId { get; set; }
    public string TaskType { get; set; } = string.Empty;
    public decimal RatePerPiece { get; set; }
}

public class WageCalculationResultDto
{
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public string? WorkerPhone { get; set; }
    public DateTime PeriodFrom { get; set; }
    public DateTime PeriodTo { get; set; }
    public decimal GrossAmount { get; set; }
    public List<WageBreakdownItemDto> Breakdown { get; set; } = new();
}

public class WageBreakdownItemDto
{
    public string TaskType { get; set; } = string.Empty;
    public int TotalPieces { get; set; }
    public decimal RatePerPiece { get; set; }
    public decimal Amount { get; set; }
}

public class WagePaymentDto
{
    public int Id { get; set; }
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public string? WorkerPhone { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal Deductions { get; set; }
    public decimal NetAmount { get; set; }
    public string? Notes { get; set; }
    public DateTime PeriodFrom { get; set; }
    public DateTime PeriodTo { get; set; }
    public DateTime PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class WagePaymentCreateDto
{
    public int WorkerId { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal Deductions { get; set; } = 0;
    public decimal NetAmount { get; set; }
    public string? Notes { get; set; }
    public DateTime PeriodFrom { get; set; }
    public DateTime PeriodTo { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
    public int? AccountId { get; set; } // if set, auto-creates a Finance Debit transaction
}

public class WageSummaryDto
{
    public decimal TotalPaid { get; set; }
    public decimal TotalDeductions { get; set; }
    public decimal TotalNet { get; set; }
    public int TotalPayments { get; set; }
    public decimal TotalOutstandingAdvances { get; set; }
    public List<WagePaymentDto> RecentPayments { get; set; } = new();
}

public class WorkerAdvanceDto
{
    public int Id { get; set; }
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public string? WorkerPhone { get; set; }
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
    public DateTime AdvanceDate { get; set; }
    public bool IsSettled { get; set; }
    public DateTime? SettledAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class WorkerAdvanceCreateDto
{
    public int WorkerId { get; set; }
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
    public DateTime AdvanceDate { get; set; } = DateTime.UtcNow;
}

public class WorkerAdvanceBalanceDto
{
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = string.Empty;
    public decimal TotalAdvanced { get; set; }
    public decimal PendingBalance { get; set; }
    public List<WorkerAdvanceDto> UnsettledAdvances { get; set; } = new();
}

public class AllWorkersWageDto
{
    public DateTime PeriodFrom { get; set; }
    public DateTime PeriodTo { get; set; }
    public decimal TotalGross { get; set; }
    public int WorkerCount { get; set; }
    public List<WageCalculationResultDto> Workers { get; set; } = new();
}

// =============================================
// Accounts DTOs
// =============================================

public class AccountCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
}

public class AccountDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string CategoryType { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AccountCreateDto
{
    public string Name { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public decimal OpeningBalance { get; set; } = 0;
    public string? Description { get; set; }
}

public class TransactionDto
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? ReferenceNo { get; set; }
    public DateTime Date { get; set; }
    public decimal RunningBalance { get; set; }
}

public class TransactionCreateDto
{
    public int AccountId { get; set; }
    public string Type { get; set; } = string.Empty; // Credit / Debit
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? ReferenceNo { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
}

public class AccountSummaryDto
{
    public decimal TotalIncome { get; set; }
    public decimal TotalExpense { get; set; }
    public decimal NetBalance { get; set; }
    public decimal TotalAssets { get; set; }
    public decimal TotalLiabilities { get; set; }
    public List<AccountDto> Accounts { get; set; } = new();
}

// =============================================
// Sales DTOs
// =============================================

public class SaleDto
{
    public int Id { get; set; }
    public int LotId { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public string? SizeName { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public DateTime SaleDate { get; set; }
    public int TotalPieces { get; set; }
    public decimal RatePerPiece { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal Discount { get; set; }
    public decimal NetAmount { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal BalanceDue { get; set; }
    public string Status { get; set; } = "Pending";
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<SalePaymentDto> Payments { get; set; } = new();
}

public class SaleCreateDto
{
    public int LotId { get; set; }
    public int CustomerId { get; set; }
    public DateTime SaleDate { get; set; }
    public int TotalPieces { get; set; }
    public decimal RatePerPiece { get; set; }
    public decimal Discount { get; set; } = 0;
    public string? Notes { get; set; }
}

public class SalePaymentDto
{
    public int Id { get; set; }
    public int SaleId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? ReferenceNo { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SalePaymentCreateDto
{
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
    public string PaymentMethod { get; set; } = "Cash";
    public string? ReferenceNo { get; set; }
    public string? Notes { get; set; }
    public int? AccountId { get; set; } // if set, auto-creates a Finance Credit transaction
}

public class SaleSummaryDto
{
    public int TotalSales { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalBalance { get; set; }
    public int PendingCount { get; set; }
    public int PartialCount { get; set; }
    public int PaidCount { get; set; }
}

// =============================================
// Customer DTOs
// =============================================

public class CustomerDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CustomerCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
}

// =============================================
// Purchasing DTOs
// =============================================

public class SupplierDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public int PurchaseCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SupplierCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
}

public class BagPurchaseDto
{
    public int Id { get; set; }
    public string BagNumber { get; set; } = string.Empty;
    public string Material { get; set; } = string.Empty;
    public string BagType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public DateTime PurchaseDate { get; set; }
    public decimal? UnitPrice { get; set; }
    public decimal? TotalAmount { get; set; }
    public int? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BagPurchaseCreateDto
{
    public string BagNumber { get; set; } = string.Empty;
    public string Material { get; set; } = string.Empty;
    public string BagType { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public DateTime PurchaseDate { get; set; }
    public decimal? UnitPrice { get; set; }
    public int? SupplierId { get; set; }
    public string? Notes { get; set; }
}

public class PurchaseSummaryDto
{
    public int TotalBags { get; set; }
    public decimal TotalValue { get; set; }
    public int TotalRecords { get; set; }
    public List<MaterialSummaryDto> ByMaterial { get; set; } = new();
}

public class MaterialSummaryDto
{
    public string Material { get; set; } = string.Empty;
    public int TotalBags { get; set; }
    public int Records { get; set; }
    public List<BagNumberInfoDto> BagNumbers { get; set; } = new();
}

public class BagNumberInfoDto
{
    public string BagNumber { get; set; } = string.Empty;
    public string BagType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public DateTime PurchaseDate { get; set; }
}

// =============================================
// Inventory DTOs
// =============================================

public class InventoryUsageDto
{
    public int Id { get; set; }
    public int LotId { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public string? SizeName { get; set; }
    public int BagPurchaseId { get; set; }
    public string BagNumber { get; set; } = string.Empty;
    public string Material { get; set; } = string.Empty;
    public string BagType { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    public int QuantityUsed { get; set; }
    public DateTime UsageDate { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class InventoryUsageCreateDto
{
    public int LotId { get; set; }
    public int BagPurchaseId { get; set; }
    public int QuantityUsed { get; set; }
    public DateTime UsageDate { get; set; }
    public string? Notes { get; set; }
}

public class BagStockDto
{
    public int BagPurchaseId { get; set; }
    public string BagNumber { get; set; } = string.Empty;
    public string Material { get; set; } = string.Empty;
    public string BagType { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    public DateTime PurchaseDate { get; set; }
    public int TotalPurchased { get; set; }
    public int TotalUsed { get; set; }
    public int RemainingStock { get; set; }
}

public class LotUsageSummaryDto
{
    public int LotId { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public string? SizeName { get; set; }
    public int TotalBagsUsed { get; set; }
    public List<InventoryUsageDto> Usages { get; set; } = new();
}

public class InventorySummaryDto
{
    public int TotalBagTypes { get; set; }
    public int TotalPurchased { get; set; }
    public int TotalUsed { get; set; }
    public int TotalRemaining { get; set; }
    public int LowStockCount { get; set; }
    public int OutOfStockCount { get; set; }
}
