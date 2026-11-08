import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEntriesByLot } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const TASK_FIELDS = [
  { key: 'front',      label: 'Front' },
  { key: 'bazo',       label: 'Bazo' },
  { key: 'tape',       label: 'Tape' },
  { key: 'pocket',     label: 'Pocket' },
  { key: 'gala',       label: 'Gala' },
  { key: 'lable',      label: 'Lable' },
  { key: 'moda',       label: 'Moda' },
  { key: 'quantity',   label: 'Quantity' },
  { key: 'totalPiece', label: 'Total Piece' },
];

export function getWorkerLotAction(workerId, workerName = '', sheetType = '', rows = []) {
  const n = `${workerName} ${sheetType}`.toLowerCase();

  if (workerId === 1 || n.includes('ali hassan') || n.includes('hassan')) {
    return {
      role: 'Cutting',
      actionVerb: 'cut the lot',
      stageIcon: '✂️',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
      accent: '#2563eb',
      badgeBg: '#eff6ff',
      badgeBorder: '#bfdbfe',
      order: 1,
    };
  }
  if (workerId === 11 || n.includes('rashid') || n.includes('cutter') || n.includes('cut')) {
    return {
      role: 'Master Cutter',
      actionVerb: 'cut the lot',
      stageIcon: '✂️',
      gradient: 'linear-gradient(135deg, #881337 0%, #c026d3 100%)',
      accent: '#c026d3',
      badgeBg: '#fdf4ff',
      badgeBorder: '#f5d0fe',
      order: 1,
    };
  }
  if (workerId === 2 || n.includes('faizan') || n.includes('machine')) {
    return {
      role: 'Machine / Knitting',
      actionVerb: 'did machine work on the lot',
      stageIcon: '⚙️',
      gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
      accent: '#059669',
      badgeBg: '#ecfdf5',
      badgeBorder: '#a7f3d0',
      order: 2,
    };
  }
  if (workerId === 4 || n.includes('arslan')) {
    return {
      role: 'Stitching',
      actionVerb: 'stitched the lot',
      stageIcon: '🧵',
      gradient: 'linear-gradient(135deg, #831843 0%, #e11d48 100%)',
      accent: '#e11d48',
      badgeBg: '#fff1f2',
      badgeBorder: '#fecdd3',
      order: 3,
    };
  }
  if (workerId === 5 || n.includes('nazir') || n.includes('stitch')) {
    return {
      role: 'Stitching',
      actionVerb: 'stitched the lot',
      stageIcon: '🧵',
      gradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
      accent: '#7c3aed',
      badgeBg: '#f5f3ff',
      badgeBorder: '#ddd6fe',
      order: 3,
    };
  }
  if (workerId === 6 || n.includes('umar') || n.includes('umer') || n.includes('safty') || n.includes('overlock')) {
    return {
      role: 'Overlock / Safty',
      actionVerb: 'did Overlock / Safty on the lot',
      stageIcon: '🧶',
      gradient: 'linear-gradient(135deg, #164e63 0%, #0891b2 100%)',
      accent: '#0891b2',
      badgeBg: '#ecfeff',
      badgeBorder: '#a5f3fc',
      order: 4,
    };
  }
  if (workerId === 7 || n.includes('rafo') || n.includes('umair') || n.includes('naveed')) {
    return {
      role: 'Rafo / Mending',
      actionVerb: 'did Rafo / Mending on the lot',
      stageIcon: '🪡',
      gradient: 'linear-gradient(135deg, #064e3b 0%, #0d9488 100%)',
      accent: '#0d9488',
      badgeBg: '#f0fdfa',
      badgeBorder: '#99f6e4',
      order: 5,
    };
  }
  if (workerId === 8 || n.includes('kaj') || n.includes('bhatti')) {
    return {
      role: 'Kaj / Buttonhole',
      actionVerb: 'did Kaj / Buttonhole on the lot',
      stageIcon: '🕳️',
      gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
      accent: '#ea580c',
      badgeBg: '#fff7ed',
      badgeBorder: '#fed7aa',
      order: 6,
    };
  }
  if (workerId === 9 || n.includes('button')) {
    return {
      role: 'Button Attaching',
      actionVerb: 'attached buttons on the lot',
      stageIcon: '🔘',
      gradient: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)',
      accent: '#2563eb',
      badgeBg: '#eff6ff',
      badgeBorder: '#bfdbfe',
      order: 7,
    };
  }
  if (workerId === 3 || n.includes('press') || n.includes('gujjar')) {
    return {
      role: 'Pressing / Iron',
      actionVerb: 'pressed the lot',
      stageIcon: '♨️',
      gradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)',
      accent: '#4f46e5',
      badgeBg: '#eef2ff',
      badgeBorder: '#c7d2fe',
      order: 8,
    };
  }

  // Infer from task columns if custom worker
  const hasStitchCols = rows.some(r => r.pocket || r.gala || r.lable || r.moda);
  const hasCutCols    = rows.some(r => (r.front || r.bazo) && !r.machine);
  if (hasStitchCols) {
    return {
      role: 'Stitching',
      actionVerb: 'stitched the lot',
      stageIcon: '🧵',
      gradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
      accent: '#7c3aed',
      badgeBg: '#f5f3ff',
      badgeBorder: '#ddd6fe',
      order: 3,
    };
  }
  if (hasCutCols) {
    return {
      role: 'Cutting',
      actionVerb: 'cut the lot',
      stageIcon: '✂️',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
      accent: '#2563eb',
      badgeBg: '#eff6ff',
      badgeBorder: '#bfdbfe',
      order: 1,
    };
  }

  return {
    role: 'Production Staff',
    actionVerb: 'worked on the lot',
    stageIcon: '👷',
    gradient: 'linear-gradient(135deg, #134e4a 0%, #0d9488 100%)',
    accent: '#0d9488',
    badgeBg: '#f0fdfa',
    badgeBorder: '#99f6e4',
    order: 9,
  };
}

export default function LotHistoryModal({ lot, onClose }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [expandedWorker, setExpandedWorker] = useState({});

  const lotId     = typeof lot === 'object' ? (lot?.id || lot?.lotId) : null;
  const lotNumber = typeof lot === 'object' ? lot?.lotNumber : String(lot || '');

  useEffect(() => {
    if (!lotId && !lotNumber) return;
    let active = true;
    setLoading(true);
    setError('');
    getEntriesByLot({ lotId: lotId || undefined, lotNumber: lotNumber || undefined })
      .then(data => {
        if (!active) return;
        setEntries(data || []);
        // Expand all workers by default so details are immediately visible
        const exp = {};
        (data || []).forEach(r => { exp[r.workerId] = true; });
        setExpandedWorker(exp);
      })
      .catch(() => {
        if (active) setError('Could not load worker history for this lot.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [lotId, lotNumber]);

  const workerGroups = useMemo(() => {
    const map = new Map();
    entries.forEach(row => {
      if (!map.has(row.workerId)) {
        map.set(row.workerId, {
          workerId:   row.workerId,
          workerName: row.workerName || `Worker #${row.workerId}`,
          sheetType:  row.sheetType || '',
          rows:       [],
        });
      }
      map.get(row.workerId).rows.push(row);
    });

    const groups = Array.from(map.values()).map(g => {
      const info = getWorkerLotAction(g.workerId, g.workerName, g.sheetType, g.rows);
      const initials = g.workerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'WK';
      const totalPieces = g.rows.reduce((sum, r) => sum + (Number(r.totalPiece ?? r.quantity) || 0), 0);
      const completedCount = g.rows.filter(r => r.completed).length;
      const allCompleted = completedCount === g.rows.length && g.rows.length > 0;

      // Sum individual task fields
      const taskTotals = TASK_FIELDS
        .filter(f => f.key !== 'totalPiece')
        .map(f => ({
          key:   f.key,
          label: f.label,
          total: g.rows.reduce((s, r) => s + (Number(r[f.key]) || 0), 0),
        }))
        .filter(t => t.total > 0);

      const colors = [...new Set(g.rows.map(r => r.color).filter(Boolean))];
      const sizes  = [...new Set(g.rows.map(r => r.size).filter(Boolean))];
      const machines = [...new Set(g.rows.map(r => r.machine).filter(Boolean))];
      const latestDate = g.rows
        .map(r => r.dateCompleted || r.createdAt)
        .filter(Boolean)
        .sort()
        .pop();

      return {
        ...g,
        ...info,
        initials,
        totalPieces,
        completedCount,
        allCompleted,
        taskTotals,
        colors,
        sizes,
        machines,
        latestDate,
      };
    });

    return groups.sort((a, b) => a.order - b.order || a.workerId - b.workerId);
  }, [entries]);

  if (!lot) return null;

  const displayLotNumber = lotNumber || entries[0]?.lotNumber || 'Lot';
  const displaySize      = lot?.sizeName || lot?.size || entries[0]?.size || '';
  const displayMaterial  = lot?.material || entries[0]?.lotMaterial || '';
  const displayStatus    = lot?.status || '';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Segoe UI, Inter, Arial, sans-serif',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#f8fafc' : '#1e293b',
          width: '100%',
          maxWidth: 880,
          maxHeight: '88vh',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Modal Header Banner ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)',
            padding: '20px 24px',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              📦
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#93c5fd', textTransform: 'uppercase' }}>
                LOT PRODUCTION WORKFLOW &amp; STAFF HISTORY
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 3 }}>
                <span style={{ fontSize: 22, fontWeight: 800 }}>Lot #{displayLotNumber}</span>
                {displaySize && (
                  <span style={{ background: 'rgba(255,255,255,0.18)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    📐 Size: {displaySize}
                  </span>
                )}
                {displayMaterial && (
                  <span style={{ background: 'rgba(255,255,255,0.18)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    🧶 {displayMaterial}
                  </span>
                )}
                {displayStatus && (
                  <span style={{ background: '#22c55e', color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                    Stage: {displayStatus}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
              width: 36,
              height: 36,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: isDark ? '#94a3b8' : '#64748b' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Loading staff work history for Lot #{displayLotNumber}…</div>
            </div>
          ) : error ? (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 16, borderRadius: 12, fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          ) : workerGroups.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: isDark ? '#0f172a' : '#f8fafc',
                borderRadius: 14,
                border: `1px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
              }}
            >
              <div style={{ fontSize: 38, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#334155' }}>
                No Staff Entries Recorded Yet for Lot #{displayLotNumber}
              </div>
              <div style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', marginTop: 6 }}>
                Once workers record cutting, stitching, machine, or finishing entries on this lot, their names and tasks will appear here automatically.
              </div>
            </div>
          ) : (
            <>
              {/* ── Quick Summary Story Box ("Who did what on this lot") ── */}
              <div
                style={{
                  background: isDark ? '#0f172a' : '#f8fafc',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  borderRadius: 14,
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? '#93c5fd' : '#1d4ed8' }}>
                    👥 Staff Who Worked on Lot #{displayLotNumber} ({workerGroups.length} {workerGroups.length === 1 ? 'Person' : 'Persons'})
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>
                    Total Entries: <strong>{entries.length}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  {workerGroups.map(w => (
                    <div
                      key={w.workerId}
                      style={{
                        background: isDark ? '#1e293b' : '#ffffff',
                        border: `1px solid ${isDark ? '#334155' : w.badgeBorder}`,
                        borderLeft: `4px solid ${w.accent}`,
                        borderRadius: 10,
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: w.gradient,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {w.stageIcon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: isDark ? '#f8fafc' : '#0f172a', lineHeight: 1.3 }}>
                          <span style={{ color: w.accent }}>{w.workerName}</span> {w.actionVerb}
                        </div>
                        <div style={{ fontSize: 11.5, color: isDark ? '#94a3b8' : '#64748b', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700 }}>{w.role}</span>
                          <span>•</span>
                          <span><strong>{w.totalPieces}</strong> pcs</span>
                          <span>•</span>
                          <span>{w.rows.length} {w.rows.length === 1 ? 'entry' : 'entries'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Detailed Worker-by-Worker Breakdown ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {workerGroups.map(w => {
                  const isOpen = !!expandedWorker[w.workerId];
                  const activeCols = TASK_FIELDS.filter(f =>
                    w.rows.some(r => r[f.key] !== null && r[f.key] !== undefined && r[f.key] !== '')
                  );

                  return (
                    <div
                      key={w.workerId}
                      style={{
                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        borderRadius: 14,
                        overflow: 'hidden',
                        background: isDark ? '#1e293b' : '#ffffff',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* Worker Card Header */}
                      <div
                        onClick={() => setExpandedWorker(prev => ({ ...prev, [w.workerId]: !prev[w.workerId] }))}
                        style={{
                          padding: '14px 18px',
                          background: isDark ? 'rgba(255,255,255,0.03)' : w.badgeBg,
                          borderBottom: isOpen ? `1px solid ${isDark ? '#334155' : '#e2e8f0'}` : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 11,
                              background: w.gradient,
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: 14,
                              boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
                            }}
                          >
                            {w.initials}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 15, fontWeight: 800, color: isDark ? '#fff' : '#0f172a' }}>
                                {w.workerName}
                              </span>
                              <span
                                style={{
                                  background: w.accent,
                                  color: '#fff',
                                  padding: '2px 9px',
                                  borderRadius: 20,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {w.stageIcon} {w.role}
                              </span>
                              <span
                                style={{
                                  background: w.allCompleted ? '#dcfce7' : '#fef3c7',
                                  color: w.allCompleted ? '#166534' : '#92400e',
                                  border: `1px solid ${w.allCompleted ? '#bbf7d0' : '#fde68a'}`,
                                  padding: '2px 8px',
                                  borderRadius: 20,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {w.allCompleted ? '✓ Completed' : `${w.completedCount}/${w.rows.length} Completed`}
                              </span>
                            </div>
                            <div style={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#475569', marginTop: 3, fontWeight: 600 }}>
                              {w.workerName} <strong>{w.actionVerb}</strong>
                              {w.colors.length > 0 && ` • Colors: ${w.colors.join(', ')}`}
                              {w.machines.length > 0 && ` • Machine: ${w.machines.join(', ')}`}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {w.taskTotals.map(t => (
                            <span
                              key={t.key}
                              style={{
                                background: isDark ? '#0f172a' : '#ffffff',
                                border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                                borderRadius: 20,
                                padding: '3px 10px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: isDark ? '#e2e8f0' : '#334155',
                              }}
                            >
                              {t.label}: <strong style={{ color: w.accent }}>{t.total}</strong>
                            </span>
                          ))}
                          <span
                            style={{
                              background: w.gradient,
                              color: '#fff',
                              borderRadius: 20,
                              padding: '4px 12px',
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            Total: {w.totalPieces} pcs
                          </span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onClose();
                              navigate(`/staff/${w.workerId}`);
                            }}
                            style={{
                              background: isDark ? '#334155' : '#ffffff',
                              color: w.accent,
                              border: `1px solid ${w.accent}`,
                              borderRadius: 8,
                              padding: '5px 10px',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Open Sheet →
                          </button>
                          <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', marginLeft: 4 }}>
                            {isOpen ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {/* Worker Entries Table */}
                      {isOpen && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                            <thead>
                              <tr style={{ background: isDark ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                                <th style={thStyle(isDark)}>#</th>
                                <th style={thStyle(isDark)}>Size</th>
                                <th style={thStyle(isDark)}>Color</th>
                                {w.machines.length > 0 && <th style={thStyle(isDark)}>Machine</th>}
                                {activeCols.map(c => (
                                  <th key={c.key} style={thStyle(isDark)}>{c.label}</th>
                                ))}
                                <th style={thStyle(isDark)}>Status</th>
                                <th style={thStyle(isDark)}>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {w.rows.map((r, idx) => (
                                <tr
                                  key={r.id}
                                  style={{
                                    borderBottom: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`,
                                    background: idx % 2 === 0 ? (isDark ? '#1e293b' : '#ffffff') : (isDark ? '#162032' : '#fcfdff'),
                                  }}
                                >
                                  <td style={tdStyle(isDark)}>{idx + 1}</td>
                                  <td style={tdStyle(isDark)}>{r.size || displaySize || '—'}</td>
                                  <td style={tdStyle(isDark)}>
                                    {r.color ? (
                                      <span style={{ fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>{r.color}</span>
                                    ) : '—'}
                                  </td>
                                  {w.machines.length > 0 && <td style={tdStyle(isDark)}>{r.machine || '—'}</td>}
                                  {activeCols.map(c => (
                                    <td
                                      key={c.key}
                                      style={{
                                        ...tdStyle(isDark),
                                        fontWeight: c.key === 'totalPiece' ? 800 : 600,
                                        color: c.key === 'totalPiece' ? w.accent : (isDark ? '#e2e8f0' : '#1e293b'),
                                      }}
                                    >
                                      {r[c.key] ?? '—'}
                                    </td>
                                  ))}
                                  <td style={tdStyle(isDark)}>
                                    <span
                                      style={{
                                        color: r.completed ? '#16a34a' : '#d97706',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {r.completed ? '✓ Done' : '⏳ Pending'}
                                    </span>
                                  </td>
                                  <td style={tdStyle(isDark)}>
                                    {r.dateCompleted
                                      ? new Date(r.dateCompleted).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
                                      : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            background: isDark ? '#0f172a' : '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const thStyle = (isDark) => ({
  padding: '9px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: isDark ? '#94a3b8' : '#64748b',
  whiteSpace: 'nowrap',
});

const tdStyle = (isDark) => ({
  padding: '9px 12px',
  color: isDark ? '#e2e8f0' : '#334155',
  whiteSpace: 'nowrap',
});

