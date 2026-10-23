import { createContext, useContext, useState } from 'react';
import { login as apiLogin } from '../services/api';

const AuthContext = createContext(null);

export const PERMISSIONS = {
  Admin: {
    canViewLabour:true, canAddLabour:true, canEditLabour:true, canDeleteLabour:true,
    canViewWorkers:true, canAddEntry:true, canEditEntry:true, canDeleteEntry:true,
    canManageRoles:true, canViewReports:true,
    // Accounts - Admin only
    canViewAccounts:true, canAddTransaction:true, canEditTransaction:true,
    canDeleteTransaction:true, canManageAccounts:true,
    // Settings - Admin and Manager
    canViewSettings:true, canAddSettings:true, canEditSettings:true, canDeleteSettings:true,
    // Wages
    canViewWages:true, canManageWages:true, canRecordPayment:true,
  },
  Manager: {
    canViewLabour:true, canAddLabour:true, canEditLabour:true, canDeleteLabour:false,
    canViewWorkers:true, canAddEntry:true, canEditEntry:true, canDeleteEntry:false,
    canManageRoles:false, canViewReports:true,
    // Accounts - Manager has NO access
    canViewAccounts:false, canAddTransaction:false, canEditTransaction:false,
    canDeleteTransaction:false, canManageAccounts:false,
    // Settings - Manager can view, add, edit but NOT delete
    canViewSettings:true, canAddSettings:true, canEditSettings:true, canDeleteSettings:false,
    // Wages - Manager can view and record payments
    canViewWages:true, canManageWages:false, canRecordPayment:true,
  },
  Viewer: {
    canViewLabour:true, canAddLabour:false, canEditLabour:false, canDeleteLabour:false,
    canViewWorkers:true, canAddEntry:false, canEditEntry:false, canDeleteEntry:false,
    canManageRoles:false, canViewReports:true,
    // Accounts - Viewer has NO access
    canViewAccounts:false, canAddTransaction:false, canEditTransaction:false,
    canDeleteTransaction:false, canManageAccounts:false,
    // Settings - Viewer can only view
    canViewSettings:true, canAddSettings:false, canEditSettings:false, canDeleteSettings:false,
    // Wages - Viewer can only view
    canViewWages:true, canManageWages:false, canRecordPayment:false,
  },
};

const LOCAL_USERS = [
  { username: 'admin',   password: 'admin123',   name: 'Administrator', role: 'Admin',   token: 'local-admin-token' },
  { username: 'manager', password: 'manager123', name: 'Manager',       role: 'Manager', token: 'local-manager-token' },
  { username: 'viewer',  password: 'viewer123',  name: 'Viewer',        role: 'Viewer',  token: 'local-viewer-token' },
];

const buildUser = (data) => ({
  token:       data.token,
  name:        data.name,
  username:    data.username,
  role:        data.role,
  avatar:      data.name?.charAt(0).toUpperCase() || 'U',
  // Prefer server-returned permissions; fall back to hardcoded table for local/demo users
  permissions: data.permissions || PERMISSIONS[data.role] || {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('cm_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (!parsed?.role) return null;
      return buildUser(parsed);
    } catch { return null; }
  });

  const login = async (username, password, onSuccess) => {
    sessionStorage.removeItem('cm_user');
    try {
      const data = await apiLogin({ username, password });
      const userData = buildUser(data);
      setUser(userData);
      sessionStorage.setItem('cm_user', JSON.stringify(userData));
      if (onSuccess) setTimeout(() => onSuccess(), 100);
      return { success: true };
    } catch (err) {
      const localUser = LOCAL_USERS.find(u => u.username === username && u.password === password);
      if (localUser) {
        const userData = buildUser(localUser);
        setUser(userData);
        sessionStorage.setItem('cm_user', JSON.stringify(userData));
        if (onSuccess) setTimeout(() => onSuccess(), 100);
        return { success: true };
      }
      const msg = err.response?.data?.message || 'Invalid username or password';
      return { success: false, message: msg };
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('cm_user');
  };

  const can = (permission) => {
    if (!user) return false;
    return user.permissions?.[permission] ?? false;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
