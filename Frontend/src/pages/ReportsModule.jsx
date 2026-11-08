import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area,
} from 'recharts';
import {
  getReportFinanceSummary, getReportSalesByCustomer, getReportMonthlyCashFlow,
  getReportPaymentMethods, getReportAccountStatement, getReportExpenses,
  getReportPayroll, getAccounts,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';

// ─── Bootstrap 5 Palette & Colors ─────────────────────────────────────────────
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
  teal:      '#20c997',
};

const PIE_COLORS = [BT.success, BT.warning, BT.purple, BT.info, BT.danger, BT.primary, BT.teal, BT.orange];

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt     = n => `Rs ${Number(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtK    = n => {
  const v = Number(n ?? 0);
  return v >= 1000000 ? `Rs ${(v/1000000).toFixed(1)}M` : v >= 1000 ? `Rs ${(v/1000).toFixed(0)}K` : `Rs ${v}`;
};
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtShort= d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) : '—';
const pct     = (v, max) => max > 0 ? Math.min(100, Math.round((v / max) * 100)) : 0;

// ─── Period Presets ───────────────────────────────────────────────────────────
function getToday() { return new Date().toISOString().split('T')[0]; }

function presetDates(id) {
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth(), d = now.getDate();
  const pad = n => String(n).padStart(2, '0');
  const iso = dt => dt.toISOString().split('T')[0];

  switch (id) {
    case 'today': { const t = getToday(); return [t, t]; }
    case 'yesterday': {
      const y2 = new Date(now); y2.setDate(d - 1);
      const s = iso(y2); return [s, s];
    }
    case 'week': {
      const mon = new Date(now);
      mon.setDate(d - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      return [iso(mon), getToday()];
    }
    case 'last7': {
      const s = new Date(now); s.setDate(d - 6);
      return [iso(s), getToday()];
    }
    case 'month':
      return [`${y}-${pad(mo + 1)}-01`, getToday()];
    case 'lastmonth': {
      const lm = mo === 0 ? 12 : mo;
      const ly = mo === 0 ? y - 1 : y;
      const last = new Date(ly, lm, 0).getDate();
      return [`${ly}-${pad(lm)}-01`, `${ly}-${pad(lm)}-${last}`];
    }
    case 'quarter': {
      const qStart = Math.floor(mo / 3) * 3;
      return [`${y}-${pad(qStart + 1)}-01`, getToday()];
    }
    case 'year':
      return [`${y}-01-01`, getToday()];
    default: return [null, null];
  }
}

const PRESETS = [
  { id: 'today',     label: 'Today'       },
  { id: 'yesterday', label: 'Yesterday'   },
  { id: 'week',      label: 'This Week'   },
  { id: 'last7',     label: 'Last 7 Days' },
  { id: 'month',     label: 'This Month'  },
  { id: 'lastmonth', label: 'Last Month'  },
  { id: 'quarter',   label: 'Quarter'     },
  { id: 'year',      label: 'This Year'   },
  { id: 'custom',    label: '✎ Custom'    },
];

// ─── Shared Chart Tooltip ─────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', fontSize: 12 }}>
      {label && <div style={{ color: '#94a3b8', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: '#fff', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: '#cbd5e1' }}>{p.name}:</span>
          <span style={{ fontWeight: 800 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      <div style={{ color: '#fff', fontWeight: 800 }}>{p.name}</div>
      <div style={{ color: '#94a3b8', marginTop: 3 }}>{fmt(p.value)}</div>
    </div>
  );
};

// ─── Main Reports Component ───────────────────────────────────────────────────
export default function ReportsModule() {
  const { isDark } = useTheme();
  const [tab,     setTab]     = useState('overview');
  const [preset,  setPreset]  = useState('year');
  const [from,    setFrom]    = useState(() => presetDates('year')[0]);
  const [to,      setTo]      = useState(() => presetDates('year')[1]);
  const [applied, setApplied] = useState({ from: presetDates('year')[0], to: presetDates('year')[1] });

  const selectPreset = id => {
    setPreset(id);
    if (id !== 'custom') {
      const [f, t] = presetDates(id);
      setFrom(f); setTo(t);
      setApplied({ from: f, to: t });
    }
  };

  const applyCustom = () => setApplied({ from, to });

  const TABS = [
    { id: 'overview', label: 'Overview',   icon: '📊' },
    { id: 'sales',    label: 'Sales',      icon: '🧾' },
    { id: 'cashflow', label: 'Cash Flow',  icon: '📈' },
    { id: 'payroll',  label: 'Payroll',    icon: '👷' },
    { id: 'ledger',   label: 'Ledger',     icon: '🏦' },
    { id: 'expenses', label: 'Expenses',   icon: '💸' },
  ];

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">

      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>📊</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>FINANCIAL ANALYTICS &amp; INTELLIGENCE</div>
            <h1 style={styles.headerTitle(isDark)}>Reports &amp; Business Insights</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={styles.headerBadge}>
            Live Financial Engine
          </span>
          <span style={styles.headerSubBadge(isDark)}>
            {applied.from} → {applied.to}
          </span>
        </div>
      </div>

      <div style={styles.content}>

        {/* ── Filter / Period Selector Bar (Bootstrap Pill Style) ── */}
        <div style={styles.periodBar(isDark)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: isDark ? '#94a3b8' : '#6c757d', letterSpacing: 0.8 }}>
              PERIOD:
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESETS.map(p => {
                const active = preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPreset(p.id)}
                    style={styles.presetBtn(active, isDark)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {preset === 'custom' && (
            <div style={styles.customRange(isDark)}>
              <input
                type="date"
                style={styles.dateInput(isDark)}
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
              <span style={{ color: isDark ? '#94a3b8' : '#6c757d', fontSize: 13 }}>–</span>
              <input
                type="date"
                style={styles.dateInput(isDark)}
                value={to}
                onChange={e => setTo(e.target.value)}
              />
              <button style={styles.applyBtn} onClick={applyCustom}>
                Apply Range
              </button>
            </div>
          )}
        </div>

        {/* ── Navigation Tab Pills ── */}
        <div style={styles.tabNav(isDark)}>
          {TABS.map(({ id, label, icon }) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={styles.navBtn(isActive, isDark)}
              >
                <span style={{ fontSize: 15 }}>{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Active Tab View ── */}
        <div style={{ marginTop: 22 }}>
          {tab === 'overview' && <OverviewTab  from={applied.from} to={applied.to} isDark={isDark} />}
          {tab === 'sales'    && <SalesTab     from={applied.from} to={applied.to} isDark={isDark} />}
          {tab === 'cashflow' && <CashFlowTab  from={applied.from} to={applied.to} isDark={isDark} />}
          {tab === 'payroll'  && <PayrollTab   from={applied.from} to={applied.to} isDark={isDark} />}
          {tab === 'ledger'   && <LedgerTab    from={applied.from} to={applied.to} isDark={isDark} />}
          {tab === 'expenses' && <ExpensesTab  from={applied.from} to={applied.to} isDark={isDark} />}
        </div>

      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ from, to, isDark }) {
  const [data, setData] = useState(null);
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([
        getReportFinanceSummary({ from, to }),
        getReportPaymentMethods({ from, to }),
      ]);
      setData(d);
      setMethods(m);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader isDark={isDark} />;
  if (!data)   return <Empty msg="Could not load financial summary." isDark={isDark} />;

  const kpis = [
    { label: 'Total Revenue', value: fmt(data.totalRevenue), tag: 'INVOICED', icon: '💰', gradient: 'linear-gradient(135deg, #198754 0%, #157347 100%)' },
    { label: 'Cash Collected', value: fmt(data.totalCollected), tag: 'RECEIVED', icon: '✅', gradient: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)' },
    { label: 'Outstanding Balance', value: fmt(data.totalOutstanding), tag: 'RECEIVABLE', icon: '⏳', gradient: 'linear-gradient(135deg, #dc3545 0%, #b02a37 100%)' },
    { label: 'Purchases Total', value: fmt(data.totalPurchaseExpenses), tag: 'MATERIAL', icon: '📦', gradient: 'linear-gradient(135deg, #fd7e14 0%, #d96309 100%)' },
    { label: 'Wages Paid', value: fmt(data.totalWagesExpenses), tag: 'LABOUR', icon: '👷', gradient: 'linear-gradient(135deg, #6f42c1 0%, #59359a 100%)' },
    {
      label: 'Net Cash Flow',
      value: fmt(data.netCashFlow),
      tag: 'NET FLOW',
      icon: data.netCashFlow >= 0 ? '📈' : '📉',
      gradient: data.netCashFlow >= 0
        ? 'linear-gradient(135deg, #20c997 0%, #0f5132 100%)'
        : 'linear-gradient(135deg, #dc3545 0%, #842029 100%)',
    },
  ];

  const barData = [
    { name: 'Revenue',     value: data.totalRevenue,          fill: BT.success },
    { name: 'Collected',   value: data.totalCollected,        fill: BT.primary },
    { name: 'Purchases',   value: data.totalPurchaseExpenses, fill: BT.orange  },
    { name: 'Wages',       value: data.totalWagesExpenses,    fill: BT.purple  },
    { name: 'Outstanding', value: data.totalOutstanding,      fill: BT.danger  },
  ];

  const statusPie = [
    { name: 'Paid',    value: data.paidCount    },
    { name: 'Partial', value: data.partialCount },
    { name: 'Pending', value: data.pendingCount },
  ].filter(d => d.value > 0);
  const statusColors = [BT.success, BT.warning, BT.danger];

  const methodTotal = methods.reduce((a, m) => a + m.amount, 0);
  const methodPie   = methods.map((m, i) => ({ name: m.method, value: m.amount, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const gridColor = isDark ? '#334155' : '#e9ecef';
  const textColor = isDark ? '#94a3b8' : '#6c757d';

  return (
    <div>
      {/* ── KPI Gradient Summary ── */}
      <div style={styles.kpiGrid}>
        {kpis.map(k => (
          <div
            key={k.label}
            style={{
              background: k.gradient,
              borderRadius: 12,
              padding: '16px 20px',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85, marginBottom: 4 }}>
                {k.tag}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                {k.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.9, marginTop: 4 }}>
                {k.label}
              </div>
            </div>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}>
              {k.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── Two Column Charts Row ── */}
      <div style={styles.twoCol}>
        <div style={styles.panelCard(isDark)}>
          <div style={styles.panelTitle(isDark)}>Financial Snapshot Overview</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.panelCard(isDark)}>
          <div style={styles.panelTitle(isDark)}>Sales Fulfillment by Status</div>
          {statusPie.length === 0 ? <Empty msg="No sales in this period." isDark={isDark} /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <ResponsiveContainer width={190} height={190}>
                <PieChart>
                  <Pie data={statusPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                    {statusPie.map((_, i) => <Cell key={i} fill={statusColors[i]} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, minWidth: 160 }}>
                {statusPie.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: isDark ? '#cbd5e1' : '#374151' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: statusColors[i], display: 'inline-block' }} />
                      {d.name}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 15, color: statusColors[i] }}>{d.value}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${isDark ? '#334155' : '#e9ecef'}`, paddingTop: 10, marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#6c757d', marginBottom: 6, fontWeight: 600 }}>Collection Efficiency</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, background: isDark ? '#334155' : '#e9ecef', borderRadius: 99, height: 8 }}>
                      <div style={{
                        width: `${pct(data.totalCollected, data.totalRevenue)}%`,
                        background: `linear-gradient(90deg, ${BT.primary}, ${BT.success})`,
                        height: '100%',
                        borderRadius: 99,
                        transition: 'width .5s ease'
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: BT.success }}>
                      {pct(data.totalCollected, data.totalRevenue)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Methods & Positions Row ── */}
      <div style={styles.twoCol}>
        <div style={styles.panelCard(isDark)}>
          <div style={styles.panelTitle(isDark)}>Payment Channels — Collections</div>
          {methodPie.length === 0 ? <Empty msg="No payments recorded in this period." isDark={isDark} /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={methodPie} cx="50%" cy="50%" outerRadius={80} paddingAngle={3} dataKey="value">
                    {methodPie.map((m, i) => <Cell key={i} fill={m.color} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, minWidth: 160 }}>
                {methodPie.map(m => (
                  <div key={m.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, color: isDark ? '#cbd5e1' : '#374151' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color, display: 'inline-block' }} />
                        {m.name}
                      </span>
                      <span style={{ color: m.color, fontWeight: 700 }}>{fmt(m.value)}</span>
                    </div>
                    <div style={{ background: isDark ? '#334155' : '#e9ecef', borderRadius: 99, height: 6 }}>
                      <div style={{ width: `${pct(m.value, methodTotal)}%`, height: '100%', borderRadius: 99, background: m.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={styles.panelCard(isDark)}>
          <div style={styles.panelTitle(isDark)}>Liquid Financial Position</div>
          {[
            { label: 'Active Account Balance',   value: fmt(data.totalAccountBalance), color: BT.primary, icon: '🏦' },
            { label: 'Total Pending Receivable', value: fmt(data.totalOutstanding),    color: BT.danger,  icon: '⚠️' },
            { label: 'Current Net Cash Flow',    value: fmt(data.netCashFlow),         color: data.netCashFlow >= 0 ? BT.success : BT.danger, icon: data.netCashFlow >= 0 ? '📈' : '📉' },
          ].map(item => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: isDark ? '#1e293b' : '#f8f9fa',
                borderRadius: 10,
                borderLeft: `4px solid ${item.color}`,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#495057', fontWeight: 600 }}>
                {item.icon} {item.label}
              </span>
              <span style={{ fontWeight: 800, fontSize: 15, color: item.color }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sales Tab ────────────────────────────────────────────────────────────────
function SalesTab({ from, to, isDark }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getReportSalesByCustomer({ from, to }));
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => r.customerName.toLowerCase().includes(search.toLowerCase()));
  const totals = {
    revenue:     filtered.reduce((a, r) => a + r.totalRevenue, 0),
    collected:   filtered.reduce((a, r) => a + r.totalCollected, 0),
    outstanding: filtered.reduce((a, r) => a + r.totalOutstanding, 0),
    sales:       filtered.reduce((a, r) => a + r.salesCount, 0),
  };
  const chartData = filtered.slice(0, 10).map(r => ({
    name:        r.customerName.length > 12 ? r.customerName.slice(0, 12) + '…' : r.customerName,
    Revenue:     r.totalRevenue,
    Collected:   r.totalCollected,
    Outstanding: r.totalOutstanding,
  }));

  const gridColor = isDark ? '#334155' : '#e9ecef';
  const textColor = isDark ? '#94a3b8' : '#6c757d';

  if (loading) return <Loader isDark={isDark} />;

  return (
    <div>
      {chartData.length > 0 && (
        <div style={styles.panelCard(isDark)}>
          <div style={styles.panelTitle(isDark)}>Revenue vs Collected vs Outstanding — Top {chartData.length} Customers</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Bar dataKey="Revenue"     fill={BT.success} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Collected"   fill={BT.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Outstanding" fill={BT.danger}  radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.panelCard(isDark)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={styles.panelTitle(isDark)}>Customer Sales Breakdown ({filtered.length})</div>
          <input
            style={styles.searchBox(isDark)}
            placeholder="Search customer name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? <Empty msg="No sales records found in this period." isDark={isDark} /> : (
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#dee2e6'}` }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['#', 'Customer Name', 'Orders', 'Revenue', 'Collected', 'Outstanding', 'Paid', 'Partial', 'Pending'].map(h => (
                    <th key={h} style={styles.th(isDark)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.customerId} style={styles.tr(isDark, i)}>
                    <td style={{ ...styles.td(isDark), color: isDark ? '#64748b' : '#9ca3af', textAlign: 'center' }}>{i + 1}</td>
                    <td style={styles.td(isDark)}><b style={{ color: isDark ? '#f8fafc' : '#212529' }}>{r.customerName}</b></td>
                    <td style={{ ...styles.td(isDark), textAlign: 'center', fontWeight: 600 }}>{r.salesCount}</td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 700, color: BT.success }}>{fmt(r.totalRevenue)}</td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.primary, fontWeight: 600 }}>{fmt(r.totalCollected)}</td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', color: r.totalOutstanding > 0 ? BT.danger : (isDark ? '#64748b' : '#9ca3af'), fontWeight: 600 }}>
                      {fmt(r.totalOutstanding)}
                    </td>
                    <td style={{ ...styles.td(isDark), textAlign: 'center' }}><Badge color={BT.success} bg={isDark ? '#052c17' : '#d1e7dd'}>{r.paidCount}</Badge></td>
                    <td style={{ ...styles.td(isDark), textAlign: 'center' }}><Badge color={BT.warning} bg={isDark ? '#332701' : '#fff3cd'}>{r.partialCount}</Badge></td>
                    <td style={{ ...styles.td(isDark), textAlign: 'center' }}><Badge color={BT.danger}  bg={isDark ? '#2c0b0e' : '#f8d7da'}>{r.pendingCount}</Badge></td>
                  </tr>
                ))}
                <tr style={{ background: isDark ? '#1e293b' : '#212529', fontWeight: 700 }}>
                  <td style={{ ...styles.td(isDark), color: '#94a3b8' }} colSpan={2}>TOTALS</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'center', color: '#fff' }}>{totals.sales}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#34d399' }}>{fmt(totals.revenue)}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#60a5fa' }}>{fmt(totals.collected)}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#f87171' }}>{fmt(totals.outstanding)}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cash Flow Tab ─────────────────────────────────────────────────────────────
function CashFlowTab({ from, to, isDark }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getReportMonthlyCashFlow({ from, to }));
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const gridColor = isDark ? '#334155' : '#e9ecef';
  const textColor = isDark ? '#94a3b8' : '#6c757d';

  if (loading) return <Loader isDark={isDark} />;
  if (rows.length === 0) return <Empty msg="No cash flow data found in this period." isDark={isDark} />;

  const totals = {
    revenue:   rows.reduce((a, r) => a + r.revenue, 0),
    collected: rows.reduce((a, r) => a + r.collected, 0),
    purchases: rows.reduce((a, r) => a + r.purchaseExpenses, 0),
    wages:     rows.reduce((a, r) => a + r.wageExpenses, 0),
    expenses:  rows.reduce((a, r) => a + r.totalExpenses, 0),
    net:       rows.reduce((a, r) => a + r.netCashFlow, 0),
  };
  const shortRows = rows.map(r => ({ ...r, name: r.monthName.slice(0, 8) }));

  return (
    <div>
      <div style={styles.panelCard(isDark)}>
        <div style={styles.panelTitle(isDark)}>Revenue vs Collected — Monthly Trajectory</div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={shortRows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="gRev"  x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={BT.success} stopOpacity={0.3} />
                <stop offset="95%" stopColor={BT.success} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gColl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={BT.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={BT.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={72} />
            <Tooltip content={<ChartTip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
            <Area type="monotone" dataKey="revenue"   name="Revenue"   stroke={BT.success} fill="url(#gRev)"  strokeWidth={2.5} dot={{ r: 4 }} />
            <Area type="monotone" dataKey="collected" name="Collected" stroke={BT.primary} fill="url(#gColl)" strokeWidth={2.5} dot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.twoCol}>
        <div style={styles.panelCard(isDark)}>
          <div style={styles.panelTitle(isDark)}>Monthly Expenses Stacked Breakdown</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={shortRows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="purchaseExpenses" name="Purchases" stackId="a" fill={BT.orange} />
              <Bar dataKey="wageExpenses"     name="Wages"     stackId="a" fill={BT.purple} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.panelCard(isDark)}>
          <div style={styles.panelTitle(isDark)}>Monthly Net Cash Flow</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={shortRows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="netCashFlow" name="Net Cash Flow" radius={[4, 4, 0, 0]}>
                {shortRows.map((r, i) => <Cell key={i} fill={r.netCashFlow >= 0 ? BT.success : BT.danger} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.panelCard(isDark)}>
        <div style={styles.panelTitle(isDark)}>Monthly Summary Table</div>
        <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#dee2e6'}` }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Month', 'Revenue', 'Collected', 'Purchases', 'Wages', 'Total Exp.', 'Net Cash Flow'].map(h => (
                  <th key={h} style={styles.th(isDark)}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.year}-${r.month}`} style={styles.tr(isDark, i)}>
                  <td style={{ ...styles.td(isDark), fontWeight: 700, whiteSpace: 'nowrap' }}>{r.monthName}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.success, fontWeight: 700 }}>{fmt(r.revenue)}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.primary, fontWeight: 700 }}>{fmt(r.collected)}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.orange }}>{fmt(r.purchaseExpenses)}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.purple }}>{fmt(r.wageExpenses)}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.danger }}>{fmt(r.totalExpenses)}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 800, color: r.netCashFlow >= 0 ? BT.success : BT.danger }}>
                    {r.netCashFlow >= 0 ? '+' : ''}{fmt(r.netCashFlow)}
                  </td>
                </tr>
              ))}
              <tr style={{ background: isDark ? '#1e293b' : '#212529', fontWeight: 700 }}>
                <td style={{ ...styles.td(isDark), color: '#94a3b8' }}>TOTAL</td>
                <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#34d399' }}>{fmt(totals.revenue)}</td>
                <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#60a5fa' }}>{fmt(totals.collected)}</td>
                <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#fb923c' }}>{fmt(totals.purchases)}</td>
                <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#c084fc' }}>{fmt(totals.wages)}</td>
                <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#f87171' }}>{fmt(totals.expenses)}</td>
                <td style={{ ...styles.td(isDark), textAlign: 'right', color: totals.net >= 0 ? '#34d399' : '#f87171' }}>
                  {totals.net >= 0 ? '+' : ''}{fmt(totals.net)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Payroll Tab ──────────────────────────────────────────────────────────────
function PayrollTab({ from, to, isDark }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState({});
  const [search,   setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getReportPayroll({ from, to }));
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const gridColor = isDark ? '#334155' : '#e9ecef';
  const textColor = isDark ? '#94a3b8' : '#6c757d';

  if (loading) return <Loader isDark={isDark} />;
  if (!data)   return <Empty msg="Could not load payroll records." isDark={isDark} />;

  const toggle = id => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const workers = (data.byWorker || []).filter(w => w.workerName.toLowerCase().includes(search.toLowerCase()));
  const monthly = data.monthlyBreakdown || [];
  const showMonthly = monthly.length > 1;

  const workerBar = workers.slice(0, 12).map(w => ({
    name:   w.workerName.length > 13 ? w.workerName.slice(0, 13) + '…' : w.workerName,
    Gross:  w.totalGross,
    Net:    w.totalNet,
    Deductions: w.totalDeductions,
  }));

  const monthlyBar = monthly.map(m => ({
    name:       m.monthName.slice(0, 8),
    Gross:      m.gross,
    Net:        m.net,
    Advances:   m.advances,
    Deductions: m.deductions,
  }));

  const deductionsPie = workers
    .filter(w => w.totalDeductions > 0)
    .map((w, i) => ({ name: w.workerName, value: w.totalDeductions, color: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <div>
      {/* ── KPI Row ── */}
      <div style={styles.kpiGrid}>
        {[
          { label: 'Total Gross Wages',   value: fmt(data.totalGross),            tag: 'GROSS PAY', icon: '💼', gradient: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)' },
          { label: 'Total Deductions',    value: fmt(data.totalDeductions),       tag: 'DEDUCTIONS', icon: '✂️', gradient: 'linear-gradient(135deg, #dc3545 0%, #b02a37 100%)' },
          { label: 'Total Net Disbursed', value: fmt(data.totalNet),              tag: 'NET PAY', icon: '💵', gradient: 'linear-gradient(135deg, #198754 0%, #157347 100%)' },
          { label: 'Advances Issued',     value: fmt(data.totalAdvances),         tag: 'ADVANCES', icon: '📋', gradient: 'linear-gradient(135deg, #ffc107 0%, #d39e00 100%)' },
          { label: 'Unsettled Advances',  value: fmt(data.totalUnsettledAdvances),tag: 'PENDING', icon: '⚠️', gradient: 'linear-gradient(135deg, #fd7e14 0%, #d96309 100%)' },
          { label: 'Active Workers Paid', value: data.workerCount,                tag: 'WORKFORCE', icon: '👷', gradient: 'linear-gradient(135deg, #6f42c1 0%, #59359a 100%)' },
        ].map(k => (
          <div
            key={k.label}
            style={{
              background: k.gradient,
              borderRadius: 12,
              padding: '16px 20px',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85, marginBottom: 4 }}>
                {k.tag}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                {k.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.9, marginTop: 4 }}>
                {k.label}
              </div>
            </div>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}>
              {k.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div style={styles.twoCol}>
        {workerBar.length > 0 && (
          <div style={styles.panelCard(isDark)}>
            <div style={styles.panelTitle(isDark)}>Gross vs Net Pay per Worker</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={workerBar} margin={{ top: 8, right: 16, left: 0, bottom: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: textColor }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Gross"      fill={BT.primary} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Net"        fill={BT.success} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Deductions" fill={BT.danger}  radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {deductionsPie.length > 0 ? (
          <div style={styles.panelCard(isDark)}>
            <div style={styles.panelTitle(isDark)}>Deductions Distribution by Worker</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <ResponsiveContainer width={190} height={190}>
                <PieChart>
                  <Pie data={deductionsPie} cx="50%" cy="50%" outerRadius={82} paddingAngle={3} dataKey="value">
                    {deductionsPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, maxHeight: 190, overflowY: 'auto' }}>
                {deductionsPie.map(d => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: isDark ? '#cbd5e1' : '#374151' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: 'inline-block', flexShrink: 0 }} />
                      {d.name}
                    </span>
                    <span style={{ fontWeight: 700, color: d.color }}>{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : showMonthly && (
          <div style={styles.panelCard(isDark)}>
            <div style={styles.panelTitle(isDark)}>Monthly Payroll Summary</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyBar} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Gross"    fill={BT.primary} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Net"      fill={BT.success} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Advances" fill={BT.warning} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Worker Detail Table ── */}
      <div style={styles.panelCard(isDark)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={styles.panelTitle(isDark)}>Staff Payroll Directory ({workers.length})</div>
          <input
            style={styles.searchBox(isDark)}
            placeholder="Search worker name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {workers.length === 0 ? <Empty msg="No payroll records in this period." isDark={isDark} /> : (
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#dee2e6'}` }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Worker', 'Category', 'Payments', 'Gross Pay', 'Deductions', 'Net Pay', 'Advances', 'Unsettled', 'Detail'].map(h => (
                    <th key={h} style={styles.th(isDark)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workers.map((w, i) => (
                  <tr key={w.workerId} style={styles.tr(isDark, i)}>
                    <td style={{ ...styles.td(isDark), fontWeight: 700 }}>{w.workerName}</td>
                    <td style={styles.td(isDark)}>
                      <Badge
                        color={w.workerType === 'Management' ? BT.purple : BT.primary}
                        bg={w.workerType === 'Management' ? (isDark ? '#2b1b4d' : '#f3e8ff') : (isDark ? '#0c2e59' : '#e7f1ff')}
                      >
                        {w.workerType}
                      </Badge>
                    </td>
                    <td style={{ ...styles.td(isDark), textAlign: 'center', fontWeight: 600 }}>{w.paymentsCount}</td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.primary, fontWeight: 700 }}>{fmt(w.totalGross)}</td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', color: w.totalDeductions > 0 ? BT.danger : (isDark ? '#64748b' : '#9ca3af') }}>
                      {w.totalDeductions > 0 ? `-${fmt(w.totalDeductions)}` : '—'}
                    </td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 800, color: BT.success }}>{fmt(w.totalNet)}</td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.warning }}>{w.totalAdvances > 0 ? fmt(w.totalAdvances) : '—'}</td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', color: w.unsettledAdvances > 0 ? BT.orange : (isDark ? '#64748b' : '#9ca3af') }}>
                      {w.unsettledAdvances > 0 ? fmt(w.unsettledAdvances) : '—'}
                    </td>
                    <td style={{ ...styles.td(isDark), textAlign: 'center' }}>
                      {(w.payments.length > 0 || w.advances.length > 0) && (
                        <button
                          onClick={() => toggle(w.workerId)}
                          style={{
                            background: isDark ? '#1e293b' : '#ffffff',
                            border: `1px solid ${isDark ? '#334155' : '#ced4da'}`,
                            borderRadius: 6,
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                            color: isDark ? '#cbd5e1' : '#495057',
                          }}
                        >
                          {expanded[w.workerId] ? '▲ Close' : '▼ View'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: isDark ? '#1e293b' : '#212529', fontWeight: 700 }}>
                  <td colSpan={2} style={{ ...styles.td(isDark), color: '#94a3b8' }}>TOTALS ({workers.length} workers)</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'center', color: '#fff' }}>{workers.reduce((a, w) => a + w.paymentsCount, 0)}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#93c5fd' }}>{fmt(workers.reduce((a, w) => a + w.totalGross, 0))}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#f87171' }}>{fmt(workers.reduce((a, w) => a + w.totalDeductions, 0))}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#34d399' }}>{fmt(workers.reduce((a, w) => a + w.totalNet, 0))}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#fbbf24' }}>{fmt(workers.reduce((a, w) => a + w.totalAdvances, 0))}</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#fb923c' }}>{fmt(workers.reduce((a, w) => a + w.unsettledAdvances, 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Account Ledger Tab ───────────────────────────────────────────────────────
function LedgerTab({ from, to, isDark }) {
  const [accounts,    setAccounts]    = useState([]);
  const [accountId,   setAccountId]   = useState('');
  const [statement,   setStatement]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [accsLoading, setAccsLoading] = useState(true);

  useEffect(() => {
    getAccounts()
      .then(a => {
        setAccounts(a);
        if (a.length > 0) setAccountId(String(a[0].id));
      })
      .catch(() => {})
      .finally(() => setAccsLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      setStatement(await getReportAccountStatement({ accountId, from, to }));
    } catch {
      setStatement(null);
    }
    setLoading(false);
  }, [accountId, from, to]);

  useEffect(() => { load(); }, [load]);

  const gridColor = isDark ? '#334155' : '#e9ecef';
  const textColor = isDark ? '#94a3b8' : '#6c757d';

  if (accsLoading) return <Loader isDark={isDark} />;
  if (accounts.length === 0) return <Empty msg="No ledger accounts found. Configure accounts in Finance first." isDark={isDark} />;

  const credits = statement?.lines?.filter(l => l.type === 'Credit').reduce((a, l) => a + l.amount, 0) ?? 0;
  const debits  = statement?.lines?.filter(l => l.type === 'Debit' ).reduce((a, l) => a + l.amount, 0) ?? 0;
  const ledgerPie = [{ name: 'Credits', value: credits }, { name: 'Debits', value: debits }].filter(d => d.value > 0);
  const lineData  = (statement?.lines ?? []).map((l, i) => ({ name: `#${i + 1}`, Balance: l.runningBalance }));

  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#212529', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Select Account:
        </label>
        <select
          style={styles.acctSelect(isDark)}
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
        >
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name} — {a.categoryName}</option>
          ))}
        </select>
      </div>

      {loading && <Loader isDark={isDark} />}

      {!loading && statement && (
        <>
          {statement.lines.length > 0 && (
            <div style={styles.twoCol}>
              <div style={styles.panelCard(isDark)}>
                <div style={styles.panelTitle(isDark)}>Running Account Balance Trajectory</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={lineData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="gBal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={BT.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={BT.primary} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={72} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="Balance" stroke={BT.primary} fill="url(#gBal)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={styles.panelCard(isDark)}>
                <div style={styles.panelTitle(isDark)}>Credits vs Debits Proportion</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={ledgerPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        {ledgerPie.map((_, i) => <Cell key={i} fill={[BT.success, BT.danger][i]} />)}
                      </Pie>
                      <Tooltip content={<PieTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {[
                      { label: 'Opening Balance', value: statement.openingBalance, color: isDark ? '#94a3b8' : '#6c757d' },
                      { label: 'Total Credits',   value: credits,                  color: BT.success },
                      { label: 'Total Debits',    value: debits,                   color: BT.danger  },
                      { label: 'Closing Balance', value: statement.closingBalance, color: statement.closingBalance >= 0 ? BT.primary : BT.danger },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                        <span style={{ color: isDark ? '#cbd5e1' : '#6c757d' }}>{item.label}</span>
                        <span style={{ fontWeight: 800, color: item.color }}>{fmt(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={styles.panelCard(isDark)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={styles.panelTitle(isDark)}>{statement.accountName} — Detailed Statement</div>
                <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#6c757d', fontWeight: 600 }}>Category: {statement.categoryName}</div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#6c757d' }}>Opening Balance</div>
                  <div style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#212529' }}>{fmt(statement.openingBalance)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#6c757d' }}>Closing Balance</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: statement.closingBalance >= 0 ? BT.success : BT.danger }}>
                    {fmt(statement.closingBalance)}
                  </div>
                </div>
              </div>
            </div>

            {statement.lines.length === 0 ? (
              <div style={{ color: isDark ? '#94a3b8' : '#6c757d', fontSize: 13, padding: '16px 0' }}>No transactions recorded in this period.</div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#dee2e6'}` }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th(isDark)}>Date</th>
                      <th style={styles.th(isDark)}>Description</th>
                      <th style={styles.th(isDark)}>Ref No</th>
                      <th style={{ ...styles.th(isDark), textAlign: 'right' }}>Credit (In)</th>
                      <th style={{ ...styles.th(isDark), textAlign: 'right' }}>Debit (Out)</th>
                      <th style={{ ...styles.th(isDark), textAlign: 'right' }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: isDark ? '#141e33' : '#f8f9fa' }}>
                      <td style={styles.td(isDark)} colSpan={5}>
                        <span style={{ color: isDark ? '#94a3b8' : '#6c757d', fontSize: 12, fontWeight: 700 }}>Initial Opening Balance</span>
                      </td>
                      <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 700 }}>{fmt(statement.openingBalance)}</td>
                    </tr>
                    {statement.lines.map((l, i) => (
                      <tr key={l.id} style={styles.tr(isDark, i)}>
                        <td style={{ ...styles.td(isDark), whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(l.date)}</td>
                        <td style={{ ...styles.td(isDark), maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.description}</td>
                        <td style={{ ...styles.td(isDark), color: isDark ? '#64748b' : '#9ca3af', fontSize: 11 }}>{l.referenceNo || '—'}</td>
                        <td style={{ ...styles.td(isDark), textAlign: 'right', color: l.type === 'Credit' ? BT.success : (isDark ? '#334155' : '#dee2e6'), fontWeight: l.type === 'Credit' ? 700 : 400 }}>
                          {l.type === 'Credit' ? fmt(l.amount) : '—'}
                        </td>
                        <td style={{ ...styles.td(isDark), textAlign: 'right', color: l.type === 'Debit' ? BT.danger : (isDark ? '#334155' : '#dee2e6'), fontWeight: l.type === 'Debit' ? 700 : 400 }}>
                          {l.type === 'Debit' ? fmt(l.amount) : '—'}
                        </td>
                        <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 700, color: l.runningBalance >= 0 ? (isDark ? '#f8fafc' : '#212529') : BT.danger }}>
                          {fmt(l.runningBalance)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: isDark ? '#1e293b' : '#212529' }}>
                      <td colSpan={5} style={{ ...styles.td(isDark), color: '#94a3b8', fontWeight: 700 }}>CLOSING LEDGER BALANCE</td>
                      <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 800, color: statement.closingBalance >= 0 ? '#34d399' : '#f87171' }}>
                        {fmt(statement.closingBalance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────
function ExpensesTab({ from, to, isDark }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getReportExpenses({ from, to }));
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const gridColor = isDark ? '#334155' : '#e9ecef';
  const textColor = isDark ? '#94a3b8' : '#6c757d';

  if (loading) return <Loader isDark={isDark} />;
  if (!data)   return <Empty msg="Could not load expense breakdown." isDark={isDark} />;

  const splitPie = [
    { name: 'Purchases', value: data.totalPurchases },
    { name: 'Wages',     value: data.totalWages     },
  ].filter(d => d.value > 0);
  const splitColors = [BT.orange, BT.purple];
  const matBar = (data.byMaterial || []).map((m, i) => ({ name: m.material, Amount: m.totalAmount, color: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <div>
      {/* ── KPI Row ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Purchases & Supplies', value: fmt(data.totalPurchases), tag: 'MATERIAL', icon: '📦', gradient: 'linear-gradient(135deg, #fd7e14 0%, #d96309 100%)' },
          { label: 'Wages Disbursed',      value: fmt(data.totalWages),     tag: 'PAYROLL',  icon: '👷', gradient: 'linear-gradient(135deg, #6f42c1 0%, #59359a 100%)' },
          { label: 'Grand Total Expenses', value: fmt(data.grandTotal),     tag: 'OUTFLOW',  icon: '💸', gradient: 'linear-gradient(135deg, #dc3545 0%, #b02a37 100%)' },
        ].map(k => (
          <div
            key={k.label}
            style={{
              background: k.gradient,
              borderRadius: 12,
              padding: '16px 20px',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flex: '1 1 220px',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85, marginBottom: 4 }}>
                {k.tag}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                {k.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.9, marginTop: 4 }}>
                {k.label}
              </div>
            </div>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}>
              {k.icon}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.twoCol}>
        <div style={styles.panelCard(isDark)}>
          <div style={styles.panelTitle(isDark)}>Expense Distribution Ratio</div>
          {splitPie.length === 0 ? <Empty msg="No expenses recorded in this period." isDark={isDark} /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width={190} height={190}>
                <PieChart>
                  <Pie data={splitPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                    {splitPie.map((_, i) => <Cell key={i} fill={splitColors[i]} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {splitPie.map((d, i) => (
                  <div key={d.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, color: isDark ? '#cbd5e1' : '#374151' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: splitColors[i], display: 'inline-block' }} />
                        {d.name}
                      </span>
                      <span style={{ fontWeight: 800, color: splitColors[i] }}>{fmt(d.value)}</span>
                    </div>
                    <div style={{ background: isDark ? '#334155' : '#e9ecef', borderRadius: 99, height: 8 }}>
                      <div style={{ width: `${pct(d.value, data.grandTotal)}%`, height: '100%', borderRadius: 99, background: splitColors[i] }} />
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#6c757d', marginTop: 3 }}>
                      {pct(d.value, data.grandTotal)}% of total expenses
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={styles.panelCard(isDark)}>
          <div style={styles.panelTitle(isDark)}>Material Purchases Breakdown</div>
          {matBar.length === 0 ? <Empty msg="No material purchases found." isDark={isDark} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={matBar} layout="vertical" margin={{ top: 8, right: 16, left: 40, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="Amount" radius={[0, 4, 4, 0]}>
                  {matBar.map((m, i) => <Cell key={i} fill={m.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {data.wagePayments.length > 0 && (
        <div style={styles.panelCard(isDark)}>
          <div style={styles.panelTitle(isDark)}>Recent Wage Disbursals</div>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#dee2e6'}` }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Worker Name', 'Period', 'Gross', 'Deductions', 'Net Pay', 'Disbursed On'].map(h => (
                    <th key={h} style={styles.th(isDark)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.wagePayments.map((w, i) => (
                  <tr key={w.id} style={styles.tr(isDark, i)}>
                    <td style={{ ...styles.td(isDark), fontWeight: 700 }}>{w.workerName}</td>
                    <td style={{ ...styles.td(isDark), fontSize: 12, color: isDark ? '#94a3b8' : '#6c757d', whiteSpace: 'nowrap' }}>
                      {fmtShort(w.periodFrom)} – {fmtShort(w.periodTo)}
                    </td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right' }}>{fmt(w.grossAmount)}</td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', color: w.deductions > 0 ? BT.danger : (isDark ? '#64748b' : '#9ca3af') }}>
                      {w.deductions > 0 ? `-${fmt(w.deductions)}` : '—'}
                    </td>
                    <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 800, color: BT.success }}>{fmt(w.netAmount)}</td>
                    <td style={{ ...styles.td(isDark), fontSize: 12, color: isDark ? '#94a3b8' : '#6c757d', whiteSpace: 'nowrap' }}>{fmtShort(w.paidAt)}</td>
                  </tr>
                ))}
                <tr style={{ background: isDark ? '#1e293b' : '#212529' }}>
                  <td colSpan={4} style={{ ...styles.td(isDark), color: '#94a3b8', fontWeight: 700 }}>TOTAL WAGE DISBURSAL</td>
                  <td style={{ ...styles.td(isDark), textAlign: 'right', color: '#34d399', fontWeight: 800 }}>{fmt(data.totalWages)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Loader({ isDark }) {
  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: isDark ? '#94a3b8' : '#6c757d', fontSize: 14 }}>
      ⏳ Compiling analytical reports…
    </div>
  );
}

function Empty({ msg, isDark }) {
  return (
    <div style={{ padding: '3rem 2rem', textAlign: 'center', color: isDark ? '#94a3b8' : '#6c757d', fontSize: 14 }}>
      {msg}
    </div>
  );
}

function Badge({ color, bg, children }) {
  return (
    <span style={{ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
      {children}
    </span>
  );
}

// ─── Stylesheet ───────────────────────────────────────────────────────────────
const styles = {
  page: (isDark) => ({
    minHeight: '100vh',
    background: isDark ? 'var(--bg-page)' : '#f8f9fa',
    paddingBottom: 40,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  }),

  header: (isDark) => ({
    background: isDark
      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      : 'linear-gradient(135deg, #212529 0%, #0d6efd 100%)',
    padding: '24px 32px',
    borderBottom: `1px solid ${isDark ? '#334155' : '#e9ecef'}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  }),
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'rgba(255, 255, 255, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    backdropFilter: 'blur(8px)',
  },
  headerBreadcrumb: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 700,
    marginBottom: 4,
  },
  headerTitle: () => ({
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: -0.5,
  }),
  headerBadge: {
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(8px)',
    color: '#ffffff',
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  headerSubBadge: () => ({
    background: 'rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  }),

  content: {
    maxWidth: 1440,
    margin: '0 auto',
    padding: '24px 28px',
  },

  periodBar: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 12,
    border: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  }),

  presetBtn: (active, isDark) => ({
    padding: '6px 14px',
    borderRadius: 20,
    border: `1px solid ${active ? BT.primary : (isDark ? '#334155' : '#dee2e6')}`,
    background: active ? BT.primary : (isDark ? '#1e293b' : '#f8f9fa'),
    color: active ? '#ffffff' : (isDark ? '#cbd5e1' : '#495057'),
    fontSize: 12,
    fontWeight: active ? 700 : 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),

  customRange: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    paddingLeft: 12,
    borderLeft: `2px solid ${isDark ? '#334155' : '#e9ecef'}`,
  }),

  dateInput: (isDark) => ({
    padding: '6px 10px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#334155' : '#ced4da'}`,
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#212529',
    fontSize: 12,
    outline: 'none',
  }),

  applyBtn: {
    background: BT.success,
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  tabNav: (isDark) => ({
    display: 'flex',
    gap: 6,
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 12,
    border: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
    padding: '8px 12px',
    overflowX: 'auto',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  }),

  navBtn: (isActive, isDark) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    border: 'none',
    borderRadius: 8,
    background: isActive ? BT.primary : 'transparent',
    color: isActive ? '#ffffff' : (isDark ? '#94a3b8' : '#6c757d'),
    fontWeight: isActive ? 700 : 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  }),

  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },

  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },

  panelCard: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 12,
    border: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
    padding: '20px 24px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
    marginBottom: 20,
  }),

  panelTitle: (isDark) => ({
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: isDark ? '#f8fafc' : '#212529',
    marginBottom: 16,
  }),

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },

  th: (isDark) => ({
    padding: '11px 14px',
    background: isDark ? '#1e293b' : '#f8f9fa',
    color: isDark ? '#cbd5e1' : '#495057',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    borderBottom: `2px solid ${isDark ? '#334155' : '#dee2e6'}`,
    whiteSpace: 'nowrap',
  }),

  tr: (isDark, i) => ({
    backgroundColor: i % 2 === 0 ? (isDark ? '#0f172a' : '#ffffff') : (isDark ? '#141e33' : '#fafafa'),
    borderBottom: `1px solid ${isDark ? '#1e293b' : '#edf2f7'}`,
    transition: 'background-color 0.15s ease',
  }),

  td: (isDark) => ({
    padding: '11px 14px',
    fontSize: 13,
    color: isDark ? '#f8fafc' : '#212529',
    verticalAlign: 'middle',
  }),

  searchBox: (isDark) => ({
    padding: '8px 14px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#334155' : '#ced4da'}`,
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#212529',
    fontSize: 13,
    outline: 'none',
    minWidth: 220,
  }),

  acctSelect: (isDark) => ({
    padding: '8px 14px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#334155' : '#ced4da'}`,
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#212529',
    fontSize: 13,
    outline: 'none',
    minWidth: 260,
  }),
};
