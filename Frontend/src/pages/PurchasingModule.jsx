import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { clearDropdownsCache } from '../hooks/useHooks';
import api, {
  getPurchases, getPurchaseSummary, createPurchase, updatePurchase, deletePurchase,
  getSuppliers, createSupplier, updateSupplier, toggleSupplierStatus, deleteSupplier,
} from '../services/api';

const PRESET_MATERIAL_COLORS = {
  'Mink': '#6f42c1', 'Mink Bo': '#8540f5', 'Cotton': '#0d6efd',
  'Polister': '#20c997', 'Fleece': '#198754', 'Khaddar': '#fd7e14',
  'Lawn': '#146c43', 'Silk': '#d63384', 'Velvet': '#e11d48', 'Denim': '#0284c7',
};

const PALETTE = ['#6f42c1', '#0d6efd', '#20c997', '#198754', '#fd7e14', '#146c43', '#d63384', '#0284c7', '#7c3aed', '#059669', '#ea580c', '#e11d48'];

const today = () => new Date().toISOString().split('T')[0];
const fmt   = n => n != null ? `Rs ${Number(n).toLocaleString()}` : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const matColor = (m) => {
  if (!m) return '#6c757d';
  if (PRESET_MATERIAL_COLORS[m]) return PRESET_MATERIAL_COLORS[m];
  let hash = 0;
  for (let i = 0; i < m.length; i++) hash = (hash * 31 + m.charCodeAt(i)) % PALETTE.length;
  return PALETTE[hash];
};

const emptyPurchaseForm = () => ({
  bagNumber: '', material: '', bagType: '', quantity: '',
  purchaseDate: today(), unitPrice: '', supplierId: '', notes: '',
});

const emptySupplierForm = () => ({ name: '', phone: '', address: '', notes: '' });

const DEFAULT_MATERIALS = ['Mink', 'Mink Bo', 'Cotton', 'Polister', 'Fleece', 'Khaddar', 'Lawn', 'Other'];
const DEFAULT_BAG_TYPES = ['Boray', 'Diby', 'Bobay'];

const fetchConfigList = async (url, fallback = []) => {
  try {
    const r = await api.get(url);
    if (Array.isArray(r.data) && r.data.length > 0) {
      return r.data
        .filter(x => x && x.isActive !== false)
        .map(x => (typeof x === 'string' ? x : x.name || x.Name || ''))
        .filter(Boolean);
    }
  } catch {}
  return fallback;
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

// ─────────────────────────────────────────────
export default function PurchasingModule() {
  const { isDark } = useTheme();
  const [tab, setTab] = useState('purchases');

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">
      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>🛍️</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>SUPPLY CHAIN &amp; PROCUREMENT</div>
            <h1 style={styles.headerTitle(isDark)}>Purchasing &amp; Material Supplies</h1>
          </div>
        </div>

        {/* Bootstrap Nav Pills (Tab Switcher) */}
        <div style={styles.tabSwitch(isDark)}>
          {[
            ['purchases', '📦 Purchases Log'],
            ['suppliers', '🏭 Verified Suppliers'],
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
        {tab === 'purchases' ? <PurchasesTab isDark={isDark} /> : <SuppliersTab isDark={isDark} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PURCHASES TAB
// ─────────────────────────────────────────────
function PurchasesTab({ isDark }) {
  const { can } = useAuth();
  const canAdd    = can('canAddSettings');
  const canEdit   = can('canEditSettings');
  const canDelete = can('canDeleteSettings');

  const [records, setRecords]     = useState([]);
  const [summary, setSummary]     = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS);
  const [bagTypes, setBagTypes]   = useState(DEFAULT_BAG_TYPES);
  const [customMatMode, setCustomMatMode] = useState(false);
  const [customBagMode, setCustomBagMode] = useState(false);
  const [customMatInput, setCustomMatInput] = useState('');
  const [customBagInput, setCustomBagInput] = useState('');
  const [loading, setLoading]     = useState(true);
  const [matFilter, setMatFilter] = useState('');
  const [typFilter, setTypFilter] = useState('');
  const [supFilter, setSupFilter] = useState('');
  const [search, setSearch]       = useState('');
  const [view, setView]           = useState('table');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(emptyPurchaseForm());
  const [saving, setSaving]       = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [error, setError]         = useState('');
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(10);

  const refreshConfigs = useCallback(async () => {
    try {
      const [mats, bags] = await Promise.all([
        fetchConfigList('/masters/materials', DEFAULT_MATERIALS),
        fetchConfigList('/masters/bag-types', DEFAULT_BAG_TYPES),
      ]);
      if (mats && mats.length > 0) setMaterials(mats);
      if (bags && bags.length > 0) setBagTypes(bags);
    } catch {}
  }, []);

  const availableMaterials = useMemo(() => {
    const list = [...materials];
    records.forEach(r => {
      if (r.material && !list.includes(r.material)) list.push(r.material);
    });
    return Array.from(new Set(list.filter(Boolean)));
  }, [materials, records]);

  const availableBagTypes = useMemo(() => {
    const list = [...bagTypes];
    records.forEach(r => {
      if (r.bagType && !list.includes(r.bagType)) list.push(r.bagType);
    });
    return Array.from(new Set(list.filter(Boolean)));
  }, [bagTypes, records]);

  const load = useCallback(async () => {
    setLoading(true);
    refreshConfigs();
    try {
      const [r, sm, sup] = await Promise.all([
        getPurchases().catch(() => []),
        getPurchaseSummary().catch(() => null),
        getSuppliers().catch(() => []),
      ]);
      setRecords(r || []);
      setSummary(sm);
      setSuppliers((sup || []).filter(s => s.isActive));
    } catch {
      setRecords([]);
      setSummary(null);
    }
    setLoading(false);
  }, [refreshConfigs]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    refreshConfigs();
    setForm(emptyPurchaseForm());
    setEditing(null);
    setError('');
    setCustomMatMode(false);
    setCustomBagMode(false);
    setCustomMatInput('');
    setCustomBagInput('');
    setShowForm(true);
  };

  const openEdit = r => {
    refreshConfigs();
    setForm({
      bagNumber:    r.bagNumber,
      material:     r.material,
      bagType:      r.bagType,
      quantity:     String(r.quantity),
      purchaseDate: r.purchaseDate?.split('T')[0] ?? today(),
      unitPrice:    r.unitPrice != null ? String(r.unitPrice) : '',
      supplierId:   r.supplierId != null ? String(r.supplierId) : '',
      notes:        r.notes ?? '',
    });
    setEditing(r);
    setError('');
    setCustomMatMode(false);
    setCustomBagMode(false);
    setCustomMatInput('');
    setCustomBagInput('');
    setShowForm(true);
  };

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    const finalMat = (customMatMode ? customMatInput : form.material).trim();
    const finalBag = (customBagMode ? customBagInput : form.bagType).trim();

    if (!form.bagNumber.trim()) { setError('Bag Number is required'); return; }
    if (!finalMat)              { setError('Material is required'); return; }
    if (!finalBag)              { setError('Bag Type is required'); return; }
    if (!form.quantity || Number(form.quantity) < 1) { setError('Quantity must be ≥ 1'); return; }

    setSaving(true);
    setError('');
    const payload = {
      bagNumber:    form.bagNumber.trim(),
      material:     finalMat,
      bagType:      finalBag,
      quantity:     Number(form.quantity),
      purchaseDate: form.purchaseDate,
      unitPrice:    form.unitPrice ? Number(form.unitPrice) : null,
      supplierId:   form.supplierId ? Number(form.supplierId) : null,
      notes:        form.notes.trim() || null,
    };
    try {
      editing ? await updatePurchase(editing.id, payload) : await createPurchase(payload);

      // Persist newly typed material to configurations if not already in master list
      if (!materials.some(m => m.toLowerCase() === finalMat.toLowerCase())) {
        api.post('/masters/materials', { name: finalMat, isActive: true }).then(() => {
          setMaterials(prev => [...prev, finalMat]);
          clearDropdownsCache();
        }).catch(() => {});
      }

      // Persist newly typed bag type to configurations if not already in master list
      if (!bagTypes.some(b => b.toLowerCase() === finalBag.toLowerCase())) {
        api.post('/masters/bag-types', { name: finalBag, isActive: true }).then(() => {
          setBagTypes(prev => [...prev, finalBag]);
          clearDropdownsCache();
        }).catch(() => {});
      }

      setShowForm(false);
      await load();
    } catch {
      setError('Failed to save purchase record. Please try again.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try { await deletePurchase(delTarget.id); await load(); } catch {}
    setDelTarget(null);
  };

  const filtered = records.filter(r => {
    if (matFilter && r.material !== matFilter) return false;
    if (typFilter && r.bagType  !== typFilter) return false;
    if (supFilter && String(r.supplierId) !== supFilter) return false;
    const q = search.toLowerCase();
    return !q || r.bagNumber.toLowerCase().includes(q) ||
      r.material.toLowerCase().includes(q) ||
      (r.supplierName || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q);
  });

  const stats = useMemo(() => ({
    totalBags:    filtered.reduce((a, r) => a + (r.quantity || 0), 0),
    totalRecords: filtered.length,
    materials:    new Set(filtered.map(r => r.material)).size,
    totalValue:   filtered.reduce((a, r) => a + (r.totalAmount || 0), 0),
  }), [filtered]);

  const hasFilters = matFilter || typFilter || supFilter || search;

  const clearFilters = () => { setMatFilter(''); setTypFilter(''); setSupFilter(''); setSearch(''); };

  useEffect(() => { setPage(1); }, [matFilter, typFilter, supFilter, search, pageSize]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  return (
    <>
      {/* ── 4 Executive KPI Cards with Bootstrap Colors ── */}
      <div style={styles.kpiGrid}>
        <BtKpiCard
          label="Total Bags Procured"
          tag="PHYSICAL INVENTORY"
          value={stats.totalBags.toLocaleString()}
          gradient="linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)"
          glow="rgba(13, 110, 253, 0.35)"
          icon="📦"
          sub="Total bag units received"
          onClick={() => { clearFilters(); setView('table'); }}
        />
        <BtKpiCard
          label="Purchase Entries"
          tag="SUPPLY ORDERS"
          value={stats.totalRecords}
          gradient="linear-gradient(135deg, #146c43 0%, #198754 100%)"
          glow="rgba(25, 135, 84, 0.35)"
          icon="🧾"
          sub="Dispatches logged in system"
          onClick={() => { clearFilters(); setView('table'); }}
        />
        <BtKpiCard
          label="Fabric Materials"
          tag="CATEGORIES"
          value={stats.materials}
          gradient="linear-gradient(135deg, #59359a 0%, #6f42c1 100%)"
          glow="rgba(111, 66, 193, 0.35)"
          icon="🎨"
          sub="Distinct fabric types"
          onClick={() => setView('overview')}
        />
        <BtKpiCard
          label="Total Procurement Cost"
          tag="EXPENDITURE"
          value={stats.totalValue > 0 ? fmt(stats.totalValue) : '—'}
          gradient="linear-gradient(135deg, #c2410c 0%, #fd7e14 100%)"
          glow="rgba(253, 126, 20, 0.35)"
          icon="💰"
          sub="Combined purchase cost"
          onClick={() => { clearFilters(); setView('table'); }}
        />
      </div>

      {/* ── Filter Toolbar ── */}
      <div style={styles.toolbar(isDark)}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: 200, flex: '1 1 200px' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 13 }}>🔍</span>
            <input
              style={{ ...styles.input(isDark), paddingLeft: 34 }}
              placeholder="Search bag #, material, supplier, notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Material Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setMatFilter('')}
              style={styles.filterPill(!matFilter, BT.primary, isDark)}
            >
              All Materials
            </button>
            {availableMaterials.map(m => (
              <button
                key={m}
                onClick={() => setMatFilter(matFilter === m ? '' : m)}
                style={styles.filterPill(matFilter === m, matColor(m), isDark)}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Type Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setTypFilter('')}
              style={styles.filterPill(!typFilter, BT.secondary, isDark)}
            >
              All Types
            </button>
            {availableBagTypes.map(t => (
              <button
                key={t}
                onClick={() => setTypFilter(typFilter === t ? '' : t)}
                style={styles.filterPill(typFilter === t, '#64748b', isDark)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Supplier dropdown */}
          {suppliers.length > 0 && (
            <select
              style={{ ...styles.select(isDark), minWidth: 160 }}
              value={supFilter}
              onChange={e => setSupFilter(e.target.value)}
            >
              <option value="">All Suppliers ({suppliers.length})</option>
              {suppliers.map(sup => (
                <option key={sup.id} value={String(sup.id)}>{sup.name}</option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button onClick={clearFilters} style={styles.clearBtn}>
              ✕ Clear
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={styles.viewToggle(isDark)}>
            <button
              onClick={() => setView('table')}
              style={styles.viewBtn(view === 'table', isDark)}
              title="Table View"
            >
              📋 Table
            </button>
            <button
              onClick={() => setView('overview')}
              style={styles.viewBtn(view === 'overview', isDark)}
              title="Fabric Material Breakdown"
            >
              📊 Overview
            </button>
          </div>

          {canAdd && (
            <button onClick={openAdd} style={styles.addBtn}>
              <span>+</span> Add Purchase
            </button>
          )}
        </div>
      </div>

      {/* ── View: Material Overview ── */}
      {view === 'overview' && summary?.byMaterial?.length > 0 && (
        <div style={styles.overviewGrid}>
          {summary.byMaterial.map(mat => (
            <div key={mat.material} style={styles.matCard(isDark, matColor(mat.material))}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <span style={{ ...styles.matBadge, background: matColor(mat.material) }}>
                    {mat.material}
                  </span>
                  <div style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 4, fontWeight: 600 }}>
                    {mat.totalBags} bags total · {mat.records} record{mat.records !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => { setMatFilter(mat.material); setView('table'); }}
                  style={styles.btnSecondarySm}
                >
                  Filter →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mat.bagNumbers.map((b, i) => (
                  <div key={i} style={styles.bagRow(isDark)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ ...styles.bagNumBadge, borderColor: matColor(mat.material), color: matColor(mat.material) }}>
                        #{b.bagNumber}
                      </span>
                      <span style={styles.typePill}>{b.bagType}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <strong style={{ color: isDark ? '#fff' : '#212529', fontSize: 13 }}>{b.quantity} bags</strong>
                      <span style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#adb5bd' }}>{fmtDate(b.purchaseDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── View: Table ── */}
      {view === 'table' && (
        <>
          {loading ? (
            <div style={styles.loadingBox(isDark)}>
              <div style={styles.spinner} />
              <div style={{ marginTop: 14, fontWeight: 600 }}>Loading purchases…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={styles.emptyCardBox(isDark)}>
              No purchases found matching your selected filters.
            </div>
          ) : (
            <div style={styles.cardBox(isDark)}>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['#', 'Bag #', 'Material', 'Type', 'Qty', 'Date', 'Unit Price', 'Total Cost', 'Supplier', 'Remarks', ...(canEdit || canDelete ? ['Actions'] : [])].map(h => (
                        <th key={h} style={styles.th(isDark, ['Qty', 'Unit Price', 'Total Cost'].includes(h))}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((r, i) => (
                      <tr key={r.id} style={styles.tr(isDark, i % 2 === 0)}>
                        <td style={{ ...styles.td(isDark), color: isDark ? 'var(--text-muted)' : '#9ca3af', textAlign: 'center', fontSize: 12 }}>
                          {(page - 1) * pageSize + i + 1}
                        </td>
                        <td style={styles.td(isDark)}>
                          <span style={{ ...styles.bagNumBadge, borderColor: matColor(r.material), color: matColor(r.material) }}>
                            #{r.bagNumber}
                          </span>
                        </td>
                        <td style={styles.td(isDark)}>
                          <span style={{ ...styles.matBadge, background: matColor(r.material) }}>
                            {r.material}
                          </span>
                        </td>
                        <td style={styles.td(isDark)}>
                          <span style={styles.typePill}>{r.bagType}</span>
                        </td>
                        <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 800 }}>
                          {r.quantity}
                        </td>
                        <td style={{ ...styles.td(isDark), color: isDark ? 'var(--text-muted)' : '#6c757d', fontSize: 12 }}>
                          {fmtDate(r.purchaseDate)}
                        </td>
                        <td style={{ ...styles.td(isDark), textAlign: 'right', color: isDark ? 'var(--text-muted)' : '#6c757d' }}>
                          {r.unitPrice != null ? fmt(r.unitPrice) : '—'}
                        </td>
                        <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 800, color: BT.success }}>
                          {r.totalAmount != null ? fmt(r.totalAmount) : '—'}
                        </td>
                        <td style={styles.td(isDark)}>
                          {r.supplierName ? (
                            <span style={styles.supplierChip}>{r.supplierName}</span>
                          ) : (
                            <span style={{ color: isDark ? 'var(--text-muted)' : '#adb5bd' }}>—</span>
                          )}
                        </td>
                        <td style={{ ...styles.td(isDark), color: isDark ? 'var(--text-muted)' : '#6c757d', fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.notes || '—'}
                        </td>
                        {(canEdit || canDelete) && (
                          <td style={styles.td(isDark)}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              {canEdit   && <button style={styles.btnEditSm} onClick={() => openEdit(r)} title="Edit Purchase">✏️</button>}
                              {canDelete && <button style={styles.btnDelSm}  onClick={() => setDelTarget(r)} title="Delete Purchase">🗑️</button>}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PurchasePagination
                page={page}
                pageSize={pageSize}
                total={filtered.length}
                onPage={setPage}
                onPageSize={setPageSize}
                isDark={isDark}
              />
            </div>
          )}
        </>
      )}

      {/* ── Add / Edit Purchase Modal ── */}
      {showForm && (
        <div style={styles.overlay} onClick={() => setShowForm(false)}>
          <div style={styles.modal(isDark)} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>
                {editing ? '✏️ Edit Purchase Record' : '🛍️ Add New Bag Purchase'}
              </span>
              <button onClick={() => setShowForm(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={styles.formGrid}>
                <div>
                  <label style={styles.label(isDark)}>Bag Number *</label>
                  <input
                    style={styles.input(isDark)} placeholder="e.g. 200, 8177"
                    value={form.bagNumber} onChange={e => { setF('bagNumber', e.target.value); setError(''); }}
                  />
                </div>
                <div>
                  <label style={styles.label(isDark)}>Quantity (Bags) *</label>
                  <input
                    style={styles.input(isDark)} type="number" min={1}
                    value={form.quantity} onChange={e => { setF('quantity', e.target.value); setError(''); }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={styles.label(isDark)}>
                      Material *
                      <span style={{ fontSize: 11, fontWeight: 700, color: BT.primary, marginLeft: 6 }}>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !customMatMode;
                        setCustomMatMode(next);
                        if (!next) {
                          setCustomMatInput('');
                          setF('material', materials[0] || '');
                        } else {
                          setCustomMatInput(form.material || '');
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: BT.primary,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                    </button>
                  </div>
                  {customMatMode ? (
                    <input
                      style={styles.input(isDark)}
                      placeholder="Type custom material name…"
                      value={customMatInput}
                      onChange={e => {
                        setCustomMatInput(e.target.value);
                        setF('material', e.target.value);
                        setError('');
                      }}
                      autoFocus
                    />
                  ) : (
                    <select
                      style={styles.select(isDark)}
                      value={form.material}
                      onFocus={refreshConfigs}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setCustomMatMode(true);
                          setCustomMatInput('');
                          setF('material', '');
                        } else {
                          setF('material', e.target.value);
                        }
                        setError('');
                      }}
                    >
                      <option value="">— Select Material —</option>
                        {materials.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      {availableMaterials.filter(m => !materials.includes(m)).length > 0 && (
                        <optgroup label="Other Existing Materials">
                          {availableMaterials.filter(m => !materials.includes(m)).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={styles.label(isDark)}>
                      Bag Type *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !customBagMode;
                        setCustomBagMode(next);
                        if (!next) {
                          setCustomBagInput('');
                          setF('bagType', bagTypes[0] || '');
                        } else {
                          setCustomBagInput(form.bagType || '');
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#20c997',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                    </button>
                  </div>
                  {customBagMode ? (
                    <input
                      style={styles.input(isDark)}
                      placeholder="Type custom bag type…"
                      value={customBagInput}
                      onChange={e => {
                        setCustomBagInput(e.target.value);
                        setF('bagType', e.target.value);
                        setError('');
                      }}
                      autoFocus
                    />
                  ) : (
                    <select
                      style={styles.select(isDark)}
                      value={form.bagType}
                      onFocus={refreshConfigs}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setCustomBagMode(true);
                          setCustomBagInput('');
                          setF('bagType', '');
                        } else {
                          setF('bagType', e.target.value);
                        }
                        setError('');
                      }}
                    >
                      <option value="">— Select Bag —</option>
                        {bagTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      {availableBagTypes.filter(t => !bagTypes.includes(t)).length > 0 && (
                        <optgroup label="Other Existing Bag Types">
                          {availableBagTypes.filter(t => !bagTypes.includes(t)).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}
                </div>
                <div>
                  <label style={styles.label(isDark)}>Purchase Date</label>
                  <input
                    style={styles.input(isDark)} type="date" value={form.purchaseDate}
                    onChange={e => setF('purchaseDate', e.target.value)}
                  />
                </div>
                <div>
                  <label style={styles.label(isDark)}>Unit Price (PKR / bag)</label>
                  <input
                    style={styles.input(isDark)} type="number" min={0} step="0.01" placeholder="Optional"
                    value={form.unitPrice} onChange={e => setF('unitPrice', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={styles.label(isDark)}>Supplier</label>
                <select
                  style={styles.select(isDark)} value={form.supplierId}
                  onChange={e => setF('supplierId', e.target.value)}
                >
                  <option value="">— No Supplier / Direct —</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}{sup.phone ? ` (${sup.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label(isDark)}>Notes / Remarks</label>
                <textarea
                  style={{ ...styles.input(isDark), resize: 'vertical', minHeight: 64 }}
                  value={form.notes} onChange={e => setF('notes', e.target.value)}
                  placeholder="Gate pass, invoice number, inspection notes…"
                />
              </div>

              {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button style={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
                <button style={styles.btnSuccess} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update Purchase' : 'Save Purchase'}
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
                ⚠️ Delete Purchase Entry?
              </span>
              <button onClick={() => setDelTarget(null)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ color: isDark ? 'var(--text-main)' : '#212529', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                Are you sure you want to delete bag <strong>#{delTarget.bagNumber}</strong> ({delTarget.material} · {delTarget.bagType} · {delTarget.quantity} bags)?
              </p>
              <div style={styles.warningBox}>⚠️ This action cannot be undone.</div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button style={styles.btnSecondary} onClick={() => setDelTarget(null)}>Cancel</button>
                <button style={styles.btnDanger} onClick={handleDelete}>Delete Entry</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// SUPPLIERS TAB
// ─────────────────────────────────────────────
function SuppliersTab({ isDark }) {
  const { can } = useAuth();
  const canAdd    = can('canAddSettings');
  const canEdit   = can('canEditSettings');
  const canDelete = can('canDeleteSettings');

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(emptySupplierForm());
  const [saving, setSaving]       = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [error, setError]         = useState('');
  const [delError, setDelError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setSuppliers(await getSuppliers()); } catch { setSuppliers([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setForm(emptySupplierForm()); setEditing(null); setError(''); setShowForm(true); };
  const openEdit = r => {
    setForm({ name: r.name, phone: r.phone || '', address: r.address || '', notes: r.notes || '' });
    setEditing(r); setError(''); setShowForm(true);
  };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Supplier name is required'); return; }
    setSaving(true); setError('');
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      editing ? await updateSupplier(editing.id, payload) : await createSupplier(payload);
      setShowForm(false); await load();
    } catch { setError('Failed to save supplier. Please try again.'); }
    setSaving(false);
  };

  const handleToggle = async (id) => {
    try { await toggleSupplierStatus(id); await load(); } catch {}
  };

  const handleDelete = async () => {
    setDelError('');
    try {
      await deleteSupplier(delTarget.id);
      setDelTarget(null); await load();
    } catch (e) {
      setDelError(e.response?.data || 'Cannot delete supplier with existing purchase records.');
    }
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.address || '').toLowerCase().includes(search.toLowerCase())
  );

  const active   = filtered.filter(s => s.isActive);
  const inactive = filtered.filter(s => !s.isActive);

  return (
    <>
      {/* ── 3 Supplier KPI Cards ── */}
      <div style={styles.kpiGrid}>
        <BtKpiCard
          label="Total Suppliers"
          tag="SUPPLY NETWORK"
          value={suppliers.length}
          gradient="linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)"
          glow="rgba(13, 110, 253, 0.35)"
          icon="🏭"
          sub="Registered vendor profiles"
        />
        <BtKpiCard
          label="Active Vendors"
          tag="ACTIVE CONTRACTS"
          value={suppliers.filter(s => s.isActive).length}
          gradient="linear-gradient(135deg, #146c43 0%, #198754 100%)"
          glow="rgba(25, 135, 84, 0.35)"
          icon="✅"
          sub="Eligible for new procurement"
        />
        <BtKpiCard
          label="Inactive / Paused"
          tag="SUSPENDED"
          value={suppliers.filter(s => !s.isActive).length}
          gradient="linear-gradient(135deg, #b02a37 0%, #dc3545 100%)"
          glow="rgba(220, 53, 69, 0.35)"
          icon="⏸️"
          sub="Deactivated vendor accounts"
        />
      </div>

      {/* ── Toolbar ── */}
      <div style={styles.toolbar(isDark)}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 13 }}>🔍</span>
          <input
            style={{ ...styles.input(isDark), paddingLeft: 34 }}
            placeholder="Search suppliers by name, phone, city…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={styles.headerSubBadge(isDark)}>{filtered.length} suppliers</span>
          {canAdd && (
            <button style={styles.addBtn} onClick={openAdd}>
              <span>+</span> Add Supplier
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingBox(isDark)}>
          <div style={styles.spinner} />
          <div style={{ marginTop: 14, fontWeight: 600 }}>Loading suppliers…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyCardBox(isDark)}>
          No supplier records found matching your search.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {active.length > 0 && (
            <div>
              <div style={styles.groupLabel(isDark)}>Active Suppliers ({active.length})</div>
              <div style={styles.supplierGrid}>
                {active.map(sup => (
                  <SupplierCard
                    key={sup.id}
                    supplier={sup}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={openEdit}
                    onToggle={handleToggle}
                    onDelete={r => { setDelTarget(r); setDelError(''); }}
                    isDark={isDark}
                  />
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <div style={styles.groupLabel(isDark)}>Inactive Suppliers ({inactive.length})</div>
              <div style={styles.supplierGrid}>
                {inactive.map(sup => (
                  <SupplierCard
                    key={sup.id}
                    supplier={sup}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={openEdit}
                    onToggle={handleToggle}
                    onDelete={r => { setDelTarget(r); setDelError(''); }}
                    isDark={isDark}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Supplier Modal ── */}
      {showForm && (
        <div style={styles.overlay} onClick={() => setShowForm(false)}>
          <div style={styles.modal(isDark)} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>
                {editing ? '✏️ Edit Supplier Record' : '🏭 Add New Supplier'}
              </span>
              <button onClick={() => setShowForm(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={styles.label(isDark)}>Supplier / Mill Name *</label>
                <input
                  style={styles.input(isDark)} placeholder="e.g. Habib Hosiery Mills"
                  value={form.name} onChange={e => { setF('name', e.target.value); setError(''); }} autoFocus
                />
              </div>
              <div>
                <label style={styles.label(isDark)}>Phone Number</label>
                <input
                  style={styles.input(isDark)} placeholder="e.g. 0300-1234567"
                  value={form.phone} onChange={e => setF('phone', e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label(isDark)}>Address / Location</label>
                <input
                  style={styles.input(isDark)} placeholder="City / industrial area"
                  value={form.address} onChange={e => setF('address', e.target.value)}
                />
              </div>
              <div>
                <label style={styles.label(isDark)}>Notes</label>
                <textarea
                  style={{ ...styles.input(isDark), resize: 'vertical', minHeight: 64 }}
                  value={form.notes} onChange={e => setF('notes', e.target.value)}
                  placeholder="Payment terms, contact person, credit period…"
                />
              </div>

              {error && <div style={styles.errorAlert}>⚠️ {error}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button style={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
                <button style={styles.btnSuccess} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Supplier Modal ── */}
      {delTarget && (
        <div style={styles.overlay} onClick={() => setDelTarget(null)}>
          <div style={{ ...styles.modal(isDark), maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <span style={{ fontSize: 16, fontWeight: 800, color: BT.danger }}>
                ⚠️ Delete Supplier?
              </span>
              <button onClick={() => setDelTarget(null)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ color: isDark ? 'var(--text-main)' : '#212529', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                Delete supplier <strong>{delTarget.name}</strong>?
              </p>
              {delError ? (
                <div style={styles.errorAlert}>⚠️ {delError}</div>
              ) : (
                <div style={styles.warningBox}>
                  Note: A supplier cannot be deleted if there are existing purchase records attached.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button style={styles.btnSecondary} onClick={() => setDelTarget(null)}>Cancel</button>
                <button style={styles.btnDanger} onClick={handleDelete}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Supplier Card Component ──
function SupplierCard({ supplier: sup, canEdit, canDelete, onEdit, onToggle, onDelete, isDark }) {
  return (
    <div style={styles.supplierCard(isDark, sup.isActive)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={styles.supplierAvatar(sup.isActive)}>
            {sup.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <strong style={{ fontSize: 15, color: isDark ? '#fff' : '#212529' }}>{sup.name}</strong>
            {sup.phone && <div style={{ fontSize: 12, color: BT.primary, marginTop: 2 }}>📞 {sup.phone}</div>}
          </div>
        </div>
        <span style={styles.statusBadge(sup.isActive)}>
          {sup.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {sup.address && (
        <div style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#495057', marginTop: 4 }}>
          📍 {sup.address}
        </div>
      )}

      {sup.notes && (
        <div style={styles.cardNotes(isDark)}>
          {sup.notes}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, pt: 6, borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}` }}>
        <button
          onClick={() => onToggle(sup.id)}
          style={sup.isActive ? styles.btnWarnSm : styles.btnSuccessSm}
        >
          {sup.isActive ? '⏸️ Deactivate' : '▶️ Activate'}
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          {canEdit && <button style={styles.btnEditSm} onClick={() => onEdit(sup)}>Edit</button>}
          {canDelete && <button style={styles.btnDelSm} onClick={() => onDelete(sup)}>Del</button>}
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
function PurchasePagination({ page, pageSize, total, onPage, onPageSize, isDark }) {
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
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>Showing <strong style={{ color: isDark ? '#fff' : '#212529' }}>{from}–{to}</strong> of <strong style={{ color: isDark ? '#fff' : '#212529' }}>{total}</strong> records</span>
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
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 12,
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
    transition: 'background 0.1s ease',
  }),

  td: (isDark) => ({
    padding: '11px 14px',
    color: isDark ? 'var(--text-main)' : '#212529',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  }),

  matBadge: {
    display: 'inline-block',
    color: '#ffffff',
    borderRadius: 20,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 700,
  },

  typePill: {
    background: '#e0f2fe',
    color: '#0369a1',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
  },

  bagNumBadge: {
    display: 'inline-block',
    border: '1.5px solid',
    borderRadius: 6,
    padding: '2px 8px',
    fontWeight: 800,
    fontSize: 12,
  },

  supplierChip: {
    background: '#f0f9ff',
    color: '#0369a1',
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid #bae6fd',
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

  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
  },

  matCard: (isDark, accentColor) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    borderTop: `4px solid ${accentColor}`,
    borderRadius: 14,
    padding: '16px 18px',
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
  }),

  bagRow: (isDark) => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    borderRadius: 8,
    padding: '8px 12px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e9ecef'}`,
  }),

  supplierGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: 16,
  },

  supplierCard: (isDark, isActive) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    padding: '18px 20px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    opacity: isActive ? 1 : 0.72,
  }),

  supplierAvatar: (isActive) => ({
    width: 40,
    height: 40,
    borderRadius: 10,
    background: isActive
      ? 'linear-gradient(135deg, #0d6efd 0%, #0dcaf0 100%)'
      : 'linear-gradient(135deg, #6c757d 0%, #adb5bd 100%)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
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

  cardNotes: (isDark) => ({
    fontSize: 12,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    fontStyle: 'italic',
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    borderRadius: 8,
    padding: '6px 10px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e9ecef'}`,
  }),

  btnWarnSm: {
    background: '#fff3cd',
    color: '#664d03',
    border: '1px solid #ffecb5',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  btnSuccessSm: {
    background: '#d1e7dd',
    color: '#0f5132',
    border: '1px solid #badbcc',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  btnSecondarySm: {
    background: 'transparent',
    color: BT.primary,
    border: `1px solid ${BT.primary}`,
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },

  groupLabel: (isDark) => ({
    fontSize: 12,
    fontWeight: 800,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 10,
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
    maxWidth: 540,
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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

  warningBox: {
    background: '#fff3cd',
    border: '1px solid #ffecb5',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 12,
    color: '#664d03',
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
