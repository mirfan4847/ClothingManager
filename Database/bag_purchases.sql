-- =============================================
-- Bag Purchases Table
-- Run this against ClothingManagerDB
-- =============================================

USE ClothingManagerDB;
GO

CREATE TABLE BagPurchases (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    BagNumber   NVARCHAR(50)   NOT NULL,
    Material    NVARCHAR(100)  NOT NULL,
    BagType     NVARCHAR(50)   NOT NULL,
    Quantity    INT            NOT NULL DEFAULT 1,
    PurchaseDate DATE          NOT NULL,
    UnitPrice   DECIMAL(18,2)  NULL,
    Supplier    NVARCHAR(200)  NULL,
    Notes       NVARCHAR(500)  NULL,
    CreatedAt   DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE INDEX IX_BagPurchases_Material  ON BagPurchases(Material);
CREATE INDEX IX_BagPurchases_BagNumber ON BagPurchases(BagNumber);
GO

PRINT 'BagPurchases table created successfully.';
GO
