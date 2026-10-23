import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ROLES = ['Stitching', 'Machine Op', 'Pressing', 'Finishing', 'Safety', 'Cutting', 'Kajkari', 'Buttons', 'Other'];
const initForm = { name: '', sheetType: '', role: '', phone: '', status: 'Active', joinDate: '', personType: 'Worker' };
const avatarColor = (name) => {
  const colors = ['#C55A11','#2E75B6','#70AD47','#7030A0','#BE0000','#1F7391','#375623','#843C0C','#4472C4'];
  let h = 0; for (let c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
};

export default function LabourModule() {
  const { can } = useAuth();
  const [labours, setLabours]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(initForm);
  const [editing, setEditing]     = useState(null);
  const [errors, setErrors]       = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [apiError, setApiError]   = useState('');
  const [page,     setPage]       = useState(1);
  const [pageSize, setPageSize]   = useState(10);

  // Load workers from real API
  const loadWorkers = async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await api.get('/workers');
      const mapped = res.data.map(w => ({
        id:         w.id,
        name:       w.name,
        sheetType:  w.sheetType,
        role:       w.role || 'Worker',
        phone:      w.phone || '',
        status:     w.isActive === false ? 'Inactive' : 'Active',
        joinDate:   w.joinDate ? w.joinDate.split('T')[0] : '',
        personType: w.personType || 'Worker',
      }));
      setLabours(mapped);
    } catch {
      setApiError('Could not load workers from server.');
    }
    setLoading(false);
  };

  useEffect(() => { loadWorkers(); }, []);

  const filtered = labours.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
                        l.role.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || l.status === filter;
    return matchSearch && matchFilter;
  });

  useEffect(() => { setPage(1); }, [search, filter, pageSize]);
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.personType === 'Worker') {
      if (!form.sheetType.trim()) e.sheetType = 'Sheet type is required';
      if (!form.role)             e.role = 'Role is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd  = () => { setForm(initForm); setEditing(null); setErrors({}); setShowModal(true); };
  const openEdit = (l) => { setForm({ name: l.name, sheetType: l.sheetType, role: l.role, phone: l.phone, status: l.status, joinDate: l.joinDate, personType: l.personType || 'Worker' }); setEditing(l); setErrors({}); setShowModal(true); };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        // Update via workers API
        await api.put(`/workers/${editing.id}`, {
          name: form.name, sheetType: form.sheetType || form.name,
          isActive: form.status === 'Active', personType: form.personType
        });
      } else {
        // Create via workers API
        await api.post('/workers', {
          name: form.name, sheetType: form.sheetType || form.name,
          isActive: form.status === 'Active', personType: form.personType
        });
      }
      await loadWorkers();
      setShowModal(false);
    } catch {
      // Fallback: update local state
      if (editing) {
        setLabours(labours.map(l => l.id === editing.id ? { ...l, ...form } : l));
      } else {
        setLabours([...labours, { ...form, id: Date.now() }]);
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

  const toggleStatus = async (id) => {
    const labour = labours.find(l => l.id === id);
    try {
      await api.patch(`/workers/${id}/toggle-status`);
      await loadWorkers();
    } catch {
      setLabours(labours.map(l => l.id === id
        ? { ...l, status: l.status === 'Active' ? 'Inactive' : 'Active' } : l));
    }
  };

  const active     = labours.filter(l => l.status === 'Active').length;
  const inactive   = labours.filter(l => l.status === 'Inactive').length;
  const management = labours.filter(l => l.personType === 'Management').length;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.headerLabel}>Workforce</div>
          <div style={styles.headerTitle}>Production</div>
        </div>
        {can('canAddLabour') && (
          <button style={styles.addBtn} onClick={openAdd}>
            <span style={{ fontSize: 18 }}>+</span> Add Worker
          </button>
        )}
      </div>

      {apiError && (
        <div style={{ background: '#FBEAEA', color: '#BE0000', padding: '10px 2rem', fontSize: 13 }}>
          ⚠️ {apiError}
        </div>
      )}

      <div style={styles.statsRow}>
        {[
          { label: 'Total Staff',  value: labours.length, color: '#2E75B6', bg: '#EBF3FB' },
          { label: 'Active',       value: active,         color: '#70AD47', bg: '#EEF6E6' },
          { label: 'Inactive',     value: inactive,       color: '#BE0000', bg: '#FBEAEA' },
          { label: 'Management',   value: management,     color: '#7030A0', bg: '#F3E8FF' },
        ].map(s => (
          <div key={s.label} style={{ ...styles.statCard, background: s.bg, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ ...styles.statNum, color: s.color }}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.toolbar}>
        <input style={styles.search} placeholder="🔍  Search by name or role..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div style={styles.filterGroup}>
          {['All', 'Active', 'Inactive'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ ...styles.filterBtn, ...(filter === f ? styles.filterActive : {}) }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.tableWrap}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>⏳ Loading workers...</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['#', 'Worker Name', 'Work Type', 'Role', 'Phone', 'Join Date', 'Status', 'Actions'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={8} style={styles.empty}>No labour records found</td></tr>
              )}
              {paginated.map((l, i) => (
                <tr key={l.id} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{(page - 1) * pageSize + i + 1}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ ...styles.avatar, background: avatarColor(l.name) }}>
                        {l.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{l.name}</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    {l.personType === 'Management'
                      ? <span style={styles.mgmtBadge}>Management</span>
                      : <span style={styles.sheetBadge}>{l.sheetType}</span>}
                  </td>
                  <td style={styles.td}>
                    {l.personType === 'Management'
                      ? <span style={{ color: '#7030A0', fontWeight: 600, fontSize: 12 }}>Owner / Salary</span>
                      : l.role}
                  </td>
                  <td style={styles.td}>{l.phone || '—'}</td>
                  <td style={styles.td}>{l.joinDate || '—'}</td>
                  <td style={styles.td}>
                    <span onClick={() => toggleStatus(l.id)}
                      style={{ ...styles.statusBadge, ...(l.status === 'Active' ? styles.statusActive : styles.statusInactive) }}
                      title="Click to toggle">
                      {l.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {can('canEditLabour') && (
                        <button style={styles.editBtn} onClick={() => openEdit(l)}>Edit</button>
                      )}
                      {can('canDeleteLabour') && (
                        <button style={styles.delBtn} onClick={() => setDeleteConfirm(l.id)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <LabPagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span style={styles.modalTitle}>{editing ? 'Edit Labour' : 'Add New Labour'}</span>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGrid}>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Person Type <span style={styles.req}>*</span></label>
                  <select style={styles.input} value={form.personType}
                    onChange={e => setForm({ ...form, personType: e.target.value })}>
                    <option value="Worker">Worker (Production Staff)</option>
                    <option value="Management">Management (Owner / Salary Only)</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name <span style={styles.req}>*</span></label>
                  <input style={{ ...styles.input, ...(errors.name ? styles.inputErr : {}) }}
                    placeholder="e.g. Ali Hassan" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })} />
                  {errors.name && <span style={styles.errMsg}>{errors.name}</span>}
                </div>
                {form.personType === 'Worker' && (
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Sheet Type <span style={styles.req}>*</span></label>
                    <input style={{ ...styles.input, ...(errors.sheetType ? styles.inputErr : {}) }}
                      placeholder="e.g. AliHassan" value={form.sheetType}
                      onChange={e => setForm({ ...form, sheetType: e.target.value })} />
                    {errors.sheetType && <span style={styles.errMsg}>{errors.sheetType}</span>}
                  </div>
                )}
                {form.personType === 'Worker' && (
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Role <span style={styles.req}>*</span></label>
                    <select style={{ ...styles.input, ...(errors.role ? styles.inputErr : {}) }}
                      value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="">-- Select Role --</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {errors.role && <span style={styles.errMsg}>{errors.role}</span>}
                  </div>
                )}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Phone Number</label>
                  <input style={styles.input} placeholder="e.g. 0300-1234567"
                    value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Join Date <span style={styles.req}>*</span></label>
                  <input type="date" style={{ ...styles.input, ...(errors.joinDate ? styles.inputErr : {}) }}
                    value={form.joinDate} onChange={e => setForm({ ...form, joinDate: e.target.value })} />
                  {errors.joinDate && <span style={styles.errMsg}>{errors.joinDate}</span>}
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Status</label>
                  <select style={styles.input} value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Save Labour'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: 400 }}>
            <div style={{ ...styles.modalHeader, background: '#BE0000' }}>
              <span style={styles.modalTitle}>Confirm Delete</span>
              <button style={styles.closeBtn} onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div style={{ padding: '1.5rem', fontSize: 15, color: '#444' }}>
              Are you sure you want to delete <b>{labours.find(l => l.id === deleteConfirm)?.name}</b>?
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={{ ...styles.saveBtn, background: '#BE0000' }} onClick={() => handleDelete(deleteConfirm)}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LabPagination({ page, pageSize, total, onPage, onPageSize }) {
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
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderTop:'1px solid #eef1f6', flexWrap:'wrap', justifyContent:'space-between', background:'#fff' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:13, color:'#666' }}>Rows per page:</span>
        <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))} style={{ border:'1px solid #d0d8e4', borderRadius:5, padding:'4px 8px', fontSize:13 }}>
          {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize:13, color:'#666' }}>Showing {from}–{to} of {total}</span>
      </div>
      <div style={{ display:'flex', gap:4 }}>
        <LabPageBtn onClick={() => onPage(page - 1)} disabled={page <= 1}>←</LabPageBtn>
        {pages.map((p, i) => typeof p === 'number'
          ? <LabPageBtn key={p} onClick={() => onPage(p)} active={p === page}>{p}</LabPageBtn>
          : <span key={i} style={{ padding:'0 4px', color:'#aaa', lineHeight:'30px' }}>…</span>)}
        <LabPageBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages}>→</LabPageBtn>
      </div>
    </div>
  );
}
function LabPageBtn({ onClick, disabled, active, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ minWidth:30, height:30, border:`1px solid ${active ? '#2E75B6' : '#d0d8e4'}`, borderRadius:5, background: active ? '#2E75B6' : '#fff', color: active ? '#fff' : '#555', cursor: disabled ? 'default' : 'pointer', fontSize:13, fontWeight: active ? 700 : 400, opacity: disabled ? 0.4 : 1 }}>
      {children}
    </button>
  );
}

const styles = {
  page:         { fontFamily: "'Segoe UI', Arial, sans-serif", background: '#F4F6F9', minHeight: '100vh', paddingBottom: '2rem' },
  header:       { background: '#1e2a3b', padding: '1.2rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel:  { color: '#7a9cc0', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle:  { color: '#fff', fontSize: '1.4rem', fontWeight: 600 },
  addBtn:       { background: '#70AD47', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },
  statsRow:     { display: 'flex', gap: 16, padding: '1.5rem 2rem 0' },
  statCard:     { borderRadius: 10, padding: '1rem 1.5rem', flex: 1 },
  statNum:      { fontSize: '2rem', fontWeight: 700 },
  statLabel:    { fontSize: 13, color: '#666', marginTop: 2 },
  toolbar:      { display: 'flex', gap: 12, padding: '1.2rem 2rem', alignItems: 'center', flexWrap: 'wrap' },
  search:       { flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 8, border: '1px solid #d0d8e4', fontSize: 14, outline: 'none', background: '#fff' },
  filterGroup:  { display: 'flex', gap: 4 },
  filterBtn:    { padding: '8px 16px', border: '1px solid #d0d8e4', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#555' },
  filterActive: { background: '#2E75B6', color: '#fff', border: '1px solid #2E75B6' },
  tableWrap:    { margin: '0 2rem', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', background: '#fff' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th:           { background: '#2E75B6', color: '#fff', padding: '12px 14px', textAlign: 'left', fontWeight: 500, fontSize: 13 },
  trEven:       { background: '#fff' },
  trOdd:        { background: '#f8fafd' },
  td:           { padding: '11px 14px', borderBottom: '1px solid #eef1f6', verticalAlign: 'middle' },
  empty:        { textAlign: 'center', padding: '3rem', color: '#aaa', fontSize: 15 },
  avatar:       { width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  sheetBadge:   { background: '#EBF3FB', color: '#2E75B6', borderRadius: 4, padding: '3px 8px', fontSize: 12, fontWeight: 500 },
  mgmtBadge:    { background: '#F3E8FF', color: '#7030A0', borderRadius: 4, padding: '3px 8px', fontSize: 12, fontWeight: 600 },
  statusBadge:  { borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none' },
  statusActive: { background: '#EEF6E6', color: '#4a8a1e' },
  statusInactive: { background: '#FBEAEA', color: '#BE0000' },
  editBtn:      { background: '#70AD47', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 12px', cursor: 'pointer', fontSize: 12 },
  delBtn:       { background: '#BE0000', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 12px', cursor: 'pointer', fontSize: 12 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#fff', borderRadius: 12, width: '90%', maxWidth: 620, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
  modalHeader:  { background: '#1e2a3b', borderRadius: '12px 12px 0 0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle:   { color: '#fff', fontWeight: 600, fontSize: 16 },
  closeBtn:     { background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' },
  modalBody:    { padding: '1.5rem' },
  formGrid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  formGroup:    { display: 'flex', flexDirection: 'column', gap: 4 },
  label:        { fontSize: 12, fontWeight: 600, color: '#555' },
  req:          { color: '#BE0000' },
  input:        { padding: '9px 12px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, width: '100%' },
  inputErr:     { border: '1px solid #BE0000' },
  errMsg:       { fontSize: 11, color: '#BE0000' },
  modalFooter:  { padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10 },
  cancelBtn:    { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontSize: 14 },
  saveBtn:      { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 22px', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};
