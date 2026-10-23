namespace ClothingManager.Models;

public class Worker
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string SheetType { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string PersonType { get; set; } = "Worker"; // "Worker" | "Management"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<WorkerEntry> Entries { get; set; } = new List<WorkerEntry>();
}

public class Lot
{
    public int Id { get; set; }
    public string LotNumber { get; set; } = string.Empty;
    public int? SizeId { get; set; }
    public Size? Size { get; set; }
    public string? Material { get; set; }
    public string Status { get; set; } = "Stitching";
    public string? PicturePath { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<WorkerEntry> Entries { get; set; } = new List<WorkerEntry>();
}

public class Size
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class Color
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class Machine
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class WorkerEntry
{
    public int Id { get; set; }

    public int WorkerId { get; set; }
    public Worker Worker { get; set; } = null!;

    public int LotId { get; set; }
    public Lot Lot { get; set; } = null!;

    public int? SizeId { get; set; }
    public Size? Size { get; set; }

    public int? ColorId { get; set; }
    public Color? Color { get; set; }

    public int? MachineId { get; set; }
    public Machine? Machine { get; set; }

    // Work columns
    public int? Front { get; set; }
    public int? Bazo { get; set; }
    public int? Tape { get; set; }
    public int? Pocket { get; set; }
    public int? Gala { get; set; }
    public int? Lable { get; set; }
    public int? Moda { get; set; }
    public int? Quantity { get; set; }
    public int? TotalPiece { get; set; }

    public bool Completed { get; set; } = false;
    public DateTime? DateCompleted { get; set; }
    public string? PicturePath { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty; // Admin, Manager, Viewer
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Role
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // Admin, Manager, Viewer
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<RolePermission> Permissions { get; set; } = new List<RolePermission>();
}

public class RolePermission
{
    public int Id { get; set; }
    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public string Permission { get; set; } = string.Empty; // e.g. canViewLabour
    public bool IsGranted { get; set; } = true;
}

// =============================================
// Wage Module Models
// =============================================

public class WageRate
{
    public int Id { get; set; }
    public int WorkerId { get; set; }
    public Worker Worker { get; set; } = null!;
    public string TaskType { get; set; } = string.Empty; // e.g. Front, Bazo, Tape ...
    public decimal RatePerPiece { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class WagePayment
{
    public int Id { get; set; }
    public int WorkerId { get; set; }
    public Worker Worker { get; set; } = null!;
    public decimal GrossAmount { get; set; }
    public decimal Deductions { get; set; } = 0;
    public decimal NetAmount { get; set; }
    public string? Notes { get; set; }
    public DateTime PeriodFrom { get; set; }
    public DateTime PeriodTo { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class WorkerAdvance
{
    public int Id { get; set; }
    public int WorkerId { get; set; }
    public Worker Worker { get; set; } = null!;
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
    public DateTime AdvanceDate { get; set; } = DateTime.UtcNow;
    public bool IsSettled { get; set; } = false;
    public DateTime? SettledAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// =============================================
// Purchasing Module Models
// =============================================

public class Supplier
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<BagPurchase> Purchases { get; set; } = new List<BagPurchase>();
}

public class BagPurchase
{
    public int Id { get; set; }
    public string BagNumber { get; set; } = string.Empty;
    public string Material { get; set; } = string.Empty;
    public string BagType { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public DateTime PurchaseDate { get; set; }
    public decimal? UnitPrice { get; set; }
    public int? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<InventoryUsage> Usages { get; set; } = new List<InventoryUsage>();
}

public class InventoryUsage
{
    public int Id { get; set; }
    public int LotId { get; set; }
    public Lot Lot { get; set; } = null!;
    public int BagPurchaseId { get; set; }
    public BagPurchase BagPurchase { get; set; } = null!;
    public int QuantityUsed { get; set; } = 1;
    public DateTime UsageDate { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// =============================================
// Sales Module Models
// =============================================

public class Sale
{
    public int Id { get; set; }
    public int LotId { get; set; }
    public Lot Lot { get; set; } = null!;
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public DateTime SaleDate { get; set; }
    public int TotalPieces { get; set; }
    public decimal RatePerPiece { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal Discount { get; set; } = 0;
    public decimal NetAmount { get; set; }
    public string Status { get; set; } = "Pending"; // Pending, Partial, Paid
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<SalePayment> Payments { get; set; } = new List<SalePayment>();
}

public class SalePayment
{
    public int Id { get; set; }
    public int SaleId { get; set; }
    public Sale Sale { get; set; } = null!;
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string PaymentMethod { get; set; } = "Cash"; // Cash, Bank Transfer, Cheque
    public string? ReferenceNo { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// =============================================
// Customer Module Models
// =============================================

public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// =============================================
// Audit Log Model
// =============================================

public class AuditLog
{
    public int      Id            { get; set; }
    public int?     UserId        { get; set; }
    public string   UserName      { get; set; } = string.Empty;
    public string   Action        { get; set; } = string.Empty;   // Create | Update | Delete | Toggle
    public string   Module        { get; set; } = string.Empty;
    public string   EntityType    { get; set; } = string.Empty;
    public int?     EntityId      { get; set; }
    public string?  EntityName    { get; set; }
    public string?  ChangeSummary { get; set; }  // JSON [{Field, OldValue, NewValue}]
    public DateTime Timestamp     { get; set; } = DateTime.UtcNow;
}

// =============================================
// Accounts Module Models
// =============================================

public class AccountCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // e.g. Income, Expense, Asset, Liability
    public string Type { get; set; } = string.Empty; // Credit / Debit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Account
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public AccountCategory Category { get; set; } = null!;
    public decimal Balance { get; set; } = 0;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}

public class Transaction
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public Account Account { get; set; } = null!;
    public string Type { get; set; } = string.Empty; // Credit / Debit
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? ReferenceNo { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
