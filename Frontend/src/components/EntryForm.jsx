import { useEffect, useRef, useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { createEntry, updateEntry } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { buildAssignedTaskColumns } from '../utils/wageUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(ymd) {
  if (!ymd) return '';
  const clean = String(ymd).split('T')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return clean;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return clean;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EntryForm({ workerId, columns, entry, dropdowns, wageRates, taskRatesMap, workerRate, onSaved, onCancel }) {
  const { isDark, currentColor } = useTheme();
  const { register, handleSubmit, reset, setValue, control, getValues, watch } = useForm();
  const [saveError, setSaveError] = useState('');
  const watchedSizeId        = useWatch({ control, name: 'sizeId' });
  const watchedLotId         = useWatch({ control, name: 'lotId' });
  const watchedColorId       = useWatch({ control, name: 'colorId' });
  const watchedDateCompleted = useWatch({ control, name: 'dateCompleted' });
  const watchedCompleted     = useWatch({ control, name: 'completed' });
  const watchedRate          = useWatch({ control, name: 'rate' });
  const watchedQuantity      = useWatch({ control, name: 'quantity' });
  const watchedTotalPiece    = useWatch({ control, name: 'totalPiece' });
  const initialized = useRef(false);
  const inputStyle = getInputStyle(isDark);

  // Searchable Lot Dropdown state
  const [lotOpen, setLotOpen]             = useState(false);
  const [lotQuery, setLotQuery]           = useState('');
  const [lotHighlight, setLotHighlight]   = useState(0);
  const lotWrapRef  = useRef(null);
  const lotInputRef = useRef(null);

  // Searchable Color Dropdown state
  const [colorOpen, setColorOpen]           = useState(false);
  const [colorQuery, setColorQuery]         = useState('');
  const [colorHighlight, setColorHighlight] = useState(0);
  const colorWrapRef  = useRef(null);
  const colorInputRef = useRef(null);

  // Beautiful Custom Calendar state
  const [calOpen, setCalOpen] = useState(false);
  const [calView, setCalView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const calWrapRef = useRef(null);

  useEffect(() => {
    initialized.current = false;
    const cleanDate = entry?.dateCompleted ? String(entry.dateCompleted).split('T')[0] : '';

    let customTaskDefaults = {};
    if (entry?.id) {
      try {
        const savedCustomAll = JSON.parse(localStorage.getItem(`cm_entry_custom_tasks_${workerId}`) || '{}');
        const entryCustom = savedCustomAll[entry.id] || {};
        Object.entries(entryCustom).forEach(([taskName, val]) => {
          customTaskDefaults[`customTask_${taskName}`] = val;
        });
      } catch {}
    }

    reset(entry
      ? {
          ...entry,
          ...customTaskDefaults,
          lotId: entry.lotId,
          sizeId: entry.sizeId,
          colorId: entry.colorId,
          machineId: entry.machineId,
          dateCompleted: cleanDate,
        }
      : { workerId, dateCompleted: '' }
    );
    if (cleanDate) {
      const [y, m] = cleanDate.split('-').map(Number);
      if (y && m) setCalView({ year: y, month: m - 1 });
    }
    setLotQuery('');
    setColorQuery('');
    setTimeout(() => { initialized.current = true; }, 0);
  }, [entry, reset, workerId]);

  // Close popups on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (lotWrapRef.current && !lotWrapRef.current.contains(e.target)) {
        setLotOpen(false);
      }
      if (colorWrapRef.current && !colorWrapRef.current.contains(e.target)) {
        setColorOpen(false);
      }
      if (calWrapRef.current && !calWrapRef.current.contains(e.target)) {
        setCalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Show ONLY Lot Number + assigned task types from Payroll + Completed + Date Completed
  const formColumns = useMemo(() => {
    return [
      { key: 'lotNumber', label: 'Lot Number' },
      ...buildAssignedTaskColumns(wageRates),
      { key: 'completed', label: 'Completed' },
      { key: 'dateCompleted', label: 'Date Completed' },
    ];
  }, [wageRates]);

  const sizeFilteredLots = useMemo(() => {
    const allLots = dropdowns?.lots || [];
    return watchedSizeId
      ? allLots.filter(l => l.sizeId === Number(watchedSizeId))
      : allLots;
  }, [dropdowns?.lots, watchedSizeId]);

  const searchedLots = useMemo(() => {
    const q = lotQuery.trim().toLowerCase();
    if (!q) return sizeFilteredLots;
    return sizeFilteredLots.filter(l =>
      (l.lotNumber || '').toLowerCase().includes(q) ||
      (l.material || '').toLowerCase().includes(q) ||
      (l.sizeName || '').toLowerCase().includes(q)
    );
  }, [sizeFilteredLots, lotQuery]);

  const selectedLotObj = useMemo(() => {
    if (!watchedLotId) return null;
    return (dropdowns?.lots || []).find(l => String(l.id) === String(watchedLotId)) || null;
  }, [dropdowns?.lots, watchedLotId]);

  const searchedColors = useMemo(() => {
    const allColors = dropdowns?.colors || [];
    const q = colorQuery.trim().toLowerCase();
    if (!q) return allColors;
    return allColors.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [dropdowns?.colors, colorQuery]);

  const selectedColorObj = useMemo(() => {
    if (!watchedColorId) return null;
    return (dropdowns?.colors || []).find(c => String(c.id) === String(watchedColorId)) || null;
  }, [dropdowns?.colors, watchedColorId]);

  useEffect(() => {
    if (!initialized.current) return;
    if (!watchedSizeId) return;
    const currentLotId = getValues('lotId');
    if (!currentLotId) return;
    const stillValid = sizeFilteredLots.some(l => String(l.id) === String(currentLotId));
    if (!stillValid) {
      setValue('lotId', '');
      setLotQuery('');
    }
  }, [watchedSizeId, sizeFilteredLots, getValues, setValue]);

  const handleSelectLot = (lot) => {
    setValue('lotId', String(lot.id), { shouldValidate: true });
    if (!watchedSizeId && lot.sizeId) {
      setValue('sizeId', String(lot.sizeId));
    }
    setLotQuery('');
    setLotOpen(false);
  };

  const handleSelectColor = (color) => {
    setValue('colorId', String(color.id));
    setColorQuery('');
    setColorOpen(false);
  };

  const handleSelectDate = (ymd) => {
    setValue('dateCompleted', ymd);
    if (ymd) {
      setValue('completed', true);
    }
    setCalOpen(false);
  };

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const { year, month } = calView;
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth    = new Date(year, month + 1, 0).getDate();
    const daysInPrev     = new Date(year, month, 0).getDate();

    const cells = [];
    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const dt = new Date(year, month - 1, d);
      cells.push({ day: d, ymd: toYMD(dt), currentMonth: false });
    }
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      cells.push({ day: d, ymd: toYMD(dt), currentMonth: true });
    }
    // Trailing days to complete 6 rows (42 cells) or 5 rows (35 cells)
    const totalNeeded = cells.length > 35 ? 42 : 35;
    let nextDay = 1;
    while (cells.length < totalNeeded) {
      const dt = new Date(year, month + 1, nextDay);
      cells.push({ day: nextDay++, ymd: toYMD(dt), currentMonth: false });
    }
    return cells;
  }, [calView]);

  const onSubmit = async (data) => {
    setSaveError('');
    if (!data.lotId) {
      setSaveError('Please select a Lot Number.');
      return;
    }

    // Collect values from any assigned custom Payroll task types (e.g., Jarsy, Sando)
    const customTaskValues = {};
    let customTaskSum = 0;
    let hasCustomTasks = false;
    formColumns.forEach(col => {
      if (col.isCustomTask && col.rawTaskType) {
        hasCustomTasks = true;
        const rawVal = data[col.key];
        const num = rawVal != null && rawVal !== '' ? Number(rawVal) : 0;
        if (num > 0) {
          customTaskValues[col.rawTaskType] = num;
          customTaskSum += num;
        }
      }
    });

    const payload = {
      workerId: Number(workerId),
      lotId: Number(data.lotId),
      sizeId: data.sizeId ? Number(data.sizeId) : null,
      colorId: data.colorId ? Number(data.colorId) : null,
      machineId: data.machineId ? Number(data.machineId) : null,
      front: data.front ? Number(data.front) : null,
      bazo: data.bazo ? Number(data.bazo) : null,
      tape: data.tape ? Number(data.tape) : null,
      pocket: data.pocket ? Number(data.pocket) : null,
      gala: data.gala ? Number(data.gala) : null,
      lable: data.lable ? Number(data.lable) : null,
      moda: data.moda ? Number(data.moda) : null,
      quantity: data.quantity ? Number(data.quantity) : null,
      totalPiece: data.totalPiece
        ? Number(data.totalPiece)
        : (hasCustomTasks && customTaskSum > 0 ? customTaskSum : (entry?.totalPiece ?? null)),
      completed: !!data.completed,
      dateCompleted: data.dateCompleted || null,
    };
    try {
      const res = entry ? await updateEntry(entry.id, payload) : await createEntry(payload);
      const savedId = entry?.id || res?.id;
      if (savedId && hasCustomTasks) {
        try {
          const savedCustomAll = JSON.parse(localStorage.getItem(`cm_entry_custom_tasks_${workerId}`) || '{}');
          if (Object.keys(customTaskValues).length > 0) {
            savedCustomAll[savedId] = customTaskValues;
          } else {
            delete savedCustomAll[savedId];
          }
          localStorage.setItem(`cm_entry_custom_tasks_${workerId}`, JSON.stringify(savedCustomAll));
        } catch {}
      }
      onSaved();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Save failed.';
      setSaveError(msg);
    }
  };

  const fieldByKey = (key) => {
    if (key === 'lotNumber') {
      const displayLabel = selectedLotObj
        ? `${selectedLotObj.lotNumber}${selectedLotObj.material ? ` — ${selectedLotObj.material}` : ''}`
        : '';

      return (
        <div key={key} ref={lotWrapRef} style={{ position: 'relative', minWidth: 190 }}>
          <input type="hidden" {...register('lotId', { required: true })} />

          <div
            onClick={() => {
              setLotOpen(true);
              setLotHighlight(0);
              setTimeout(() => lotInputRef.current?.focus(), 0);
            }}
            style={{
              ...inputStyle,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              cursor: 'text',
              borderColor: lotOpen ? '#2E75B6' : '#ccc',
              boxShadow: lotOpen ? '0 0 0 2px rgba(46,117,182,0.18)' : 'none',
            }}
          >
            {lotOpen ? (
              <input
                ref={lotInputRef}
                type="text"
                value={lotQuery}
                onChange={e => {
                  setLotQuery(e.target.value);
                  setLotHighlight(0);
                }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setLotHighlight(i => Math.min(i + 1, Math.max(0, searchedLots.length - 1)));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setLotHighlight(i => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchedLots[lotHighlight]) {
                      handleSelectLot(searchedLots[lotHighlight]);
                    }
                  } else if (e.key === 'Escape') {
                    setLotOpen(false);
                  }
                }}
                placeholder={selectedLotObj ? displayLabel : '🔍 Search lot number...'}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  width: '100%',
                  padding: 0,
                  background: 'transparent',
                }}
              />
            ) : (
              <span style={{ color: selectedLotObj ? '#1e293b' : '#64748b', fontWeight: selectedLotObj ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedLotObj ? displayLabel : '-- Select or Search Lot --'}
              </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {selectedLotObj && (
                <span
                  onClick={e => {
                    e.stopPropagation();
                    setValue('lotId', '');
                    setLotQuery('');
                  }}
                  title="Clear selected lot"
                  style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer', padding: '0 2px', fontWeight: 700 }}
                >
                  ✕
                </span>
              )}
              <span style={{ fontSize: 10, color: '#64748b' }}>{lotOpen ? '▲' : '▼'}</span>
            </div>
          </div>

          {lotOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                minWidth: 220,
                maxHeight: 230,
                overflowY: 'auto',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                boxShadow: '0 10px 25px rgba(0,0,0,0.14)',
                zIndex: 1000,
              }}
            >
              {searchedLots.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 12.5, color: '#64748b', textAlign: 'center' }}>
                  No matching lot found
                </div>
              ) : (
                searchedLots.map((l, idx) => {
                  const isSelected = String(l.id) === String(watchedLotId);
                  const isHighlighted = idx === lotHighlight;
                  return (
                    <div
                      key={l.id}
                      onMouseEnter={() => setLotHighlight(idx)}
                      onClick={() => handleSelectLot(l)}
                      style={{
                        padding: '8px 12px',
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: isSelected ? '#dbeafe' : isHighlighted ? '#f1f5f9' : '#ffffff',
                        color: isSelected ? '#1d4ed8' : '#1e293b',
                        fontWeight: isSelected ? 700 : 500,
                        borderBottom: '1px solid #f8fafc',
                      }}
                    >
                      <span>
                        <strong>{l.lotNumber}</strong>
                        {l.material ? <span style={{ color: '#64748b', fontSize: 12 }}> — {l.material}</span> : ''}
                      </span>
                      {l.sizeName && (
                        <span style={{ fontSize: 11, background: '#e2e8f0', color: '#475569', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                          {l.sizeName}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      );
    }

    if (key === 'color') {
      const displayColor = selectedColorObj ? selectedColorObj.name : '';

      return (
        <div key={key} ref={colorWrapRef} style={{ position: 'relative', minWidth: 170 }}>
          <input type="hidden" {...register('colorId')} />

          <div
            onClick={() => {
              setColorOpen(true);
              setColorHighlight(0);
              setTimeout(() => colorInputRef.current?.focus(), 0);
            }}
            style={{
              ...inputStyle,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              cursor: 'text',
              borderColor: colorOpen ? '#2E75B6' : '#ccc',
              boxShadow: colorOpen ? '0 0 0 2px rgba(46,117,182,0.18)' : 'none',
            }}
          >
            {colorOpen ? (
              <input
                ref={colorInputRef}
                type="text"
                value={colorQuery}
                onChange={e => {
                  setColorQuery(e.target.value);
                  setColorHighlight(0);
                }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setColorHighlight(i => Math.min(i + 1, Math.max(0, searchedColors.length - 1)));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setColorHighlight(i => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchedColors[colorHighlight]) {
                      handleSelectColor(searchedColors[colorHighlight]);
                    }
                  } else if (e.key === 'Escape') {
                    setColorOpen(false);
                  }
                }}
                placeholder={selectedColorObj ? displayColor : '🔍 Search color...'}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  width: '100%',
                  padding: 0,
                  background: 'transparent',
                }}
              />
            ) : (
              <span style={{ color: selectedColorObj ? '#1e293b' : '#64748b', fontWeight: selectedColorObj ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedColorObj ? displayColor : '-- Select or Search Color --'}
              </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {selectedColorObj && (
                <span
                  onClick={e => {
                    e.stopPropagation();
                    setValue('colorId', '');
                    setColorQuery('');
                  }}
                  title="Clear selected color"
                  style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer', padding: '0 2px', fontWeight: 700 }}
                >
                  ✕
                </span>
              )}
              <span style={{ fontSize: 10, color: '#64748b' }}>{colorOpen ? '▲' : '▼'}</span>
            </div>
          </div>

          {colorOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                minWidth: 190,
                maxHeight: 230,
                overflowY: 'auto',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                boxShadow: '0 10px 25px rgba(0,0,0,0.14)',
                zIndex: 1000,
              }}
            >
              {searchedColors.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 12.5, color: '#64748b', textAlign: 'center' }}>
                  No matching color found
                </div>
              ) : (
                searchedColors.map((c, idx) => {
                  const isSelected = String(c.id) === String(watchedColorId);
                  const isHighlighted = idx === colorHighlight;
                  return (
                    <div
                      key={c.id}
                      onMouseEnter={() => setColorHighlight(idx)}
                      onClick={() => handleSelectColor(c)}
                      style={{
                        padding: '8px 12px',
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: isSelected ? '#dbeafe' : isHighlighted ? '#f1f5f9' : '#ffffff',
                        color: isSelected ? '#1d4ed8' : '#1e293b',
                        fontWeight: isSelected ? 700 : 500,
                        borderBottom: '1px solid #f8fafc',
                      }}
                    >
                      <span>{c.name}</span>
                      {isSelected && <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 800 }}>✓</span>}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      );
    }

    if (key === 'dateCompleted') {
      const cleanSelected = watchedDateCompleted ? String(watchedDateCompleted).split('T')[0] : '';
      const todayYMD      = toYMD(new Date());

      return (
        <div key={key} ref={calWrapRef} style={{ position: 'relative', minWidth: 165 }}>
          <input type="hidden" {...register('dateCompleted')} />

          {/* Clickable Date Textbox */}
          <div
            onClick={() => {
              if (!calOpen && cleanSelected) {
                const [y, m] = cleanSelected.split('-').map(Number);
                if (y && m) setCalView({ year: y, month: m - 1 });
              }
              setCalOpen(o => !o);
            }}
            style={{
              ...inputStyle,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              cursor: 'pointer',
              userSelect: 'none',
              borderColor: calOpen ? '#2563eb' : '#ccc',
              boxShadow: calOpen ? '0 0 0 2px rgba(37,99,235,0.18)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>📅</span>
              <span style={{
                color: cleanSelected ? '#1e293b' : '#64748b',
                fontWeight: cleanSelected ? 600 : 400,
                fontSize: 13,
                whiteSpace: 'nowrap',
              }}>
                {cleanSelected ? formatDisplayDate(cleanSelected) : 'Select Date...'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {cleanSelected && (
                <span
                  onClick={e => {
                    e.stopPropagation();
                    setValue('dateCompleted', '');
                  }}
                  title="Clear date"
                  style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer', padding: '0 2px', fontWeight: 700 }}
                >
                  ✕
                </span>
              )}
              <span style={{ fontSize: 10, color: '#64748b' }}>{calOpen ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Beautiful Floating Calendar Popup */}
          {calOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: 284,
                background: '#ffffff',
                borderRadius: 14,
                boxShadow: '0 16px 40px rgba(15, 23, 42, 0.22)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                zIndex: 1200,
                fontFamily: 'Segoe UI, Inter, Arial, sans-serif',
              }}
            >
              {/* Gradient Calendar Top Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  padding: '12px 16px',
                  color: '#ffffff',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#bfdbfe' }}>
                  DATE COMPLETED
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{cleanSelected ? formatDisplayDate(cleanSelected) : 'Pick a completion date'}</span>
                  <span style={{ fontSize: 16 }}>📅</span>
                </div>
              </div>

              {/* Month / Year Switcher */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px 6px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCalView(v => {
                    const d = new Date(v.year, v.month - 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })}
                  style={calNavBtnStyle}
                  title="Previous Month"
                >
                  ‹
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select
                    value={calView.month}
                    onChange={e => setCalView(v => ({ ...v, month: Number(e.target.value) }))}
                    style={calSelectStyle}
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>{m.slice(0, 3)}</option>
                    ))}
                  </select>
                  <select
                    value={calView.year}
                    onChange={e => setCalView(v => ({ ...v, year: Number(e.target.value) }))}
                    style={calSelectStyle}
                  >
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setCalView(v => {
                    const d = new Date(v.year, v.month + 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })}
                  style={calNavBtnStyle}
                  title="Next Month"
                >
                  ›
                </button>
              </div>

              {/* Days of Week Header + Grid */}
              <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                  {DAY_NAMES.map(dn => (
                    <div
                      key={dn}
                      style={{
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        color: dn === 'Su' ? '#ef4444' : '#64748b',
                        padding: '4px 0',
                      }}
                    >
                      {dn}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                  {calendarDays.map((cell, idx) => {
                    const isSelected = cell.ymd === cleanSelected;
                    const isToday    = cell.ymd === todayYMD;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectDate(cell.ymd)}
                        style={{
                          height: 32,
                          borderRadius: 8,
                          border: isToday && !isSelected ? '1.5px solid #2563eb' : 'none',
                          background: isSelected
                            ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)'
                            : isToday
                            ? '#eff6ff'
                            : 'transparent',
                          color: isSelected
                            ? '#ffffff'
                            : !cell.currentMonth
                            ? '#cbd5e1'
                            : isToday
                            ? '#1d4ed8'
                            : '#1e293b',
                          fontWeight: isSelected || isToday ? 800 : 600,
                          fontSize: 12.5,
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 3px 8px rgba(37, 99, 235, 0.35)' : 'none',
                          transition: 'all 0.12s ease',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.background = '#f1f5f9';
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.background = isToday ? '#eff6ff' : 'transparent';
                        }}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleSelectDate(todayYMD)}
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const yest = new Date();
                      yest.setDate(yest.getDate() - 1);
                      handleSelectDate(toYMD(yest));
                    }}
                    style={{
                      background: '#ffffff',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Yesterday
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setValue('dateCompleted', '');
                    setCalOpen(false);
                  }}
                  style={{
                    background: 'transparent',
                    color: '#dc2626',
                    border: 'none',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '4px 6px',
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (key === 'size') return (
      <select key={key} {...register('sizeId')} style={inputStyle}>
        <option value="">-- Size --</option>
        {dropdowns.sizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    );
    if (key === 'machine') return (
      <select key={key} {...register('machineId')} style={inputStyle}>
        <option value="">-- Machine --</option>
        {dropdowns.machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    );
    if (key === 'completed') return (
      <label
        key={key}
        style={{
          ...inputStyle,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          userSelect: 'none',
          background: watchedCompleted ? (isDark ? 'rgba(22, 163, 74, 0.15)' : '#f0fdf4') : (isDark ? 'var(--bg-subtle)' : '#f8fafc'),
          borderColor: watchedCompleted ? '#22c55e' : (isDark ? 'var(--border-color)' : '#cbd5e1'),
        }}
      >
        <input
          type="checkbox"
          {...register('completed')}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#16a34a', margin: 0 }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: watchedCompleted ? '#16a34a' : (isDark ? 'var(--text-main)' : '#475569') }}>
          {watchedCompleted ? 'Completed' : 'Mark as Completed'}
        </span>
      </label>
    );
    if (key === 'rate') return (
      <input
        key={key}
        type="number"
        step="0.5"
        min={0}
        {...register('rate')}
        placeholder="Rate / pc (PKR)"
        defaultValue={entry?.rate || localStorage.getItem(`cm_worker_rate_${workerId}`) || ''}
        style={inputStyle}
      />
    );
    if (key === 'totalPrice') {
      const currentRate = Number(watchedRate ?? watch('rate')) || Number(localStorage.getItem(`cm_worker_rate_${workerId}`)) || 0;
      const currentQty = Number(watchedQuantity ?? watch('quantity')) || Number(watchedTotalPiece ?? watch('totalPiece')) || 0;
      const calcTotal = currentRate * currentQty;
      return (
        <div key={key} style={{ ...inputStyle, background: isDark ? 'var(--bg-subtle)' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#64748b' }}>Total Price:</span>
          <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 13 }}>
            {calcTotal > 0 ? `₨ ${calcTotal.toLocaleString()}` : '—'}
          </span>
        </div>
      );
    }
    return <input type="number" {...register(key)} placeholder="0" style={inputStyle} min={0} />;
  };

  return (
    <div style={modalOverlayStyle} onClick={onCancel}>
      <div style={modalCardStyle(isDark)} onClick={e => e.stopPropagation()}>
        {/* ── Modal Header ── */}
        <div style={modalHeaderStyle(currentColor?.primary || '#2563eb')}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
              {entry ? '✏️ Edit Production Entry' : '➕ Add Production Entry'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
              Staff Production Sheet
            </div>
          </div>
          <button type="button" onClick={onCancel} style={closeBtnStyle} title="Close">
            ✕
          </button>
        </div>

        {/* ── Modal Body / Form ── */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ padding: '1.4rem' }}>
            {saveError && (
              <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                ⚠️ {saveError}
              </div>
            )}

            {(!wageRates || wageRates.length === 0) && (
              <div style={{
                background: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
                color: isDark ? '#fcd34d' : '#92400e',
                border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a'}`,
                padding: '8px 12px',
                borderRadius: 8,
                marginBottom: 14,
                fontSize: 12,
                fontWeight: 600,
              }}>
                ℹ️ No task types are assigned to this worker in Payroll yet. Assign tasks in Payroll → Wage Rates to record piece quantities here.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {formColumns.map(col => {
                const lookupKey = (col.rawTaskType || col.key || '').trim().toLowerCase();
                const assignedRate = taskRatesMap?.[lookupKey];
                return (
                  <div
                    key={col.key}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      gridColumn: col.key === 'lotNumber' ? '1 / -1' : 'auto',
                    }}
                  >
                    <label style={getLabelStyle(isDark)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {col.label}
                        {col.key === 'lotNumber' && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                      </span>
                      {assignedRate != null && Number(assignedRate) > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#15803d',
                            background: isDark ? 'rgba(22, 163, 74, 0.2)' : '#dcfce7',
                            padding: '1px 6px',
                            borderRadius: 4,
                            marginLeft: 6,
                          }}
                          title="Wage rate assigned in Wages Payroll"
                        >
                          ₨ {Number(assignedRate).toLocaleString()}/pc
                        </span>
                      )}
                    </label>
                    {fieldByKey(col.key)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Modal Footer ── */}
          <div style={modalFooterStyle(isDark)}>
            <button type="button" onClick={onCancel} style={cancelBtnStyle(isDark)}>
              Cancel
            </button>
            <button type="submit" style={saveBtnStyle(currentColor?.primary || '#2563eb')}>
              {entry ? '✓ Update Entry' : '✓ Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.65)',
  backdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
};

const modalCardStyle = (isDark) => ({
  background: isDark ? 'var(--bg-card)' : '#ffffff',
  borderRadius: 16,
  width: '100%',
  maxWidth: 600,
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
  border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
  overflow: 'visible',
});

const modalHeaderStyle = (primaryColor) => ({
  background: `linear-gradient(135deg, ${primaryColor} 0%, #1e3a8a 100%)`,
  padding: '1.1rem 1.4rem',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderRadius: '15px 15px 0 0',
});

const closeBtnStyle = {
  background: 'rgba(255, 255, 255, 0.2)',
  border: 'none',
  color: '#ffffff',
  width: 28,
  height: 28,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  cursor: 'pointer',
};

const getLabelStyle = (isDark) => ({
  fontSize: 12,
  fontWeight: 700,
  color: isDark ? 'var(--text-main)' : '#334155',
});

const getInputStyle = (isDark) => ({
  padding: '9px 12px',
  borderRadius: 8,
  border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
  background: isDark ? 'var(--bg-subtle)' : '#ffffff',
  color: isDark ? 'var(--text-main)' : '#0f172a',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
});

const modalFooterStyle = (isDark) => ({
  padding: '1rem 1.4rem',
  borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  background: isDark ? 'var(--bg-subtle)' : '#f8fafc',
  borderRadius: '0 0 15px 15px',
});

const cancelBtnStyle = (isDark) => ({
  background: isDark ? 'var(--bg-card)' : '#ffffff',
  border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
  color: isDark ? 'var(--text-main)' : '#475569',
  borderRadius: 8,
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
});

const saveBtnStyle = (primaryColor) => ({
  background: primaryColor,
  color: '#ffffff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 22px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
});
const calNavBtnStyle = {
  width: 28,
  height: 28,
  borderRadius: 7,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#1e293b',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};
const calSelectStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '3px 6px',
  fontSize: 12.5,
  fontWeight: 700,
  color: '#1e293b',
  background: '#ffffff',
  cursor: 'pointer',
  outline: 'none',
};
