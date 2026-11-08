-- Idempotent SQL script to insert Roles, RolePermissions, and Default Users (admin, manager, viewer)

-- 1. Ensure Roles table exists and seed roles
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Roles')
BEGIN
    CREATE TABLE Roles (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END

IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'Admin')
    INSERT INTO Roles (Name) VALUES ('Admin');
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'Manager')
    INSERT INTO Roles (Name) VALUES ('Manager');
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'Viewer')
    INSERT INTO Roles (Name) VALUES ('Viewer');

-- 2. Ensure RolePermissions table exists
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RolePermissions')
BEGIN
    CREATE TABLE RolePermissions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RoleId INT NOT NULL,
        Permission NVARCHAR(100) NOT NULL,
        IsGranted BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE
    );
END

-- 3. Upsert Role Permissions
DECLARE @AdminId INT = (SELECT TOP 1 Id FROM Roles WHERE Name = 'Admin');
DECLARE @ManagerId INT = (SELECT TOP 1 Id FROM Roles WHERE Name = 'Manager');
DECLARE @ViewerId INT = (SELECT TOP 1 Id FROM Roles WHERE Name = 'Viewer');

DECLARE @Perms TABLE (Permission NVARCHAR(100), AdminGrant BIT, ManagerGrant BIT, ViewerGrant BIT);
INSERT INTO @Perms VALUES
('canViewLabour',        1, 1, 1),
('canAddLabour',         1, 1, 0),
('canEditLabour',        1, 1, 0),
('canDeleteLabour',      1, 0, 0),
('canViewWorkers',       1, 1, 1),
('canAddEntry',          1, 1, 0),
('canEditEntry',         1, 1, 0),
('canDeleteEntry',       1, 0, 0),
('canManageRoles',       1, 0, 0),
('canViewReports',       1, 1, 1),
('canViewAccounts',      1, 0, 0),
('canAddTransaction',    1, 0, 0),
('canEditTransaction',   1, 0, 0),
('canDeleteTransaction', 1, 0, 0),
('canManageAccounts',    1, 0, 0),
('canViewSettings',      1, 1, 1),
('canAddSettings',       1, 1, 0),
('canEditSettings',      1, 1, 0),
('canDeleteSettings',    1, 0, 0),
('canViewWages',         1, 1, 1),
('canManageWages',       1, 0, 0),
('canRecordPayment',     1, 1, 0);

-- Admin perms
MERGE RolePermissions AS target
USING (SELECT @AdminId AS RoleId, Permission, AdminGrant AS IsGranted FROM @Perms WHERE @AdminId IS NOT NULL) AS source
ON (target.RoleId = source.RoleId AND target.Permission = source.Permission)
WHEN MATCHED THEN
    UPDATE SET target.IsGranted = source.IsGranted
WHEN NOT MATCHED THEN
    INSERT (RoleId, Permission, IsGranted) VALUES (source.RoleId, source.Permission, source.IsGranted);

-- Manager perms
MERGE RolePermissions AS target
USING (SELECT @ManagerId AS RoleId, Permission, ManagerGrant AS IsGranted FROM @Perms WHERE @ManagerId IS NOT NULL) AS source
ON (target.RoleId = source.RoleId AND target.Permission = source.Permission)
WHEN MATCHED THEN
    UPDATE SET target.IsGranted = source.IsGranted
WHEN NOT MATCHED THEN
    INSERT (RoleId, Permission, IsGranted) VALUES (source.RoleId, source.Permission, source.IsGranted);

-- Viewer perms
MERGE RolePermissions AS target
USING (SELECT @ViewerId AS RoleId, Permission, ViewerGrant AS IsGranted FROM @Perms WHERE @ViewerId IS NOT NULL) AS source
ON (target.RoleId = source.RoleId AND target.Permission = source.Permission)
WHEN MATCHED THEN
    UPDATE SET target.IsGranted = source.IsGranted
WHEN NOT MATCHED THEN
    INSERT (RoleId, Permission, IsGranted) VALUES (source.RoleId, source.Permission, source.IsGranted);

-- 4. Ensure Users table exists
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Username NVARCHAR(100) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(500) NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        Role NVARCHAR(50) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END

-- 5. Upsert Users (admin, manager, viewer) with active status and working passwords
MERGE Users AS target
USING (
    VALUES 
        ('admin',   'admin123',   'Administrator', 'Admin',   1),
        ('manager', 'manager123', 'Manager',       'Manager', 1),
        ('viewer',  'viewer123',  'Viewer',        'Viewer',  1)
) AS source (Username, PasswordHash, Name, Role, IsActive)
ON (LOWER(target.Username) = LOWER(source.Username))
WHEN MATCHED THEN
    UPDATE SET 
        target.PasswordHash = source.PasswordHash,
        target.Role = source.Role,
        target.IsActive = 1,
        target.Name = source.Name
WHEN NOT MATCHED THEN
    INSERT (Username, PasswordHash, Name, Role, IsActive, CreatedAt)
    VALUES (source.Username, source.PasswordHash, source.Name, source.Role, 1, SYSUTCDATETIME());

-- Verify and return output
SELECT Id, Username, Role, IsActive FROM Users;
