import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getPurchases, getPurchaseSummary, createPurchase, updatePurchase, deletePurchase,
  getSuppliers, createSupplier, updateSupplier, toggleSupplierStatus, deleteSupplier,
} from '../services/api';

const MATERIALS = ['Mink', 'Mink Bo', 'Cotton', 'Polister', 'Fleece', 'Khaddar', 'Lawn', 'Other'];
const BAG_TYPES = ['Boray', 'Diby', 'Bobay'];

const MATERIAL_COLORS = {
  'Mink': '#7c3aed', 'Mink Bo': '#a855f7', 'Cotton': '#0891b2',
  'Polister': '#0d9488', 'Fleece': '#059669', 'Khaddar': '#b45309',
  'Lawn': '#16a34a', 'Other': '#6b7280',
};

const today = () => new Date().toISOString().split('T')[0];
const fmt   = n => n != null ? `Rs ${Number(n).toLocaleString()}` : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const matColor = m => MATERIAL_COLORS[m] || '#6b7280';

const emptyPurchaseForm = () => ({
  bagNumber: '', material: '', bagType: '', quantity: '',
  purchaseDate: today(), unitPrice: '', supplierId: '', notes: '',
});

const emptySupplierForm = () => ({ name: '', phone: '', address: '', notes: '' });

// ─────────────────────────────────────────────
export default function PurchasingModule() {
  const [tab, setTab] = useState('purchases');

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>🛍️</div>
          <div>
            <div style={s.headerSub}>Supply Chain</div>
            <div style={s.headerTitle}>Purchase</div>
          </div>
        </div>
        <div style={s.tabSwitch}>
          {[['purchases','📦 Purchases'],['suppliers','🏭 Suppliers']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ ...s.switchBtn, ...(tab === k ? s.switchActive : {}) }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'purchases' ? <PurchasesTab /> : <SuppliersTab />}
    </div>
  );
}

// ─────────────────────────────────────────────
function PurchasesTab() {
  const { can } = useAuth();
  const canAdd    = can('canAddSettings');
  const canEdit   = can('canEditSettings');
  const canDelete = can('canDeleteSettings');

  const [records, setRecords]     = useState([]);
  const [summary, setSummary]     = useState(null);
  const [suppliers, setSuppliers] = useState([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, sm, sup] = await Promise.all([getPurchases(), getPurchaseSummary(), getSuppliers()]);
      setRecords(r); setSummary(sm); setSuppliers(sup.filter(s => s.isActive));
    } catch { setRecords([]); setSummary(null); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setForm(emptyPurchaseForm()); setEditing(null); setError(''); setShowForm(true); };
  const openEdit = r => {
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
    setEditing(r); setError(''); setShowForm(true);
  };

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.bagNumber.trim()) { setError('Bag Number is required'); return; }
    if (!form.material)         { setError('Material is required'); return; }
    if (!form.bagType)          { setError('Bag Type is required'); return; }
    if (!form.quantity || Number(form.quantity) < 1) { setError('Quantity must be ≥ 1'); return; }
    setSaving(true); setError('');
    const payload = {
      bagNumber:    form.bagNumber.trim(),
      material:     form.material,
      bagType:      form.bagType,
      quantity:     Number(form.quantity),
      purchaseDate: form.purchaseDate,
      unitPrice:    form.unitPrice ? Number(form.unitPrice) : null,
      supplierId:   form.supplierId ? Number(form.supplierId) : null,
      notes:        form.notes.trim() || null,
    };
    try {
      editing ? await updatePurchase(editing.id, payload) : await createPurchase(payload);
      setShowForm(false); await load();
    } catch { setError('Failed to save. Please try again.'); }
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
      {/* Stats */}
      <div style={s.statsRow}>
        <StatCard icon="📦" label="Total Bags"    value={stats.totalBags.toLocaleString()} color="#2E75B6"
          isActive={!hasFilters && view === 'table'}
          onClick={() => { clearFilters(); setView('table'); }} />
        <StatCard icon="🧾" label="Total Records" value={stats.totalRecords}               color="#10b981"
          isActive={!hasFilters && view === 'table'}
          onClick={() => { clearFilters(); setView('table'); }} />
        <StatCard icon="🎨" label="Materials"     value={stats.materials}                  color="#8b5cf6"
          isActive={view === 'overview'}
          onClick={() => setView('overview')} />
        <StatCard icon="💰" label="Total Value"   value={stats.totalValue > 0 ? fmt(stats.totalValue) : '—'} color="#f59e0b"
          isActive={!hasFilters && view === 'table'}
          onClick={() => { clearFilters(); setView('table'); }} />
      </div>

      {/* View toggle + add */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 2rem 1rem' }}>
        <div style={{ display:'flex', gap:8 }}>
          {[['table','📋 Table'],['overview','📊 Overview']].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ ...s.viewBtn, ...(view===v ? {background:'#1e2a3b',color:'#fff',borderColor:'#1e2a3b'} : {}) }}>
              {l}
            </button>
          ))}
        </div>
        {canAdd && <button style={s.addBtn} onClick={openAdd}>+ Add Purchase</button>}
      </div>

      {/* Overview */}
      {view === 'overview' && summary?.byMaterial?.length > 0 && (
        <div style={{ padding:'0 2rem 2rem' }}>
          <div style={s.overviewGrid}>
            {summary.byMaterial.map(mat => (
              <div key={mat.material} style={{ ...s.matCard, borderTop:`4px solid ${matColor(mat.material)}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div>
                    <span style={{ ...s.matBadge, background: matColor(mat.material) }}>{mat.material}</span>
                    <div style={s.matStats}>{mat.totalBags} bags · {mat.records} record{mat.records!==1?'s':''}</div>
                  </div>
                  <button style={s.filterPill}
                    onClick={() => { setMatFilter(mat.material); setView('table'); }}>Filter →</button>
                </div>
                <div style={s.bagList}>
                  {mat.bagNumbers.map((b,i) => (
                    <div key={i} style={s.bagRow}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ ...s.bagNumBadge, borderColor:matColor(mat.material), color:matColor(mat.material) }}>#{b.bagNumber}</span>
                        <span style={s.bagTypePill}>{b.bagType}</span>
                      </div>
                      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                        <span style={s.bagQty}>{b.quantity} bags</span>
                        <span style={s.bagDate}>{fmtDate(b.purchaseDate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {view === 'table' && (
        <div style={{ padding:'0 2rem 2rem' }}>
          <div style={s.filterBar}>
            <div style={s.searchWrap}>
              <span>🔍</span>
              <input style={s.searchInput} placeholder="Search bag #, material, supplier..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Pill active={!matFilter} onClick={() => setMatFilter('')} color="#374151">All Materials</Pill>
              {(summary?.byMaterial||[]).map(m => (
                <Pill key={m.material} active={matFilter===m.material}
                  onClick={() => setMatFilter(matFilter===m.material?'':m.material)}
                  color={matColor(m.material)}>{m.material}</Pill>
              ))}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Pill active={!typFilter} onClick={() => setTypFilter('')} color="#374151">All Types</Pill>
              {BAG_TYPES.map(t => (
                <Pill key={t} active={typFilter===t} onClick={() => setTypFilter(typFilter===t?'':t)} color="#64748b">{t}</Pill>
              ))}
            </div>
            {suppliers.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <Pill active={!supFilter} onClick={() => setSupFilter('')} color="#374151">All Suppliers</Pill>
                {suppliers.map(sup => (
                  <Pill key={sup.id} active={supFilter===String(sup.id)}
                    onClick={() => setSupFilter(supFilter===String(sup.id)?'':String(sup.id))}
                    color="#0891b2">{sup.name}</Pill>
                ))}
              </div>
            )}
            <span style={s.recCount}>{filtered.length} record{filtered.length!==1?'s':''}</span>
          </div>

          {loading ? (
            <div style={s.center}>⏳ Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize:48 }}>🛍️</div>
              <div style={{ fontWeight:600, fontSize:16, color:'#374151', marginBottom:6 }}>No purchases found</div>
              {canAdd && <button style={s.addBtn} onClick={openAdd}>+ Add Purchase</button>}
            </div>
          ) : (
            <div style={s.card}>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['#','Bag #','Material','Type','Qty','Date','Unit Price','Total','Supplier','Notes',...(canEdit||canDelete?['Actions']:[])].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((r,i) => (
                      <tr key={r.id} style={s.tr}
                        onMouseEnter={e => e.currentTarget.style.background='#f8faff'}
                        onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                        <td style={{ ...s.td, color:'#9ca3af', textAlign:'center' }}>{(page-1)*pageSize + i + 1}</td>
                        <td style={s.td}>
                          <span style={{ ...s.bagNumBadge, borderColor:matColor(r.material), color:matColor(r.material), fontSize:13 }}>#{r.bagNumber}</span>
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.matBadge, background:matColor(r.material), fontSize:11 }}>{r.material}</span>
                        </td>
                        <td style={s.td}><span style={s.typePill}>{r.bagType}</span></td>
                        <td style={{ ...s.td, fontWeight:700 }}>{r.quantity}</td>
                        <td style={{ ...s.td, color:'#6b7280', fontSize:12 }}>{fmtDate(r.purchaseDate)}</td>
                        <td style={{ ...s.td, color:'#6b7280' }}>{r.unitPrice!=null ? fmt(r.unitPrice) : '—'}</td>
                        <td style={{ ...s.td, fontWeight:600, color:'#059669' }}>{r.totalAmount!=null ? fmt(r.totalAmount) : '—'}</td>
                        <td style={s.td}>
                          {r.supplierName
                            ? <span style={s.supplierChip}>{r.supplierName}</span>
                            : <span style={{ color:'#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ ...s.td, color:'#9ca3af', fontSize:12, maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.notes||'—'}</td>
                        {(canEdit || canDelete) && (
                          <td style={{ ...s.td, textAlign:'center' }}>
                            <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                              {canEdit   && <button style={s.editBtn} onClick={() => openEdit(r)}>✏️</button>}
                              {canDelete && <button style={s.delBtn}  onClick={() => setDelTarget(r)}>🗑️</button>}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page} pageSize={pageSize} total={filtered.length}
                onPage={setPage} onPageSize={setPageSize}
              />
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <Modal title={editing ? '✏️ Edit Purchase' : '🛍️ Add Purchase'} onClose={() => setShowForm(false)}
          gradient="linear-gradient(135deg,#f59e0b,#d97706)">
          <div style={s.formRow}>
            <Field label="Bag Number *">
              <input style={s.input} placeholder="e.g. 200, 8177"
                value={form.bagNumber} onChange={e => { setF('bagNumber',e.target.value); setError(''); }} />
            </Field>
            <Field label="Quantity *">
              <input style={s.input} type="number" min={1}
                value={form.quantity} onChange={e => { setF('quantity',e.target.value); setError(''); }} />
            </Field>
          </div>
          <div style={s.formRow}>
            <Field label="Material *">
              <select style={s.input} value={form.material} onChange={e => { setF('material',e.target.value); setError(''); }}>
                <option value="">— Select —</option>
                {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Bag Type *">
              <select style={s.input} value={form.bagType} onChange={e => { setF('bagType',e.target.value); setError(''); }}>
                <option value="">— Select —</option>
                {BAG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div style={s.formRow}>
            <Field label="Purchase Date">
              <input style={s.input} type="date" value={form.purchaseDate}
                onChange={e => setF('purchaseDate',e.target.value)} />
            </Field>
            <Field label="Unit Price (Rs)">
              <input style={s.input} type="number" min={0} step="0.01" placeholder="Optional"
                value={form.unitPrice} onChange={e => setF('unitPrice',e.target.value)} />
            </Field>
          </div>
          <Field label="Supplier">
            <select style={s.input} value={form.supplierId} onChange={e => setF('supplierId',e.target.value)}>
              <option value="">— No Supplier —</option>
              {suppliers.map(sup => (
                <option key={sup.id} value={sup.id}>{sup.name}{sup.phone ? ` (${sup.phone})` : ''}</option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
                No active suppliers. Add one in the Suppliers tab first.
              </div>
            )}
          </Field>
          <Field label="Notes">
            <textarea style={{ ...s.input, resize:'vertical', minHeight:64 }}
              value={form.notes} onChange={e => setF('notes',e.target.value)} />
          </Field>
          {error && <div style={s.errorBox}>⚠️ {error}</div>}
          <div style={s.modalFooter}>
            <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Saving...' : editing ? '✔ Update' : '✔ Save'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <Modal title="⚠️ Confirm Delete" onClose={() => setDelTarget(null)}
          gradient="linear-gradient(135deg,#ef4444,#dc2626)">
          <div style={{ padding:'0.5rem 0' }}>
            <p style={{ color:'#374151', fontSize:15 }}>
              Delete bag <b>#{delTarget.bagNumber}</b> ({delTarget.material} · {delTarget.bagType} · {delTarget.quantity} bags)?
            </p>
            <div style={s.warnBox}>⚠️ This action cannot be undone.</div>
          </div>
          <div style={s.modalFooter}>
            <button style={s.cancelBtn} onClick={() => setDelTarget(null)}>Cancel</button>
            <button style={{ ...s.saveBtn, background:'linear-gradient(135deg,#ef4444,#dc2626)' }} onClick={handleDelete}>
              🗑️ Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
function SuppliersTab() {
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
  const openEdit = r => { setForm({ name:r.name, phone:r.phone||'', address:r.address||'', notes:r.notes||'' }); setEditing(r); setError(''); setShowForm(true); };
  const setF     = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Supplier name is required'); return; }
    setSaving(true); setError('');
    const payload = { name: form.name.trim(), phone: form.phone.trim()||null, address: form.address.trim()||null, notes: form.notes.trim()||null };
    try {
      editing ? await updateSupplier(editing.id, payload) : await createSupplier(payload);
      setShowForm(false); await load();
    } catch { setError('Failed to save. Please try again.'); }
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
      setDelError(e.response?.data || 'Cannot delete supplier with existing purchases.');
    }
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone||'').toLowerCase().includes(search.toLowerCase()) ||
    (s.address||'').toLowerCase().includes(search.toLowerCase())
  );

  const active   = filtered.filter(s => s.isActive);
  const inactive = filtered.filter(s => !s.isActive);

  return (
    <div style={{ padding:'1.5rem 2rem' }}>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:12, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ ...s.searchWrap, flex:1, minWidth:220 }}>
          <span>🔍</span>
          <input style={s.searchInput} placeholder="Search suppliers..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={s.recCount}>{filtered.length} supplier{filtered.length!==1?'s':''}</div>
        {canAdd && <button style={s.addBtn} onClick={openAdd}>+ Add Supplier</button>}
      </div>

      {loading ? <div style={s.center}>⏳ Loading...</div> : (
        <>
          {/* Active */}
          {active.length > 0 && (
            <>
              <div style={s.groupLabel}>Active Suppliers ({active.length})</div>
              <div style={s.supplierGrid}>
                {active.map(sup => <SupplierCard key={sup.id} supplier={sup} canEdit={canEdit} canDelete={canDelete} onEdit={openEdit} onToggle={handleToggle} onDelete={r => { setDelTarget(r); setDelError(''); }} />)}
              </div>
            </>
          )}

          {/* Inactive */}
          {inactive.length > 0 && (
            <>
              <div style={{ ...s.groupLabel, marginTop:24 }}>Inactive Suppliers ({inactive.length})</div>
              <div style={s.supplierGrid}>
                {inactive.map(sup => <SupplierCard key={sup.id} supplier={sup} canEdit={canEdit} canDelete={canDelete} onEdit={openEdit} onToggle={handleToggle} onDelete={r => { setDelTarget(r); setDelError(''); }} />)}
              </div>
            </>
          )}

          {filtered.length === 0 && (
            <div style={s.empty}>
              <div style={{ fontSize:48 }}>🏭</div>
              <div style={{ fontWeight:600, fontSize:16, color:'#374151', marginBottom:6 }}>No suppliers yet</div>
              <div style={{ color:'#9ca3af', marginBottom:16 }}>Add your first supplier to link purchases</div>
              {canAdd && <button style={s.addBtn} onClick={openAdd}>+ Add Supplier</button>}
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <Modal title={editing ? '✏️ Edit Supplier' : '🏭 Add Supplier'} onClose={() => setShowForm(false)}
          gradient="linear-gradient(135deg,#0891b2,#0e7490)">
          <Field label="Supplier Name *">
            <input style={s.input} placeholder="e.g. Habib Hosiery"
              value={form.name} onChange={e => { setF('name',e.target.value); setError(''); }} autoFocus />
          </Field>
          <Field label="Phone Number">
            <input style={s.input} placeholder="e.g. 0300-1234567"
              value={form.phone} onChange={e => setF('phone',e.target.value)} />
          </Field>
          <Field label="Address">
            <input style={s.input} placeholder="City / area"
              value={form.address} onChange={e => setF('address',e.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea style={{ ...s.input, resize:'vertical', minHeight:64 }}
              value={form.notes} onChange={e => setF('notes',e.target.value)} />
          </Field>
          {error && <div style={s.errorBox}>⚠️ {error}</div>}
          <div style={s.modalFooter}>
            <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={{ ...s.saveBtn, background:'linear-gradient(135deg,#0891b2,#0e7490)' }}
              onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Saving...' : editing ? '✔ Update' : '✔ Save'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <Modal title="⚠️ Confirm Delete" onClose={() => setDelTarget(null)}
          gradient="linear-gradient(135deg,#ef4444,#dc2626)">
          <p style={{ color:'#374151', fontSize:15 }}>
            Delete supplier <b>"{delTarget.name}"</b>?
          </p>
          {delTarget.purchaseCount > 0 && (
            <div style={s.warnBox}>
              ⚠️ This supplier has {delTarget.purchaseCount} purchase record{delTarget.purchaseCount!==1?'s':''}.
              You cannot delete it — deactivate instead.
            </div>
          )}
          {delError && <div style={s.errorBox}>⚠️ {delError}</div>}
          <div style={s.modalFooter}>
            <button style={s.cancelBtn} onClick={() => setDelTarget(null)}>Cancel</button>
            {delTarget.purchaseCount === 0 && (
              <button style={{ ...s.saveBtn, background:'linear-gradient(135deg,#ef4444,#dc2626)' }} onClick={handleDelete}>
                🗑️ Delete
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
function SupplierCard({ supplier, canEdit, canDelete, onEdit, onToggle, onDelete }) {
  return (
    <div style={{ ...s.supplierCard, opacity: supplier.isActive ? 1 : 0.6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:15, color:'#1e2a3b', display:'flex', alignItems:'center', gap:8 }}>
            {supplier.name}
            <span style={{ ...s.statusBadge, background: supplier.isActive ? '#dcfce7' : '#f1f5f9', color: supplier.isActive ? '#166534' : '#6b7280' }}>
              {supplier.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {supplier.phone && <div style={s.supplierMeta}>📞 {supplier.phone}</div>}
          {supplier.address && <div style={s.supplierMeta}>📍 {supplier.address}</div>}
          {supplier.notes && <div style={{ ...s.supplierMeta, color:'#9ca3af', fontStyle:'italic', marginTop:4 }}>{supplier.notes}</div>}
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, paddingTop:10, borderTop:'1px solid #f1f5f9' }}>
        <span style={{ fontSize:12, color:'#6b7280' }}>
          {supplier.purchaseCount} purchase{supplier.purchaseCount!==1?'s':''}
        </span>
        {(canEdit || canDelete) && (
          <div style={{ display:'flex', gap:6 }}>
            {canEdit && <button style={s.editBtn} onClick={() => onEdit(supplier)} title="Edit">✏️</button>}
            {canEdit && (
              <button style={{ ...s.editBtn, background:'#f0fdf4' }} onClick={() => onToggle(supplier.id)}
                title={supplier.isActive ? 'Deactivate' : 'Activate'}>
                {supplier.isActive ? '⏸️' : '▶️'}
              </button>
            )}
            {canDelete && <button style={s.delBtn} onClick={() => onDelete(supplier)} title="Delete">🗑️</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
function Modal({ title, onClose, gradient, children }) {
  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={{ background: gradient || '#1e2a3b', padding:'1.2rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'#fff', fontWeight:700, fontSize:16 }}>{title}</div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
function Pagination({ page, pageSize, total, onPage, onPageSize }) {
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
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderTop:'2px solid #f1f5f9', background:'#fafcff', flexWrap:'wrap', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#6b7280' }}>
        <span style={{ fontWeight:600 }}>Rows per page:</span>
        <select value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          style={{ border:'1.5px solid #e5e7eb', borderRadius:7, padding:'5px 10px', fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ color:'#9ca3af' }}>
          Showing <b style={{ color:'#374151' }}>{from}–{to}</b> of <b style={{ color:'#374151' }}>{total}</b> records
        </span>
      </div>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <PageBtn disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</PageBtn>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} style={{ padding:'4px 4px', color:'#9ca3af', fontSize:14, userSelect:'none' }}>…</span>
            : <PageBtn key={p} active={p === page} onClick={() => onPage(p)}>{p}</PageBtn>
        )}
        <PageBtn disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next ›</PageBtn>
      </div>
    </div>
  );
}

function PageBtn({ onClick, disabled, active, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:'5px 10px', borderRadius:7, border:'1.5px solid',
      borderColor: active ? '#2E75B6' : '#e5e7eb',
      background: active ? '#2E75B6' : disabled ? '#f9fafb' : '#fff',
      color: active ? '#fff' : disabled ? '#d1d5db' : '#374151',
      fontSize:13, fontWeight: active ? 700 : 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      minWidth:34, transition:'all .1s',
    }}>{children}</button>
  );
}

// ─────────────────────────────────────────────
function StatCard({ icon, label, value, color, onClick, isActive }) {
  return (
    <div onClick={onClick} style={{
      background: isActive ? color + '10' : '#fff',
      borderRadius: 14, padding: '1.2rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: isActive ? `0 4px 14px ${color}30` : '0 2px 8px rgba(0,0,0,0.06)',
      flex: 1, minWidth: 150,
      border: isActive ? `2px solid ${color}` : '2px solid transparent',
      cursor: onClick ? 'pointer' : 'default',
      transform: isActive ? 'translateY(-2px)' : 'none',
      transition: 'all .15s',
    }}>
      <div style={{ width:48, height:48, borderRadius:12, background:color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{icon}</div>
      <div>
        <div style={{ fontSize:'1.5rem', fontWeight:800, color, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:12, color: isActive ? color : '#6b7280', marginTop:3, fontWeight:500 }}>{label}</div>
      </div>
    </div>
  );
}

function Pill({ active, onClick, color, children }) {
  return (
    <button onClick={onClick} style={{
      padding:'4px 12px', borderRadius:20, border:`1px solid ${active ? color : '#e5e7eb'}`,
      background: active ? color : '#f8fafc', color: active ? '#fff' : '#6b7280',
      fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap',
    }}>{children}</button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
      <label style={{ fontSize:13, fontWeight:600, color:'#374151' }}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  page:         { fontFamily:"'Segoe UI',Arial,sans-serif", background:'#f1f5f9', minHeight:'100vh' },
  header:       { background:'linear-gradient(135deg,#1e2a3b 0%,#2d3f57 100%)', padding:'1.2rem 2rem', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 },
  headerLeft:   { display:'flex', alignItems:'center', gap:14 },
  headerIcon:   { fontSize:32, background:'rgba(255,255,255,0.1)', padding:'10px', borderRadius:12 },
  headerSub:    { color:'rgba(255,255,255,0.5)', fontSize:11, letterSpacing:1.5, textTransform:'uppercase', marginBottom:3 },
  headerTitle:  { color:'#fff', fontSize:'1.5rem', fontWeight:700 },
  tabSwitch:    { display:'flex', background:'rgba(255,255,255,0.1)', borderRadius:10, padding:4, gap:4 },
  switchBtn:    { padding:'8px 18px', border:'none', borderRadius:8, background:'transparent', color:'rgba(255,255,255,0.7)', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s' },
  switchActive: { background:'#fff', color:'#1e2a3b' },
  statsRow:     { display:'flex', gap:16, padding:'1.5rem 2rem 1rem', flexWrap:'wrap' },
  addBtn:       { background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(0,0,0,0.15)' },
  viewBtn:      { padding:'8px 16px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', color:'#6b7280', fontSize:13, fontWeight:600, cursor:'pointer' },
  filterBar:    { display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' },
  searchWrap:   { display:'flex', alignItems:'center', gap:8, background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:'0 14px', height:40, flex:1, minWidth:200 },
  searchInput:  { flex:1, border:'none', background:'none', outline:'none', fontSize:14, color:'#374151' },
  recCount:     { background:'#fff', color:'#6b7280', borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:600, border:'1px solid #e5e7eb', whiteSpace:'nowrap' },
  center:       { textAlign:'center', padding:'3rem', color:'#888' },
  empty:        { display:'flex', flexDirection:'column', alignItems:'center', padding:'4rem', textAlign:'center', gap:8 },
  card:         { background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.07)' },
  tableWrap:    { overflowX:'auto' },
  table:        { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:           { background:'#f8fafc', color:'#374151', padding:'11px 14px', textAlign:'left', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:0.5, borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap' },
  tr:           { background:'#fff', borderBottom:'1px solid #f8fafc', transition:'background .1s' },
  td:           { padding:'11px 14px', verticalAlign:'middle' },
  matBadge:     { display:'inline-block', color:'#fff', borderRadius:20, padding:'3px 10px', fontSize:12, fontWeight:700 },
  typePill:     { background:'#e0f2fe', color:'#0369a1', borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:600 },
  bagNumBadge:  { display:'inline-block', border:'1.5px solid', borderRadius:6, padding:'2px 8px', fontWeight:700, fontSize:12 },
  supplierChip: { background:'#f0f9ff', color:'#0369a1', borderRadius:6, padding:'3px 8px', fontSize:12, fontWeight:600, border:'1px solid #bae6fd' },
  editBtn:      { background:'#EBF3FB', border:'none', borderRadius:6, padding:'6px 9px', cursor:'pointer', fontSize:14 },
  delBtn:       { background:'#FBEAEA', border:'none', borderRadius:6, padding:'6px 9px', cursor:'pointer', fontSize:14 },
  overviewGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 },
  matCard:      { background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'1.2rem', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' },
  matStats:     { color:'#6b7280', fontSize:12, marginTop:5 },
  filterPill:   { background:'none', border:'1px solid #e5e7eb', borderRadius:8, padding:'4px 10px', fontSize:11, color:'#6b7280', cursor:'pointer' },
  bagList:      { display:'flex', flexDirection:'column', gap:8, marginTop:8 },
  bagRow:       { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fafafa', borderRadius:8, padding:'8px 12px', border:'1px solid #f1f5f9' },
  bagTypePill:  { background:'#f1f5f9', color:'#6b7280', borderRadius:4, padding:'2px 7px', fontSize:11, fontWeight:600 },
  bagQty:       { fontWeight:700, color:'#1e2a3b', fontSize:13 },
  bagDate:      { color:'#9ca3af', fontSize:11 },
  supplierGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 },
  supplierCard: { background:'#fff', borderRadius:12, padding:'1.2rem', border:'1px solid #e5e7eb', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' },
  supplierMeta: { fontSize:13, color:'#6b7280', marginTop:4 },
  statusBadge:  { fontSize:10, fontWeight:700, borderRadius:4, padding:'2px 7px' },
  groupLabel:   { fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:1, marginBottom:10 },
  overlay:      { position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal:        { background:'#fff', borderRadius:16, width:'90%', maxWidth:520, boxShadow:'0 25px 50px rgba(0,0,0,0.25)', overflow:'hidden', maxHeight:'90vh', overflowY:'auto' },
  closeBtn:     { background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', fontSize:16, cursor:'pointer', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center' },
  formRow:      { display:'flex', gap:14 },
  input:        { padding:'10px 12px', borderRadius:8, border:'1.5px solid #e5e7eb', fontSize:14, outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' },
  errorBox:     { display:'flex', alignItems:'center', gap:8, background:'#fef2f2', color:'#dc2626', borderRadius:8, padding:'10px 14px', fontSize:13, border:'1px solid #fecaca' },
  warnBox:      { background:'#fef2f2', color:'#dc2626', borderRadius:8, padding:'10px 14px', fontSize:13, border:'1px solid #fecaca', marginTop:8 },
  modalFooter:  { display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 },
  cancelBtn:    { background:'#fff', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 20px', cursor:'pointer', fontSize:14, fontWeight:500 },
  saveBtn:      { background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', border:'none', borderRadius:8, padding:'10px 24px', cursor:'pointer', fontSize:14, fontWeight:600 },
};
