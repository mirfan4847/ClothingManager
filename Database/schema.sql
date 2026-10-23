-- =============================================
-- Clothing Manager - Database Schema
-- =============================================

CREATE DATABASE ClothingManagerDB;
GO

USE ClothingManagerDB;
GO

-- =============================================
-- Lookup Tables
-- =============================================

CREATE TABLE Sizes (
    Id   INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL
);

CREATE TABLE Colors (
    Id   INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL
);

CREATE TABLE Machines (
    Id   INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL
);

CREATE TABLE Workers (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    Name       NVARCHAR(100) NOT NULL,
    SheetType  NVARCHAR(50)  NOT NULL, -- e.g. 'AliHassan', 'Faizan', 'Arslan' ...
    IsActive   BIT           NOT NULL DEFAULT 1,
    CreatedAt  DATETIME      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Lots (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    LotNumber  NVARCHAR(100) NOT NULL,
    CreatedAt  DATETIME      NOT NULL DEFAULT GETDATE()
);

-- =============================================
-- Main Entries Table
-- =============================================

CREATE TABLE WorkerEntries (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    WorkerId      INT           NOT NULL REFERENCES Workers(Id),
    LotId         INT           NOT NULL REFERENCES Lots(Id),
    SizeId        INT               NULL REFERENCES Sizes(Id),
    ColorId       INT               NULL REFERENCES Colors(Id),
    MachineId     INT               NULL REFERENCES Machines(Id),

    -- Work columns (nullable: only used by relevant sheets)
    Front         INT               NULL,
    Bazo          INT               NULL,
    Tape          INT               NULL,
    Pocket        INT               NULL,
    Gala          INT               NULL,
    Lable         INT               NULL,
    Moda          INT               NULL,
    Quantity      INT               NULL,
    TotalPiece    INT               NULL,

    -- Status
    Completed     BIT           NOT NULL DEFAULT 0,
    DateCompleted DATETIME          NULL,

    -- Picture stored on disk; path saved here
    PicturePath   NVARCHAR(500)     NULL,

    CreatedAt     DATETIME      NOT NULL DEFAULT GETDATE(),
    UpdatedAt     DATETIME      NOT NULL DEFAULT GETDATE()
);

GO

-- =============================================
-- Seed Data
-- =============================================

INSERT INTO Sizes (Name) VALUES ('Mama'), ('Short');

INSERT INTO Colors (Name) VALUES ('Red'), ('Gray'), ('Falsa'), ('Black');

INSERT INTO Machines (Name) VALUES ('G9-1'), ('G9-2'), ('G8');

INSERT INTO Workers (Name, SheetType) VALUES
    ('Ali Hassan',   'AliHassan'),
    ('Faizan',       'Faizan'),
    ('Gujjar Press', 'GujjarPress'),
    ('Arslan',       'Arslan'),
    ('Nazir',        'Nazir'),
    ('Umer Safty',   'UmerSafty'),
    ('Naveed Rafo',  'NaveedRafo'),
    ('Bhatti Kaj',   'BhattiKaj'),
    ('Button',       'Button');

GO

-- =============================================
-- Helpful Views
-- =============================================

CREATE VIEW vw_WorkerEntries AS
SELECT
    we.Id,
    w.Name        AS WorkerName,
    w.SheetType,
    l.LotNumber,
    s.Name        AS Size,
    c.Name        AS Color,
    m.Name        AS Machine,
    we.Front,
    we.Bazo,
    we.Tape,
    we.Pocket,
    we.Gala,
    we.Lable,
    we.Moda,
    we.Quantity,
    we.TotalPiece,
    we.Completed,
    we.DateCompleted,
    we.PicturePath,
    we.CreatedAt,
    we.UpdatedAt
FROM WorkerEntries we
JOIN Workers w ON we.WorkerId = w.Id
JOIN Lots    l ON we.LotId    = l.Id
LEFT JOIN Sizes    s ON we.SizeId    = s.Id
LEFT JOIN Colors   c ON we.ColorId   = c.Id
LEFT JOIN Machines m ON we.MachineId = m.Id;

GO

-- =============================================
-- Auth Tables (added for role-based auth)
-- =============================================

CREATE TABLE Roles (
    Id        INT IDENTITY(1,1) PRIMARY KEY,
    Name      NVARCHAR(50)  NOT NULL,
    CreatedAt DATETIME      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE RolePermissions (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    RoleId     INT           NOT NULL REFERENCES Roles(Id),
    Permission NVARCHAR(100) NOT NULL,
    IsGranted  BIT           NOT NULL DEFAULT 1
);

CREATE TABLE Users (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    Username     NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(500) NOT NULL,
    Name         NVARCHAR(100) NOT NULL,
    Role         NVARCHAR(50)  NOT NULL, -- Admin, Manager, Viewer
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedAt    DATETIME      NOT NULL DEFAULT GETDATE()
);

-- Seed Roles
INSERT INTO Roles (Name) VALUES ('Admin'), ('Manager'), ('Viewer');

-- Seed Users (passwords are SHA256 hashed)
-- admin123, manager123, viewer123
INSERT INTO Users (Username, PasswordHash, Name, Role) VALUES
('admin',   '<run dotnet to get hash>', 'Administrator', 'Admin'),
('manager', '<run dotnet to get hash>', 'Manager',       'Manager'),
('viewer',  '<run dotnet to get hash>', 'Viewer',        'Viewer');
-- NOTE: EF Core migration will seed users with correct hashes automatically.
GO

-- =============================================
-- Accounts Module Tables
-- =============================================

CREATE TABLE AccountCategories (
    Id        INT IDENTITY(1,1) PRIMARY KEY,
    Name      NVARCHAR(100) NOT NULL,  -- Income, Expense, Asset, Liability, Cash
    Type      NVARCHAR(20)  NOT NULL,  -- Credit / Debit
    CreatedAt DATETIME      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Accounts (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    Name        NVARCHAR(200) NOT NULL,
    CategoryId  INT           NOT NULL REFERENCES AccountCategories(Id),
    Balance     DECIMAL(18,2) NOT NULL DEFAULT 0,
    Description NVARCHAR(500)     NULL,
    IsActive    BIT           NOT NULL DEFAULT 1,
    CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Transactions (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    AccountId   INT           NOT NULL REFERENCES Accounts(Id),
    Type        NVARCHAR(10)  NOT NULL,  -- Credit / Debit
    Amount      DECIMAL(18,2) NOT NULL,
    Description NVARCHAR(500) NOT NULL,
    ReferenceNo NVARCHAR(100)     NULL,
    Date        DATETIME      NOT NULL DEFAULT GETDATE(),
    CreatedAt   DATETIME      NOT NULL DEFAULT GETDATE()
);

-- Seed Categories
INSERT INTO AccountCategories (Name, Type) VALUES
('Income',    'Credit'),
('Expense',   'Debit'),
('Asset',     'Debit'),
('Liability', 'Credit'),
('Cash',      'Debit');

-- Seed Sample Accounts
INSERT INTO Accounts (Name, CategoryId, Balance, Description) VALUES
('Main Cash',      5, 0, 'Main cash account'),
('Sales Income',   1, 0, 'Revenue from sales'),
('Labour Expense', 2, 0, 'Labour payment expenses'),
('Material Cost',  2, 0, 'Raw material costs');

-- Useful view for ledger
CREATE VIEW vw_Ledger AS
SELECT
    t.Id,
    a.Name        AS AccountName,
    ac.Name       AS Category,
    ac.Type       AS CategoryType,
    t.Type        AS TransactionType,
    t.Amount,
    t.Description,
    t.ReferenceNo,
    t.Date,
    t.CreatedAt
FROM Transactions t
JOIN Accounts         a  ON t.AccountId  = a.Id
JOIN AccountCategories ac ON a.CategoryId = ac.Id;
GO
