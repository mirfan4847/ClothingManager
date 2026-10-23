-- =============================================
-- Worker Advances Migration
-- Run this against your ClothingManagerDB
-- =============================================

USE ClothingManagerDB;
GO

CREATE TABLE WorkerAdvances (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    WorkerId    INT           NOT NULL REFERENCES Workers(Id),
    Amount      DECIMAL(18,2) NOT NULL,
    Notes       NVARCHAR(500)     NULL,
    AdvanceDate DATETIME      NOT NULL DEFAULT GETDATE(),
    IsSettled   BIT           NOT NULL DEFAULT 0,
    SettledAt   DATETIME          NULL,
    CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX IX_WorkerAdvances_WorkerId ON WorkerAdvances(WorkerId);
GO

PRINT 'WorkerAdvances table created successfully.';
GO
