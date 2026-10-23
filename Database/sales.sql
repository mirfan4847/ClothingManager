-- Sales table
CREATE TABLE Sales (
    Id           INT            IDENTITY(1,1) PRIMARY KEY,
    LotId        INT            NOT NULL REFERENCES Lots(Id),
    CustomerId   INT            NOT NULL REFERENCES Customers(Id),
    SaleDate     DATETIME2      NOT NULL,
    TotalPieces  INT            NOT NULL DEFAULT 0,
    RatePerPiece DECIMAL(18,2)  NOT NULL DEFAULT 0,
    TotalAmount  DECIMAL(18,2)  NOT NULL DEFAULT 0,
    Discount     DECIMAL(18,2)  NOT NULL DEFAULT 0,
    NetAmount    DECIMAL(18,2)  NOT NULL DEFAULT 0,
    Status       NVARCHAR(20)   NOT NULL DEFAULT 'Pending',  -- Pending, Partial, Paid
    Notes        NVARCHAR(1000) NULL,
    CreatedAt    DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Sales_LotId      ON Sales(LotId);
CREATE INDEX IX_Sales_CustomerId ON Sales(CustomerId);
CREATE INDEX IX_Sales_SaleDate   ON Sales(SaleDate);
CREATE INDEX IX_Sales_Status     ON Sales(Status);

-- Sale Payments table
CREATE TABLE SalePayments (
    Id            INT            IDENTITY(1,1) PRIMARY KEY,
    SaleId        INT            NOT NULL REFERENCES Sales(Id),
    Amount        DECIMAL(18,2)  NOT NULL,
    PaymentDate   DATETIME2      NOT NULL,
    PaymentMethod NVARCHAR(50)   NOT NULL DEFAULT 'Cash',  -- Cash, Bank Transfer, Cheque
    ReferenceNo   NVARCHAR(100)  NULL,
    Notes         NVARCHAR(500)  NULL,
    CreatedAt     DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_SalePayments_SaleId ON SalePayments(SaleId);
