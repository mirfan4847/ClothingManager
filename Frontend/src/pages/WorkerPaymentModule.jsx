import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAllStaff,
  getEntries,
  getWageRates,
  getWageSummary,
  getWagePayments,
  createWagePayment,
  deleteWagePayment,
  getAdvanceBalance,
  createAdvance,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { calculateWorkerWagesFromEntries, getEffectiveNetAmount, getEffectivePaidDate } from '../utils/wageUtils';

const fmt = (n) => 'PKR ' + Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-PK') : '—');
const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

const BT = {
  primary: '#0d6efd',
  secondary: '#6c757d',
  success: '#198754',
  danger: '#dc3545',
  warning: '#ffc107',
  info: '#0dcaf0',
  purple: '#6f42c1',
};

function generateWhatsAppMessage({ workerName, netAmount, grossAmount, deductions, paidAt, notes, isAdvance }) {
  const company = 'Clothing Manager';
  const dateStr = paidAt
    ? new Date(paidAt).toLocaleDateString('en-GB')
    : new Date().toLocaleDateString('en-GB');

  let text = `*${company.toUpperCase()} — PAYMENT VOUCHER* 🧾\n\n`;
  text += `👤 *Worker:* ${workerName}\n`;
  text += `📅 *Date:* ${dateStr}\n`;
  if (isAdvance) {
    text += `🔖 *Payment Type:* Cash Advance\n`;
    text += `💰 *Advance Paid:* *Rs ${Number(netAmount || 0).toLocaleString()}*\n`;
  } else {
    text += `🔖 *Payment Type:* Worker Wage Payment\n`;
    text += `💵 *Amount:* Rs ${Number(grossAmount || 0).toLocaleString()}\n`;
    if (Number(deductions) > 0) {
      text += `➖ *Advance Deduction:* Rs ${Number(deductions || 0).toLocaleString()}\n`;
    }
    text += `✅ *Net Paid to Worker:* *Rs ${Number(netAmount || 0).toLocaleString()}*\n`;
  }
  if (notes) {
    text += `📝 *Notes:* ${notes}\n`;
  }
  text += `\nThank you for your hard work! 👍`;
  return text;
}

export default function WorkerPaymentModule() {
  const { isDark } = useTheme();

  const [workers, setWorkers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Simple 1-Step Payment Form state
  const [workerId, setWorkerId] = useState('');
  const [paymentType, setPaymentType] = useState('wage'); // 'wage' | 'advance'
  const [payAmount, setPayAmount] = useState('');
  const [payDeduction, setPayDeduction] = useState('0');
  const [payDate, setPayDate] = useState(today());
  const [payNotes, setPayNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-fetched helper info for the selected worker
  const [workerStats, setWorkerStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Filter state for payment history table
  const [filterWorkerId, setFilterWorkerId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [whatsAppModal, setWhatsAppModal] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ws, sum, pmts] = await Promise.all([
        getAllStaff(),
        getWageSummary(),
        getWagePayments({}),
      ]);
      setWorkers(ws || []);
      setSummary(sum || null);
      setPayments(pmts || []);
    } catch {
      setError('Failed to load worker payments. Please make sure the server is running.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Automatically fetch earned wages & advance balance when a worker is selected
  useEffect(() => {
    if (!workerId) {
      setWorkerStats(null);
      setPayAmount('');
      setPayDeduction('0');
      return;
    }

    let cancelled = false;
    const wid = Number(workerId);
    setStatsLoading(true);

    Promise.all([
      getEntries(wid).catch(() => []),
      getWageRates(wid).catch(() => []),
      getAdvanceBalance(wid).catch(() => null),
    ]).then(([entries, rates, adv]) => {
      if (cancelled) return;
      const { grossAmount: totalEarned, breakdown } = calculateWorkerWagesFromEntries(wid, entries, rates);
      const totalAlreadyPaid = payments
        .filter(p => p.workerId === wid)
        .reduce((s, p) => s + (Number(p.grossAmount) || 0), 0);
      const remainingDue = Math.max(0, totalEarned - totalAlreadyPaid);
      const pendingAdvance = adv?.pendingBalance || 0;

      setWorkerStats({
        totalEarned,
        totalAlreadyPaid,
        remainingDue,
        pendingAdvance,
        breakdown,
      });

      setPayAmount('');
      setPayDeduction('0');
      setStatsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [workerId, payments]);

  const netToWorker = useMemo(() => {
    const gross = Number(payAmount) || 0;
    const ded = paymentType === 'wage' ? Number(payDeduction) || 0 : 0;
    return Math.max(0, gross - ded);
  }, [payAmount, payDeduction, paymentType]);

  const openWhatsAppReceipt = (data) => {
    const worker = workers.find(w => w.id === data.workerId || w.name === data.workerName);
    const phone = data.phone || worker?.phone || '';
    const message = generateWhatsAppMessage(data);
    setWhatsAppModal({
      workerName: data.workerName,
      phone,
      netAmount: data.netAmount,
      message,
      copied: false,
    });
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!workerId) {
      setError('Please select a worker first.');
      return;
    }
    const gross = Number(payAmount) || 0;
    if (gross <= 0) {
      setError('Please enter a valid payment amount greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const wid = Number(workerId);
      const worker = workers.find(w => w.id === wid);

      if (paymentType === 'advance') {
        const created = await createAdvance({
          workerId: wid,
          amount: gross,
          notes: payNotes || null,
          advanceDate: new Date(payDate || today()).toISOString(),
        });
        setSuccessMsg(`Cash advance of ${fmt(gross)} recorded for ${worker?.name || 'Worker'}.`);
        setPayAmount('');
        setPayNotes('');
        await loadData();

        openWhatsAppReceipt({
          workerId: wid,
          workerName: worker?.name || 'Worker',
          phone: created?.workerPhone || worker?.phone || '',
          grossAmount: gross,
          deductions: 0,
          netAmount: gross,
          paidAt: payDate,
          notes: payNotes,
          isAdvance: true,
        });
      } else {
        const ded = Number(payDeduction) || 0;
        const netPaid = Math.max(0, gross - ded);
        const created = await createWagePayment({
          workerId: wid,
          periodFrom: new Date(firstOfMonth()).toISOString(),
          periodTo: new Date(payDate || today()).toISOString(),
          paidAt: new Date(payDate || today()).toISOString(),
          grossAmount: gross,
          deductions: ded,
          netAmount: netPaid,
          notes: payNotes || null,
          recordAsAdvance: false,
        });
        setSuccessMsg(`Payment of ${fmt(netPaid)} disbursed to ${worker?.name || 'Worker'}.`);
        setPayAmount('');
        setPayDeduction('0');
        setPayNotes('');
        await loadData();

        openWhatsAppReceipt({
          workerId: wid,
          workerName: worker?.name || 'Worker',
          phone: created?.workerPhone || worker?.phone || '',
          grossAmount: gross,
          deductions: ded,
          netAmount: gross - ded,
          paidAt: payDate,
          notes: payNotes,
          isAdvance: false,
        });
      }
    } catch {
      setError('Failed to record payment. Please check your inputs and try again.');
    }
    setSaving(false);
  };

  const handleDeletePayment = async (id) => {
    try {
      await deleteWagePayment(id);
      setDeleteConfirm(null);
      await loadData();
    } catch {
      setError('Failed to delete payment record.');
    }
  };

  const filteredPayments = useMemo(() => {
    return payments
      .filter(p => {
        if (filterWorkerId && p.workerId !== Number(filterWorkerId)) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = (p.workerName || '').toLowerCase().includes(q);
          const matchNotes = (p.notes || '').toLowerCase().includes(q);
          if (!matchName && !matchNotes) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const tA = new Date(getEffectivePaidDate(a) || 0).getTime() || 0;
        const tB = new Date(getEffectivePaidDate(b) || 0).getTime() || 0;
        if (tB !== tA) return tB - tA;
        return (b.id || 0) - (a.id || 0);
      });
  }, [payments, filterWorkerId, searchQuery]);

  if (loading) {
    return (
      <div style={styles.loadingBox(isDark)}>
        <div style={styles.spinner} />
        <div style={{ marginTop: 14, fontWeight: 600 }}>Loading worker payments…</div>
      </div>
    );
  }

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">
      {/* ── Header Banner ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>💵</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>WORKFORCE DISBURSEMENT</div>
            <h1 style={styles.headerTitle(isDark)}>Worker Payments</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={styles.headerBadge}>Direct Payment Portal</span>
          <span style={styles.headerSubBadge(isDark)}>{payments.length} Payments Recorded</span>
        </div>
      </div>

      {error && (
        <div style={styles.errorAlert}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={styles.alertCloseBtn}>✕</button>
        </div>
      )}

      {successMsg && (
        <div style={styles.successAlert}>
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={styles.alertCloseBtn}>✕</button>
        </div>
      )}

      {/* ── KPI Summary Row ── */}
      {summary && (
        <div style={styles.kpiGrid}>
          <KpiCard
            label="Total Net Disbursed"
            tag="NET PAID TO WORKERS"
            value={fmt(payments.length > 0 ? payments.reduce((s, p) => s + getEffectiveNetAmount(p), 0) : summary.totalNet)}
            gradient="linear-gradient(135deg, #146c43 0%, #198754 100%)"
            icon="✅"
          />
          <KpiCard
            label="Total Gross Wages"
            tag="GROSS SETTLED"
            value={fmt(summary.totalPaid)}
            gradient="linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)"
            icon="💵"
          />
          <KpiCard
            label="Advances Deducted"
            tag="RECOVERED"
            value={fmt(summary.totalDeductions)}
            gradient="linear-gradient(135deg, #b02a37 0%, #dc3545 100%)"
            icon="🔻"
          />
          <KpiCard
            label="Pending Worker Advances"
            tag="OUTSTANDING"
            value={fmt(summary.totalOutstandingAdvances)}
            gradient="linear-gradient(135deg, #59359a 0%, #6f42c1 100%)"
            icon="⏳"
          />
        </div>
      )}

      {/* ── Simple 1-Step Record Worker Payment Card ── */}
      <div style={styles.cardBox(isDark)}>
        <div style={styles.cardHeader(isDark)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💸</span>
            <span style={{ fontWeight: 800, fontSize: 13.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pay Worker (Simple 1-Step Disbursement)
            </span>
          </div>

          {/* Toggle between Wage Payment and Cash Advance */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setPaymentType('wage')}
              style={styles.typePill(paymentType === 'wage', BT.success, isDark)}
            >
              💵 Wage Payment
            </button>
            <button
              type="button"
              onClick={() => setPaymentType('advance')}
              style={styles.typePill(paymentType === 'advance', BT.purple, isDark)}
            >
              💳 Cash Advance
            </button>
          </div>
        </div>

        <form onSubmit={handlePaySubmit} style={{ padding: '20px 22px' }}>
          {/* Quick Balance Strip when a worker is selected */}
          {workerId && (
            <div style={styles.balanceStrip(isDark)}>
              {statsLoading ? (
                <span style={{ fontSize: 12.5, color: '#64748b' }}>⏳ Checking worker balance…</span>
              ) : workerStats ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <span style={styles.stripLabel}>Total Earned: </span>
                        <strong style={{ color: BT.primary }}>{fmt(workerStats.totalEarned)}</strong>
                      </div>
                      <div>
                        <span style={styles.stripLabel}>Already Paid: </span>
                        <strong style={{ color: BT.secondary }}>{fmt(workerStats.totalAlreadyPaid)}</strong>
                      </div>
                      <div>
                        <span style={styles.stripLabel}>Remaining Unpaid Wages: </span>
                        <strong style={{ color: BT.success, fontSize: 14 }}>{fmt(workerStats.remainingDue)}</strong>
                      </div>
                      <div>
                        <span style={styles.stripLabel}>Pending Advance: </span>
                        <strong style={{ color: workerStats.pendingAdvance > 0 ? BT.danger : BT.secondary }}>
                          {fmt(workerStats.pendingAdvance)}
                        </strong>
                      </div>
                    </div>

                    {workerStats.breakdown?.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>Breakdown:</span>
                        {workerStats.breakdown.map(b => (
                          <span
                            key={`${b.taskType}-${b.ratePerPiece}`}
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: isDark ? 'rgba(37,99,235,0.18)' : '#eff6ff',
                              border: `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`,
                              color: isDark ? '#93c5fd' : '#1d4ed8',
                            }}
                          >
                            {b.taskType}: {b.totalPieces.toLocaleString()} pcs × ₨ {b.ratePerPiece} = {fmt(b.amount)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {workerStats.remainingDue > 0 && paymentType === 'wage' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayAmount(String(workerStats.remainingDue));
                        setPayDeduction(String(Math.min(workerStats.pendingAdvance, workerStats.remainingDue)));
                      }}
                      style={styles.autoFillBtn}
                    >
                      ⚡ Auto-Fill Remaining ({fmt(workerStats.remainingDue)})
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <div style={styles.formGrid}>
            {/* 1. Select Worker */}
            <div style={styles.fieldGroup}>
              <label style={styles.label(isDark)}>
                Select Worker <span style={{ color: BT.danger }}>*</span>
              </label>
              <select
                style={styles.select(isDark)}
                value={workerId}
                onChange={e => setWorkerId(e.target.value)}
                required
              >
                <option value="">— Choose Worker —</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.sheetType ? `(${w.sheetType})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Amount Paying Now */}
            <div style={styles.fieldGroup}>
              <label style={styles.label(isDark)}>
                {paymentType === 'advance' ? 'Advance Amount (PKR)' : 'Amount Paying Now (PKR)'} <span style={{ color: BT.danger }}>*</span>
              </label>
              <input
                style={styles.input(isDark)}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 5000"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                required
              />
            </div>

            {/* 3. Advance Deduction (only for wage payment) */}
            {paymentType === 'wage' && (
              <div style={styles.fieldGroup}>
                <label style={styles.label(isDark)}>Advance Deduction (PKR)</label>
                <input
                  style={styles.input(isDark)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={payDeduction}
                  onChange={e => setPayDeduction(e.target.value)}
                />
              </div>
            )}

            {/* 4. Payment Date */}
            <div style={styles.fieldGroup}>
              <label style={styles.label(isDark)}>Payment Date</label>
              <input
                style={styles.input(isDark)}
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
              />
            </div>

            {/* 5. Notes */}
            <div style={{ ...styles.fieldGroup, gridColumn: paymentType === 'wage' ? '1 / -1' : 'auto' }}>
              <label style={styles.label(isDark)}>Notes / Remarks</label>
              <input
                style={styles.input(isDark)}
                type="text"
                placeholder="e.g. Weekly wage settlement, cash payout…"
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Bottom Summary & Submit Bar */}
          <div style={styles.disburseFooter(isDark)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                Net to Worker:{' '}
                <strong style={{ color: BT.success, fontSize: 19 }}>
                  {fmt(netToWorker)}
                </strong>
              </span>
              {paymentType === 'wage' && Number(payDeduction) > 0 && (
                <span style={{ fontSize: 12.5, color: BT.danger, fontWeight: 600 }}>
                  (Includes {fmt(payDeduction)} advance deduction)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setWorkerId('');
                  setPayAmount('');
                  setPayDeduction('0');
                  setPayNotes('');
                }}
                style={styles.btnSecondary}
              >
                Reset
              </button>
              <button type="submit" disabled={saving} style={styles.btnConfirm}>
                {saving ? '⏳ Processing…' : '✓ Confirm & Disburse'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Payment History Table ── */}
      <div style={styles.cardBox(isDark)}>
        <div style={styles.cardHeader(isDark)}>
          <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🧾 Worker Payment History
          </span>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ ...styles.input(isDark), width: 210, padding: '6px 12px' }}
              placeholder="🔍 Search worker or notes…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select
              style={{ ...styles.select(isDark), width: 190, padding: '6px 10px' }}
              value={filterWorkerId}
              onChange={e => setFilterWorkerId(e.target.value)}
            >
              <option value="">All Workers ({payments.length})</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['#', 'Worker Name', 'Paid On', 'Gross Amount', 'Adv. Deduction', 'Net Paid', 'Notes', 'Actions'].map(h => (
                  <th key={h} style={styles.th(isDark)}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={styles.empty(isDark)}>
                    No worker payments found. Use the form above to disburse a payment.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p, idx) => (
                  <tr key={p.id} style={styles.tr(isDark, idx % 2 === 0)}>
                    <td style={{ ...styles.td(isDark), color: '#94a3b8', fontWeight: 700 }}>
                      {idx + 1}
                    </td>
                    <td style={styles.td(isDark)}>
                      <strong>{p.workerName}</strong>
                    </td>
                    <td style={styles.td(isDark)}>{fmtDate(getEffectivePaidDate(p))}</td>
                    <td style={{ ...styles.td(isDark), fontWeight: 600 }}>{fmt(p.grossAmount)}</td>
                    <td style={{ ...styles.td(isDark), color: BT.danger, fontWeight: 700 }}>
                      {Number(p.deductions) > 0 ? fmt(p.deductions) : '—'}
                    </td>
                    <td style={{ ...styles.td(isDark), color: BT.success, fontWeight: 800 }}>
                      {fmt(getEffectiveNetAmount(p))}
                    </td>
                    <td style={{ ...styles.td(isDark), color: isDark ? '#94a3b8' : '#64748b' }}>
                      {p.notes || '—'}
                    </td>
                    <td style={styles.td(isDark)}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          type="button"
                          style={styles.whatsAppSmBtn}
                          onClick={() => openWhatsAppReceipt({
                            workerId: p.workerId,
                            workerName: p.workerName,
                            phone: p.workerPhone,
                            grossAmount: p.grossAmount,
                            deductions: p.deductions,
                            netAmount: getEffectiveNetAmount(p),
                            paidAt: getEffectivePaidDate(p),
                            notes: p.notes,
                            isAdvance: false,
                          })}
                        >
                          📲 Receipt
                        </button>

                        {deleteConfirm === p.id ? (
                          <>
                            <button
                              type="button"
                              style={styles.btnDangerSm}
                              onClick={() => handleDeletePayment(p.id)}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              style={styles.btnSecondarySm}
                              onClick={() => setDeleteConfirm(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            style={styles.iconBtn}
                            onClick={() => setDeleteConfirm(p.id)}
                            title="Delete Payment"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── WhatsApp Receipt Modal ── */}
      {whatsAppModal && (
        <div style={styles.modalOverlay} onClick={() => setWhatsAppModal(null)}>
          <div style={styles.modalCard(isDark)} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>📲 Payment Voucher Ready</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>Send receipt to {whatsAppModal.workerName}</div>
              </div>
              <button onClick={() => setWhatsAppModal(null)} style={styles.modalCloseBtn}>✕</button>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={styles.label(isDark)}>Worker WhatsApp Number</label>
                <input
                  style={styles.input(isDark)}
                  placeholder="e.g. 03001234567"
                  value={whatsAppModal.phone}
                  onChange={e => setWhatsAppModal(m => ({ ...m, phone: e.target.value }))}
                />
              </div>
              <pre style={styles.voucherPre(isDark)}>{whatsAppModal.message}</pre>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(whatsAppModal.message);
                    setWhatsAppModal(m => ({ ...m, copied: true }));
                  }}
                  style={styles.btnSecondary}
                >
                  {whatsAppModal.copied ? '✓ Copied' : '📋 Copy Text'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    let cleanPhone = (whatsAppModal.phone || '').replace(/[^0-9]/g, '');
                    if (cleanPhone.startsWith('03')) cleanPhone = '92' + cleanPhone.slice(1);
                    const encoded = encodeURIComponent(whatsAppModal.message);
                    const url = cleanPhone
                      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
                      : `https://api.whatsapp.com/send?text=${encoded}`;
                    window.open(url, '_blank');
                  }}
                  style={styles.btnConfirm}
                >
                  📲 Send via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, tag, value, gradient, icon }) {
  return (
    <div style={{
      background: gradient,
      borderRadius: 14,
      padding: '16px 18px',
      color: '#fff',
      boxShadow: '0 6px 18px rgba(0,0,0,0.16)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: 96,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6 }}>
          {tag}
        </span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: 21, fontWeight: 800, marginTop: 8 }}>{value}</div>
        <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

const styles = {
  page: (isDark) => ({
    padding: '1.1rem 1.4rem',
    minHeight: '100vh',
    background: isDark ? 'var(--bg-page)' : '#f4f6f9',
    boxSizing: 'border-box',
  }),
  header: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    padding: '1rem 1.4rem',
    marginBottom: '1rem',
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
  }),
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #146c43 0%, #198754 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
  },
  headerBreadcrumb: { fontSize: 10.5, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em' },
  headerTitle: (isDark) => ({ margin: '2px 0 0', fontSize: '1.35rem', fontWeight: 800, color: isDark ? '#fff' : '#0f172a' }),
  headerBadge: { background: '#d1e7dd', color: '#0f5132', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  headerSubBadge: (isDark) => ({
    background: isDark ? '#334155' : '#e2e8f0',
    color: isDark ? '#e2e8f0' : '#475569',
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
  }),
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 12,
    marginBottom: '1rem',
  },
  cardBox: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    marginBottom: '1rem',
    overflow: 'hidden',
  }),
  cardHeader: (isDark) => ({
    padding: '14px 20px',
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    color: isDark ? '#fff' : '#0f172a',
  }),
  typePill: (active, color, isDark) => ({
    padding: '6px 14px',
    borderRadius: 20,
    border: active ? `1px solid ${color}` : `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
    background: active ? color : 'transparent',
    color: active ? '#fff' : (isDark ? '#cbd5e1' : '#475569'),
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
  }),
  balanceStrip: (isDark) => ({
    background: isDark ? 'rgba(13, 110, 253, 0.12)' : '#f0f7ff',
    border: `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`,
    borderRadius: 10,
    padding: '10px 14px',
    marginBottom: 16,
    fontSize: 13,
  }),
  stripLabel: { color: '#64748b', fontWeight: 600 },
  autoFillBtn: {
    background: '#0d6efd',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 14,
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: (isDark) => ({ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: isDark ? '#94a3b8' : '#475569' }),
  input: (isDark) => ({
    padding: '9px 12px',
    borderRadius: 8,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
    background: isDark ? 'var(--bg-subtle)' : '#fff',
    color: isDark ? 'var(--text-main)' : '#0f172a',
    fontSize: 13.5,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }),
  select: (isDark) => ({
    padding: '9px 12px',
    borderRadius: 8,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#cbd5e1'}`,
    background: isDark ? 'var(--bg-subtle)' : '#fff',
    color: isDark ? 'var(--text-main)' : '#0f172a',
    fontSize: 13.5,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }),
  disburseFooter: (isDark) => ({
    marginTop: 18,
    paddingTop: 14,
    borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  }),
  btnConfirm: {
    background: '#198754',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 20px',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnSecondary: {
    background: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: (isDark) => ({
    background: isDark ? '#1e293b' : '#f8fafc',
    color: isDark ? '#94a3b8' : '#475569',
    padding: '11px 14px',
    textAlign: 'left',
    fontSize: 11.5,
    fontWeight: 800,
    textTransform: 'uppercase',
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#e2e8f0'}`,
  }),
  tr: (isDark, even) => ({
    background: even ? (isDark ? 'var(--bg-card)' : '#fff') : (isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc'),
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
  }),
  td: (isDark) => ({ padding: '11px 14px', color: isDark ? 'var(--text-main)' : '#1e293b' }),
  empty: (isDark) => ({ textAlign: 'center', padding: '2.5rem', color: isDark ? '#94a3b8' : '#64748b' }),
  whatsAppSmBtn: {
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnDangerSm: { background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' },
  btnSecondarySm: { background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' },
  iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14 },
  errorAlert: {
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    padding: '10px 16px',
    borderRadius: 10,
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    fontWeight: 600,
  },
  successAlert: {
    background: '#f0fdf4',
    color: '#15803d',
    border: '1px solid #bbf7d0',
    padding: '10px 16px',
    borderRadius: 10,
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    fontWeight: 600,
  },
  alertCloseBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 },
  loadingBox: (isDark) => ({
    padding: '4rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: isDark ? '#94a3b8' : '#64748b',
  }),
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #cbd5e1',
    borderTopColor: '#198754',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modalCard: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
  }),
  modalHeader: {
    background: 'linear-gradient(135deg, #146c43 0%, #198754 100%)',
    color: '#fff',
    padding: '14px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer' },
  voucherPre: (isDark) => ({
    background: isDark ? '#0f172a' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    padding: 12,
    borderRadius: 8,
    fontSize: 12.5,
    whiteSpace: 'pre-wrap',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    maxHeight: 220,
    overflowY: 'auto',
  }),
};
