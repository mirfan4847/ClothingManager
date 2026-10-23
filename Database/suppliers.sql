-- =============================================
-- Suppliers Table + BagPurchases FK Migration
-- Run this against ClothingManagerDB
-- =============================================

USE ClothingManagerDB;
GO

CREATE TABLE Suppliers (
    Id        INT IDENTITY(1,1) PRIMARY KEY,
    Name      NVARCHAR(200) NOT NULL,
    Phone     NVARCHAR(50)  NULL,
    Address   NVARCHAR(500) NULL,
    Notes     NVARCHAR(500) NULL,
    IsActive  BIT           NOT NULL DEFAULT 1,
    CreatedAt DATETIME2     NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE INDEX IX_Suppliers_Name ON Suppliers(Name);
GO

-- Replace free-text Supplier column with FK
ALTER TABLE BagPurchases ADD SupplierId INT NULL;
GO

ALTER TABLE BagPurchases
    ADD CONSTRAINT FK_BagPurchases_Suppliers FOREIGN KEY (SupplierId) REFERENCES Suppliers(Id);
GO

ALTER TABLE BagPurchases DROP COLUMN Supplier;
GO

PRINT 'Suppliers table created and BagPurchases updated successfully.';
GO
