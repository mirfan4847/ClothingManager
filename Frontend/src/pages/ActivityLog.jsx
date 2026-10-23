import { useState, useEffect, useCallback } from 'react';
import { getAuditLogs, getAuditModules } from '../services/api';

const ACTION_META = {
  Create: { color: '#70AD47', bg: '#EEF6E6', label: 'Created' },
  Update: { color: '#2E75B6', bg: '#EBF3FB', label: 'Updated' },
  Delete: { color: '#BE0000', bg: '#FBEAEA', label: 'Deleted' },
  Toggle: { color: '#C55A11', bg: '#FEF4EC', label: 'Toggled' },
};

function timeSince(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-GB');
}

function formatFull(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function ChangesList({ summary, action }) {
  if (!summary) return <span style={{ color: '#aaa', fontSize: 12 }}>—</span>;
  let changes = [];
  try { changes = JSON.parse(summary); } catch { return <span style={{ color: '#aaa' }}>{summary}</span>; }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {changes.map((c, i) => {
        if (!c.OldValue && !c.NewValue) return null;
        if (action === 'Create') return (
          <div key={i} >
            <span>{c.Field}:</span>
            <span style={{ color: '#4a8a1e', fontWeight: 500 }}>{c.NewValue ?? '—'}</span>
          </div>
        );
        if (action === 'Delete') return (
          <div key={i} >
            <span >{c.Field}:</span>
            <span style={{ color: '#BE0000', textDecoration: 'line-through' }}>{c.OldValue ?? '—'}</span>
          </div>
        );
        // Update / Toggle — show diff
        return (
          <div key={i} >
            <span >{c.Field}:</span>
            {c.OldValue && <span style={{ color: '#888', textDecoration: 'line-through', fontSize: 12 }}>{c.OldValue}</span>}
            {c.OldValue && c.NewValue && <span style={{ color: '#aaa', margin: '0 3px', fontSize: 11 }}>→</span>}
            {c.NewValue && <span style={{ color: '#2E75B6', fontWeight: 500 }}>{c.NewValue}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function ActivityLog() {
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
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.headerLabel}>Audit Trail</div>
          <div style={s.headerTitle}>Activity Log</div>
        </div>
        <button style={s.refreshBtn} onClick={() => load(page)}>↻ Refresh</button>
      </div>

      {/* Stats strip */}
      <div style={s.statsRow}>
        {[
          { label: 'Total Records', value: total,              color: '#2E75B6', bg: '#EBF3FB' },
          { label: 'Created',       value: counts.Create || 0, color: '#70AD47', bg: '#EEF6E6' },
          { label: 'Updated',       value: counts.Update || 0, color: '#2E75B6', bg: '#EBF3FB' },
          { label: 'Deleted',       value: counts.Delete || 0, color: '#BE0000', bg: '#FBEAEA' },
          { label: 'Toggled',       value: counts.Toggle || 0, color: '#C55A11', bg: '#FEF4EC' },
        ].map(st => (
          <div key={st.label} style={{ ...s.statCard, background: st.bg, borderLeft: `4px solid ${st.color}` }}>
            <div style={{ ...s.statNum, color: st.color }}>{st.value}</div>
            <div style={s.statLabel}>{st.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={s.filterBar}>
        <input
          style={s.searchInput}
          placeholder="🔍  Search by user, entity or module…"
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
        />
        <select style={s.select} value={filters.module} onChange={e => setFilter('module', e.target.value)}>
          <option value="">All Modules</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select style={s.select} value={filters.action} onChange={e => setFilter('action', e.target.value)}>
          <option value="">All Actions</option>
          <option value="Create">Create</option>
          <option value="Update">Update</option>
          <option value="Delete">Delete</option>
          <option value="Toggle">Toggle</option>
        </select>
        <input type="date" style={s.dateInput} value={filters.from}
          onChange={e => setFilter('from', e.target.value)} title="From date" />
        <span style={{ color: '#aaa', fontSize: 13 }}>–</span>
        <input type="date" style={s.dateInput} value={filters.to}
          onChange={e => setFilter('to', e.target.value)} title="To date" />
        {(filters.module || filters.action || filters.search || filters.from || filters.to) && (
          <button style={s.clearBtn}
            onClick={() => setFilters({ module: '', action: '', search: '', from: '', to: '' })}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>⏳ Loading activity logs…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
            No activity logs found. Actions taken in the system will appear here.
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['When', 'User', 'Action', 'Module', 'Record', 'What Changed'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const meta = ACTION_META[log.action] || { color: '#888', bg: '#f5f5f5', label: log.action };
                return (
                  <tr key={log.id} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 500, fontSize: 13 }} title={formatFull(log.timestamp)}>
                        {timeSince(log.timestamp)}
                      </div>
                      <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>
                        {new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td style={s.td}>
                      <div style={s.userAvatar}>
                        <div style={{ ...s.avatarCircle, background: strColor(log.userName) }}>
                          {log.userName.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{log.userName}</span>
                      </div>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.actionBadge, background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={s.moduleBadge}>{log.module}</span>
                      <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{log.entityType}</div>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>
                        {log.entityName || `#${log.entityId}`}
                      </span>
                      {log.entityId && (
                        <span style={{ color: '#bbb', fontSize: 11, marginLeft: 4 }}>#{log.entityId}</span>
                      )}
                    </td>
                    <td style={{ ...s.td, maxWidth: 320 }}>
                      <ChangesList summary={log.changeSummary} action={log.action} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages >= 1 && (
        <div style={s.pagination}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:13, color:'#555' }}>Rows per page:</span>
            <select value={pageSize}
              onChange={e => { const ps = Number(e.target.value); setPageSize(ps); load(1, ps); }}
              style={{ border:'1px solid #d0d8e4', borderRadius:5, padding:'4px 8px', fontSize:13, background:'#fff' }}>
              {[25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ fontSize:13, color:'#888' }}>
              Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
          </div>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <ActPageBtn onClick={() => load(page - 1)} disabled={page <= 1}>←</ActPageBtn>
            {(() => {
              const pages = [];
              if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
              else {
                pages.push(1);
                if (page > 3) pages.push('…');
                for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                if (page < totalPages - 2) pages.push('…');
                pages.push(totalPages);
              }
              return pages.map((p, i) => typeof p === 'number'
                ? <ActPageBtn key={p} onClick={() => load(p)} active={p === page}>{p}</ActPageBtn>
                : <span key={i} style={{ padding:'0 4px', color:'#aaa', lineHeight:'30px' }}>…</span>);
            })()}
            <ActPageBtn onClick={() => load(page + 1)} disabled={page >= totalPages}>→</ActPageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function ActPageBtn({ onClick, disabled, active, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ minWidth:30, height:30, border:`1px solid ${active ? '#2E75B6' : '#d0d8e4'}`, borderRadius:5, background: active ? '#2E75B6' : '#fff', color: active ? '#fff' : '#555', cursor: disabled ? 'default' : 'pointer', fontSize:13, fontWeight: active ? 700 : 400, opacity: disabled ? 0.4 : 1 }}>
      {children}
    </button>
  );
}

function strColor(str) {
  const palette = ['#C55A11','#2E75B6','#70AD47','#7030A0','#BE0000','#1F7391','#375623','#843C0C'];
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[h];
}

const s = {
  page:       { fontFamily: "'Segoe UI', Arial, sans-serif", background: '#F4F6F9', minHeight: '100vh', paddingBottom: '2rem' },
  header:     { background: '#1e2a3b', padding: '1.2rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel:{ color: '#7a9cc0', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle:{ color: '#fff', fontSize: '1.4rem', fontWeight: 600 },
  refreshBtn: { background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  statsRow:   { display: 'flex', gap: 12, padding: '1.2rem 2rem 0', flexWrap: 'wrap' },
  statCard:   { borderRadius: 10, padding: '0.8rem 1.2rem', flex: 1, minWidth: 100 },
  statNum:    { fontSize: '1.6rem', fontWeight: 700 },
  statLabel:  { fontSize: 12, color: '#666', marginTop: 1 },
  filterBar:  { display: 'flex', gap: 10, padding: '1rem 2rem', alignItems: 'center', flexWrap: 'wrap' },
  searchInput:{ flex: 2, minWidth: 220, padding: '8px 12px', borderRadius: 7, border: '1px solid #d0d8e4', fontSize: 13, outline: 'none', background: '#fff' },
  select:     { padding: '8px 12px', borderRadius: 7, border: '1px solid #d0d8e4', fontSize: 13, background: '#fff', cursor: 'pointer', outline: 'none' },
  dateInput:  { padding: '8px 10px', borderRadius: 7, border: '1px solid #d0d8e4', fontSize: 13, background: '#fff', outline: 'none' },
  clearBtn:   { background: '#FBEAEA', color: '#BE0000', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  tableWrap:  { margin: '1rem 2rem 0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', background: '#fff' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:         { background: '#1e2a3b', color: '#fff', padding: '11px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap' },
  trEven:     { background: '#fff' },
  trOdd:      { background: '#f8fafd' },
  td:         { padding: '10px 14px', borderBottom: '1px solid #eef1f6', verticalAlign: 'top' },
  userAvatar: { display: 'flex', alignItems: 'center', gap: 8 },
  avatarCircle:{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  actionBadge:{ borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' },
  moduleBadge:{ background: '#E8F0FA', color: '#2E75B6', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  changeRow:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexWrap: 'wrap' },
  fieldName:  { color: '#888', fontSize: 11, minWidth: 60 },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '1rem 2rem', marginTop: 4, flexWrap: 'wrap' },
};
