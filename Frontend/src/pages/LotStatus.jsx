import { useEffect, useState, useMemo } from 'react';
import api, { getLots, updateLotStatus } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import LotHistoryModal from '../components/LotHistoryModal';

const DEFAULT_STATUSES = ['Stitching', 'Rafo', 'Button', 'Press', 'Delivered'];

const STATUS_STYLE = {
  Stitching: {
    bg: '#e0cffc', color: '#59359a', border: '#c5b3e6', badge: '#6f42c1', icon: '🧵',
    cardLabel: 'Stitching', sub: 'Primary garment assembly',
    gradient: 'linear-gradient(135deg, #4c1d95 0%, #6f42c1 100%)', glow: 'rgba(111, 66, 193, 0.35)',
  },
  Rafo: {
    bg: '#cff4fc', color: '#055160', border: '#b6effb', badge: '#0dcaf0', icon: '🪡',
    cardLabel: 'Rafo / Mending', sub: 'Inspection & repair work',
    gradient: 'linear-gradient(135deg, #087990 0%, #0dcaf0 100%)', glow: 'rgba(13, 202, 240, 0.35)',
  },
  Button: {
    bg: '#ffe5d0', color: '#9a3412', border: '#fed1a6', badge: '#fd7e14', icon: '🔘',
    cardLabel: 'Button & Kaj', sub: 'Buttonhole & attachment',
    gradient: 'linear-gradient(135deg, #c2410c 0%, #fd7e14 100%)', glow: 'rgba(253, 126, 20, 0.35)',
  },
  Press: {
    bg: '#cfe2ff', color: '#084298', border: '#b6d4fe', badge: '#0d6efd', icon: '♨️',
    cardLabel: 'Press / Iron', sub: 'Pressing & finishing folds',
    gradient: 'linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)', glow: 'rgba(13, 110, 253, 0.35)',
  },
  Delivered: {
    bg: '#d1e7dd', color: '#0f5132', border: '#badbcc', badge: '#198754', icon: '🚚',
    cardLabel: 'Delivered', sub: 'Completed dispatch to customer',
    gradient: 'linear-gradient(135deg, #146c43 0%, #198754 100%)', glow: 'rgba(25, 135, 84, 0.35)',
  },
};

const FALLBACK_STYLES = [
  STATUS_STYLE.Stitching,
  STATUS_STYLE.Rafo,
  STATUS_STYLE.Button,
  STATUS_STYLE.Press,
  STATUS_STYLE.Delivered,
  {
    bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8', badge: '#db2777', icon: '✨',
    cardLabel: '', sub: 'Custom production stage',
    gradient: 'linear-gradient(135deg, #9d174d 0%, #db2777 100%)', glow: 'rgba(219, 39, 119, 0.35)',
  },
  {
    bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe', badge: '#4f46e5', icon: '⚙️',
    cardLabel: '', sub: 'Custom production stage',
    gradient: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)', glow: 'rgba(79, 70, 229, 0.35)',
  },
];

const getStageStyle = (st, idx = 0) => {
  if (STATUS_STYLE[st]) return STATUS_STYLE[st];
  const fb = FALLBACK_STYLES[idx % FALLBACK_STYLES.length];
  return { ...fb, cardLabel: st, sub: 'Configured production stage' };
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
  purple:    '#6f42c1',
  orange:    '#fd7e14',
};

export default function LotStatus() {
  const { isDark } = useTheme();

  const [lots, setLots]         = useState([]);
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('All');
  const [search, setSearch]     = useState('');
  const [updating, setUpdating] = useState(null);
  const [error, setError]       = useState('');
  const [page,    setPage]      = useState(1);
  const [pageSize,setPageSize]  = useState(15);
  const [selectedLot, setSelectedLot] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, stagesRes] = await Promise.all([
        getLots({}),
        api.get('/dropdowns/lot-stages').catch(() => ({ data: [] })),
      ]);
      setLots(data);
      if (Array.isArray(stagesRes.data) && stagesRes.data.length > 0) {
        setStatuses(stagesRes.data.map(s => s.name));
      }
    } catch {
      setError('Failed to load lots from database.');
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
      setError('Failed to update stage status.');
    } finally {
      setUpdating(null);
    }
  };

  const displayed = lots.filter(l => {
    const matchFilter = filter === 'All' || l.status === filter;
    const matchSearch = !search ||
      l.lotNumber?.toLowerCase().includes(search.toLowerCase()) ||
      l.sizeName?.toLowerCase().includes(search.toLowerCase()) ||
      l.material?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  useEffect(() => { setPage(1); }, [filter, search, pageSize]);
  const paginated = useMemo(() => displayed.slice((page - 1) * pageSize, page * pageSize), [displayed, page, pageSize]);

  const countByStatus = (s) => lots.filter(l => l.status === s).length;

  if (loading) {
    return (
      <div style={styles.loadingBox(isDark)}>
        <div style={styles.spinner} />
        <div style={{ marginTop: 14, fontWeight: 600 }}>Loading lot pipeline…</div>
      </div>
    );
  }

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">

      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>📦</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>PRODUCTION PIPELINE</div>
            <h1 style={styles.headerTitle(isDark)}>Lot Status &amp; Stage Tracking</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={styles.headerBadge}>
            Live Production Pipeline
          </span>
          <span style={styles.headerSubBadge(isDark)}>
            {lots.length} Total Lots Active
          </span>
        </div>
      </div>

      <div style={styles.content}>

        {error && (
          <div style={styles.errorAlert} onClick={() => setError('')}>
            <span>⚠️ {error}</span>
            <span style={{ fontSize: 11, cursor: 'pointer', opacity: 0.8 }}>✕ Click to dismiss</span>
          </div>
        )}

        {/* ── Dynamic Stage KPI Cards (Bootstrap Colors) ── */}
        <div style={styles.kpiGrid}>
          {statuses.map((st, idx) => {
            const stStyle = getStageStyle(st, idx);
            return (
              <BtKpiCard
                key={st}
                label={stStyle.cardLabel || st}
                tag={`STAGE ${idx + 1}`}
                value={countByStatus(st)}
                gradient={stStyle.gradient}
                glow={stStyle.glow}
                icon={stStyle.icon}
                sub={stStyle.sub}
                onClick={() => setFilter(st)}
              />
            );
          })}
        </div>

        {/* ── Toolbar with Search & Status Pills ── */}
        <div style={styles.toolbar(isDark)}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 13 }}>🔍</span>
            <input
              style={{ ...styles.input(isDark), paddingLeft: 34 }}
              placeholder="Search lot number, size, fabric material…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setFilter('All')}
              style={styles.filterPill(filter === 'All', BT.primary, isDark)}
            >
              All Stages ({lots.length})
            </button>
            {statuses.map((st, idx) => {
              const style = getStageStyle(st, idx);
              return (
                <button
                  key={st}
                  onClick={() => setFilter(st)}
                  style={styles.filterPill(filter === st, style.badge, isDark)}
                >
                  <span style={{ marginRight: 4 }}>{style.icon}</span>
                  {st} ({countByStatus(st)})
                </button>
              );
            })}
          </div>

          <span style={styles.headerSubBadge(isDark)}>
            {displayed.length} lots found
          </span>
        </div>

        {/* ── Bootstrap Table View ── */}
        {displayed.length === 0 ? (
          <div style={styles.emptyCardBox(isDark)}>
            {search ? `No lots matching "${search}"` : 'No lots found in this stage.'}
          </div>
        ) : (
          <div style={styles.cardBox(isDark)}>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Lot Number', 'Size Specification', 'Fabric Material', 'Current Production Stage', 'Advance To Stage'].map(h => (
                      <th key={h} style={styles.th(isDark)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((lot, i) => {
                    const style = getStageStyle(lot.status, statuses.indexOf(lot.status) >= 0 ? statuses.indexOf(lot.status) : 0);
                    const isUpdating = updating === lot.id;
                    return (
                      <tr key={lot.id} style={styles.tr(isDark, i % 2 === 0)}>
                        <td style={styles.td(isDark)}>
                          <span
                            onClick={() => setSelectedLot(lot)}
                            style={{ ...styles.lotBadge, cursor: 'pointer', border: '1px solid #b6d4fe' }}
                            title="Click to see which staff worked on this lot"
                          >
                            {lot.lotNumber} 🔍
                          </span>
                        </td>
                        <td style={styles.td(isDark)}>
                          {lot.sizeName ? (
                            <span style={styles.sizeBadge}>{lot.sizeName}</span>
                          ) : (
                            <span style={{ color: isDark ? 'var(--text-muted)' : '#adb5bd' }}>—</span>
                          )}
                        </td>
                        <td style={styles.td(isDark)}>
                          {lot.material ? (
                            <span style={{ fontWeight: 600, color: isDark ? '#fff' : '#212529' }}>{lot.material}</span>
                          ) : (
                            <span style={{ color: isDark ? 'var(--text-muted)' : '#adb5bd' }}>—</span>
                          )}
                        </td>
                        <td style={styles.td(isDark)}>
                          <span style={styles.statusPill(style)}>
                            <span style={{ marginRight: 4 }}>{style.icon}</span>
                            {lot.status}
                          </span>
                        </td>
                        <td style={styles.td(isDark)}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {statuses.filter(st => st !== lot.status).map((st, idx) => {
                              const bs = getStageStyle(st, idx);
                              return (
                                <button
                                  key={st}
                                  disabled={isUpdating}
                                  onClick={() => changeStatus(lot, st)}
                                  style={styles.moveBtn(bs, isUpdating)}
                                  title={`Move lot ${lot.lotNumber} to ${st}`}
                                >
                                  <span>{bs.icon}</span>
                                  <span>{st}</span>
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <LotPagination
              page={page}
              pageSize={pageSize}
              total={displayed.length}
              onPage={setPage}
              onPageSize={setPageSize}
              isDark={isDark}
            />
          </div>
        )}

      </div>

      {selectedLot && (
        <LotHistoryModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
        />
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

// ── Pagination Component ──
function LotPagination({ page, pageSize, total, onPage, onPageSize, isDark }) {
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
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 18px', borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
      background: isDark ? 'var(--bg-subtle)' : '#f8f9fa', flexWrap: 'wrap', gap: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d' }}>
        <span style={{ fontWeight: 600 }}>Rows:</span>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          style={{
            border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
            borderRadius: 6, padding: '4px 8px', fontSize: 12,
            background: isDark ? 'var(--bg-card)' : '#fff', color: isDark ? 'var(--text-main)' : '#212529',
            cursor: 'pointer', outline: 'none'
          }}
        >
          {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>Showing <strong style={{ color: isDark ? '#fff' : '#212529' }}>{from}–{to}</strong> of <strong style={{ color: isDark ? '#fff' : '#212529' }}>{total}</strong></span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={styles.pageBtn(false, page <= 1, isDark)}>‹ Prev</button>
        {pages.map((p, i) => typeof p === 'number'
          ? <button key={p} onClick={() => onPage(p)} style={styles.pageBtn(p === page, false, isDark)}>{p}</button>
          : <span key={i} style={{ padding: '0 4px', color: '#aaa', lineHeight: '30px' }}>…</span>)}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} style={styles.pageBtn(false, page >= totalPages, isDark)}>Next ›</button>
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
    background: isDark ? 'rgba(255,255,255,0.1)' : '#e9ecef',
    color: isDark ? '#e2e8f0' : '#495057',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
  }),

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

  filterPill: (active, color, isDark) => ({
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    border: active ? `1px solid ${color}` : `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    background: active ? color : isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    color: active ? '#ffffff' : isDark ? 'var(--text-muted)' : '#495057',
    transition: 'all 0.15s ease',
  }),

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
    padding: '12px 14px',
    color: isDark ? 'var(--text-main)' : '#212529',
    verticalAlign: 'middle',
  }),

  lotBadge: {
    background: '#e7f1ff',
    color: '#0d6efd',
    borderRadius: 6,
    padding: '3px 9px',
    fontWeight: 800,
    fontSize: 12,
    display: 'inline-block',
  },

  sizeBadge: {
    background: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: 6,
    padding: '2px 8px',
    fontWeight: 700,
    fontSize: 12,
  },

  statusPill: (style) => ({
    borderRadius: 20,
    padding: '4px 12px',
    fontWeight: 800,
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    background: style.bg,
    color: style.color,
    border: `1px solid ${style.border}`,
  }),

  moveBtn: (bs, isUpdating) => ({
    borderRadius: 20,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    cursor: isUpdating ? 'not-allowed' : 'pointer',
    background: bs.bg,
    color: bs.color,
    border: `1px solid ${bs.border}`,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    opacity: isUpdating ? 0.5 : 1,
    transition: 'all 0.1s ease',
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

  errorAlert: {
    background: '#f8d7da',
    border: '1px solid #f5c2c7',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#842029',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
};
