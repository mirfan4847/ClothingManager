import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getCustomers, createCustomer, updateCustomer, toggleCustomerStatus, deleteCustomer,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const emptyForm = () => ({ name: '', phone: '', address: '', notes: '' });

// ── Bootstrap 5 Palette ──
const BT = {
  primary:   '#0d6efd',
  secondary: '#6c757d',
  success:   '#198754',
  danger:    '#dc3545',
  warning:   '#ffc107',
  info:      '#0dcaf0',
  dark:      '#212529',
};

export default function CustomerModule() {
  const { isDark } = useTheme();

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
  const [pageSize, setPageSize]     = useState(12);

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
      setError(e.response?.data || 'Failed to save customer.');
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
      setError(e.response?.data || 'Failed to delete customer.');
      setDelTarget(null);
    }
  };

  const field = (key, label, placeholder = '', type = 'text') => (
    <div key={key}>
      <label style={styles.label(isDark)}>{label}</label>
      {key === 'address' || key === 'notes' ? (
        <textarea
          style={{ ...styles.input(isDark), minHeight: 64, resize: 'vertical' }}
          value={form[key]} placeholder={placeholder}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      ) : (
        <input
          style={styles.input(isDark)} type={type} value={form[key]} placeholder={placeholder}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      )}
    </div>
  );

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">

      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>👥</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>CRM &amp; PARTNERS</div>
            <h1 style={styles.headerTitle(isDark)}>Customer Directory &amp; Accounts</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={styles.headerBadge}>
            Client Roster
          </span>
          <span style={styles.headerSubBadge(isDark)}>
            {customers.length} Accounts Registered
          </span>
          <button onClick={openAdd} style={styles.addBtn}>
            <span>+</span> Add New Customer
          </button>
        </div>
      </div>

      <div style={styles.content}>

        {/* ── 3 Executive KPI Cards with Bootstrap Colors ── */}
        <div style={styles.kpiGrid}>
          <BtKpiCard
            label="Total Customers"
            tag="CLIENT BASE"
            value={customers.length}
            gradient="linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)"
            glow="rgba(13, 110, 253, 0.35)"
            icon="🤝"
            sub="Registered buyer profiles"
            onClick={() => setFilter('all')}
          />
          <BtKpiCard
            label="Active Customers"
            tag="IN GOOD STANDING"
            value={activeCount}
            gradient="linear-gradient(135deg, #146c43 0%, #198754 100%)"
            glow="rgba(25, 135, 84, 0.35)"
            icon="✅"
            sub="Permitted for new sales orders"
            onClick={() => setFilter('active')}
          />
          <BtKpiCard
            label="Inactive / On Hold"
            tag="PAUSED TRADING"
            value={inactiveCount}
            gradient="linear-gradient(135deg, #b02a37 0%, #dc3545 100%)"
            glow="rgba(220, 53, 69, 0.35)"
            icon="⏸️"
            sub="Deactivated customer records"
            onClick={() => setFilter('inactive')}
          />
        </div>

        {/* ── Toolbar ── */}
        <div style={styles.toolbar(isDark)}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 13 }}>🔍</span>
            <input
              style={{ ...styles.input(isDark), paddingLeft: 34 }}
              placeholder="Search by customer name, phone, address, notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              ['all', 'All Accounts'],
              ['active', `Active (${activeCount})`],
              ['inactive', `Inactive (${inactiveCount})`],
            ].map(([k, l]) => {
              const active = filter === k;
              return (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  style={styles.filterPill(active, k, isDark)}
                >
                  {l}
                </button>
              );
            })}

            <div style={styles.viewToggle(isDark)}>
              <button
                onClick={() => setView('cards')}
                style={styles.viewBtn(view === 'cards', isDark)}
                title="Card View"
              >
                ⊞
              </button>
              <button
                onClick={() => setView('table')}
                style={styles.viewBtn(view === 'table', isDark)}
                title="Table View"
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {/* ── Content View ── */}
        {loading ? (
          <div style={styles.loadingBox(isDark)}>
            <div style={styles.spinner} />
            <div style={{ marginTop: 14, fontWeight: 600 }}>Loading customer records…</div>
          </div>
        ) : displayed.length === 0 ? (
          <div style={styles.emptyCardBox(isDark)}>
            No customers found matching your criteria.
          </div>
        ) : (
          <>
            {view === 'cards' ? (
              <CardView
                customers={paginated}
                onEdit={openEdit}
                onToggle={handleToggle}
                onDelete={setDelTarget}
                isDark={isDark}
              />
            ) : (
              <TableView
                customers={paginated}
                onEdit={openEdit}
                onToggle={handleToggle}
                onDelete={setDelTarget}
                isDark={isDark}
              />
            )}
            <CustPagination
              page={page}
              pageSize={pageSize}
              total={displayed.length}
              onPage={setPage}
              onPageSize={setPageSize}
              isDark={isDark}
            />
          </>
        )}

      </div>

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div style={styles.overlay} onClick={() => setShowForm(false)}>
          <div style={styles.modal(isDark)} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>
                {editing ? '✏️ Edit Customer Profile' : '👥 Add New Customer'}
              </span>
              <button onClick={() => setShowForm(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {field('name',    'Customer / Business Name *', 'e.g. Habib Hosiery')}
              {field('phone',   'Phone Number',               'e.g. 0300-1234567', 'tel')}
              {field('address', 'Delivery Address',           'Shop / Mill address, City…')}
              {field('notes',   'Account Remarks / Terms',    'Credit period, contact person, etc.')}

              {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button onClick={() => setShowForm(false)} style={styles.btnSecondary}>
                  Cancel
                </button>
                <button onClick={handleSave} style={styles.btnSuccess} disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {delTarget && (
        <div style={styles.overlay} onClick={() => setDelTarget(null)}>
          <div style={{ ...styles.modal(isDark), maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <span style={{ fontSize: 16, fontWeight: 800, color: BT.danger }}>
                ⚠️ Delete Customer Record?
              </span>
              <button onClick={() => setDelTarget(null)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ color: isDark ? 'var(--text-main)' : '#212529', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                Are you sure you want to permanently remove <strong>{delTarget.name}</strong> from your customer list? This action cannot be undone.
              </p>

              {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button onClick={() => setDelTarget(null)} style={styles.btnSecondary}>
                  Cancel
                </button>
                <button onClick={handleDelete} style={styles.btnDanger}>
                  Delete Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Reusable KPI Card (Bootstrap 5 Style) ──
function BtKpiCard({ label, tag, value, gradient, glow, icon, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: gradient,
        borderRadius: 14,
        padding: '16px 18px',
        color: '#ffffff',
        boxShadow: `0 8px 24px ${glow}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 105,
        overflow: 'hidden',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: 'rgba(255, 255, 255, 0.22)',
          padding: '2px 8px',
          borderRadius: 6,
          backdropFilter: 'blur(4px)',
        }}>
          {tag}
        </span>
        <span style={{ fontSize: 20, opacity: 0.9 }}>{icon}</span>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
          {value}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.92)', marginTop: 2 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.75)', marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Card View ──
function CardView({ customers, onEdit, onToggle, onDelete, isDark }) {
  return (
    <div style={styles.grid}>
      {customers.map(c => (
        <div key={c.id} style={styles.custCard(isDark, c.isActive)}>
          <div style={styles.cardTop}>
            <div style={styles.avatar(c.isActive)}>
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.cardName(isDark)}>{c.name}</div>
              {c.phone ? (
                <div style={styles.cardPhone(isDark)}>📞 {c.phone}</div>
              ) : (
                <div style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#adb5bd' }}>No phone provided</div>
              )}
            </div>
            <span style={styles.statusBadge(c.isActive)}>
              {c.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {c.address && (
            <div style={styles.cardRow(isDark)}>
              📍 {c.address}
            </div>
          )}

          {c.notes && (
            <div style={styles.cardNotes(isDark)}>
              {c.notes}
            </div>
          )}

          <div style={styles.cardDate(isDark)}>
            Member since {fmtDate(c.createdAt)}
          </div>

          <div style={styles.cardActions}>
            <button onClick={() => onEdit(c)} style={styles.btnEditSm}>
              ✏️ Edit
            </button>
            <button
              onClick={() => onToggle(c)}
              style={c.isActive ? styles.btnWarnSm : styles.btnSuccessSm}
            >
              {c.isActive ? '⏸️ Deactivate' : '▶️ Activate'}
            </button>
            <button onClick={() => onDelete(c)} style={styles.btnDelSm}>
              🗑️ Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Table View ──
function TableView({ customers, onEdit, onToggle, onDelete, isDark }) {
  return (
    <div style={styles.cardBox(isDark)}>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Customer Name', 'Phone', 'Address', 'Remarks / Notes', 'Account Status', 'Member Since', 'Actions'].map(h => (
                <th key={h} style={styles.th(isDark)}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => (
              <tr key={c.id} style={styles.tr(isDark, i % 2 === 0, c.isActive)}>
                <td style={styles.td(isDark)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ ...styles.avatar(c.isActive), width: 32, height: 32, fontSize: 13 }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <strong style={{ color: isDark ? '#ffffff' : '#212529' }}>{c.name}</strong>
                  </div>
                </td>
                <td style={styles.td(isDark)}>{c.phone || '—'}</td>
                <td style={{ ...styles.td(isDark), maxWidth: 220 }}>{c.address || '—'}</td>
                <td style={{ ...styles.td(isDark), maxWidth: 240, color: isDark ? 'var(--text-muted)' : '#6c757d' }}>
                  {c.notes || '—'}
                </td>
                <td style={styles.td(isDark)}>
                  <span style={styles.statusBadge(c.isActive)}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={styles.td(isDark)}>{fmtDate(c.createdAt)}</td>
                <td style={styles.td(isDark)}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onEdit(c)} style={styles.btnEditSm}>Edit</button>
                    <button
                      onClick={() => onToggle(c)}
                      style={c.isActive ? styles.btnWarnSm : styles.btnSuccessSm}
                    >
                      {c.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => onDelete(c)} style={styles.btnDelSm}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Pagination ──
function CustPagination({ page, pageSize, total, onPage, onPageSize, isDark }) {
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
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 18px', borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
      background: isDark ? 'var(--bg-subtle)' : '#f8f9fa', borderRadius: 12, marginTop: 12, flexWrap: 'wrap', gap: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d' }}>
        <span style={{ fontWeight: 600 }}>Rows:</span>
        <select
          value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          style={{
            border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
            borderRadius: 6, padding: '4px 8px', fontSize: 12,
            background: isDark ? 'var(--bg-card)' : '#fff', color: isDark ? 'var(--text-main)' : '#212529',
            cursor: 'pointer', outline: 'none'
          }}
        >
          {[12, 24, 48].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>Showing <strong style={{ color: isDark ? '#fff' : '#212529' }}>{from}–{to}</strong> of <strong style={{ color: isDark ? '#fff' : '#212529' }}>{total}</strong></span>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          onClick={() => onPage(page-1)}
          disabled={page <= 1}
          style={styles.pageBtn(false, page <= 1, isDark)}
        >
          ‹ Prev
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} style={{ padding: '4px 6px', color: '#9ca3af', fontSize: 12 }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              style={styles.pageBtn(p === page, false, isDark)}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page+1)}
          disabled={page >= totalPages}
          style={styles.pageBtn(false, page >= totalPages, isDark)}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

// ── Styles ──
const styles = {
  page: (isDark) => ({
    background: isDark ? 'var(--bg-page)' : '#f8f9fa',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  }),

  header: (isDark) => ({
    background: isDark
      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      : 'linear-gradient(135deg, #212529 0%, #0d6efd 100%)',
    padding: '24px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)',
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : 'rgba(255,255,255,0.1)'}`,
  }),

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },

  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.16)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    color: '#fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },

  headerBreadcrumb: {
    fontSize: 11,
    color: '#ced4da',
    letterSpacing: '0.08em',
    fontWeight: 700,
    textTransform: 'uppercase',
  },

  headerTitle: (isDark) => ({
    fontSize: 23,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.02em',
    margin: 0,
  }),

  headerBadge: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.25)',
    color: '#ffffff',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 700,
  },

  headerSubBadge: (isDark) => ({
    background: 'rgba(255,255,255,0.1)',
    color: '#e2e8f0',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
  }),

  addBtn: {
    background: '#198754',
    color: '#ffffff',
    border: '1px solid #146c43',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 2px 6px rgba(25, 135, 84, 0.35)',
  },

  content: {
    padding: '20px 24px 36px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },

  toolbar: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 12,
    padding: '12px 18px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  }),

  input: (isDark) => ({
    background: isDark ? 'var(--bg-subtle)' : '#ffffff',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 13,
    color: isDark ? 'var(--text-main)' : '#212529',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }),

  filterPill: (active, key, isDark) => {
    let activeBg = BT.primary;
    if (key === 'active') activeBg = BT.success;
    if (key === 'inactive') activeBg = BT.danger;

    return {
      padding: '6px 14px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      border: active ? `1px solid ${activeBg}` : `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
      background: active ? activeBg : isDark ? 'var(--bg-subtle)' : '#f8f9fa',
      color: active ? '#ffffff' : isDark ? 'var(--text-muted)' : '#495057',
      transition: 'all 0.15s ease',
    };
  },

  viewToggle: (isDark) => ({
    display: 'flex',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
    borderRadius: 8,
    overflow: 'hidden',
  }),

  viewBtn: (active, isDark) => ({
    border: 'none',
    background: active ? BT.primary : isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    color: active ? '#ffffff' : isDark ? 'var(--text-muted)' : '#6c757d',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  }),

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: 16,
  },

  custCard: (isDark, isActive) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    padding: '18px 20px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    opacity: isActive ? 1 : 0.72,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  }),

  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },

  avatar: (isActive) => ({
    width: 44,
    height: 44,
    borderRadius: 12,
    background: isActive
      ? 'linear-gradient(135deg, #0d6efd 0%, #0dcaf0 100%)'
      : 'linear-gradient(135deg, #6c757d 0%, #adb5bd 100%)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 18,
    flexShrink: 0,
    boxShadow: isActive ? '0 4px 10px rgba(13, 110, 253, 0.3)' : 'none',
  }),

  cardName: (isDark) => ({
    fontWeight: 800,
    fontSize: 15,
    color: isDark ? '#ffffff' : '#212529',
  }),

  cardPhone: (isDark) => ({
    fontSize: 12,
    color: BT.primary,
    fontWeight: 600,
    marginTop: 2,
  }),

  statusBadge: (isActive) => ({
    fontSize: 11,
    fontWeight: 800,
    borderRadius: 20,
    padding: '3px 10px',
    background: isActive ? '#d1e7dd' : '#f8d7da',
    color: isActive ? '#0f5132' : '#842029',
    border: `1px solid ${isActive ? '#badbcc' : '#f5c2c7'}`,
    whiteSpace: 'nowrap',
  }),

  cardRow: (isDark) => ({
    fontSize: 12,
    color: isDark ? 'var(--text-muted)' : '#495057',
    marginTop: 2,
  }),

  cardNotes: (isDark) => ({
    fontSize: 12,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    fontStyle: 'italic',
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    borderRadius: 8,
    padding: '6px 10px',
    marginTop: 4,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e9ecef'}`,
  }),

  cardDate: (isDark) => ({
    fontSize: 11,
    color: isDark ? 'var(--text-muted)' : '#adb5bd',
    marginTop: 4,
  }),

  cardActions: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },

  btnEditSm: {
    background: '#cfe2ff',
    color: '#084298',
    border: '1px solid #b6d4fe',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  btnWarnSm: {
    background: '#fff3cd',
    color: '#664d03',
    border: '1px solid #ffecb5',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  btnSuccessSm: {
    background: '#d1e7dd',
    color: '#0f5132',
    border: '1px solid #badbcc',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  btnDelSm: {
    background: '#f8d7da',
    color: '#842029',
    border: '1px solid #f5c2c7',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  cardBox: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    overflow: 'hidden',
  }),

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },

  th: (isDark) => ({
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    padding: '12px 14px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 800,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderBottom: `2px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    whiteSpace: 'nowrap',
  }),

  tr: (isDark, isEven, isActive) => ({
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
    background: isEven ? (isDark ? 'var(--bg-card)' : '#ffffff') : (isDark ? 'rgba(255,255,255,0.015)' : '#fafbfc'),
    opacity: isActive ? 1 : 0.72,
  }),

  td: (isDark) => ({
    padding: '11px 14px',
    color: isDark ? 'var(--text-main)' : '#212529',
    verticalAlign: 'middle',
  }),

  pageBtn: (active, disabled, isDark) => ({
    padding: '5px 10px',
    borderRadius: 6,
    border: `1px solid ${active ? BT.primary : isDark ? 'var(--border-color)' : '#dee2e6'}`,
    background: active ? BT.primary : isDark ? 'var(--bg-card)' : '#ffffff',
    color: active ? '#ffffff' : disabled ? '#adb5bd' : isDark ? 'var(--text-main)' : '#212529',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    minWidth: 32,
  }),

  emptyCardBox: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    padding: '40px',
    textAlign: 'center',
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),

  loadingBox: (isDark) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: isDark ? 'var(--text-muted)' : '#6c757d',
  }),

  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: `3px solid rgba(13, 110, 253, 0.2)`,
    borderTopColor: BT.primary,
    animation: 'spin 0.8s linear infinite',
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
    padding: 16,
  },

  modal: (isDark) => ({
    background: isDark ? '#1e293b' : '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    boxShadow: '0 1rem 3rem rgba(0,0,0,.25)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '92vh',
    overflowY: 'auto',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),

  modalHeader: (isDark) => ({
    padding: '16px 24px',
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
  }),

  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: '#6c757d',
  },

  label: (isDark) => ({
    fontSize: 12,
    fontWeight: 700,
    color: isDark ? 'var(--text-main)' : '#495057',
    marginBottom: 4,
    display: 'block',
  }),

  errorAlert: {
    background: '#f8d7da',
    border: '1px solid #f5c2c7',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#842029',
    fontSize: 12,
    fontWeight: 600,
  },

  btnSecondary: {
    background: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },

  btnSuccess: {
    background: BT.success,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(25, 135, 84, 0.35)',
  },

  btnDanger: {
    background: BT.danger,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(220, 53, 69, 0.35)',
  },
};
