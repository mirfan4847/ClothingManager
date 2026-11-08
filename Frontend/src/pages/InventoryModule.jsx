import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getInventorySummary, getInventoryStock, getInventoryUsages, getLotUsage,
  createUsage, updateUsage, deleteUsage, getLots,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import LotHistoryModal from '../components/LotHistoryModal';

const PRESET_MATERIAL_COLORS = {
  'Mink': '#6f42c1', 'Mink Bo': '#8540f5', 'Cotton': '#0d6efd',
  'Polister': '#20c997', 'Fleece': '#198754', 'Khaddar': '#fd7e14',
  'Lawn': '#146c43', 'Silk': '#d63384', 'Velvet': '#e11d48', 'Denim': '#0284c7',
};

const PALETTE = ['#6f42c1', '#0d6efd', '#20c997', '#198754', '#fd7e14', '#146c43', '#d63384', '#0284c7', '#7c3aed', '#059669', '#ea580c', '#e11d48'];

const today   = () => new Date().toISOString().split('T')[0];
const fmtDate = d  => d ? new Date(d).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const matColor = (m) => {
  if (!m) return '#6c757d';
  if (PRESET_MATERIAL_COLORS[m]) return PRESET_MATERIAL_COLORS[m];
  let hash = 0;
  for (let i = 0; i < m.length; i++) hash = (hash * 31 + m.charCodeAt(i)) % PALETTE.length;
  return PALETTE[hash];
};

const emptyUsageForm = () => ({
  lotId: '', bagPurchaseId: '', quantityUsed: '', usageDate: today(), notes: '',
});

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

// ─────────────────────────────────────────────────────────────────────────────
export default function InventoryModule() {
  const { isDark } = useTheme();
  const [tab, setTab] = useState('stock');
  const [selectedLot, setSelectedLot] = useState(null);

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">
      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>📦</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>WAREHOUSE &amp; INVENTORY</div>
            <h1 style={styles.headerTitle(isDark)}>Fabric Stock &amp; Raw Materials</h1>
          </div>
        </div>

        {/* Bootstrap Nav Pills (Tab Switcher) */}
        <div style={styles.tabSwitch(isDark)}>
          {[
            ['stock',  '📊 Stock Inventory'],
            ['usages', '📋 Usage Log'],
            ['bylot',  '🔍 By Lot Usage'],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={styles.switchBtn(tab === k, isDark)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.content}>
        {tab === 'stock'  && <StockTab isDark={isDark} />}
        {tab === 'usages' && <UsageLogTab isDark={isDark} onSelectLot={setSelectedLot} />}
        {tab === 'bylot'  && <ByLotTab isDark={isDark} onSelectLot={setSelectedLot} />}
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

// ─────────────────────────────────────────────────────────────────────────────
// STOCK TAB
// ─────────────────────────────────────────────────────────────────────────────
function StockTab({ isDark }) {
  const [summary, setSummary]         = useState(null);
  const [stock,   setStock]           = useState([]);
  const [matFilter, setMatFilter]     = useState('');
  const [view,    setView]            = useState('cards');
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(12);
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
    if (b.remainingStock <= 0)                      return 'out';
    if (b.remainingStock < b.totalPurchased * 0.2) return 'low';
    if (b.remainingStock < b.totalPurchased * 0.5) return 'med';
    return 'ok';
  };

  const levelStyle = lvl => ({
    out: { bg: '#f8d7da', border: '#f5c2c7', badge: BT.danger, label: 'Out of Stock' },
    low: { bg: '#ffe5d0', border: '#fed1a6', badge: BT.orange, label: 'Low Stock' },
    med: { bg: '#fff3cd', border: '#ffecb5', badge: BT.warning, label: 'Half Stock' },
    ok:  { bg: '#d1e7dd', border: '#badbcc', badge: BT.success, label: 'In Stock' },
  }[lvl]);

  if (loading) {
    return (
      <div style={styles.loadingBox(isDark)}>
        <div style={styles.spinner} />
        <div style={{ marginTop: 14, fontWeight: 600 }}>Loading inventory records…</div>
      </div>
    );
  }

  return (
    <div>
      {/* ── 6 KPI Cards with Bootstrap Colors ── */}
      {summary && (
        <div style={styles.kpiGrid6}>
          <BtKpiCard
            label="Total Bag Types"
            tag="CATALOG"
            value={summary.totalBagTypes}
            gradient="linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)"
            glow="rgba(13, 110, 253, 0.35)"
            icon="🏷️"
            onClick={() => { setStockFilter(''); setMatFilter(''); setView('cards'); }}
          />
          <BtKpiCard
            label="Purchased Bags"
            tag="TOTAL RECEIVED"
            value={summary.totalPurchased}
            gradient="linear-gradient(135deg, #087990 0%, #0dcaf0 100%)"
            glow="rgba(13, 202, 240, 0.35)"
            icon="📦"
            onClick={() => { setStockFilter(''); setMatFilter(''); setView('table'); }}
          />
          <BtKpiCard
            label="Used in Production"
            tag="CONSUMED"
            value={summary.totalUsed}
            gradient="linear-gradient(135deg, #59359a 0%, #6f42c1 100%)"
            glow="rgba(111, 66, 193, 0.35)"
            icon="✂️"
            onClick={() => { setStockFilter(stockFilter === 'used' ? '' : 'used'); setView('table'); }}
          />
          <BtKpiCard
            label="Remaining Stock"
            tag="AVAILABLE"
            value={summary.totalRemaining}
            gradient="linear-gradient(135deg, #146c43 0%, #198754 100%)"
            glow="rgba(25, 135, 84, 0.35)"
            icon="✅"
            onClick={() => { setStockFilter(''); setMatFilter(''); setView('table'); }}
          />
          <BtKpiCard
            label="Low Stock Warning"
            tag="REORDER LEVEL"
            value={summary.lowStockCount}
            gradient="linear-gradient(135deg, #c2410c 0%, #fd7e14 100%)"
            glow="rgba(253, 126, 20, 0.35)"
            icon="⚠️"
            onClick={() => { setStockFilter(stockFilter === 'low' ? '' : 'low'); setView('cards'); }}
          />
          <BtKpiCard
            label="Out of Stock"
            tag="DEPLETED"
            value={summary.outOfStockCount}
            gradient="linear-gradient(135deg, #b02a37 0%, #dc3545 100%)"
            glow="rgba(220, 53, 69, 0.35)"
            icon="⛔"
            onClick={() => { setStockFilter(stockFilter === 'out' ? '' : 'out'); setView('cards'); }}
          />
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={styles.toolbar(isDark)}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: 200, flex: '1 1 200px' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 13 }}>🔍</span>
            <input
              style={{ ...styles.input(isDark), paddingLeft: 34 }}
              placeholder="Search bag #, material, type, supplier…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Material Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => { setMatFilter(''); setStockFilter(''); }}
              style={styles.filterPill(!matFilter && !stockFilter, BT.primary, isDark)}
            >
              All Materials
            </button>
            {mats.map(m => (
              <button
                key={m}
                onClick={() => { setMatFilter(matFilter === m ? '' : m); setStockFilter(''); }}
                style={styles.filterPill(matFilter === m && !stockFilter, matColor(m), isDark)}
              >
                {m}
              </button>
            ))}
          </div>

          {stockFilter && (
            <button
              onClick={() => setStockFilter('')}
              style={styles.clearBtn}
            >
              ✕ Clear Filter ({stockFilter})
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={styles.headerSubBadge(isDark)}>
            {displayed.length} records
          </span>
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

      {/* ── Content: Cards vs Table ── */}
      {displayed.length === 0 ? (
        <div style={styles.emptyCardBox(isDark)}>No stock records found matching your filters.</div>
      ) : view === 'cards' ? (
        <div>
          <div style={styles.stockGrid}>
            {paginated.map(b => {
              const lvl = stockLevel(b);
              const st  = levelStyle(lvl);
              const pct = b.totalPurchased > 0 ? Math.max(0, (b.remainingStock / b.totalPurchased) * 100) : 0;
              return (
                <div key={b.bagPurchaseId} style={styles.stockCard(isDark, st.border)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={styles.stockBagNum(isDark)}>#{b.bagNumber}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        <span style={{ ...styles.matBadge, background: matColor(b.material) }}>{b.material}</span>
                        <span style={styles.typeBadge}>{b.bagType}</span>
                      </div>
                    </div>
                    <span style={styles.levelBadge(st.badge)}>
                      {st.label}
                    </span>
                  </div>

                  {b.supplierName && (
                    <div style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 4 }}>
                      🏭 {b.supplierName}
                    </div>
                  )}

                  {/* Progress bar */}
                  <div style={styles.progressBarBg(isDark)}>
                    <div style={{ ...styles.progressBarFill, width: `${pct}%`, background: st.badge }} />
                  </div>

                  {/* Stock numbers box */}
                  <div style={styles.stockNumsBox(isDark)}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={styles.stockNumVal(isDark)}>{b.totalPurchased}</div>
                      <div style={styles.stockNumLabel(isDark)}>Purchased</div>
                    </div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ ...styles.stockNumVal(isDark), color: BT.purple }}>{b.totalUsed}</div>
                      <div style={styles.stockNumLabel(isDark)}>Used</div>
                    </div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ ...styles.stockNumVal(isDark), color: st.badge, fontWeight: 800 }}>{b.remainingStock}</div>
                      <div style={styles.stockNumLabel(isDark)}>Remaining</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#adb5bd', marginTop: 4 }}>
                    📅 Purchased: {fmtDate(b.purchaseDate)}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14 }}>
            <InvPagination
              page={page}
              pageSize={pageSize}
              total={displayed.length}
              onPage={setPage}
              onPageSize={setPageSize}
              isDark={isDark}
            />
          </div>
        </div>
      ) : (
        <div style={styles.cardBox(isDark)}>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Bag #', 'Material', 'Type', 'Supplier', 'Purchase Date', 'Purchased', 'Used', 'Remaining', 'Stock Status'].map(h => (
                    <th key={h} style={styles.th(isDark, ['Purchased', 'Used', 'Remaining'].includes(h))}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(b => {
                  const lvl = stockLevel(b);
                  const st  = levelStyle(lvl);
                  const pct = b.totalPurchased > 0 ? Math.max(0, (b.remainingStock / b.totalPurchased) * 100) : 0;
                  return (
                    <tr key={b.bagPurchaseId} style={styles.tr(isDark, true)}>
                      <td style={{ ...styles.td(isDark), fontWeight: 800, color: BT.primary }}>
                        #{b.bagNumber}
                      </td>
                      <td style={styles.td(isDark)}>
                        <span style={{ ...styles.matBadge, background: matColor(b.material) }}>{b.material}</span>
                      </td>
                      <td style={styles.td(isDark)}>{b.bagType}</td>
                      <td style={styles.td(isDark)}>{b.supplierName || '—'}</td>
                      <td style={styles.td(isDark)}>{fmtDate(b.purchaseDate)}</td>
                      <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 600 }}>{b.totalPurchased}</td>
                      <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.purple, fontWeight: 700 }}>{b.totalUsed}</td>
                      <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 800, color: st.badge }}>{b.remainingStock}</td>
                      <td style={styles.td(isDark)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ ...styles.progressBarBg(isDark), flex: 1, minWidth: 60 }}>
                            <div style={{ ...styles.progressBarFill, width: `${pct}%`, background: st.badge }} />
                          </div>
                          <span style={styles.levelBadge(st.badge)}>{st.label}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <InvPagination
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE LOG TAB
// ─────────────────────────────────────────────────────────────────────────────
function UsageLogTab({ isDark, onSelectLot }) {
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
      setError(e.response?.data || 'Failed to save usage.');
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

  const selectedBagStock = stock.find(b => b.bagPurchaseId === Number(form.bagPurchaseId));
  const availableForEdit = selectedBagStock
    ? selectedBagStock.remainingStock + (editing ? editing.quantityUsed : 0)
    : null;

  if (loading) {
    return (
      <div style={styles.loadingBox(isDark)}>
        <div style={styles.spinner} />
        <div style={{ marginTop: 14, fontWeight: 600 }}>Loading usage records…</div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={styles.toolbar(isDark)}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 13 }}>🔍</span>
          <input
            style={{ ...styles.input(isDark), paddingLeft: 34 }}
            placeholder="Search lot, bag, material, supplier, remarks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setMatFilter('')}
            style={styles.filterPill(!matFilter, BT.primary, isDark)}
          >
            All Materials
          </button>
          {mats.map(m => (
            <button
              key={m}
              onClick={() => setMatFilter(matFilter === m ? '' : m)}
              style={styles.filterPill(matFilter === m, matColor(m), isDark)}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={openAdd} style={styles.addBtn}>
            <span>+</span> Log Usage
          </button>
          <button onClick={openMulti} style={styles.btnPurple}>
            <span>📦</span> Multi-Lot
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {displayed.length === 0 ? (
        <div style={styles.emptyCardBox(isDark)}>No usage records found.</div>
      ) : (
        <div style={styles.cardBox(isDark)}>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Date', 'Lot #', 'Size', 'Bag #', 'Material', 'Type', 'Supplier', 'Qty Used', 'Remarks', 'Actions'].map(h => (
                    <th key={h} style={styles.th(isDark, h === 'Qty Used')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uPaginated.map((u, i) => (
                  <tr key={u.id} style={styles.tr(isDark, i % 2 === 0)}>
                    <td style={styles.td(isDark)}>{fmtDate(u.usageDate)}</td>
                    <td
                      style={{ ...styles.td(isDark), fontWeight: 800, color: BT.primary, cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => onSelectLot && onSelectLot({ id: u.lotId, lotNumber: u.lotNumber, sizeName: u.sizeName, material: u.material })}
                      title="Click to see which staff worked on this lot"
                    >
                      {u.lotNumber}
                    </td>
                    <td style={styles.td(isDark)}>{u.sizeName || '—'}</td>
                    <td style={styles.td(isDark)}>
                      <span style={{ ...styles.bagNumBadge, borderColor: matColor(u.material), color: matColor(u.material) }}>
                        #{u.bagNumber}
                      </span>
                    </td>
                    <td style={styles.td(isDark)}>
                      <span style={{ ...styles.matBadge, background: matColor(u.material) }}>{u.material}</span>
                    </td>
                    <td style={styles.td(isDark)}>{u.bagType}</td>
                    <td style={styles.td(isDark)}>{u.supplierName || '—'}</td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 800, color: BT.purple }}>
                      {u.quantityUsed}
                    </td>
                    <td style={{ ...styles.td(isDark), color: isDark ? 'var(--text-muted)' : '#6c757d', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.notes || '—'}
                    </td>
                    <td style={styles.td(isDark)}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => openEdit(u)} style={styles.btnEditSm}>Edit</button>
                        <button onClick={() => setDelTarget(u)} style={styles.btnDelSm}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <InvPagination
            page={uPage}
            pageSize={uPageSize}
            total={displayed.length}
            onPage={setUPage}
            onPageSize={setUPageSize}
            isDark={isDark}
          />
        </div>
      )}

      {/* ── Add / Edit Usage Modal ── */}
      {showForm && (
        <div style={styles.overlay} onClick={() => setShowForm(false)}>
          <div style={styles.modal(isDark)} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>
                {editing ? '✏️ Edit Material Usage' : '📋 Log Material Usage'}
              </span>
              <button onClick={() => setShowForm(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={styles.label(isDark)}>Production Lot *</label>
                <select
                  style={styles.select(isDark)}
                  value={form.lotId}
                  onChange={e => setForm(f => ({ ...f, lotId: e.target.value }))}
                >
                  <option value="">— Select Lot —</option>
                  {lots.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.lotNumber}{l.sizeName ? ` (${l.sizeName})` : ''}{l.material ? ` — ${l.material}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label(isDark)}>Bag Purchase *</label>
                <select
                  style={styles.select(isDark)}
                  value={form.bagPurchaseId}
                  onChange={e => setForm(f => ({ ...f, bagPurchaseId: e.target.value }))}
                >
                  <option value="">— Select Bag Purchase —</option>
                  {stock.map(b => (
                    <option key={b.bagPurchaseId} value={b.bagPurchaseId}>
                      #{b.bagNumber} — {b.material} {b.bagType} (Available: {b.remainingStock})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBagStock && (
                <div style={{ fontSize: 12, color: BT.success, fontWeight: 600 }}>
                  ✓ Available stock for assignment: <strong>{availableForEdit}</strong> bags
                </div>
              )}

              <div style={styles.formGrid}>
                <div>
                  <label style={styles.label(isDark)}>Quantity Used *</label>
                  <input
                    style={styles.input(isDark)}
                    type="number"
                    min="1"
                    placeholder="e.g. 5"
                    value={form.quantityUsed}
                    onChange={e => setForm(f => ({ ...f, quantityUsed: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={styles.label(isDark)}>Date Logged *</label>
                  <input
                    style={styles.input(isDark)}
                    type="date"
                    value={form.usageDate}
                    onChange={e => setForm(f => ({ ...f, usageDate: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={styles.label(isDark)}>Notes</label>
                <textarea
                  style={{ ...styles.input(isDark), minHeight: 60, resize: 'vertical' }}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Batch 2 cut pieces, wastage remarks…"
                />
              </div>

              {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} style={styles.btnSecondary}>Cancel</button>
                <button onClick={handleSave} style={styles.btnSuccess} disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update Usage' : 'Save Usage'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-Lot Modal ── */}
      {showMulti && (
        <div style={styles.overlay} onClick={() => setShowMulti(false)}>
          <div style={{ ...styles.modal(isDark), maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>📦 Multi-Lot Batch Allocation</div>
                <div style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 2 }}>
                  Allocate a single fabric bag across multiple production lots at once.
                </div>
              </div>
              <button onClick={() => setShowMulti(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={styles.label(isDark)}>Bag Purchase *</label>
                <select
                  style={styles.select(isDark)}
                  value={multiBagId}
                  onChange={e => setMultiBagId(e.target.value)}
                >
                  <option value="">— Select Bag Purchase —</option>
                  {stock.map(b => (
                    <option key={b.bagPurchaseId} value={b.bagPurchaseId}>
                      #{b.bagNumber} — {b.material} {b.bagType} (Available: {b.remainingStock})
                    </option>
                  ))}
                </select>
              </div>

              {multiBagStock && (
                <div style={styles.multiStockAlert(multiTotalQty > multiBagStock.remainingStock)}>
                  <div>Available Stock: <strong>{multiBagStock.remainingStock}</strong> bags</div>
                  {multiTotalQty > 0 && (
                    <div style={{ marginTop: 2 }}>
                      Allocating: <strong>{multiTotalQty}</strong> bags ({multiBagStock.remainingStock - multiTotalQty >= 0 ? `${multiBagStock.remainingStock - multiTotalQty} left` : 'OVER CAPACITY'})
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={styles.label(isDark)}>Usage Date *</label>
                <input
                  style={styles.input(isDark)}
                  type="date"
                  value={multiDate}
                  onChange={e => setMultiDate(e.target.value)}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={styles.label(isDark)}>Lots to Allocate</span>
                  <button onClick={addMultiRow} style={styles.btnAddRow}>
                    + Add Another Lot
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                  {multiRows.map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 36px', gap: 8, alignItems: 'center' }}>
                      <select
                        style={styles.select(isDark)}
                        value={row.lotId}
                        onChange={e => setMultiRow(i, 'lotId', e.target.value)}
                      >
                        <option value="">— Select Lot —</option>
                        {lots.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.lotNumber}{l.sizeName ? ` (${l.sizeName})` : ''}
                          </option>
                        ))}
                      </select>
                      <input
                        style={styles.input(isDark)}
                        type="number"
                        min="1"
                        placeholder="Qty (bags)"
                        value={row.qty}
                        onChange={e => setMultiRow(i, 'qty', e.target.value)}
                      />
                      <button
                        onClick={() => removeMultiRow(i)}
                        disabled={multiRows.length === 1}
                        style={styles.btnDelRow(multiRows.length === 1)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {multiError && <div style={styles.errorAlert}>⚠️ {multiError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button onClick={() => setShowMulti(false)} style={styles.btnSecondary}>Cancel</button>
                <button onClick={handleMultiSave} style={styles.btnPurple} disabled={multiSaving}>
                  {multiSaving ? 'Saving…' : `Save ${multiRows.filter(r => r.lotId && Number(r.qty) > 0).length} Allocations`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {delTarget && (
        <div style={styles.overlay} onClick={() => setDelTarget(null)}>
          <div style={{ ...styles.modal(isDark), maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <span style={{ fontSize: 16, fontWeight: 800, color: BT.danger }}>
                ⚠️ Delete Usage Record?
              </span>
              <button onClick={() => setDelTarget(null)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ color: isDark ? 'var(--text-main)' : '#212529', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                Remove <strong>{delTarget.quantityUsed}</strong> bags of{' '}
                <strong>{delTarget.material} {delTarget.bagType}</strong> allocated to lot{' '}
                <strong>{delTarget.lotNumber}</strong>? This will restore stock balance.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button onClick={() => setDelTarget(null)} style={styles.btnSecondary}>Cancel</button>
                <button onClick={handleDelete} style={styles.btnDanger}>Confirm Delete</button>
              </div>
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
function ByLotTab({ isDark, onSelectLot }) {
  const [lots,        setLots]        = useState([]);
  const [selectedId,  setSelectedId]  = useState('');
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
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
    <div>
      <div style={styles.toolbar(isDark)}>
        <select
          style={{ ...styles.select(isDark), minWidth: 280 }}
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setResult(null); }}
          disabled={lotsLoading}
        >
          <option value="">— Select Production Lot —</option>
          {lots.map(l => (
            <option key={l.id} value={l.id}>
              {l.lotNumber}{l.sizeName ? ` (${l.sizeName})` : ''}{l.material ? ` — ${l.material}` : ''}
            </option>
          ))}
        </select>
        <button onClick={lookup} style={styles.addBtn} disabled={!selectedId || loading}>
          {loading ? 'Searching…' : '🔍 View Lot Consumption'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 20 }}>
          {/* Header Summary */}
          <div style={styles.lotHeader(isDark)}>
            <div>
              <div style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#6c757d', fontWeight: 700, textTransform: 'uppercase' }}>PRODUCTION LOT RECORD</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span
                  onClick={() => onSelectLot && onSelectLot({ id: result.lotId, lotNumber: result.lotNumber, sizeName: result.sizeName })}
                  title="Click to see which staff worked on this lot"
                  style={{ fontSize: 18, fontWeight: 800, color: BT.primary, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {result.lotNumber}
                </span>
                {result.sizeName && <span style={styles.sizeBadge}>{result.sizeName}</span>}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#6c757d', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL BAGS CONSUMED</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: BT.purple }}>{result.totalBagsUsed} bags</div>
            </div>
          </div>

          {result.usages.length === 0 ? (
            <div style={styles.emptyCardBox(isDark)}>No material usage recorded for this lot yet.</div>
          ) : (
            <div style={styles.cardBox(isDark)}>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Usage Date', 'Bag #', 'Material', 'Bag Type', 'Supplier', 'Quantity Used', 'Remarks'].map(h => (
                        <th key={h} style={styles.th(isDark, h === 'Quantity Used')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.usages.map((u, i) => (
                      <tr key={u.id} style={styles.tr(isDark, i % 2 === 0)}>
                        <td style={styles.td(isDark)}>{fmtDate(u.usageDate)}</td>
                        <td style={styles.td(isDark)}>
                          <span style={{ ...styles.bagNumBadge, borderColor: matColor(u.material), color: matColor(u.material) }}>
                            #{u.bagNumber}
                          </span>
                        </td>
                        <td style={styles.td(isDark)}>
                          <span style={{ ...styles.matBadge, background: matColor(u.material) }}>{u.material}</span>
                        </td>
                        <td style={styles.td(isDark)}>{u.bagType}</td>
                        <td style={styles.td(isDark)}>{u.supplierName || '—'}</td>
                        <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 800, color: BT.purple }}>
                          {u.quantityUsed}
                        </td>
                        <td style={{ ...styles.td(isDark), color: isDark ? 'var(--text-muted)' : '#6c757d' }}>{u.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && selectedId && (
        <div style={styles.emptyCardBox(isDark)}>Click "View Lot Consumption" above to fetch usage history.</div>
      )}
    </div>
  );
}

// ── Reusable KPI Card (Bootstrap 5 Style) ──
function BtKpiCard({ label, tag, value, gradient, glow, icon, onClick }) {
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
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
          {value}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.92)', marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ── Pagination Component ──
function InvPagination({ page, pageSize, total, onPage, onPageSize, isDark }) {
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
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 18px', borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
      background: isDark ? 'var(--bg-subtle)' : '#f8f9fa', flexWrap: 'wrap', gap: 10
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
          {[12, 24, 48, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>Showing <strong style={{ color: isDark ? '#fff' : '#212529' }}>{from}–{to}</strong> of <strong style={{ color: isDark ? '#fff' : '#212529' }}>{total}</strong></span>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          onClick={() => onPage(page - 1)}
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
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          style={styles.pageBtn(false, page >= totalPages, isDark)}
        >
          Next ›
        </button>
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

  headerSubBadge: (isDark) => ({
    background: 'rgba(255,255,255,0.1)',
    color: '#e2e8f0',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
  }),

  tabSwitch: (isDark) => ({
    display: 'flex',
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 4,
    gap: 4,
    backdropFilter: 'blur(6px)',
  }),

  switchBtn: (active, isDark) => ({
    padding: '7px 16px',
    border: 'none',
    borderRadius: 8,
    background: active ? '#ffffff' : 'transparent',
    color: active ? '#212529' : 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all .15s',
    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
  }),

  content: {
    padding: '20px 24px 36px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  kpiGrid6: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
    marginBottom: 16,
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

  filterPill: (active, color, isDark) => ({
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    border: active ? `1px solid ${color}` : `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    background: active ? color : isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    color: active ? '#ffffff' : isDark ? 'var(--text-muted)' : '#495057',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
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

  btnPurple: {
    background: BT.purple,
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 2px 6px rgba(111, 66, 193, 0.35)',
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

  th: (isDark, alignRight = false) => ({
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    padding: '12px 14px',
    textAlign: alignRight ? 'right' : 'left',
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
  }),

  td: (isDark) => ({
    padding: '11px 14px',
    color: isDark ? 'var(--text-main)' : '#212529',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  }),

  stockGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  },

  stockCard: (isDark, borderColor) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    padding: '16px 18px',
    border: `1.5px solid ${borderColor}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  }),

  stockBagNum: (isDark) => ({
    fontSize: '1.2rem',
    fontWeight: 800,
    color: isDark ? '#ffffff' : '#212529',
  }),

  progressBarBg: (isDark) => ({
    background: isDark ? '#334155' : '#e9ecef',
    borderRadius: 10,
    height: 6,
    overflow: 'hidden',
    marginTop: 4,
  }),

  progressBarFill: {
    height: '100%',
    borderRadius: 10,
    transition: 'width 0.3s ease',
  },

  stockNumsBox: (isDark) => ({
    display: 'flex',
    justifyContent: 'space-between',
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    borderRadius: 10,
    padding: '10px 12px',
    marginTop: 4,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e9ecef'}`,
  }),

  stockNumVal: (isDark) => ({
    fontSize: 14,
    fontWeight: 800,
    color: isDark ? '#ffffff' : '#212529',
  }),

  stockNumLabel: (isDark) => ({
    fontSize: 10,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: 1,
  }),

  matBadge: {
    display: 'inline-block',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 4,
    padding: '2px 8px',
  },

  typeBadge: {
    display: 'inline-block',
    background: '#e0f2fe',
    color: '#0369a1',
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 4,
    padding: '2px 8px',
  },

  levelBadge: (color) => ({
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 800,
    borderRadius: 20,
    padding: '3px 10px',
    background: color,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }),

  bagNumBadge: {
    display: 'inline-block',
    border: '1.5px solid',
    borderRadius: 6,
    padding: '2px 8px',
    fontWeight: 800,
    fontSize: 12,
  },

  btnEditSm: {
    background: '#cfe2ff',
    color: '#084298',
    border: '1px solid #b6d4fe',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  btnDelSm: {
    background: '#f8d7da',
    color: '#842029',
    border: '1px solid #f5c2c7',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  lotHeader: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    padding: '16px 22px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  }),

  sizeBadge: {
    background: '#ede9fe',
    color: '#7c3aed',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 800,
  },

  multiStockAlert: (isOver) => ({
    background: isOver ? '#f8d7da' : '#d1e7dd',
    border: `1px solid ${isOver ? '#f5c2c7' : '#badbcc'}`,
    color: isOver ? '#842029' : '#0f5132',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 600,
  }),

  btnAddRow: {
    background: 'none',
    border: 'none',
    color: BT.primary,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  btnDelRow: (disabled) => ({
    background: disabled ? '#f8f9fa' : '#f8d7da',
    color: disabled ? '#adb5bd' : '#842029',
    border: `1px solid ${disabled ? '#dee2e6' : '#f5c2c7'}`,
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 800,
    fontSize: 14,
    padding: '7px 8px',
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

  // ── Modals ──
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
    maxWidth: 520,
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

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
  },

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
