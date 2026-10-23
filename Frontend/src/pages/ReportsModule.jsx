import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area,
} from 'recharts';
import {
  getReportFinanceSummary, getReportSalesByCustomer, getReportMonthlyCashFlow,
  getReportPaymentMethods, getReportAccountStatement, getReportExpenses,
  getReportPayroll, getAccounts,
} from '../services/api';

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt     = n => `Rs ${Number(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtK    = n => { const v = Number(n ?? 0); return v >= 1000000 ? `Rs ${(v/1000000).toFixed(1)}M` : v >= 1000 ? `Rs ${(v/1000).toFixed(0)}K` : `Rs ${v}`; };
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtShort= d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) : '—';
const toISO   = d => d instanceof Date ? d.toISOString().split('T')[0] : d;
const pct     = (v, max) => max > 0 ? Math.min(100, Math.round((v / max) * 100)) : 0;

const C = {
  green: '#059669', purple: '#7c3aed', red: '#dc2626', amber: '#f59e0b',
  cyan: '#0891b2', blue: '#2E75B6', rose: '#e11d48', indigo: '#4f46e5',
  teal: '#0d9488', orange: '#ea580c',
};
const PIE_COLORS = [C.green, C.amber, C.purple, C.cyan, C.rose, C.indigo, C.teal, C.orange];

// ─── Period Presets ───────────────────────────────────────────────────────────
function getToday() { return new Date().toISOString().split('T')[0]; }

function presetDates(id) {
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth(), d = now.getDate();
  const pad = n => String(n).padStart(2, '0');
  const iso  = dt => dt.toISOString().split('T')[0];

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
  { id: 'today',     label: 'Today'      },
  { id: 'yesterday', label: 'Yesterday'  },
  { id: 'week',      label: 'This Week'  },
  { id: 'last7',     label: 'Last 7 Days'},
  { id: 'month',     label: 'This Month' },
  { id: 'lastmonth', label: 'Last Month' },
  { id: 'quarter',   label: 'Quarter'    },
  { id: 'year',      label: 'This Year'  },
  { id: 'custom',    label: '✎ Custom'   },
];

// ─── Shared Chart Tooltip ─────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e2a3b', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,.35)', fontSize: 12 }}>
      {label && <div style={{ color: '#7a9cc0', marginBottom: 6, fontWeight: 600 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: '#fff', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};
const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: '#1e2a3b', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#fff', fontWeight: 700 }}>{p.name}</div>
      <div style={{ color: '#94a3b8', marginTop: 2 }}>{fmt(p.value)}</div>
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function ReportsModule() {
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
    { id: 'overview', label: '📊 Overview'      },
    { id: 'sales',    label: '🧾 Sales'          },
    { id: 'cashflow', label: '📈 Cash Flow'      },
    { id: 'payroll',  label: '👷 Payroll'        },
    { id: 'ledger',   label: '🏦 Ledger'         },
    { id: 'expenses', label: '💸 Expenses'       },
  ];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>📊</div>
          <div>
            <div style={s.headerSub}>Analytics</div>
            <div style={s.headerTitle}>Finance Reports</div>
          </div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          {applied.from} → {applied.to}
        </div>
      </div>

      {/* Period Selector */}
      <div style={s.periodBar}>
        <div style={s.presetGroup}>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => selectPreset(p.id)}
              style={{ ...s.presetBtn, ...(preset === p.id ? s.presetActive : {}) }}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div style={s.customRange}>
            <input type="date" style={s.dateInput} value={from} onChange={e => setFrom(e.target.value)} />
            <span style={{ color: '#6b7280', fontSize: 13 }}>–</span>
            <input type="date" style={s.dateInput} value={to}   onChange={e => setTo(e.target.value)} />
            <button style={s.applyBtn} onClick={applyCustom}>Apply</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ ...s.tabBtn, ...(tab === id ? s.tabActive : {}) }}>
            {label}
          </button>
        ))}
      </div>

      <div style={s.body}>
        {tab === 'overview' && <OverviewTab  from={applied.from} to={applied.to} />}
        {tab === 'sales'    && <SalesTab     from={applied.from} to={applied.to} />}
        {tab === 'cashflow' && <CashFlowTab  from={applied.from} to={applied.to} />}
        {tab === 'payroll'  && <PayrollTab   from={applied.from} to={applied.to} />}
        {tab === 'ledger'   && <LedgerTab    from={applied.from} to={applied.to} />}
        {tab === 'expenses' && <ExpensesTab  from={applied.from} to={applied.to} />}
      </div>
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab({ from, to }) {
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
      setData(d); setMethods(m);
    } catch { setData(null); }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;
  if (!data)   return <Empty msg="Could not load summary." />;

  const kpis = [
    { label: 'Revenue',       value: fmt(data.totalRevenue),          color: C.green,  bg: '#ecfdf5', icon: '💰' },
    { label: 'Collected',     value: fmt(data.totalCollected),        color: C.purple, bg: '#f5f3ff', icon: '✅' },
    { label: 'Outstanding',   value: fmt(data.totalOutstanding),      color: C.red,    bg: '#fef2f2', icon: '⏳' },
    { label: 'Purchases',     value: fmt(data.totalPurchaseExpenses), color: C.amber,  bg: '#fffbeb', icon: '📦' },
    { label: 'Wages',         value: fmt(data.totalWagesExpenses),    color: C.cyan,   bg: '#ecfeff', icon: '👷' },
    { label: 'Net Cash Flow', value: fmt(data.netCashFlow),           color: data.netCashFlow >= 0 ? C.green : C.red, bg: data.netCashFlow >= 0 ? '#ecfdf5' : '#fef2f2', icon: data.netCashFlow >= 0 ? '📈' : '📉' },
  ];

  const barData = [
    { name: 'Revenue',    value: data.totalRevenue,          fill: C.green  },
    { name: 'Collected',  value: data.totalCollected,        fill: C.purple },
    { name: 'Purchases',  value: data.totalPurchaseExpenses, fill: C.amber  },
    { name: 'Wages',      value: data.totalWagesExpenses,    fill: C.cyan   },
    { name: 'Outstanding',value: data.totalOutstanding,      fill: C.red    },
  ];
  const statusPie = [
    { name: 'Paid',    value: data.paidCount    },
    { name: 'Partial', value: data.partialCount },
    { name: 'Pending', value: data.pendingCount },
  ].filter(d => d.value > 0);
  const statusColors = [C.green, C.amber, C.red];

  const methodTotal = methods.reduce((a, m) => a + m.amount, 0);
  const methodPie   = methods.map((m, i) => ({ name: m.method, value: m.amount, color: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <div>
      <div style={s.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...s.kpiCard, background: k.bg, borderLeft: `4px solid ${k.color}` }}>
            <div style={s.kpiIcon}>{k.icon}</div>
            <div>
              <div style={{ ...s.kpiVal, color: k.color }}>{k.value}</div>
              <div style={s.kpiLabel}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={s.twoCol}>
        <div style={s.panel}>
          <div style={s.panelTitle}>Financial Snapshot</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={s.panel}>
          <div style={s.panelTitle}>Sales by Status</div>
          {statusPie.length === 0 ? <Empty msg="No sales in this period." /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={statusPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {statusPie.map((_, i) => <Cell key={i} fill={statusColors[i]} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {statusPie.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#374151' }}>
                      <span style={{ width: 11, height: 11, borderRadius: 3, background: statusColors[i], display: 'inline-block' }} />
                      {d.name}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 16, color: statusColors[i] }}>{d.value}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Collection Rate</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 99, height: 8 }}>
                      <div style={{ width: `${pct(data.totalCollected, data.totalRevenue)}%`, background: `linear-gradient(90deg,${C.purple},${C.green})`, height: '100%', borderRadius: 99, transition: 'width .5s' }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{pct(data.totalCollected, data.totalRevenue)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={s.twoCol}>
        <div style={s.panel}>
          <div style={s.panelTitle}>Payment Methods — Amount Collected</div>
          {methodPie.length === 0 ? <Empty msg="No payments in this period." /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={methodPie} cx="50%" cy="50%" outerRadius={80} paddingAngle={3} dataKey="value">
                    {methodPie.map((m, i) => <Cell key={i} fill={m.color} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {methodPie.map(m => (
                  <div key={m.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, color: '#374151' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color, display: 'inline-block' }} />
                        {m.name}
                      </span>
                      <span style={{ color: m.color, fontWeight: 700 }}>{fmt(m.value)}</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6 }}>
                      <div style={{ width: `${pct(m.value, methodTotal)}%`, height: '100%', borderRadius: 99, background: m.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={s.panel}>
          <div style={s.panelTitle}>Finance Position</div>
          {[
            { label: 'Account Balance',  value: fmt(data.totalAccountBalance), color: C.blue, icon: '🏦' },
            { label: 'Total Outstanding',value: fmt(data.totalOutstanding),    color: C.red,  icon: '⚠️' },
            { label: 'Net Cash Flow',    value: fmt(data.netCashFlow),         color: data.netCashFlow >= 0 ? C.green : C.red, icon: data.netCashFlow >= 0 ? '📈' : '📉' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 10, borderLeft: `3px solid ${item.color}`, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{item.icon} {item.label}</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sales by Customer ─────────────────────────────────────────────────────────
function SalesTab({ from, to }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await getReportSalesByCustomer({ from, to })); }
    catch { setRows([]); }
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

  if (loading) return <Loader />;

  return (
    <div>
      {chartData.length > 0 && (
        <div style={s.panel}>
          <div style={s.panelTitle}>Revenue vs Collected vs Outstanding — Top {chartData.length} Customers</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Revenue"     fill={C.green}  radius={[4, 4, 0, 0]} />
              <Bar dataKey="Collected"   fill={C.purple} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Outstanding" fill={C.red}    radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={s.panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={s.panelTitle}>Customer Breakdown</div>
          <input style={s.search} placeholder="Search customer…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filtered.length === 0 ? <Empty msg="No sales found in this period." /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>{['#', 'Customer', 'Sales', 'Revenue', 'Collected', 'Outstanding', 'Paid', 'Partial', 'Pending'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.customerId} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                    <td style={{ ...s.td, color: '#9ca3af', textAlign: 'center' }}>{i + 1}</td>
                    <td style={s.td}><b style={{ color: '#1e2a3b' }}>{r.customerName}</b></td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{r.salesCount}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: C.green }}>{fmt(r.totalRevenue)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: C.purple }}>{fmt(r.totalCollected)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: r.totalOutstanding > 0 ? C.red : '#9ca3af' }}>{fmt(r.totalOutstanding)}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}><Badge color={C.green}  bg="#dcfce7">{r.paidCount}</Badge></td>
                    <td style={{ ...s.td, textAlign: 'center' }}><Badge color="#d97706" bg="#fef3c7">{r.partialCount}</Badge></td>
                    <td style={{ ...s.td, textAlign: 'center' }}><Badge color={C.red}   bg="#fee2e2">{r.pendingCount}</Badge></td>
                  </tr>
                ))}
                <tr style={{ background: '#1e2a3b', fontWeight: 700 }}>
                  <td style={{ ...s.td, color: '#7a9cc0' }} colSpan={2}>TOTALS</td>
                  <td style={{ ...s.td, textAlign: 'center', color: '#fff' }}>{totals.sales}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#34d399' }}>{fmt(totals.revenue)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#a78bfa' }}>{fmt(totals.collected)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#f87171' }}>{fmt(totals.outstanding)}</td>
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

// ─── Cash Flow ─────────────────────────────────────────────────────────────────
function CashFlowTab({ from, to }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await getReportMonthlyCashFlow({ from, to })); }
    catch { setRows([]); }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;
  if (rows.length === 0) return <Empty msg="No data found in this period." />;

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
      <div style={s.panel}>
        <div style={s.panelTitle}>Revenue vs Collected — Monthly Trend</div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={shortRows} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="gRev"  x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.green}  stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.green}  stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gColl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.purple} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.purple} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
            <Tooltip content={<ChartTip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue"   name="Revenue"   stroke={C.green}  fill="url(#gRev)"  strokeWidth={2.5} dot={{ r: 4 }} />
            <Area type="monotone" dataKey="collected" name="Collected" stroke={C.purple} fill="url(#gColl)" strokeWidth={2.5} dot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={s.twoCol}>
        <div style={s.panel}>
          <div style={s.panelTitle}>Monthly Expenses — Stacked</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={shortRows} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="purchaseExpenses" name="Purchases" stackId="a" fill={C.amber} />
              <Bar dataKey="wageExpenses"     name="Wages"     stackId="a" fill={C.cyan} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={s.panel}>
          <div style={s.panelTitle}>Net Cash Flow — Monthly</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={shortRows} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="netCashFlow" name="Net Cash Flow" radius={[4, 4, 0, 0]}>
                {shortRows.map((r, i) => <Cell key={i} fill={r.netCashFlow >= 0 ? C.green : C.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={s.panel}>
        <div style={s.panelTitle}>Monthly Summary Table</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>{['Month', 'Revenue', 'Collected', 'Purchases', 'Wages', 'Total Exp.', 'Net Cash Flow'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.year}-${r.month}`} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                  <td style={{ ...s.td, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.monthName}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: C.green,  fontWeight: 600 }}>{fmt(r.revenue)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: C.purple, fontWeight: 600 }}>{fmt(r.collected)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: C.amber  }}>{fmt(r.purchaseExpenses)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: C.cyan   }}>{fmt(r.wageExpenses)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: C.red    }}>{fmt(r.totalExpenses)}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: r.netCashFlow >= 0 ? C.green : C.red }}>
                    {r.netCashFlow >= 0 ? '+' : ''}{fmt(r.netCashFlow)}
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#1e2a3b', fontWeight: 700 }}>
                <td style={{ ...s.td, color: '#7a9cc0' }}>TOTAL</td>
                <td style={{ ...s.td, textAlign: 'right', color: '#34d399' }}>{fmt(totals.revenue)}</td>
                <td style={{ ...s.td, textAlign: 'right', color: '#a78bfa' }}>{fmt(totals.collected)}</td>
                <td style={{ ...s.td, textAlign: 'right', color: '#fbbf24' }}>{fmt(totals.purchases)}</td>
                <td style={{ ...s.td, textAlign: 'right', color: '#67e8f9' }}>{fmt(totals.wages)}</td>
                <td style={{ ...s.td, textAlign: 'right', color: '#f87171' }}>{fmt(totals.expenses)}</td>
                <td style={{ ...s.td, textAlign: 'right', color: totals.net >= 0 ? '#34d399' : '#f87171' }}>
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

// ─── Payroll ──────────────────────────────────────────────────────────────────
function PayrollTab({ from, to }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState({});
  const [search,   setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getReportPayroll({ from, to })); }
    catch { setData(null); }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;
  if (!data)   return <Empty msg="Could not load payroll data." />;

  const toggle = id => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const workers   = (data.byWorker || []).filter(w => w.workerName.toLowerCase().includes(search.toLowerCase()));
  const monthly   = data.monthlyBreakdown || [];
  const showMonthly = monthly.length > 1;

  // Charts
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
      {/* KPI Row */}
      <div style={s.kpiGrid}>
        {[
          { label: 'Total Gross',       value: fmt(data.totalGross),            color: C.blue,   bg: '#eff6ff', icon: '💼' },
          { label: 'Total Deductions',  value: fmt(data.totalDeductions),       color: C.red,    bg: '#fef2f2', icon: '✂️' },
          { label: 'Total Net Pay',     value: fmt(data.totalNet),              color: C.green,  bg: '#ecfdf5', icon: '💵' },
          { label: 'Total Advances',    value: fmt(data.totalAdvances),         color: C.amber,  bg: '#fffbeb', icon: '📋' },
          { label: 'Unsettled Advances',value: fmt(data.totalUnsettledAdvances),color: C.orange, bg: '#fff7ed', icon: '⚠️' },
          { label: 'Workers Paid',      value: data.workerCount,                color: C.purple, bg: '#f5f3ff', icon: '👷' },
        ].map(k => (
          <div key={k.label} style={{ ...s.kpiCard, background: k.bg, borderLeft: `4px solid ${k.color}` }}>
            <div style={s.kpiIcon}>{k.icon}</div>
            <div>
              <div style={{ ...s.kpiVal, color: k.color }}>{k.value}</div>
              <div style={s.kpiLabel}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={s.twoCol}>
        {/* Gross vs Net per worker */}
        {workerBar.length > 0 && (
          <div style={s.panel}>
            <div style={s.panelTitle}>Gross vs Net Pay — Per Worker</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={workerBar} margin={{ top: 4, right: 16, left: 0, bottom: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Gross"      fill={C.blue}  radius={[3, 3, 0, 0]} />
                <Bar dataKey="Net"        fill={C.green} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Deductions" fill={C.red}   radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Deductions pie OR monthly trend */}
        {deductionsPie.length > 0 ? (
          <div style={s.panel}>
            <div style={s.panelTitle}>Deductions Breakdown — By Worker</div>
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
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151' }}>
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
          <div style={s.panel}>
            <div style={s.panelTitle}>Monthly Payroll Summary</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyBar} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Gross"    fill={C.blue}  radius={[3, 3, 0, 0]} />
                <Bar dataKey="Net"      fill={C.green} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Advances" fill={C.amber} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Monthly area trend (if multiple months) */}
      {showMonthly && deductionsPie.length > 0 && (
        <div style={s.panel}>
          <div style={s.panelTitle}>Monthly Payroll Trend</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyBar} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.blue}  stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.blue}  stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.green} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Gross" stroke={C.blue}  fill="url(#gGross)" strokeWidth={2} dot={{ r: 3 }} />
              <Area type="monotone" dataKey="Net"   stroke={C.green} fill="url(#gNet)"   strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Worker Detail Table */}
      <div style={s.panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={s.panelTitle}>Worker Payroll Detail</div>
          <input style={s.search} placeholder="Search worker…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {workers.length === 0 ? <Empty msg="No payroll records in this period." /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Worker', 'Type', 'Payments', 'Gross', 'Deductions', 'Net Pay', 'Advances', 'Unsettled', ''].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workers.map((w, i) => (
                  <>
                    <tr key={w.workerId} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{w.workerName}</td>
                      <td style={s.td}>
                        <Badge color={w.workerType === 'Management' ? '#7030A0' : C.blue} bg={w.workerType === 'Management' ? '#F3E8FF' : '#EBF3FB'}>
                          {w.workerType}
                        </Badge>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{w.paymentsCount}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: C.blue }}>{fmt(w.totalGross)}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: w.totalDeductions > 0 ? C.red : '#9ca3af' }}>
                        {w.totalDeductions > 0 ? `-${fmt(w.totalDeductions)}` : '—'}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: C.green }}>{fmt(w.totalNet)}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: C.amber }}>{w.totalAdvances > 0 ? fmt(w.totalAdvances) : '—'}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: w.unsettledAdvances > 0 ? C.orange : '#9ca3af' }}>
                        {w.unsettledAdvances > 0 ? fmt(w.unsettledAdvances) : '—'}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        {(w.payments.length > 0 || w.advances.length > 0) && (
                          <button onClick={() => toggle(w.workerId)}
                            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: '#6b7280' }}>
                            {expanded[w.workerId] ? '▲ Hide' : '▼ Detail'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {expanded[w.workerId] && (
                      <tr key={`${w.workerId}-detail`}>
                        <td colSpan={9} style={{ padding: '0 16px 12px', background: '#f8fafc' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12, paddingTop: 10 }}>
                            {/* Wage Payments */}
                            {w.payments.length > 0 && (
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 6 }}>Wage Payments</div>
                                <table style={{ ...s.table, fontSize: 12 }}>
                                  <thead>
                                    <tr>
                                      {['Period', 'Gross', 'Deduct', 'Net', 'Paid On'].map(h => (
                                        <th key={h} style={{ ...s.th, background: '#e5e7eb', fontSize: 10 }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {w.payments.map((p, pi) => (
                                      <tr key={p.id} style={pi % 2 === 0 ? { background: '#fff' } : { background: '#f1f5f9' }}>
                                        <td style={{ ...s.td, fontSize: 11, whiteSpace: 'nowrap' }}>
                                          {fmtShort(p.periodFrom)} – {fmtShort(p.periodTo)}
                                        </td>
                                        <td style={{ ...s.td, textAlign: 'right' }}>{fmt(p.grossAmount)}</td>
                                        <td style={{ ...s.td, textAlign: 'right', color: C.red }}>{p.deductions > 0 ? fmt(p.deductions) : '—'}</td>
                                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: C.green }}>{fmt(p.netAmount)}</td>
                                        <td style={{ ...s.td, fontSize: 11, color: '#6b7280' }}>{fmtShort(p.paidAt)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Advances */}
                            {w.advances.length > 0 && (
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 6 }}>Advances</div>
                                <table style={{ ...s.table, fontSize: 12 }}>
                                  <thead>
                                    <tr>
                                      {['Date', 'Amount', 'Status', 'Notes'].map(h => (
                                        <th key={h} style={{ ...s.th, background: '#e5e7eb', fontSize: 10 }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {w.advances.map((a, ai) => (
                                      <tr key={a.id} style={ai % 2 === 0 ? { background: '#fff' } : { background: '#f1f5f9' }}>
                                        <td style={{ ...s.td, fontSize: 11 }}>{fmtShort(a.advanceDate)}</td>
                                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: C.amber }}>{fmt(a.amount)}</td>
                                        <td style={s.td}>
                                          <Badge color={a.isSettled ? C.green : C.orange} bg={a.isSettled ? '#dcfce7' : '#fff7ed'}>
                                            {a.isSettled ? 'Settled' : 'Pending'}
                                          </Badge>
                                        </td>
                                        <td style={{ ...s.td, color: '#9ca3af', fontSize: 11 }}>{a.notes || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}

                {/* Totals */}
                <tr style={{ background: '#1e2a3b', fontWeight: 700 }}>
                  <td colSpan={2} style={{ ...s.td, color: '#7a9cc0' }}>TOTALS ({workers.length} workers)</td>
                  <td style={{ ...s.td, textAlign: 'center', color: '#fff' }}>{workers.reduce((a, w) => a + w.paymentsCount, 0)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#93c5fd' }}>{fmt(workers.reduce((a, w) => a + w.totalGross, 0))}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#f87171' }}>{fmt(workers.reduce((a, w) => a + w.totalDeductions, 0))}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#34d399' }}>{fmt(workers.reduce((a, w) => a + w.totalNet, 0))}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#fbbf24' }}>{fmt(workers.reduce((a, w) => a + w.totalAdvances, 0))}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#fb923c' }}>{fmt(workers.reduce((a, w) => a + w.unsettledAdvances, 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly Summary Table */}
      {showMonthly && (
        <div style={s.panel}>
          <div style={s.panelTitle}>Monthly Payroll Breakdown</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>{['Month', 'Workers', 'Gross', 'Deductions', 'Net Pay', 'Advances'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {monthly.map((m, i) => (
                  <tr key={`${m.year}-${m.month}`} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{m.monthName}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{m.workerCount}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: C.blue }}>{fmt(m.gross)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: m.deductions > 0 ? C.red : '#9ca3af' }}>
                      {m.deductions > 0 ? fmt(m.deductions) : '—'}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: C.green }}>{fmt(m.net)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: m.advances > 0 ? C.amber : '#9ca3af' }}>
                      {m.advances > 0 ? fmt(m.advances) : '—'}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#1e2a3b', fontWeight: 700 }}>
                  <td colSpan={2} style={{ ...s.td, color: '#7a9cc0' }}>TOTAL</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#93c5fd' }}>{fmt(data.totalGross)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#f87171' }}>{fmt(data.totalDeductions)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#34d399' }}>{fmt(data.totalNet)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#fbbf24' }}>{fmt(data.totalAdvances)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Account Ledger ───────────────────────────────────────────────────────────
function LedgerTab({ from, to }) {
  const [accounts,    setAccounts]    = useState([]);
  const [accountId,   setAccountId]   = useState('');
  const [statement,   setStatement]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [accsLoading, setAccsLoading] = useState(true);

  useEffect(() => {
    getAccounts()
      .then(a => { setAccounts(a); if (a.length > 0) setAccountId(String(a[0].id)); })
      .catch(() => {})
      .finally(() => setAccsLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try { setStatement(await getReportAccountStatement({ accountId, from, to })); }
    catch { setStatement(null); }
    setLoading(false);
  }, [accountId, from, to]);

  useEffect(() => { load(); }, [load]);

  if (accsLoading) return <Loader />;
  if (accounts.length === 0) return <Empty msg="No accounts found. Create accounts in Finance first." />;

  const credits = statement?.lines?.filter(l => l.type === 'Credit').reduce((a, l) => a + l.amount, 0) ?? 0;
  const debits  = statement?.lines?.filter(l => l.type === 'Debit' ).reduce((a, l) => a + l.amount, 0) ?? 0;
  const ledgerPie = [{ name: 'Credits', value: credits }, { name: 'Debits', value: debits }].filter(d => d.value > 0);
  const lineData  = (statement?.lines ?? []).map((l, i) => ({ name: `#${i + 1}`, Balance: l.runningBalance }));

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>Account:</label>
        <select style={s.acctSelect} value={accountId} onChange={e => setAccountId(e.target.value)}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {a.categoryName}</option>)}
        </select>
      </div>

      {loading && <Loader />}

      {!loading && statement && (
        <>
          {statement.lines.length > 0 && (
            <div style={s.twoCol}>
              <div style={s.panel}>
                <div style={s.panelTitle}>Running Balance</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={lineData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="gBal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.blue} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={C.blue} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="Balance" stroke={C.blue} fill="url(#gBal)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={s.panel}>
                <div style={s.panelTitle}>Credits vs Debits</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={ledgerPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        {ledgerPie.map((_, i) => <Cell key={i} fill={[C.green, C.red][i]} />)}
                      </Pie>
                      <Tooltip content={<PieTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {[
                      { label: 'Opening', value: statement.openingBalance, color: '#6b7280' },
                      { label: 'Credits', value: credits,                  color: C.green   },
                      { label: 'Debits',  value: debits,                   color: C.red     },
                      { label: 'Closing', value: statement.closingBalance, color: statement.closingBalance >= 0 ? C.blue : C.red },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                        <span style={{ color: '#6b7280' }}>{item.label}</span>
                        <span style={{ fontWeight: 700, color: item.color }}>{fmt(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={s.panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={s.panelTitle}>{statement.accountName} — Statement</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{statement.categoryName}</div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Opening</div>
                  <div style={{ fontWeight: 700 }}>{fmt(statement.openingBalance)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Closing</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: statement.closingBalance >= 0 ? C.green : C.red }}>
                    {fmt(statement.closingBalance)}
                  </div>
                </div>
              </div>
            </div>
            {statement.lines.length === 0
              ? <div style={{ color: '#9ca3af', fontSize: 13 }}>No transactions in this period.</div>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Date</th>
                        <th style={s.th}>Description</th>
                        <th style={s.th}>Ref</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Credit</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Debit</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: '#f8fafc' }}>
                        <td style={s.td} colSpan={5}><span style={{ color: '#6b7280', fontSize: 12 }}>Opening Balance</span></td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{fmt(statement.openingBalance)}</td>
                      </tr>
                      {statement.lines.map((l, i) => (
                        <tr key={l.id} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                          <td style={{ ...s.td, whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(l.date)}</td>
                          <td style={{ ...s.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.description}</td>
                          <td style={{ ...s.td, color: '#9ca3af', fontSize: 11 }}>{l.referenceNo || '—'}</td>
                          <td style={{ ...s.td, textAlign: 'right', color: l.type === 'Credit' ? C.green : '#e5e7eb', fontWeight: l.type === 'Credit' ? 600 : 400 }}>
                            {l.type === 'Credit' ? fmt(l.amount) : '—'}
                          </td>
                          <td style={{ ...s.td, textAlign: 'right', color: l.type === 'Debit' ? C.red : '#e5e7eb', fontWeight: l.type === 'Debit' ? 600 : 400 }}>
                            {l.type === 'Debit' ? fmt(l.amount) : '—'}
                          </td>
                          <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: l.runningBalance >= 0 ? '#374151' : C.red }}>
                            {fmt(l.runningBalance)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: '#1e2a3b' }}>
                        <td colSpan={5} style={{ ...s.td, color: '#7a9cc0', fontWeight: 700 }}>Closing Balance</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: statement.closingBalance >= 0 ? '#34d399' : '#f87171' }}>
                          {fmt(statement.closingBalance)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </>
      )}
    </div>
  );
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
function ExpensesTab({ from, to }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getReportExpenses({ from, to })); }
    catch { setData(null); }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;
  if (!data)   return <Empty msg="Could not load expenses." />;

  const splitPie = [
    { name: 'Purchases', value: data.totalPurchases },
    { name: 'Wages',     value: data.totalWages     },
  ].filter(d => d.value > 0);
  const splitColors = [C.amber, C.cyan];
  const matBar = (data.byMaterial || []).map((m, i) => ({ name: m.material, Amount: m.totalAmount, color: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Purchase Expenses', value: fmt(data.totalPurchases), color: C.amber, bg: '#fffbeb', icon: '📦' },
          { label: 'Wages Paid',        value: fmt(data.totalWages),     color: C.cyan,  bg: '#ecfeff', icon: '👷' },
          { label: 'Grand Total',       value: fmt(data.grandTotal),     color: C.red,   bg: '#fef2f2', icon: '💸' },
        ].map(k => (
          <div key={k.label} style={{ ...s.kpiCard, background: k.bg, borderLeft: `4px solid ${k.color}`, flex: 1, minWidth: 160 }}>
            <div style={s.kpiIcon}>{k.icon}</div>
            <div>
              <div style={{ ...s.kpiVal, color: k.color }}>{k.value}</div>
              <div style={s.kpiLabel}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={s.twoCol}>
        <div style={s.panel}>
          <div style={s.panelTitle}>Expense Split</div>
          {splitPie.length === 0 ? <Empty msg="No expenses in this period." /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width={200} height={200}>
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
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, color: '#374151' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: splitColors[i], display: 'inline-block' }} />
                        {d.name}
                      </span>
                      <span style={{ fontWeight: 700, color: splitColors[i] }}>{fmt(d.value)}</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8 }}>
                      <div style={{ width: `${pct(d.value, data.grandTotal)}%`, height: '100%', borderRadius: 99, background: splitColors[i] }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{pct(d.value, data.grandTotal)}% of total</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={s.panel}>
          <div style={s.panelTitle}>Purchases by Material</div>
          {matBar.length === 0 ? <Empty msg="No purchases in this period." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={matBar} layout="vertical" margin={{ top: 4, right: 16, left: 40, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={60} />
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
        <div style={s.panel}>
          <div style={s.panelTitle}>Wage Payments</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>{['Worker', 'Period', 'Gross', 'Deductions', 'Net', 'Paid On'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.wagePayments.map((w, i) => (
                  <tr key={w.id} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{w.workerName}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtShort(w.periodFrom)} – {fmtShort(w.periodTo)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(w.grossAmount)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: w.deductions > 0 ? C.red : '#9ca3af' }}>
                      {w.deductions > 0 ? `-${fmt(w.deductions)}` : '—'}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: C.cyan }}>{fmt(w.netAmount)}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtShort(w.paidAt)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#1e2a3b' }}>
                  <td colSpan={4} style={{ ...s.td, color: '#7a9cc0', fontWeight: 700 }}>TOTAL</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#67e8f9', fontWeight: 700 }}>{fmt(data.totalWages)}</td>
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
function Loader() {
  return <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>⏳ Loading report…</div>;
}
function Empty({ msg }) {
  return <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>{msg}</div>;
}
function Badge({ color, bg, children }) {
  return <span style={{ background: bg, color, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{children}</span>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page:        { fontFamily: "'Segoe UI', Arial, sans-serif", background: '#f1f5f9', minHeight: '100vh' },
  header:      { background: 'linear-gradient(135deg,#1e2a3b 0%,#2d3f57 100%)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 14 },
  headerIcon:  { fontSize: 30, background: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 12 },
  headerSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: '1.4rem', fontWeight: 700 },
  // Period bar
  periodBar:   { background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 2rem', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  presetGroup: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  presetBtn:   { padding: '5px 12px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#f8fafc', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' },
  presetActive:{ background: '#1e2a3b', color: '#fff', borderColor: '#1e2a3b' },
  customRange: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 8, paddingLeft: 12, borderLeft: '2px solid #e5e7eb' },
  dateInput:   { padding: '5px 9px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff' },
  applyBtn:    { background: C.green, color: '#fff', border: 'none', borderRadius: 7, padding: '5px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  // Tabs
  tabBar:      { display: 'flex', background: '#fff', borderBottom: '2px solid #e5e7eb', padding: '0 2rem', overflowX: 'auto' },
  tabBtn:      { padding: '11px 16px', border: 'none', background: 'none', fontSize: 13, fontWeight: 500, color: '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '2px solid transparent', marginBottom: -2 },
  tabActive:   { color: '#1e2a3b', fontWeight: 700, borderBottom: '2px solid #2E75B6' },
  body:        { padding: '1.5rem 2rem' },
  // Content
  kpiGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 },
  kpiCard:     { borderRadius: 12, padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,.06)' },
  kpiIcon:     { fontSize: 22, flexShrink: 0 },
  kpiVal:      { fontSize: '1.25rem', fontWeight: 800, lineHeight: 1 },
  kpiLabel:    { fontSize: 11, color: '#6b7280', marginTop: 3, fontWeight: 500 },
  twoCol:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16, marginBottom: 16 },
  panel:       { background: '#fff', borderRadius: 14, padding: '1.3rem 1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,.06)', marginBottom: 16 },
  panelTitle:  { fontSize: 14, fontWeight: 700, color: '#1e2a3b', marginBottom: 14 },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { background: '#f8fafc', color: '#374151', padding: '9px 11px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' },
  trEven:      { background: '#fff' },
  trOdd:       { background: '#f8fafc' },
  td:          { padding: '9px 11px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  search:      { padding: '6px 11px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', minWidth: 180 },
  acctSelect:  { padding: '7px 11px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', minWidth: 260, background: '#fff' },
};
