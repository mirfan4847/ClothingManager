import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getInventorySummary, getInventoryStock, getInventoryUsages, getLotUsage,
  createUsage, updateUsage, deleteUsage, getLots,
} from '../services/api';

const MATERIALS = ['Mink', 'Mink Bo', 'Cotton', 'Polister', 'Fleece', 'Khaddar', 'Lawn', 'Other'];

const MATERIAL_COLORS = {
  'Mink': '#7c3aed', 'Mink Bo': '#a855f7', 'Cotton': '#0891b2',
  'Polister': '#0d9488', 'Fleece': '#059669', 'Khaddar': '#b45309',
  'Lawn': '#16a34a', 'Other': '#6b7280',
};

const today   = () => new Date().toISOString().split('T')[0];
const fmtDate = d  => d ? new Date(d).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const matColor = m => MATERIAL_COLORS[m] || '#6b7280';

const emptyUsageForm = () => ({
  lotId: '', bagPurchaseId: '', quantityUsed: '', usageDate: today(), notes: '',
});

// ─────────────────────────────────────────────────────────────────────────────
export default function InventoryModule() {
  const [tab, setTab] = useState('stock');

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>📦</div>
          <div>
            <div style={s.headerSub}>Warehouse</div>
            <div style={s.headerTitle}>Stock</div>
          </div>
        </div>
        <div style={s.tabSwitch}>
          {[
            ['stock',  '📊 Stock'],
            ['usages', '📋 Usage Log'],
            ['bylot',  '🔍 By Lot'],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ ...s.switchBtn, ...(tab === k ? s.switchActive : {}) }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'stock'  && <StockTab />}
      {tab === 'usages' && <UsageLogTab />}
      {tab === 'bylot'  && <ByLotTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK TAB
// ─────────────────────────────────────────────────────────────────────────────
function StockTab() {
  const [summary, setSummary]     = useState(null);
  const [stock,   setStock]       = useState([]);
  const [matFilter, setMatFilter] = useState('');
  const [view,    setView]        = useState('cards');
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(15);
  const [stockFilter, setStockFilter] = useState(''); // '', 'used', 'low', 'out'
  const [search, setSearch]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sm, st] = await Promise.all([getInventorySummary(), getInventoryStock()]);
      setSummary(sm);
      setStock(st);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mats = [...new Set(stock.map(b => b.material))].filter(Boolean);

  const displayed = useMemo(() => {
    let r = matFilter ? stock.filter(b => b.material === matFilter) : stock;
    if (stockFilter === 'used') r = r.filter(b => b.totalUsed > 0);
    else if (stockFilter === 'low') r = r.filter(b => {
      if (b.remainingStock <= 0) return false;
      return b.remainingStock < b.totalPurchased * 0.2;
    });
    else if (stockFilter === 'out') r = r.filter(b => b.remainingStock <= 0);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(b =>
        b.bagNumber?.toLowerCase().includes(q) ||
        b.material?.toLowerCase().includes(q)  ||
        b.bagType?.toLowerCase().includes(q)   ||
        (b.supplierName || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [stock, matFilter, stockFilter, search]);

  useEffect(() => { setPage(1); }, [matFilter, stockFilter, search, pageSize]);
  const paginated = useMemo(() => displayed.slice((page-1)*pageSize, page*pageSize), [displayed, page, pageSize]);

  const stockLevel = b => {
    if (b.remainingStock <= 0)                              return 'out';
    if (b.remainingStock < b.totalPurchased * 0.2)         return 'low';
    if (b.remainingStock < b.totalPurchased * 0.5)         return 'med';
    return 'ok';
  };

  const levelStyle = lvl => ({
    out: { bg: '#fef2f2', border: '#fca5a5', badge: '#dc2626', label: 'Out of Stock' },
    low: { bg: '#fff7ed', border: '#fed7aa', badge: '#ea580c', label: 'Low Stock' },
    med: { bg: '#fefce8', border: '#fde68a', badge: '#ca8a04', label: 'Half Stock' },
    ok:  { bg: '#f0fdf4', border: '#86efac', badge: '#16a34a', label: 'In Stock' },
  }[lvl]);

  if (loading) return <div style={s.loading}>Loading stock…</div>;

  return (
    <div style={s.tabBody}>
      {/* Summary Cards */}
      {summary && (
        <div style={s.statsRow}>
          {[
            {
              label: 'Bag Types',    val: summary.totalBagTypes,   color: '#2E75B6',
              active: !stockFilter && view === 'cards',
              onClick: () => { setStockFilter(''); setMatFilter(''); setView('cards'); },
            },
            {
              label: 'Purchased',    val: summary.totalPurchased,  color: '#059669',
              active: !stockFilter && view === 'table',
              onClick: () => { setStockFilter(''); setMatFilter(''); setView('table'); },
            },
            {
              label: 'Used',         val: summary.totalUsed,       color: '#7c3aed',
              active: stockFilter === 'used',
              onClick: () => { setStockFilter(stockFilter === 'used' ? '' : 'used'); setView('table'); },
            },
            {
              label: 'Remaining',    val: summary.totalRemaining,  color: '#0891b2',
              active: !stockFilter && view === 'table',
              onClick: () => { setStockFilter(''); setMatFilter(''); setView('table'); },
            },
            {
              label: 'Low Stock',    val: summary.lowStockCount,   color: '#ea580c',
              active: stockFilter === 'low',
              onClick: () => { setStockFilter(stockFilter === 'low' ? '' : 'low'); setView('table'); },
            },
            {
              label: 'Out of Stock', val: summary.outOfStockCount, color: '#dc2626',
              active: stockFilter === 'out',
              onClick: () => { setStockFilter(stockFilter === 'out' ? '' : 'out'); setView('table'); },
            },
          ].map(({ label, val, color, active, onClick }) => (
            <div key={label} onClick={onClick} style={{
              ...s.statCard,
              cursor: 'pointer',
              border: active ? `2px solid ${color}` : '2px solid transparent',
              background: active ? `${color}10` : '#fff',
              boxShadow: active ? `0 4px 14px ${color}28` : '0 1px 6px rgba(0,0,0,.07)',
              transform: active ? 'translateY(-2px)' : 'none',
              transition: 'all .15s',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.boxShadow = `0 4px 12px ${color}22`; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,.07)'; }}
            >
              <div style={{ ...s.statVal, color }}>{val}</div>
              <div style={{ ...s.statLabel, color: active ? color : undefined }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {/* Search row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0 14px', height: 40, flex: 1 }}>
            <span style={{ color: '#9ca3af' }}>🔍</span>
            <input
              style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 14, color: '#374151' }}
              placeholder="Search bag #, material, type, supplier…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: 0 }}>
                ✕
              </button>
            )}
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
        {/* Filter pills row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={s.pills}>
              {['', ...mats].map(m => (
                <button key={m || 'all'} onClick={() => { setMatFilter(m); setStockFilter(''); }}
                  style={{ ...s.pill, ...(matFilter === m && !stockFilter ? { background: matColor(m) || '#2E75B6', color: '#fff' } : {}) }}>
                  {m || 'All'}
                </button>
              ))}
            </div>
            {stockFilter && (
              <button onClick={() => setStockFilter('')}
                style={{ ...s.pill, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                ✕ Clear filter
              </button>
            )}
          </div>
          <span style={{ background: '#fff', color: '#6b7280', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
            {displayed.length} record{displayed.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Stock Cards */}
      {view === 'cards' ? (
        <div style={s.stockGrid}>
          {displayed.map(b => {
            const lvl = stockLevel(b);
            const st  = levelStyle(lvl);
            const pct = b.totalPurchased > 0 ? Math.max(0, (b.remainingStock / b.totalPurchased) * 100) : 0;
            return (
              <div key={b.bagPurchaseId} style={{ ...s.stockCard, background: st.bg, borderColor: st.border }}>
                <div style={s.stockCardTop}>
                  <div>
                    <div style={s.stockBagNum}>#{b.bagNumber}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      <span style={{ ...s.matBadge, background: matColor(b.material) }}>{b.material}</span>
                      <span style={s.typeBadge}>{b.bagType}</span>
                    </div>
                  </div>
                  <span style={{ ...s.levelBadge, background: st.badge }}>{st.label}</span>
                </div>
                {b.supplierName && <div style={s.stockSup}>🏭 {b.supplierName}</div>}
                <div style={s.progressBar}>
                  <div style={{ ...s.progressFill, width: `${pct}%`, background: st.badge }} />
                </div>
                <div style={s.stockNums}>
                  <div style={s.stockNumItem}>
                    <div style={s.stockNumVal}>{b.totalPurchased}</div>
                    <div style={s.stockNumLabel}>Purchased</div>
                  </div>
                  <div style={s.stockNumItem}>
                    <div style={s.stockNumVal}>{b.totalUsed}</div>
                    <div style={s.stockNumLabel}>Used</div>
                  </div>
                  <div style={{ ...s.stockNumItem, fontWeight: 700 }}>
                    <div style={{ ...s.stockNumVal, color: st.badge }}>{b.remainingStock}</div>
                    <div style={s.stockNumLabel}>Remaining</div>
                  </div>
                </div>
                <div style={s.stockDate}>Purchased: {fmtDate(b.purchaseDate)}</div>
              </div>
            );
          })}
          {displayed.length === 0 && <div style={s.empty}>No stock records found.</div>}
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['Bag #','Material','Type','Supplier','Purchase Date','Purchased','Used','Remaining','Status'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(b => {
                const lvl = stockLevel(b);
                const st  = levelStyle(lvl);
                const pct = b.totalPurchased > 0 ? Math.max(0, (b.remainingStock / b.totalPurchased) * 100) : 0;
                return (
                  <tr key={b.bagPurchaseId} style={s.tr}>
                    <td style={{ ...s.td, fontWeight: 700 }}>#{b.bagNumber}</td>
                    <td style={s.td}>
                      <span style={{ ...s.matBadge, background: matColor(b.material) }}>{b.material}</span>
                    </td>
                    <td style={s.td}>{b.bagType}</td>
                    <td style={s.td}>{b.supplierName || '—'}</td>
                    <td style={s.td}>{fmtDate(b.purchaseDate)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{b.totalPurchased}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{b.totalUsed}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: st.badge }}>{b.remainingStock}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ ...s.progressBar, flex: 1, minWidth: 60 }}>
                          <div style={{ ...s.progressFill, width: `${pct}%`, background: st.badge }} />
                        </div>
                        <span style={{ ...s.levelBadge, background: st.badge, fontSize: 10 }}>{st.label}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={9} style={{ ...s.td, textAlign: 'center', color: '#aaa', padding: 32 }}>No stock records found.</td></tr>
              )}
            </tbody>
          </table>
          <InvPagination page={page} pageSize={pageSize} total={displayed.length} onPage={setPage} onPageSize={setPageSize} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE LOG TAB
// ─────────────────────────────────────────────────────────────────────────────
function UsageLogTab() {
  const [usages,    setUsages]    = useState([]);
  const [stock,     setStock]     = useState([]);
  const [lots,      setLots]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [matFilter, setMatFilter] = useState('');
  const [search,    setSearch]    = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(emptyUsageForm());
  const [saving,    setSaving]    = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [error,     setError]     = useState('');
  const [uPage, setUPage]         = useState(1);
  const [uPageSize, setUPageSize] = useState(15);

  // Multi-lot state
  const [showMulti,   setShowMulti]   = useState(false);
  const [multiBagId,  setMultiBagId]  = useState('');
  const [multiDate,   setMultiDate]   = useState(today());
  const [multiRows,   setMultiRows]   = useState([{ lotId: '', qty: '' }]);
  const [multiSaving, setMultiSaving] = useState(false);
  const [multiError,  setMultiError]  = useState('');

  const openMulti = () => {
    setMultiBagId(''); setMultiDate(today());
    setMultiRows([{ lotId: '', qty: '' }]);
    setMultiError(''); setShowMulti(true);
  };
  const addMultiRow    = () => setMultiRows(r => [...r, { lotId: '', qty: '' }]);
  const removeMultiRow = (i) => setMultiRows(r => r.filter((_, j) => j !== i));
  const setMultiRow    = (i, key, val) => setMultiRows(r => r.map((row, j) => j === i ? { ...row, [key]: val } : row));

  const multiTotalQty = multiRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  const multiBagStock = stock.find(b => b.bagPurchaseId === Number(multiBagId));

  const handleMultiSave = async () => {
    if (!multiBagId) { setMultiError('Select a bag purchase first.'); return; }
    const valid = multiRows.filter(r => r.lotId && Number(r.qty) > 0);
    if (valid.length === 0) { setMultiError('Add at least one lot with a quantity.'); return; }
    if (multiBagStock && multiTotalQty > multiBagStock.remainingStock) {
      setMultiError(`Total quantity (${multiTotalQty}) exceeds remaining stock (${multiBagStock.remainingStock}).`); return;
    }
    setMultiSaving(true); setMultiError('');
    try {
      for (const row of valid) {
        await createUsage({
          lotId: Number(row.lotId),
          bagPurchaseId: Number(multiBagId),
          quantityUsed: Number(row.qty),
          usageDate: new Date(multiDate).toISOString(),
          notes: null,
        });
      }
      setShowMulti(false);
      await load();
    } catch (e) {
      setMultiError(e.response?.data || 'Failed to save.');
    }
    setMultiSaving(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, st, l] = await Promise.all([getInventoryUsages({}), getInventoryStock(), getLots()]);
      setUsages(u); setStock(st); setLots(l);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mats = [...new Set(usages.map(u => u.material))].filter(Boolean);

  useEffect(() => { setUPage(1); }, [matFilter, search, uPageSize]);

  const displayed = usages.filter(u => {
    if (matFilter && u.material !== matFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.lotNumber?.toLowerCase().includes(q) ||
        u.bagNumber?.toLowerCase().includes(q) ||
        u.material?.toLowerCase().includes(q)  ||
        u.bagType?.toLowerCase().includes(q)   ||
        u.notes?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uPaginated = useMemo(() => displayed.slice((uPage-1)*uPageSize, uPage*uPageSize), [displayed, uPage, uPageSize]);

  const openAdd = () => { setEditing(null); setForm(emptyUsageForm()); setError(''); setShowForm(true); };
  const openEdit = u => {
    setEditing(u);
    setForm({
      lotId: String(u.lotId),
      bagPurchaseId: String(u.bagPurchaseId),
      quantityUsed: String(u.quantityUsed),
      usageDate: u.usageDate ? u.usageDate.split('T')[0] : today(),
      notes: u.notes || '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.lotId || !form.bagPurchaseId || !form.quantityUsed) {
      setError('Lot, bag, and quantity are required.'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        lotId: Number(form.lotId),
        bagPurchaseId: Number(form.bagPurchaseId),
        quantityUsed: Number(form.quantityUsed),
        usageDate: new Date(form.usageDate).toISOString(),
        notes: form.notes || null,
      };
      if (editing) await updateUsage(editing.id, payload);
      else         await createUsage(payload);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e.response?.data || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    try {
      await deleteUsage(delTarget.id);
      setDelTarget(null);
      await load();
    } catch {
      setDelTarget(null);
    }
  };

  // For the bag dropdown — show remaining stock
  const selectedBagStock = stock.find(b => b.bagPurchaseId === Number(form.bagPurchaseId));
  const availableForEdit = selectedBagStock
    ? selectedBagStock.remainingStock + (editing ? editing.quantityUsed : 0)
    : null;

  if (loading) return <div style={s.loading}>Loading usages…</div>;

  return (
    <div style={s.tabBody}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <input
          style={s.searchBox} placeholder="Search lot, bag, material…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <div style={s.pills}>
          {['', ...mats].map(m => (
            <button key={m || 'all'} onClick={() => setMatFilter(m)}
              style={{ ...s.pill, ...(matFilter === m ? { background: matColor(m) || '#2E75B6', color: '#fff' } : {}) }}>
              {m || 'All'}
            </button>
          ))}
        </div>
        <button onClick={openAdd} style={s.addBtn}>+ Log Usage</button>
        <button onClick={openMulti} style={{ ...s.addBtn, background: '#7c3aed' }}>📦 Multi-Lot</button>
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr style={s.thead}>
              {['Date','Lot','Size','Bag #','Material','Type','Supplier','Qty Used','Notes',''].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uPaginated.map(u => (
              <tr key={u.id} style={s.tr}>
                <td style={s.td}>{fmtDate(u.usageDate)}</td>
                <td style={{ ...s.td, fontWeight: 600 }}>{u.lotNumber}</td>
                <td style={s.td}>{u.sizeName || '—'}</td>
                <td style={{ ...s.td, fontWeight: 600 }}>#{u.bagNumber}</td>
                <td style={s.td}>
                  <span style={{ ...s.matBadge, background: matColor(u.material) }}>{u.material}</span>
                </td>
                <td style={s.td}>{u.bagType}</td>
                <td style={s.td}>{u.supplierName || '—'}</td>
                <td style={{ ...s.td, fontWeight: 700, color: '#7c3aed' }}>{u.quantityUsed}</td>
                <td style={{ ...s.td, color: '#888', maxWidth: 160 }}>{u.notes || '—'}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(u)} style={s.editBtn}>Edit</button>
                    <button onClick={() => setDelTarget(u)} style={s.delBtn}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr><td colSpan={10} style={{ ...s.td, textAlign: 'center', color: '#aaa', padding: 32 }}>
                No usage records found.
              </td></tr>
            )}
          </tbody>
        </table>
        <InvPagination page={uPage} pageSize={uPageSize} total={displayed.length} onPage={setUPage} onPageSize={setUPageSize} />
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={s.overlay} onClick={() => setShowForm(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>{editing ? 'Edit Usage' : 'Log Material Usage'}</div>

            <label style={s.label}>Lot *</label>
            <select style={s.input} value={form.lotId} onChange={e => setForm(f => ({ ...f, lotId: e.target.value }))}>
              <option value="">— Select Lot —</option>
              {lots.map(l => (
                <option key={l.id} value={l.id}>
                  {l.lotNumber}{l.sizeName ? ` (${l.sizeName})` : ''}{l.material ? ` — ${l.material}` : ''}
                </option>
              ))}
            </select>

            <label style={s.label}>Bag Purchase *</label>
            <select style={s.input} value={form.bagPurchaseId}
              onChange={e => setForm(f => ({ ...f, bagPurchaseId: e.target.value }))}>
              <option value="">— Select Bag —</option>
              {stock.map(b => (
                <option key={b.bagPurchaseId} value={b.bagPurchaseId}>
                  #{b.bagNumber} — {b.material} {b.bagType} (Remaining: {b.remainingStock})
                </option>
              ))}
            </select>

            {selectedBagStock && (
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                Available: <strong>{availableForEdit}</strong> bags
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={s.label}>Quantity Used *</label>
                <input style={s.input} type="number" min="1" value={form.quantityUsed}
                  onChange={e => setForm(f => ({ ...f, quantityUsed: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Date *</label>
                <input style={s.input} type="date" value={form.usageDate}
                  onChange={e => setForm(f => ({ ...f, usageDate: e.target.value }))} />
              </div>
            </div>

            <label style={s.label}>Notes</label>
            <textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Used for lot mid-5 packaging" />

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
            <div style={s.modalTitle}>Delete Usage?</div>
            <p style={{ color: '#555', fontSize: 14 }}>
              Remove <strong>{delTarget.quantityUsed}</strong> bags of{' '}
              <strong>{delTarget.material} {delTarget.bagType}</strong> used by lot{' '}
              <strong>{delTarget.lotNumber}</strong>? This will restore stock.
            </p>
            <div style={s.modalActions}>
              <button onClick={() => setDelTarget(null)} style={s.cancelBtn}>Cancel</button>
              <button onClick={handleDelete} style={{ ...s.saveBtn, background: '#dc2626' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Lot Assignment Modal */}
      {showMulti && (
        <div style={s.overlay} onClick={() => setShowMulti(false)}>
          <div style={{ ...s.modal, maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>📦 Multi-Lot Assignment</div>
            <p style={{ fontSize: 12, color: '#888', margin: '-4px 0 6px' }}>
              Assign one bag purchase to multiple lots in a single operation.
            </p>

            {/* Bag selector */}
            <label style={s.label}>Bag Purchase *</label>
            <select style={s.input} value={multiBagId}
              onChange={e => setMultiBagId(e.target.value)}>
              <option value="">— Select Bag Purchase —</option>
              {stock.map(b => (
                <option key={b.bagPurchaseId} value={b.bagPurchaseId}>
                  #{b.bagNumber} — {b.material} {b.bagType} (Remaining: {b.remainingStock})
                </option>
              ))}
            </select>

            {multiBagStock && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, padding: '8px 12px', fontSize: 13 }}>
                <span>Available stock:</span>
                <strong style={{ color: '#16a34a', fontSize: 16 }}>{multiBagStock.remainingStock}</strong>
                <span style={{ color: '#888', fontSize: 12 }}>bags</span>
                {multiTotalQty > 0 && (
                  <>
                    <span style={{ color: '#999' }}>→ Allocating:</span>
                    <strong style={{ color: multiTotalQty > multiBagStock.remainingStock ? '#dc2626' : '#7c3aed' }}>
                      {multiTotalQty}
                    </strong>
                    <span style={{ color: '#888', fontSize: 12 }}>
                      ({multiBagStock.remainingStock - multiTotalQty >= 0
                        ? `${multiBagStock.remainingStock - multiTotalQty} left`
                        : `${multiTotalQty - multiBagStock.remainingStock} over`})
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Date */}
            <label style={s.label}>Usage Date *</label>
            <input style={s.input} type="date" value={multiDate}
              onChange={e => setMultiDate(e.target.value)} />

            {/* Lot rows */}
            <div style={{ fontWeight: 700, fontSize: 12, color: '#555', marginTop: 4 }}>Lots to Assign</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {multiRows.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 36px', gap: 8, alignItems: 'center' }}>
                  <select style={s.input} value={row.lotId}
                    onChange={e => setMultiRow(i, 'lotId', e.target.value)}>
                    <option value="">— Lot —</option>
                    {lots.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.lotNumber}{l.sizeName ? ` (${l.sizeName})` : ''}
                      </option>
                    ))}
                  </select>
                  <input style={s.input} type="number" min="1" placeholder="Qty"
                    value={row.qty} onChange={e => setMultiRow(i, 'qty', e.target.value)} />
                  <button
                    onClick={() => removeMultiRow(i)}
                    disabled={multiRows.length === 1}
                    style={{ background: multiRows.length === 1 ? '#f0f0f0' : '#fef2f2', color: multiRows.length === 1 ? '#ccc' : '#dc2626', border: '1px solid', borderColor: multiRows.length === 1 ? '#ddd' : '#fca5a5', borderRadius: 6, cursor: multiRows.length === 1 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 16, lineHeight: 1, padding: '6px 10px' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button onClick={addMultiRow}
              style={{ background: '#f0fdf4', color: '#16a34a', border: '1px dashed #86efac', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
              + Add Another Lot
            </button>

            {multiError && <div style={s.errMsg}>{multiError}</div>}

            <div style={s.modalActions}>
              <button onClick={() => setShowMulti(false)} style={s.cancelBtn}>Cancel</button>
              <button onClick={handleMultiSave} style={{ ...s.saveBtn, background: '#7c3aed' }} disabled={multiSaving}>
                {multiSaving ? 'Saving…' : `Save ${multiRows.filter(r => r.lotId && Number(r.qty) > 0).length} Assignment(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BY LOT TAB
// ─────────────────────────────────────────────────────────────────────────────
function ByLotTab() {
  const [lots,       setLots]       = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [lotsLoading, setLotsLoading] = useState(true);

  useEffect(() => {
    getLots().then(l => { setLots(l); setLotsLoading(false); });
  }, []);

  const lookup = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const r = await getLotUsage(Number(selectedId));
      setResult(r);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.tabBody}>
      <div style={{ ...s.toolbar, flexWrap: 'wrap', gap: 10 }}>
        <select
          style={{ ...s.searchBox, minWidth: 260 }}
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setResult(null); }}
          disabled={lotsLoading}
        >
          <option value="">— Select a Lot —</option>
          {lots.map(l => (
            <option key={l.id} value={l.id}>
              {l.lotNumber}{l.sizeName ? ` (${l.sizeName})` : ''}{l.material ? ` — ${l.material}` : ''}
            </option>
          ))}
        </select>
        <button onClick={lookup} style={s.addBtn} disabled={!selectedId || loading}>
          {loading ? 'Loading…' : '🔍 View Usage'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 20 }}>
          {/* Lot Header */}
          <div style={s.lotHeader}>
            <div style={s.lotHeaderTitle}>
              Lot: <strong>{result.lotNumber}</strong>
              {result.sizeName && <span style={s.sizeBadge}>{result.sizeName}</span>}
            </div>
            <div style={s.lotHeaderStat}>
              Total Bags Used: <strong style={{ color: '#7c3aed' }}>{result.totalBagsUsed}</strong>
            </div>
          </div>

          {result.usages.length === 0 ? (
            <div style={s.empty}>No usage records for this lot.</div>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    {['Date','Bag #','Material','Type','Supplier','Qty Used','Notes'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.usages.map(u => (
                    <tr key={u.id} style={s.tr}>
                      <td style={s.td}>{fmtDate(u.usageDate)}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>#{u.bagNumber}</td>
                      <td style={s.td}>
                        <span style={{ ...s.matBadge, background: matColor(u.material) }}>{u.material}</span>
                      </td>
                      <td style={s.td}>{u.bagType}</td>
                      <td style={s.td}>{u.supplierName || '—'}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: '#7c3aed' }}>{u.quantityUsed}</td>
                      <td style={{ ...s.td, color: '#888' }}>{u.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!result && !loading && selectedId && (
        <div style={s.empty}>Press "View Usage" to load this lot's records.</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────
function InvPagination({ page, pageSize, total, onPage, onPageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    const set = new Set([1, totalPages, page - 1, page, page + 1].filter(p => p >= 1 && p <= totalPages));
    const sorted = [...set].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) pages.push('…');
      pages.push(sorted[i]);
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderTop:'2px solid #f0f2f5', background:'#fafbfc', flexWrap:'wrap', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#6b7280' }}>
        <span style={{ fontWeight:600 }}>Rows per page:</span>
        <select value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          style={{ border:'1.5px solid #dde', borderRadius:7, padding:'5px 10px', fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
          {[10, 15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ color:'#9ca3af' }}>
          Showing <b style={{ color:'#374151' }}>{from}–{to}</b> of <b style={{ color:'#374151' }}>{total}</b>
        </span>
      </div>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <InvPageBtn disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</InvPageBtn>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} style={{ padding:'4px 4px', color:'#9ca3af', fontSize:14, userSelect:'none' }}>…</span>
            : <InvPageBtn key={p} active={p === page} onClick={() => onPage(p)}>{p}</InvPageBtn>
        )}
        <InvPageBtn disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next ›</InvPageBtn>
      </div>
    </div>
  );
}

function InvPageBtn({ onClick, disabled, active, children }) {
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
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = {
  page:        { padding: 24, maxWidth: 1200, margin: '0 auto' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 14 },
  headerIcon:  { fontSize: 36 },
  headerSub:   { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: '1.5rem', fontWeight: 700, color: '#1e2a3b' },
  tabSwitch:   { display: 'flex', gap: 6, background: '#f0f2f5', borderRadius: 8, padding: 4 },
  switchBtn:   { border: 'none', background: 'transparent', padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#555' },
  switchActive:{ background: '#fff', color: '#1e2a3b', boxShadow: '0 1px 4px rgba(0,0,0,.12)' },

  tabBody:     { },
  loading:     { padding: 40, textAlign: 'center', color: '#888' },
  empty:       { padding: 40, textAlign: 'center', color: '#aaa', fontStyle: 'italic' },

  statsRow:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 },
  statCard:    { background: '#fff', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 6px rgba(0,0,0,.07)', textAlign: 'center' },
  statVal:     { fontSize: '1.6rem', fontWeight: 800 },
  statLabel:   { fontSize: 11, color: '#888', marginTop: 2 },

  viewToggle:  { display: 'flex', border: '1px solid #dde', borderRadius: 8, overflow: 'hidden' },
  viewBtn:     { border: 'none', background: '#f8f9fa', padding: '7px 13px', cursor: 'pointer', fontSize: 15, color: '#777' },
  viewBtnActive: { background: '#2E75B6', color: '#fff' },
  pills:       { display: 'flex', gap: 6, flexWrap: 'wrap' },
  pill:        { border: '1px solid #dde', background: '#f8f9fa', borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, color: '#444', transition: 'all .15s' },

  stockGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },
  stockCard:   { border: '1.5px solid', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  stockCardTop:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  stockBagNum: { fontSize: '1.15rem', fontWeight: 800, color: '#1e2a3b' },
  stockSup:    { fontSize: 12, color: '#888' },
  progressBar: { background: '#e5e7eb', borderRadius: 999, height: 6, overflow: 'hidden' },
  progressFill:{ height: '100%', borderRadius: 999, transition: 'width .3s' },
  stockNums:   { display: 'flex', justifyContent: 'space-between', marginTop: 4 },
  stockNumItem:{ textAlign: 'center', flex: 1 },
  stockNumVal: { fontSize: '1.1rem', fontWeight: 700 },
  stockNumLabel:{ fontSize: 10, color: '#888', marginTop: 1 },
  stockDate:   { fontSize: 11, color: '#aaa' },

  matBadge:    { display: 'inline-block', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px' },
  typeBadge:   { display: 'inline-block', background: '#e8eaf6', color: '#3949ab', fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '2px 8px' },
  levelBadge:  { color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap', flexShrink: 0 },

  toolbar:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  searchBox:   { flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #dde', borderRadius: 8, fontSize: 13 },
  addBtn:      { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },

  tableWrap:   { background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflow: 'auto' },
  table:       { width: '100%', borderCollapse: 'collapse' },
  thead:       { background: '#f8f9fa' },
  th:          { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#555', borderBottom: '2px solid #eee', whiteSpace: 'nowrap' },
  tr:          { borderBottom: '1px solid #f0f0f0' },
  td:          { padding: '10px 14px', fontSize: 13, color: '#333', verticalAlign: 'middle' },
  editBtn:     { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  delBtn:      { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },

  lotHeader:   { background: '#fff', borderRadius: 10, padding: '14px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  lotHeaderTitle: { fontSize: '1.1rem', color: '#1e2a3b', display: 'flex', alignItems: 'center', gap: 8 },
  lotHeaderStat:  { fontSize: 14, color: '#555' },
  sizeBadge:   { background: '#ede9fe', color: '#7c3aed', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 },

  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle:  { fontSize: '1.1rem', fontWeight: 700, color: '#1e2a3b', marginBottom: 6 },
  label:       { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 2 },
  input:       { width: '100%', padding: '8px 10px', border: '1px solid #dde', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' },
  errMsg:      { color: '#dc2626', fontSize: 12, background: '#fef2f2', padding: '8px 12px', borderRadius: 6 },
  modalActions:{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn:   { background: '#f1f5f9', color: '#333', border: 'none', borderRadius: 7, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  saveBtn:     { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 22px', fontWeight: 700, cursor: 'pointer', fontSize: 13 },
};
