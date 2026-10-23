import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  getReportFinanceSummary, getReportMonthlyCashFlow,
  getReportSalesByCustomer, getReportPaymentMethods,
  getSales, getPurchases, getLots,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt   = n => `Rs ${Number(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtK  = n => { const v = Number(n ?? 0); if (v >= 1_000_000) return `Rs ${(v/1_000_000).toFixed(1)}M`; if (v >= 1_000) return `Rs ${(v/1_000).toFixed(0)}K`; return `Rs ${v}`; };
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const today     = new Date().toISOString().split('T')[0];
const yearStart = `${new Date().getFullYear()}-01-01`;

const COLORS    = ['#059669','#7c3aed','#2E75B6','#f59e0b','#e11d48','#0891b2','#0d9488','#ea580c','#4f46e5','#d97706'];
const ACTIVE_STATUSES   = ['Stitching','Rafo','Button','Press'];
const COMPLETE_STATUSES = ['Delivered'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Shared Tooltip ───────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e2a3b', borderRadius: 8, padding: '8px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.35)' }}>
      {label && <div style={{ color: '#7a9cc0', marginBottom: 5, fontWeight: 700 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: '#fff', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color, display: 'inline-block', flexShrink: 0 }} />
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
    <div style={{ background: '#1e2a3b', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ color: '#fff', fontWeight: 700 }}>{p.name}</div>
      <div style={{ color: '#94a3b8', marginTop: 2 }}>{fmt(p.value)}</div>
    </div>
  );
};

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, onClick, wide }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff', borderRadius: 12,
        padding: wide ? '20px 24px' : '18px 20px',
        boxShadow: hov && onClick ? '0 6px 20px rgba(0,0,0,.13)' : '0 1px 5px rgba(0,0,0,.07)',
        borderTop: `4px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        flex: 1, minWidth: 0,
        transition: 'box-shadow .15s, transform .15s',
        transform: hov && onClick ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: wide ? 24 : 21, fontWeight: 800, color: '#111', lineHeight: 1.15, wordBreak: 'break-word' }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 5 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 26, opacity: 0.75, marginLeft: 8, flexShrink: 0 }}>{icon}</div>
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e2a3b' }}>{children}</div>
      {action}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [fin,     setFin]     = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [cust,    setCust]    = useState([]);
  const [pmth,    setPmth]    = useState([]);
  const [sales,   setSales]   = useState([]);
  const [purch,   setPurch]   = useState([]);
  const [lots,    setLots]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    const p = { from: yearStart, to: today };
    Promise.all([
      getReportFinanceSummary(p),
      getReportMonthlyCashFlow(p),
      getReportSalesByCustomer(p),
      getReportPaymentMethods(p),
      getSales({}),
      getPurchases({}),
      getLots({}),
    ])
      .then(([f, mon, customers, pm, s, pu, l]) => {
        setFin(f);
        setMonthly(mon ?? []);
        setCust((customers ?? []).slice(0, 7));
        setPmth(pm ?? []);
        const sArr = Array.isArray(s) ? s : (s?.items ?? []);
        const pArr = Array.isArray(pu) ? pu : (pu?.items ?? []);
        setSales([...sArr].sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate)).slice(0, 6));
        setPurch([...pArr].sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)).slice(0, 6));
        setLots(l ?? []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const activeLots    = lots.filter(l => ACTIVE_STATUSES.includes(l.status)).length;
  const deliveredLots = lots.filter(l => COMPLETE_STATUSES.includes(l.status)).length;
  const lotsByStatus  = ACTIVE_STATUSES.map(st => ({ status: st, count: lots.filter(l => l.status === st).length }));

  const dateStr = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const netPositive = (fin?.netCashFlow ?? 0) >= 0;

  const NAV_LINKS = [
    { label: '📊 Finance',    path: '/accounts'   },
    { label: '💼 Payroll',    path: '/wages'       },
    { label: '🧾 Sales',      path: '/sales'       },
    { label: '📋 Purchase',   path: '/purchasing'  },
    { label: '🏭 Stock',      path: '/inventory'   },
    { label: '⚙️ Production', path: '/labour'      },
    { label: '📦 Lot Status', path: '/lot-status'  },
    { label: '📊 Reports',    path: '/reports'     },
  ];

  return (
    <div style={{ background: '#f4f6f9', minHeight: '100vh' }}>

      {/* ── Welcome Banner ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e2a3b 0%, #2E75B6 100%)',
        padding: '28px 32px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>
            {greeting()}, {user?.name?.split(' ')[0] ?? 'User'} 👋
          </div>
          <div style={{ fontSize: 13, color: '#93c5fd', marginTop: 4 }}>{dateStr}</div>
          <div style={{ fontSize: 12, color: '#bfdbfe', marginTop: 2 }}>
            Factory Overview · {new Date().getFullYear()} Year to Date
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#93c5fd', marginBottom: 8, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1 }}>Quick Access</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {NAV_LINKS.map(q => (
              <button key={q.path} onClick={() => navigate(q.path)} style={{
                background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)',
                color: '#fff', borderRadius: 7, padding: '5px 13px', fontSize: 12,
                cursor: 'pointer', fontWeight: 600, transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.24)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
              >{q.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 28px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 18px', color: '#991b1b', fontSize: 13 }}>
            ⚠️ Some data failed to load. Please check your connection or refresh.
          </div>
        )}

        {/* ── Financial KPIs ──────────────────────────────────────────────────── */}
        <div>
          <div style={s.rowLabel}>💰 Financial Overview</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <StatCard
              icon="💵" label="Total Revenue" color="#059669"
              value={loading ? '…' : fmtK(fin?.totalRevenue)}
              sub={`${fin?.salesCount ?? 0} sales this year`}
              onClick={() => navigate('/sales')}
            />
            <StatCard
              icon="✅" label="Collected" color="#7c3aed"
              value={loading ? '…' : fmtK(fin?.totalCollected)}
              sub="Cash received"
            />
            <StatCard
              icon="⏳" label="Outstanding" color="#dc2626"
              value={loading ? '…' : fmtK(fin?.totalOutstanding)}
              sub={`${(fin?.pendingCount ?? 0) + (fin?.partialCount ?? 0)} unpaid orders`}
              onClick={() => navigate('/sales')}
            />
            <StatCard
              icon="📦" label="Purchases" color="#f59e0b"
              value={loading ? '…' : fmtK(fin?.totalPurchaseExpenses)}
              sub="Materials & supplies"
              onClick={() => navigate('/purchasing')}
            />
            <StatCard
              icon="👷" label="Wages Paid" color="#0891b2"
              value={loading ? '…' : fmtK(fin?.totalWagesExpenses)}
              sub="Worker payments"
              onClick={() => navigate('/wages')}
            />
            <StatCard
              icon="🏦" label="Account Balance" color="#2E75B6"
              value={loading ? '…' : fmtK(fin?.totalAccountBalance)}
              sub="All active accounts"
              onClick={() => navigate('/accounts')}
            />
          </div>
        </div>

        {/* ── Operations KPIs ─────────────────────────────────────────────────── */}
        <div>
          <div style={s.rowLabel}>⚙️ Operations</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <StatCard
              icon="🌊" label="Net Cash Flow" color={netPositive ? '#059669' : '#dc2626'}
              value={loading ? '…' : fmtK(fin?.netCashFlow)}
              sub={netPositive ? 'Positive flow' : 'Negative flow'}
            />
            <StatCard
              icon="🔄" label="Active Lots" color="#ea580c"
              value={loading ? '…' : activeLots}
              sub={`${deliveredLots} delivered this year`}
              onClick={() => navigate('/lot-status')}
            />
            <StatCard
              icon="✅" label="Paid Orders" color="#059669"
              value={loading ? '…' : (fin?.paidCount ?? 0)}
              sub={`${fin?.partialCount ?? 0} partial`}
              onClick={() => navigate('/sales')}
            />
            <StatCard
              icon="🕐" label="Pending Orders" color="#dc2626"
              value={loading ? '…' : (fin?.pendingCount ?? 0)}
              sub="Awaiting payment"
              onClick={() => navigate('/sales')}
            />
          </div>
        </div>

        {/* ── Lot Status Breakdown ─────────────────────────────────────────────── */}
        {!loading && lots.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 5px rgba(0,0,0,.07)' }}>
            <SectionTitle>
              📦 Lot Status Breakdown
              <button onClick={() => navigate('/lot-status')} style={s.viewAllBtn}>View All →</button>
            </SectionTitle>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[...lotsByStatus, { status: 'Delivered', count: deliveredLots }].map(({ status, count }) => (
                <div key={status} onClick={() => navigate('/lot-status')} style={{
                  flex: 1, minWidth: 110, background: '#f8fafc', borderRadius: 10,
                  padding: '14px 16px', cursor: 'pointer', textAlign: 'center',
                  border: `2px solid ${LOT_COLORS[status] ?? '#e5e7eb'}`,
                  transition: 'box-shadow .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ fontSize: 24, fontWeight: 800, color: LOT_COLORS[status] ?? '#374151' }}>{count}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginTop: 3 }}>{status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Charts Row: Monthly Cash Flow + Payment Methods ──────────────────── */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>

          {/* Monthly Cash Flow */}
          <div style={{ flex: 3, minWidth: 320, background: '#fff', borderRadius: 12, padding: '20px 20px 12px', boxShadow: '0 1px 5px rgba(0,0,0,.07)' }}>
            <SectionTitle>
              📈 Monthly Cash Flow — {new Date().getFullYear()}
              <button onClick={() => navigate('/reports')} style={s.viewAllBtn}>Full Report →</button>
            </SectionTitle>
            {loading ? <Loader h={230} /> : monthly.length === 0 ? <Empty h={230} /> : (
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={monthly} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gColl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#059669" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2E75B6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#2E75B6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="monthName"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={v => v.replace(/(\w+)\s(\d{4})/, (_, m, y) => `${m} '${y.slice(2)}`)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="collected"     name="Collected"  stroke="#059669" fill="url(#gColl)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="totalExpenses" name="Expenses"   stroke="#dc2626" fill="url(#gExp)"  strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="netCashFlow"   name="Net Flow"   stroke="#2E75B6" fill="url(#gNet)"  strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment Methods */}
          <div style={{ flex: 1, minWidth: 220, background: '#fff', borderRadius: 12, padding: '20px 20px 12px', boxShadow: '0 1px 5px rgba(0,0,0,.07)' }}>
            <SectionTitle>💳 Payment Methods</SectionTitle>
            {loading ? <Loader h={230} /> : pmth.length === 0 ? <Empty h={230} label="No payment data" /> : (
              <>
                <ResponsiveContainer width="100%" height={165}>
                  <PieChart>
                    <Pie data={pmth} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={72} innerRadius={36} paddingAngle={3}>
                      {pmth.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<PieTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                  {pmth.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: '#374151' }}>{m.method}</span>
                      </span>
                      <span style={{ color: '#111', fontWeight: 700 }}>{fmtK(m.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Charts Row 2: Top Customers + Recent Sales ────────────────────────── */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>

          {/* Top Customers */}
          <div style={{ flex: 1, minWidth: 300, background: '#fff', borderRadius: 12, padding: '20px 20px 12px', boxShadow: '0 1px 5px rgba(0,0,0,.07)' }}>
            <SectionTitle>
              🤝 Top Customers by Revenue
              <button onClick={() => navigate('/sales')} style={s.viewAllBtn}>View Sales →</button>
            </SectionTitle>
            {loading ? <Loader h={240} /> : cust.length === 0 ? <Empty h={240} label="No customer data" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={cust} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="customerName" tick={{ fontSize: 11, fill: '#374151' }} width={95} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="totalRevenue" name="Revenue" radius={[0, 4, 4, 0]}>
                    {cust.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent Sales */}
          <div style={{ flex: 1, minWidth: 300, background: '#fff', borderRadius: 12, padding: '20px 20px 16px', boxShadow: '0 1px 5px rgba(0,0,0,.07)' }}>
            <SectionTitle>
              🧾 Recent Sales
              <button onClick={() => navigate('/sales')} style={s.viewAllBtn}>View All →</button>
            </SectionTitle>
            {loading ? <Loader h={240} /> : sales.length === 0 ? <Empty h={240} label="No sales yet" /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                    <th style={s.th}>Lot / Customer</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600, color: '#111' }}>{sale.lotNumber ?? '—'}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                          {sale.customerName ?? '—'} · {fmtDate(sale.saleDate)}
                        </div>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{fmtK(sale.netAmount)}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <span style={{ ...s.badge, ...SALE_STATUS[sale.status] }}>{sale.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Recent Purchases ──────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px 16px', boxShadow: '0 1px 5px rgba(0,0,0,.07)' }}>
          <SectionTitle>
            📋 Recent Purchases
            <button onClick={() => navigate('/purchasing')} style={s.viewAllBtn}>View All →</button>
          </SectionTitle>
          {loading ? <Loader h={120} /> : purch.length === 0 ? <Empty h={100} label="No purchases yet" /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={s.th}>Material</th>
                  <th style={s.th}>Supplier</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Qty (bags)</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Amount</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {purch.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{p.material ?? '—'}</td>
                    <td style={{ ...s.td, color: '#6b7280' }}>{p.supplierName ?? '—'}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{p.quantity ?? 0}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{fmtK(p.totalAmount ?? (p.quantity * (p.unitPrice ?? 0)))}</td>
                    <td style={{ ...s.td, textAlign: 'center', color: '#6b7280' }}>{fmtDate(p.purchaseDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const Loader = ({ h }) => (
  <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
    Loading…
  </div>
);
const Empty = ({ h, label = 'No data' }) => (
  <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
    {label}
  </div>
);

// ─── Constants ────────────────────────────────────────────────────────────────
const LOT_COLORS  = { Stitching: '#7c3aed', Rafo: '#0891b2', Button: '#f59e0b', Press: '#ea580c', Delivered: '#059669' };
const SALE_STATUS = {
  Paid:    { background: '#dcfce7', color: '#166534' },
  Partial: { background: '#fef3c7', color: '#92400e' },
  Pending: { background: '#fee2e2', color: '#991b1b' },
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  rowLabel:  { fontSize: 12, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  th:        { padding: '8px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  td:        { padding: '10px 10px', color: '#111', verticalAlign: 'middle' },
  badge:     { padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, display: 'inline-block' },
  viewAllBtn:{ fontSize: 12, color: '#2E75B6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 },
};
