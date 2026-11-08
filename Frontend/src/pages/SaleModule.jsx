import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  getSales, createSale, updateSale, deleteSale,
  addSalePayment, deleteSalePayment, getActiveCustomers, getLots, getAccounts,
} from '../services/api';
import LotHistoryModal from '../components/LotHistoryModal';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Online'];
const STATUS_COLORS = {
  Pending: { bg: '#fff3cd', color: '#664d03', border: '#ffecb5', badge: '#ffc107' },
  Partial: { bg: '#ffe5d0', color: '#9a3412', border: '#fed1a6', badge: '#fd7e14' },
  Paid:    { bg: '#d1e7dd', color: '#0f5132', border: '#badbcc', badge: '#198754' },
};

const today    = () => new Date().toISOString().split('T')[0];
const fmtDate  = d  => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = n  => `Rs ${Number(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const emptySaleForm    = () => ({ lotId: '', customerId: '', saleDate: today(), totalPieces: '', ratePerPiece: '', discount: '0', notes: '' });
const emptyPaymentForm = () => ({ amount: '', paymentDate: today(), paymentMethod: 'Cash', referenceNo: '', notes: '', accountId: '' });

// ── Bootstrap 5 Palette ──
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
};

export default function SaleModule() {
  const { can } = useAuth();
  const { isDark, currentColor } = useTheme();

  const [sales,       setSales]       = useState([]);
  const [customers,   setCustomers]   = useState([]);
  const [lots,        setLots]        = useState([]);
  const [finAccounts, setFinAccounts] = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Filters
  const [statusFilter, setStatusFilter]   = useState('');
  const [custFilter,   setCustFilter]     = useState('');
  const [search,       setSearch]         = useState('');
  const [dateFrom,     setDateFrom]       = useState('');
  const [dateTo,       setDateTo]         = useState('');

  // Sale form modal
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [editingSale,  setEditingSale]  = useState(null);
  const [saleForm,     setSaleForm]     = useState(emptySaleForm());
  const [saleSaving,   setSaleSaving]   = useState(false);
  const [saleError,    setSaleError]    = useState('');

  // Payment modal (view + add)
  const [paymentSale,    setPaymentSale]    = useState(null);
  const [showPayModal,   setShowPayModal]   = useState(false);
  const [payForm,        setPayForm]        = useState(emptyPaymentForm());
  const [paySaving,      setPaySaving]      = useState(false);
  const [payError,       setPayError]       = useState('');
  const [showPayForm,    setShowPayForm]    = useState(false);

  // View
  const [view, setView] = useState('table');

  // Delete sale
  const [delSale,   setDelSale]   = useState(null);
  const [delSaving, setDelSaving] = useState(false);
  const [delError,  setDelError]  = useState('');
  const [selectedLot, setSelectedLot] = useState(null);

  const openDelSale = (sale) => {
    setDelSale(sale);
    setDelError('');
    setDelSaving(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (custFilter)   params.customerId = custFilter;
      if (dateFrom)     params.from       = new Date(dateFrom).toISOString();
      if (dateTo)       params.to         = new Date(dateTo + 'T23:59:59').toISOString();

      const [s, c, l] = await Promise.all([
        getSales(params), getActiveCustomers(), getLots(),
      ]);
      setSales(s); setCustomers(c); setLots(l);
      if (can('canViewAccounts')) {
        try { const fa = await getAccounts(); setFinAccounts(fa.filter(a => a.isActive)); } catch {}
      }
    } finally {
      setLoading(false);
    }
  }, [custFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const displayed = useMemo(() => {
    let result = sales;
    if (statusFilter === 'Outstanding') {
      result = result.filter(s => (s.balanceDue || 0) > 0);
    } else if (statusFilter) {
      result = result.filter(s => (s.status || '').toLowerCase() === statusFilter.toLowerCase());
    }
    if (!search) return result;
    const q = search.toLowerCase();
    return result.filter(s =>
      s.lotNumber?.toLowerCase().includes(q)    ||
      s.customerName?.toLowerCase().includes(q) ||
      s.notes?.toLowerCase().includes(q)
    );
  }, [sales, search, statusFilter]);

  // Executive summary metrics always reflect all orders in the current customer / date scope
  const summary = useMemo(() => ({
    totalSales:   sales.length,
    totalRevenue: sales.reduce((a, s) => a + (s.netAmount  || 0), 0),
    totalPaid:    sales.reduce((a, s) => a + (s.totalPaid  || 0), 0),
    totalBalance: sales.reduce((a, s) => a + (s.balanceDue || 0), 0),
    pendingCount: sales.filter(s => s.status === 'Pending').length,
    partialCount: sales.filter(s => s.status === 'Partial').length,
    paidCount:    sales.filter(s => s.status === 'Paid').length,
  }), [sales]);

  const hasFilters = statusFilter || custFilter || dateFrom || dateTo || search;

  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [statusFilter, custFilter, dateFrom, dateTo, search, pageSize]);
  const paginated = useMemo(() => displayed.slice((page-1)*pageSize, page*pageSize), [displayed, page, pageSize]);

  // ── Sale form ──────────────────────────────────────────────────────────────
  const openAddSale = () => {
    setEditingSale(null);
    setSaleForm(emptySaleForm());
    setSaleError('');
    setShowSaleForm(true);
  };

  const openEditSale = s => {
    setEditingSale(s);
    setSaleForm({
      lotId:        String(s.lotId),
      customerId:   String(s.customerId),
      saleDate:     s.saleDate ? s.saleDate.split('T')[0] : today(),
      totalPieces:  String(s.totalPieces),
      ratePerPiece: String(s.ratePerPiece),
      discount:     String(s.discount),
      notes:        s.notes || '',
    });
    setSaleError('');
    setShowSaleForm(true);
  };

  const totalAmount = useMemo(() => {
    const p = Number(saleForm.totalPieces) || 0;
    const r = Number(saleForm.ratePerPiece) || 0;
    return p * r;
  }, [saleForm.totalPieces, saleForm.ratePerPiece]);

  const netAmount = useMemo(() => {
    return totalAmount - (Number(saleForm.discount) || 0);
  }, [totalAmount, saleForm.discount]);

  const handleSaveSale = async () => {
    if (!saleForm.lotId)        { setSaleError('Please select a lot.'); return; }
    if (!saleForm.customerId)   { setSaleError('Please select a customer.'); return; }
    if (!saleForm.totalPieces)  { setSaleError('Total pieces is required.'); return; }
    if (!saleForm.ratePerPiece) { setSaleError('Rate per piece is required.'); return; }
    setSaleSaving(true); setSaleError('');
    try {
      const payload = {
        lotId:        Number(saleForm.lotId),
        customerId:   Number(saleForm.customerId),
        saleDate:     new Date(saleForm.saleDate).toISOString(),
        totalPieces:  Number(saleForm.totalPieces),
        ratePerPiece: Number(saleForm.ratePerPiece),
        discount:     Number(saleForm.discount) || 0,
        notes:        saleForm.notes || null,
      };
      if (editingSale) await updateSale(editingSale.id, payload);
      else             await createSale(payload);
      setShowSaleForm(false);
      await load();
    } catch (e) {
      const msg = typeof e.response?.data === 'string'
        ? e.response.data
        : (e.response?.data?.message || 'Failed to save.');
      setSaleError(msg);
    } finally {
      setSaleSaving(false);
    }
  };

  const handleDeleteSale = async (forceDeletePayments = false) => {
    if (!delSale) return;
    setDelSaving(true);
    setDelError('');
    try {
      if (forceDeletePayments && delSale.payments?.length > 0) {
        for (const p of delSale.payments) {
          await deleteSalePayment(p.id);
        }
      }
      await deleteSale(delSale.id);
      setDelSale(null);
      await load();
    } catch (e) {
      const msg = typeof e.response?.data === 'string'
        ? e.response.data
        : (e.response?.data?.message || 'Failed to delete sale.');
      setDelError(msg);
    } finally {
      setDelSaving(false);
    }
  };

  // ── Payment modal ──────────────────────────────────────────────────────────
  const openPayModal = s => {
    setPaymentSale(s);
    setPayForm(emptyPaymentForm());
    setPayError('');
    setShowPayForm(false);
    setShowPayModal(true);
  };

  const handleAddPayment = async () => {
    if (!payForm.amount) { setPayError('Amount is required.'); return; }
    setPaySaving(true); setPayError('');
    try {
      const payload = {
        amount:        Number(payForm.amount),
        paymentDate:   new Date(payForm.paymentDate).toISOString(),
        paymentMethod: payForm.paymentMethod,
        referenceNo:   payForm.referenceNo || null,
        notes:         payForm.notes || null,
        accountId:     payForm.accountId ? Number(payForm.accountId) : null,
      };
      const updated = await addSalePayment(paymentSale.id, payload);
      setPaymentSale(updated);
      setPayForm(emptyPaymentForm());
      setShowPayForm(false);
      await load();
    } catch (e) {
      const msg = typeof e.response?.data === 'string'
        ? e.response.data
        : (e.response?.data?.message || 'Failed to record payment.');
      setPayError(msg);
    } finally {
      setPaySaving(false);
    }
  };

  const handleDeletePayment = async (payId) => {
    try {
      const updated = await deleteSalePayment(payId);
      setPaymentSale(updated);
      await load();
    } catch (e) {
      const msg = typeof e.response?.data === 'string'
        ? e.response.data
        : (e.response?.data?.message || 'Failed to delete payment.');
      setPayError(msg);
    }
  };

  const balance = paymentSale ? paymentSale.netAmount - paymentSale.totalPaid : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">

      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>🧾</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>REVENUE MANAGEMENT</div>
            <h1 style={styles.headerTitle(isDark)}>Sales Orders &amp; Invoicing</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={styles.headerBadge}>
            Live Revenue Tracker
          </span>
          <span style={styles.headerSubBadge(isDark)}>
            {sales.length} Total Orders
          </span>
          <button onClick={openAddSale} style={styles.addBtn}>
            <span>+</span> New Sale Order
          </button>
        </div>
      </div>

      <div style={styles.content}>

        {/* ── 5 Executive KPI Cards with Bootstrap Colors ── */}
        <div style={styles.kpiGrid}>
          <BtKpiCard
            label="Total Sales"
            tag="DISPATCH ORDERS"
            value={summary.totalSales}
            gradient="linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)"
            glow="rgba(13, 110, 253, 0.35)"
            icon="📦"
            sub={`${summary.paidCount} Fully Paid · ${summary.partialCount} Partial`}
            onClick={() => setStatusFilter('')}
            active={statusFilter === ''}
          />
          <BtKpiCard
            label="Net Revenue"
            tag="GROSS BILLING"
            value={fmtMoney(summary.totalRevenue)}
            gradient="linear-gradient(135deg, #146c43 0%, #198754 100%)"
            glow="rgba(25, 135, 84, 0.35)"
            icon="💵"
            sub="After applied order discounts"
            onClick={() => setStatusFilter('')}
            active={false}
          />
          <BtKpiCard
            label="Collected"
            tag="PAYMENTS RECEIVED"
            value={fmtMoney(summary.totalPaid)}
            gradient="linear-gradient(135deg, #59359a 0%, #6f42c1 100%)"
            glow="rgba(111, 66, 193, 0.35)"
            icon="✅"
            sub="Cash & bank account deposits"
            onClick={() => setStatusFilter(prev => prev === 'Paid' ? '' : 'Paid')}
            active={statusFilter === 'Paid'}
          />
          <BtKpiCard
            label="Outstanding"
            tag="PENDING RECEIVABLES"
            value={fmtMoney(summary.totalBalance)}
            gradient="linear-gradient(135deg, #b02a37 0%, #dc3545 100%)"
            glow="rgba(220, 53, 69, 0.35)"
            icon="⏳"
            sub={`${summary.pendingCount + summary.partialCount} orders with balance`}
            onClick={() => setStatusFilter(prev => prev === 'Outstanding' ? '' : 'Outstanding')}
            active={statusFilter === 'Outstanding'}
          />
          <BtKpiCard
            label="Pending Invoices"
            tag="AWAITING PAYMENT"
            value={summary.pendingCount}
            gradient="linear-gradient(135deg, #c2410c 0%, #fd7e14 100%)"
            glow="rgba(253, 126, 20, 0.35)"
            icon="⚠️"
            sub="Zero payment received yet"
            onClick={() => setStatusFilter(prev => prev === 'Pending' ? '' : 'Pending')}
            active={statusFilter === 'Pending'}
          />
        </div>

        {/* ── Filter & Search Toolbar (Bootstrap 5 Style) ── */}
        <div style={styles.filterToolbar(isDark)}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
            {/* Search */}
            <div style={{ position: 'relative', minWidth: 200, flex: '1 1 200px' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 13 }}>🔍</span>
              <input
                style={{ ...styles.input(isDark), paddingLeft: 34 }}
                placeholder="Search lot, customer, notes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Customer Dropdown */}
            <select
              style={{ ...styles.select(isDark), minWidth: 170 }}
              value={custFilter}
              onChange={e => setCustFilter(e.target.value)}
            >
              <option value="">All Customers ({customers.length})</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Dates */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d', fontWeight: 600 }}>From:</span>
              <input
                style={{ ...styles.input(isDark), width: 135 }}
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d', fontWeight: 600 }}>To:</span>
              <input
                style={{ ...styles.input(isDark), width: 135 }}
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Status Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              ['', 'All Orders', sales.length],
              ['Pending', 'Pending', summary.pendingCount],
              ['Partial', 'Partial', summary.partialCount],
              ['Paid', 'Paid', summary.paidCount],
              ['Outstanding', 'Unpaid Only', summary.pendingCount + summary.partialCount],
            ].map(([k, l, count]) => {
              const active = statusFilter === k;
              return (
                <button
                  key={k}
                  onClick={() => setStatusFilter(prev => (prev === k && k !== '' ? '' : k))}
                  style={styles.statusPill(active, k, isDark)}
                >
                  <span>{l}</span>
                  <span style={{
                    marginLeft: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: active ? 'rgba(255,255,255,0.28)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'),
                    color: active ? '#ffffff' : (isDark ? '#e2e8f0' : '#495057'),
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}

            {hasFilters && (
              <button
                onClick={() => { setStatusFilter(''); setCustFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); }}
                style={styles.clearBtn}
                title="Reset all filters"
              >
                ✕ Clear
              </button>
            )}

            {/* View Switcher */}
            <div style={styles.viewToggle(isDark)}>
              <button
                onClick={() => setView('table')}
                style={styles.viewBtn(view === 'table', isDark)}
                title="Table View"
              >
                ☰
              </button>
              <button
                onClick={() => setView('cards')}
                style={styles.viewBtn(view === 'cards', isDark)}
                title="Card View"
              >
                ⊞
              </button>
            </div>
          </div>
        </div>

        {/* ── Table / Cards Container ── */}
        {loading ? (
          <div style={styles.loadingBox(isDark)}>
            <div style={styles.spinner} />
            <div style={{ marginTop: 14, fontWeight: 600 }}>Loading sales orders…</div>
          </div>
        ) : view === 'table' ? (
          <div style={styles.cardBox(isDark)}>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Date', 'Lot Number', 'Size', 'Customer', 'Pieces', 'Rate', 'Total', 'Discount', 'Net Amount', 'Paid', 'Balance Due', 'Status', 'Actions'].map(h => (
                      <th key={h} style={styles.th(isDark, ['Pieces', 'Rate', 'Total', 'Discount', 'Net Amount', 'Paid', 'Balance Due'].includes(h))}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={13} style={styles.empty(isDark)}>
                        <div style={{ padding: '28px 0', textAlign: 'center' }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>
                            {statusFilter === 'Paid' ? '💳' : '🔍'}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#ffffff' : '#212529' }}>
                            {statusFilter === 'Paid'
                              ? 'No fully paid sales orders yet'
                              : 'No sales orders match your selected filters'}
                          </div>
                          <div style={{ fontSize: 13, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 4 }}>
                            {statusFilter === 'Paid'
                              ? 'All current orders are Pending or Partial. Record a payment to see orders here.'
                              : 'Try adjusting your search query or reset active filters.'}
                          </div>
                          {hasFilters && (
                            <button
                              onClick={() => { setStatusFilter(''); setCustFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); }}
                              style={{
                                marginTop: 14,
                                padding: '6px 16px',
                                fontSize: 12,
                                fontWeight: 700,
                                borderRadius: 8,
                                border: 'none',
                                background: '#0d6efd',
                                color: '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              Show All Orders ({sales.length})
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginated.map((sale, i) => {
                      const st = STATUS_COLORS[sale.status] || STATUS_COLORS.Pending;
                      return (
                        <tr key={sale.id} style={styles.tr(isDark, i % 2 === 0)}>
                          <td style={styles.td(isDark)}>{fmtDate(sale.saleDate)}</td>
                          <td style={styles.td(isDark)}>
                            <span
                              style={{ ...styles.lotBadge, cursor: 'pointer' }}
                              onClick={() => setSelectedLot({ id: sale.lotId, lotNumber: sale.lotNumber, sizeName: sale.sizeName })}
                              title="Click to see which staff worked on this lot"
                            >
                              {sale.lotNumber}
                            </span>
                          </td>
                          <td style={styles.td(isDark)}>
                            <span style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d' }}>{sale.sizeName || '—'}</span>
                          </td>
                          <td style={styles.td(isDark)}>
                            <strong style={{ color: isDark ? '#ffffff' : '#212529' }}>{sale.customerName}</strong>
                          </td>
                          <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 600 }}>
                            {sale.totalPieces.toLocaleString()}
                          </td>
                          <td style={{ ...styles.td(isDark), textAlign: 'right' }}>
                            {fmtMoney(sale.ratePerPiece)}
                          </td>
                          <td style={{ ...styles.td(isDark), textAlign: 'right' }}>
                            {fmtMoney(sale.totalAmount)}
                          </td>
                          <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.danger, fontWeight: sale.discount > 0 ? 700 : 400 }}>
                            {sale.discount > 0 ? `-${fmtMoney(sale.discount)}` : '—'}
                          </td>
                          <td style={{ ...styles.td(isDark), textAlign: 'right', fontWeight: 800, color: isDark ? '#fff' : BT.primary, fontSize: 14 }}>
                            {fmtMoney(sale.netAmount)}
                          </td>
                          <td style={{ ...styles.td(isDark), textAlign: 'right', color: BT.success, fontWeight: 700 }}>
                            {fmtMoney(sale.totalPaid)}
                          </td>
                          <td style={{ ...styles.td(isDark), textAlign: 'right', color: sale.balanceDue > 0 ? BT.danger : '#6c757d', fontWeight: sale.balanceDue > 0 ? 800 : 500 }}>
                            {fmtMoney(sale.balanceDue)}
                          </td>
                          <td style={styles.td(isDark)}>
                            <span style={styles.statusBadge(sale.status)}>
                              {sale.status}
                            </span>
                          </td>
                          <td style={styles.td(isDark)}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                              <button onClick={() => openPayModal(sale)} style={styles.btnPaySm}>💳 Pay</button>
                              <button onClick={() => openEditSale(sale)} style={styles.btnEditSm}>✏️ Edit</button>
                              <button onClick={() => openDelSale(sale)}  style={styles.btnDelSm}>🗑️ Del</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <SalePagination
              page={page}
              pageSize={pageSize}
              total={displayed.length}
              onPage={setPage}
              onPageSize={setPageSize}
              isDark={isDark}
            />
          </div>
        ) : (
          /* ── Card View ── */
          <div>
            {displayed.length === 0 ? (
              <div style={styles.emptyCardBox(isDark)}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>
                  {statusFilter === 'Paid' ? '💳' : '🔍'}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#ffffff' : '#212529' }}>
                  {statusFilter === 'Paid'
                    ? 'No fully paid sales orders yet'
                    : 'No sales orders match your selected filters'}
                </div>
                <div style={{ fontSize: 13, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 4 }}>
                  {statusFilter === 'Paid'
                    ? 'All current orders are Pending or Partial. Record a payment to see orders here.'
                    : 'Try adjusting your search query or reset active filters.'}
                </div>
                {hasFilters && (
                  <button
                    onClick={() => { setStatusFilter(''); setCustFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); }}
                    style={{
                      marginTop: 14,
                      padding: '6px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: 'none',
                      background: '#0d6efd',
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    Show All Orders ({sales.length})
                  </button>
                )}
              </div>
            ) : (
              <>
                <div style={styles.cardGrid}>
                  {paginated.map(sale => {
                    const sc = STATUS_COLORS[sale.status] || STATUS_COLORS.Pending;
                    const pctPaid = sale.netAmount > 0 ? Math.min(100, (sale.totalPaid / sale.netAmount) * 100) : 0;
                    return (
                      <div key={sale.id} style={styles.orderCard(isDark)}>
                        <div style={styles.orderCardHead}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{ ...styles.lotBadge, cursor: 'pointer' }}
                                onClick={() => setSelectedLot({ id: sale.lotId, lotNumber: sale.lotNumber, sizeName: sale.sizeName })}
                                title="Click to see which staff worked on this lot"
                              >
                                {sale.lotNumber}
                              </span>
                              {sale.sizeName && <span style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d' }}>({sale.sizeName})</span>}
                            </div>
                            <div style={styles.orderCustomer(isDark)}>🤝 {sale.customerName}</div>
                          </div>
                          <span style={styles.statusBadge(sale.status)}>
                            {sale.status}
                          </span>
                        </div>

                        <div style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 4 }}>
                          📅 {fmtDate(sale.saleDate)} · {sale.totalPieces.toLocaleString()} pcs @ {fmtMoney(sale.ratePerPiece)}
                        </div>

                        {/* Amounts Grid */}
                        <div style={styles.orderAmountsBox(isDark)}>
                          <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={styles.amtLabel(isDark)}>Net Total</div>
                            <div style={{ ...styles.amtVal(isDark), color: BT.primary }}>{fmtMoney(sale.netAmount)}</div>
                          </div>
                          <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={styles.amtLabel(isDark)}>Paid</div>
                            <div style={{ ...styles.amtVal(isDark), color: BT.success }}>{fmtMoney(sale.totalPaid)}</div>
                          </div>
                          <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={styles.amtLabel(isDark)}>Balance</div>
                            <div style={{ ...styles.amtVal(isDark), color: sale.balanceDue > 0 ? BT.danger : '#6c757d' }}>{fmtMoney(sale.balanceDue)}</div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={styles.progressBarBg(isDark)}>
                          <div style={{ ...styles.progressBarFill, width: `${pctPaid}%`, background: sc.badge }} />
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          <button onClick={() => openPayModal(sale)} style={{ ...styles.btnPaySm, flex: 1, padding: '7px' }}>
                            💳 Pay ({Math.round(pctPaid)}%)
                          </button>
                          <button onClick={() => openEditSale(sale)} style={{ ...styles.btnEditSm, padding: '7px 12px' }}>
                            Edit
                          </button>
                          <button onClick={() => openDelSale(sale)}  style={{ ...styles.btnDelSm, padding: '7px 12px' }}>
                            Del
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 16 }}>
                  <SalePagination
                    page={page}
                    pageSize={pageSize}
                    total={displayed.length}
                    onPage={setPage}
                    onPageSize={setPageSize}
                    isDark={isDark}
                  />
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* ── Sale Form Modal (Bootstrap Styled) ── */}
      {showSaleForm && (
        <div style={styles.overlay} onClick={() => setShowSaleForm(false)}>
          <div style={styles.modal(isDark)} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>
                {editingSale ? '✏️ Edit Sales Order' : '🧾 New Sales Order'}
              </span>
              <button onClick={() => setShowSaleForm(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={styles.formGrid}>
                <div>
                  <label style={styles.label(isDark)}>Production Lot *</label>
                  <select
                    style={styles.select(isDark)}
                    value={saleForm.lotId}
                    onChange={e => setSaleForm(f => ({ ...f, lotId: e.target.value }))}
                  >
                    <option value="">— Select Lot —</option>
                    {lots.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.lotNumber}{l.sizeName ? ` (${l.sizeName})` : ''}{l.material ? ` — ${l.material}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label(isDark)}>Customer *</label>
                  <select
                    style={styles.select(isDark)}
                    value={saleForm.customerId}
                    onChange={e => setSaleForm(f => ({ ...f, customerId: e.target.value }))}
                  >
                    <option value="">— Select Customer —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
                  </select>
                </div>

                <div>
                  <label style={styles.label(isDark)}>Sale Date *</label>
                  <input
                    style={styles.input(isDark)}
                    type="date"
                    value={saleForm.saleDate}
                    onChange={e => setSaleForm(f => ({ ...f, saleDate: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={styles.label(isDark)}>Total Pieces *</label>
                  <input
                    style={styles.input(isDark)}
                    type="number"
                    min="1"
                    placeholder="e.g. 1000"
                    value={saleForm.totalPieces}
                    onChange={e => setSaleForm(f => ({ ...f, totalPieces: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={styles.label(isDark)}>Rate / Piece (PKR) *</label>
                  <input
                    style={styles.input(isDark)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 250"
                    value={saleForm.ratePerPiece}
                    onChange={e => setSaleForm(f => ({ ...f, ratePerPiece: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={styles.label(isDark)}>Discount (PKR)</label>
                  <input
                    style={styles.input(isDark)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={saleForm.discount}
                    onChange={e => setSaleForm(f => ({ ...f, discount: e.target.value }))}
                  />
                </div>
              </div>

              {/* Calculated totals preview */}
              <div style={styles.calcPreviewBox(isDark)}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={styles.calcLabel(isDark)}>Gross Amount</div>
                  <div style={styles.calcVal(isDark)}>{fmtMoney(totalAmount)}</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={styles.calcLabel(isDark)}>Discount</div>
                  <div style={{ ...styles.calcVal(isDark), color: BT.danger }}>- {fmtMoney(Number(saleForm.discount) || 0)}</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, background: isDark ? 'rgba(13,110,253,0.15)' : '#e7f1ff', borderRadius: 8, padding: '8px' }}>
                  <div style={{ ...styles.calcLabel(isDark), color: BT.primary, fontWeight: 700 }}>Net Payable</div>
                  <div style={{ ...styles.calcVal(isDark), color: BT.primary, fontSize: 16 }}>{fmtMoney(netAmount)}</div>
                </div>
              </div>

              <div>
                <label style={styles.label(isDark)}>Remarks / Notes</label>
                <textarea
                  style={{ ...styles.input(isDark), minHeight: 65, resize: 'vertical' }}
                  value={saleForm.notes}
                  onChange={e => setSaleForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Payment terms, delivery details, vehicle number…"
                />
              </div>

              {saleError && <div style={styles.errorAlert}>⚠️ {saleError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button onClick={() => setShowSaleForm(false)} style={styles.btnSecondary}>
                  Cancel
                </button>
                <button onClick={handleSaveSale} style={styles.btnPrimary} disabled={saleSaving}>
                  {saleSaving ? 'Saving…' : editingSale ? 'Update Order' : 'Create Sales Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal (Bootstrap Styled) ── */}
      {showPayModal && paymentSale && (
        <div style={styles.overlay} onClick={() => setShowPayModal(false)}>
          <div style={{ ...styles.modal(isDark), maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  💳 Payment Management
                </div>
                <div style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 2 }}>
                  Customer: <strong>{paymentSale.customerName}</strong> · Lot: <strong>{paymentSale.lotNumber}</strong>
                </div>
              </div>
              <span style={styles.statusBadge(paymentSale.status)}>
                {paymentSale.status}
              </span>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Totals Summary */}
              <div style={styles.calcPreviewBox(isDark)}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={styles.calcLabel(isDark)}>Net Order Amount</div>
                  <div style={styles.calcVal(isDark)}>{fmtMoney(paymentSale.netAmount)}</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={styles.calcLabel(isDark)}>Total Collected</div>
                  <div style={{ ...styles.calcVal(isDark), color: BT.success }}>{fmtMoney(paymentSale.totalPaid)}</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={styles.calcLabel(isDark)}>Balance Due</div>
                  <div style={{ ...styles.calcVal(isDark), color: paymentSale.balanceDue > 0 ? BT.danger : BT.success }}>
                    {fmtMoney(paymentSale.balanceDue)}
                  </div>
                </div>
              </div>

              {/* Payment History List */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? 'var(--text-muted)' : '#6c757d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  Recorded Payments ({paymentSale.payments?.length || 0})
                </div>

                {paymentSale.payments?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {paymentSale.payments.map(p => (
                      <div key={p.id} style={styles.payRow(isDark)}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: BT.success }}>
                            {fmtMoney(p.amount)}
                          </div>
                          <div style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 2 }}>
                            📅 {fmtDate(p.paymentDate)} · <strong>{p.paymentMethod}</strong>
                            {p.referenceNo && ` · Ref: ${p.referenceNo}`}
                          </div>
                          {p.notes && <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#888', fontStyle: 'italic', marginTop: 1 }}>{p.notes}</div>}
                        </div>
                        <button onClick={() => handleDeletePayment(p.id)} style={styles.btnDelSm}>
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: isDark ? 'var(--text-muted)' : '#888', fontSize: 13 }}>
                    No payments have been received for this order yet.
                  </div>
                )}
              </div>

              {/* Add Payment Form */}
              {paymentSale.balanceDue > 0 && (
                <>
                  {!showPayForm ? (
                    <button onClick={() => setShowPayForm(true)} style={styles.btnSuccessWide}>
                      + Record New Payment
                    </button>
                  ) : (
                    <div style={styles.addPayBox(isDark)}>
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: isDark ? '#ffffff' : '#212529' }}>
                        Record Payment Transaction
                      </div>
                      <div style={styles.formGrid}>
                        <div>
                          <label style={styles.label(isDark)}>Amount * (max {fmtMoney(balance)})</label>
                          <input
                            style={styles.input(isDark)}
                            type="number"
                            min="1"
                            max={balance}
                            placeholder={`Up to ${balance}`}
                            value={payForm.amount}
                            onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={styles.label(isDark)}>Payment Date *</label>
                          <input
                            style={styles.input(isDark)}
                            type="date"
                            value={payForm.paymentDate}
                            onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label style={styles.label(isDark)}>Payment Method</label>
                          <select
                            style={styles.select(isDark)}
                            value={payForm.paymentMethod}
                            onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
                          >
                            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={styles.label(isDark)}>Reference / Cheque No.</label>
                          <input
                            style={styles.input(isDark)}
                            type="text"
                            placeholder="e.g. TRX-90412"
                            value={payForm.referenceNo}
                            onChange={e => setPayForm(f => ({ ...f, referenceNo: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={styles.label(isDark)}>Notes</label>
                        <input
                          style={styles.input(isDark)}
                          type="text"
                          placeholder="Optional deposit remark…"
                          value={payForm.notes}
                          onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                        />
                      </div>

                      {/* Finance account sync */}
                      <div style={styles.financeSyncBox(isDark)}>
                        <label style={{ ...styles.label(isDark), color: BT.primary, fontWeight: 700 }}>
                          📊 Financial Ledger Deposit Account
                        </label>
                        <select
                          style={{ ...styles.select(isDark), marginTop: 4 }}
                          value={payForm.accountId}
                          onChange={e => setPayForm(f => ({ ...f, accountId: e.target.value }))}
                        >
                          <option value="">— Don't record in Finance —</option>
                          {finAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.categoryName})</option>
                          ))}
                        </select>
                        {payForm.accountId && (
                          <div style={{ fontSize: 11, color: BT.primary, marginTop: 4, fontWeight: 600 }}>
                            ✓ A Credit transaction will be created in Finance under this account
                          </div>
                        )}
                      </div>

                      {payError && <div style={styles.errorAlert}>⚠️ {payError}</div>}

                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                        <button onClick={() => setShowPayForm(false)} style={styles.btnSecondary}>
                          Cancel
                        </button>
                        <button onClick={handleAddPayment} style={styles.btnSuccess} disabled={paySaving}>
                          {paySaving ? 'Saving…' : '✓ Confirm & Save Payment'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setShowPayModal(false)} style={styles.btnSecondary}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Sale Confirmation Modal ── */}
      {delSale && (
        <div style={styles.overlay} onClick={() => !delSaving && setDelSale(null)}>
          <div style={{ ...styles.modal(isDark), maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader(isDark)}>
              <span style={{ fontSize: 16, fontWeight: 800, color: BT.danger }}>
                ⚠️ Delete Sales Order?
              </span>
              <button onClick={() => setDelSale(null)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ color: isDark ? 'var(--text-main)' : '#212529', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                Are you sure you want to delete the sale order for lot <strong>{delSale.lotNumber}</strong> to{' '}
                <strong>{delSale.customerName}</strong> ({fmtMoney(delSale.netAmount)})?
              </p>

              {delSale.payments?.length > 0 && (
                <div style={styles.warningBox}>
                  <div style={{ fontWeight: 800, marginBottom: 2 }}>⚠️ Recorded Payments Warning</div>
                  This sale has <strong>{delSale.payments.length}</strong> payment(s) totaling <strong>{fmtMoney(delSale.totalPaid)}</strong>.
                  Deleting this sale will also remove all its recorded payment history.
                </div>
              )}

              {delError && <div style={styles.errorAlert}>⚠️ {delError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                <button onClick={() => setDelSale(null)} style={styles.btnSecondary} disabled={delSaving}>
                  Cancel
                </button>
                {delSale.payments?.length > 0 ? (
                  <>
                    <button
                      onClick={() => {
                        const sToPay = delSale;
                        setDelSale(null);
                        openPayModal(sToPay);
                      }}
                      style={styles.btnPaySm}
                      disabled={delSaving}>
                      💳 View Payments
                    </button>
                    <button
                      onClick={() => handleDeleteSale(true)}
                      style={styles.btnDanger}
                      disabled={delSaving}>
                      {delSaving ? 'Deleting…' : 'Delete Sale & Payments'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDeleteSale(false)}
                    style={styles.btnDanger}
                    disabled={delSaving}>
                    {delSaving ? 'Deleting…' : 'Delete Sale Order'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedLot && (
        <LotHistoryModal
          lot={selectedLot}
          onClose={() => setSelectedLot(null)}
        />
      )}

    </div>
  );
}

// ── Reusable KPI Card (Bootstrap 5 Style) ──
function BtKpiCard({ label, tag, value, gradient, glow, icon, sub, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: gradient,
        borderRadius: 14,
        padding: '16px 18px',
        color: '#ffffff',
        boxShadow: active ? `0 0 0 3px #ffffff, 0 12px 28px ${glow}` : `0 8px 24px ${glow}`,
        cursor: onClick ? 'pointer' : 'default',
        transform: active ? 'scale(1.02)' : 'none',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 110,
        position: 'relative',
        overflow: 'hidden',
        outline: active ? '2px solid rgba(255,255,255,0.85)' : 'none',
      }}
      onMouseEnter={e => { if (onClick && !active) e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { if (onClick && !active) e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: 'rgba(255, 255, 255, 0.22)',
          padding: '2px 8px',
          borderRadius: 6,
          backdropFilter: 'blur(4px)',
        }}>
          {tag}
        </span>
        <span style={{ fontSize: 20, opacity: 0.9 }}>{icon}</span>
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
          {value}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.92)', marginTop: 2 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.75)', marginTop: 3 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pagination Component ──
function SalePagination({ page, pageSize, total, onPage, onPageSize, isDark }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    const set = new Set([1, totalPages, page-1, page, page+1].filter(p => p >= 1 && p <= totalPages));
    const sorted = [...set].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i-1] > 1) pages.push('…');
      pages.push(sorted[i]);
    }
  }
  const from = total === 0 ? 0 : (page-1)*pageSize + 1;
  const to   = Math.min(page*pageSize, total);

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 18px', borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
      background: isDark ? 'var(--bg-subtle)' : '#f8f9fa', flexWrap: 'wrap', gap: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d' }}>
        <span style={{ fontWeight: 600 }}>Rows:</span>
        <select
          value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          style={{
            border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
            borderRadius: 6, padding: '4px 8px', fontSize: 12,
            background: isDark ? 'var(--bg-card)' : '#fff', color: isDark ? 'var(--text-main)' : '#212529',
            cursor: 'pointer', outline: 'none'
          }}
        >
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>Showing <strong style={{ color: isDark ? '#fff' : '#212529' }}>{from}–{to}</strong> of <strong style={{ color: isDark ? '#fff' : '#212529' }}>{total}</strong></span>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          onClick={() => onPage(page-1)}
          disabled={page <= 1}
          style={styles.pageBtn(false, page <= 1, isDark)}
        >
          ‹ Prev
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} style={{ padding: '4px 6px', color: '#9ca3af', fontSize: 12 }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              style={styles.pageBtn(p === page, false, isDark)}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page+1)}
          disabled={page >= totalPages}
          style={styles.pageBtn(false, page >= totalPages, isDark)}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

// ── Bootstrap 5 Design Styles ──
const styles = {
  page: (isDark) => ({
    background: isDark ? 'var(--bg-page)' : '#f8f9fa',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  }),

  header: (isDark) => ({
    background: isDark
      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      : 'linear-gradient(135deg, #212529 0%, #0d6efd 100%)',
    padding: '24px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)',
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : 'rgba(255,255,255,0.1)'}`,
  }),

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },

  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.16)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    color: '#fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },

  headerBreadcrumb: {
    fontSize: 11,
    color: '#ced4da',
    letterSpacing: '0.08em',
    fontWeight: 700,
    textTransform: 'uppercase',
  },

  headerTitle: (isDark) => ({
    fontSize: 23,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.02em',
    margin: 0,
  }),

  headerBadge: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.25)',
    color: '#ffffff',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 700,
  },

  headerSubBadge: (isDark) => ({
    background: 'rgba(255,255,255,0.1)',
    color: '#e2e8f0',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
  }),

  addBtn: {
    background: '#198754',
    color: '#ffffff',
    border: '1px solid #146c43',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 2px 6px rgba(25, 135, 84, 0.35)',
    transition: 'all .15s',
  },

  content: {
    padding: '20px 24px 36px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14,
  },

  filterToolbar: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 12,
    padding: '12px 18px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  }),

  input: (isDark) => ({
    background: isDark ? 'var(--bg-subtle)' : '#ffffff',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 13,
    color: isDark ? 'var(--text-main)' : '#212529',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }),

  select: (isDark) => ({
    background: isDark ? 'var(--bg-subtle)' : '#ffffff',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 13,
    color: isDark ? 'var(--text-main)' : '#212529',
    outline: 'none',
    cursor: 'pointer',
  }),

  statusPill: (active, key, isDark) => {
    let activeBg = BT.primary;
    if (key === 'Paid') activeBg = BT.success;
    if (key === 'Partial') activeBg = BT.orange;
    if (key === 'Pending') activeBg = '#e0a800';
    if (key === 'Outstanding') activeBg = BT.danger;

    return {
      padding: '6px 14px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      border: active ? `1px solid ${activeBg}` : `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
      background: active ? activeBg : isDark ? 'var(--bg-subtle)' : '#f8f9fa',
      color: active ? '#ffffff' : isDark ? 'var(--text-muted)' : '#495057',
      transition: 'all 0.15s ease',
    };
  },

  clearBtn: {
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  viewToggle: (isDark) => ({
    display: 'flex',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
    borderRadius: 8,
    overflow: 'hidden',
  }),

  viewBtn: (active, isDark) => ({
    border: 'none',
    background: active ? BT.primary : isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    color: active ? '#ffffff' : isDark ? 'var(--text-muted)' : '#6c757d',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  }),

  cardBox: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    overflow: 'hidden',
  }),

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },

  th: (isDark, alignRight = false) => ({
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    padding: '12px 14px',
    textAlign: alignRight ? 'right' : 'left',
    fontSize: 11,
    fontWeight: 800,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderBottom: `2px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    whiteSpace: 'nowrap',
  }),

  tr: (isDark, isEven) => ({
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
    background: isEven ? (isDark ? 'var(--bg-card)' : '#ffffff') : (isDark ? 'rgba(255,255,255,0.015)' : '#fafbfc'),
    transition: 'background 0.1s ease',
  }),

  td: (isDark) => ({
    padding: '11px 14px',
    color: isDark ? 'var(--text-main)' : '#212529',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  }),

  lotBadge: {
    background: '#e7f1ff',
    color: '#0d6efd',
    borderRadius: 6,
    padding: '2px 8px',
    fontWeight: 800,
    fontSize: 12,
    display: 'inline-block',
  },

  statusBadge: (status) => {
    const s = STATUS_COLORS[status] || STATUS_COLORS.Pending;
    return {
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 800,
      borderRadius: 20,
      padding: '3px 10px',
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      textTransform: 'capitalize',
    };
  },

  btnPaySm: {
    background: '#d1e7dd',
    color: '#0f5132',
    border: '1px solid #badbcc',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all .1s',
  },

  btnEditSm: {
    background: '#cfe2ff',
    color: '#084298',
    border: '1px solid #b6d4fe',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all .1s',
  },

  btnDelSm: {
    background: '#f8d7da',
    color: '#842029',
    border: '1px solid #f5c2c7',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all .1s',
  },

  pageBtn: (active, disabled, isDark) => ({
    padding: '5px 10px',
    borderRadius: 6,
    border: `1px solid ${active ? BT.primary : isDark ? 'var(--border-color)' : '#dee2e6'}`,
    background: active ? BT.primary : isDark ? 'var(--bg-card)' : '#ffffff',
    color: active ? '#ffffff' : disabled ? '#adb5bd' : isDark ? 'var(--text-main)' : '#212529',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    minWidth: 32,
  }),

  empty: (isDark) => ({
    textAlign: 'center',
    padding: '40px 16px',
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    fontSize: 14,
  }),

  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: 16,
  },

  orderCard: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    padding: '16px 18px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  }),

  orderCardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  orderCustomer: (isDark) => ({
    fontSize: 14,
    fontWeight: 800,
    color: isDark ? '#ffffff' : '#212529',
    marginTop: 4,
  }),

  orderAmountsBox: (isDark) => ({
    display: 'flex',
    justifyContent: 'space-between',
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    borderRadius: 10,
    padding: '10px 12px',
    marginTop: 4,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e9ecef'}`,
  }),

  amtLabel: (isDark) => ({
    fontSize: 10,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    fontWeight: 700,
    textTransform: 'uppercase',
  }),

  amtVal: (isDark) => ({
    fontWeight: 800,
    fontSize: 13,
    marginTop: 2,
  }),

  progressBarBg: (isDark) => ({
    background: isDark ? '#334155' : '#e9ecef',
    borderRadius: 10,
    height: 6,
    overflow: 'hidden',
    marginTop: 2,
  }),

  progressBarFill: {
    height: '100%',
    borderRadius: 10,
    transition: 'width 0.3s ease',
  },

  emptyCardBox: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    padding: '40px',
    textAlign: 'center',
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),

  loadingBox: (isDark) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    color: isDark ? 'var(--text-muted)' : '#6c757d',
  }),

  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: `3px solid rgba(13, 110, 253, 0.2)`,
    borderTopColor: BT.primary,
    animation: 'spin 0.8s linear infinite',
  },

  // ── Modals ──
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
    padding: 16,
  },

  modal: (isDark) => ({
    background: isDark ? '#1e293b' : '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 580,
    boxShadow: '0 1rem 3rem rgba(0,0,0,.25)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '92vh',
    overflowY: 'auto',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),

  modalHeader: (isDark) => ({
    padding: '16px 24px',
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
  }),

  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: '#6c757d',
  },

  label: (isDark) => ({
    fontSize: 12,
    fontWeight: 700,
    color: isDark ? 'var(--text-main)' : '#495057',
    marginBottom: 4,
    display: 'block',
  }),

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },

  calcPreviewBox: (isDark) => ({
    display: 'flex',
    gap: 12,
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    borderRadius: 12,
    padding: '12px 16px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),

  calcLabel: (isDark) => ({
    fontSize: 11,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    fontWeight: 700,
    textTransform: 'uppercase',
  }),

  calcVal: (isDark) => ({
    fontWeight: 800,
    fontSize: 14,
    color: isDark ? '#ffffff' : '#212529',
    marginTop: 2,
  }),

  errorAlert: {
    background: '#f8d7da',
    border: '1px solid #f5c2c7',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#842029',
    fontSize: 12,
    fontWeight: 600,
  },

  warningBox: {
    background: '#fff3cd',
    border: '1px solid #ffecb5',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 12,
    color: '#664d03',
  },

  btnPrimary: {
    background: BT.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(13, 110, 253, 0.35)',
  },

  btnSecondary: {
    background: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },

  btnSuccess: {
    background: BT.success,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(25, 135, 84, 0.35)',
  },

  btnSuccessWide: {
    background: BT.success,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 2px 6px rgba(25, 135, 84, 0.35)',
  },

  btnDanger: {
    background: BT.danger,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(220, 53, 69, 0.35)',
  },

  payRow: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    borderRadius: 10,
    padding: '10px 14px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e9ecef'}`,
  }),

  addPayBox: (isDark) => ({
    background: isDark ? 'rgba(13, 110, 253, 0.08)' : '#f0f7ff',
    borderRadius: 12,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    border: `1px solid ${isDark ? 'rgba(13, 110, 253, 0.3)' : '#bfdbfe'}`,
  }),

  financeSyncBox: (isDark) => ({
    background: isDark ? 'rgba(25, 135, 84, 0.08)' : '#f0fdf4',
    borderRadius: 10,
    padding: '12px 14px',
    border: `1px solid ${isDark ? 'rgba(25, 135, 84, 0.3)' : '#bbf7d0'}`,
  }),
};
