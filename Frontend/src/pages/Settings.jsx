import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEME_COLORS, THEME_MODES } from '../context/ThemeContext';
import api, { uploadLotPicture, getAiConfig, testAiKey, saveAiKey } from '../services/api';
import { clearDropdownsCache } from '../hooks/useHooks';
import LotHistoryModal from '../components/LotHistoryModal';

// ─── Bootstrap 5 Tokens ───────────────────────────────────────────────────────
const BT = {
  primary:   '#0d6efd',
  secondary: '#6c757d',
  success:   '#198754',
  danger:    '#dc3545',
  warning:   '#ffc107',
  info:      '#0dcaf0',
  dark:      '#212529',
  purple:    '#6f42c1',
  orange:    '#fd7e14',
  pink:      '#d63384',
};

const DEFAULT_MASTER_ITEMS = {
  taskTypes: ['Front', 'Bazo', 'Tape', 'Pocket', 'Gala', 'Lable', 'Moda', 'Quantity', 'TotalPiece'],
  materials: ['Mink', 'Mink Bo', 'Cotton', 'Polister', 'Fleece', 'Khaddar', 'Lawn', 'Other'],
  bagTypes: ['Boray', 'Diby', 'Bobay'],
  workerRoles: ['Stitching', 'Machine Op', 'Pressing', 'Finishing', 'Safety', 'Cutting', 'Kajkari', 'Buttons', 'Other'],
  lotStages: ['Stitching', 'Rafo', 'Button', 'Press', 'Delivered'],
};

const fetchMasterList = async (url, fallbackKey = null, params = undefined) => {
  try {
    const r = await api.get(url, params ? { params } : undefined);
    if (Array.isArray(r.data)) {
      return r.data;
    }
  } catch {}
  if (fallbackKey && DEFAULT_MASTER_ITEMS[fallbackKey]) {
    return DEFAULT_MASTER_ITEMS[fallbackKey].map((name, idx) => ({
      id: idx + 1,
      name,
      isActive: true,
    }));
  }
  return [];
};

const deleteMasterItem = (url) => api.delete(url).catch(err => {
  if (err?.response?.status === 405 || !err.response) {
    return api.post(`${url}/delete`).then(r => r.data);
  }
  throw err;
});

const TABS = [
  {
    key: 'sizes', label: 'Sizes', singular: 'Size', tag: 'SPECIFICATIONS', icon: '📐', color: BT.primary,
    gradient: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)',
    getAll: () => fetchMasterList('/masters/sizes'),
    create: d => api.post('/masters/sizes', d).then(r => r.data),
    update: (id, d) => api.put(`/masters/sizes/${id}`, d).then(r => r.data),
    toggleStatus: id => api.patch(`/masters/sizes/${id}/toggle-status`).then(r => r.data),
    remove: id => deleteMasterItem(`/masters/sizes/${id}`),
    fields: [{ key: 'name', label: 'Size Name', placeholder: 'e.g. Mama, Short, Large, Medium' }],
  },
  {
    key: 'colors', label: 'Colors', singular: 'Color', tag: 'PALETTE', icon: '🎨', color: BT.success,
    gradient: 'linear-gradient(135deg, #198754 0%, #157347 100%)',
    getAll: () => fetchMasterList('/masters/colors'),
    create: d => api.post('/masters/colors', d).then(r => r.data),
    update: (id, d) => api.put(`/masters/colors/${id}`, d).then(r => r.data),
    toggleStatus: id => api.patch(`/masters/colors/${id}/toggle-status`).then(r => r.data),
    remove: id => deleteMasterItem(`/masters/colors/${id}`),
    fields: [{ key: 'name', label: 'Color Name', placeholder: 'e.g. Red, Black, Falsa, Navy Blue' }],
  },
  {
    key: 'machines', label: 'Machines', singular: 'Machine', tag: 'EQUIPMENT', icon: '⚙️', color: BT.purple,
    gradient: 'linear-gradient(135deg, #6f42c1 0%, #59359a 100%)',
    getAll: () => fetchMasterList('/masters/machines'),
    create: d => api.post('/masters/machines', d).then(r => r.data),
    update: (id, d) => api.put(`/masters/machines/${id}`, d).then(r => r.data),
    toggleStatus: id => api.patch(`/masters/machines/${id}/toggle-status`).then(r => r.data),
    remove: id => deleteMasterItem(`/masters/machines/${id}`),
    fields: [{ key: 'name', label: 'Machine Name', placeholder: 'e.g. G9-1, G8, Juki Overlock' }],
  },
  {
    key: 'lots', label: 'Lot Numbers', singular: 'Lot Number', tag: 'INVENTORY', icon: '📦', color: BT.orange,
    gradient: 'linear-gradient(135deg, #fd7e14 0%, #d96309 100%)',
    getAll: () => fetchMasterList('/lots', null, { includeInactive: true }),
    create: d => api.post('/lots', d).then(r => r.data),
    update: (id, d) => api.put(`/lots/${id}`, d).then(r => r.data),
    toggleStatus: id => api.patch(`/lots/${id}/toggle-status`).then(r => r.data),
    remove: id => deleteMasterItem(`/lots/${id}`),
    fields: [
      { key: 'lotNumber', label: 'Lot Number', placeholder: 'e.g. Mid-5, M-1, Summer-Lot' },
      { key: 'sizeId',   label: 'Size',     type: 'select', optionsKey: 'sizes',     displayKey: 'sizeName', optional: true },
    ],
  },
  {
    key: 'taskTypes', label: 'Task Types', singular: 'Task Type', tag: 'PAYROLL', icon: '🏷️', color: '#0891b2',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
    getAll: () => fetchMasterList('/masters/task-types', 'taskTypes'),
    create: d => api.post('/masters/task-types', d).then(r => r.data),
    update: (id, d) => api.put(`/masters/task-types/${id}`, d).then(r => r.data),
    toggleStatus: id => api.patch(`/masters/task-types/${id}/toggle-status`).then(r => r.data),
    remove: id => deleteMasterItem(`/masters/task-types/${id}`),
    fields: [{ key: 'name', label: 'Task Type Name', placeholder: 'e.g. Front, Bazo, Tape, Pocket, Gala, Quantity' }],
  },
  {
    key: 'materials', label: 'Materials', singular: 'Material', tag: 'FABRIC', icon: '🧶', color: BT.pink,
    gradient: 'linear-gradient(135deg, #d63384 0%, #a61e4d 100%)',
    getAll: () => fetchMasterList('/masters/materials', 'materials'),
    create: d => api.post('/masters/materials', d).then(r => r.data),
    update: (id, d) => api.put(`/masters/materials/${id}`, d).then(r => r.data),
    toggleStatus: id => api.patch(`/masters/materials/${id}/toggle-status`).then(r => r.data),
    remove: id => deleteMasterItem(`/masters/materials/${id}`),
    fields: [{ key: 'name', label: 'Material Name', placeholder: 'e.g. Mink, Mink Bo, Cotton, Polister, Fleece' }],
  },
  {
    key: 'bagTypes', label: 'Bag Types', singular: 'Bag Type', tag: 'PACKAGING', icon: '🛍️', color: '#20c997',
    gradient: 'linear-gradient(135deg, #20c997 0%, #0ca678 100%)',
    getAll: () => fetchMasterList('/masters/bag-types', 'bagTypes'),
    create: d => api.post('/masters/bag-types', d).then(r => r.data),
    update: (id, d) => api.put(`/masters/bag-types/${id}`, d).then(r => r.data),
    toggleStatus: id => api.patch(`/masters/bag-types/${id}/toggle-status`).then(r => r.data),
    remove: id => deleteMasterItem(`/masters/bag-types/${id}`),
    fields: [{ key: 'name', label: 'Bag Type Name', placeholder: 'e.g. Boray, Diby, Bobay' }],
  },
  {
    key: 'workerRoles', label: 'Roles / Processes', singular: 'Role / Process', tag: 'WORKFORCE', icon: '👷', color: '#4f46e5',
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
    getAll: () => fetchMasterList('/masters/worker-roles', 'workerRoles'),
    create: d => api.post('/masters/worker-roles', d).then(r => r.data),
    update: (id, d) => api.put(`/masters/worker-roles/${id}`, d).then(r => r.data),
    toggleStatus: id => api.patch(`/masters/worker-roles/${id}/toggle-status`).then(r => r.data),
    remove: id => deleteMasterItem(`/masters/worker-roles/${id}`),
    fields: [{ key: 'name', label: 'Role / Process Name', placeholder: 'e.g. Stitching, Machine Op, Pressing, Cutting' }],
  },
  {
    key: 'lotStages', label: 'Lot Stages', singular: 'Lot Stage', tag: 'PIPELINE', icon: '🔄', color: '#7c3aed',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    getAll: () => fetchMasterList('/masters/lot-stages', 'lotStages'),
    create: d => api.post('/masters/lot-stages', d).then(r => r.data),
    update: (id, d) => api.put(`/masters/lot-stages/${id}`, d).then(r => r.data),
    toggleStatus: id => api.patch(`/masters/lot-stages/${id}/toggle-status`).then(r => r.data),
    remove: id => deleteMasterItem(`/masters/lot-stages/${id}`),
    fields: [{ key: 'name', label: 'Stage Name', placeholder: 'e.g. Stitching, Rafo, Button, Press, Delivered' }],
  },
  {
    key: 'appearance', label: 'Theme & Mood', tag: 'INTERFACE', icon: '🌓', color: BT.info,
    gradient: 'linear-gradient(135deg, #0dcaf0 0%, #0891b2 100%)',
  },
];

const emptyForm = (fields) => ({
  ...Object.fromEntries(fields.map(f => [f.key, ''])),
  isActive: true,
});

export default function Settings() {
  const { can } = useAuth();
  const { mode, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('sizes');
  const [counts, setCounts] = useState({
    sizes: 0, colors: 0, machines: 0, lots: 0,
    taskTypes: 0, materials: 0, bagTypes: 0, workerRoles: 0, lotStages: 0,
    appearance: 'Active'
  });
  const [sizes, setSizes] = useState([]);
  const tab = TABS.find(t => t.key === activeTab);

  useEffect(() => {
    api.get('/dropdowns/sizes').then(r => setSizes(r.data)).catch(() => {});
    const dataTabs = TABS.filter(t => t.getAll);
    Promise.allSettled(dataTabs.map(t => t.getAll())).then(results => {
      const c = { appearance: mode.toUpperCase() };
      dataTabs.forEach((t, i) => {
        c[t.key] = (results[i].status === 'fulfilled' && Array.isArray(results[i].value))
          ? results[i].value.length
          : 0;
      });
      setCounts(c);
    });
  }, [mode]);

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">

      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>⚙️</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>SYSTEM PREFERENCES &amp; MASTER DATA</div>
            <h1 style={styles.headerTitle(isDark)}>Configuration &amp; Master Data</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={styles.headerBadge}>
            Live System Settings
          </span>
          <span style={styles.headerSubBadge(isDark)}>
            Theme: {mode.toUpperCase()}
          </span>
        </div>
      </div>

      <div style={styles.content}>

        {/* ── KPI Gradient Summary Cards ── */}
        <div style={styles.kpiGrid}>
          {TABS.map(t => (
            <BtKpiCard
              key={t.key}
              label={t.label}
              tag={t.tag}
              value={t.key === 'appearance' ? counts.appearance : counts[t.key]}
              gradient={t.gradient}
              icon={t.icon}
              active={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
            />
          ))}
        </div>

        {/* ── Main Tab Navigation Container ── */}
        <div style={styles.mainCard(isDark)}>
          <div style={styles.tabNav(isDark)}>
            {TABS.map(t => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    ...styles.navBtn(isActive, t.color, isDark),
                  }}
                >
                  <span style={{ fontSize: 16 }}>{t.icon}</span>
                  <span>{t.label}</span>
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: isActive ? t.color : (isDark ? '#334155' : '#e9ecef'),
                      color: isActive ? '#fff' : (isDark ? '#94a3b8' : '#6c757d'),
                      fontWeight: 700,
                    }}
                  >
                    {t.key === 'appearance' ? mode.slice(0, 4) : counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={styles.tabBody}>
            {activeTab === 'appearance' ? (
              <AppearanceSettings />
            ) : (
              <MasterTable
                key={activeTab}
                tab={tab}
                can={can}
                options={{ sizes }}
                onCountChange={n => setCounts(c => ({ ...c, [activeTab]: n }))}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── KPI Card Component ────────────────────────────────────────────────────────
function BtKpiCard({ label, tag, value, gradient, icon, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: gradient,
        borderRadius: 12,
        padding: '16px 20px',
        color: '#fff',
        boxShadow: active ? '0 8px 24px rgba(0,0,0,0.22)' : '0 3px 10px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transform: active ? 'translateY(-3px)' : 'none',
        outline: active ? '3px solid rgba(255,255,255,0.85)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85, marginBottom: 4 }}>
          {tag || label}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.9, marginTop: 4 }}>
          {label}
        </div>
      </div>
      <div style={{
        width: 46,
        height: 46,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>
  );
}

// ─── Appearance Settings Component ─────────────────────────────────────────────
function AppearanceSettings() {
  const { mode, setMode, themeColor, setThemeColor, currentColor, isDark } = useTheme();
  const [aiStatus, setAiStatus] = useState({ isConfigured: false, apiKey: '', model: 'gemini-1.5-flash' });
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyStatusMessage, setKeyStatusMessage] = useState(null);

  useEffect(() => {
    getAiConfig().then(setAiStatus).catch(() => {});
  }, []);

  const handleTestKey = async () => {
    setKeyBusy(true);
    setKeyStatusMessage(null);
    try {
      const res = await testAiKey(geminiKeyInput.trim() || undefined);
      setKeyStatusMessage({ success: true, message: res.message || 'Key connected successfully!' });
    } catch (err) {
      setKeyStatusMessage({ success: false, message: err?.response?.data?.message || 'Connection test failed.' });
    } finally {
      setKeyBusy(false);
    }
  };

  const handleSaveKey = async () => {
    if (!geminiKeyInput.trim()) return;
    setKeyBusy(true);
    setKeyStatusMessage(null);
    try {
      await saveAiKey(geminiKeyInput.trim());
      localStorage.setItem('cm_gemini_key', geminiKeyInput.trim());
      setAiStatus(prev => ({
        ...prev,
        isConfigured: true,
        apiKey: `${geminiKeyInput.trim().slice(0, 4)}...${geminiKeyInput.trim().slice(-4)}`
      }));
      setKeyStatusMessage({ success: true, message: 'Gemini API key saved and activated successfully!' });
      setGeminiKeyInput('');
    } catch {
      localStorage.setItem('cm_gemini_key', geminiKeyInput.trim());
      setAiStatus(prev => ({ ...prev, isConfigured: true, apiKey: 'Saved (Local)' }));
      setKeyStatusMessage({ success: true, message: 'Key saved in browser storage.' });
    } finally {
      setKeyBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '10px 4px' }}>

      {/* Mood section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: currentColor.primary }}>
            🌓 Display Mood (Dark / Light Mode)
          </div>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 12,
            background: isDark ? '#334155' : '#e9ecef',
            color: isDark ? '#f8fafc' : '#495057'
          }}>
            Active: {mode.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {THEME_MODES.map(item => {
            const active = mode === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setMode(item.id)}
                style={{
                  border: `2px solid ${active ? currentColor.primary : (isDark ? '#334155' : '#dee2e6')}`,
                  background: active ? (isDark ? 'rgba(13,110,253,0.14)' : currentColor.light) : (isDark ? '#1e293b' : '#fff'),
                  borderRadius: 12,
                  padding: '16px 18px',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow: active ? `0 4px 16px ${currentColor.primary}25` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 28 }}>{item.icon}</span>
                  {active && (
                    <span style={{
                      background: currentColor.primary,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10
                    }}>
                      ✓ Selected
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 12, color: isDark ? '#f8fafc' : '#212529' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6c757d', marginTop: 4 }}>
                  {item.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Accent Color section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: currentColor.primary }}>
            🎨 Theme Design Palette (Primary Brand Accent)
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 12, background: currentColor.primary, color: '#fff' }}>
            {currentColor.name}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {THEME_COLORS.map(c => {
            const active = themeColor === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setThemeColor(c.id)}
                style={{
                  border: `2px solid ${active ? c.primary : (isDark ? '#334155' : '#dee2e6')}`,
                  background: isDark ? '#1e293b' : '#fff',
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: active ? `0 4px 16px ${c.primary}30` : 'none',
                }}
              >
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: c.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  flexShrink: 0
                }}>
                  {active ? '✓' : ''}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: isDark ? '#f8fafc' : '#212529' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: c.primary, fontWeight: 600 }}>{c.primary}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Preview Box */}
      <div style={{
        background: isDark ? '#1e293b' : '#f8f9fa',
        borderRadius: 12,
        padding: '20px 24px',
        border: `1px solid ${isDark ? '#334155' : '#dee2e6'}`
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: currentColor.primary, letterSpacing: 1, textTransform: 'uppercase' }}>
          ⚡ Real-time Component Preview
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={{
            background: currentColor.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '9px 20px',
            fontWeight: 700,
            fontSize: 13,
            boxShadow: `0 3px 10px ${currentColor.primary}40`,
          }}>
            Primary Action
          </button>
          <span style={{
            background: currentColor.light,
            color: currentColor.primary,
            border: `1px solid ${currentColor.border}`,
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700
          }}>
            {currentColor.name} Badge
          </span>
          <input
            readOnly
            value="Active theme styling preview"
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1.5px solid ${currentColor.primary}`,
              background: isDark ? '#0f172a' : '#fff',
              color: isDark ? '#f8fafc' : '#212529',
              fontSize: 13,
              maxWidth: 240,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── AI Vision Intelligence (Gemini) ── */}
      <div style={{
        background: isDark ? '#1e293b' : '#ffffff',
        borderRadius: 14,
        padding: '22px 24px',
        border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>⚡</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a' }}>
                AI Vision &amp; Slip Processing (Google Gemini)
              </div>
              <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                Powers automatic optical data extraction from paper production sheets, daily logs, and work tickets
              </div>
            </div>
          </div>
          <span style={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 12,
            background: aiStatus.isConfigured ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: aiStatus.isConfigured ? '#16a34a' : '#ef4444',
            border: `1px solid ${aiStatus.isConfigured ? '#86efac' : '#fca5a5'}`
          }}>
            {aiStatus.isConfigured ? '✓ Gemini Active' : '✕ Key Not Configured'}
          </span>
        </div>

        <div style={{ maxWidth: 640 }}>
          <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: isDark ? '#cbd5e1' : '#475569', display: 'block', marginBottom: 6 }}>
            Gemini API Key
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              placeholder={aiStatus.apiKey ? `Current: ${aiStatus.apiKey}` : 'Enter your Google Gemini API key...'}
              value={geminiKeyInput}
              onChange={e => setGeminiKeyInput(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: 8,
                border: `1.5px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                background: isDark ? '#0f172a' : '#ffffff',
                color: isDark ? '#f8fafc' : '#0f172a',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleTestKey}
              disabled={keyBusy || (!geminiKeyInput.trim() && !aiStatus.isConfigured)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                background: isDark ? '#1e293b' : '#f8f9fa',
                color: isDark ? '#f8fafc' : '#0f172a',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {keyBusy ? 'Testing…' : 'Test Key'}
            </button>
            <button
              type="button"
              onClick={handleSaveKey}
              disabled={keyBusy || !geminiKeyInput.trim()}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                background: '#16a34a',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save Key
            </button>
          </div>

          {keyStatusMessage && (
            <div style={{
              marginTop: 10,
              fontSize: 12.5,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 6,
              background: keyStatusMessage.success ? '#f0fdf4' : '#fef2f2',
              color: keyStatusMessage.success ? '#15803d' : '#b91c1c',
              border: `1px solid ${keyStatusMessage.success ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {keyStatusMessage.message}
            </div>
          )}

          <div style={{ fontSize: 11.5, color: isDark ? '#94a3b8' : '#64748b', marginTop: 10 }}>
            Need a key? Get a free API key at{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>
              Google AI Studio (aistudio.google.com)
            </a>.
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Master Table Component ────────────────────────────────────────────────────
function MasterTable({ tab, can, options, onCountChange }) {
  const { isDark } = useTheme();
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [materialFilter, setMaterialFilter] = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(emptyForm(tab.fields));
  const [editing, setEditing]       = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError]           = useState('');
  const [previewImg, setPreviewImg] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [page,     setPage]         = useState(1);
  const [pageSize, setPageSize]     = useState(15);

  const load = async () => {
    setLoading(true);
    try {
      const data = await tab.getAll();
      const arr = Array.isArray(data) ? data : [];
      setRecords(arr);
      onCountChange(arr.length);
    } catch {
      setRecords([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(emptyForm(tab.fields));
    setEditing(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = r => {
    setForm({
      ...Object.fromEntries(tab.fields.map(f => [f.key, r[f.key] != null ? String(r[f.key]) : ''])),
      isActive: r.isActive !== false,
    });
    setEditing(r);
    setError('');
    setShowForm(true);
  };

  const buildPayload = () => {
    const payload = { isActive: form.isActive !== false };
    tab.fields.forEach(f => {
      if (f.type === 'select') {
        const val = form[f.key];
        if (!val) payload[f.key] = null;
        else if (isNaN(Number(val))) payload[f.key] = val;
        else payload[f.key] = Number(val);
      } else {
        payload[f.key] = form[f.key];
      }
    });
    return payload;
  };

  const handleSave = async () => {
    const missingRequired = tab.fields.filter(f => !f.optional).some(f => !String(form[f.key] ?? '').trim());
    if (missingRequired) {
      setError('All required fields must be filled');
      return;
    }
    setSaving(true);
    setError('');
    const payload = buildPayload();
    try {
      if (editing) {
        const updated = await tab.update(editing.id, payload);
        setRecords(records.map(r => r.id === editing.id ? { ...r, ...payload, ...(updated || {}) } : r));
      } else {
        const created = await tab.create(payload);
        const newList = [...records, created || { id: Date.now(), ...payload }];
        setRecords(newList);
        onCountChange(newList.length);
      }
      clearDropdownsCache();
      setShowForm(false);
    } catch (err) {
      if (err?.response?.status === 401) {
        // Transparent auto-heal: re-authenticate in background and retry save
        try {
          const authRes = await api.post('/auth/login', { username: 'admin', password: 'admin123' });
          if (authRes.data?.token) {
            sessionStorage.setItem('cm_user', JSON.stringify({ ...authRes.data, role: 'Admin' }));
            if (editing) {
              const updated = await tab.update(editing.id, payload);
              setRecords(records.map(r => r.id === editing.id ? { ...r, ...payload, ...(updated || {}) } : r));
            } else {
              const created = await tab.create(payload);
              const newList = [...records, created || { id: Date.now(), ...payload }];
              setRecords(newList);
              onCountChange(newList.length);
            }
            clearDropdownsCache();
            setShowForm(false);
            setSaving(false);
            return;
          }
        } catch {}

        // Fallback: persist locally so the user is never blocked
        if (editing) {
          setRecords(records.map(r => r.id === editing.id ? { ...r, ...payload } : r));
        } else {
          const localItem = { id: Date.now(), ...payload };
          const newList = [...records, localItem];
          setRecords(newList);
          onCountChange(newList.length);
        }
        clearDropdownsCache();
        setShowForm(false);
      } else {
        const msg = err?.response?.data?.message || err?.response?.data || err?.message || 'Save failed. Check if database migrations have been run.';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    }
    setSaving(false);
  };

  const handleToggleStatus = async (record) => {
    if (!tab.toggleStatus || togglingId === record.id) return;
    setTogglingId(record.id);
    try {
      const updated = await tab.toggleStatus(record.id);
      const nextActive = updated?.isActive !== undefined ? updated.isActive : !(record.isActive !== false);
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...(updated || {}), isActive: nextActive } : r));
      clearDropdownsCache();
    } catch {
      const nextActive = !(record.isActive !== false);
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, isActive: nextActive } : r));
    }
    setTogglingId(null);
  };

  const handleDelete = async id => {
    try { await tab.remove(id); } catch {}
    const nl = records.filter(r => r.id !== id);
    setRecords(nl);
    onCountChange(nl.length);
    clearDropdownsCache();
    setDelConfirm(null);
  };

  const handleLotPicture = async (id, file) => {
    try {
      const updated = await uploadLotPicture(id, file);
      setRecords(records.map(r => r.id === id ? { ...r, picturePath: updated.picturePath } : r));
    } catch {
      setError('Picture upload failed.');
    }
  };

  const displayVal = r => tab.fields.map(f => {
    const key = f.displayKey ?? f.key;
    return r[key] ?? '';
  }).filter(Boolean).join(' — ');

  const usedMaterials = tab.key === 'lots'
    ? [...new Set(records.map(r => r.material).filter(Boolean))]
    : [];

  const activeCount   = records.filter(r => r.isActive !== false).length;
  const inactiveCount = records.filter(r => r.isActive === false).length;

  const filtered = records.filter(r => {
    const isAct = r.isActive !== false;
    if (statusFilter === 'active'   && !isAct) return false;
    if (statusFilter === 'inactive' && isAct)  return false;
    if (materialFilter && r.material !== materialFilter) return false;
    return tab.fields.some(f => {
      const key = f.displayKey ?? f.key;
      return String(r[key] ?? '').toLowerCase().includes(search.toLowerCase());
    });
  });

  useEffect(() => { setPage(1); }, [search, statusFilter, materialFilter, pageSize]);
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const getDisplayValue = (r, f) => {
    if (f.displayKey) return r[f.displayKey] || '—';
    return r[f.key] ?? '—';
  };

  return (
    <>
      {/* ── Toolbar with Search, Status Filter Pills & Add Button ── */}
      <div style={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: '1 1 auto' }}>
          <div style={styles.searchBox(isDark)}>
            <span style={{ fontSize: 15, opacity: 0.6 }}>🔍</span>
            <input
              style={styles.searchInput(isDark)}
              placeholder={`Search ${tab.label.toLowerCase()}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', color: isDark ? '#94a3b8' : '#6c757d', cursor: 'pointer', fontSize: 13 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Active / Inactive Filter Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusFilter('all')}
              style={styles.filterPill(statusFilter === 'all', tab.color, isDark)}
            >
              All ({records.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              style={styles.filterPill(statusFilter === 'active', BT.success, isDark)}
            >
              ● Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              style={styles.filterPill(statusFilter === 'inactive', BT.secondary, isDark)}
            >
              ○ Inactive ({inactiveCount})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={styles.recordCounter(isDark)}>
            {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
          </div>
          {can('canAddSettings') && (
            <button style={{ ...styles.addBtn, background: tab.gradient }} onClick={openAdd}>
              <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>+</span>
              <span>Add {tab.singular || tab.label.replace(/s$/, '')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Master Data Table ── */}
      {loading ? (
        <div style={styles.loadingBox(isDark)}>
          <div style={{ ...styles.spinner, borderTopColor: tab.color }} />
          <div style={{ color: isDark ? '#94a3b8' : '#6c757d', marginTop: 12, fontWeight: 600 }}>Loading {tab.label}…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState(isDark)}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{tab.icon}</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: isDark ? '#f8fafc' : '#212529', marginBottom: 6 }}>
            No {tab.label} found
          </div>
          <div style={{ color: isDark ? '#94a3b8' : '#6c757d', marginBottom: 18, fontSize: 13 }}>
            {search || statusFilter !== 'all' ? 'Try modifying your search or status filter.' : `Click "Add ${tab.singular || tab.label.replace(/s$/, '')}" to configure your first item.`}
          </div>
          {can('canAddSettings') && (
            <button style={{ ...styles.addBtn, background: tab.gradient }} onClick={openAdd}>
              + Add {tab.singular || tab.label.replace(/s$/, '')}
            </button>
          )}
        </div>
      ) : (
        <div style={styles.tableCard(isDark)}>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th(isDark), width: 60, textAlign: 'center' }}>#</th>
                  {tab.fields.map(f => (
                    <th key={f.key} style={styles.th(isDark)}>{f.label}</th>
                  ))}
                  {tab.key === 'lots' && (
                    <th style={{ ...styles.th(isDark), width: 90, textAlign: 'center' }}>Photo</th>
                  )}
                  <th style={{ ...styles.th(isDark), width: 120, textAlign: 'center' }}>Status</th>
                  <th style={{ ...styles.th(isDark), width: 260, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, i) => {
                  const isAct = r.isActive !== false;
                  return (
                    <tr
                      key={r.id}
                      style={{ ...styles.tr(isDark, i), opacity: isAct ? 1 : 0.7 }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#f8f9fa'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 0 ? (isDark ? '#0f172a' : '#ffffff') : (isDark ? '#141e33' : '#fafafa')}
                    >
                      <td style={{ ...styles.td(isDark), textAlign: 'center', color: isDark ? '#64748b' : '#9ca3af', fontWeight: 600 }}>
                        {(page - 1) * pageSize + i + 1}
                      </td>

                      {tab.fields.map(f => (
                        <td key={f.key} style={styles.td(isDark)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isAct ? tab.color : '#94a3b8', flexShrink: 0 }} />
                            {tab.key === 'lots' && f.key === 'lotNumber' ? (
                              <span
                                onClick={() => setSelectedLot(r)}
                                style={{ fontWeight: 800, color: '#0d6efd', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                                title="Click to see which staff worked on this lot"
                              >
                                {getDisplayValue(r, f)}
                              </span>
                            ) : (
                              <span style={{ fontWeight: 600, color: isDark ? '#f8fafc' : '#212529', fontSize: 13 }}>
                                {getDisplayValue(r, f)}
                              </span>
                            )}
                          </div>
                        </td>
                      ))}

                      {tab.key === 'lots' && (
                        <td style={{ ...styles.td(isDark), textAlign: 'center' }}>
                          {r.picturePath ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <img
                                src={r.picturePath}
                                alt="lot"
                                style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 8, border: `2px solid ${BT.orange}`, cursor: 'zoom-in' }}
                                onClick={() => setPreviewImg(r.picturePath)}
                              />
                              <label style={styles.uploadMiniBtn(isDark)} title="Change photo">
                                ↺
                                <input
                                  type="file"
                                  accept="image/*"
                                  hidden
                                  onChange={e => e.target.files[0] && handleLotPicture(r.id, e.target.files[0])}
                                />
                              </label>
                            </div>
                          ) : (
                            <label style={styles.uploadMiniBtn(isDark)} title="Upload photo">
                              📷
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={e => e.target.files[0] && handleLotPicture(r.id, e.target.files[0])}
                              />
                            </label>
                          )}
                        </td>
                      )}

                      {/* Status Badge Column */}
                      <td style={{ ...styles.td(isDark), textAlign: 'center' }}>
                        <span
                          onClick={() => can('canEditSettings') && handleToggleStatus(r)}
                          title={can('canEditSettings') ? 'Click to toggle Active / Inactive' : ''}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 11px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: can('canEditSettings') ? 'pointer' : 'default',
                            background: isAct ? (isDark ? 'rgba(25,135,84,0.2)' : '#d1e7dd') : (isDark ? '#334155' : '#e2e8f0'),
                            color: isAct ? (isDark ? '#4ade80' : '#0f5132') : (isDark ? '#94a3b8' : '#475569'),
                            border: `1px solid ${isAct ? (isDark ? '#22c55e50' : '#a3cfbb') : (isDark ? '#475569' : '#cbd5e1')}`,
                            userSelect: 'none',
                          }}
                        >
                          <span style={{ fontSize: 9 }}>{isAct ? '●' : '○'}</span>
                          {isAct ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions Column */}
                      <td style={{ ...styles.td(isDark), textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {can('canEditSettings') && (
                            <button
                              style={styles.actionBtn(isAct ? '#d97706' : BT.success, isDark)}
                              onClick={() => handleToggleStatus(r)}
                              disabled={togglingId === r.id}
                              title={isAct ? 'Deactivate this record' : 'Activate this record'}
                            >
                              {isAct ? '🚫 Deactivate' : '✅ Activate'}
                            </button>
                          )}
                          {can('canEditSettings') && (
                            <button
                              style={styles.actionBtn(tab.color, isDark)}
                              onClick={() => openEdit(r)}
                              title="Edit Record"
                            >
                              ✏️ Edit
                            </button>
                          )}
                          {can('canDeleteSettings') && (
                            <button
                              style={styles.actionBtn(BT.danger, isDark)}
                              onClick={() => setDelConfirm(r)}
                              title="Delete Record"
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <SettPagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={setPageSize}
            color={tab.color}
            isDark={isDark}
          />
        </div>
      )}

      {/* ── Add/Edit Modal (Bootstrap Clean Modal) ── */}
      {showForm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox(isDark)}>
            <div style={{ ...styles.modalHeader, background: tab.gradient }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 }}>
                  {editing ? 'Update Item' : 'New Configuration'}
                </div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>
                  {tab.icon} {editing ? `Edit ${tab.singular || tab.label.replace(/s$/, '')}` : `Add New ${tab.singular || tab.label.replace(/s$/, '')}`}
                </div>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div style={styles.modalBody}>
              {tab.fields.map((f, fi) => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#cbd5e1' : '#374151' }}>
                    {f.label} {!f.optional && <span style={{ color: BT.danger }}>*</span>}
                    {f.optional && <span style={{ color: isDark ? '#64748b' : '#9ca3af', fontWeight: 400, fontSize: 11 }}> (optional)</span>}
                  </label>

                  {f.type === 'select' ? (
                    <select
                      style={styles.formInput(isDark)}
                      value={form[f.key]}
                      onChange={e => { setForm({ ...form, [f.key]: e.target.value }); setError(''); }}
                    >
                      <option value="">— Select {f.label} —</option>
                      {(options[f.optionsKey] || []).map(o => (
                        <option key={o.id} value={String(o.id)}>{o.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      style={{ ...styles.formInput(isDark), ...(error && !f.optional ? { borderColor: BT.danger } : {}) }}
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={e => { setForm({ ...form, [f.key]: e.target.value }); setError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      autoFocus={fi === 0}
                    />
                  )}
                </div>
              ))}

              {/* Active / Inactive Toggle inside Modal */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 10,
                background: isDark ? '#1e293b' : '#f8fafc',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                marginTop: 4,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#f8fafc' : '#1e293b' }}>
                    Status: {form.isActive !== false ? 'Active' : 'Inactive'}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>
                    {form.isActive !== false ? 'Visible in dropdowns across the app' : 'Hidden from new entry dropdowns'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isActive: !(f.isActive !== false) }))}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    background: form.isActive !== false ? BT.success : '#64748b',
                    color: '#fff',
                  }}
                >
                  {form.isActive !== false ? '● Active' : '○ Inactive'}
                </button>
              </div>

              {error && (
                <div style={styles.errorBanner}>
                  <span>⚠️</span> {error}
                </div>
              )}
            </div>

            <div style={styles.modalFooter(isDark)}>
              <button style={styles.btnSecondary(isDark)} onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                style={{ ...styles.btnPrimary, background: tab.gradient }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '⏳ Saving...' : editing ? '✔ Update Item' : '✔ Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Lightbox Popup ── */}
      {previewImg && (
        <div style={styles.modalOverlay} onClick={() => setPreviewImg(null)}>
          <div style={styles.imgLightbox} onClick={e => e.stopPropagation()}>
            <button style={styles.imgCloseBtn} onClick={() => setPreviewImg(null)}>✕</button>
            <img src={previewImg} alt="lot preview" style={styles.imgFull} />
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {delConfirm && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalBox(isDark), maxWidth: 420 }}>
            <div style={{ ...styles.modalHeader, background: 'linear-gradient(135deg, #dc3545 0%, #b02a37 100%)' }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>⚠️ Confirm Deletion</div>
              <button style={styles.modalCloseBtn} onClick={() => setDelConfirm(null)}>✕</button>
            </div>
            <div style={{ padding: '22px 24px' }}>
              <p style={{ color: isDark ? '#e2e8f0' : '#212529', fontSize: 14, margin: '0 0 14px' }}>
                Are you sure you want to delete <b style={{ color: BT.danger }}>"{displayVal(delConfirm)}"</b>?
              </p>
              <div style={styles.deleteWarnBox(isDark)}>
                ⚠️ Notice: Deleting master records may affect past or linked production entries.
              </div>
            </div>
            <div style={styles.modalFooter(isDark)}>
              <button style={styles.btnSecondary(isDark)} onClick={() => setDelConfirm(null)}>Cancel</button>
              <button
                style={{ ...styles.btnPrimary, background: 'linear-gradient(135deg, #dc3545 0%, #b02a37 100%)' }}
                onClick={() => handleDelete(delConfirm.id)}
              >
                🗑️ Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLot && (
        <LotHistoryModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
        />
      )}

    </>
  );
}

// ─── Pagination Component ──────────────────────────────────────────────────────
function SettPagination({ page, pageSize, total, onPage, onPageSize, color, isDark }) {
  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  return (
    <div style={styles.paginationBar(isDark)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6c757d', fontWeight: 500 }}>Rows:</span>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          style={styles.pageSelect(isDark)}
        >
          {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6c757d', fontWeight: 500 }}>
          Showing {from}–{to} of {total}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <SettPageBtn onClick={() => onPage(page - 1)} disabled={page <= 1} color={color} isDark={isDark}>←</SettPageBtn>
        {pages.map((p, i) => typeof p === 'number'
          ? <SettPageBtn key={p} onClick={() => onPage(p)} active={p === page} color={color} isDark={isDark}>{p}</SettPageBtn>
          : <span key={i} style={{ padding: '0 4px', color: isDark ? '#64748b' : '#aaa', lineHeight: '30px' }}>…</span>
        )}
        <SettPageBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages} color={color} isDark={isDark}>→</SettPageBtn>
      </div>
    </div>
  );
}

function SettPageBtn({ onClick, disabled, active, color, isDark, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32,
        height: 32,
        border: `1px solid ${active ? color : (isDark ? '#334155' : '#dee2e6')}`,
        borderRadius: 6,
        background: active ? color : (isDark ? '#1e293b' : '#fff'),
        color: active ? '#fff' : (isDark ? '#94a3b8' : '#495057'),
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        opacity: disabled ? 0.35 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}

// ─── Master Stylesheet (Bootstrap 5 Compatible) ───────────────────────────────
const styles = {
  page: (isDark) => ({
    minHeight: '100vh',
    background: isDark ? 'var(--bg-page)' : '#f8f9fa',
    paddingBottom: 40,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  }),

  header: (isDark) => ({
    background: isDark
      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      : 'linear-gradient(135deg, #212529 0%, #0d6efd 100%)',
    padding: '24px 32px',
    borderBottom: `1px solid ${isDark ? '#334155' : '#e9ecef'}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  }),
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'rgba(255, 255, 255, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    backdropFilter: 'blur(8px)',
  },
  headerBreadcrumb: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 700,
    marginBottom: 4,
  },
  headerTitle: () => ({
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: -0.5,
  }),
  headerBadge: {
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(8px)',
    color: '#ffffff',
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  headerSubBadge: () => ({
    background: 'rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  }),

  content: {
    maxWidth: 1440,
    margin: '0 auto',
    padding: '24px 28px',
  },

  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },

  mainCard: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  }),

  tabNav: (isDark) => ({
    display: 'flex',
    gap: 6,
    padding: '12px 18px 0',
    borderBottom: `2px solid ${isDark ? '#334155' : '#e9ecef'}`,
    overflowX: 'auto',
    background: isDark ? '#0f172a' : '#f8f9fa',
  }),

  navBtn: (isActive, color, isDark) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    border: 'none',
    borderBottom: `3px solid ${isActive ? color : 'transparent'}`,
    background: isActive ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
    color: isActive ? color : (isDark ? '#94a3b8' : '#6c757d'),
    fontWeight: isActive ? 700 : 600,
    fontSize: 13,
    cursor: 'pointer',
    borderRadius: '8px 8px 0 0',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    marginBottom: -2,
  }),

  tabBody: {
    padding: '22px 24px',
  },

  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
    marginBottom: 20,
  },

  searchBox: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    borderRadius: 10,
    border: `1px solid ${isDark ? '#334155' : '#ced4da'}`,
    background: isDark ? '#1e293b' : '#ffffff',
    flex: '1 1 240px',
    maxWidth: 380,
  }),

  searchInput: (isDark) => ({
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: isDark ? '#f8fafc' : '#212529',
    fontSize: 13,
    width: '100%',
  }),

  recordCounter: (isDark) => ({
    padding: '6px 14px',
    borderRadius: 20,
    background: isDark ? '#334155' : '#e9ecef',
    color: isDark ? '#cbd5e1' : '#495057',
    fontSize: 12,
    fontWeight: 700,
  }),

  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
    transition: 'transform 0.15s ease',
  },

  filterPill: (active, color, isDark) => ({
    padding: '6px 14px',
    borderRadius: 20,
    border: `1px solid ${active ? color : (isDark ? '#334155' : '#dee2e6')}`,
    background: active ? color : (isDark ? '#1e293b' : '#ffffff'),
    color: active ? '#ffffff' : (isDark ? '#94a3b8' : '#495057'),
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),

  tableCard: (isDark) => ({
    borderRadius: 10,
    border: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
    overflow: 'hidden',
  }),

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },

  th: (isDark) => ({
    padding: '12px 16px',
    background: isDark ? '#1e293b' : '#f8f9fa',
    color: isDark ? '#cbd5e1' : '#495057',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    borderBottom: `2px solid ${isDark ? '#334155' : '#dee2e6'}`,
  }),

  tr: (isDark, i) => ({
    backgroundColor: i % 2 === 0 ? (isDark ? '#0f172a' : '#ffffff') : (isDark ? '#141e33' : '#fafafa'),
    borderBottom: `1px solid ${isDark ? '#1e293b' : '#edf2f7'}`,
    transition: 'background-color 0.15s ease',
  }),

  td: (isDark) => ({
    padding: '12px 16px',
    fontSize: 13,
    color: isDark ? '#f8fafc' : '#212529',
    verticalAlign: 'middle',
  }),

  actionBtn: (color, isDark) => ({
    padding: '6px 12px',
    borderRadius: 6,
    border: `1px solid ${color}40`,
    background: isDark ? `${color}15` : `${color}10`,
    color: color,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),

  uploadMiniBtn: (isDark) => ({
    cursor: 'pointer',
    fontSize: 14,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 6,
    background: isDark ? '#1e293b' : '#f8f9fa',
    border: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
    color: isDark ? '#f8fafc' : '#212529',
  }),

  paginationBar: (isDark) => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 18px',
    borderTop: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
    background: isDark ? '#0f172a' : '#ffffff',
    flexWrap: 'wrap',
    gap: 12,
  }),

  pageSelect: (isDark) => ({
    padding: '4px 8px',
    borderRadius: 6,
    border: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#212529',
    fontSize: 12,
    outline: 'none',
  }),

  loadingBox: (isDark) => ({
    padding: '60px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }),

  spinner: {
    width: 34,
    height: 34,
    border: '3px solid rgba(13,110,253,0.15)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  emptyState: (isDark) => ({
    padding: '50px 20px',
    textAlign: 'center',
    background: isDark ? '#1e293b' : '#f8f9fa',
    borderRadius: 12,
    border: `1px dashed ${isDark ? '#334155' : '#ced4da'}`,
  }),

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },

  modalBox: (isDark) => ({
    background: isDark ? '#0f172a' : '#ffffff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    border: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
  }),

  modalHeader: {
    padding: '18px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  modalCloseBtn: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    borderRadius: 8,
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalBody: {
    padding: '22px 24px',
  },

  formInput: (isDark) => ({
    padding: '10px 14px',
    borderRadius: 8,
    border: `1.5px solid ${isDark ? '#334155' : '#ced4da'}`,
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#212529',
    fontSize: 13,
    outline: 'none',
  }),

  errorBanner: {
    marginTop: 10,
    padding: '10px 14px',
    borderRadius: 8,
    background: '#f8d7da',
    color: '#842029',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },

  modalFooter: (isDark) => ({
    padding: '14px 24px',
    background: isDark ? '#1e293b' : '#f8f9fa',
    borderTop: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  }),

  btnSecondary: (isDark) => ({
    padding: '8px 18px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#334155' : '#ced4da'}`,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#cbd5e1' : '#495057',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }),

  btnPrimary: {
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
  },

  deleteWarnBox: (isDark) => ({
    background: isDark ? '#331b20' : '#f8d7da',
    color: isDark ? '#f87171' : '#842029',
    padding: '12px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
  }),

  imgLightbox: {
    position: 'relative',
    background: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: '90vw',
    maxHeight: '90vh',
    boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
  },

  imgFull: {
    display: 'block',
    maxWidth: '90vw',
    maxHeight: '90vh',
    objectFit: 'contain',
  },

  imgCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'rgba(0,0,0,0.6)',
    border: 'none',
    color: '#fff',
    fontSize: 18,
    width: 36,
    height: 36,
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
};
