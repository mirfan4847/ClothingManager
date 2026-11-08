using Microsoft.EntityFrameworkCore;
using ClothingManager.Models;
using System.Security.Cryptography;
using System.Text;

namespace ClothingManager.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Worker> Workers => Set<Worker>();
    public DbSet<Lot> Lots => Set<Lot>();
    public DbSet<Size> Sizes => Set<Size>();
    public DbSet<Color> Colors => Set<Color>();
    public DbSet<Machine> Machines => Set<Machine>();
    public DbSet<TaskTypeItem> TaskTypes => Set<TaskTypeItem>();
    public DbSet<MaterialItem> Materials => Set<MaterialItem>();
    public DbSet<BagTypeItem> BagTypes => Set<BagTypeItem>();
    public DbSet<WorkerRoleItem> WorkerRoles => Set<WorkerRoleItem>();
    public DbSet<LotStageItem> LotStages => Set<LotStageItem>();
    public DbSet<WorkerEntry> WorkerEntries => Set<WorkerEntry>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<WageRate> WageRates => Set<WageRate>();
    public DbSet<WagePayment> WagePayments => Set<WagePayment>();
    public DbSet<WorkerAdvance> WorkerAdvances => Set<WorkerAdvance>();
    public DbSet<AccountCategory> AccountCategories => Set<AccountCategory>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SalePayment> SalePayments => Set<SalePayment>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<BagPurchase> BagPurchases => Set<BagPurchase>();
    public DbSet<InventoryUsage> InventoryUsages => Set<InventoryUsage>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Lot → Size relationship
        modelBuilder.Entity<Lot>()
            .HasOne(l => l.Size).WithMany().HasForeignKey(l => l.SizeId).IsRequired(false);

        // WorkerEntry relationships
        modelBuilder.Entity<WorkerEntry>()
            .HasOne(e => e.Worker).WithMany(w => w.Entries).HasForeignKey(e => e.WorkerId);
        modelBuilder.Entity<WorkerEntry>()
            .HasOne(e => e.Lot).WithMany(l => l.Entries).HasForeignKey(e => e.LotId);
        modelBuilder.Entity<WorkerEntry>()
            .HasOne(e => e.Size).WithMany().HasForeignKey(e => e.SizeId).IsRequired(false);
        modelBuilder.Entity<WorkerEntry>()
            .HasOne(e => e.Color).WithMany().HasForeignKey(e => e.ColorId).IsRequired(false);
        modelBuilder.Entity<WorkerEntry>()
            .HasOne(e => e.Machine).WithMany().HasForeignKey(e => e.MachineId).IsRequired(false);

        // RolePermission
        modelBuilder.Entity<RolePermission>()
            .HasOne(rp => rp.Role).WithMany(r => r.Permissions).HasForeignKey(rp => rp.RoleId);

        // Account relationships
        modelBuilder.Entity<Account>()
            .HasOne(a => a.Category).WithMany().HasForeignKey(a => a.CategoryId);
        modelBuilder.Entity<Transaction>()
            .HasOne(t => t.Account).WithMany(a => a.Transactions).HasForeignKey(t => t.AccountId);
        modelBuilder.Entity<Account>().Property(a => a.Balance).HasPrecision(18, 2);
        modelBuilder.Entity<Transaction>().Property(t => t.Amount).HasPrecision(18, 2);

        // ── Seed Sizes ──
        modelBuilder.Entity<Size>().HasData(
            new Size { Id = 1, Name = "Mama" }, new Size { Id = 2, Name = "Short" });

        // ── Seed Colors ──
        modelBuilder.Entity<Color>().HasData(
            new Color { Id = 1, Name = "Red" }, new Color { Id = 2, Name = "Gray" },
            new Color { Id = 3, Name = "Falsa" }, new Color { Id = 4, Name = "Black" });

        // ── Seed Machines ──
        modelBuilder.Entity<Machine>().HasData(
            new Machine { Id = 1, Name = "G9-1" }, new Machine { Id = 2, Name = "G9-2" },
            new Machine { Id = 3, Name = "G8" });

        // ── Seed Workers ──
        modelBuilder.Entity<Worker>().HasData(
            new Worker { Id = 1, Name = "Ali Hassan",   SheetType = "AliHassan" },
            new Worker { Id = 2, Name = "Faizan",       SheetType = "Faizan" },
            new Worker { Id = 3, Name = "Gujjar Press", SheetType = "GujjarPress" },
            new Worker { Id = 4, Name = "Arslan",       SheetType = "Arslan" },
            new Worker { Id = 5, Name = "Nazir",        SheetType = "Nazir" },
            new Worker { Id = 6, Name = "Umer Safty",   SheetType = "UmerSafty" },
            new Worker { Id = 7, Name = "Naveed Rafo",  SheetType = "NaveedRafo" },
            new Worker { Id = 8, Name = "Bhatti Kaj",   SheetType = "BhattiKaj" },
            new Worker { Id = 9, Name = "Button",       SheetType = "Button" });

        // ── Seed Roles ──
        modelBuilder.Entity<Role>().HasData(
            new Role { Id = 1, Name = "Admin" },
            new Role { Id = 2, Name = "Manager" },
            new Role { Id = 3, Name = "Viewer" });

        // ── Seed Role Permissions ──
        // Admin=all true | Manager=no delete/accounts | Viewer=view only, no accounts
        var permMatrix = new Dictionary<string, (bool admin, bool manager, bool viewer)>
        {
            ["canViewLabour"]        = (true,  true,  true),
            ["canAddLabour"]         = (true,  true,  false),
            ["canEditLabour"]        = (true,  true,  false),
            ["canDeleteLabour"]      = (true,  false, false),
            ["canViewWorkers"]       = (true,  true,  true),
            ["canAddEntry"]          = (true,  true,  false),
            ["canEditEntry"]         = (true,  true,  false),
            ["canDeleteEntry"]       = (true,  false, false),
            ["canManageRoles"]       = (true,  false, false),
            ["canViewReports"]       = (true,  true,  true),
            ["canViewAccounts"]      = (true,  false, false),
            ["canAddTransaction"]    = (true,  false, false),
            ["canEditTransaction"]   = (true,  false, false),
            ["canDeleteTransaction"] = (true,  false, false),
            ["canManageAccounts"]    = (true,  false, false),
            ["canViewSettings"]      = (true,  true,  true),
            ["canAddSettings"]       = (true,  true,  false),
            ["canEditSettings"]      = (true,  true,  false),
            ["canDeleteSettings"]    = (true,  false, false),
            ["canViewWages"]         = (true,  true,  true),
            ["canManageWages"]       = (true,  false, false),
            ["canRecordPayment"]     = (true,  true,  false),
        };

        int permId = 1;
        foreach (var (perm, (admin, manager, viewer)) in permMatrix)
        {
            modelBuilder.Entity<RolePermission>().HasData(
                new RolePermission { Id = permId++, RoleId = 1, Permission = perm, IsGranted = admin },
                new RolePermission { Id = permId++, RoleId = 2, Permission = perm, IsGranted = manager },
                new RolePermission { Id = permId++, RoleId = 3, Permission = perm, IsGranted = viewer });
        }

        // ── Seed Users ──
        modelBuilder.Entity<User>().HasData(
            new User { Id = 1, Username = "admin",   PasswordHash = "admin123",   Name = "Administrator", Role = "Admin",   IsActive = true },
            new User { Id = 2, Username = "manager", PasswordHash = "manager123", Name = "Manager",       Role = "Manager", IsActive = true },
            new User { Id = 3, Username = "viewer",  PasswordHash = "viewer123",  Name = "Viewer",        Role = "Viewer",  IsActive = true });

        modelBuilder.Entity<WageRate>()
            .HasOne(wr => wr.Worker).WithMany().HasForeignKey(wr => wr.WorkerId);
        modelBuilder.Entity<WageRate>().Property(wr => wr.RatePerPiece).HasPrecision(18, 2);

        modelBuilder.Entity<WagePayment>()
            .HasOne(wp => wp.Worker).WithMany().HasForeignKey(wp => wp.WorkerId);
        modelBuilder.Entity<WagePayment>().Property(wp => wp.GrossAmount).HasPrecision(18, 2);
        modelBuilder.Entity<WagePayment>().Property(wp => wp.Deductions).HasPrecision(18, 2);
        modelBuilder.Entity<WagePayment>().Property(wp => wp.NetAmount).HasPrecision(18, 2);

        modelBuilder.Entity<WorkerAdvance>()
            .HasOne(wa => wa.Worker).WithMany().HasForeignKey(wa => wa.WorkerId);
        modelBuilder.Entity<WorkerAdvance>().Property(wa => wa.Amount).HasPrecision(18, 2);

        modelBuilder.Entity<BagPurchase>().Property(bp => bp.UnitPrice).HasPrecision(18, 2);
        modelBuilder.Entity<BagPurchase>()
            .HasOne(bp => bp.Supplier).WithMany(s => s.Purchases).HasForeignKey(bp => bp.SupplierId).IsRequired(false);

        modelBuilder.Entity<InventoryUsage>()
            .HasOne(u => u.Lot).WithMany().HasForeignKey(u => u.LotId);
        modelBuilder.Entity<InventoryUsage>()
            .HasOne(u => u.BagPurchase).WithMany(bp => bp.Usages).HasForeignKey(u => u.BagPurchaseId);

        modelBuilder.Entity<Sale>()
            .HasOne(s => s.Lot).WithMany().HasForeignKey(s => s.LotId);
        modelBuilder.Entity<Sale>()
            .HasOne(s => s.Customer).WithMany().HasForeignKey(s => s.CustomerId);
        modelBuilder.Entity<Sale>().Property(s => s.RatePerPiece).HasPrecision(18, 2);
        modelBuilder.Entity<Sale>().Property(s => s.TotalAmount).HasPrecision(18, 2);
        modelBuilder.Entity<Sale>().Property(s => s.Discount).HasPrecision(18, 2);
        modelBuilder.Entity<Sale>().Property(s => s.NetAmount).HasPrecision(18, 2);

        modelBuilder.Entity<SalePayment>()
            .HasOne(sp => sp.Sale).WithMany(s => s.Payments).HasForeignKey(sp => sp.SaleId);
        modelBuilder.Entity<SalePayment>().Property(sp => sp.Amount).HasPrecision(18, 2);

        // ── Seed Account Categories ──
        modelBuilder.Entity<AccountCategory>().HasData(
            new AccountCategory { Id = 1, Name = "Income",    Type = "Credit" },
            new AccountCategory { Id = 2, Name = "Expense",   Type = "Debit"  },
            new AccountCategory { Id = 3, Name = "Asset",     Type = "Debit"  },
            new AccountCategory { Id = 4, Name = "Liability", Type = "Credit" },
            new AccountCategory { Id = 5, Name = "Cash",      Type = "Debit"  });

        // ── Seed Sample Accounts ──
        modelBuilder.Entity<Account>().HasData(
            new Account { Id = 1, Name = "Main Cash",       CategoryId = 5, Balance = 0, Description = "Main cash account",       IsActive = true },
            new Account { Id = 2, Name = "Sales Income",    CategoryId = 1, Balance = 0, Description = "Revenue from sales",      IsActive = true },
            new Account { Id = 3, Name = "Labour Expense",  CategoryId = 2, Balance = 0, Description = "Labour payment expenses", IsActive = true },
            new Account { Id = 4, Name = "Material Cost",   CategoryId = 2, Balance = 0, Description = "Raw material costs",      IsActive = true });
    }

    public static string HashPassword(string password)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(password + "ClothingManagerSalt"));
        return Convert.ToBase64String(bytes);
    }
}
