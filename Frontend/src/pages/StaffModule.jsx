import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkerEntries, useDropdowns } from '../hooks/useHooks';
import WorkerTable from '../components/WorkerTable';
import { getAllWorkers, getWageRates } from '../services/api';
import { useTheme } from '../context/ThemeContext';

// ── Column presets based on worker process / role ──
// Note: Size and Color are bound exclusively to Machine Operator (FAIZAN_COLS)
const GENERIC_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'front',         label: 'Front' },
  { key: 'bazo',          label: 'Bazo' },
  { key: 'tape',          label: 'Tape' },
  { key: 'pocket',        label: 'Pocket' },
  { key: 'gala',          label: 'Gala' },
  { key: 'lable',         label: 'Lable' },
  { key: 'moda',          label: 'Moda' },
  { key: 'quantity',      label: 'Quantity' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];

const ALI_HASSAN_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'front',         label: 'Front' },
  { key: 'bazo',          label: 'Bazo' },
  { key: 'quantity',      label: 'Quantity' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];

const FAIZAN_COLS = [
  { key: 'machine',       label: 'Machine Name' },
  { key: 'size',          label: 'Size' },
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'color',         label: 'Color' },
  { key: 'front',         label: 'Front' },
  { key: 'bazo',          label: 'Bazo' },
  { key: 'tape',          label: 'Tape' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];

const GUJJAR_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'front',         label: 'Front' },
  { key: 'bazo',          label: 'Bazo' },
  { key: 'tape',          label: 'Tape' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];

const FINISHING_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'pocket',        label: 'Pocket' },
  { key: 'gala',          label: 'Gala' },
  { key: 'lable',         label: 'Lable' },
  { key: 'moda',          label: 'Moda' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];

const SAFTY_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'quantity',      label: 'Quantity' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];

const KAJ_BUTTON_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'quantity',      label: 'Quantity' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];

// ── Beautiful, Vibrant Color Palettes & Gradients for Each Staff Member ──
const PRESETS_BY_ID = {
  1: {
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)',
    glow: 'rgba(37, 99, 235, 0.4)',
    accent: '#2563eb',
    cols: ALI_HASSAN_COLS,
    role: 'Cutting / Cutter',
    avatar: 'AH',
    dept: 'Cutting',
  },
  2: {
    gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 55%, #10b981 100%)',
    glow: 'rgba(16, 185, 129, 0.4)',
    accent: '#059669',
    cols: FAIZAN_COLS,
    role: 'Machine / Knitting',
    avatar: 'FS',
    dept: 'Stitching',
  },
  3: {
    gradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 55%, #6366f1 100%)',
    glow: 'rgba(99, 102, 241, 0.4)',
    accent: '#4f46e5',
    cols: GUJJAR_COLS,
    role: 'Pressing / Iron',
    avatar: 'GP',
    dept: 'Pressing',
  },
  4: {
    gradient: 'linear-gradient(135deg, #831843 0%, #be123c 55%, #e11d48 100%)',
    glow: 'rgba(225, 29, 72, 0.4)',
    accent: '#e11d48',
    cols: FINISHING_COLS,
    role: 'Tailor / Stitching',
    avatar: 'AR',
    dept: 'Stitching',
  },
  5: {
    gradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 55%, #8b5cf6 100%)',
    glow: 'rgba(139, 92, 246, 0.4)',
    accent: '#7c3aed',
    cols: FINISHING_COLS,
    role: 'Tailor / Stitching',
    avatar: 'NZ',
    dept: 'Stitching',
  },
  6: {
    gradient: 'linear-gradient(135deg, #164e63 0%, #0891b2 55%, #06b6d4 100%)',
    glow: 'rgba(6, 182, 212, 0.4)',
    accent: '#0891b2',
    cols: SAFTY_COLS,
    role: 'Overlock / Safty',
    avatar: 'UM',
    dept: 'Overlock',
  },
  7: {
    gradient: 'linear-gradient(135deg, #064e3b 0%, #0d9488 55%, #14b8a6 100%)',
    glow: 'rgba(20, 184, 166, 0.4)',
    accent: '#0d9488',
    cols: SAFTY_COLS,
    role: 'Rafo / Mending',
    avatar: 'UR',
    dept: 'Overlock',
  },
  8: {
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 55%, #f97316 100%)',
    glow: 'rgba(249, 115, 22, 0.4)',
    accent: '#ea580c',
    cols: KAJ_BUTTON_COLS,
    role: 'Kaj / Buttonhole',
    avatar: 'BK',
    dept: 'Kaj & Button',
  },
  9: {
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 55%, #60a5fa 100%)',
    glow: 'rgba(59, 130, 246, 0.4)',
    accent: '#2563eb',
    cols: KAJ_BUTTON_COLS,
    role: 'Button Attaching',
    avatar: 'BW',
    dept: 'Kaj & Button',
  },
  10: {
    gradient: 'linear-gradient(135deg, #134e4a 0%, #0d9488 55%, #2dd4bf 100%)',
    glow: 'rgba(45, 212, 191, 0.4)',
    accent: '#0d9488',
    cols: GENERIC_COLS,
    role: 'Production Staff',
    avatar: 'HI',
    dept: 'Production',
  },
  11: {
    gradient: 'linear-gradient(135deg, #881337 0%, #c026d3 55%, #ec4899 100%)',
    glow: 'rgba(236, 72, 153, 0.4)',
    accent: '#c026d3',
    cols: GENERIC_COLS,
    role: 'Master Cutter',
    avatar: 'MR',
    dept: 'Cutting',
  },
};

function getWorkerConfig(worker) {
  if (!worker) {
    return {
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
      glow: 'rgba(37, 99, 235, 0.4)',
      accent: '#2563eb',
      cols: GENERIC_COLS,
      role: 'Staff Member',
      avatar: 'WK',
      dept: 'General',
    };
  }

  const rawRole = (worker.sheetType || worker.role || '').trim();
  const st = (rawRole || worker.name || '').toLowerCase();
  let cols = GENERIC_COLS;
  let role = rawRole || 'Production Staff';
  let gradient = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
  let glow = 'rgba(59, 130, 246, 0.4)';
  let accent = '#3b82f6';
  let dept = 'General';

  if (st.includes('machine') || st.includes('faizan')) {
    cols = FAIZAN_COLS; role = rawRole || 'Machine Op'; dept = 'Stitching';
    gradient = 'linear-gradient(135deg, #064e3b 0%, #059669 55%, #10b981 100%)';
    accent = '#059669'; glow = 'rgba(16, 185, 129, 0.4)';
  } else if (st.includes('ali') || st.includes('hassan') || st.includes('cutting') || st.includes('cutter')) {
    cols = ALI_HASSAN_COLS; role = rawRole || 'Cutting'; dept = 'Cutting';
    gradient = 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)';
    accent = '#2563eb'; glow = 'rgba(37, 99, 235, 0.4)';
  } else if (st.includes('press') || st.includes('gujjar') || st.includes('iron')) {
    cols = GUJJAR_COLS; role = rawRole || 'Pressing'; dept = 'Pressing';
    gradient = 'linear-gradient(135deg, #312e81 0%, #4f46e5 55%, #6366f1 100%)';
    accent = '#4f46e5'; glow = 'rgba(99, 102, 241, 0.4)';
  } else if (st.includes('arslan') || st.includes('stitch') || st.includes('tailor')) {
    cols = FINISHING_COLS; role = rawRole || 'Stitching'; dept = 'Stitching';
    gradient = 'linear-gradient(135deg, #831843 0%, #be123c 55%, #e11d48 100%)';
    accent = '#e11d48'; glow = 'rgba(225, 29, 72, 0.4)';
  } else if (st.includes('nazir') || st.includes('finish')) {
    cols = FINISHING_COLS; role = rawRole || 'Finishing'; dept = 'Finishing';
    gradient = 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 55%, #8b5cf6 100%)';
    accent = '#7c3aed'; glow = 'rgba(139, 92, 246, 0.4)';
  } else if (st.includes('safty') || st.includes('safety') || st.includes('overlock')) {
    cols = SAFTY_COLS; role = rawRole || 'Safety'; dept = 'Overlock';
    gradient = 'linear-gradient(135deg, #164e63 0%, #0891b2 55%, #06b6d4 100%)';
    accent = '#0891b2'; glow = 'rgba(6, 182, 212, 0.4)';
  } else if (st.includes('rafo')) {
    cols = SAFTY_COLS; role = rawRole || 'Rafo / Mending'; dept = 'Overlock';
    gradient = 'linear-gradient(135deg, #064e3b 0%, #0d9488 55%, #14b8a6 100%)';
    accent = '#0d9488'; glow = 'rgba(20, 184, 166, 0.4)';
  } else if (st.includes('kaj') || st.includes('button')) {
    cols = KAJ_BUTTON_COLS; role = rawRole || 'Kaj & Button'; dept = 'Kaj & Button';
    gradient = 'linear-gradient(135deg, #7c2d12 0%, #ea580c 55%, #f97316 100%)';
    accent = '#ea580c'; glow = 'rgba(249, 115, 22, 0.4)';
  } else if (PRESETS_BY_ID[worker.id]) {
    const preset = PRESETS_BY_ID[worker.id];
    gradient = preset.gradient;
    glow = preset.glow;
    accent = preset.accent;
  }

  const initials = worker.name
    ? worker.name.trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()
    : 'WK';

  return { cols, gradient, glow, accent, role, avatar: initials, dept };
}

// ── Main Staff Module Component ──
export default function StaffModule() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark, currentColor } = useTheme();

  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const tabsScrollRef = useRef(null);

  // Load staff list (both active and inactive)
  useEffect(() => {
    setLoadingWorkers(true);
    getAllWorkers()
      .then(ws => setWorkers(ws || []))
      .catch(err => console.error('Failed to load workers:', err))
      .finally(() => setLoadingWorkers(false));
  }, []);

  const activeCount = useMemo(() => workers.filter(w => w.isActive !== false).length, [workers]);
  const inactiveCount = useMemo(() => workers.filter(w => w.isActive === false).length, [workers]);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    let list = workers;
    if (selectedDept !== 'ALL') {
      list = list.filter(w => {
        const cfg = getWorkerConfig(w);
        return cfg.dept.toLowerCase() === selectedDept.toLowerCase();
      });
    }
    if (statusFilter !== 'ALL') {
      list = list.filter(w => {
        const isAct = w.isActive !== false;
        return statusFilter === 'ACTIVE' ? isAct : !isAct;
      });
    }
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      list = list.filter(w => {
        const cfg = getWorkerConfig(w);
        return (w.name || '').toLowerCase().includes(q) ||
               (w.sheetType || '').toLowerCase().includes(q) ||
               cfg.role.toLowerCase().includes(q) ||
               cfg.dept.toLowerCase().includes(q);
      });
    }
    return list;
  }, [workers, selectedDept, statusFilter, filterQuery]);

  // Unique departments for filter pills
  const departments = useMemo(() => {
    const set = new Set();
    workers.forEach(w => {
      const cfg = getWorkerConfig(w);
      if (cfg.dept) set.add(cfg.dept);
    });
    return ['ALL', ...Array.from(set)];
  }, [workers]);

  // Check if viewing a specific worker's sheet
  const isDetailView = Boolean(id);

  const activeWorkerId = useMemo(() => {
    if (!id) return null;
    const parsed = Number(id);
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  }, [id]);

  const activeWorker = useMemo(() => {
    if (!activeWorkerId) return null;
    return workers.find(w => w.id === activeWorkerId) || { id: activeWorkerId, name: `Worker #${activeWorkerId}` };
  }, [workers, activeWorkerId]);

  const activeConfig = useMemo(() => {
    return getWorkerConfig(activeWorker);
  }, [activeWorker]);

  // Load entries for active worker
  const { entries, loading: entriesLoading, reload: reloadEntries } = useWorkerEntries(activeWorkerId || 0);
  const dropdowns = useDropdowns();

  // Scroll tabs helper
  const scrollTabs = (direction) => {
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollBy({ left: direction * 240, behavior: 'smooth' });
    }
  };

  const [workerRate, setWorkerRate] = useState(0);
  const [entryRates, setEntryRates] = useState({});

  useEffect(() => {
    if (!activeWorkerId) return;
    const savedRate = localStorage.getItem(`cm_worker_rate_${activeWorkerId}`);
    if (savedRate) setWorkerRate(Number(savedRate));
    try {
      setEntryRates(JSON.parse(localStorage.getItem(`cm_entry_rates_${activeWorkerId}`) || '{}'));
    } catch {
      setEntryRates({});
    }

    getWageRates(activeWorkerId).then(rates => {
      if (Array.isArray(rates) && rates.length > 0) {
        const r = rates.find(x => x.taskType?.toLowerCase() === 'quantity' || x.taskType?.toLowerCase() === 'cutting') || rates[0];
        if (r && r.ratePerPiece != null && Number(r.ratePerPiece) > 0) {
          setWorkerRate(Number(r.ratePerPiece));
          localStorage.setItem(`cm_worker_rate_${activeWorkerId}`, String(r.ratePerPiece));
        }
      }
    }).catch(() => {});
  }, [activeWorkerId]);

  // Quick stats for active worker (including sum of all payments / total amount)
  const stats = useMemo(() => {
    if (!entries || entries.length === 0) {
      return { totalEntries: 0, uniqueLots: 0, totalPieces: 0, completedPieces: 0, totalAmount: 0 };
    }
    const totalEntries = entries.length;
    const uniqueLots = new Set(entries.map(e => e.lotNumber).filter(Boolean)).size;
    const totalPieces = entries.reduce((s, e) => s + (Number(e.totalPiece || e.quantity || 0) || 0), 0);
    const completedPieces = entries.reduce((s, e) => s + (Number(e.completed || 0) || 0), 0);

    const totalAmount = entries.reduce((sum, e) => {
      const rowRate = e.rate != null && e.rate !== '' 
        ? Number(e.rate) 
        : (entryRates[e.id] != null ? Number(entryRates[e.id]) : Number(workerRate || 0));
      const qty = Number(e.quantity != null && e.quantity !== '' ? e.quantity : (e.totalPiece || 0)) || 0;
      return sum + (rowRate * qty);
    }, 0);

    return { totalEntries, uniqueLots, totalPieces, completedPieces, totalAmount };
  }, [entries, workerRate, entryRates]);

  // ─────────────────────────────────────────────────────────────
  // VIEW 1: WHOLE SCREEN STAFF TABS DIRECTORY (when !id)
  // ─────────────────────────────────────────────────────────────
  if (!isDetailView) {
    return (
      <div style={styles.container} className="hide-scrollbar">
        {/* Top POS Header */}
        <div style={styles.posHeader(isDark)}>
          <div style={styles.headerLeft}>
            <span style={styles.headerIcon}>🧵</span>
            <div>
              <h1 style={styles.title(isDark)}>Workforce Staff Directory</h1>
              <p style={styles.subtitle(isDark)}>
                Touch or click any staff tab to open their production sheet and record entries
              </p>
            </div>
          </div>

          {/* Quick Filter & Count */}
          <div style={styles.searchWrap}>
            <div style={styles.searchBox(isDark)}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Search staff by name or role..."
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                style={styles.searchInput(isDark)}
              />
              {filterQuery && (
                <button onClick={() => setFilterQuery('')} style={styles.clearBtn(isDark)}>✕</button>
              )}
            </div>
            <span style={styles.countBadge(isDark, currentColor)}>
              {filteredWorkers.length} Staff Members
            </span>
          </div>
        </div>

        {/* Process Category & Status Filter Pills */}
        <div style={styles.deptFilterBar(isDark)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={styles.processLabel(isDark)}>PROCESS:</span>
            {departments.map(dept => {
              const isSel = selectedDept === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  style={styles.deptPill(isSel, isDark, currentColor)}
                >
                  {dept === 'ALL' ? 'All Staff' : dept}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
            <span style={styles.processLabel(isDark)}>STATUS:</span>
            {[
              { id: 'ALL', label: `All (${workers.length})` },
              { id: 'ACTIVE', label: `Active (${activeCount})` },
              { id: 'INACTIVE', label: `Inactive (${inactiveCount})` },
            ].map(({ id: stId, label: stLabel }) => {
              const isSel = statusFilter === stId;
              return (
                <button
                  key={stId}
                  onClick={() => setStatusFilter(stId)}
                  style={styles.statusFilterPill(isSel, isDark, currentColor)}
                >
                  {stLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── WHOLE SCREEN STAFF TABS GRID (Clean 2-row layout with vibrant colors) ── */}
        {loadingWorkers ? (
          <div style={styles.loadingBox(isDark)}>
            <div style={styles.spinner} />
            <div style={{ marginTop: 14, fontWeight: 600 }}>Loading staff members...</div>
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div style={styles.emptyGrid(isDark)}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isDark ? '#fff' : '#1e293b' }}>
              No staff members found
            </div>
            <p style={{ color: isDark ? 'var(--text-muted)' : '#64748b', margin: '6px 0 16px' }}>
              No staff matched your criteria.
            </p>
            <button
              onClick={() => { setFilterQuery(''); setSelectedDept('ALL'); setStatusFilter('ALL'); }}
              style={styles.resetBtn(currentColor)}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div style={styles.staffGrid}>
            {filteredWorkers.map(w => {
              const cfg = getWorkerConfig(w);
              const isStaffActive = w.isActive !== false;

              return (
                <div
                  key={w.id}
                  onClick={() => navigate(`/staff/${w.id}`)}
                  style={styles.staffCard(cfg.gradient, cfg.glow, isStaffActive)}
                  role="button"
                  tabIndex={0}
                  title={`Open ${w.name}'s production sheet (${isStaffActive ? 'Active' : 'Inactive'})`}
                >
                  {/* Subtle top glare overlay */}
                  <div style={styles.cardShine} />

                  {/* Card Header: Initials Avatar, Staff Status & Worker ID */}
                  <div style={styles.cardHeader}>
                    <div style={styles.cardAvatar}>
                      {cfg.avatar}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={styles.staffStatusBadge(isStaffActive)}>
                        <span style={styles.staffStatusDot(isStaffActive)} />
                        {isStaffActive ? 'Active' : 'Inactive'}
                      </span>
                      <span style={styles.workerIdBadge}>
                        #{w.id}
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Name & Role Pill */}
                  <div style={styles.cardBody}>
                    <h3 style={styles.cardName}>{w.name}</h3>
                    <div style={styles.cardRoleWrap}>
                      <span style={styles.cardRolePill}>{cfg.role}</span>
                    </div>
                  </div>

                  {/* Card Footer: Action button */}
                  <div style={styles.cardFooter}>
                    <span style={styles.openSheetText}>Open Sheet</span>
                    <span style={styles.cardArrow}>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // VIEW 2: STAFF DETAIL PAGE (when clicking a staff member)
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={styles.container} className="hide-scrollbar">
      {/* ── Top Bar with Back Button & Breadcrumbs ── */}
      <div style={styles.detailHeader(isDark)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button
            onClick={() => navigate('/staff')}
            style={styles.backBtn(isDark, currentColor)}
            title="Return to whole screen staff tabs"
          >
            ← Back to All Staff
          </button>
          <div style={styles.breadcrumb(isDark)}>
            <span>Staff</span>
            <span style={{ opacity: 0.5 }}>/</span>
            <strong style={{ color: activeConfig.accent }}>{activeWorker?.name}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={styles.countBadge(isDark, currentColor)}>
            {workers.length} Total Staff
          </span>
        </div>
      </div>

      {/* ── POS Tabs Bar across the top of Detail Page ── */}
      <div style={styles.tabsOuterWrap(isDark)}>
        {/* Scroll Left Button */}
        <button
          onClick={() => scrollTabs(-1)}
          style={styles.scrollBtn(isDark)}
          title="Scroll Left"
          aria-label="Scroll Tabs Left"
        >
          ‹
        </button>

        {/* Horizontal Tabs Bar */}
        <div ref={tabsScrollRef} style={styles.tabsScroller} className="hide-scrollbar">
          {workers.map(w => {
            const isSelected = w.id === activeWorkerId;
            const cfg = getWorkerConfig(w);
            const isStaffActive = w.isActive !== false;

            return (
              <button
                key={w.id}
                onClick={() => navigate(`/staff/${w.id}`)}
                style={styles.tabBtn(isSelected, isDark, cfg.gradient, cfg.glow, cfg.accent)}
                title={`${w.name} (${cfg.role}) — ${isStaffActive ? 'Active' : 'Inactive'}`}
              >
                {/* Worker Initials Avatar */}
                <div style={styles.tabAvatar(isSelected, cfg.accent)}>
                  {cfg.avatar}
                </div>

                {/* Worker Name and Role */}
                <div style={styles.tabText}>
                  <div style={styles.tabName(isSelected, isDark)}>{w.name}</div>
                  <div style={styles.tabRole(isSelected, isDark)}>{cfg.role}</div>
                </div>

                {/* Status Indicator Badge on EVERY staff tab */}
                <div style={styles.tabStatusBadge(isStaffActive, isSelected, isDark)}>
                  <span style={styles.tabStatusDot(isStaffActive, isSelected)} />
                  {isStaffActive ? 'Active' : 'Inactive'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          onClick={() => scrollTabs(1)}
          style={styles.scrollBtn(isDark)}
          title="Scroll Right"
          aria-label="Scroll Tabs Right"
        >
          ›
        </button>
      </div>

      {/* ── Active Worker Banner & Live Quick Stats ── */}
      <div style={styles.activeBanner(activeConfig.gradient, activeConfig.glow)}>
        <div style={styles.bannerInfo}>
          <div style={styles.bannerAvatar(activeConfig.accent)}>
            {activeConfig.avatar}
          </div>
          <div>
            <div style={styles.bannerNameWrap}>
              <h2 style={styles.bannerName}>{activeWorker?.name}</h2>
              <span style={styles.bannerBadge}>{activeConfig.role}</span>
              <span style={styles.bannerStatusBadge(activeWorker?.isActive !== false)}>
                <span style={styles.bannerStatusDot(activeWorker?.isActive !== false)} />
                {activeWorker?.isActive !== false ? 'Active Staff' : 'Inactive Staff'}
              </span>
            </div>
            <div style={styles.bannerMeta}>
              Worker ID #{activeWorker?.id} · {activeConfig.dept} Department
            </div>
          </div>
        </div>

        {/* Quick KPI stats for the active worker */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{stats.uniqueLots}</div>
            <div style={styles.statLabel}>Lots</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{stats.totalEntries}</div>
            <div style={styles.statLabel}>Entries</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{stats.totalPieces.toLocaleString()}</div>
            <div style={styles.statLabel}>Total Pcs</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statNumber, color: '#86efac' }}>{stats.completedPieces.toLocaleString()}</div>
            <div style={styles.statLabel}>Completed</div>
          </div>
          <div style={{ ...styles.statCard, background: 'rgba(255, 255, 255, 0.22)', border: '1px solid rgba(255, 255, 255, 0.35)', minWidth: 80 }}>
            <div style={{ ...styles.statNumber, color: '#fef08a' }}>
              ₨ {stats.totalAmount.toLocaleString()}
            </div>
            <div style={{ ...styles.statLabel, color: '#fef9c3', fontWeight: 700 }}>Total Amount</div>
          </div>
        </div>
      </div>

      {/* ── Worker Table Section ── */}
      <div style={styles.tableCard(isDark)}>
        {entriesLoading ? (
          <div style={styles.loadingBox(isDark)}>
            <div style={styles.spinner} />
            <div style={{ marginTop: 12, fontWeight: 600 }}>Loading production entries for {activeWorker?.name}...</div>
          </div>
        ) : (
          <WorkerTable
            key={`worker-${activeWorkerId}`}
            workerId={activeWorkerId}
            columns={activeConfig.cols}
            entries={entries}
            reload={reloadEntries}
            dropdowns={dropdowns}
            workerRate={workerRate}
            onWorkerRateChange={setWorkerRate}
            entryRates={entryRates}
            onEntryRatesChange={setEntryRates}
          />
        )}
      </div>
    </div>
  );
}

// ── Styles (Vibrant POS Theme & Scroll-Free Feel) ──
const styles = {
  container: {
    padding: '1rem 1.25rem',
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
  posHeader: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginBottom: '0.85rem',
    padding: '0.9rem 1.25rem',
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    boxShadow: 'var(--shadow-sm)',
  }),
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  headerIcon: {
    fontSize: '2rem',
    lineHeight: 1,
  },
  title: (isDark) => ({
    fontSize: '1.35rem',
    fontWeight: 700,
    color: isDark ? 'var(--text-main)' : '#0f172a',
    margin: 0,
    letterSpacing: '-0.02em',
  }),
  subtitle: (isDark) => ({
    fontSize: '0.825rem',
    color: isDark ? 'var(--text-muted)' : '#64748b',
    margin: '3px 0 0 0',
  }),
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  searchBox: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    background: isDark ? 'var(--bg-subtle)' : '#f8fafc',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
    borderRadius: 8,
    padding: '6px 12px',
    width: 240,
    transition: 'border-color .15s',
  }),
  searchIcon: {
    fontSize: '0.9rem',
    marginRight: 6,
    opacity: 0.6,
  },
  searchInput: (isDark) => ({
    border: 'none',
    background: 'transparent',
    color: isDark ? 'var(--text-main)' : '#0f172a',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
  }),
  clearBtn: (isDark) => ({
    background: 'transparent',
    border: 'none',
    color: isDark ? 'var(--text-muted)' : '#94a3b8',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0 4px',
  }),
  countBadge: (isDark, currentColor) => ({
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: 20,
    background: isDark ? '#1e293b' : '#e0e7ff',
    color: currentColor.primary,
    border: `1px solid ${isDark ? '#334155' : '#c7d2fe'}`,
    whiteSpace: 'nowrap',
  }),

  // Process Category Filter Bar
  deptFilterBar: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
    padding: '0.1rem 0.1rem',
  }),
  processLabel: (isDark) => ({
    fontSize: '0.75rem',
    fontWeight: 800,
    color: isDark ? 'var(--text-muted)' : '#64748b',
    marginRight: 4,
    letterSpacing: '0.04em',
  }),
  deptPill: (isSel, isDark, currentColor) => ({
    padding: '5px 13px',
    borderRadius: 16,
    border: isSel ? `1px solid ${currentColor.primary}` : `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    background: isSel ? currentColor.primary : (isDark ? 'var(--bg-card)' : '#ffffff'),
    color: isSel ? '#ffffff' : (isDark ? 'var(--text-main)' : '#475569'),
    fontSize: '0.8rem',
    fontWeight: isSel ? 700 : 600,
    cursor: 'pointer',
    boxShadow: isSel ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
    transition: 'all 0.15s ease-in-out',
  }),
  statusFilterPill: (isSel, isDark, currentColor) => ({
    padding: '5px 12px',
    borderRadius: 16,
    border: isSel ? `1px solid ${currentColor.primary}` : `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    background: isSel ? currentColor.primary : (isDark ? 'var(--bg-card)' : '#ffffff'),
    color: isSel ? '#ffffff' : (isDark ? 'var(--text-main)' : '#475569'),
    fontSize: '0.78rem',
    fontWeight: isSel ? 700 : 600,
    cursor: 'pointer',
    boxShadow: isSel ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
    transition: 'all 0.15s ease-in-out',
  }),

  // ── WHOLE SCREEN STAFF TABS GRID (Beautiful POS style) ──
  staffGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))',
    gap: '0.85rem',
  },
  staffCard: (gradient, glow, isStaffActive = true) => ({
    background: gradient,
    borderRadius: 14,
    padding: '1.1rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 155,
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    color: '#ffffff',
    boxShadow: isStaffActive ? `0 6px 18px ${glow}` : '0 4px 14px rgba(0,0,0,0.22)',
    border: isStaffActive ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(248, 113, 113, 0.65)',
    filter: isStaffActive ? 'none' : 'grayscale(15%)',
    transition: 'transform 0.16s ease, box-shadow 0.16s ease',
  }),
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)',
    pointerEvents: 'none',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.65rem',
    position: 'relative',
    zIndex: 1,
  },
  cardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: '#ffffff',
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '1rem',
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.2)',
  },
  staffStatusBadge: (isActive) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 8px',
    borderRadius: 12,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    background: isActive ? 'rgba(255, 255, 255, 0.22)' : 'rgba(220, 53, 69, 0.4)',
    border: isActive ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid rgba(248, 113, 113, 0.5)',
    color: '#ffffff',
    backdropFilter: 'blur(4px)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  }),
  staffStatusDot: (isActive) => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: isActive ? '#4ade80' : '#f87171',
    boxShadow: isActive ? '0 0 6px #4ade80' : '0 0 6px #f87171',
    flexShrink: 0,
  }),
  workerIdBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.22)',
    backdropFilter: 'blur(4px)',
    color: '#ffffff',
    letterSpacing: '0.03em',
  },
  cardBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    position: 'relative',
    zIndex: 1,
  },
  cardName: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
    letterSpacing: '-0.01em',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
  },
  cardRoleWrap: {
    marginTop: 2,
  },
  cardRolePill: {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 12,
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(4px)',
    color: '#ffffff',
    display: 'inline-block',
  },
  cardMeta: {
    fontSize: '0.75rem',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  cardFooter: {
    marginTop: '0.85rem',
    paddingTop: '0.55rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
  },
  openSheetText: {
    fontSize: '0.775rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '0.02em',
  },
  cardArrow: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#ffffff',
  },

  // Detail View Header
  detailHeader: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    padding: '0.75rem 1.25rem',
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 12,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    boxShadow: 'var(--shadow-sm)',
  }),
  backBtn: (isDark, currentColor) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 8,
    background: isDark ? 'var(--bg-subtle)' : '#f1f5f9',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
    color: isDark ? 'var(--text-main)' : '#1e293b',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),
  breadcrumb: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.925rem',
    color: isDark ? 'var(--text-main)' : '#1e293b',
  }),

  // Tabs Outer Container (Detail View)
  tabsOuterWrap: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    marginBottom: '0.85rem',
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    padding: '0.55rem 0.75rem',
    borderRadius: 12,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    boxShadow: 'var(--shadow-sm)',
    position: 'relative',
  }),
  scrollBtn: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 46,
    borderRadius: 8,
    background: isDark ? 'var(--bg-subtle)' : '#f1f5f9',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
    color: isDark ? 'var(--text-main)' : '#334155',
    fontSize: '1.4rem',
    cursor: 'pointer',
    flexShrink: 0,
  }),
  tabsScroller: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    padding: '4px 2px',
    flex: 1,
  },

  // Detail Tab Button
  tabBtn: (isActive, isDark, gradient, glow, accent) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '8px 14px',
    minWidth: 165,
    borderRadius: 10,
    background: isActive ? gradient : (isDark ? 'var(--bg-subtle)' : '#ffffff'),
    border: isActive
      ? '1px solid rgba(255,255,255,0.3)'
      : `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    boxShadow: isActive ? `0 4px 14px ${glow}` : 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.16s ease-in-out',
    position: 'relative',
    flexShrink: 0,
    color: isActive ? '#ffffff' : (isDark ? 'var(--text-main)' : '#1e293b'),
  }),
  tabAvatar: (isActive, accent) => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    background: isActive ? '#ffffff' : `${accent}20`,
    color: isActive ? accent : accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.8rem',
    flexShrink: 0,
  }),
  tabText: {
    flex: 1,
    overflow: 'hidden',
  },
  tabName: (isActive, isDark) => ({
    fontSize: '0.875rem',
    fontWeight: isActive ? 700 : 600,
    color: isActive ? '#ffffff' : (isDark ? 'var(--text-main)' : '#1e293b'),
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  tabRole: (isActive, isDark) => ({
    fontSize: '0.72rem',
    color: isActive ? 'rgba(255,255,255,0.85)' : (isDark ? 'var(--text-muted)' : '#64748b'),
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: 1,
  }),
  activePill: {
    fontSize: '0.65rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '2px 7px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.25)',
    color: '#ffffff',
    flexShrink: 0,
  },
  tabStatusBadge: (isStaffActive, isSelected, isDark) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.65rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '2px 7px',
    borderRadius: 10,
    background: isSelected
      ? 'rgba(255, 255, 255, 0.25)'
      : (isStaffActive ? (isDark ? '#052c17' : '#d1e7dd') : (isDark ? '#2c0b0e' : '#f8d7da')),
    color: isSelected
      ? '#ffffff'
      : (isStaffActive ? (isDark ? '#4ade80' : '#0f5132') : (isDark ? '#f87171' : '#842029')),
    border: isSelected
      ? '1px solid rgba(255, 255, 255, 0.35)'
      : `1px solid ${isStaffActive ? (isDark ? '#14532d' : '#badbcc') : (isDark ? '#7f1d1d' : '#f5c2c7')}`,
    flexShrink: 0,
  }),
  tabStatusDot: (isStaffActive, isSelected) => ({
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: isSelected
      ? (isStaffActive ? '#4ade80' : '#fca5a5')
      : (isStaffActive ? '#16a34a' : '#dc2626'),
    flexShrink: 0,
  }),

  // Selected Worker Banner
  activeBanner: (gradient, glow) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    background: gradient,
    color: '#ffffff',
    borderRadius: 12,
    padding: '1.1rem 1.4rem',
    marginBottom: '0.85rem',
    boxShadow: `0 6px 20px ${glow}`,
  }),
  bannerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  bannerAvatar: (accent) => ({
    width: 48,
    height: 48,
    borderRadius: 12,
    background: '#ffffff',
    color: accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '1.2rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  }),
  bannerNameWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  bannerName: {
    fontSize: '1.35rem',
    fontWeight: 700,
    margin: 0,
    color: '#ffffff',
  },
  bannerBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.22)',
    backdropFilter: 'blur(4px)',
    color: '#ffffff',
  },
  bannerStatusBadge: (isStaffActive) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 14,
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    background: isStaffActive ? 'rgba(255,255,255,0.22)' : 'rgba(220, 53, 69, 0.4)',
    backdropFilter: 'blur(4px)',
    border: isStaffActive ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(248, 113, 113, 0.5)',
    color: '#ffffff',
  }),
  bannerStatusDot: (isStaffActive) => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: isStaffActive ? '#4ade80' : '#f87171',
    boxShadow: isStaffActive ? '0 0 6px #4ade80' : '0 0 6px #f87171',
    flexShrink: 0,
  }),
  bannerMeta: {
    fontSize: '0.825rem',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    flexWrap: 'wrap',
  },
  statCard: {
    background: 'rgba(255, 255, 255, 0.18)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: 10,
    padding: '7px 13px',
    textAlign: 'center',
    minWidth: 65,
  },
  statNumber: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  statLabel: {
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },

  // Table Card Wrapper
  tableCard: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 12,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  }),
  loadingBox: (isDark) => ({
    padding: '3.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: isDark ? 'var(--text-muted)' : '#64748b',
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
  }),
  emptyGrid: (isDark) => ({
    padding: '3.5rem 2rem',
    textAlign: 'center',
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
  }),
  resetBtn: (currentColor) => ({
    padding: '8px 18px',
    background: currentColor.primary,
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    cursor: 'pointer',
  }),
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #cbd5e1',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
