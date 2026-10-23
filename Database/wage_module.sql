-- =============================================
-- Wage Module Migration
-- Run this against your ClothingManagerDB
-- =============================================

USE ClothingManagerDB;
GO

-- ── WageRates ────────────────────────────────────────────────────────────
-- Stores the rate-per-piece for each task type per worker

CREATE TABLE WageRates (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    WorkerId     INT           NOT NULL REFERENCES Workers(Id),
    TaskType     NVARCHAR(50)  NOT NULL,   -- Front, Bazo, Tape, Pocket, Gala, Lable, Moda, Quantity, TotalPiece
    RatePerPiece DECIMAL(18,2) NOT NULL DEFAULT 0,
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedAt    DATETIME      NOT NULL DEFAULT GETDATE(),

    CONSTRAINT UQ_WageRates_WorkerTask UNIQUE (WorkerId, TaskType)
);

-- ── WagePayments ─────────────────────────────────────────────────────────
-- Records actual wage disbursements

CREATE TABLE WagePayments (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    WorkerId    INT           NOT NULL REFERENCES Workers(Id),
    GrossAmount DECIMAL(18,2) NOT NULL,
    Deductions  DECIMAL(18,2) NOT NULL DEFAULT 0,
    NetAmount   DECIMAL(18,2) NOT NULL,
    Notes       NVARCHAR(500)     NULL,
    PeriodFrom  DATETIME      NOT NULL,
    PeriodTo    DATETIME      NOT NULL,
    PaidAt      DATETIME      NOT NULL DEFAULT GETDATE(),
    CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- ── Helpful view ─────────────────────────────────────────────────────────

CREATE VIEW vw_WagePayments AS
SELECT
    wp.Id,
    w.Name        AS WorkerName,
    wp.GrossAmount,
    wp.Deductions,
    wp.NetAmount,
    wp.Notes,
    wp.PeriodFrom,
    wp.PeriodTo,
    wp.PaidAt,
    wp.CreatedAt
FROM WagePayments wp
JOIN Workers w ON wp.WorkerId = w.Id;
GO

PRINT 'Wage module tables created successfully.';
