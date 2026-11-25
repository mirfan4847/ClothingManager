-- =============================================
-- ClothingManagerDB - SQL Server Performance Indexes
-- Safe to run multiple times (idempotent)
-- =============================================
USE ClothingManagerDB;
GO

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
GO

PRINT 'All SQL Server performance indexes verified successfully.';
GO
