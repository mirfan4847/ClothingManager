-- =============================================
-- Lot Material Column Migration
-- Run this against ClothingManagerDB
-- =============================================

USE ClothingManagerDB;
GO

ALTER TABLE Lots ADD Material NVARCHAR(100) NULL;
GO

CREATE INDEX IX_Lots_Material ON Lots(Material);
GO

PRINT 'Material column added to Lots table successfully.';
GO
