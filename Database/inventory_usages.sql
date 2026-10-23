-- =============================================
-- Inventory Usages Table
-- Run this against ClothingManagerDB
-- =============================================

USE ClothingManagerDB;
GO

CREATE TABLE InventoryUsages (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    LotId         INT           NOT NULL REFERENCES Lots(Id),
    BagPurchaseId INT           NOT NULL REFERENCES BagPurchases(Id),
    QuantityUsed  INT           NOT NULL DEFAULT 1,
    UsageDate     DATE          NOT NULL,
    Notes         NVARCHAR(500) NULL,
    CreatedAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE INDEX IX_InventoryUsages_LotId         ON InventoryUsages(LotId);
CREATE INDEX IX_InventoryUsages_BagPurchaseId ON InventoryUsages(BagPurchaseId);
GO

PRINT 'InventoryUsages table created successfully.';
GO
