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
import AliHassan from './pages/AliHassan';
import WageModule from './pages/WageModule';
import LotStatus from './pages/LotStatus';
import ActivityLog from './pages/ActivityLog';
import ReportsModule from './pages/ReportsModule';
import Dashboard from './pages/Dashboard';
import { Faizan, GujjarPress, Arslan, Nazir, UmerSafty, NaveedRafo, BhattiKaj, Button, GenericWorker } from './pages/WorkerPages';

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ children, permission }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const hasPermission = user.permissions?.[permission] ?? false;

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

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*"      element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'Segoe UI, Arial, sans-serif' }}>
      <Sidebar />
      <main style={{ flex:1, background: isDark ? 'var(--bg-page)' : '#f4f6f9', overflowX:'auto' }}>
        <Routes>
          <Route path="/"             element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"        element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"    element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/wages"        element={<RequireRole permission="canViewWages"><WageModule /></RequireRole>} />
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
          <Route path="/ali-hassan"   element={<RequireAuth><AliHassan /></RequireAuth>} />
          <Route path="/faizan"       element={<RequireAuth><Faizan /></RequireAuth>} />
          <Route path="/gujjar-press" element={<RequireAuth><GujjarPress /></RequireAuth>} />
          <Route path="/arslan"       element={<RequireAuth><Arslan /></RequireAuth>} />
          <Route path="/nazir"        element={<RequireAuth><Nazir /></RequireAuth>} />
          <Route path="/umer-safty"   element={<RequireAuth><UmerSafty /></RequireAuth>} />
          <Route path="/naveed-rafo"  element={<RequireAuth><NaveedRafo /></RequireAuth>} />
          <Route path="/bhatti-kaj"   element={<RequireAuth><BhattiKaj /></RequireAuth>} />
          <Route path="/button"       element={<RequireAuth><Button /></RequireAuth>} />
          <Route path="/worker/:id"   element={<RequireAuth><GenericWorker /></RequireAuth>} />
        </Routes>
      </main>
      <ThemeModal />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
