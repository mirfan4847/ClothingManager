import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getWorkers } from '../services/api';

const ROLE_COLORS = { Admin: '#2E75B6', Manager: '#70AD47', Viewer: '#C55A11' };

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, can } = useAuth();
  const { mode, activeMode, toggleMode, openThemeModal, currentColor, isDark } = useTheme();
  const [workers, setWorkers] = useState([]);

  useEffect(() => {
    getWorkers()
      .then(ws => setWorkers(ws.map(w => ({ path: `/worker/${w.id}`, label: w.name }))))
      .catch(() => {});
  }, []);

  const isWorkerActive = location.pathname.startsWith('/worker/') || location.pathname === '/ali-hassan';
  const [workersOpen, setWorkersOpen] = useState(isWorkerActive);

  const handleLogout = () => { logout(); navigate('/login'); };

  const modeIcons = { light: '☀️', dark: '🌙', midnight: '🌌', auto: '💻' };

  return (
    <aside style={ss.aside}>
      <div style={ss.logo}>🧵 Clothing Manager</div>

      {user && (
        <div style={ss.userBox}>
          <div style={{ ...ss.avatar, background: ROLE_COLORS[user.role] || '#2E75B6' }}>
            {user.avatar}
          </div>
          <div style={ss.userInfo}>
            <div style={ss.userName}>{user.name}</div>
            <span style={{ ...ss.roleBadge, background: ROLE_COLORS[user.role] || '#2E75B6' }}>
              {user.role}
            </span>
          </div>
        </div>
      )}

      <nav style={{ flex: 1, overflowY: 'auto' }}>
        <div style={ss.divider}>MODULES</div>

        <NavLink to="/dashboard" style={({ isActive }) => ss.link(isActive)}>
          🏠 Dashboard
        </NavLink>

        {can('canViewAccounts') && (
          <NavLink to="/accounts" style={({ isActive }) => ss.link(isActive)}>
            📊 Finance
          </NavLink>
        )}

        {can('canViewWages') && (
          <NavLink to="/wages" style={({ isActive }) => ss.link(isActive)}>
            💼 Payroll
          </NavLink>
        )}

        <NavLink to="/purchasing" style={({ isActive }) => ss.link(isActive)}>
          📋 Purchase
        </NavLink>

        <NavLink to="/inventory" style={({ isActive }) => ss.link(isActive)}>
          🏭 Stock
        </NavLink>

        <NavLink to="/customers" style={({ isActive }) => ss.link(isActive)}>
          🤝 Customers
        </NavLink>

        <NavLink to="/sales" style={({ isActive }) => ss.link(isActive)}>
          🧾 Sales Orders
        </NavLink>

        <NavLink to="/labour" style={({ isActive }) => ss.link(isActive)}>
          ⚙️ Production
        </NavLink>

        <NavLink to="/lot-status" style={({ isActive }) => ss.link(isActive)}>
          📦 Lot Status
        </NavLink>

        <NavLink to="/settings" style={({ isActive }) => ss.link(isActive)}>
          🔧 Configuration
        </NavLink>

        {can('canManageRoles') && (
          <NavLink to="/roles" style={({ isActive }) => ss.link(isActive)}>
            🛡️ Access Control
          </NavLink>
        )}

        <NavLink to="/reports" style={({ isActive }) => ss.link(isActive)}>
          📊 Reports
        </NavLink>

        <NavLink to="/activity-log" style={({ isActive }) => ss.link(isActive)}>
          📋 Activity Log
        </NavLink>

        <div style={ss.divider}>WORKFORCE</div>

        <button onClick={() => setWorkersOpen(o => !o)} style={ss.collapseBtn(isWorkerActive)}>
          <span>👷 Staff</span>
          <span style={{ fontSize: 11, display: 'inline-block', transition: 'transform .2s', transform: workersOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </button>

        {workersOpen && (
          <div style={ss.subMenu}>
            {workers.map(w => (
              <NavLink key={w.path} to={w.path} style={({ isActive }) => ss.subLink(isActive)}>
                {w.label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div style={ss.bottom}>
        {/* Theme & Mood Quick Controls */}
        <div style={ss.themeBar}>
          <button
            onClick={toggleMode}
            style={ss.themeToggleBtn}
            title={`Current Mood: ${mode}. Click to toggle.`}
          >
            <span>{modeIcons[mode] || '🌓'}</span>
            <span style={{ textTransform: 'capitalize' }}>{mode}</span>
          </button>
          <button
            onClick={openThemeModal}
            style={ss.paletteBtn}
            title="Open Theme & Appearance Customizer"
          >
            <span>🎨</span>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: currentColor.primary,
                display: 'inline-block',
                boxShadow: '0 0 4px rgba(0,0,0,0.4)',
              }}
            />
          </button>
        </div>

        <button onClick={handleLogout} style={ss.logoutBtn}>🚪 Sign Out</button>
      </div>
    </aside>
  );
}

const ss = {
  aside:       { width: 210, minHeight: '100vh', background: '#1e2a3b', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  logo:        { padding: '1.2rem 1rem', color: '#fff', fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid #2e3d52' },
  userBox:     { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #2e3d52', background: '#161f2d' },
  avatar:      { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 },
  userInfo:    { display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' },
  userName:    { color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  roleBadge:   { color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '1px 7px', display: 'inline-block' },
  divider:     { fontSize: 10, color: '#4a6080', letterSpacing: 1.5, padding: '10px 16px 4px', textTransform: 'uppercase' },
  link:        (a) => ({ display: 'block', padding: '11px 16px', color: a ? '#fff' : '#aab4c4', background: a ? 'var(--color-primary, #70AD47)' : 'transparent', textDecoration: 'none', fontSize: 14, fontWeight: 600, borderLeft: a ? '3px solid #fff' : '3px solid transparent', transition: 'all .15s' }),
  collapseBtn: (a) => ({ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: a ? '#243447' : 'transparent', border: 'none', borderLeft: a ? '3px solid var(--color-primary, #2E75B6)' : '3px solid transparent', color: a ? '#fff' : '#aab4c4', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }),
  subMenu:     { background: '#161f2d', borderLeft: '2px solid #2e3d52', marginLeft: 16 },
  subLink:     (a) => ({ display: 'block', padding: '8px 16px', color: a ? '#fff' : '#8a9baf', background: a ? 'var(--color-primary, #2E75B6)' : 'transparent', textDecoration: 'none', fontSize: 13, borderLeft: a ? '3px solid #fff' : '3px solid transparent', transition: 'all .15s' }),
  bottom:      { padding: '0.9rem', borderTop: '1px solid #2e3d52', display: 'flex', flexDirection: 'column', gap: 10 },
  themeBar:    { display: 'flex', gap: 6, alignItems: 'center' },
  themeToggleBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#243447', border: '1px solid #334458', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background .15s' },
  paletteBtn:  { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#243447', border: '1px solid #334458', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 13, cursor: 'pointer', transition: 'background .15s' },
  logoutBtn:   { width: '100%', background: '#BE0000', color: '#fff', border: 'none', borderRadius: 6, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
};
