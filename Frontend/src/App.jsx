import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import ThemeModal from './components/ThemeModal';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import LabourModule from './pages/LabourModule';
import AccountsModule from './pages/AccountsModule';
import RoleManagement from './pages/RoleManagement';
import Settings from './pages/Settings';
import PurchasingModule from './pages/PurchasingModule';
import InventoryModule from './pages/InventoryModule';
import CustomerModule from './pages/CustomerModule';
import SaleModule from './pages/SaleModule';
import WageModule from './pages/WageModule';
import WorkerPaymentModule from './pages/WorkerPaymentModule';
import LotStatus from './pages/LotStatus';
import ActivityLog from './pages/ActivityLog';
import ReportsModule from './pages/ReportsModule';
import Dashboard from './pages/Dashboard';
import StaffModule from './pages/StaffModule';

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ children, permission }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const hasPermission = user.role === 'Admin' || (user.permissions?.[permission] ?? false);

  if (!hasPermission) return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', minHeight:'60vh',
      fontFamily:'Segoe UI, Arial, sans-serif'
    }}>
      <div style={{ fontSize:64 }}>🔒</div>
      <div style={{ fontSize:'1.4rem', fontWeight:700, color:'#BE0000', margin:'16px 0 8px' }}>
        Access Denied
      </div>
      <div style={{ color:'#888', fontSize:14 }}>
        You don't have permission to view this page.
      </div>
      <div style={{ marginTop:6, fontSize:12, color:'#bbb' }}>
        Role: {user.role} — needs: {permission}
      </div>
    </div>
  );
  return children;
}

function AppLayout() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  useEffect(() => {
    const handleDateInputClick = (e) => {
      const target = e.target;
      if (target && target.tagName === 'INPUT' && target.type === 'date' && !target.disabled && !target.readOnly) {
        try {
          if (typeof target.showPicker === 'function') {
            target.showPicker();
          }
        } catch {}
      }
    };
    document.addEventListener('click', handleDateInputClick);
    return () => document.removeEventListener('click', handleDateInputClick);
  }, []);

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*"      element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div style={{ display:'flex', height:'100vh', width:'100vw', overflow:'hidden', fontFamily:'Segoe UI, Arial, sans-serif' }}>
      <Sidebar />
      <main style={{ flex:1, height:'100vh', overflowY:'auto', overflowX:'hidden', background: isDark ? 'var(--bg-page)' : '#f4f6f9' }} className="hide-scrollbar">
        <Routes>
          <Route path="/"             element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"        element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"    element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/wages"        element={<RequireRole permission="canViewWages"><WageModule /></RequireRole>} />
          <Route path="/worker-payments" element={<RequireRole permission="canViewWages"><WorkerPaymentModule /></RequireRole>} />
          <Route path="/labour"       element={<RequireAuth><LabourModule /></RequireAuth>} />
          <Route path="/settings"     element={<RequireRole permission="canViewSettings"><Settings /></RequireRole>} />
          <Route path="/purchasing"   element={<RequireAuth><PurchasingModule /></RequireAuth>} />
          <Route path="/inventory"    element={<RequireAuth><InventoryModule /></RequireAuth>} />
          <Route path="/customers"    element={<RequireAuth><CustomerModule /></RequireAuth>} />
          <Route path="/sales"        element={<RequireAuth><SaleModule /></RequireAuth>} />
          <Route path="/accounts"     element={<RequireRole permission="canViewAccounts"><AccountsModule /></RequireRole>} />
          <Route path="/roles"        element={<RequireRole permission="canManageRoles"><RoleManagement /></RequireRole>} />
          <Route path="/activity-log" element={<RequireAuth><ActivityLog /></RequireAuth>} />
          <Route path="/reports"      element={<RequireAuth><ReportsModule /></RequireAuth>} />
          <Route path="/lot-status"    element={<RequireAuth><LotStatus /></RequireAuth>} />
          <Route path="/staff"        element={<RequireAuth><StaffModule /></RequireAuth>} />
          <Route path="/staff/:id"    element={<RequireAuth><StaffModule /></RequireAuth>} />
          <Route path="/worker/:id"   element={<RequireAuth><StaffModule /></RequireAuth>} />
          <Route path="/ali-hassan"   element={<Navigate to="/staff/1" replace />} />
          <Route path="/faizan"       element={<Navigate to="/staff/2" replace />} />
          <Route path="/gujjar-press" element={<Navigate to="/staff/3" replace />} />
          <Route path="/arslan"       element={<Navigate to="/staff/4" replace />} />
          <Route path="/nazir"        element={<Navigate to="/staff/5" replace />} />
          <Route path="/umer-safty"   element={<Navigate to="/staff/6" replace />} />
          <Route path="/naveed-rafo"  element={<Navigate to="/staff/7" replace />} />
          <Route path="/bhatti-kaj"   element={<Navigate to="/staff/8" replace />} />
          <Route path="/button"       element={<Navigate to="/staff/9" replace />} />
        </Routes>
      </main>
      <ThemeModal />
    </div>
  );
}

function getRouterBasename() {
  const path = window.location.pathname || '/';
  const firstSegment = path.split('/').filter(Boolean)[0];
  const appRoutes = new Set([
    'login', 'dashboard', 'wages', 'worker-payments', 'labour', 'settings', 'purchasing',
    'inventory', 'customers', 'sales', 'accounts', 'roles', 'activity-log',
    'reports', 'lot-status', 'staff', 'worker', 'ali-hassan', 'faizan',
    'gujjar-press', 'arslan', 'nazir', 'umer-safty', 'naveed-rafo',
    'bhatti-kaj', 'button'
  ]);
  if (firstSegment && !appRoutes.has(firstSegment.toLowerCase())) {
    return `/${firstSegment}`;
  }
  return '/';
}

export default function App() {
  return (
    <BrowserRouter basename={getRouterBasename()}>
      <ThemeProvider>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
