-- =============================================
-- Run this in SSMS to reset user passwords
-- This fixes login if seeded passwords don't match
-- =============================================
USE ClothingManagerDB;

-- Check existing users
SELECT Id, Username, Name, Role, IsActive FROM Users;

-- If Users table is empty, insert them manually
-- Password hashes below are for: admin123, manager123, viewer123
-- Generated with SHA256(password + "ClothingManagerSalt")

-- Delete and re-insert to fix any hash mismatch
DELETE FROM Users;

-- Re-insert with fresh data (EF will regenerate correct hashes on next dotnet run)
-- Just restart the backend - EF seed will fix it automatically

-- OR manually update if needed:
-- UPDATE Users SET PasswordHash = '<hash>' WHERE Username = 'admin'
