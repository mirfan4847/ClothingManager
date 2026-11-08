import { useState, useEffect, useCallback } from 'react';
import { getAuditLogs, getAuditModules } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const ACTION_META = {
  Create: { color: '#0f5132', bg: '#d1e7dd', border: '#badbcc', label: 'Created' },
  Update: { color: '#084298', bg: '#cfe2ff', border: '#b6d4fe', label: 'Updated' },
  Delete: { color: '#842029', bg: '#f8d7da', border: '#f5c2c7', label: 'Deleted' },
  Toggle: { color: '#664d03', bg: '#fff3cd', border: '#ffecb5', label: 'Toggled' },
};

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

function timeSince(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-PK');
}

function formatFull(ts) {
  return new Date(ts).toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function strColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  const colors = ['#0d6efd', '#198754', '#6f42c1', '#fd7e14', '#0dcaf0', '#d63384'];
  return colors[Math.abs(h) % colors.length];
}

function ChangesList({ summary, action, isDark }) {
  if (!summary) return <span style={{ color: isDark ? 'var(--text-muted)' : '#adb5bd', fontSize: 12 }}>—</span>;
  let changes = [];
  try { changes = JSON.parse(summary); } catch { return <span style={{ color: isDark ? 'var(--text-muted)' : '#6c757d' }}>{summary}</span>; }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {changes.map((c, i) => {
        if (!c.OldValue && !c.NewValue) return null;
        if (action === 'Create') return (
          <div key={i} style={{ fontSize: 12 }}>
            <span style={{ color: isDark ? 'var(--text-muted)' : '#6c757d', marginRight: 4 }}>{c.Field}:</span>
            <span style={{ color: BT.success, fontWeight: 700 }}>{c.NewValue ?? '—'}</span>
          </div>
        );
        if (action === 'Delete') return (
          <div key={i} style={{ fontSize: 12 }}>
            <span style={{ color: isDark ? 'var(--text-muted)' : '#6c757d', marginRight: 4 }}>{c.Field}:</span>
            <span style={{ color: BT.danger, textDecoration: 'line-through' }}>{c.OldValue ?? '—'}</span>
          </div>
        );
        return (
          <div key={i} style={{ fontSize: 12 }}>
            <span style={{ color: isDark ? 'var(--text-muted)' : '#6c757d', marginRight: 4 }}>{c.Field}:</span>
            {c.OldValue && <span style={{ color: isDark ? 'var(--text-muted)' : '#6c757d', textDecoration: 'line-through' }}>{c.OldValue}</span>}
            {c.OldValue && c.NewValue && <span style={{ color: isDark ? 'var(--text-muted)' : '#adb5bd', margin: '0 4px' }}>→</span>}
            {c.NewValue && <span style={{ color: BT.primary, fontWeight: 700 }}>{c.NewValue}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function ActivityLog() {
  const { isDark } = useTheme();

  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState([]);
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [filters, setFilters] = useState({
    module: '', action: '', search: '',
    from: '', to: '',
  });

  const load = useCallback(async (pg = 1, ps = pageSize) => {
    setLoading(true);
    try {
      const params = { page: pg, pageSize: ps };
      if (filters.module) params.module = filters.module;
      if (filters.action) params.action = filters.action;
      if (filters.search) params.search = filters.search;
      if (filters.from)   params.from   = filters.from;
      if (filters.to)     params.to     = filters.to;
      const data = await getAuditLogs(params);
      setLogs(data.items);
      setTotal(data.total);
      setPage(pg);
    } catch { setLogs([]); }
    setLoading(false);
  }, [filters, pageSize]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => {
    getAuditModules().then(setModules).catch(() => {});
  }, []);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const totalPages = Math.ceil(total / pageSize);

  const counts = logs.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">

      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>📋</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>SYSTEM AUDIT &amp; SURVEILLANCE</div>
            <h1 style={styles.headerTitle(isDark)}>Activity Log &amp; Audit Trail</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={styles.headerBadge}>
            Immutable Trail
          </span>
          <span style={styles.headerSubBadge(isDark)}>
            {total} Total Audit Records
          </span>
          <button style={styles.refreshBtn} onClick={() => load(page)}>
            ↻ Refresh Logs
          </button>
        </div>
      </div>

      <div style={styles.content}>

        {/* ── 4 Executive KPI Cards with Bootstrap Colors ── */}
        <div style={styles.kpiGrid}>
          <BtKpiCard
            label="Total Logged Events"
            tag="AUDIT TRAIL"
            value={total}
            gradient="linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)"
            glow="rgba(13, 110, 253, 0.35)"
            icon="📊"
            sub="Comprehensive system actions"
          />
          <BtKpiCard
            label="Records Created"
            tag="INSERTS"
            value={counts.Create || 0}
            gradient="linear-gradient(135deg, #146c43 0%, #198754 100%)"
            glow="rgba(25, 135, 84, 0.35)"
            icon="✨"
            sub="New data creation events"
            onClick={() => setFilter('action', 'Create')}
          />
          <BtKpiCard
            label="Records Updated"
            tag="MODIFICATIONS"
            value={counts.Update || 0}
            gradient="linear-gradient(135deg, #087990 0%, #0dcaf0 100%)"
            glow="rgba(13, 202, 240, 0.35)"
            icon="✏️"
            sub="Field change transactions"
            onClick={() => setFilter('action', 'Update')}
          />
          <BtKpiCard
            label="Records Deleted"
            tag="DELETIONS"
            value={counts.Delete || 0}
            gradient="linear-gradient(135deg, #b02a37 0%, #dc3545 100%)"
            glow="rgba(220, 53, 69, 0.35)"
            icon="🗑️"
            sub="Removed database items"
            onClick={() => setFilter('action', 'Delete')}
          />
        </div>

        {/* ── Filter & Search Toolbar (Bootstrap 5 Style) ── */}
        <div style={styles.toolbar(isDark)}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
            <div style={{ position: 'relative', minWidth: 220, flex: '1 1 220px' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 13 }}>🔍</span>
              <input
                style={{ ...styles.input(isDark), paddingLeft: 34 }}
                placeholder="Search user, entity, remarks…"
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
              />
            </div>

            <select
              style={{ ...styles.select(isDark), minWidth: 160 }}
              value={filters.module}
              onChange={e => setFilter('module', e.target.value)}
            >
              <option value="">All Modules ({modules.length})</option>
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <select
              style={{ ...styles.select(isDark), minWidth: 140 }}
              value={filters.action}
              onChange={e => setFilter('action', e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="Create">Create</option>
              <option value="Update">Update</option>
              <option value="Delete">Delete</option>
              <option value="Toggle">Toggle</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d', fontWeight: 600 }}>From:</span>
              <input
                type="date"
                style={{ ...styles.input(isDark), width: 135 }}
                value={filters.from}
                onChange={e => setFilter('from', e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d', fontWeight: 600 }}>To:</span>
              <input
                type="date"
                style={{ ...styles.input(isDark), width: 135 }}
                value={filters.to}
                onChange={e => setFilter('to', e.target.value)}
              />
            </div>

            {(filters.module || filters.action || filters.search || filters.from || filters.to) && (
              <button
                style={styles.clearBtn}
                onClick={() => setFilters({ module: '', action: '', search: '', from: '', to: '' })}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Table (Bootstrap Styled) ── */}
        <div style={styles.cardBox(isDark)}>
          {loading ? (
            <div style={styles.loadingBox(isDark)}>
              <div style={styles.spinner} />
              <div style={{ marginTop: 14, fontWeight: 600 }}>Loading activity logs…</div>
            </div>
          ) : logs.length === 0 ? (
            <div style={styles.emptyCardBox(isDark)}>
              No activity logs found matching the filter criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Timestamp', 'User', 'Action', 'Module', 'Target Record', 'Change Summary'].map(h => (
                      <th key={h} style={styles.th(isDark)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const meta = ACTION_META[log.action] || { color: '#6c757d', bg: '#e9ecef', border: '#dee2e6', label: log.action };
                    return (
                      <tr key={log.id} style={styles.tr(isDark, i % 2 === 0)}>
                        <td style={styles.td(isDark)}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: isDark ? '#fff' : '#212529' }} title={formatFull(log.timestamp)}>
                            {timeSince(log.timestamp)}
                          </div>
                          <div style={{ color: isDark ? 'var(--text-muted)' : '#6c757d', fontSize: 11, marginTop: 2 }}>
                            {new Date(log.timestamp).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td style={styles.td(isDark)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ ...styles.userAvatar, background: strColor(log.userName) }}>
                              {log.userName.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 700, color: isDark ? '#fff' : '#212529', fontSize: 13 }}>
                              {log.userName}
                            </span>
                          </div>
                        </td>
                        <td style={styles.td(isDark)}>
                          <span style={styles.actionBadge(meta)}>
                            {meta.label}
                          </span>
                        </td>
                        <td style={styles.td(isDark)}>
                          <span style={styles.moduleBadge}>{log.module}</span>
                          <div style={{ color: isDark ? 'var(--text-muted)' : '#6c757d', fontSize: 11, marginTop: 2 }}>
                            {log.entityType}
                          </div>
                        </td>
                        <td style={styles.td(isDark)}>
                          <strong style={{ color: isDark ? '#fff' : '#212529', fontSize: 13 }}>
                            {log.entityName || `#${log.entityId}`}
                          </strong>
                          {log.entityId && (
                            <span style={{ color: isDark ? 'var(--text-muted)' : '#adb5bd', fontSize: 11, marginLeft: 4 }}>
                              (ID #{log.entityId})
                            </span>
                          )}
                        </td>
                        <td style={{ ...styles.td(isDark), maxWidth: 360 }}>
                          <ChangesList summary={log.changeSummary} action={log.action} isDark={isDark} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages >= 1 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 18px', borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
              background: isDark ? 'var(--bg-subtle)' : '#f8f9fa', flexWrap: 'wrap', gap: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d' }}>
                <span style={{ fontWeight: 600 }}>Rows:</span>
                <select
                  value={pageSize}
                  onChange={e => { const ps = Number(e.target.value); setPageSize(ps); load(1, ps); }}
                  style={{
                    border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
                    borderRadius: 6, padding: '4px 8px', fontSize: 12,
                    background: isDark ? 'var(--bg-card)' : '#fff', color: isDark ? 'var(--text-main)' : '#212529',
                    cursor: 'pointer', outline: 'none'
                  }}
                >
                  {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>Showing <strong style={{ color: isDark ? '#fff' : '#212529' }}>{total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</strong> of <strong style={{ color: isDark ? '#fff' : '#212529' }}>{total}</strong></span>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => load(page - 1)} disabled={page <= 1} style={styles.pageBtn(false, page <= 1, isDark)}>‹ Prev</button>
                <button style={styles.pageBtn(true, false, isDark)}>{page}</button>
                <button onClick={() => load(page + 1)} disabled={page >= totalPages} style={styles.pageBtn(false, page >= totalPages, isDark)}>Next ›</button>
              </div>
            </div>
          )}
        </div>

      </div>
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
        minHeight: 100,
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

// ── Styles Object ──
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

  refreshBtn: {
    background: '#198754',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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

  select: (isDark) => ({
    background: isDark ? 'var(--bg-subtle)' : '#ffffff',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 13,
    color: isDark ? 'var(--text-main)' : '#212529',
    outline: 'none',
    cursor: 'pointer',
  }),

  clearBtn: {
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: 20,
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

  tr: (isDark, isEven) => ({
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
    background: isEven ? (isDark ? 'var(--bg-card)' : '#ffffff') : (isDark ? 'rgba(255,255,255,0.015)' : '#fafbfc'),
    transition: 'background 0.1s ease',
  }),

  td: (isDark) => ({
    padding: '11px 14px',
    color: isDark ? 'var(--text-main)' : '#212529',
    verticalAlign: 'middle',
  }),

  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 12,
    flexShrink: 0,
  },

  actionBadge: (meta) => ({
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 800,
    borderRadius: 20,
    padding: '3px 10px',
    background: meta.bg,
    color: meta.color,
    border: `1px solid ${meta.border}`,
  }),

  moduleBadge: {
    background: '#e7f1ff',
    color: '#0d6efd',
    borderRadius: 6,
    padding: '2px 8px',
    fontWeight: 800,
    fontSize: 11,
    display: 'inline-block',
  },

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
};
