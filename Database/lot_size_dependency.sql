-- =============================================
-- Lot ↔ Size Dependency Migration
-- Run this against ClothingManagerDB
-- =============================================

USE ClothingManagerDB;
GO

ALTER TABLE Lots ADD SizeId INT NULL REFERENCES Sizes(Id);
GO

CREATE INDEX IX_Lots_SizeId ON Lots(SizeId);
GO

PRINT 'SizeId column added to Lots table successfully.';
GO
