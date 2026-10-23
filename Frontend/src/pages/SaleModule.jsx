import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getSales, createSale, updateSale, deleteSale,
  addSalePayment, deleteSalePayment, getActiveCustomers, getLots, getAccounts,
} from '../services/api';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Online'];
const STATUS_COLORS   = {
  Pending: { bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
  Partial: { bg: '#fff7ed', color: '#9a3412', border: '#fdba74' },
  Paid:    { bg: '#dcfce7', color: '#14532d', border: '#86efac' },
};

const today    = () => new Date().toISOString().split('T')[0];
const fmtDate  = d  => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = n  => `Rs ${Number(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const emptySaleForm    = () => ({ lotId: '', customerId: '', saleDate: today(), totalPieces: '', ratePerPiece: '', discount: '0', notes: '' });
const emptyPaymentForm = () => ({ amount: '', paymentDate: today(), paymentMethod: 'Cash', referenceNo: '', notes: '', accountId: '' });

// ─────────────────────────────────────────────────────────────────────────────
export default function SaleModule() {
  const { can } = useAuth();
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
  const [paymentSale,    setPaymentSale]    = useState(null); // full sale obj
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

  const openDelSale = (sale) => {
    setDelSale(sale);
    setDelError('');
    setDelSaving(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter && statusFilter !== 'Outstanding') params.status = statusFilter;
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
  }, [statusFilter, custFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const displayed = useMemo(() => {
    let result = sales;
    if (statusFilter === 'Outstanding') result = result.filter(s => (s.balanceDue || 0) > 0);
    if (!search) return result;
    const q = search.toLowerCase();
    return result.filter(s =>
      s.lotNumber?.toLowerCase().includes(q)    ||
      s.customerName?.toLowerCase().includes(q) ||
      s.notes?.toLowerCase().includes(q)
    );
  }, [sales, search, statusFilter]);

  // Stats always reflect what's currently visible (filtered + searched)
  const summary = useMemo(() => ({
    totalSales:   displayed.length,
    totalRevenue: displayed.reduce((a, s) => a + (s.netAmount  || 0), 0),
    totalPaid:    displayed.reduce((a, s) => a + (s.totalPaid  || 0), 0),
    totalBalance: displayed.reduce((a, s) => a + (s.balanceDue || 0), 0),
    pendingCount: displayed.filter(s => s.status === 'Pending').length,
    partialCount: displayed.filter(s => s.status === 'Partial').length,
    paidCount:    displayed.filter(s => s.status === 'Paid').length,
  }), [displayed]);

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

  const totalAmount  = useMemo(() => {
    const p = Number(saleForm.totalPieces) || 0;
    const r = Number(saleForm.ratePerPiece) || 0;
    return p * r;
  }, [saleForm.totalPieces, saleForm.ratePerPiece]);

  const netAmount = useMemo(() => {
    return totalAmount - (Number(saleForm.discount) || 0);
  }, [totalAmount, saleForm.discount]);

  const handleSaveSale = async () => {
    if (!saleForm.lotId)         { setSaleError('Please select a lot.'); return; }
    if (!saleForm.customerId)    { setSaleError('Please select a customer.'); return; }
    if (!saleForm.totalPieces)   { setSaleError('Total pieces is required.'); return; }
    if (!saleForm.ratePerPiece)  { setSaleError('Rate per piece is required.'); return; }
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
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>🧾</div>
          <div>
            <div style={s.headerSub}>Revenue</div>
            <div style={s.headerTitle}>Sales Orders</div>
          </div>
        </div>
        <button onClick={openAddSale} style={s.addBtn}>+ New Sale</button>
      </div>

      {/* Summary — always reflects current filter + search */}
      <div style={s.statsRow}>
        {[
          { label: 'Total Sales',  val: summary.totalSales,             color: '#2E75B6', status: '' },
          { label: 'Revenue',      val: fmtMoney(summary.totalRevenue), color: '#059669', status: '' },
          { label: 'Collected',    val: fmtMoney(summary.totalPaid),    color: '#7c3aed', status: 'Paid' },
          { label: 'Outstanding',  val: fmtMoney(summary.totalBalance), color: '#dc2626', status: 'Outstanding' },
          { label: 'Pending',      val: summary.pendingCount,           color: '#854d0e', status: 'Pending' },
          { label: 'Partial',      val: summary.partialCount,           color: '#9a3412', status: 'Partial' },
          { label: 'Paid',         val: summary.paidCount,              color: '#14532d', status: 'Paid' },
        ].map(({ label, val, color, status: st }) => {
          const isClickable = st !== null;
          const isActive    = isClickable && statusFilter === st;
          return (
            <div key={label}
              onClick={isClickable ? () => setStatusFilter(st) : undefined}
              style={{
                ...s.statCard,
                cursor:    isClickable ? 'pointer' : 'default',
                border:    isActive    ? `2px solid ${color}` : '2px solid transparent',
                background: isActive   ? `${color}12` : '#fff',
                transform: isActive    ? 'translateY(-2px)' : 'none',
                boxShadow: isActive    ? `0 4px 12px ${color}30` : '0 1px 6px rgba(0,0,0,.07)',
                transition: 'all .15s',
              }}>
              <div style={{ ...s.statVal, color }}>{val}</div>
              <div style={{ ...s.statLabel, color: isActive ? color : '#888' }}>
                {label}{isClickable && !isActive && st !== '' ? ' ↑' : ''}
              </div>
            </div>
          );
        })}
        {hasFilters && (
          <div style={{ ...s.statCard, border: '1px dashed #f59e0b', background: '#fffbeb', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, textAlign: 'center' }}>Filtered</div>
            <button
              style={{ marginTop: 4, fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}
              onClick={() => { setStatusFilter(''); setCustFilter(''); setDateFrom(''); setDateTo(''); setSearch(''); }}>
              ✕ Clear
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={s.filterRow}>
        <input
          style={s.searchBox} placeholder="Search lot, customer…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select style={s.filterSelect} value={custFilter} onChange={e => { setCustFilter(e.target.value); }}>
          <option value="">All Customers</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input style={s.dateInput} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
        <input style={s.dateInput} type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   title="To date" />
        <div style={s.pills}>
          {[['', 'All'], ['Pending', 'Pending'], ['Partial', 'Partial'], ['Paid', 'Paid']].map(([k, l]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              style={{ ...s.pill, ...(statusFilter === k ? s.pillActive : {}) }}>
              {l}
              {k && sales.filter(sale => sale.status === k).length > 0 && (
                <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.8 }}>
                  ({sales.filter(sale => sale.status === k).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={s.viewToggle}>
          {[['table','☰'],['cards','⊞']].map(([k, ic]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ ...s.viewBtn, ...(view === k ? s.viewBtnActive : {}) }}
              title={k === 'table' ? 'Table view' : 'Card view'}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      {/* Table / Cards */}
      {loading ? (
        <div style={s.loading}>Loading sales…</div>
      ) : view === 'table' ? (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['Date','Lot','Size','Customer','Pieces','Rate','Total','Discount','Net','Paid','Balance','Status',''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(sale => {
                const st = STATUS_COLORS[sale.status] || STATUS_COLORS.Pending;
                return (
                  <tr key={sale.id} style={s.tr}>
                    <td style={s.td}>{fmtDate(sale.saleDate)}</td>
                    <td style={{ ...s.td, fontWeight: 700 }}>{sale.lotNumber}</td>
                    <td style={s.td}>{sale.sizeName || '—'}</td>
                    <td style={s.td}>{sale.customerName}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{sale.totalPieces.toLocaleString()}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmtMoney(sale.ratePerPiece)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmtMoney(sale.totalAmount)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: '#dc2626' }}>
                      {sale.discount > 0 ? `-${fmtMoney(sale.discount)}` : '—'}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700 }}>{fmtMoney(sale.netAmount)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: '#059669' }}>{fmtMoney(sale.totalPaid)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: sale.balanceDue > 0 ? '#dc2626' : '#888' }}>
                      {fmtMoney(sale.balanceDue)}
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.statusBadge, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                        {sale.status}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                        <button onClick={() => openPayModal(sale)} style={s.payBtn}>💳 Pay</button>
                        <button onClick={() => openEditSale(sale)} style={s.editBtn}>Edit</button>
                        <button onClick={() => openDelSale(sale)}  style={s.delBtn}>Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={13} style={{ ...s.td, textAlign: 'center', color: '#aaa', padding: 40 }}>
                  No sales found.
                </td></tr>
              )}
            </tbody>
          </table>
          <SalePagination page={page} pageSize={pageSize} total={displayed.length} onPage={setPage} onPageSize={setPageSize} />
        </div>
      ) : (
        // ── Card View ──
        displayed.length === 0 ? (
          <div style={s.loading}>No sales found.</div>
        ) : (
          <>
          <div style={s.saleCardGrid}>
            {paginated.map(sale => {
              const sc = STATUS_COLORS[sale.status] || STATUS_COLORS.Pending;
              return (
                <div key={sale.id} style={s.saleCard}>
                  {/* Card header */}
                  <div style={s.saleCardHead}>
                    <div>
                      <div style={s.saleCardLot}>{sale.lotNumber}</div>
                      {sale.sizeName && <div style={s.saleCardSize}>{sale.sizeName}</div>}
                    </div>
                    <span style={{ ...s.statusBadge, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      {sale.status}
                    </span>
                  </div>

                  {/* Customer & date */}
                  <div style={s.saleCardCustomer}>🤝 {sale.customerName}</div>
                  <div style={s.saleCardDate}>{fmtDate(sale.saleDate)}</div>

                  {/* Amounts */}
                  <div style={s.saleCardAmounts}>
                    <div style={s.saleCardAmtItem}>
                      <div style={s.saleCardAmtLabel}>Net</div>
                      <div style={s.saleCardAmtVal}>{fmtMoney(sale.netAmount)}</div>
                    </div>
                    <div style={s.saleCardAmtItem}>
                      <div style={s.saleCardAmtLabel}>Paid</div>
                      <div style={{ ...s.saleCardAmtVal, color: '#059669' }}>{fmtMoney(sale.totalPaid)}</div>
                    </div>
                    <div style={s.saleCardAmtItem}>
                      <div style={s.saleCardAmtLabel}>Balance</div>
                      <div style={{ ...s.saleCardAmtVal, color: sale.balanceDue > 0 ? '#dc2626' : '#888' }}>
                        {fmtMoney(sale.balanceDue)}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ background: '#e5e7eb', borderRadius: 999, height: 5, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      width: sale.netAmount > 0 ? `${Math.min(100, (sale.totalPaid / sale.netAmount) * 100)}%` : '0%',
                      background: sc.color,
                    }} />
                  </div>

                  {/* Meta */}
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {sale.totalPieces.toLocaleString()} pcs @ {fmtMoney(sale.ratePerPiece)}
                    {sale.discount > 0 && <span style={{ color: '#dc2626' }}> · -{fmtMoney(sale.discount)}</span>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button onClick={() => openPayModal(sale)} style={{ ...s.payBtn, flex: 1 }}>💳 Pay</button>
                    <button onClick={() => openEditSale(sale)} style={s.editBtn}>Edit</button>
                    <button onClick={() => openDelSale(sale)}  style={s.delBtn}>Del</button>
                  </div>
                </div>
              );
            })}
          </div>
          <SalePagination page={page} pageSize={pageSize} total={displayed.length} onPage={setPage} onPageSize={setPageSize} />
          </>
        )
      )}

      {/* ── Sale Form Modal ── */}
      {showSaleForm && (
        <div style={s.overlay} onClick={() => setShowSaleForm(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>{editingSale ? 'Edit Sale' : 'New Sale'}</div>

            <div style={s.formGrid}>
              <div>
                <label style={s.label}>Lot *</label>
                <select style={s.input} value={saleForm.lotId}
                  onChange={e => setSaleForm(f => ({ ...f, lotId: e.target.value }))}>
                  <option value="">— Select Lot —</option>
                  {lots.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.lotNumber}{l.sizeName ? ` (${l.sizeName})` : ''}{l.material ? ` — ${l.material}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={s.label}>Customer *</label>
                <select style={s.input} value={saleForm.customerId}
                  onChange={e => setSaleForm(f => ({ ...f, customerId: e.target.value }))}>
                  <option value="">— Select Customer —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Sale Date *</label>
                <input style={s.input} type="date" value={saleForm.saleDate}
                  onChange={e => setSaleForm(f => ({ ...f, saleDate: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Total Pieces *</label>
                <input style={s.input} type="number" min="1" value={saleForm.totalPieces}
                  onChange={e => setSaleForm(f => ({ ...f, totalPieces: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Rate / Piece *</label>
                <input style={s.input} type="number" min="0" step="0.01" value={saleForm.ratePerPiece}
                  onChange={e => setSaleForm(f => ({ ...f, ratePerPiece: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Discount</label>
                <input style={s.input} type="number" min="0" step="0.01" value={saleForm.discount}
                  onChange={e => setSaleForm(f => ({ ...f, discount: e.target.value }))} />
              </div>
            </div>

            {/* Calculated totals */}
            <div style={s.calcRow}>
              <div style={s.calcItem}>
                <div style={s.calcLabel}>Total Amount</div>
                <div style={s.calcVal}>{fmtMoney(totalAmount)}</div>
              </div>
              <div style={s.calcItem}>
                <div style={s.calcLabel}>Discount</div>
                <div style={{ ...s.calcVal, color: '#dc2626' }}>- {fmtMoney(Number(saleForm.discount) || 0)}</div>
              </div>
              <div style={{ ...s.calcItem, background: '#eff6ff', borderRadius: 8, padding: '8px 16px' }}>
                <div style={s.calcLabel}>Net Amount</div>
                <div style={{ ...s.calcVal, color: '#2E75B6', fontSize: '1.2rem' }}>{fmtMoney(netAmount)}</div>
              </div>
            </div>

            <div>
              <label style={s.label}>Notes</label>
              <textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={saleForm.notes}
                onChange={e => setSaleForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any remarks…" />
            </div>

            {saleError && <div style={s.errMsg}>{saleError}</div>}
            <div style={s.modalActions}>
              <button onClick={() => setShowSaleForm(false)} style={s.cancelBtn}>Cancel</button>
              <button onClick={handleSaveSale} style={s.saveBtn} disabled={saleSaving}>
                {saleSaving ? 'Saving…' : editingSale ? 'Update' : 'Create Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {showPayModal && paymentSale && (
        <div style={s.overlay} onClick={() => setShowPayModal(false)}>
          <div style={{ ...s.modal, maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            {/* Sale header */}
            <div style={s.payHeader}>
              <div>
                <div style={s.modalTitle}>Payment — {paymentSale.customerName}</div>
                <div style={{ fontSize: 13, color: '#555' }}>
                  Lot: <strong>{paymentSale.lotNumber}</strong>
                  {paymentSale.sizeName && ` (${paymentSale.sizeName})`}
                  &nbsp;·&nbsp;{paymentSale.totalPieces.toLocaleString()} pcs @ {fmtMoney(paymentSale.ratePerPiece)}
                </div>
              </div>
              <span style={{ ...s.statusBadge, ...STATUS_COLORS[paymentSale.status], border: `1px solid ${STATUS_COLORS[paymentSale.status]?.border}` }}>
                {paymentSale.status}
              </span>
            </div>

            {/* Totals row */}
            <div style={s.payTotals}>
              {[
                { label: 'Net Amount', val: fmtMoney(paymentSale.netAmount),  color: '#1e2a3b' },
                { label: 'Paid',       val: fmtMoney(paymentSale.totalPaid),  color: '#059669' },
                { label: 'Balance',    val: fmtMoney(paymentSale.balanceDue), color: paymentSale.balanceDue > 0 ? '#dc2626' : '#888' },
              ].map(({ label, val, color }) => (
                <div key={label} style={s.payTotalItem}>
                  <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
                  <div style={{ fontWeight: 700, color, fontSize: '1rem' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Payment history */}
            <div style={s.payHistoryLabel}>Payment History ({paymentSale.payments?.length || 0})</div>
            {paymentSale.payments?.length > 0 ? (
              <div style={s.payList}>
                {paymentSale.payments.map(p => (
                  <div key={p.id} style={s.payRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{fmtMoney(p.amount)}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {fmtDate(p.paymentDate)} · {p.paymentMethod}
                        {p.referenceNo && ` · Ref: ${p.referenceNo}`}
                      </div>
                      {p.notes && <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>{p.notes}</div>}
                    </div>
                    <button onClick={() => handleDeletePayment(p.id)} style={s.delBtn}>Del</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No payments yet.</div>
            )}

            {/* Add payment */}
            {paymentSale.balanceDue > 0 && (
              <>
                {!showPayForm ? (
                  <button onClick={() => setShowPayForm(true)} style={{ ...s.saveBtn, width: '100%', textAlign: 'center' }}>
                    + Record Payment
                  </button>
                ) : (
                  <div style={s.addPayForm}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#1e2a3b' }}>Record Payment</div>
                    <div style={s.formGrid}>
                      <div>
                        <label style={s.label}>Amount * (max {fmtMoney(balance)})</label>
                        <input style={s.input} type="number" min="1" max={balance} value={payForm.amount}
                          onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
                      </div>
                      <div>
                        <label style={s.label}>Payment Date *</label>
                        <input style={s.input} type="date" value={payForm.paymentDate}
                          onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))} />
                      </div>
                      <div>
                        <label style={s.label}>Method</label>
                        <select style={s.input} value={payForm.paymentMethod}
                          onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                          {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={s.label}>Reference No</label>
                        <input style={s.input} type="text" value={payForm.referenceNo}
                          placeholder="Cheque / TRX no."
                          onChange={e => setPayForm(f => ({ ...f, referenceNo: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label style={s.label}>Notes</label>
                      <input style={s.input} type="text" value={payForm.notes}
                        onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div style={{ background: '#f0f7ff', borderRadius: 8, padding: '10px 12px', border: '1px solid #bfdbfe' }}>
                      <label style={{ ...s.label, color: '#1d4ed8', fontWeight: 700 }}>📊 Record in Finance Account</label>
                      <select style={{ ...s.input, marginTop: 4 }} value={payForm.accountId}
                        onChange={e => setPayForm(f => ({ ...f, accountId: e.target.value }))}>
                        <option value="">— Don't record in Finance —</option>
                        {finAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.categoryName})</option>
                        ))}
                      </select>
                      {payForm.accountId && (
                        <div style={{ fontSize: 11, color: '#1d4ed8', marginTop: 4 }}>
                          ✓ A Credit transaction will be created in Finance automatically
                        </div>
                      )}
                    </div>
                    {payError && <div style={s.errMsg}>{payError}</div>}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button onClick={() => setShowPayForm(false)} style={s.cancelBtn}>Cancel</button>
                      <button onClick={handleAddPayment} style={s.saveBtn} disabled={paySaving}>
                        {paySaving ? 'Saving…' : 'Save Payment'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setShowPayModal(false)} style={s.cancelBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Sale Confirm ── */}
      {delSale && (
        <div style={s.overlay} onClick={() => !delSaving && setDelSale(null)}>
          <div style={{ ...s.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Delete Sale?</div>
            <p style={{ color: '#555', fontSize: 14, margin: '4px 0 8px' }}>
              Delete sale of lot <strong>{delSale.lotNumber}</strong> to{' '}
              <strong>{delSale.customerName}</strong> ({fmtMoney(delSale.netAmount)})?
            </p>

            {delSale.payments?.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b' }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>⚠️ Recorded Payments Warning</div>
                This sale has <strong>{delSale.payments.length}</strong> payment(s) totaling <strong>{fmtMoney(delSale.totalPaid)}</strong>.
                Deleting this sale will also remove all its recorded payments.
              </div>
            )}

            {delError && <div style={s.errMsg}>{delError}</div>}

            <div style={{ ...s.modalActions, marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setDelSale(null)} style={s.cancelBtn} disabled={delSaving}>
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
                    style={s.payBtn}
                    disabled={delSaving}>
                    💳 View Payments
                  </button>
                  <button
                    onClick={() => handleDeleteSale(true)}
                    style={{ ...s.saveBtn, background: '#dc2626' }}
                    disabled={delSaving}>
                    {delSaving ? 'Deleting…' : 'Delete Sale & Payments'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleDeleteSale(false)}
                  style={{ ...s.saveBtn, background: '#dc2626' }}
                  disabled={delSaving}>
                  {delSaving ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function SalePagination({ page, pageSize, total, onPage, onPageSize }) {
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
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderTop:'2px solid #f0f2f5', background:'#fafbfc', flexWrap:'wrap', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#6b7280' }}>
        <span style={{ fontWeight:600 }}>Rows per page:</span>
        <select value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          style={{ border:'1.5px solid #e5e7eb', borderRadius:7, padding:'5px 10px', fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ color:'#9ca3af' }}>Showing <b style={{ color:'#374151' }}>{from}–{to}</b> of <b style={{ color:'#374151' }}>{total}</b></span>
      </div>
      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <SalePageBtn disabled={page <= 1} onClick={() => onPage(page-1)}>‹ Prev</SalePageBtn>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} style={{ padding:'4px 4px', color:'#9ca3af', fontSize:14 }}>…</span>
            : <SalePageBtn key={p} active={p === page} onClick={() => onPage(p)}>{p}</SalePageBtn>
        )}
        <SalePageBtn disabled={page >= totalPages} onClick={() => onPage(page+1)}>Next ›</SalePageBtn>
      </div>
    </div>
  );
}

function SalePageBtn({ onClick, disabled, active, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:'5px 10px', borderRadius:7, border:'1.5px solid',
      borderColor: active ? '#2E75B6' : '#e5e7eb',
      background: active ? '#2E75B6' : disabled ? '#f9fafb' : '#fff',
      color: active ? '#fff' : disabled ? '#d1d5db' : '#374151',
      fontSize:13, fontWeight: active ? 700 : 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      minWidth:34, transition:'all .1s',
    }}>{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = {
  page:         { padding: 24, maxWidth: 1300, margin: '0 auto' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  headerLeft:   { display: 'flex', alignItems: 'center', gap: 14 },
  headerIcon:   { fontSize: 36 },
  headerSub:    { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle:  { fontSize: '1.5rem', fontWeight: 700, color: '#1e2a3b' },
  addBtn:       { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },

  statsRow:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 20 },
  statCard:     { background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 6px rgba(0,0,0,.07)', textAlign: 'center' },
  statVal:      { fontSize: '1.3rem', fontWeight: 800 },
  statLabel:    { fontSize: 11, color: '#888', marginTop: 2 },

  filterRow:    { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  searchBox:    { flex: 1, minWidth: 160, padding: '8px 12px', border: '1px solid #dde', borderRadius: 8, fontSize: 13 },
  filterSelect: { padding: '8px 10px', border: '1px solid #dde', borderRadius: 8, fontSize: 13, background: '#fff' },
  dateInput:    { padding: '8px 10px', border: '1px solid #dde', borderRadius: 8, fontSize: 13 },
  pills:        { display: 'flex', gap: 6 },
  pill:         { border: '1px solid #dde', background: '#f8f9fa', borderRadius: 20, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, color: '#555' },
  pillActive:   { background: '#2E75B6', color: '#fff', borderColor: '#2E75B6' },
  viewToggle:   { display: 'flex', border: '1px solid #dde', borderRadius: 8, overflow: 'hidden' },
  viewBtn:      { border: 'none', background: '#f8f9fa', padding: '7px 13px', cursor: 'pointer', fontSize: 15, color: '#777' },
  viewBtnActive:{ background: '#2E75B6', color: '#fff' },

  saleCardGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 },
  saleCard:         { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 6px rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', gap: 8 },
  saleCardHead:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  saleCardLot:      { fontWeight: 800, fontSize: '1.1rem', color: '#1e2a3b' },
  saleCardSize:     { fontSize: 12, color: '#888', marginTop: 1 },
  saleCardCustomer: { fontSize: 13, fontWeight: 600, color: '#444' },
  saleCardDate:     { fontSize: 12, color: '#aaa' },
  saleCardAmounts:  { display: 'flex', justifyContent: 'space-between', background: '#f8f9fa', borderRadius: 8, padding: '8px 12px' },
  saleCardAmtItem:  { textAlign: 'center', flex: 1 },
  saleCardAmtLabel: { fontSize: 10, color: '#888', marginBottom: 1 },
  saleCardAmtVal:   { fontWeight: 700, fontSize: '0.95rem', color: '#1e2a3b' },

  loading:      { padding: 60, textAlign: 'center', color: '#888' },

  tableWrap:    { background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflow: 'auto' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  thead:        { background: '#f8f9fa' },
  th:           { padding: '11px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#555', borderBottom: '2px solid #eee', whiteSpace: 'nowrap' },
  tr:           { borderBottom: '1px solid #f0f0f0' },
  td:           { padding: '10px 12px', fontSize: 13, color: '#333', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  statusBadge:  { display: 'inline-block', fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '3px 8px' },
  payBtn:       { background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  editBtn:      { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  delBtn:       { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },

  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal:        { background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 8px 40px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92vh', overflowY: 'auto' },
  modalTitle:   { fontSize: '1.15rem', fontWeight: 700, color: '#1e2a3b' },
  label:        { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 2, display: 'block' },
  input:        { width: '100%', padding: '8px 10px', border: '1px solid #dde', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' },
  formGrid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  calcRow:      { display: 'flex', gap: 12, background: '#f8f9fa', borderRadius: 10, padding: 12 },
  calcItem:     { flex: 1, textAlign: 'center' },
  calcLabel:    { fontSize: 11, color: '#888', marginBottom: 2 },
  calcVal:      { fontWeight: 700, fontSize: '1rem', color: '#1e2a3b' },
  errMsg:       { color: '#dc2626', fontSize: 12, background: '#fef2f2', padding: '8px 12px', borderRadius: 6 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn:    { background: '#f1f5f9', color: '#333', border: 'none', borderRadius: 7, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  saveBtn:      { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 22px', fontWeight: 700, cursor: 'pointer', fontSize: 13 },

  payHeader:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  payTotals:       { display: 'flex', gap: 12, background: '#f8f9fa', borderRadius: 10, padding: '10px 16px' },
  payTotalItem:    { flex: 1, textAlign: 'center' },
  payHistoryLabel: { fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: .5 },
  payList:         { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' },
  payRow:          { display: 'flex', alignItems: 'center', gap: 10, background: '#f8f9fa', borderRadius: 8, padding: '8px 12px' },
  addPayForm:      { background: '#f0f7ff', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #bfdbfe' },
};
