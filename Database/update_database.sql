-- =============================================
-- Run this in SSMS to add missing tables
-- =============================================
USE ClothingManagerDB;
GO

-- Add Roles table if missing
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Roles' AND xtype='U')
BEGIN
    CREATE TABLE Roles (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        Name      NVARCHAR(50)  NOT NULL,
        CreatedAt DATETIME      NOT NULL DEFAULT GETDATE()
    );
    INSERT INTO Roles (Name) VALUES ('Admin'), ('Manager'), ('Viewer');
    PRINT 'Roles table created';
END

-- Add RolePermissions table if missing
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RolePermissions' AND xtype='U')
BEGIN
    CREATE TABLE RolePermissions (
        Id         INT IDENTITY(1,1) PRIMARY KEY,
        RoleId     INT           NOT NULL REFERENCES Roles(Id),
        Permission NVARCHAR(100) NOT NULL,
        IsGranted  BIT           NOT NULL DEFAULT 1
    );
    PRINT 'RolePermissions table created';
END

-- Add Users table if missing
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
BEGIN
    CREATE TABLE Users (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        Username     NVARCHAR(100) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(500) NOT NULL,
        Name         NVARCHAR(100) NOT NULL,
        Role         NVARCHAR(50)  NOT NULL,
        IsActive     BIT           NOT NULL DEFAULT 1,
        CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Users table created';
END

-- Add AccountCategories if missing
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AccountCategories' AND xtype='U')
BEGIN
    CREATE TABLE AccountCategories (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        Name      NVARCHAR(100) NOT NULL,
        Type      NVARCHAR(20)  NOT NULL,
        CreatedAt DATETIME      NOT NULL DEFAULT GETDATE()
    );
    INSERT INTO AccountCategories (Name, Type) VALUES
    ('Income','Credit'),('Expense','Debit'),
    ('Asset','Debit'),('Liability','Credit'),('Cash','Debit');
    PRINT 'AccountCategories table created';
END

-- Add Accounts if missing
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Accounts' AND xtype='U')
BEGIN
    CREATE TABLE Accounts (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        Name        NVARCHAR(200) NOT NULL,
        CategoryId  INT           NOT NULL REFERENCES AccountCategories(Id),
        Balance     DECIMAL(18,2) NOT NULL DEFAULT 0,
        Description NVARCHAR(500)     NULL,
        IsActive    BIT           NOT NULL DEFAULT 1,
        CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
    );
    INSERT INTO Accounts (Name, CategoryId, Balance, Description) VALUES
    ('Main Cash',5,0,'Main cash account'),
    ('Sales Income',1,0,'Revenue from sales'),
    ('Labour Expense',2,0,'Labour payment expenses'),
    ('Material Cost',2,0,'Raw material costs');
    PRINT 'Accounts table created';
END

-- Add Transactions if missing
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Transactions' AND xtype='U')
BEGIN
    CREATE TABLE Transactions (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        AccountId   INT           NOT NULL REFERENCES Accounts(Id),
        Type        NVARCHAR(10)  NOT NULL,
        Amount      DECIMAL(18,2) NOT NULL,
        Description NVARCHAR(500) NOT NULL,
        ReferenceNo NVARCHAR(100)     NULL,
        Date        DATETIME      NOT NULL DEFAULT GETDATE(),
        CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Transactions table created';
END

-- Show all tables
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
GO
