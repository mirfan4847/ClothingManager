import { useState, useEffect, useMemo } from 'react';
import { deleteEntry, getWorkers, getWageRates, upsertWageRate } from '../services/api';
import EntryForm from './EntryForm';
import LotHistoryModal from './LotHistoryModal';
import AiSlipScannerModal from './AiSlipScannerModal';
import { useTheme } from '../context/ThemeContext';

export default function WorkerTable({
  workerId,
  columns,
  entries,
  reload,
  dropdowns,
  workerRate: externalWorkerRate,
  onWorkerRateChange,
  entryRates: externalEntryRates,
  onEntryRatesChange,
}) {
  const { isDark } = useTheme();
  const [editing, setEditing]       = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [allWorkers, setAllWorkers] = useState([]);
  const [collapsed, setCollapsed]   = useState({});
  const [lotSearch, setLotSearch]   = useState('');
  const [previewImg, setPreviewImg] = useState(null);
  const [lotPage,    setLotPage]    = useState(1);
  const [lotPageSize,setLotPageSize]= useState(10);
  const [selectedLot, setSelectedLot] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [dateSortDir, setDateSortDir] = useState('desc'); // 'desc' | 'asc'
  const [internalWorkerRate, setInternalWorkerRate] = useState(() => {
    const saved = localStorage.getItem(`cm_worker_rate_${workerId}`);
    return saved ? Number(saved) : 0;
  });
  const [internalEntryRates, setInternalEntryRates] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`cm_entry_rates_${workerId}`) || '{}');
    } catch {
      return {};
    }
  });
  const [editingRateRowId, setEditingRateRowId] = useState(null);
  const [rateInputVal, setRateInputVal]         = useState('');

  const workerRate = externalWorkerRate !== undefined ? externalWorkerRate : internalWorkerRate;
  const entryRates = externalEntryRates !== undefined ? externalEntryRates : internalEntryRates;

  const updateWorkerRate = (rate) => {
    setInternalWorkerRate(rate);
    if (onWorkerRateChange) onWorkerRateChange(rate);
  };

  const updateEntryRates = (rates) => {
    setInternalEntryRates(rates);
    if (onEntryRatesChange) onEntryRatesChange(rates);
  };

  useEffect(() => {
    getWorkers().then(setAllWorkers).catch(() => {});
    if (workerId && externalWorkerRate === undefined) {
      getWageRates(workerId).then(rates => {
        if (Array.isArray(rates) && rates.length > 0) {
          const r = rates.find(x => x.taskType?.toLowerCase() === 'quantity' || x.taskType?.toLowerCase() === 'cutting') || rates[0];
          if (r && r.ratePerPiece != null && Number(r.ratePerPiece) > 0) {
            updateWorkerRate(Number(r.ratePerPiece));
            localStorage.setItem(`cm_worker_rate_${workerId}`, String(r.ratePerPiece));
          }
        }
      }).catch(() => {});
    }
  }, [workerId, externalWorkerRate]);

  const handleDelete = async (id) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    await deleteEntry(id);
    reload();
  };

  const handleSaved = () => { setShowForm(false); setEditing(null); reload(); };

  const toggleLot = (lot) => setCollapsed(c => ({ ...c, [lot]: !c[lot] }));

  // Ensure Rate and Total Price columns are present
  const effectiveColumns = useMemo(() => {
    let cols = [...columns];
    if (!cols.some(c => c.key === 'rate')) {
      const qIdx = cols.findIndex(c => c.key === 'quantity');
      const insertIdx = qIdx >= 0 ? qIdx + 1 : cols.findIndex(c => c.key === 'completed');
      const rateCols = [
        { key: 'rate', label: 'Rate' },
        { key: 'totalPrice', label: 'Total Price' },
      ];
      if (insertIdx >= 0) {
        cols.splice(insertIdx, 0, ...rateCols);
      } else {
        cols.push(...rateCols);
      }
    }
    return cols;
  }, [columns]);

  const getRowRate = (row) => {
    if (row.rate != null && row.rate !== '') return Number(row.rate);
    if (entryRates[row.id] != null) return Number(entryRates[row.id]);
    return Number(workerRate) || 0;
  };

  const getRowTotalPrice = (row) => {
    const rate = getRowRate(row);
    const qty = Number(row.quantity != null && row.quantity !== '' ? row.quantity : (row.totalPiece || 0)) || 0;
    return rate * qty;
  };

  const handleSaveRate = async (rowId, val) => {
    const num = Math.max(0, Number(val) || 0);
    const nextMap = { ...entryRates, [rowId]: num };
    updateEntryRates(nextMap);
    localStorage.setItem(`cm_entry_rates_${workerId}`, JSON.stringify(nextMap));
    if (!workerRate || workerRate === 0) {
      updateWorkerRate(num);
      localStorage.setItem(`cm_worker_rate_${workerId}`, String(num));
    }
    if (workerId && num > 0) {
      try {
        await upsertWageRate({
          workerId: Number(workerId),
          taskType: 'Quantity',
          ratePerPiece: num,
        });
      } catch {}
    }
    setEditingRateRowId(null);
  };

  const handleUpdateWorkerRate = async (val) => {
    const num = Math.max(0, Number(val) || 0);
    updateWorkerRate(num);
    localStorage.setItem(`cm_worker_rate_${workerId}`, String(num));
    if (workerId && num > 0) {
      try {
        await upsertWageRate({
          workerId: Number(workerId),
          taskType: 'Quantity',
          ratePerPiece: num,
        });
      } catch {}
    }
  };

  const getLotLatestDate = (rows) => {
    let bestTime = null;
    for (const r of rows) {
      if (r.dateCompleted) {
        const t = new Date(r.dateCompleted).getTime();
        if (!isNaN(t)) {
          if (bestTime === null || (dateSortDir === 'desc' ? t > bestTime : t < bestTime)) {
            bestTime = t;
          }
        }
      }
    }
    return bestTime;
  };

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

  // Order lot groups by Date Completed
  const sortedLots = useMemo(() => {
    return [...filteredLots].sort((lotA, lotB) => {
      const rowsA = grouped[lotA] || [];
      const rowsB = grouped[lotB] || [];
      const dateA = getLotLatestDate(rowsA);
      const dateB = getLotLatestDate(rowsB);

      if (dateA === null && dateB === null) {
        return lotB.localeCompare(lotA, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (dateA === null) return 1;
      if (dateB === null) return -1;

      const diff = dateSortDir === 'desc' ? dateB - dateA : dateA - dateB;
      if (diff !== 0) return diff;
      return lotB.localeCompare(lotA, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [filteredLots, grouped, dateSortDir]);

  useEffect(() => { setLotPage(1); }, [lotSearch, lotPageSize, dateSortDir]);
  const paginatedLots = useMemo(() => sortedLots.slice((lotPage - 1) * lotPageSize, lotPage * lotPageSize), [sortedLots, lotPage, lotPageSize]);

  // Sort child rows inside each lot by Date Completed
  const sortRowsByDate = (rows) => {
    return [...rows].sort((a, b) => {
      const tA = a.dateCompleted ? new Date(a.dateCompleted).getTime() : null;
      const tB = b.dateCompleted ? new Date(b.dateCompleted).getTime() : null;
      const validA = tA !== null && !isNaN(tA);
      const validB = tB !== null && !isNaN(tB);

      if (!validA && !validB) return (b.id || 0) - (a.id || 0);
      if (!validA) return 1;
      if (!validB) return -1;

      const diff = dateSortDir === 'desc' ? tB - tA : tA - tB;
      if (diff !== 0) return diff;
      return (b.id || 0) - (a.id || 0);
    });
  };

  // Summary for a lot group
  const lotSummary = (rows) => {
    const numCols = effectiveColumns.filter(c => !['completed','dateCompleted','lotNumber','size','color','machine','rate','totalPrice'].includes(c.key));
    const stats = numCols.map(c => {
      const total = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
      return { key: c.key, label: c.label, total };
    }).filter(x => x.total > 0);

    const lotTotalPrice = rows.reduce((s, r) => s + getRowTotalPrice(r), 0);
    return { stats, lotTotalPrice };
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
            {sortedLots.length} lot{sortedLots.length !== 1 ? 's' : ''} · {entries.length} entries
          </span>
          <span style={{ fontSize:12, color:'#888' }}>
            Showing {sortedLots.length === 0 ? 0 : (lotPage - 1) * lotPageSize + 1}–{Math.min(lotPage * lotPageSize, sortedLots.length)} of {sortedLots.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Rate Setter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: isDark ? '#1e293b' : '#f1f5f9',
            padding: '5px 11px',
            borderRadius: 8,
            border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#cbd5e1' : '#475569' }}>🏷️ Rate:</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={workerRate || ''}
              placeholder="0"
              onChange={e => handleUpdateWorkerRate(e.target.value)}
              style={{
                width: 60,
                padding: '3px 6px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 6,
                border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                background: isDark ? '#0f172a' : '#fff',
                color: isDark ? '#f8fafc' : '#0f172a',
                outline: 'none',
                textAlign: 'center',
              }}
              title="Worker rate per piece (multiplies quantity for Total Price)"
            />
            <span style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>/pc</span>
          </div>

          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #0284c7 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            }}
            title="Scan paper slip using Gemini Vision AI"
          >
            <span>📷</span> Scan Slip (AI)
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={styles.addBtn}>
            + Add Entry
          </button>
        </div>
      </div>

      {/* AI Slip Scanner Modal */}
      {showScanModal && (
        <AiSlipScannerModal
          isOpen={showScanModal}
          onClose={() => setShowScanModal(false)}
          initialWorkerId={workerId}
          workers={allWorkers}
          dropdowns={dropdowns}
          onEntriesImported={() => {
            reload();
          }}
        />
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <EntryForm
          workerId={workerId}
          columns={effectiveColumns}
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
              {effectiveColumns.map(c => {
                const isDateCol = c.key === 'dateCompleted';
                return (
                  <th
                    key={c.key}
                    style={{
                      ...styles.th,
                      cursor: isDateCol ? 'pointer' : 'default',
                      userSelect: isDateCol ? 'none' : 'auto',
                    }}
                    onClick={() => {
                      if (isDateCol) {
                        setDateSortDir(d => d === 'desc' ? 'asc' : 'desc');
                      }
                    }}
                    title={isDateCol ? `Order by Date Completed (${dateSortDir === 'desc' ? 'Newest first - Click to flip' : 'Oldest first - Click to flip'})` : undefined}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span>{c.label}</span>
                      {isDateCol && (
                        <span style={{ fontSize: 11, color: '#38bdf8' }}>
                          {dateSortDir === 'desc' ? '▼' : '▲'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th style={styles.th}>Picture</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedLots.length === 0 ? (
              <tr>
                <td colSpan={effectiveColumns.length + 3} style={styles.empty}>
                  {lotSearch ? `No lots matching "${lotSearch}"` : 'No entries yet'}
                </td>
              </tr>
            ) : (
              paginatedLots.map(lot => {
                const rows    = grouped[lot] || [];
                const isOpen  = !collapsed[lot];
                const summary = lotSummary(rows);

                return [
                  /* ── Parent / Lot Row ── */
                  <tr key={`lot-${lot}`} style={styles.lotRow} onClick={() => toggleLot(lot)}>
                    <td style={styles.chevronCell}>
                      <span style={{ ...styles.chevron, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    </td>
                    <td colSpan={effectiveColumns.length + 2} style={styles.lotCell}>
                      <div style={styles.lotHeader}>
                        <div style={styles.lotInfo}>
                          <span
                            style={{ ...styles.lotBadge, cursor: 'pointer' }}
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedLot({
                                id: rows[0]?.lotId,
                                lotNumber: lot,
                                sizeName: rows[0]?.size,
                                material: rows[0]?.lotMaterial,
                              });
                            }}
                            title="Click to see all staff who worked on this lot"
                          >
                            {lot} 🔍
                          </span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedLot({
                                id: rows[0]?.lotId,
                                lotNumber: lot,
                                sizeName: rows[0]?.size,
                                material: rows[0]?.lotMaterial,
                              });
                            }}
                            style={{
                              background: '#ffffff',
                              color: '#1d4ed8',
                              border: '1px solid #93c5fd',
                              borderRadius: 20,
                              padding: '2px 9px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                            title="View all persons who worked on this lot"
                          >
                            👥 Who Worked
                          </button>
                          <span style={styles.lotMeta}>
                            {rows[0]?.size && <span style={styles.metaTag}>{rows[0].size}</span>}
                            {rows[0]?.lotMaterial && <span style={styles.metaTag}>{rows[0].lotMaterial}</span>}
                          </span>
                        </div>
                        <div style={styles.lotStats}>
                          {summary.stats.map(s => (
                            <span key={s.key} style={styles.statPill}>
                              <span style={styles.statLabel}>{s.label}</span>
                              <strong style={styles.statVal}>{s.total}</strong>
                            </span>
                          ))}
                          {summary.lotTotalPrice > 0 && (
                            <span style={{ ...styles.statPill, background: '#dcfce7', border: '1px solid #86efac' }}>
                              <span style={{ ...styles.statLabel, color: '#166534' }}>Total Price</span>
                              <strong style={{ ...styles.statVal, color: '#15803d' }}>
                                ₨ {summary.lotTotalPrice.toLocaleString()}
                              </strong>
                            </span>
                          )}
                          <span style={styles.rowCount}>{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
                        </div>
                      </div>
                    </td>
                  </tr>,

                  /* ── Child / Entry Rows ── */
                  isOpen && sortRowsByDate(rows).map((row, i) => (
                    <tr key={row.id} style={{ ...styles.childRow, background: i % 2 === 0 ? '#fff' : '#f9fbff' }}>
                      <td style={styles.childIndent}></td>
                      {effectiveColumns.map(c => (
                        <td key={c.key} style={styles.td}>
                          {c.key === 'completed' ? (
                            <span style={row[c.key] ? styles.yes : styles.no}>{row[c.key] ? '✓' : '✗'}</span>
                          ) : c.key === 'dateCompleted' ? (
                            row[c.key] ? new Date(row[c.key]).toLocaleDateString('en-PK') : '—'
                          ) : c.key === 'lotNumber' ? (
                            <span
                              onClick={() => setSelectedLot({
                                id: row.lotId,
                                lotNumber: row.lotNumber,
                                sizeName: row.size,
                                material: row.lotMaterial,
                              })}
                              style={{ color: '#2563eb', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                              title="Click to see who worked on this lot"
                            >
                              {row[c.key] ?? '—'}
                            </span>
                          ) : c.key === 'rate' ? (
                            editingRateRowId === row.id ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  autoFocus
                                  value={rateInputVal}
                                  onChange={e => setRateInputVal(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveRate(row.id, rateInputVal);
                                    if (e.key === 'Escape') setEditingRateRowId(null);
                                  }}
                                  style={{
                                    width: 65,
                                    padding: '2px 5px',
                                    fontSize: 12,
                                    borderRadius: 4,
                                    border: '1px solid #3b82f6',
                                    outline: 'none',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveRate(row.id, rateInputVal)}
                                  style={{
                                    background: '#16a34a',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '2px 6px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRateRowId(null)}
                                  style={{
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '2px 6px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontWeight: 600, color: '#1d4ed8' }}>
                                  {getRowRate(row) > 0 ? `₨ ${getRowRate(row)}` : '—'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingRateRowId(row.id);
                                    setRateInputVal(String(getRowRate(row) || ''));
                                  }}
                                  title="Edit rate"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    opacity: 0.5,
                                    padding: '0 2px',
                                  }}
                                >
                                  ✏️
                                </button>
                              </div>
                            )
                          ) : c.key === 'totalPrice' ? (
                            <span style={{ fontWeight: 700, color: '#15803d' }}>
                              {getRowTotalPrice(row) > 0
                                ? `₨ ${getRowTotalPrice(row).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                                : '—'}
                            </span>
                          ) : (
                            row[c.key] ?? '—'
                          )}
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
      <WkrPagination page={lotPage} pageSize={lotPageSize} total={sortedLots.length} onPage={setLotPage} onPageSize={setLotPageSize} />

      {previewImg && (
        <div style={styles.imgOverlay} onClick={() => setPreviewImg(null)}>
          <div style={styles.imgPopup} onClick={e => e.stopPropagation()}>
            <button style={styles.imgClose} onClick={() => setPreviewImg(null)}>✕</button>
            <img src={previewImg} alt="preview" style={styles.imgFull} />
          </div>
        </div>
      )}

      {selectedLot && (
        <LotHistoryModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
        />
      )}

      {/* ── Confirm Delete Modal ── */}
      {deleteConfirmId && (
        <div style={styles.modalOverlay} onClick={() => setDeleteConfirmId(null)}>
          <div style={styles.modalCard(isDark)} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeaderDanger}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#ffffff' }}>Confirm Delete</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '1.4rem', fontSize: 14, color: isDark ? '#e2e8f0' : '#334155', lineHeight: 1.6 }}>
              Are you sure you want to delete this production entry? This action cannot be undone.
            </div>
            <div style={styles.modalFooter(isDark)}>
              <button
                type="button"
                style={styles.modalCancelBtn(isDark)}
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.modalDeleteBtn}
                onClick={confirmDelete}
              >
                Yes, Delete
              </button>
            </div>
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
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
    padding: 16,
  },
  modalCard: (isDark) => ({
    background: isDark ? 'var(--bg-card, #1e293b)' : '#ffffff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
    border: `1px solid ${isDark ? 'var(--border-color, #334155)' : '#dee2e6'}`,
  }),
  modalHeaderDanger: {
    background: 'linear-gradient(135deg, #be123c 0%, #dc2626 100%)',
    color: '#ffffff',
    padding: '1rem 1.3rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    color: '#ffffff',
    width: 26,
    height: 26,
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
  },
  modalFooter: (isDark) => ({
    padding: '1rem 1.3rem',
    borderTop: `1px solid ${isDark ? 'var(--border-color, #334155)' : '#f1f5f9'}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    background: isDark ? 'var(--bg-subtle, #0f172a)' : '#f8fafc',
  }),
  modalCancelBtn: (isDark) => ({
    background: isDark ? 'var(--bg-card, #1e293b)' : '#ffffff',
    border: `1px solid ${isDark ? 'var(--border-color, #334155)' : '#cbd5e1'}`,
    color: isDark ? 'var(--text-main, #e2e8f0)' : '#475569',
    borderRadius: 8,
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }),
  modalDeleteBtn: {
    background: 'linear-gradient(135deg, #be123c 0%, #dc2626 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
  },
};
