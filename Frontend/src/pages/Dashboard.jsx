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
import { useTheme } from '../context/ThemeContext';
import LotHistoryModal from '../components/LotHistoryModal';

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt   = n => `Rs ${Number(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtK  = n => {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}Rs ${(abs/1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}Rs ${(abs/1_000).toFixed(0)}K`;
  return `${sign}Rs ${abs.toLocaleString('en-PK')}`;
};
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const today     = new Date().toISOString().split('T')[0];
const yearStart = `${new Date().getFullYear()}-01-01`;

// ─── Professional Bootstrap 5 Palette ─────────────────────────────────────────
const BT_COLORS = {
  primary:   '#0d6efd',
  secondary: '#6c757d',
  success:   '#198754',
  danger:    '#dc3545',
  warning:   '#ffc107',
  info:      '#0dcaf0',
  dark:      '#212529',
  indigo:    '#6610f2',
  purple:    '#6f42c1',
  pink:      '#d63384',
  teal:      '#20c997',
  orange:    '#fd7e14',
};

const CHART_PALETTE = ['#0d6efd', '#198754', '#ffc107', '#0dcaf0', '#6f42c1', '#d63384', '#fd7e14', '#20c997'];
const ACTIVE_STATUSES   = ['Stitching', 'Rafo', 'Button', 'Press'];
const COMPLETE_STATUSES = ['Delivered'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Bootstrap Themed Tooltips ────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#212529',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,.45)',
      border: '1px solid #343a40'
    }}>
      {label && <div style={{ color: '#adb5bd', marginBottom: 6, fontWeight: 700 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: '#fff', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: '#ced4da' }}>{p.name}:</span>
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
    <div style={{
      background: '#212529',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,.45)',
      border: '1px solid #343a40'
    }}>
      <div style={{ color: '#fff', fontWeight: 700 }}>{p.name}</div>
      <div style={{ color: '#0dcaf0', marginTop: 3, fontWeight: 600 }}>{fmt(p.value)}</div>
    </div>
  );
};

// ─── Executive StatCard (Vibrant & Professional) ──────────────────────────────
function StatCard({ icon, label, value, sub, gradient, glow, onClick, tag }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: gradient,
        borderRadius: 14,
        padding: '16px 18px',
        color: '#ffffff',
        boxShadow: hov && onClick ? `0 10px 26px ${glow}` : `0 6px 18px ${glow}`,
        border: '1px solid rgba(255, 255, 255, 0.18)',
        cursor: onClick ? 'pointer' : 'default',
        flex: 1,
        minWidth: 180,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.16s ease, box-shadow 0.16s ease',
        transform: hov && onClick ? 'translateY(-3px)' : 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none'
      }} />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, position: 'relative', zIndex: 1 }}>
          <span style={{
            fontSize: '0.675rem', fontWeight: 800, letterSpacing: '0.05em',
            padding: '2px 8px', borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.22)', backdropFilter: 'blur(4px)',
            color: '#ffffff', textTransform: 'uppercase'
          }}>
            {tag || label}
          </span>
          <span style={{ fontSize: '1.25rem', opacity: 0.9 }}>{icon}</span>
        </div>

        <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', lineHeight: 1.15, wordBreak: 'break-word', textShadow: '0 1px 3px rgba(0,0,0,0.25)', position: 'relative', zIndex: 1 }}>
          {value}
        </div>
      </div>

      <div style={{
        fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600,
        marginTop: 10, paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.18)',
        position: 'relative', zIndex: 1
      }}>
        {sub || label}
      </div>
    </div>
  );
}

// ─── Bootstrap Style Card Header ──────────────────────────────────────────────
function BtCardHeader({ icon, title, badgeText, badgeColor = '#4f46e5', action, isDark }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '13px 20px',
      borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#e9ecef'}`,
      background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '1.15rem' }}>{icon}</span>
        <h2 style={{
          fontSize: '0.875rem',
          fontWeight: 800,
          color: isDark ? 'var(--text-main)' : '#212529',
          margin: 0,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}>
          {title}
        </h2>
        {badgeText && (
          <span style={{
            fontSize: '0.675rem',
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: 6,
            background: `${badgeColor}18`,
            color: badgeColor,
            border: `1px solid ${badgeColor}30`,
          }}>
            {badgeText}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── Dashboard Component ──────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark, currentColor } = useTheme();

  const [fin,     setFin]     = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [cust,    setCust]    = useState([]);
  const [pmth,    setPmth]    = useState([]);
  const [sales,   setSales]   = useState([]);
  const [purch,   setPurch]   = useState([]);
  const [lots,    setLots]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);

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

  const lotBreakdownConfig = [
    { status: 'Stitching', count: lots.filter(l => l.status === 'Stitching').length, gradient: 'linear-gradient(135deg, #4c1d95, #6f42c1)', glow: 'rgba(111, 66, 193, 0.35)', icon: '🧵' },
    { status: 'Rafo',      count: lots.filter(l => l.status === 'Rafo').length,      gradient: 'linear-gradient(135deg, #087990, #0dcaf0)', glow: 'rgba(13, 202, 240, 0.35)', icon: '🪡' },
    { status: 'Button',    count: lots.filter(l => l.status === 'Button').length,    gradient: 'linear-gradient(135deg, #c2410c, #fd7e14)', glow: 'rgba(253, 126, 20, 0.35)', icon: '🔘' },
    { status: 'Press',     count: lots.filter(l => l.status === 'Press').length,     gradient: 'linear-gradient(135deg, #2c3e50, #0d6efd)', glow: 'rgba(13, 110, 253, 0.35)', icon: '♨️' },
    { status: 'Delivered', count: deliveredLots,                                     gradient: 'linear-gradient(135deg, #146c43, #198754)', glow: 'rgba(25, 135, 84, 0.35)', icon: '🚚' },
  ];

  const dateStr = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const netPositive = (fin?.netCashFlow ?? 0) >= 0;

  const NAV_LINKS = [
    { label: '📊 Finance',    path: '/accounts'   },
    { label: '💼 Payroll',    path: '/wages'       },
    { label: '🧾 Sales',      path: '/sales'       },
    { label: '📋 Purchase',   path: '/purchasing'  },
    { label: '🏭 Stock',      path: '/inventory'   },
    { label: '👷 Staff',      path: '/staff'       },
    { label: '⚙️ Production', path: '/labour'      },
    { label: '📦 Lot Status', path: '/lot-status'  },
    { label: '📊 Reports',    path: '/reports'     },
  ];

  return (
    <div style={{ background: isDark ? 'var(--bg-page)' : '#f8f9fa', minHeight: '100vh' }} className="hide-scrollbar">

      {/* ── Executive Welcome Banner (Bootstrap Header) ──────────────────────── */}
      <div style={{
        background: isDark
          ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
          : 'linear-gradient(135deg, #212529 0%, #0d6efd 100%)',
        padding: '24px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 16,
        boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)',
        borderBottom: `1px solid ${isDark ? 'var(--border-color)' : 'rgba(255,255,255,0.1)'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
            🧵
          </div>
          <div>
            <div style={{ fontSize: 23, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              {greeting()}, {user?.name?.split(' ')[0] ?? 'User'} 👋
            </div>
            <div style={{ fontSize: 13, color: '#ced4da', marginTop: 2 }}>
              {dateStr} · Factory Overview ({new Date().getFullYear()} YTD)
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: '#adb5bd', marginBottom: 6, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
            Quick Navigation
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {NAV_LINKS.map(q => (
              <button
                key={q.path}
                onClick={() => navigate(q.path)}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  borderRadius: 8,
                  padding: '5px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'background .15s, transform .1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'none'; }}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {error && (
          <div style={{ background: '#f8d7da', border: '1px solid #f5c2c7', borderRadius: 10, padding: '12px 18px', color: '#842029', fontSize: 13, fontWeight: 600 }}>
            ⚠️ Some data failed to load from server. Please verify database connection.
          </div>
        )}

        {/* ── Financial KPIs (6 Professional Bootstrap Cards) ────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 14 }}>💰</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: isDark ? 'var(--text-muted)' : '#6c757d', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Financial Performance
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12 }}>
            <StatCard
              icon="💵" label="Total Revenue" tag="REVENUE"
              gradient="linear-gradient(135deg, #146c43 0%, #198754 50%, #20c997 100%)"
              glow="rgba(25, 135, 84, 0.35)"
              value={loading ? '…' : fmtK(fin?.totalRevenue)}
              sub={`${fin?.salesCount ?? 0} sales orders YTD`}
              onClick={() => navigate('/sales')}
            />
            <StatCard
              icon="✅" label="Collected" tag="COLLECTED"
              gradient="linear-gradient(135deg, #59359a 0%, #6f42c1 50%, #8540f5 100%)"
              glow="rgba(111, 66, 193, 0.35)"
              value={loading ? '…' : fmtK(fin?.totalCollected)}
              sub="Cash received in bank"
              onClick={() => navigate('/accounts')}
            />
            <StatCard
              icon="⏳" label="Outstanding" tag="RECEIVABLE"
              gradient="linear-gradient(135deg, #b02a37 0%, #dc3545 50%, #ea868f 100%)"
              glow="rgba(220, 53, 69, 0.35)"
              value={loading ? '…' : fmtK(fin?.totalOutstanding)}
              sub={`${(fin?.pendingCount ?? 0) + (fin?.partialCount ?? 0)} unpaid orders`}
              onClick={() => navigate('/sales')}
            />
            <StatCard
              icon="📦" label="Purchases" tag="PROCUREMENT"
              gradient="linear-gradient(135deg, #c2410c 0%, #fd7e14 50%, #ffc107 100%)"
              glow="rgba(253, 126, 20, 0.35)"
              value={loading ? '…' : fmtK(fin?.totalPurchaseExpenses)}
              sub="Materials & fabrics"
              onClick={() => navigate('/purchasing')}
            />
            <StatCard
              icon="👷" label="Wages Paid" tag="PAYROLL"
              gradient="linear-gradient(135deg, #087990 0%, #0dcaf0 50%, #3dd5f3 100%)"
              glow="rgba(13, 202, 240, 0.35)"
              value={loading ? '…' : fmtK(fin?.totalWagesExpenses)}
              sub="Staff piece-rate wages"
              onClick={() => navigate('/wages')}
            />
            <StatCard
              icon="🏦" label="Account Balance" tag="LIQUIDITY"
              gradient="linear-gradient(135deg, #0a58ca 0%, #0d6efd 50%, #6ea8fe 100%)"
              glow="rgba(13, 110, 253, 0.35)"
              value={loading ? '…' : fmtK(fin?.totalAccountBalance)}
              sub="Combined bank accounts"
              onClick={() => navigate('/accounts')}
            />
          </div>
        </div>

        {/* ── Operations KPIs (4 Professional Bootstrap Cards) ───────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 14 }}>⚙️</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: isDark ? 'var(--text-muted)' : '#6c757d', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Operational Overview
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <StatCard
              icon="🌊" label="Net Cash Flow" tag="CASH FLOW"
              gradient={netPositive
                ? 'linear-gradient(135deg, #146c43 0%, #198754 50%, #20c997 100%)'
                : 'linear-gradient(135deg, #b02a37 0%, #dc3545 50%, #ea868f 100%)'}
              glow={netPositive ? 'rgba(25, 135, 84, 0.35)' : 'rgba(220, 53, 69, 0.35)'}
              value={loading ? '…' : fmtK(fin?.netCashFlow)}
              sub={netPositive ? 'Positive operating cashflow' : 'Negative operating cashflow'}
            />
            <StatCard
              icon="🔄" label="Active Lots" tag="PRODUCTION"
              gradient="linear-gradient(135deg, #2c3e50 0%, #0d6efd 50%, #6ea8fe 100%)"
              glow="rgba(13, 110, 253, 0.35)"
              value={loading ? '…' : activeLots}
              sub={`${deliveredLots} lots delivered YTD`}
              onClick={() => navigate('/lot-status')}
            />
            <StatCard
              icon="🧾" label="Paid Orders" tag="COMPLETED"
              gradient="linear-gradient(135deg, #0f5132 0%, #198754 50%, #25a266 100%)"
              glow="rgba(25, 135, 84, 0.35)"
              value={loading ? '…' : (fin?.paidCount ?? 0)}
              sub={`${fin?.partialCount ?? 0} partial payments`}
              onClick={() => navigate('/sales')}
            />
            <StatCard
              icon="🕐" label="Pending Orders" tag="OUTSTANDING"
              gradient="linear-gradient(135deg, #ab2e3c 0%, #d63384 50%, #e685b5 100%)"
              glow="rgba(214, 51, 132, 0.35)"
              value={loading ? '…' : (fin?.pendingCount ?? 0)}
              sub="Awaiting invoice clearance"
              onClick={() => navigate('/sales')}
            />
          </div>
        </div>

        {/* ── Lot Status Pipeline ────────────────────────────────────────────── */}
        {!loading && (
          <div style={{
            background: isDark ? 'var(--bg-card)' : '#ffffff',
            borderRadius: 14,
            padding: '16px 20px',
            border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
            boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📦</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? 'var(--text-main)' : '#212529', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Lot Status Pipeline
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#e7f1ff', color: '#0d6efd' }}>
                  {lots.length} Total
                </span>
              </div>
              <button
                onClick={() => navigate('/lot-status')}
                style={{
                  fontSize: 12, fontWeight: 700, color: '#0d6efd', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '4px 8px'
                }}
              >
                View All Lots →
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {lotBreakdownConfig.map(({ status, count, gradient, glow, icon }) => (
                <div
                  key={status}
                  onClick={() => navigate('/lot-status')}
                  style={{
                    background: gradient,
                    borderRadius: 12,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    color: '#ffffff',
                    boxShadow: `0 4px 12px ${glow}`,
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ fontSize: '1.2rem', marginBottom: 2 }}>{icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
                    {count}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>
                    {status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CHARTS ROW 1: Monthly Cash Flow + Payment Methods (Bootstrap Styled) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>

          {/* Monthly Cash Flow Card */}
          <div style={{
            background: isDark ? 'var(--bg-card)' : '#ffffff',
            borderRadius: 14,
            border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
            boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
            overflow: 'hidden',
          }}>
            <BtCardHeader
              icon="📈"
              title={`Monthly Cash Flow — ${new Date().getFullYear()}`}
              badgeText="YTD Trend"
              badgeColor="#0d6efd"
              isDark={isDark}
              action={
                <button
                  onClick={() => navigate('/reports')}
                  style={{
                    fontSize: 12, fontWeight: 700, color: '#0d6efd', background: '#e7f1ff',
                    border: '1px solid #cff4fc', borderRadius: 6, padding: '4px 10px', cursor: 'pointer'
                  }}
                >
                  Full Report →
                </button>
              }
            />
            <div style={{ padding: '16px 18px 12px' }}>
              {loading ? <Loader h={230} /> : monthly.length === 0 ? <Empty h={230} /> : (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={monthly} margin={{ top: 8, right: 10, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gColl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={BT_COLORS.success} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={BT_COLORS.success} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={BT_COLORS.danger} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={BT_COLORS.danger} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e9ecef'} />
                    <XAxis
                      dataKey="monthName"
                      tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#6c757d' }}
                      tickFormatter={v => v.replace(/(\w+)\s(\d{4})/, (_, m, y) => `${m} '${y.slice(2)}`)}
                    />
                    <YAxis tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#6c757d' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip content={<ChartTip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="collected"     name="Collected"  stroke={BT_COLORS.success} fill="url(#gColl)" strokeWidth={2.5} dot={false} />
                    <Area type="monotone" dataKey="totalExpenses" name="Expenses"   stroke={BT_COLORS.danger}  fill="url(#gExp)"  strokeWidth={2.5} dot={false} />
                    <Area type="monotone" dataKey="netCashFlow"   name="Net Flow"   stroke="#6366f1" fill="url(#gNet)" strokeWidth={2.5} dot={false} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Payment Distribution Card */}
          <div style={{
            background: isDark ? 'var(--bg-card)' : '#ffffff',
            borderRadius: 14,
            border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
            boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
            overflow: 'hidden',
          }}>
            <BtCardHeader
              icon="💳"
              title="Payment Distribution"
              badgeText="Methods"
              badgeColor="#0dcaf0"
              isDark={isDark}
            />
            <div style={{ padding: '16px 18px', minHeight: 230, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? (
                <Loader h={230} />
              ) : pmth.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: '#e7f1ff', color: '#0d6efd',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, margin: '0 auto 12px'
                  }}>
                    💳
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? 'var(--text-main)' : '#212529' }}>
                    No Payment Records Yet
                  </div>
                  <div style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d', maxWidth: 260, margin: '6px auto 14px', lineHeight: 1.4 }}>
                    Cash, Bank, and Cheque payment entries recorded in Sales will automatically visualize here.
                  </div>
                  <button
                    onClick={() => navigate('/sales')}
                    style={{
                      background: '#0d6efd', color: '#fff', border: 'none',
                      borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    + Record Sale Payment
                  </button>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={165}>
                    <PieChart>
                      <Pie data={pmth} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={72} innerRadius={36} paddingAngle={3}>
                        {pmth.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                      </Pie>
                      <Tooltip content={<PieTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {pmth.map((m, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_PALETTE[i % CHART_PALETTE.length], display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ color: isDark ? 'var(--text-main)' : '#212529', fontWeight: 600 }}>{m.method}</span>
                        </span>
                        <span style={{ color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 800 }}>{fmtK(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── CHARTS ROW 2: Top Customers + Recent Sales (Bootstrap Styled) ─────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>

          {/* Top Customers Card */}
          <div style={{
            background: isDark ? 'var(--bg-card)' : '#ffffff',
            borderRadius: 14,
            border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
            boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
            overflow: 'hidden',
          }}>
            <BtCardHeader
              icon="🤝"
              title="Top Customers by Volume"
              badgeText="Revenue"
              badgeColor="#198754"
              isDark={isDark}
              action={
                <button
                  onClick={() => navigate('/customers')}
                  style={{
                    fontSize: 12, fontWeight: 700, color: '#198754', background: '#d1e7dd',
                    border: '1px solid #badbcc', borderRadius: 6, padding: '4px 10px', cursor: 'pointer'
                  }}
                >
                  View Customers →
                </button>
              }
            />
            <div style={{ padding: '16px 18px' }}>
              {loading ? <Loader h={240} /> : cust.length === 0 ? <Empty h={240} label="No customer sales data" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={cust} layout="vertical" margin={{ top: 0, right: 25, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e9ecef'} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#6c757d' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <YAxis type="category" dataKey="customerName" tick={{ fontSize: 11, fill: isDark ? 'var(--text-main)' : '#212529', fontWeight: 600 }} width={105} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="totalRevenue" name="Revenue" radius={[0, 8, 8, 0]}>
                      {cust.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Sales Orders Card (Bootstrap Table) */}
          <div style={{
            background: isDark ? 'var(--bg-card)' : '#ffffff',
            borderRadius: 14,
            border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
            boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
            overflow: 'hidden',
          }}>
            <BtCardHeader
              icon="🧾"
              title="Recent Sales Orders"
              badgeText="Latest"
              badgeColor="#6f42c1"
              isDark={isDark}
              action={
                <button
                  onClick={() => navigate('/sales')}
                  style={{
                    fontSize: 12, fontWeight: 700, color: '#6f42c1', background: '#e0cffc',
                    border: '1px solid #c5b3e6', borderRadius: 6, padding: '4px 10px', cursor: 'pointer'
                  }}
                >
                  View All Sales →
                </button>
              }
            />
            <div style={{ padding: '0 4px' }}>
              {loading ? <Loader h={240} /> : sales.length === 0 ? <Empty h={240} label="No sales recorded" /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{
                        background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
                        borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`
                      }}>
                        <th style={s.th(isDark)}>Lot / Customer</th>
                        <th style={{ ...s.th(isDark), textAlign: 'right' }}>Amount</th>
                        <th style={{ ...s.th(isDark), textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((sale, i) => (
                        <tr
                          key={i}
                          style={{
                            borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
                            background: i % 2 === 0 ? (isDark ? 'var(--bg-card)' : '#ffffff') : (isDark ? 'rgba(255,255,255,0.015)' : '#fafbfc'),
                          }}
                        >
                          <td style={s.td(isDark)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                onClick={() => setSelectedLot({ id: sale.lotId, lotNumber: sale.lotNumber, sizeName: sale.sizeName })}
                                title="Click to see which staff worked on this lot"
                                style={{
                                  background: '#e7f1ff', color: '#0d6efd', fontWeight: 800,
                                  fontSize: 11, padding: '2px 7px', borderRadius: 6, cursor: 'pointer'
                                }}
                              >
                                {sale.lotNumber ?? 'Lot'}
                              </span>
                              <span style={{ fontWeight: 700, color: isDark ? '#ffffff' : '#212529' }}>
                                {sale.customerName ?? 'Customer'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 3 }}>
                              📅 {fmtDate(sale.saleDate)}
                            </div>
                          </td>
                          <td style={{ ...s.td(isDark), textAlign: 'right', fontWeight: 800, color: '#0d6efd', fontSize: 14 }}>
                            {fmtK(sale.netAmount)}
                          </td>
                          <td style={{ ...s.td(isDark), textAlign: 'center' }}>
                            <span style={{ ...s.badge, ...SALE_STATUS[sale.status] }}>
                              {sale.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RECENT PURCHASES (Bootstrap Table) ─────────────────────────────────── */}
        <div style={{
          background: isDark ? 'var(--bg-card)' : '#ffffff',
          borderRadius: 14,
          border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
          boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
          overflow: 'hidden',
        }}>
          <BtCardHeader
            icon="📋"
            title="Recent Purchases & Material Supplies"
            badgeText="Supplies"
            badgeColor="#fd7e14"
            isDark={isDark}
            action={
              <button
                onClick={() => navigate('/purchasing')}
                style={{
                  fontSize: 12, fontWeight: 700, color: '#fd7e14', background: '#ffe5d0',
                  border: '1px solid #fed1a6', borderRadius: 6, padding: '4px 10px', cursor: 'pointer'
                }}
              >
                View Purchases →
              </button>
            }
          />
          <div style={{ padding: '0 4px' }}>
            {loading ? <Loader h={120} /> : purch.length === 0 ? <Empty h={100} label="No purchases recorded" /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{
                      background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
                      borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`
                    }}>
                      <th style={s.th(isDark)}>Material</th>
                      <th style={s.th(isDark)}>Supplier</th>
                      <th style={{ ...s.th(isDark), textAlign: 'right' }}>Qty (Bags)</th>
                      <th style={{ ...s.th(isDark), textAlign: 'right' }}>Total Cost</th>
                      <th style={{ ...s.th(isDark), textAlign: 'center' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purch.map((p, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
                          background: i % 2 === 0 ? (isDark ? 'var(--bg-card)' : '#ffffff') : (isDark ? 'rgba(255,255,255,0.015)' : '#fafbfc'),
                        }}
                      >
                        <td style={{ ...s.td(isDark), fontWeight: 700, color: isDark ? '#ffffff' : '#212529' }}>
                          <span style={{ marginRight: 6 }}>📦</span>{p.material ?? '—'}
                        </td>
                        <td style={{ ...s.td(isDark), color: isDark ? 'var(--text-muted)' : '#495057', fontWeight: 600 }}>
                          {p.supplierName ?? '—'}
                        </td>
                        <td style={{ ...s.td(isDark), textAlign: 'right' }}>
                          <span style={{
                            background: '#f8f9fa', border: '1px solid #ced4da', borderRadius: 6,
                            padding: '2px 8px', fontWeight: 700, fontSize: 12
                          }}>
                            {p.quantity ?? 0}
                          </span>
                        </td>
                        <td style={{ ...s.td(isDark), textAlign: 'right', fontWeight: 800, color: '#fd7e14', fontSize: 14 }}>
                          {fmtK(p.totalAmount ?? (p.quantity * (p.unitPrice ?? 0)))}
                        </td>
                        <td style={{ ...s.td(isDark), textAlign: 'center', color: isDark ? 'var(--text-muted)' : '#6c757d' }}>
                          {fmtDate(p.purchaseDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {selectedLot && (
        <LotHistoryModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const Loader = ({ h }) => (
  <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d', fontSize: 13, fontWeight: 600 }}>
    Loading…
  </div>
);
const Empty = ({ h, label = 'No data available' }) => (
  <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d', fontSize: 13 }}>
    {label}
  </div>
);

// ─── Bootstrap Badge Styles ───────────────────────────────────────────────────
const SALE_STATUS = {
  Paid:    { background: '#d1e7dd', color: '#0f5132', border: '1px solid #badbcc' },
  Partial: { background: '#fff3cd', color: '#664d03', border: '1px solid #ffecb5' },
  Pending: { background: '#f8d7da', color: '#842029', border: '1px solid #f5c2c7' },
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  th: (isDark) => ({
    padding: '10px 14px',
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    fontWeight: 700,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }),
  td: (isDark) => ({
    padding: '12px 14px',
    color: isDark ? 'var(--text-main)' : '#212529',
    verticalAlign: 'middle',
  }),
  badge: {
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
    display: 'inline-block',
  },
};
