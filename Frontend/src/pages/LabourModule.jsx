import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api, { getWageRates, upsertWageRate, deleteWageRate } from '../services/api';

const fmtRate = (n) => 'PKR ' + Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK') : '—';

const initForm = { name: '', role: '', phone: '', status: 'Active', joinDate: '', personType: 'Worker' };

// ── Professional Signature Palettes matching Staff Module ──
const WORKER_PALETTES = {
  1: { gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', color: '#2563eb', bg: '#eff6ff', role: 'Cutting / Cutter',    avatar: 'AH' },
  2: { gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)', color: '#059669', bg: '#ecfdf5', role: 'Machine / Knitting',  avatar: 'FS' },
  3: { gradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)', color: '#4f46e5', bg: '#eef2ff', role: 'Pressing / Iron',     avatar: 'GP' },
  4: { gradient: 'linear-gradient(135deg, #831843 0%, #e11d48 100%)', color: '#e11d48', bg: '#fff1f2', role: 'Tailor / Stitching',  avatar: 'AR' },
  5: { gradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)', color: '#7c3aed', bg: '#f5f3ff', role: 'Tailor / Stitching',  avatar: 'NZ' },
  6: { gradient: 'linear-gradient(135deg, #164e63 0%, #0891b2 100%)', color: '#0891b2', bg: '#ecfeff', role: 'Overlock / Safty',    avatar: 'UM' },
  7: { gradient: 'linear-gradient(135deg, #064e3b 0%, #0d9488 100%)', color: '#0d9488', bg: '#f0fdfa', role: 'Rafo / Mending',      avatar: 'UR' },
  8: { gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)', color: '#ea580c', bg: '#fff7ed', role: 'Kaj / Buttonhole',   avatar: 'BK' },
  9: { gradient: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)', color: '#2563eb', bg: '#eff6ff', role: 'Button Attaching',   avatar: 'BW' },
  10:{ gradient: 'linear-gradient(135deg, #134e4a 0%, #0d9488 100%)', color: '#0d9488', bg: '#f0fdfa', role: 'Production Staff',    avatar: 'HI' },
  11:{ gradient: 'linear-gradient(135deg, #881337 0%, #c026d3 100%)', color: '#c026d3', bg: '#fdf4ff', role: 'Master Cutter',       avatar: 'MR' },
  12:{ gradient: 'linear-gradient(135deg, #312e81 0%, #7c3aed 100%)', color: '#7c3aed', bg: '#f5f3ff', role: 'Owner / Management',  avatar: 'MH' },
};

function getWorkerStyle(worker) {
  const name = (worker?.name || 'Worker').trim();
  const initials = name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase() || 'WK';
  if (worker && WORKER_PALETTES[worker.id]) {
    return {
      ...WORKER_PALETTES[worker.id],
      avatar: initials,
      role: worker.role || WORKER_PALETTES[worker.id].role,
    };
  }
  const colors = [
    { gradient: 'linear-gradient(135deg, #1e3a8a, #2563eb)', color: '#2563eb', bg: '#eff6ff' },
    { gradient: 'linear-gradient(135deg, #064e3b, #059669)', color: '#059669', bg: '#ecfdf5' },
    { gradient: 'linear-gradient(135deg, #312e81, #4f46e5)', color: '#4f46e5', bg: '#eef2ff' },
    { gradient: 'linear-gradient(135deg, #831843, #e11d48)', color: '#e11d48', bg: '#fff1f2' },
    { gradient: 'linear-gradient(135deg, #4c1d95, #7c3aed)', color: '#7c3aed', bg: '#f5f3ff' },
  ];
  let h = 0;
  for (let c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return { ...colors[h], avatar: initials, role: worker?.role || 'Staff Member' };
}

export default function LabourModule() {
  const { can } = useAuth();
  const { isDark, currentColor } = useTheme();
  const navigate = useNavigate();

  const [labours, setLabours]     = useState([]);
  const [roles, setRoles]         = useState(['Stitching', 'Machine Op', 'Pressing', 'Finishing', 'Safety', 'Cutting', 'Kajkari', 'Buttons', 'Other']);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(initForm);
  const [editing, setEditing]     = useState(null);
  const [errors, setErrors]       = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [statusConfirm, setStatusConfirm] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [apiError, setApiError]   = useState('');
  const [page,     setPage]       = useState(1);
  const [pageSize, setPageSize]   = useState(10);

  // Tabs & Wage Rates management
  const [activeTab, setActiveTab]               = useState('roster'); // 'roster' | 'wages'
  const [wageRates, setWageRates]               = useState([]);
  const [taskTypes, setTaskTypes]               = useState(['Front', 'Bazo', 'Tape', 'Pocket', 'Gala', 'Lable', 'Moda', 'Quantity', 'TotalPiece']);
  const [rateForm, setRateForm]                 = useState({ workerId: '', taskType: '', ratePerPiece: '' });
  const [rateWorkerFilter, setRateWorkerFilter]   = useState('');
  const [rateSaving, setRateSaving]             = useState(false);
  const [rateDeleteConfirm, setRateDeleteConfirm] = useState(null);
  const [editingRate, setEditingRate]           = useState(null); // { id, workerId, taskType, ratePerPiece, origWorkerId, origTaskType }

  const allTaskTypes = useMemo(() => Array.from(new Set([
    ...taskTypes,
    ...wageRates.map(r => r.taskType).filter(Boolean),
  ])), [taskTypes, wageRates]);

  const filteredRates = useMemo(() => {
    return rateWorkerFilter
      ? wageRates.filter(r => r.workerId === Number(rateWorkerFilter))
      : wageRates;
  }, [wageRates, rateWorkerFilter]);

  const ratesByWorker = useMemo(() => {
    const map = {};
    wageRates.forEach(r => {
      if (!map[r.workerId]) map[r.workerId] = [];
      map[r.workerId].push(r);
    });
    return map;
  }, [wageRates]);

  // Load workers, roles, wage rates, and task types from real API
  const loadWorkers = async () => {
    setLoading(true);
    setApiError('');
    try {
      const [res, rolesRes, ratesRes, ttRes] = await Promise.all([
        api.get('/workers'),
        api.get('/dropdowns/worker-roles').then(r => r.data).catch(() => []),
        getWageRates().catch(() => []),
        api.get('/dropdowns/task-types').then(r => r.data).catch(() => []),
      ]);
      const mapped = res.data.map(w => ({
        id:         w.id,
        name:       w.name,
        role:       w.role || w.sheetType || 'Worker',
        phone:      w.phone || '',
        status:     w.isActive === false ? 'Inactive' : 'Active',
        joinDate:   w.joinDate ? w.joinDate.split('T')[0] : '',
        personType: w.personType || 'Worker',
      }));
      setLabours(mapped);
      if (Array.isArray(rolesRes) && rolesRes.length > 0) {
        setRoles(rolesRes.map(r => r.name).filter(Boolean));
      }
      if (Array.isArray(ratesRes)) {
        setWageRates(ratesRes);
      }
      if (Array.isArray(ttRes) && ttRes.length > 0) {
        setTaskTypes(ttRes.map(t => t.name).filter(Boolean));
      }
    } catch {
      setApiError('Could not load workers from server.');
    }
    setLoading(false);
  };

  useEffect(() => { loadWorkers(); }, []);

  // Wage Rate Handlers
  const handleRateSubmit = async () => {
    if (!rateForm.workerId || !rateForm.taskType || !rateForm.ratePerPiece) return;
    setRateSaving(true);
    setApiError('');
    try {
      await upsertWageRate({
        workerId: Number(rateForm.workerId),
        taskType: rateForm.taskType,
        ratePerPiece: Number(rateForm.ratePerPiece),
      });
      setRateForm({ workerId: rateWorkerFilter || '', taskType: '', ratePerPiece: '' });
      setWageRates(await getWageRates());
    } catch {
      setApiError('Failed to save wage rate.');
    }
    setRateSaving(false);
  };

  const handleStartEditRate = (r) => {
    setRateDeleteConfirm(null);
    setEditingRate({
      id: r.id,
      workerId: String(r.workerId),
      taskType: r.taskType,
      ratePerPiece: String(r.ratePerPiece),
      origWorkerId: String(r.workerId),
      origTaskType: r.taskType,
    });
  };

  const handleSaveEditRate = async () => {
    if (!editingRate || !editingRate.workerId || !editingRate.taskType || editingRate.ratePerPiece === '') return;
    setRateSaving(true);
    setApiError('');
    try {
      const targetChanged =
        String(editingRate.workerId) !== String(editingRate.origWorkerId) ||
        editingRate.taskType !== editingRate.origTaskType;

      await upsertWageRate({
        workerId: Number(editingRate.workerId),
        taskType: editingRate.taskType,
        ratePerPiece: Number(editingRate.ratePerPiece),
      });

      if (targetChanged && editingRate.id) {
        await deleteWageRate(editingRate.id).catch(() => {});
      }

      setEditingRate(null);
      setWageRates(await getWageRates());
    } catch {
      setApiError('Failed to update wage rate.');
    }
    setRateSaving(false);
  };

  const handleDeleteRate = async (id) => {
    setApiError('');
    try {
      await deleteWageRate(id);
      setWageRates(prev => prev.filter(x => x.id !== id));
    } catch {
      setApiError('Failed to delete wage rate.');
    }
    setRateDeleteConfirm(null);
  };

  const filtered = useMemo(() => {
    return labours.filter(l => {
      const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
                          l.role.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All'
        ? true
        : filter === 'Management'
        ? l.personType === 'Management'
        : l.status === filter;
      return matchSearch && matchFilter;
    });
  }, [labours, search, filter]);

  useEffect(() => { setPage(1); }, [search, filter, pageSize]);
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.personType === 'Worker') {
      if (!form.role) e.role = 'Role is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd  = () => { setForm(initForm); setEditing(null); setErrors({}); setShowModal(true); };
  const openEdit = (l) => {
    setForm({
      name: l.name,
      role: l.role && l.role !== 'Worker' ? l.role : '',
      phone: l.phone,
      status: l.status,
      joinDate: l.joinDate,
      personType: l.personType || 'Worker',
    });
    setEditing(l);
    setErrors({});
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const roleValue = form.personType === 'Management' ? 'Management' : (form.role || 'Worker');
    try {
      if (editing) {
        await api.put(`/workers/${editing.id}`, {
          name: form.name,
          sheetType: roleValue,
          phone: form.phone || null,
          joinDate: form.joinDate || null,
          isActive: form.status === 'Active',
          personType: form.personType,
        });
      } else {
        await api.post('/workers', {
          name: form.name,
          sheetType: roleValue,
          phone: form.phone || null,
          joinDate: form.joinDate || null,
          isActive: form.status === 'Active',
          personType: form.personType,
        });
      }
      await loadWorkers();
      setShowModal(false);
    } catch {
      if (editing) {
        setLabours(labours.map(l => l.id === editing.id ? { ...l, ...form, role: roleValue } : l));
      } else {
        setLabours([...labours, { ...form, role: roleValue, id: Date.now() }]);
      }
      setShowModal(false);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/workers/${id}`);
      await loadWorkers();
    } catch {
      setLabours(labours.filter(l => l.id !== id));
    }
    setDeleteConfirm(null);
  };

  const handleStatusToggleRequest = (l) => {
    if (l.status === 'Active') {
      setStatusConfirm({
        id: l.id,
        name: l.name,
        currentStatus: 'Active',
        targetStatus: 'Inactive',
      });
    } else {
      setStatusConfirm({
        id: l.id,
        name: l.name,
        currentStatus: 'Inactive',
        targetStatus: 'Active',
      });
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/workers/${id}/toggle-status`);
      await loadWorkers();
    } catch {
      setLabours(labours.map(l => l.id === id
        ? { ...l, status: l.status === 'Active' ? 'Inactive' : 'Active' } : l));
    }
  };

  const activeCount     = labours.filter(l => l.status === 'Active').length;
  const inactiveCount   = labours.filter(l => l.status === 'Inactive').length;
  const managementCount = labours.filter(l => l.personType === 'Management').length;

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">
      {/* ── Professional Header Bar ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap(currentColor.primary)}>
            <span>⚙️</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>WORKFORCE MANAGEMENT</div>
            <h1 style={styles.headerTitle(isDark)}>Production Staff</h1>
          </div>
        </div>

        {activeTab === 'roster' && can('canAddLabour') && (
          <button style={styles.addBtn(currentColor.primary)} onClick={openAdd}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add New Worker
          </button>
        )}
      </div>

      {/* ── Section Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { key: 'roster', label: 'Staff Roster', icon: '👥', count: labours.length },
          { key: 'wages',  label: 'Wage Rates',   icon: '🏷️', count: wageRates.length },
        ].map(t => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setActiveTab(t.key); setApiError(''); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 999,
                border: active
                  ? `1.5px solid ${currentColor.primary}`
                  : isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                background: active
                  ? currentColor.primary
                  : isDark ? '#1e293b' : '#ffffff',
                color: active ? '#ffffff' : isDark ? '#cbd5e1' : '#334155',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: active ? `0 4px 12px ${currentColor.primary}40` : '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span style={{
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                background: active ? 'rgba(255,255,255,0.22)' : isDark ? '#334155' : '#f1f5f9',
                color: active ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
              }}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {apiError && (
        <div style={styles.alertError}>
          ⚠️ {apiError}
        </div>
      )}

      {activeTab === 'roster' && (
        <>
          {/* ── Executive KPI Cards / Interactive Tabs ── */}
      <div style={styles.statsRow}>
        {/* Total Staff */}
        <div
          onClick={() => setFilter('All')}
          style={styles.statCard('linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)', 'rgba(37, 99, 235, 0.35)', filter === 'All')}
          role="button"
          tabIndex={0}
          title="Filter: All Staff"
        >
          <div style={styles.statCardHeader}>
            <span style={styles.statBadge}>ROSTER</span>
            <span style={styles.statIcon}>👥</span>
          </div>
          <div style={styles.statNum}>{labours.length}</div>
          <div style={styles.statLabel}>Total Staff</div>
        </div>

        {/* Active Staff */}
        <div
          onClick={() => setFilter('Active')}
          style={styles.statCard('linear-gradient(135deg, #064e3b 0%, #059669 55%, #10b981 100%)', 'rgba(16, 185, 129, 0.35)', filter === 'Active')}
          role="button"
          tabIndex={0}
          title="Filter: Active Staff"
        >
          <div style={styles.statCardHeader}>
            <span style={styles.statBadge}>OPERATIONAL</span>
            <span style={styles.statIcon}>⚡</span>
          </div>
          <div style={styles.statNum}>{activeCount}</div>
          <div style={styles.statLabel}>Active Staff</div>
        </div>

        {/* Inactive Staff */}
        <div
          onClick={() => setFilter('Inactive')}
          style={styles.statCard('linear-gradient(135deg, #831843 0%, #be123c 55%, #e11d48 100%)', 'rgba(225, 29, 72, 0.35)', filter === 'Inactive')}
          role="button"
          tabIndex={0}
          title="Filter: Inactive Staff"
        >
          <div style={styles.statCardHeader}>
            <span style={styles.statBadge}>OFFLINE / LEAVE</span>
            <span style={styles.statIcon}>⏸️</span>
          </div>
          <div style={styles.statNum}>{inactiveCount}</div>
          <div style={styles.statLabel}>Inactive</div>
        </div>

        {/* Management Staff */}
        <div
          onClick={() => setFilter('Management')}
          style={styles.statCard('linear-gradient(135deg, #4c1d95 0%, #7c3aed 55%, #8b5cf6 100%)', 'rgba(139, 92, 246, 0.35)', filter === 'Management')}
          role="button"
          tabIndex={0}
          title="Filter: Management Staff"
        >
          <div style={styles.statCardHeader}>
            <span style={styles.statBadge}>SUPERVISORY</span>
            <span style={styles.statIcon}>👔</span>
          </div>
          <div style={styles.statNum}>{managementCount}</div>
          <div style={styles.statLabel}>Management</div>
        </div>
      </div>

      {/* ── Toolbar: Search & Filter Pills ── */}
      <div style={styles.toolbar(isDark)}>
        <div style={styles.searchBox(isDark)}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput(isDark)}
            placeholder="Search by worker name or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={styles.clearBtn(isDark)}>✕</button>
          )}
        </div>

        <div style={styles.filterGroup}>
          {[
            { label: 'All Staff', key: 'All', count: labours.length },
            { label: 'Active', key: 'Active', count: activeCount },
            { label: 'Inactive', key: 'Inactive', count: inactiveCount },
            { label: 'Management', key: 'Management', count: managementCount },
          ].map(f => {
            const isSel = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={styles.filterPill(isSel, isDark, currentColor)}
              >
                <span>{f.label}</span>
                <span style={styles.pillCount(isSel, isDark)}>{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Table Card ── */}
      <div style={styles.tableCard(isDark)}>
        {loading ? (
          <div style={styles.loadingBox(isDark)}>
            <div style={styles.spinner} />
            <div style={{ marginTop: 14, fontWeight: 600 }}>Loading workforce roster...</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th(isDark, 50)}>#</th>
                  <th style={styles.th(isDark, 230)}>Worker Name</th>
                  <th style={styles.th(isDark, 150)}>Role / Process</th>
                  <th style={styles.th(isDark, 210)}>Wage Rates</th>
                  <th style={styles.th(isDark, 130)}>Phone</th>
                  <th style={styles.th(isDark, 120)}>Join Date</th>
                  <th style={styles.th(isDark, 110)}>Status</th>
                  <th style={{ ...styles.th(isDark, 170), textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={styles.empty(isDark)}>
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                      <div>No matching workforce records found</div>
                      <div style={{ fontSize: 13, color: isDark ? 'var(--text-muted)' : '#94a3b8', marginTop: 4 }}>
                        Try adjusting your search query or status filter
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((l, i) => {
                    const ws = getWorkerStyle(l);
                    return (
                      <tr key={l.id} style={styles.tr(isDark, i % 2 === 0)}>
                        {/* Row Index */}
                        <td style={styles.tdIndex}>
                          {(page - 1) * pageSize + i + 1}
                        </td>

                        {/* Worker Name with Signature Gradient Avatar */}
                        <td style={styles.td}>
                          <div style={styles.workerCell}>
                            <div style={styles.avatarBox(ws.gradient)}>
                              {ws.avatar}
                            </div>
                            <div>
                              <div
                                style={styles.workerNameLink(isDark)}
                                onClick={() => navigate(`/staff/${l.id}`)}
                                title={`Click to open ${l.name}'s production sheet`}
                              >
                                {l.name}
                              </div>
                              <span style={styles.workerSubId}>ID #{l.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td style={styles.td}>
                          {l.personType === 'Management' ? (
                            <span style={styles.mgmtPill}>Owner / Salary</span>
                          ) : (
                            <span style={styles.sheetPill(isDark, ws.color)}>
                              {l.role || 'Worker'}
                            </span>
                          )}
                        </td>

                        {/* Wage Rates */}
                        <td style={styles.td}>
                          {(() => {
                            const wRates = ratesByWorker[l.id] || [];
                            const openWorkerWages = () => {
                              setRateWorkerFilter(String(l.id));
                              setRateForm(prev => ({ ...prev, workerId: String(l.id) }));
                              setActiveTab('wages');
                            };
                            if (wRates.length === 0) {
                              return (
                                <button
                                  type="button"
                                  onClick={openWorkerWages}
                                  style={{
                                    padding: '3px 9px',
                                    borderRadius: 999,
                                    border: isDark ? '1px dashed #475569' : '1px dashed #cbd5e1',
                                    background: 'transparent',
                                    color: isDark ? '#94a3b8' : '#64748b',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  + Assign Wage
                                </button>
                              );
                            }
                            return (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {wRates.map(r => (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onClick={openWorkerWages}
                                    title="Click to manage or edit wage rates"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '3px 9px',
                                      borderRadius: 999,
                                      border: isDark ? '1px solid #1e40af' : '1px solid #bfdbfe',
                                      background: isDark ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff',
                                      color: isDark ? '#93c5fd' : '#1d4ed8',
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span>{r.taskType}:</span>
                                    <span>Rs {Number(r.ratePerPiece || 0).toLocaleString('en-PK')}</span>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Phone */}
                        <td style={styles.td}>
                          <span style={styles.phoneText(isDark)}>{l.phone || '—'}</span>
                        </td>

                        {/* Join Date */}
                        <td style={styles.td}>
                          <span style={styles.dateText(isDark)}>{l.joinDate || '—'}</span>
                        </td>

                        {/* Status Toggle Badge */}
                        <td style={styles.td}>
                          <button
                            onClick={() => handleStatusToggleRequest(l)}
                            style={styles.statusToggleBtn(l.status === 'Active')}
                            title="Click to toggle status"
                          >
                            <span style={styles.statusDot(l.status === 'Active')} />
                            <span>{l.status}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <div style={styles.actionGroup}>
                            <button
                              style={styles.sheetShortcutBtn}
                              onClick={() => navigate(`/staff/${l.id}`)}
                              title="Open Production Sheet"
                            >
                              📋 Sheet
                            </button>

                            {can('canEditLabour') && (
                              <button
                                style={styles.editBtn}
                                onClick={() => openEdit(l)}
                                title="Edit Worker"
                              >
                                ✏️ Edit
                              </button>
                            )}

                            {can('canDeleteLabour') && (
                              <button
                                style={styles.delBtn}
                                onClick={() => setDeleteConfirm(l.id)}
                                title="Delete Worker"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <LabPagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPage={setPage}
          onPageSize={setPageSize}
          isDark={isDark}
        />
      </div>
        </>
      )}

      {activeTab === 'wages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── Set Worker Piece Rate Form Card ── */}
          <div style={{
            background: isDark ? '#1e293b' : '#ffffff',
            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.22)' : '0 4px 16px rgba(15,23,42,0.05)',
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.07em',
              color: isDark ? '#fbbf24' : '#b45309',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span>🏷️</span> SET WORKER PIECE RATE
            </div>

            <form
              onSubmit={handleRateSubmit}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 12,
                alignItems: 'end',
              }}
            >
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: isDark ? '#94a3b8' : '#64748b',
                  marginBottom: 6,
                }}>
                  WORKER
                </label>
                <select
                  value={rateForm.workerId}
                  onChange={e => setRateForm(f => ({ ...f, workerId: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    background: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    fontSize: 13.5,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                >
                  <option value="">— Select Worker —</option>
                  {labours.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.role ? ` (${w.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: isDark ? '#94a3b8' : '#64748b',
                  marginBottom: 6,
                }}>
                  TASK TYPE
                </label>
                <select
                  value={rateForm.taskType}
                  onChange={e => setRateForm(f => ({ ...f, taskType: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    background: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    fontSize: 13.5,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                >
                  <option value="">— Select Task —</option>
                  {allTaskTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: isDark ? '#94a3b8' : '#64748b',
                  marginBottom: 6,
                }}>
                  RATE PER PIECE (PKR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 5.50"
                  value={rateForm.ratePerPiece}
                  onChange={e => setRateForm(f => ({ ...f, ratePerPiece: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                    background: isDark ? '#0f172a' : '#f8fafc',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    fontSize: 13.5,
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={rateSaving}
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 10,
                    border: 'none',
                    background: currentColor.primary,
                    color: '#ffffff',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: rateSaving ? 'not-allowed' : 'pointer',
                    opacity: rateSaving ? 0.7 : 1,
                    boxShadow: `0 4px 12px ${currentColor.primary}40`,
                  }}
                >
                  {rateSaving ? 'Saving...' : '+ Save Rate'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Filter Bar ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            background: isDark ? '#1e293b' : '#ffffff',
            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '12px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#cbd5e1' : '#334155' }}>
                Filter by worker:
              </span>
              <select
                value={rateWorkerFilter}
                onChange={e => setRateWorkerFilter(e.target.value)}
                style={{
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 9,
                  border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                  background: isDark ? '#0f172a' : '#f8fafc',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  fontSize: 13,
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                <option value="">All Workers</option>
                {labours.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              {rateWorkerFilter && (
                <button
                  type="button"
                  onClick={() => setRateWorkerFilter('')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                    background: 'transparent',
                    color: isDark ? '#cbd5e1' : '#475569',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Clear Filter
                </button>
              )}
            </div>

            <span style={{
              padding: '5px 12px',
              borderRadius: 999,
              background: isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff',
              color: isDark ? '#93c5fd' : '#1d4ed8',
              fontSize: 12,
              fontWeight: 700,
            }}>
              {filteredRates.length} configured {filteredRates.length === 1 ? 'rate' : 'rates'}
            </span>
          </div>

          {/* ── Configured Wage Rates Table ── */}
          <div style={styles.tableCard(isDark)}>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th(isDark, 230)}>Worker</th>
                    <th style={styles.th(isDark, 180)}>Task Type</th>
                    <th style={styles.th(isDark, 160)}>Rate / Piece</th>
                    <th style={styles.th(isDark, 140)}>Last Updated</th>
                    <th style={{ ...styles.th(isDark, 220), textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={styles.empty(isDark)}>
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏷️</div>
                        <div>No wage rates configured{rateWorkerFilter ? ' for this worker' : ''} yet</div>
                        <div style={{ fontSize: 13, color: isDark ? 'var(--text-muted)' : '#94a3b8', marginTop: 4 }}>
                          Use the form above to assign a worker piece rate
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRates.map((r, idx) => {
                      const isEditing = editingRate?.id === r.id;
                      return (
                        <tr key={r.id} style={styles.tr(isDark, idx % 2 === 0)}>
                          <td style={styles.td}>
                            {isEditing ? (
                              <select
                                value={editingRate.workerId}
                                onChange={e => setEditingRate(ed => ({ ...ed, workerId: e.target.value }))}
                                style={{
                                  width: '100%',
                                  height: 34,
                                  padding: '0 8px',
                                  borderRadius: 8,
                                  border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                                  background: isDark ? '#0f172a' : '#ffffff',
                                  color: isDark ? '#f1f5f9' : '#0f172a',
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                {labours.map(w => (
                                  <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span style={{ fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                                {r.workerName}
                              </span>
                            )}
                          </td>

                          <td style={styles.td}>
                            {isEditing ? (
                              <select
                                value={editingRate.taskType}
                                onChange={e => setEditingRate(ed => ({ ...ed, taskType: e.target.value }))}
                                style={{
                                  width: '100%',
                                  height: 34,
                                  padding: '0 8px',
                                  borderRadius: 8,
                                  border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                                  background: isDark ? '#0f172a' : '#ffffff',
                                  color: isDark ? '#f1f5f9' : '#0f172a',
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                {allTaskTypes.map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            ) : (
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                borderRadius: 999,
                                background: isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff',
                                color: isDark ? '#93c5fd' : '#1d4ed8',
                                fontSize: 12,
                                fontWeight: 700,
                              }}>
                                {r.taskType}
                              </span>
                            )}
                          </td>

                          <td style={styles.td}>
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingRate.ratePerPiece}
                                onChange={e => setEditingRate(ed => ({ ...ed, ratePerPiece: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); handleSaveEditRate(); }
                                  if (e.key === 'Escape') { e.preventDefault(); setEditingRate(null); }
                                }}
                                autoFocus
                                style={{
                                  width: 120,
                                  height: 34,
                                  padding: '0 10px',
                                  borderRadius: 8,
                                  border: `1.5px solid ${currentColor.primary}`,
                                  background: isDark ? '#0f172a' : '#ffffff',
                                  color: isDark ? '#f1f5f9' : '#0f172a',
                                  fontSize: 13,
                                  fontWeight: 700,
                                  outline: 'none',
                                }}
                              />
                            ) : (
                              <span style={{
                                fontWeight: 800,
                                color: isDark ? '#60a5fa' : '#2563eb',
                                fontSize: 13.5,
                              }}>
                                {fmtRate(r.ratePerPiece)}
                              </span>
                            )}
                          </td>

                          <td style={styles.td}>
                            <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 13 }}>
                              {fmtDate(r.updatedAt)}
                            </span>
                          </td>

                          <td style={{ ...styles.td, textAlign: 'right' }}>
                            {isEditing ? (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  type="button"
                                  disabled={rateSaving}
                                  onClick={handleSaveEditRate}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#16a34a',
                                    color: '#ffffff',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: rateSaving ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  ✓ Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRate(null)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                                    background: isDark ? '#0f172a' : '#ffffff',
                                    color: isDark ? '#cbd5e1' : '#475569',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✕ Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditRate(r)}
                                  style={{
                                    padding: '5px 11px',
                                    borderRadius: 8,
                                    border: isDark ? '1px solid #1d4ed8' : '1px solid #bfdbfe',
                                    background: isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
                                    color: isDark ? '#93c5fd' : '#1d4ed8',
                                    fontSize: 12.5,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✏️ Edit
                                </button>
                                {rateDeleteConfirm === r.id ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRate(r.id)}
                                      style={{
                                        padding: '5px 10px',
                                        borderRadius: 8,
                                        border: 'none',
                                        background: '#dc2626',
                                        color: '#ffffff',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRateDeleteConfirm(null)}
                                      style={{
                                        padding: '5px 10px',
                                        borderRadius: 8,
                                        border: isDark ? '1px solid #475569' : '1px solid #cbd5e1',
                                        background: 'transparent',
                                        color: isDark ? '#cbd5e1' : '#475569',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setRateDeleteConfirm(r.id)}
                                    title="Delete rate"
                                    style={{
                                      padding: '5px 9px',
                                      borderRadius: 8,
                                      border: isDark ? '1px solid rgba(239,68,68,0.35)' : '1px solid #fecaca',
                                      background: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
                                      color: '#ef4444',
                                      fontSize: 12.5,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div style={styles.overlay}>
          <div style={styles.modal(isDark)}>
            <div style={styles.modalHeader(currentColor.primary)}>
              <div>
                <span style={styles.modalTitle}>{editing ? 'Edit Worker Profile' : 'Add New Workforce Member'}</span>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Production Department</div>
              </div>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGrid}>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label(isDark)}>Person Type <span style={styles.req}>*</span></label>
                  <select
                    style={styles.input(isDark)}
                    value={form.personType}
                    onChange={e => setForm({ ...form, personType: e.target.value })}
                  >
                    <option value="Worker">Worker (Production Staff)</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label(isDark)}>Full Name <span style={styles.req}>*</span></label>
                  <input
                    style={{ ...styles.input(isDark), ...(errors.name ? styles.inputErr : {}) }}
                    placeholder="e.g. Ali Hassan"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                  {errors.name && <span style={styles.errMsg}>{errors.name}</span>}
                </div>

                {form.personType === 'Worker' && (
                  <div style={styles.formGroup}>
                    <label style={styles.label(isDark)}>Role / Process <span style={styles.req}>*</span></label>
                    <select
                      style={{ ...styles.input(isDark), ...(errors.role ? styles.inputErr : {}) }}
                      value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value })}
                    >
                      <option value="">-- Select Role --</option>
                      {Array.from(new Set([...roles, ...(form.role ? [form.role] : [])])).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {errors.role && <span style={styles.errMsg}>{errors.role}</span>}
                  </div>
                )}

                <div style={styles.formGroup}>
                  <label style={styles.label(isDark)}>Phone Number</label>
                  <input
                    style={styles.input(isDark)}
                    placeholder="e.g. 0300-1234567"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label(isDark)}>Join Date</label>
                  <input
                    type="date"
                    style={{ ...styles.input(isDark), ...(errors.joinDate ? styles.inputErr : {}) }}
                    value={form.joinDate}
                    onChange={e => setForm({ ...form, joinDate: e.target.value })}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label(isDark)}>Status</label>
                  <select
                    style={styles.input(isDark)}
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={styles.modalFooter(isDark)}>
              <button style={styles.cancelBtn(isDark)} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={styles.saveBtn(currentColor.primary)} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Update Worker' : 'Save Worker'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Change Confirmation Modal ── */}
      {statusConfirm && (
        <div style={styles.overlay} onClick={() => setStatusConfirm(null)}>
          <div style={{ ...styles.modal(isDark), maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div
              style={{
                ...styles.modalHeader(statusConfirm.targetStatus === 'Inactive' ? '#be123c' : '#059669'),
                background: statusConfirm.targetStatus === 'Inactive'
                  ? 'linear-gradient(135deg, #be123c 0%, #9f1239 100%)'
                  : 'linear-gradient(135deg, #059669 0%, #047857 100%)'
              }}
            >
              <span style={styles.modalTitle}>
                {statusConfirm.targetStatus === 'Inactive' ? '⚠️ Confirm Deactivation' : '✓ Confirm Activation'}
              </span>
              <button style={styles.closeBtn} onClick={() => setStatusConfirm(null)}>✕</button>
            </div>
            <div style={{ padding: '1.5rem', fontSize: 14, color: isDark ? 'var(--text-main)' : '#334155', lineHeight: 1.6 }}>
              {statusConfirm.targetStatus === 'Inactive' ? (
                <div>
                  Are you sure you want to change status of <b>{statusConfirm.name}</b> from <span style={{ color: '#16a34a', fontWeight: 700 }}>Active</span> to <span style={{ color: '#dc2626', fontWeight: 700 }}>Inactive</span>?
                  <div style={{
                    fontSize: 12,
                    color: isDark ? '#fca5a5' : '#b91c1c',
                    marginTop: 12,
                    background: isDark ? 'rgba(185, 28, 28, 0.15)' : '#fef2f2',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span>⚠️</span>
                    <span>This staff member will be marked inactive and placed on leave/offline.</span>
                  </div>
                </div>
              ) : (
                <div>
                  Are you sure you want to reactivate <b>{statusConfirm.name}</b> and return them to <span style={{ color: '#16a34a', fontWeight: 700 }}>Active</span> duty?
                </div>
              )}
            </div>
            <div style={styles.modalFooter(isDark)}>
              <button style={styles.cancelBtn(isDark)} onClick={() => setStatusConfirm(null)}>Cancel</button>
              <button
                style={{
                  ...styles.saveBtn(statusConfirm.targetStatus === 'Inactive' ? '#be123c' : '#059669'),
                  background: statusConfirm.targetStatus === 'Inactive'
                    ? 'linear-gradient(135deg, #be123c 0%, #9f1239 100%)'
                    : 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                }}
                onClick={() => {
                  const id = statusConfirm.id;
                  setStatusConfirm(null);
                  toggleStatus(id);
                }}
              >
                {statusConfirm.targetStatus === 'Inactive' ? 'Yes, Mark Inactive' : 'Yes, Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal(isDark), maxWidth: 420 }}>
            <div style={{ ...styles.modalHeader('#be123c'), background: '#be123c' }}>
              <span style={styles.modalTitle}>Confirm Delete</span>
              <button style={styles.closeBtn} onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div style={{ padding: '1.5rem', fontSize: 14, color: isDark ? 'var(--text-main)' : '#334155', lineHeight: 1.5 }}>
              Are you sure you want to delete <b>{labours.find(l => l.id === deleteConfirm)?.name}</b>?
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>
                This will deactivate or remove their worker profile.
              </div>
            </div>
            <div style={styles.modalFooter(isDark)}>
              <button style={styles.cancelBtn(isDark)} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={{ ...styles.saveBtn('#be123c'), background: '#be123c' }} onClick={() => handleDelete(deleteConfirm)}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pagination Component ──
function LabPagination({ page, pageSize, total, onPage, onPageSize, isDark }) {
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
    <div style={styles.paginationWrap(isDark)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: isDark ? 'var(--text-muted)' : '#64748b' }}>Rows per page:</span>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          style={styles.pageSelect(isDark)}
        >
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: 13, color: isDark ? 'var(--text-muted)' : '#64748b' }}>
          Showing {from}–{to} of {total}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 5 }}>
        <LabPageBtn onClick={() => onPage(page - 1)} disabled={page <= 1} isDark={isDark}>‹</LabPageBtn>
        {pages.map((p, i) =>
          typeof p === 'number' ? (
            <LabPageBtn key={p} onClick={() => onPage(p)} active={p === page} isDark={isDark}>
              {p}
            </LabPageBtn>
          ) : (
            <span key={i} style={{ padding: '0 4px', color: '#94a3b8', lineHeight: '32px' }}>…</span>
          )
        )}
        <LabPageBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages} isDark={isDark}>›</LabPageBtn>
      </div>
    </div>
  );
}

function LabPageBtn({ onClick, disabled, active, isDark, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32,
        height: 32,
        borderRadius: 8,
        border: active ? '1px solid #3b82f6' : `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
        background: active ? '#2563eb' : (isDark ? 'var(--bg-subtle)' : '#ffffff'),
        color: active ? '#ffffff' : (isDark ? 'var(--text-main)' : '#475569'),
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        opacity: disabled ? 0.35 : 1,
        transition: 'all .15s ease',
      }}
    >
      {children}
    </button>
  );
}

// ── Styles (Matching Staff Module & Professional Palettes) ──
const styles = {
  page: (isDark) => ({
    padding: '1.1rem 1.4rem',
    minHeight: '100vh',
    boxSizing: 'border-box',
    width: '100%',
  }),
  header: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.85rem',
    marginBottom: '1rem',
    padding: '1rem 1.4rem',
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    boxShadow: 'var(--shadow-sm)',
  }),
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  headerIconWrap: (primaryColor) => ({
    width: 44,
    height: 44,
    borderRadius: 12,
    background: `${primaryColor}18`,
    color: primaryColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.4rem',
  }),
  headerBreadcrumb: {
    fontSize: '0.725rem',
    fontWeight: 800,
    color: '#64748b',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  headerTitle: (isDark) => ({
    fontSize: '1.4rem',
    fontWeight: 700,
    color: isDark ? 'var(--text-main)' : '#0f172a',
    margin: '2px 0 0 0',
    letterSpacing: '-0.02em',
  }),
  addBtn: (primaryColor) => ({
    background: `linear-gradient(135deg, ${primaryColor} 0%, #1d4ed8 100%)`,
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  }),
  alertError: {
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 13,
    marginBottom: '1rem',
  },

  // ── Executive KPI Cards (Professional Colors & Gradients) ──
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.9rem',
    marginBottom: '1rem',
  },
  statCard: (gradient, glow, isSelected = false) => ({
    background: gradient,
    borderRadius: 14,
    padding: '1.1rem 1.3rem',
    color: '#ffffff',
    boxShadow: isSelected ? `0 8px 25px ${glow}` : `0 4px 14px ${glow}`,
    border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 110,
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    transform: isSelected ? 'translateY(-2px)' : 'none',
    outline: isSelected ? '3px solid rgba(255, 255, 255, 0.75)' : 'none',
    transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
  }),
  statCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBadge: {
    fontSize: '0.675rem',
    fontWeight: 800,
    letterSpacing: '0.05em',
    padding: '2px 8px',
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(4px)',
    color: '#ffffff',
  },
  statIcon: {
    fontSize: '1.25rem',
    opacity: 0.85,
  },
  statNum: {
    fontSize: '1.85rem',
    fontWeight: 800,
    color: '#ffffff',
    margin: '6px 0 2px',
    letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: '0.8rem',
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: 600,
  },

  // ── Toolbar ──
  toolbar: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
    padding: '0.75rem 1.1rem',
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 12,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    boxShadow: 'var(--shadow-sm)',
  }),
  searchBox: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    background: isDark ? 'var(--bg-subtle)' : '#f8fafc',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
    borderRadius: 8,
    padding: '6px 12px',
    flex: 1,
    minWidth: 260,
    maxWidth: 420,
  }),
  searchIcon: {
    fontSize: '0.85rem',
    marginRight: 8,
    opacity: 0.6,
  },
  searchInput: (isDark) => ({
    border: 'none',
    background: 'transparent',
    color: isDark ? 'var(--text-main)' : '#0f172a',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
  }),
  clearBtn: (isDark) => ({
    background: 'transparent',
    border: 'none',
    color: isDark ? 'var(--text-muted)' : '#94a3b8',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0 4px',
  }),
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
  },
  filterPill: (isSel, isDark, currentColor) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 16,
    border: isSel ? `1px solid ${currentColor.primary}` : `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    background: isSel ? currentColor.primary : (isDark ? 'var(--bg-subtle)' : '#f8fafc'),
    color: isSel ? '#ffffff' : (isDark ? 'var(--text-main)' : '#475569'),
    fontSize: '0.775rem',
    fontWeight: isSel ? 700 : 600,
    cursor: 'pointer',
    transition: 'all .15s ease',
  }),
  pillCount: (isSel, isDark) => ({
    fontSize: '0.7rem',
    padding: '1px 6px',
    borderRadius: 10,
    background: isSel ? 'rgba(255,255,255,0.25)' : (isDark ? '#334155' : '#e2e8f0'),
    color: isSel ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569'),
    fontWeight: 700,
  }),

  // ── Table Card ──
  tableCard: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    textAlign: 'left',
  },
  th: (isDark, width) => ({
    background: isDark ? 'var(--bg-subtle)' : '#1e2a3b',
    color: '#ffffff',
    padding: '12px 16px',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    width: width || 'auto',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  }),
  tr: (isDark, isEven) => ({
    background: isEven
      ? (isDark ? 'var(--bg-card)' : '#ffffff')
      : (isDark ? 'rgba(255,255,255,0.015)' : '#f8fafc'),
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
    transition: 'background .12s ease',
  }),
  tdIndex: {
    padding: '12px 16px',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#94a3b8',
  },
  td: {
    padding: '12px 16px',
    verticalAlign: 'middle',
  },
  workerCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: (gradient) => ({
    width: 36,
    height: 36,
    borderRadius: 9,
    background: gradient,
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.85rem',
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
    flexShrink: 0,
  }),
  workerNameLink: (isDark) => ({
    fontWeight: 700,
    fontSize: '0.925rem',
    color: isDark ? '#ffffff' : '#0f172a',
    cursor: 'pointer',
    transition: 'color .12s ease',
  }),
  workerSubId: {
    fontSize: '0.725rem',
    color: '#94a3b8',
    fontWeight: 600,
  },
  sheetPill: (isDark, color) => ({
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: 6,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: `${color}15`,
    color: color,
    border: `1px solid ${color}30`,
  }),
  mgmtPill: {
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: 6,
    fontSize: '0.75rem',
    fontWeight: 700,
    background: '#7c3aed18',
    color: '#7c3aed',
    border: '1px solid #7c3aed35',
  },
  roleText: (isDark) => ({
    fontSize: '0.825rem',
    fontWeight: 600,
    color: isDark ? 'var(--text-muted)' : '#475569',
  }),
  phoneText: (isDark) => ({
    fontSize: '0.8rem',
    color: isDark ? 'var(--text-muted)' : '#64748b',
  }),
  dateText: (isDark) => ({
    fontSize: '0.8rem',
    color: isDark ? 'var(--text-muted)' : '#64748b',
  }),
  statusToggleBtn: (isActive) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 14,
    border: isActive ? '1px solid #86efac' : '1px solid #fca5a5',
    background: isActive ? '#f0fdf4' : '#fef2f2',
    color: isActive ? '#15803d' : '#b91c1c',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all .12s ease',
  }),
  statusDot: (isActive) => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: isActive ? '#22c55e' : '#ef4444',
  }),
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  sheetShortcutBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#1e293b',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background .15s',
  },
  editBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #3b82f6',
    background: '#eff6ff',
    color: '#2563eb',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background .15s',
  },
  delBtn: {
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid #fca5a5',
    background: '#fef2f2',
    color: '#dc2626',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  empty: (isDark) => ({
    textAlign: 'center',
    padding: '4rem 2rem',
    color: isDark ? 'var(--text-muted)' : '#64748b',
    fontSize: '1rem',
    fontWeight: 600,
  }),

  // ── Pagination ──
  paginationWrap: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 18px',
    borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    flexWrap: 'wrap',
    gap: 10,
  }),
  pageSelect: (isDark) => ({
    border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
    background: isDark ? 'var(--bg-subtle)' : '#ffffff',
    color: isDark ? 'var(--text-main)' : '#0f172a',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 13,
  }),

  // ── Modals ──
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 580,
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
  }),
  modalHeader: (primaryColor) => ({
    background: `linear-gradient(135deg, ${primaryColor} 0%, #1e3a8a 100%)`,
    padding: '1.1rem 1.4rem',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
  modalTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    margin: 0,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#ffffff',
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    cursor: 'pointer',
  },
  modalBody: {
    padding: '1.4rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  label: (isDark) => ({
    fontSize: 12,
    fontWeight: 700,
    color: isDark ? 'var(--text-main)' : '#334155',
  }),
  req: {
    color: '#ef4444',
  },
  input: (isDark) => ({
    padding: '9px 12px',
    borderRadius: 8,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
    background: isDark ? 'var(--bg-subtle)' : '#ffffff',
    color: isDark ? 'var(--text-main)' : '#0f172a',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }),
  inputErr: {
    borderColor: '#ef4444',
  },
  errMsg: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 2,
  },
  modalFooter: (isDark) => ({
    padding: '1rem 1.4rem',
    borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    background: isDark ? 'var(--bg-subtle)' : '#f8fafc',
  }),
  cancelBtn: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
    color: isDark ? 'var(--text-main)' : '#475569',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }),
  saveBtn: (primaryColor) => ({
    background: primaryColor,
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 22px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  }),
  loadingBox: (isDark) => ({
    padding: '4rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: isDark ? 'var(--text-muted)' : '#64748b',
  }),
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #cbd5e1',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
