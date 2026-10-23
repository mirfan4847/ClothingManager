import { useEffect, useState, useMemo } from 'react';
import { getLots, updateLotStatus } from '../services/api';

const STATUSES = ['Stitching', 'Rafo', 'Button', 'Press', 'Delivered'];

const STATUS_STYLE = {
  Stitching: { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
  Rafo:      { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  Button:    { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' },
  Press:     { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
  Delivered: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
};

export default function LotStatus() {
  const [lots, setLots]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('All');
  const [search, setSearch]     = useState('');
  const [updating, setUpdating] = useState(null);
  const [error, setError]       = useState('');
  const [page,    setPage]      = useState(1);
  const [pageSize,setPageSize]  = useState(15);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getLots({});
      setLots(data);
    } catch {
      setError('Failed to load lots.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const changeStatus = async (lot, newStatus) => {
    if (lot.status === newStatus) return;
    setUpdating(lot.id);
    try {
      const updated = await updateLotStatus(lot.id, newStatus);
      setLots(prev => prev.map(l => l.id === lot.id ? updated : l));
    } catch {
      setError('Failed to update status.');
    } finally {
      setUpdating(null);
    }
  };

  const displayed = lots.filter(l => {
    const matchFilter = filter === 'All' || l.status === filter;
    const matchSearch = !search || l.lotNumber.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  useEffect(() => { setPage(1); }, [filter, search, pageSize]);
  const paginated = useMemo(() => displayed.slice((page - 1) * pageSize, page * pageSize), [displayed, page, pageSize]);

  const countByStatus = (s) => lots.filter(l => l.status === s).length;

  if (loading) return <div style={s.loading}>Loading...</div>;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Lot Status Tracker</h1>
        <span style={s.subtitle}>{lots.length} lots total</span>
      </div>

      {error && (
        <div style={s.errorBox} onClick={() => setError('')}>⚠️ {error} (click to dismiss)</div>
      )}

      {/* Status filter tabs */}
      <div style={s.filterRow}>
        <button
          style={s.filterBtn(filter === 'All', null)}
          onClick={() => setFilter('All')}
        >
          All <span style={s.filterCount}>{lots.length}</span>
        </button>
        {STATUSES.map(st => (
          <button
            key={st}
            style={s.filterBtn(filter === st, STATUS_STYLE[st])}
            onClick={() => setFilter(st)}
          >
            {st} <span style={s.filterCount}>{countByStatus(st)}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={s.searchRow}>
        <input
          style={s.search}
          placeholder="🔍  Search lot number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={s.countBadge}>{displayed.length} lot{displayed.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Lot Number</th>
              <th style={s.th}>Size</th>
              <th style={s.th}>Material</th>
              <th style={s.th}>Current Status</th>
              <th style={s.th}>Move To</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} style={s.empty}>
                  {search ? `No lots matching "${search}"` : 'No lots found'}
                </td>
              </tr>
            ) : (
              paginated.map((lot, i) => {
                const style = STATUS_STYLE[lot.status] || STATUS_STYLE.Stitching;
                const isUpdating = updating === lot.id;
                return (
                  <tr key={lot.id} style={{ ...s.row, background: i % 2 === 0 ? '#fff' : '#f9fbff' }}>
                    <td style={{ ...s.td, fontWeight: 700, color: '#1e2a3b' }}>{lot.lotNumber}</td>
                    <td style={s.td}>{lot.sizeName || '—'}</td>
                    <td style={s.td}>{lot.material || '—'}</td>
                    <td style={s.td}>
                      <span style={{ ...s.statusPill, background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                        {lot.status}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={s.btnGroup}>
                        {STATUSES.filter(st => st !== lot.status).map(st => {
                          const bs = STATUS_STYLE[st];
                          return (
                            <button
                              key={st}
                              disabled={isUpdating}
                              onClick={() => changeStatus(lot, st)}
                              style={{ ...s.moveBtn, background: bs.bg, color: bs.color, border: `1px solid ${bs.border}`, opacity: isUpdating ? 0.5 : 1 }}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <LotPagination page={page} pageSize={pageSize} total={displayed.length} onPage={setPage} onPageSize={setPageSize} />
      </div>
    </div>
  );
}

function LotPagination({ page, pageSize, total, onPage, onPageSize }) {
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
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderTop:'1px solid #e0e7ef', flexWrap:'wrap', justifyContent:'space-between', background:'#fff' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:13, color:'#666' }}>Rows per page:</span>
        <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))} style={{ border:'1px solid #d0d8e4', borderRadius:5, padding:'4px 8px', fontSize:13 }}>
          {[10,15,25,50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize:13, color:'#666' }}>Showing {from}–{to} of {total}</span>
      </div>
      <div style={{ display:'flex', gap:4 }}>
        <LotPageBtn onClick={() => onPage(page - 1)} disabled={page <= 1}>←</LotPageBtn>
        {pages.map((p, i) => typeof p === 'number'
          ? <LotPageBtn key={p} onClick={() => onPage(p)} active={p === page}>{p}</LotPageBtn>
          : <span key={i} style={{ padding:'0 4px', color:'#aaa', lineHeight:'30px' }}>…</span>)}
        <LotPageBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages}>→</LotPageBtn>
      </div>
    </div>
  );
}
function LotPageBtn({ onClick, disabled, active, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ minWidth:30, height:30, border:`1px solid ${active ? '#1e2a3b' : '#d0d8e4'}`, borderRadius:5, background: active ? '#1e2a3b' : '#fff', color: active ? '#fff' : '#555', cursor: disabled ? 'default' : 'pointer', fontSize:13, fontWeight: active ? 700 : 400, opacity: disabled ? 0.4 : 1 }}>
      {children}
    </button>
  );
}

const s = {
  page:        { padding: '1.5rem', fontFamily: 'Segoe UI, Arial, sans-serif', maxWidth: 1100 },
  header:      { display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: '1rem' },
  title:       { margin: 0, fontSize: '1.4rem', color: '#1e2a3b', fontWeight: 700 },
  subtitle:    { fontSize: 13, color: '#888' },
  loading:     { padding: '3rem', color: '#888', fontFamily: 'Segoe UI, Arial, sans-serif' },
  errorBox:    { background: '#FBEAEA', color: '#BE0000', padding: '10px 14px', borderRadius: 6, marginBottom: 12, fontSize: 13, cursor: 'pointer' },
  filterRow:   { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  filterBtn:   (active, style) => ({
    padding: '6px 14px', borderRadius: 20, border: `1px solid ${active && style ? style.border : (active ? '#2E75B6' : '#d0d8e8')}`,
    background: active && style ? style.bg : (active ? '#2E75B6' : '#fff'),
    color: active && style ? style.color : (active ? '#fff' : '#555'),
    cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
  }),
  filterCount: { background: 'rgba(0,0,0,0.1)', borderRadius: 10, padding: '0 7px', fontSize: 11, fontWeight: 700 },
  searchRow:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  search:      { padding: '8px 14px', borderRadius: 7, border: '1px solid #d0d8e8', fontSize: 13, minWidth: 240, outline: 'none', background: '#f8fafd' },
  countBadge:  { fontSize: 12, color: '#888', background: '#f0f2f5', borderRadius: 20, padding: '4px 12px' },
  tableWrap:   { overflowX: 'auto', borderRadius: 10, border: '1px solid #e0e7ef', background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { background: '#1e2a3b', color: '#fff', padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap' },
  row:         { borderBottom: '1px solid #eef1f6' },
  td:          { padding: '10px 14px', verticalAlign: 'middle', color: '#333' },
  empty:       { textAlign: 'center', padding: '3rem', color: '#aaa', fontSize: 14 },
  statusPill:  { borderRadius: 20, padding: '3px 12px', fontWeight: 700, fontSize: 12, display: 'inline-block' },
  btnGroup:    { display: 'flex', gap: 5, flexWrap: 'wrap' },
  moveBtn:     { borderRadius: 14, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
};
