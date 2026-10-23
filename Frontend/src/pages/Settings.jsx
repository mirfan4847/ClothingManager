import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEME_COLORS, THEME_MODES } from '../context/ThemeContext';
import api, { uploadLotPicture } from '../services/api';

const TABS = [
  {
    key: 'sizes', label: 'Sizes', icon: '📐', color: '#2E75B6', gradient: 'linear-gradient(135deg, #2E75B6, #1a4f8a)',
    getAll: () => api.get('/dropdowns/sizes').then(r => r.data),
    create: d => api.post('/masters/sizes', d).then(r => r.data),
    update: (id,d) => api.put(`/masters/sizes/${id}`, d).then(r => r.data),
    remove: id => api.delete(`/masters/sizes/${id}`),
    fields: [{ key: 'name', label: 'Size Name', placeholder: 'e.g. Mama, Short, Large' }],
  },
  {
    key: 'colors', label: 'Colors', icon: '🎨', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)',
    getAll: () => api.get('/dropdowns/colors').then(r => r.data),
    create: d => api.post('/masters/colors', d).then(r => r.data),
    update: (id,d) => api.put(`/masters/colors/${id}`, d).then(r => r.data),
    remove: id => api.delete(`/masters/colors/${id}`),
    fields: [{ key: 'name', label: 'Color Name', placeholder: 'e.g. Red, Black, Falsa' }],
  },
  {
    key: 'machines', label: 'Machines', icon: '⚙️', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    getAll: () => api.get('/dropdowns/machines').then(r => r.data),
    create: d => api.post('/masters/machines', d).then(r => r.data),
    update: (id,d) => api.put(`/masters/machines/${id}`, d).then(r => r.data),
    remove: id => api.delete(`/masters/machines/${id}`),
    fields: [{ key: 'name', label: 'Machine Name', placeholder: 'e.g. G9-1, G8' }],
  },
  {
    key: 'lots', label: 'Lot Numbers', icon: '📦', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    getAll: () => api.get('/lots').then(r => r.data),
    create: d => api.post('/lots', d).then(r => r.data),
    update: (id,d) => api.put(`/lots/${id}`, d).then(r => r.data),
    remove: id => api.delete(`/lots/${id}`),
    fields: [
      { key: 'lotNumber', label: 'Lot Number', placeholder: 'e.g. Mid-5, M-1' },
      { key: 'sizeId',   label: 'Size',     type: 'select', optionsKey: 'sizes',     displayKey: 'sizeName', optional: true },
      { key: 'material', label: 'Material',  type: 'select', optionsKey: 'materials', displayKey: 'material', optional: true },
    ],
  },
  {
    key: 'appearance', label: 'Theme & Mood', icon: '🌓', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
  },
];

const MATERIAL_OPTIONS = [
  { id: 'Mink',     name: 'Mink' },
  { id: 'Mink Bo',  name: 'Mink Bo' },
  { id: 'Cotton',   name: 'Cotton' },
  { id: 'Polister', name: 'Polister' },
  { id: 'Fleece',   name: 'Fleece' },
  { id: 'Khaddar',  name: 'Khaddar' },
  { id: 'Lawn',     name: 'Lawn' },
  { id: 'Other',    name: 'Other' },
];

const emptyForm = (fields) => Object.fromEntries(fields.map(f => [f.key, '']));

export default function Settings() {
  const { can } = useAuth();
  const { mode, currentColor } = useTheme();
  const [activeTab, setActiveTab] = useState('sizes');
  const [counts, setCounts] = useState({ sizes:0, colors:0, machines:0, lots:0, appearance: 'Active' });
  const [sizes, setSizes] = useState([]);
  const tab = TABS.find(t => t.key === activeTab);

  useEffect(() => {
    api.get('/dropdowns/sizes').then(r => setSizes(r.data)).catch(() => {});
    const dataTabs = TABS.filter(t => t.getAll);
    Promise.allSettled(dataTabs.map(t => t.getAll())).then(results => {
      const c = { appearance: mode.toUpperCase() };
      dataTabs.forEach((t, i) => { c[t.key] = results[i].status === 'fulfilled' ? results[i].value.length : 0; });
      setCounts(c);
    });
  }, [mode]);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>⚙️</div>
          <div>
            <div style={s.headerSub}>Preferences & Master Data</div>
            <div style={s.headerTitle}>Configuration</div>
          </div>
        </div>
        <div style={s.headerDesc}>Manage system appearance, theme mood, and master data</div>
      </div>

      {/* Stats Cards */}
      <div style={s.statsGrid}>
        {TABS.map(t => (
          <div key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ ...s.statCard, ...(activeTab === t.key ? { ...s.statCardActive, boxShadow: `0 8px 25px ${t.color}40` } : {}) }}>
            <div style={{ ...s.statIconBox, background: t.gradient }}>
              <span style={{ fontSize: 22 }}>{t.icon}</span>
            </div>
            <div style={s.statInfo}>
              <div style={{ ...s.statCount, color: activeTab === t.key ? t.color : '#1e2a3b' }}>
                {t.key === 'appearance' ? counts.appearance : counts[t.key]}
              </div>
              <div style={s.statLabel}>{t.label}</div>
            </div>
            {activeTab === t.key && <div style={{ ...s.statDot, background: t.color }} />}
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div style={s.tabCard}>
        <div style={s.tabBar}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ ...s.tabBtn, ...(activeTab === t.key ? { ...s.tabActive, color: t.color, borderColor: t.color, background: t.color + '12' } : {}) }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div style={s.tabContent}>
          {activeTab === 'appearance' ? (
            <AppearanceSettings />
          ) : (
            <MasterTable
              key={activeTab}
              tab={tab}
              can={can}
              options={{ sizes, materials: MATERIAL_OPTIONS }}
              onCountChange={n => setCounts(c => ({ ...c, [activeTab]: n }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const { mode, setMode, themeColor, setThemeColor, currentColor, isDark } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26, padding: '12px 6px' }}>
      {/* Mood section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: currentColor.primary }}>
            🌓 Display Mood (Dark / Light Mode)
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#333' }}>
            Current: {mode.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          {THEME_MODES.map(item => {
            const active = mode === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setMode(item.id)}
                style={{
                  border: `2px solid ${active ? currentColor.primary : (isDark ? '#334155' : '#e2e8f0')}`,
                  background: active ? (isDark ? 'rgba(46,117,182,0.18)' : currentColor.light) : (isDark ? '#0f172a' : '#fff'),
                  borderRadius: 14,
                  padding: '16px 18px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: active ? `0 4px 16px ${currentColor.primary}25` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 28 }}>{item.icon}</span>
                  {active && <span style={{ color: currentColor.primary, fontWeight: 800, fontSize: 12 }}>✓ Selected</span>}
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 10, color: isDark ? '#fff' : '#1e2a3b' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginTop: 4 }}>
                  {item.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Accent Color section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: currentColor.primary }}>
            🎨 Theme Design Palette (Primary Brand Accent)
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: currentColor.primary, color: '#fff' }}>
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
                  border: `2px solid ${active ? c.primary : (isDark ? '#334155' : '#e2e8f0')}`,
                  background: isDark ? '#0f172a' : '#fff',
                  borderRadius: 14,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: active ? `0 4px 16px ${c.primary}30` : 'none',
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                  {active ? '✓' : ''}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: isDark ? '#fff' : '#1e2a3b' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: c.primary, fontWeight: 600 }}>{c.primary}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Preview Box */}
      <div style={{ background: isDark ? '#0f172a' : '#f8f9fa', borderRadius: 14, padding: '20px 24px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: currentColor.primary, letterSpacing: 1, textTransform: 'uppercase' }}>
          ⚡ Real-time Component Preview
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={{ background: currentColor.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13 }}>
            Primary Action
          </button>
          <span style={{ background: currentColor.light, color: currentColor.primary, border: `1px solid ${currentColor.border}`, borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>
            {currentColor.name} Badge
          </span>
          <input
            readOnly
            value="Active theme styling"
            style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${currentColor.primary}`, fontSize: 13, maxWidth: 200 }}
          />
        </div>
      </div>
    </div>
  );
}

function MasterTable({ tab, can, options, onCountChange }) {
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(emptyForm(tab.fields));
  const [editing, setEditing]       = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [previewImg, setPreviewImg] = useState(null);
  const [page,     setPage]         = useState(1);
  const [pageSize, setPageSize]     = useState(15);

  const load = async () => {
    setLoading(true);
    try {
      const data = await tab.getAll();
      const arr = Array.isArray(data) ? data : [];
      setRecords(arr);
      onCountChange(arr.length);
    } catch { setRecords([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(emptyForm(tab.fields)); setEditing(null); setError(''); setShowForm(true); };
  const openEdit = r  => {
    setForm(Object.fromEntries(tab.fields.map(f => [f.key, r[f.key] != null ? String(r[f.key]) : ''])));
    setEditing(r); setError(''); setShowForm(true);
  };

  const buildPayload = () => {
    const payload = {};
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
    if (missingRequired) { setError('All required fields must be filled'); return; }
    setSaving(true); setError('');
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
      setShowForm(false);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data || err?.message || 'Save failed. Check if database migrations have been run.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    setSaving(false);
  };

  const handleDelete = async id => {
    try { await tab.remove(id); } catch {}
    const nl = records.filter(r => r.id !== id);
    setRecords(nl); onCountChange(nl.length); setDelConfirm(null);
  };

  const handleLotPicture = async (id, file) => {
    try {
      const updated = await uploadLotPicture(id, file);
      setRecords(records.map(r => r.id === id ? { ...r, picturePath: updated.picturePath } : r));
    } catch { setError('Picture upload failed.'); }
  };

  const displayVal = r => tab.fields.map(f => {
    const key = f.displayKey ?? f.key;
    return r[key] ?? '';
  }).filter(Boolean).join(' — ');

  const usedMaterials = tab.key === 'lots'
    ? [...new Set(records.map(r => r.material).filter(Boolean))]
    : [];

  const filtered = records.filter(r => {
    if (materialFilter && r.material !== materialFilter) return false;
    return tab.fields.some(f => {
      const key = f.displayKey ?? f.key;
      return String(r[key] ?? '').toLowerCase().includes(search.toLowerCase());
    });
  });

  useEffect(() => { setPage(1); }, [search, materialFilter, pageSize]);
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const getDisplayValue = (r, f) => {
    if (f.displayKey) return r[f.displayKey] || '—';
    return r[f.key] ?? '';
  };

  return (
    <>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <div style={s.searchWrap}>
          <span style={s.searchIcon}>🔍</span>
          <input style={s.searchInput} placeholder={`Search ${tab.label}...`}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={s.toolRight}>
          <div style={s.badge}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
          <button style={{ ...s.addBtn, background: tab.gradient }} onClick={openAdd}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>+</span>
            <span>Add New</span>
          </button>
        </div>
      </div>

      {/* Material filter pills — lots tab only */}
      {tab.key === 'lots' && usedMaterials.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          <button
            onClick={() => setMaterialFilter('')}
            style={{ ...s.pill, ...(materialFilter === '' ? { background: tab.color, color:'#fff', borderColor: tab.color } : {}) }}>
            All
          </button>
          {usedMaterials.map(m => (
            <button key={m}
              onClick={() => setMaterialFilter(materialFilter === m ? '' : m)}
              style={{ ...s.pill, ...(materialFilter === m ? { background: tab.color, color:'#fff', borderColor: tab.color } : {}) }}>
              {m} <span style={{ fontSize:11, opacity:0.8 }}>({records.filter(r => r.material === m).length})</span>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={s.loadWrap}>
          <div style={{ ...s.spinner, borderTopColor: tab.color }} />
          <span style={{ color: '#888', marginTop: 12 }}>Loading {tab.label}...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={s.emptyWrap}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{tab.icon}</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: '#374151', marginBottom: 6 }}>No {tab.label} yet</div>
          <div style={{ color: '#9ca3af', marginBottom: 20, fontSize: 14 }}>Click "Add New" to create your first record</div>
          {can('canAddSettings') && (
            <button style={{ ...s.addBtn, background: tab.gradient }} onClick={openAdd}>+ Add {tab.label}</button>
          )}
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, width: 60 }}>#</th>
                {tab.fields.map(f => <th key={f.key} style={s.th}>{f.label}</th>)}
                {tab.key === 'lots' && <th style={{ ...s.th, width: 80, textAlign: 'center' }}>Photo</th>}
                <th style={{ ...s.th, width: 160, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, i) => (
                <tr key={r.id} style={s.tr}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <td style={{ ...s.td, color: '#9ca3af', fontWeight: 500, textAlign: 'center' }}>{(page - 1) * pageSize + i + 1}</td>
                  {tab.fields.map(f => (
                    <td key={f.key} style={s.td}>
                      <div style={s.valueWrap}>
                        <div style={{ ...s.colorDot, background: tab.color }} />
                        <span style={s.valueText}>{getDisplayValue(r, f)}</span>
                      </div>
                    </td>
                  ))}
                  {tab.key === 'lots' && (
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      {r.picturePath
                        ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                            <img
                              src={r.picturePath} alt="lot"
                              style={{ ...s.lotThumb, cursor:'zoom-in' }}
                              onClick={() => setPreviewImg(r.picturePath)}
                            />
                            <label style={s.uploadBtn} title="Change photo">
                              ↺
                              <input type="file" accept="image/*" hidden
                                onChange={e => e.target.files[0] && handleLotPicture(r.id, e.target.files[0])} />
                            </label>
                          </div>
                        : <label style={s.uploadBtn} title="Upload photo">
                            📷
                            <input type="file" accept="image/*" hidden
                              onChange={e => e.target.files[0] && handleLotPicture(r.id, e.target.files[0])} />
                          </label>
                      }
                    </td>
                  )}
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <div style={s.actionBtns}>
                      {can('canEditSettings') && (
                        <button style={{ ...s.editBtn, color: tab.color, borderColor: tab.color + '40' }}
                          onClick={() => openEdit(r)}
                          onMouseEnter={e => { e.currentTarget.style.background = tab.color; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = tab.color; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = tab.color; e.currentTarget.style.borderColor = tab.color + '40'; }}>
                          ✏️ Edit
                        </button>
                      )}
                      {can('canDeleteSettings') && (
                        <button style={s.delBtn} onClick={() => setDelConfirm(r)}
                          onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#ef4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef444440'; }}>
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <SettPagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} color={tab.color} />
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ ...s.modalHeader, background: tab.gradient }}>
              <div>
                <div style={{ color:'rgba(255,255,255,0.7)', fontSize:11, textTransform:'uppercase', letterSpacing:1.2, marginBottom:4 }}>
                  {editing ? 'Edit Record' : 'New Record'}
                </div>
                <div style={{ color:'#fff', fontWeight:700, fontSize:18 }}>
                  {tab.icon} {editing ? `Edit ${tab.label}` : `Add New ${tab.label}`}
                </div>
              </div>
              <button style={s.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {tab.fields.map((f, fi) => (
                <div key={f.key} style={s.formGroup}>
                  <label style={s.formLabel}>
                    {f.label} {!f.optional && <span style={{ color:'#ef4444' }}>*</span>}
                    {f.optional && <span style={{ color:'#9ca3af', fontWeight:400, fontSize:11 }}> (optional)</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      style={{ ...s.formInput, color: form[f.key] ? '#1e2a3b' : '#9ca3af' }}
                      value={form[f.key]}
                      onChange={e => { setForm({ ...form, [f.key]: e.target.value }); setError(''); }}
                      onFocus={e => { e.target.style.borderColor = tab.color; e.target.style.boxShadow = `0 0 0 3px ${tab.color}20`; }}
                      onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}>
                      <option value="">— Select {f.label} —</option>
                      {(options[f.optionsKey] || []).map(o => (
                        <option key={o.id} value={String(o.id)}>{o.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      style={{ ...s.formInput, ...(error && !f.optional ? { borderColor:'#ef4444' } : {}) }}
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={e => { setForm({ ...form, [f.key]: e.target.value }); setError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      onFocus={e => { e.target.style.borderColor = tab.color; e.target.style.boxShadow = `0 0 0 3px ${tab.color}20`; }}
                      onBlur={e => { e.target.style.borderColor = (error && !f.optional) ? '#ef4444' : '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                      autoFocus={fi === 0}
                    />
                  )}
                </div>
              ))}
              {error && (
                <div style={s.errorBox}>
                  <span>⚠️</span> {error}
                </div>
              )}
            </div>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={{ ...s.confirmBtn, background: tab.gradient }} onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Saving...' : editing ? '✔ Update' : '✔ Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Popup */}
      {previewImg && (
        <div style={s.overlay} onClick={() => setPreviewImg(null)}>
          <div style={s.imgPopup} onClick={e => e.stopPropagation()}>
            <button style={s.imgCloseBtn} onClick={() => setPreviewImg(null)}>✕</button>
            <img src={previewImg} alt="lot preview" style={s.imgFull} />
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {delConfirm && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 420 }}>
            <div style={{ ...s.modalHeader, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
              <div style={{ color:'#fff', fontWeight:700, fontSize:18 }}>⚠️ Confirm Delete</div>
              <button style={s.closeBtn} onClick={() => setDelConfirm(null)}>✕</button>
            </div>
            <div style={{ padding:'1.8rem' }}>
              <p style={{ color:'#374151', fontSize:15, marginBottom:12 }}>
                Are you sure you want to delete <b style={{ color:'#1e2a3b' }}>"{displayVal(delConfirm)}"</b>?
              </p>
              <div style={s.warnBox}>
                ⚠️ This may affect existing records linked to this item.
              </div>
            </div>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setDelConfirm(null)}>Cancel</button>
              <button style={{ ...s.confirmBtn, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                onClick={() => handleDelete(delConfirm.id)}>
                🗑️ Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SettPagination({ page, pageSize, total, onPage, onPageSize, color }) {
  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const pages = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderTop:'2px solid #f1f5f9', flexWrap:'wrap', justifyContent:'space-between', background:'#fff' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:13, color:'#6b7280' }}>Rows per page:</span>
        <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))} style={{ border:'1px solid #e5e7eb', borderRadius:6, padding:'4px 8px', fontSize:13 }}>
          {[10,15,25,50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize:13, color:'#6b7280' }}>Showing {from}–{to} of {total}</span>
      </div>
      <div style={{ display:'flex', gap:4 }}>
        <SettPageBtn onClick={() => onPage(page - 1)} disabled={page <= 1} color={color}>←</SettPageBtn>
        {pages.map((p, i) => typeof p === 'number'
          ? <SettPageBtn key={p} onClick={() => onPage(p)} active={p === page} color={color}>{p}</SettPageBtn>
          : <span key={i} style={{ padding:'0 4px', color:'#aaa', lineHeight:'30px' }}>…</span>)}
        <SettPageBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages} color={color}>→</SettPageBtn>
      </div>
    </div>
  );
}
function SettPageBtn({ onClick, disabled, active, color, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ minWidth:30, height:30, border:`1px solid ${active ? color : '#e5e7eb'}`, borderRadius:6, background: active ? color : '#fff', color: active ? '#fff' : '#6b7280', cursor: disabled ? 'default' : 'pointer', fontSize:13, fontWeight: active ? 700 : 400, opacity: disabled ? 0.4 : 1 }}>
      {children}
    </button>
  );
}

const s = {
  page:         { fontFamily:"'Segoe UI',Arial,sans-serif", background:'#f1f5f9', minHeight:'100vh' },
  header:       { background:'linear-gradient(135deg, #1e2a3b 0%, #2d3f57 100%)', padding:'1.5rem 2rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
  headerLeft:   { display:'flex', alignItems:'center', gap:14 },
  headerIcon:   { fontSize:36, background:'rgba(255,255,255,0.1)', padding:'10px', borderRadius:12 },
  headerSub:    { color:'rgba(255,255,255,0.5)', fontSize:11, letterSpacing:1.5, textTransform:'uppercase', marginBottom:4 },
  headerTitle:  { color:'#fff', fontSize:'1.6rem', fontWeight:700, letterSpacing:-0.5 },
  headerDesc:   { color:'rgba(255,255,255,0.5)', fontSize:13 },
  statsGrid:    { display:'flex', gap:16, padding:'1.5rem 2rem', flexWrap:'wrap' },
  statCard:     { flex:1, minWidth:160, background:'#fff', borderRadius:14, padding:'1.2rem', display:'flex', alignItems:'center', gap:14, cursor:'pointer', border:'2px solid transparent', transition:'all .2s', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' },
  statCardActive:{ border:'2px solid currentColor', transform:'translateY(-2px)' },
  statIconBox:  { width:48, height:48, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  statInfo:     { flex:1 },
  statCount:    { fontSize:'1.8rem', fontWeight:800, lineHeight:1 },
  statLabel:    { fontSize:12, color:'#6b7280', marginTop:3, fontWeight:500 },
  statDot:      { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  tabCard:      { margin:'0 2rem 2rem', background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)' },
  tabBar:       { display:'flex', borderBottom:'1px solid #f1f5f9', padding:'0 1.5rem', gap:4 },
  tabBtn:       { display:'flex', alignItems:'center', gap:8, padding:'14px 18px', border:'none', background:'none', cursor:'pointer', fontSize:14, color:'#6b7280', borderBottom:'3px solid transparent', marginBottom:-1, fontWeight:500, transition:'all .15s', borderRadius:'8px 8px 0 0' },
  tabActive:    { fontWeight:700, borderBottom:'3px solid' },
  tabContent:   { padding:'1.5rem' },
  toolbar:      { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, gap:12, flexWrap:'wrap' },
  searchWrap:   { flex:1, minWidth:200, display:'flex', alignItems:'center', gap:8, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, padding:'0 14px', height:42 },
  searchIcon:   { fontSize:16, opacity:0.5 },
  searchInput:  { flex:1, border:'none', background:'none', outline:'none', fontSize:14, color:'#374151' },
  toolRight:    { display:'flex', alignItems:'center', gap:10 },
  badge:        { background:'#f1f5f9', color:'#6b7280', borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:600, border:'1px solid #e5e7eb' },
  addBtn:       { display:'flex', alignItems:'center', gap:7, color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:600, cursor:'pointer', boxShadow:'0 4px 12px rgba(0,0,0,0.15)' },
  loadWrap:     { display:'flex', flexDirection:'column', alignItems:'center', padding:'4rem', color:'#9ca3af' },
  spinner:      { width:36, height:36, border:'3px solid #f1f5f9', borderTop:'3px solid', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  emptyWrap:    { display:'flex', flexDirection:'column', alignItems:'center', padding:'4rem 2rem', textAlign:'center' },
  tableWrap:    { borderRadius:12, overflow:'hidden', border:'1px solid #f1f5f9' },
  table:        { width:'100%', borderCollapse:'collapse', fontSize:14 },
  th:           { background:'#f8fafc', color:'#374151', padding:'12px 16px', textAlign:'left', fontWeight:600, fontSize:12, textTransform:'uppercase', letterSpacing:0.5, borderBottom:'2px solid #e5e7eb' },
  tr:           { background:'#fff', transition:'background .1s', borderBottom:'1px solid #f8fafc' },
  td:           { padding:'14px 16px', verticalAlign:'middle' },
  valueWrap:    { display:'flex', alignItems:'center', gap:10 },
  colorDot:     { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  valueText:    { fontWeight:500, color:'#1e2a3b', fontSize:14 },
  actionBtns:   { display:'flex', gap:8, justifyContent:'center' },
  editBtn:      { display:'flex', alignItems:'center', gap:4, padding:'6px 14px', border:'1px solid', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, background:'#fff', transition:'all .15s' },
  delBtn:       { display:'flex', alignItems:'center', gap:4, padding:'6px 14px', border:'1px solid', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, background:'#fff', color:'#ef4444', borderColor:'#ef444440', transition:'all .15s' },
  overlay:      { position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal:        { background:'#fff', borderRadius:16, width:'90%', maxWidth:480, boxShadow:'0 25px 50px rgba(0,0,0,0.25)', overflow:'hidden' },
  modalHeader:  { padding:'1.5rem', display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  closeBtn:     { background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', fontSize:16, cursor:'pointer', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  modalBody:    { padding:'1.5rem', display:'flex', flexDirection:'column', gap:18 },
  formGroup:    { display:'flex', flexDirection:'column', gap:7 },
  formLabel:    { fontSize:13, fontWeight:600, color:'#374151' },
  formInput:    { padding:'11px 14px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', transition:'all .15s', color:'#1e2a3b' },
  errorBox:     { display:'flex', alignItems:'center', gap:8, background:'#fef2f2', color:'#dc2626', borderRadius:8, padding:'10px 14px', fontSize:13, border:'1px solid #fecaca' },
  modalFooter:  { padding:'1rem 1.5rem', background:'#f8fafc', display:'flex', justifyContent:'flex-end', gap:10, borderTop:'1px solid #f1f5f9' },
  cancelBtn:    { background:'#fff', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 20px', cursor:'pointer', fontSize:14, fontWeight:500 },
  confirmBtn:   { color:'#fff', border:'none', borderRadius:8, padding:'10px 24px', cursor:'pointer', fontSize:14, fontWeight:600, boxShadow:'0 4px 12px rgba(0,0,0,0.15)' },
  warnBox:      { background:'#fef2f2', color:'#dc2626', borderRadius:8, padding:'10px 14px', fontSize:13, border:'1px solid #fecaca' },
  pill:         { padding:'5px 14px', borderRadius:20, border:'1px solid #e5e7eb', background:'#f8fafc', color:'#6b7280', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s' },
  lotThumb:     { width:48, height:48, objectFit:'cover', borderRadius:6, border:'2px solid #f59e0b', display:'block', margin:'0 auto' },
  uploadBtn:    { cursor:'pointer', fontSize:20, display:'inline-block', padding:'4px 8px', borderRadius:6, background:'#f8fafc', border:'1px solid #e5e7eb' },
  imgPopup:     { position:'relative', background:'#000', borderRadius:12, overflow:'hidden', maxWidth:'90vw', maxHeight:'90vh', boxShadow:'0 30px 60px rgba(0,0,0,0.6)' },
  imgFull:      { display:'block', maxWidth:'90vw', maxHeight:'90vh', objectFit:'contain' },
  imgCloseBtn:  { position:'absolute', top:10, right:10, background:'rgba(0,0,0,0.6)', border:'none', color:'#fff', fontSize:18, width:36, height:36, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 },
};
