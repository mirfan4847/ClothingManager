import { useState, useEffect, useMemo } from 'react';
import { deleteEntry } from '../services/api';
import EntryForm from './EntryForm';

export default function WorkerTable({ workerId, columns, entries, reload, dropdowns }) {
  const [editing, setEditing]       = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [collapsed, setCollapsed]   = useState({});
  const [lotSearch, setLotSearch]   = useState('');
  const [previewImg, setPreviewImg] = useState(null);
  const [lotPage,    setLotPage]    = useState(1);
  const [lotPageSize,setLotPageSize]= useState(10);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    await deleteEntry(id);
    reload();
  };

  const handleSaved = () => { setShowForm(false); setEditing(null); reload(); };

  const toggleLot = (lot) => setCollapsed(c => ({ ...c, [lot]: !c[lot] }));

  // Group entries by lot number
  const grouped = entries.reduce((acc, row) => {
    const lot = row.lotNumber || 'No Lot';
    if (!acc[lot]) acc[lot] = [];
    acc[lot].push(row);
    return acc;
  }, {});

  // Filter groups by lot search
  const filteredLots = Object.keys(grouped).filter(lot =>
    lot.toLowerCase().includes(lotSearch.toLowerCase())
  );

  useEffect(() => { setLotPage(1); }, [lotSearch, lotPageSize]);
  const paginatedLots = useMemo(() => filteredLots.slice((lotPage - 1) * lotPageSize, lotPage * lotPageSize), [filteredLots, lotPage, lotPageSize]);

  // Summary for a lot group
  const lotSummary = (rows) => {
    const numCols = columns.filter(c => !['completed','dateCompleted','lotNumber','size','color','machine'].includes(c.key));
    return numCols.map(c => {
      const total = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
      return { key: c.key, label: c.label, total };
    }).filter(x => x.total > 0);
  };

  return (
    <div style={styles.page}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <input
            style={styles.search}
            placeholder="🔍  Search by lot number..."
            value={lotSearch}
            onChange={e => setLotSearch(e.target.value)}
          />
          <span style={styles.countBadge}>
            {filteredLots.length} lot{filteredLots.length !== 1 ? 's' : ''} · {entries.length} entries
          </span>
          <span style={{ fontSize:12, color:'#888' }}>
            Showing {filteredLots.length === 0 ? 0 : (lotPage - 1) * lotPageSize + 1}–{Math.min(lotPage * lotPageSize, filteredLots.length)} of {filteredLots.length}
          </span>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={styles.addBtn}>
          + Add Entry
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <EntryForm
          workerId={workerId}
          columns={columns}
          entry={editing}
          dropdowns={dropdowns}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Nested Grid */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 32 }}></th>
              {columns.map(c => <th key={c.key} style={styles.th}>{c.label}</th>)}
              <th style={styles.th}>Picture</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLots.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 3} style={styles.empty}>
                  {lotSearch ? `No lots matching "${lotSearch}"` : 'No entries yet'}
                </td>
              </tr>
            ) : (
              paginatedLots.map(lot => {
                const rows    = grouped[lot];
                const isOpen  = !collapsed[lot];
                const summary = lotSummary(rows);

                return [
                  /* ── Parent / Lot Row ── */
                  <tr key={`lot-${lot}`} style={styles.lotRow} onClick={() => toggleLot(lot)}>
                    <td style={styles.chevronCell}>
                      <span style={{ ...styles.chevron, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    </td>
                    <td colSpan={columns.length + 2} style={styles.lotCell}>
                      <div style={styles.lotHeader}>
                        <div style={styles.lotInfo}>
                          <span style={styles.lotBadge}>{lot}</span>
                          <span style={styles.lotMeta}>
                            {rows[0]?.size && <span style={styles.metaTag}>{rows[0].size}</span>}
                            {rows[0]?.lotMaterial && <span style={styles.metaTag}>{rows[0].lotMaterial}</span>}
                          </span>
                        </div>
                        <div style={styles.lotStats}>
                          {summary.map(s => (
                            <span key={s.key} style={styles.statPill}>
                              <span style={styles.statLabel}>{s.label}</span>
                              <strong style={styles.statVal}>{s.total}</strong>
                            </span>
                          ))}
                          <span style={styles.rowCount}>{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
                        </div>
                      </div>
                    </td>
                  </tr>,

                  /* ── Child / Entry Rows ── */
                  isOpen && rows.map((row, i) => (
                    <tr key={row.id} style={{ ...styles.childRow, background: i % 2 === 0 ? '#fff' : '#f9fbff' }}>
                      <td style={styles.childIndent}></td>
                      {columns.map(c => (
                        <td key={c.key} style={styles.td}>
                          {c.key === 'completed'
                            ? <span style={row[c.key] ? styles.yes : styles.no}>{row[c.key] ? '✓' : '✗'}</span>
                            : c.key === 'dateCompleted'
                            ? (row[c.key] ? new Date(row[c.key]).toLocaleDateString('en-PK') : '—')
                            : (row[c.key] ?? '—')}
                        </td>
                      ))}
                      <td style={styles.td}>
                        {row.lotPicturePath
                          ? <img src={row.lotPicturePath} alt="lot" style={{ ...styles.thumb, cursor: 'zoom-in' }}
                              onClick={() => setPreviewImg(row.lotPicturePath)} />
                          : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { setEditing(row); setShowForm(true); }} style={styles.editBtn}>Edit</button>
                          <button onClick={() => handleDelete(row.id)} style={styles.delBtn}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ];
              })
            )}
          </tbody>
        </table>
      </div>
      <WkrPagination page={lotPage} pageSize={lotPageSize} total={filteredLots.length} onPage={setLotPage} onPageSize={setLotPageSize} />

      {previewImg && (
        <div style={styles.imgOverlay} onClick={() => setPreviewImg(null)}>
          <div style={styles.imgPopup} onClick={e => e.stopPropagation()}>
            <button style={styles.imgClose} onClick={() => setPreviewImg(null)}>✕</button>
            <img src={previewImg} alt="preview" style={styles.imgFull} />
          </div>
        </div>
      )}
    </div>
  );
}

function WkrPagination({ page, pageSize, total, onPage, onPageSize }) {
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
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', marginTop:8, flexWrap:'wrap', justifyContent:'space-between', background:'#fff', borderRadius:10, border:'1px solid #e0e7ef' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:12, color:'#666' }}>Lots per page:</span>
        <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))} style={{ border:'1px solid #d0d8e4', borderRadius:5, padding:'3px 7px', fontSize:12 }}>
          {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize:12, color:'#666' }}>Showing {from}–{to} of {total}</span>
      </div>
      <div style={{ display:'flex', gap:4 }}>
        <WkrPageBtn onClick={() => onPage(page - 1)} disabled={page <= 1}>←</WkrPageBtn>
        {pages.map((p, i) => typeof p === 'number'
          ? <WkrPageBtn key={p} onClick={() => onPage(p)} active={p === page}>{p}</WkrPageBtn>
          : <span key={i} style={{ padding:'0 4px', color:'#aaa', lineHeight:'28px', fontSize:12 }}>…</span>)}
        <WkrPageBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages}>→</WkrPageBtn>
      </div>
    </div>
  );
}
function WkrPageBtn({ onClick, disabled, active, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ minWidth:28, height:28, border:`1px solid ${active ? '#2E75B6' : '#d0d8e4'}`, borderRadius:5, background: active ? '#2E75B6' : '#fff', color: active ? '#fff' : '#555', cursor: disabled ? 'default' : 'pointer', fontSize:12, fontWeight: active ? 700 : 400, opacity: disabled ? 0.4 : 1 }}>
      {children}
    </button>
  );
}

const styles = {
  page:       { padding: '1rem', fontFamily: 'Segoe UI, Arial, sans-serif' },
  toolbar:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' },
  toolbarLeft:{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' },
  search:     { padding: '8px 14px', borderRadius: 7, border: '1px solid #d0d8e8', fontSize: 13, minWidth: 220, outline: 'none', background: '#f8fafd' },
  countBadge: { fontSize: 12, color: '#888', background: '#f0f2f5', borderRadius: 20, padding: '4px 12px' },
  addBtn:     { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' },
  tableWrap:  { overflowX: 'auto', borderRadius: 10, border: '1px solid #e0e7ef', background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:         { background: '#1e2a3b', color: '#fff', padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap' },
  empty:      { textAlign: 'center', padding: '3rem', color: '#aaa', fontSize: 14 },

  // Parent lot row
  lotRow:     { background: '#EBF3FB', cursor: 'pointer', borderBottom: '1px solid #c8ddf0', userSelect: 'none' },
  chevronCell:{ padding: '10px 8px 10px 14px', width: 32 },
  chevron:    { display: 'inline-block', fontSize: 10, color: '#2E75B6', transition: 'transform 0.2s', fontWeight: 700 },
  lotCell:    { padding: '10px 14px 10px 4px' },
  lotHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  lotInfo:    { display: 'flex', alignItems: 'center', gap: 8 },
  lotBadge:   { background: '#2E75B6', color: '#fff', borderRadius: 5, padding: '3px 10px', fontWeight: 700, fontSize: 13, letterSpacing: 0.3 },
  lotMeta:    { display: 'flex', gap: 6 },
  metaTag:    { background: '#d0e8f8', color: '#1a5a8a', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 },
  lotStats:   { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statPill:   { background: '#fff', border: '1px solid #c8ddf0', borderRadius: 20, padding: '2px 10px', fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' },
  statLabel:  { color: '#888' },
  statVal:    { color: '#2E75B6' },
  rowCount:   { fontSize: 12, color: '#666', background: '#e0ecf8', borderRadius: 20, padding: '2px 10px' },

  // Child rows
  childRow:   { borderBottom: '1px solid #eef1f6' },
  childIndent:{ width: 32, background: '#f0f6fc', borderRight: '3px solid #2E75B6' },
  td:         { padding: '8px 12px', verticalAlign: 'middle', color: '#333' },
  yes:        { background: '#EEF6E6', color: '#4a8a1e', borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: 12 },
  no:         { background: '#f5f5f5', color: '#aaa', borderRadius: 4, padding: '2px 8px', fontSize: 12 },
  thumb:      { width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' },
  lotThumb:   { width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '2px solid #2E75B6', flexShrink: 0 },
  uploadLabel:{ cursor: 'pointer', color: '#2E75B6', fontSize: 12, textDecoration: 'underline' },
  editBtn:    { background: '#70AD47', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  delBtn:     { background: '#BE0000', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  imgOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  imgPopup:   { position: 'relative', borderRadius: 12, overflow: 'hidden', maxWidth: '90vw', maxHeight: '90vh', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' },
  imgFull:    { display: 'block', maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' },
  imgClose:   { position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 18, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
};
