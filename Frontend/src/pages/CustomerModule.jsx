import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getCustomers, createCustomer, updateCustomer, toggleCustomerStatus, deleteCustomer,
} from '../services/api';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const emptyForm = () => ({ name: '', phone: '', address: '', notes: '' });

// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerModule() {
  const [customers, setCustomers]   = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [search,    setSearch]      = useState('');
  const [filter,    setFilter]      = useState('active'); // 'all' | 'active' | 'inactive'
  const [view,      setView]        = useState('cards');  // 'cards' | 'table'
  const [showForm,  setShowForm]    = useState(false);
  const [editing,   setEditing]     = useState(null);
  const [form,      setForm]        = useState(emptyForm());
  const [saving,    setSaving]      = useState(false);
  const [delTarget, setDelTarget]   = useState(null);
  const [error,     setError]       = useState('');
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCustomers(await getCustomers());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = customers.filter(c => {
    if (filter === 'active'   && !c.isActive) return false;
    if (filter === 'inactive' &&  c.isActive) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q)    ||
        c.phone?.toLowerCase().includes(q)   ||
        c.address?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  useEffect(() => { setPage(1); }, [filter, search, pageSize]);
  const paginated = useMemo(() => displayed.slice((page-1)*pageSize, page*pageSize), [displayed, page, pageSize]);

  const activeCount   = customers.filter(c => c.isActive).length;
  const inactiveCount = customers.filter(c => !c.isActive).length;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setShowForm(true);
  };

  const openEdit = c => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || '', address: c.address || '', notes: c.notes || '' });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Customer name is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name:    form.name.trim(),
        phone:   form.phone.trim()   || null,
        address: form.address.trim() || null,
        notes:   form.notes.trim()   || null,
      };
      if (editing) await updateCustomer(editing.id, payload);
      else         await createCustomer(payload);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e.response?.data || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async c => {
    try {
      await toggleCustomerStatus(c.id);
      await load();
    } catch {}
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    try {
      await deleteCustomer(delTarget.id);
      setDelTarget(null);
      await load();
    } catch (e) {
      setError(e.response?.data || 'Failed to delete.');
      setDelTarget(null);
    }
  };

  const field = (key, label, placeholder = '', type = 'text') => (
    <div key={key}>
      <label style={s.label}>{label}</label>
      {key === 'address' || key === 'notes' ? (
        <textarea style={{ ...s.input, minHeight: 64, resize: 'vertical' }}
          value={form[key]} placeholder={placeholder}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
      ) : (
        <input style={s.input} type={type} value={form[key]} placeholder={placeholder}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
      )}
    </div>
  );

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>👥</div>
          <div>
            <div style={s.headerSub}>CRM</div>
            <div style={s.headerTitle}>Customers</div>
          </div>
        </div>
        <button onClick={openAdd} style={s.addBtn}>+ Add Customer</button>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        {[
          { label: 'Total',    val: customers.length, color: '#2E75B6' },
          { label: 'Active',   val: activeCount,      color: '#16a34a' },
          { label: 'Inactive', val: inactiveCount,    color: '#dc2626' },
        ].map(({ label, val, color }) => (
          <div key={label} style={s.statCard}>
            <div style={{ ...s.statVal, color }}>{val}</div>
            <div style={s.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <input
          style={s.searchBox} placeholder="Search name, phone, address…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <div style={s.pills}>
          {[['all','All'],['active','Active'],['inactive','Inactive']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{ ...s.pill, ...(filter === k ? s.pillActive : {}) }}>
              {l}
            </button>
          ))}
        </div>
        <div style={s.viewToggle}>
          {[['cards','⊞'],['table','☰']].map(([k, ic]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ ...s.viewBtn, ...(view === k ? s.viewBtnActive : {}) }}
              title={k === 'cards' ? 'Card view' : 'Table view'}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={s.loading}>Loading customers…</div>
      ) : displayed.length === 0 ? (
        <div style={s.empty}>No customers found.</div>
      ) : (
        <>
          {view === 'cards' ? (
            <CardView customers={paginated} onEdit={openEdit} onToggle={handleToggle} onDelete={setDelTarget} />
          ) : (
            <TableView customers={paginated} onEdit={openEdit} onToggle={handleToggle} onDelete={setDelTarget} />
          )}
          <CustPagination
            page={page} pageSize={pageSize} total={displayed.length}
            onPage={setPage} onPageSize={setPageSize}
          />
        </>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={s.overlay} onClick={() => setShowForm(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>{editing ? 'Edit Customer' : 'New Customer'}</div>
            {field('name',    'Name *',    'e.g. Ahmed Traders')}
            {field('phone',   'Phone',     'e.g. 0300-1234567', 'tel')}
            {field('address', 'Address',   'Street, City…')}
            {field('notes',   'Notes',     'Any additional info…')}
            {error && <div style={s.errMsg}>{error}</div>}
            <div style={s.modalActions}>
              <button onClick={() => setShowForm(false)} style={s.cancelBtn}>Cancel</button>
              <button onClick={handleSave} style={s.saveBtn} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {delTarget && (
        <div style={s.overlay} onClick={() => setDelTarget(null)}>
          <div style={{ ...s.modal, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Delete Customer?</div>
            <p style={{ color: '#555', fontSize: 14, margin: '8px 0 16px' }}>
              Permanently remove <strong>{delTarget.name}</strong>? This cannot be undone.
            </p>
            {error && <div style={s.errMsg}>{error}</div>}
            <div style={s.modalActions}>
              <button onClick={() => setDelTarget(null)} style={s.cancelBtn}>Cancel</button>
              <button onClick={handleDelete} style={{ ...s.saveBtn, background: '#dc2626' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function CardView({ customers, onEdit, onToggle, onDelete }) {
  const active   = customers.filter(c =>  c.isActive);
  const inactive = customers.filter(c => !c.isActive);

  const renderSection = (list, title, accent) => list.length > 0 && (
    <>
      <div style={{ ...s.sectionLabel, color: accent }}>{title} ({list.length})</div>
      <div style={s.grid}>
        {list.map(c => <CustomerCard key={c.id} c={c} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />)}
      </div>
    </>
  );

  return (
    <div>
      {renderSection(active,   'Active Customers',   '#16a34a')}
      {renderSection(inactive, 'Inactive Customers', '#dc2626')}
    </div>
  );
}

function CustomerCard({ c, onEdit, onToggle, onDelete }) {
  return (
    <div style={{ ...s.card, opacity: c.isActive ? 1 : 0.7 }}>
      <div style={s.cardTop}>
        <div style={s.avatar}>{c.name.charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.cardName}>{c.name}</div>
          {c.phone && <div style={s.cardPhone}>📞 {c.phone}</div>}
        </div>
        <span style={{ ...s.statusBadge, background: c.isActive ? '#dcfce7' : '#fee2e2', color: c.isActive ? '#16a34a' : '#dc2626' }}>
          {c.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {c.address && <div style={s.cardRow}>📍 {c.address}</div>}
      {c.notes   && <div style={s.cardNotes}>{c.notes}</div>}

      <div style={s.cardDate}>Added {fmtDate(c.createdAt)}</div>

      <div style={s.cardActions}>
        <button onClick={() => onEdit(c)} style={s.editBtn}>Edit</button>
        <button onClick={() => onToggle(c)} style={c.isActive ? s.deactivateBtn : s.activateBtn}>
          {c.isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button onClick={() => onDelete(c)} style={s.delBtn}>Delete</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function TableView({ customers, onEdit, onToggle, onDelete }) {
  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr style={s.thead}>
            {['Name','Phone','Address','Notes','Status','Added',''].map(h => (
              <th key={h} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id} style={{ ...s.tr, opacity: c.isActive ? 1 : 0.65 }}>
              <td style={{ ...s.td, fontWeight: 600 }}>{c.name}</td>
              <td style={s.td}>{c.phone || '—'}</td>
              <td style={{ ...s.td, maxWidth: 180 }}>{c.address || '—'}</td>
              <td style={{ ...s.td, maxWidth: 200, color: '#888' }}>{c.notes || '—'}</td>
              <td style={s.td}>
                <span style={{ ...s.statusBadge, background: c.isActive ? '#dcfce7' : '#fee2e2', color: c.isActive ? '#16a34a' : '#dc2626' }}>
                  {c.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td style={s.td}>{fmtDate(c.createdAt)}</td>
              <td style={s.td}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => onEdit(c)} style={s.editBtn}>Edit</button>
                  <button onClick={() => onToggle(c)} style={c.isActive ? s.deactivateBtn : s.activateBtn}>
                    {c.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => onDelete(c)} style={s.delBtn}>Del</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function CustPagination({ page, pageSize, total, onPage, onPageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    const set = new Set([1, totalPages, page-1, page, page+1].filter(p => p >= 1 && p <= totalPages));
    const sorted = [...set].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i-1] > 1) pages.push('…');
      pages.push(sorted[i]);
    }
  }
  const from = total === 0 ? 0 : (page-1)*pageSize + 1;
  const to   = Math.min(page*pageSize, total);

  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', marginTop:8, background:'#fff', borderRadius:10, boxShadow:'0 1px 6px rgba(0,0,0,.07)', flexWrap:'wrap', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#6b7280' }}>
        <span style={{ fontWeight:600 }}>Rows per page:</span>
        <select value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          style={{ border:'1.5px solid #dde', borderRadius:7, padding:'5px 10px', fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
          {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ color:'#9ca3af' }}>Showing <b style={{ color:'#374151' }}>{from}–{to}</b> of <b style={{ color:'#374151' }}>{total}</b></span>
      </div>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <CustPageBtn disabled={page <= 1} onClick={() => onPage(page-1)}>‹ Prev</CustPageBtn>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} style={{ padding:'4px 4px', color:'#9ca3af', fontSize:14 }}>…</span>
            : <CustPageBtn key={p} active={p === page} onClick={() => onPage(p)}>{p}</CustPageBtn>
        )}
        <CustPageBtn disabled={page >= totalPages} onClick={() => onPage(page+1)}>Next ›</CustPageBtn>
      </div>
    </div>
  );
}

function CustPageBtn({ onClick, disabled, active, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:'5px 10px', borderRadius:7, border:'1.5px solid',
      borderColor: active ? '#2E75B6' : '#dde',
      background: active ? '#2E75B6' : disabled ? '#f9fafb' : '#fff',
      color: active ? '#fff' : disabled ? '#d1d5db' : '#374151',
      fontSize:13, fontWeight: active ? 700 : 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      minWidth:34, transition:'all .1s',
    }}>{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = {
  page:         { padding: 24, maxWidth: 1100, margin: '0 auto' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  headerLeft:   { display: 'flex', alignItems: 'center', gap: 14 },
  headerIcon:   { fontSize: 36 },
  headerSub:    { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle:  { fontSize: '1.5rem', fontWeight: 700, color: '#1e2a3b' },
  addBtn:       { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },

  statsRow:     { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  statCard:     { background: '#fff', borderRadius: 10, padding: '14px 28px', boxShadow: '0 1px 6px rgba(0,0,0,.07)', textAlign: 'center', minWidth: 100 },
  statVal:      { fontSize: '1.8rem', fontWeight: 800 },
  statLabel:    { fontSize: 11, color: '#888', marginTop: 2 },

  toolbar:      { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' },
  searchBox:    { flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #dde', borderRadius: 8, fontSize: 13 },
  pills:        { display: 'flex', gap: 6 },
  pill:         { border: '1px solid #dde', background: '#f8f9fa', borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600, color: '#555' },
  pillActive:   { background: '#2E75B6', color: '#fff', borderColor: '#2E75B6' },
  viewToggle:   { display: 'flex', border: '1px solid #dde', borderRadius: 8, overflow: 'hidden' },
  viewBtn:      { border: 'none', background: '#f8f9fa', padding: '7px 12px', cursor: 'pointer', fontSize: 15, color: '#777' },
  viewBtnActive:{ background: '#2E75B6', color: '#fff' },

  loading:      { padding: 60, textAlign: 'center', color: '#888' },
  empty:        { padding: 60, textAlign: 'center', color: '#aaa', fontStyle: 'italic' },

  sectionLabel: { fontSize: 12, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', margin: '18px 0 10px' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 8 },

  card:         { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 6px rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', gap: 8, transition: 'box-shadow .2s' },
  cardTop:      { display: 'flex', alignItems: 'flex-start', gap: 12 },
  avatar:       { width: 42, height: 42, borderRadius: '50%', background: '#2E75B6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 },
  cardName:     { fontWeight: 700, fontSize: 15, color: '#1e2a3b' },
  cardPhone:    { fontSize: 13, color: '#555', marginTop: 2 },
  statusBadge:  { fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap', flexShrink: 0 },
  cardRow:      { fontSize: 13, color: '#555' },
  cardNotes:    { fontSize: 12, color: '#888', fontStyle: 'italic', background: '#f8f9fa', borderRadius: 6, padding: '6px 10px' },
  cardDate:     { fontSize: 11, color: '#bbb', marginTop: 2 },
  cardActions:  { display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' },

  editBtn:      { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  deactivateBtn:{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', borderRadius: 5, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  activateBtn:  { background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: 5, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  delBtn:       { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },

  tableWrap:    { background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflow: 'auto' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  thead:        { background: '#f8f9fa' },
  th:           { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#555', borderBottom: '2px solid #eee', whiteSpace: 'nowrap' },
  tr:           { borderBottom: '1px solid #f0f0f0' },
  td:           { padding: '10px 14px', fontSize: 13, color: '#333', verticalAlign: 'middle' },

  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 8px 40px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle:   { fontSize: '1.1rem', fontWeight: 700, color: '#1e2a3b', marginBottom: 4 },
  label:        { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 2, display: 'block' },
  input:        { width: '100%', padding: '8px 10px', border: '1px solid #dde', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' },
  errMsg:       { color: '#dc2626', fontSize: 12, background: '#fef2f2', padding: '8px 12px', borderRadius: 6 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn:    { background: '#f1f5f9', color: '#333', border: 'none', borderRadius: 7, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  saveBtn:      { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 22px', fontWeight: 700, cursor: 'pointer', fontSize: 13 },
};
