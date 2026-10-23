-- Customers table
CREATE TABLE Customers (
    Id        INT IDENTITY(1,1) PRIMARY KEY,
    Name      NVARCHAR(200)  NOT NULL,
    Phone     NVARCHAR(50)   NULL,
    Address   NVARCHAR(500)  NULL,
    Notes     NVARCHAR(1000) NULL,
    IsActive  BIT            NOT NULL DEFAULT 1,
    CreatedAt DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Customers_Name ON Customers(Name);
