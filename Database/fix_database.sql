-- =============================================
-- Run ALL of this in SSMS to fix the database
-- =============================================
USE ClothingManagerDB;
GO

-- 1. Add missing columns to Workers if they don't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Workers') AND name = 'IsActive')
    ALTER TABLE Workers ADD IsActive BIT NOT NULL DEFAULT 1;

-- 2. Add Roles table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Roles' AND xtype='U')
BEGIN
    CREATE TABLE Roles (Id INT IDENTITY(1,1) PRIMARY KEY, Name NVARCHAR(50) NOT NULL, CreatedAt DATETIME NOT NULL DEFAULT GETDATE());
    INSERT INTO Roles (Name) VALUES ('Admin'), ('Manager'), ('Viewer');
    PRINT 'Roles created';
END

-- 3. Add RolePermissions table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RolePermissions' AND xtype='U')
BEGIN
    CREATE TABLE RolePermissions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RoleId INT NOT NULL REFERENCES Roles(Id),
        Permission NVARCHAR(100) NOT NULL,
        IsGranted BIT NOT NULL DEFAULT 1
    );
    PRINT 'RolePermissions created';
END

-- 4. Add Users table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
BEGIN
    CREATE TABLE Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Username NVARCHAR(100) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(500) NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Role NVARCHAR(50) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Users created';
END

-- 5. Add AccountCategories table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AccountCategories' AND xtype='U')
BEGIN
    CREATE TABLE AccountCategories (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        Type NVARCHAR(20) NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
    INSERT INTO AccountCategories (Name, Type) VALUES
        ('Income','Credit'),('Expense','Debit'),
        ('Asset','Debit'),('Liability','Credit'),('Cash','Debit');
    PRINT 'AccountCategories created';
END

-- 6. Add Accounts table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Accounts' AND xtype='U')
BEGIN
    CREATE TABLE Accounts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        CategoryId INT NOT NULL REFERENCES AccountCategories(Id),
        Balance DECIMAL(18,2) NOT NULL DEFAULT 0,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
    INSERT INTO Accounts (Name, CategoryId, Balance, Description) VALUES
        ('Main Cash',5,0,'Main cash account'),
        ('Sales Income',1,0,'Revenue from sales'),
        ('Labour Expense',2,0,'Labour payment expenses'),
        ('Material Cost',2,0,'Raw material costs');
    PRINT 'Accounts created';
END

-- 7. Add Transactions table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Transactions' AND xtype='U')
BEGIN
    CREATE TABLE Transactions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        AccountId INT NOT NULL REFERENCES Accounts(Id),
        Type NVARCHAR(10) NOT NULL,
        Amount DECIMAL(18,2) NOT NULL,
        Description NVARCHAR(500) NOT NULL,
        ReferenceNo NVARCHAR(100) NULL,
        Date DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Transactions created';
END

-- 8. Add EF migration history table to stop migration errors
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='__EFMigrationsHistory' AND xtype='U')
BEGIN
    CREATE TABLE __EFMigrationsHistory (
        MigrationId NVARCHAR(150) NOT NULL PRIMARY KEY,
        ProductVersion NVARCHAR(32) NOT NULL
    );
    -- Insert a fake migration so EF thinks it's already applied
    INSERT INTO __EFMigrationsHistory VALUES ('20240101000000_InitialCreate', '8.0.0');
    PRINT 'EF migrations history created';
END

-- Show all tables
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
GO
