import { useState, useEffect } from 'react';

const TABS = [
  { key:'sizes',    label:'📐 Sizes',       color:'#2E75B6', endpoint:'/sizes',    field:'name',      placeholder:'e.g. Mama' },
  { key:'colors',   label:'🎨 Colors',      color:'#70AD47', endpoint:'/colors',   field:'name',      placeholder:'e.g. Red' },
  { key:'lots',     label:'📦 Lot Numbers', color:'#C55A11', endpoint:'/lots',     field:'lotNumber', placeholder:'e.g. LOT-001' },
  { key:'machines', label:'⚙️ Machines',    color:'#7030A0', endpoint:'/machines', field:'name',      placeholder:'e.g. G9-1' },
];

const COLOR_MAP = {
  Red:'#e74c3c', Gray:'#95a5a6', Falsa:'#9b59b6', Black:'#2c3e50',
  White:'#bdc3c7', Blue:'#3498db', Green:'#2ecc71', Yellow:'#f1c40f',
  Orange:'#e67e22', Pink:'#FF69B4', Brown:'#8B4513', Purple:'#8e44ad',
};

const apiFetch = async (method, endpoint, body) => {
  const res = await fetch('/api' + endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export default function MasterData() {
  const [tab, setTab]     = useState('sizes');
  const [data, setData]   = useState({ sizes:[], colors:[], lots:[], machines:[] });
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch] = useState('');

  const tabCfg = TABS.find(t => t.key === tab);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sizes, colors, lots, machines] = await Promise.all([
        apiFetch('GET', '/sizes'),
        apiFetch('GET', '/colors'),
        apiFetch('GET', '/lots'),
        apiFetch('GET', '/machines'),
      ]);
      setData({ sizes: sizes||[], colors: colors||[], lots: lots||[], machines: machines||[] });
      setError('');
    } catch {
      setError('Could not connect to backend. Showing sample data.');
      setData({
        sizes:    [{ id:1, name:'Mama' }, { id:2, name:'Short' }],
        colors:   [{ id:1, name:'Red' }, { id:2, name:'Gray' }, { id:3, name:'Falsa' }, { id:4, name:'Black' }],
        lots:     [{ id:1, lotNumber:'LOT-001' }, { id:2, lotNumber:'LOT-002' }],
        machines: [{ id:1, name:'G9-1' }, { id:2, name:'G9-2' }, { id:3, name:'G8' }],
      });
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const items = (data[tab] || []).filter(i => {
    const val = (i.name || i.lotNumber || '').toLowerCase();
    const sizeName = (i.sizeName || '').toLowerCase();
    const q = search.toLowerCase();
    return val.includes(q) || sizeName.includes(q);
  });

  const getLabel = (i) => i.name || i.lotNumber || '';
  const initForm = () => tab === 'lots' ? { lotNumber: '', sizeId: '' } : { [tabCfg.field]: '' };

  const handleSave = async () => {
    const val = form[tabCfg.field]?.trim();
    if (!val) return;
    setSaving(true);
    const body = tab === 'lots'
      ? { lotNumber: val, sizeId: form.sizeId ? Number(form.sizeId) : null }
      : { [tabCfg.field]: val };
    try {
      if (modal.type === 'add') {
        const created = await apiFetch('POST', tabCfg.endpoint, body);
        setData(d => ({ ...d, [tab]: [...d[tab], created] }));
      } else {
        const updated = await apiFetch('PUT', `${tabCfg.endpoint}/${form.id}`, body);
        setData(d => ({ ...d, [tab]: d[tab].map(i => i.id === form.id ? updated : i) }));
      }
      setModal(null);
    } catch {
      if (modal.type === 'add') {
        const sizeName = tab === 'lots' ? data.sizes.find(s => s.id === Number(form.sizeId))?.name : undefined;
        setData(d => ({ ...d, [tab]: [...d[tab], { id: Date.now(), ...body, sizeName }] }));
      } else {
        setData(d => ({ ...d, [tab]: d[tab].map(i => i.id === form.id ? { ...i, ...body } : i) }));
      }
      setModal(null);
    }
    setSaving(false);
  };

  const handleDelete = async (item) => {
    try {
      await apiFetch('DELETE', `${tabCfg.endpoint}/${item.id}`);
    } catch {}
    setData(d => ({ ...d, [tab]: d[tab].filter(i => i.id !== item.id) }));
    setDeleteConfirm(null);
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.headerLabel}>Configuration</div>
          <div style={s.headerTitle}>Master Data Management</div>
        </div>
        <button style={{ ...s.addBtn, background: tabCfg.color }}
          onClick={() => { setForm(initForm()); setModal({ type:'add' }); }}>
          + Add {tabCfg.label.split(' ').slice(1).join(' ')}
        </button>
      </div>

      {error && (
        <div style={s.errorBar}>⚠️ {error}
          <button onClick={() => setError('')} style={s.errClose}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabRow}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }}
            style={{ ...s.tabBtn, ...(tab === t.key ? { color: t.color, borderBottom: `3px solid ${t.color}`, fontWeight:600 } : {}) }}>
            {t.label}
            <span style={{ ...s.badge, background: tab === t.key ? t.color : '#e8ecf0', color: tab === t.key ? '#fff' : '#666' }}>
              {data[t.key]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      <div style={s.body}>
        {/* Toolbar */}
        <div style={s.toolbar}>
          <input style={s.search} value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`🔍  Search ${tabCfg.label.split(' ').slice(1).join(' ').toLowerCase()}...`} />
          <div style={s.countBadge}>Total: <b>{items.length}</b></div>
        </div>

        {loading ? (
          <div style={s.loading}>⏳ Loading data...</div>
        ) : (
          <div style={s.grid}>
            {items.length === 0 && (
              <div style={s.empty}>No records found. Click "+ Add" to create one.</div>
            )}
            {items.map((item, idx) => (
              <div key={item.id} style={{ ...s.card, borderLeft: `4px solid ${tabCfg.color}` }}>
                {/* Icon / Visual */}
                <div style={{ ...s.icon, background: tabCfg.color + '18', color: tabCfg.color }}>
                  {tab === 'colors'
                    ? <div style={{ width:28, height:28, borderRadius:'50%', background: COLOR_MAP[item.name] || '#ccc', border:'2px solid #ddd' }} />
                    : tab === 'sizes'   ? item.name?.charAt(0)
                    : tab === 'lots'    ? `#${String(idx+1).padStart(2,'0')}`
                    : '⚙️'
                  }
                </div>
                {/* Info */}
                <div style={s.cardInfo}>
                  <div style={s.cardName}>{getLabel(item)}</div>
                  <div style={s.cardMeta}>
                    {tab === 'lots' && item.sizeName ? `Size: ${item.sizeName} · ` : ''}
                    ID: {item.id}
                  </div>
                </div>
                {/* Actions */}
                <div style={s.cardBtns}>
                  <button style={s.editBtn} title="Edit"
                    onClick={() => { setForm({ ...item }); setModal({ type:'edit' }); }}>✏️</button>
                  <button style={s.delBtn} title="Delete"
                    onClick={() => setDeleteConfirm(item)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ ...s.modalHeader, background: tabCfg.color }}>
              <span style={s.modalTitle}>
                {modal.type === 'add' ? '+ Add' : '✏️ Edit'} {tabCfg.label.split(' ').slice(1).join(' ')}
              </span>
              <button style={s.closeBtn} onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <label style={s.label}>
                {tabCfg.field === 'lotNumber' ? 'Lot Number' : 'Name'} *
              </label>
              <input style={s.input} autoFocus
                placeholder={tabCfg.placeholder}
                value={form[tabCfg.field] || ''}
                onChange={e => setForm({ ...form, [tabCfg.field]: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
              {/* Size picker for lots */}
              {tab === 'lots' && (
                <div style={{ marginTop: 4 }}>
                  <label style={s.label}>Size</label>
                  <select style={{ ...s.input, marginTop: 4 }}
                    value={form.sizeId || ''}
                    onChange={e => setForm({ ...form, sizeId: e.target.value })}>
                    <option value="">-- No Size --</option>
                    {data.sizes.map(sz => <option key={sz.id} value={sz.id}>{sz.name}</option>)}
                  </select>
                </div>
              )}
              {/* Color swatches */}
              {tab === 'colors' && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>Common Colors (click to fill name):</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {Object.entries(COLOR_MAP).map(([name, hex]) => (
                      <div key={name} title={name}
                        onClick={() => setForm({ ...form, name })}
                        style={{ width:30, height:30, borderRadius:'50%', background:hex, cursor:'pointer', border: form.name===name ? '3px solid #333' : '2px solid #ddd', boxSizing:'border-box' }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
              <button style={{ ...s.saveBtn, background: tabCfg.color }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modal.type === 'add' ? 'Add' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth:400 }}>
            <div style={{ ...s.modalHeader, background:'#BE0000' }}>
              <span style={s.modalTitle}>Confirm Delete</span>
              <button style={s.closeBtn} onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div style={{ padding:'1.5rem', fontSize:15, color:'#444', lineHeight:1.6 }}>
              Delete <b>"{getLabel(deleteConfirm)}"</b>?
              <div style={{ marginTop:8, fontSize:13, color:'#BE0000' }}>
                ⚠️ This may affect existing records using this value.
              </div>
            </div>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={{ ...s.saveBtn, background:'#BE0000' }} onClick={() => handleDelete(deleteConfirm)}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page:        { fontFamily:"'Segoe UI',Arial,sans-serif", background:'#F4F6F9', minHeight:'100vh' },
  header:      { background:'#1e2a3b', padding:'1.2rem 2rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
  headerLabel: { color:'#7a9cc0', fontSize:12, letterSpacing:1, textTransform:'uppercase', marginBottom:2 },
  headerTitle: { color:'#fff', fontSize:'1.4rem', fontWeight:600 },
  addBtn:      { color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:600, cursor:'pointer' },
  errorBar:    { background:'#FBEAEA', color:'#BE0000', padding:'10px 2rem', display:'flex', justifyContent:'space-between', fontSize:13 },
  errClose:    { background:'none', border:'none', color:'#BE0000', cursor:'pointer', fontSize:16 },
  tabRow:      { background:'#fff', borderBottom:'2px solid #eef1f6', display:'flex', padding:'0 2rem' },
  tabBtn:      { padding:'14px 18px', border:'none', borderBottom:'3px solid transparent', background:'none', cursor:'pointer', fontSize:13, color:'#777', marginBottom:-2, display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap' },
  badge:       { borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:700 },
  body:        { padding:'1.5rem 2rem' },
  toolbar:     { display:'flex', alignItems:'center', gap:12, marginBottom:20 },
  search:      { flex:1, padding:'10px 16px', borderRadius:8, border:'1px solid #dde3ec', fontSize:14, outline:'none', background:'#fff' },
  countBadge:  { background:'#fff', border:'1px solid #dde3ec', borderRadius:8, padding:'8px 16px', fontSize:13, color:'#555' },
  loading:     { textAlign:'center', padding:'3rem', color:'#888', fontSize:16 },
  empty:       { gridColumn:'1/-1', textAlign:'center', padding:'3rem', color:'#aaa', fontSize:15 },
  grid:        { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14 },
  card:        { background:'#fff', borderRadius:10, padding:'14px 16px', display:'flex', alignItems:'center', gap:14, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', border:'1px solid #eef1f6' },
  icon:        { width:44, height:44, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, flexShrink:0 },
  cardInfo:    { flex:1, overflow:'hidden' },
  cardName:    { fontWeight:600, fontSize:14, color:'#1e2a3b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  cardMeta:    { fontSize:11, color:'#bbb', marginTop:2 },
  cardBtns:    { display:'flex', gap:6, flexShrink:0 },
  editBtn:     { background:'#EBF3FB', border:'none', borderRadius:6, padding:'6px 9px', cursor:'pointer', fontSize:14 },
  delBtn:      { background:'#FBEAEA', border:'none', borderRadius:6, padding:'6px 9px', cursor:'pointer', fontSize:14 },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal:       { background:'#fff', borderRadius:12, width:'90%', maxWidth:460, boxShadow:'0 8px 40px rgba(0,0,0,0.18)' },
  modalHeader: { borderRadius:'12px 12px 0 0', padding:'1rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
  modalTitle:  { color:'#fff', fontWeight:600, fontSize:16 },
  closeBtn:    { background:'none', border:'none', color:'#fff', fontSize:18, cursor:'pointer' },
  modalBody:   { padding:'1.5rem', display:'flex', flexDirection:'column', gap:8 },
  label:       { fontSize:12, fontWeight:600, color:'#555' },
  input:       { padding:'11px 14px', borderRadius:8, border:'1px solid #cdd5e0', fontSize:14, outline:'none' },
  modalFooter: { padding:'1rem 1.5rem', borderTop:'1px solid #eee', display:'flex', justifyContent:'flex-end', gap:10 },
  cancelBtn:   { background:'#f0f2f5', color:'#555', border:'none', borderRadius:6, padding:'9px 20px', cursor:'pointer', fontSize:14 },
  saveBtn:     { color:'#fff', border:'none', borderRadius:6, padding:'9px 22px', cursor:'pointer', fontSize:14, fontWeight:600 },
};
