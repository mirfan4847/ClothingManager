import { useState, useEffect, useCallback } from 'react';
import api, {
  getAllStaff, getWageRates, upsertWageRate, deleteWageRate,
  calculateWages, calculateAllWages, getWageSummary, getWagePayments,
  createWagePayment, deleteWagePayment,
  getAdvances, createAdvance, settleAdvance, deleteAdvance, getAdvanceBalance,
  syncPayrollToFinance, cleanupFinanceDuplicates,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';

const TABS = [
  { key: 'Overview',   icon: '📊', label: 'Overview' },
  { key: 'Wage Rates', icon: '🏷️', label: 'Wage Rates' },
  { key: 'Calculate',  icon: '🧮', label: 'Calculate' },
  { key: 'Advances',   icon: '💳', label: 'Advances' },
  { key: 'Reports',    icon: '📈', label: 'Reports' },
];

const fmt     = (n) => 'PKR ' + Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK') : '—';
const today        = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

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
  teal:      '#20c997',
  orange:    '#fd7e14',
};

function generateWhatsAppMessage({ workerName, netAmount, grossAmount, deductions, periodFrom, periodTo, advanceDate, paidAt, notes, isAdvance }) {
  const company = "Clothing Manager";
  const dateStr = (paidAt || advanceDate) ? new Date(paidAt || advanceDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  const periodStr = (periodFrom && periodTo)
    ? `${new Date(periodFrom).toLocaleDateString('en-GB')} to ${new Date(periodTo).toLocaleDateString('en-GB')}`
    : '';

  let text = `*${company.toUpperCase()} — PAYMENT VOUCHER* 🧾\n\n`;
  text += `👤 *Staff Member:* ${workerName}\n`;
  text += `📅 *Date:* ${dateStr}\n`;
  if (isAdvance) {
    text += `🔖 *Payment Type:* Worker Cash Advance\n`;
    text += `💰 *Advance Amount:* *Rs ${Number(netAmount || 0).toLocaleString()}*\n`;
  } else {
    text += `🔖 *Payment Type:* Wage Disbursement (Piece-Rate)\n`;
    if (periodStr) text += `⏱️ *Period:* ${periodStr}\n`;
    text += `💵 *Gross Wages:* Rs ${Number(grossAmount || 0).toLocaleString()}\n`;
    if (Number(deductions) > 0) {
      text += `➖ *Deduction / Advance:* Rs ${Number(deductions || 0).toLocaleString()}\n`;
    }
    text += `✅ *Net Amount Paid:* *Rs ${Number(netAmount || 0).toLocaleString()}*\n`;
  }
  if (notes) {
    text += `📝 *Notes:* ${notes}\n`;
  }
  text += `\nThank you for your hard work and dedication! 👍\n_${company} Accounts & Payroll_`;
  return text;
}

export default function WageModule() {
  const { isDark, currentColor } = useTheme();

  const [tab, setTab]         = useState('Overview');
  const [workers, setWorkers] = useState([]);
  const [rates, setRates]     = useState([]);
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [whatsAppModal, setWhatsAppModal] = useState(null);
  const [dialogModal, setDialogModal]     = useState(null);

  const showAlert = (message, title = 'Notification', type = 'info') => {
    setDialogModal({ type, title, message });
  };

  const showConfirm = ({ title, message, confirmText = 'Continue', onConfirm, isDanger = false }) => {
    setDialogModal({
      type: isDanger ? 'danger' : 'confirm',
      title,
      message,
      confirmText,
      onConfirm: async () => {
        setDialogModal(null);
        await onConfirm();
      },
      showCancel: true,
    });
  };

  // Wage Rates form
  const [rateForm, setRateForm]               = useState({ workerId: '', taskType: '', ratePerPiece: '' });
  const [rateWorkerFilter, setRateWorkerFilter] = useState('');
  const [taskTypes, setTaskTypes]             = useState(['Front', 'Bazo', 'Tape', 'Pocket', 'Gala', 'Lable', 'Moda', 'Quantity', 'TotalPiece']);

  const allTaskTypes = Array.from(new Set([
    ...taskTypes,
    ...rates.map(r => r.taskType).filter(Boolean),
  ]));

  // Calculate (single worker)
  const [calcForm, setCalcForm]       = useState({ workerId: '', from: firstOfMonth(), to: today() });
  const [calcResult, setCalcResult]   = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [advBalance, setAdvBalance]   = useState(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount]       = useState('');
  const [payDeduction, setPayDeduction] = useState('');
  const [payNotes, setPayNotes]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [syncing, setSyncing]           = useState(false);
  const [payAsAdvance, setPayAsAdvance] = useState(false);

  // Advances
  const [advForm, setAdvForm]               = useState({ workerId: '', amount: '', notes: '', advanceDate: today() });
  const [advWorkerFilter, setAdvWorkerFilter] = useState('');
  const [advSettledFilter, setAdvSettledFilter] = useState('unsettled');

  // Reports (all workers)
  const [reportForm, setReportForm]       = useState({ from: firstOfMonth(), to: today() });
  const [reportResult, setReportResult]   = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedWorker, setExpandedWorker] = useState(null);

  // Shared
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [payFilter, setPayFilter]         = useState({ workerId: '', from: '', to: '' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ws, rs, sum, pmts, advs, ttRes] = await Promise.all([
        getAllStaff(), getWageRates(), getWageSummary(), getWagePayments({}), getAdvances({}),
        api.get('/dropdowns/task-types').then(r => r.data).catch(() => []),
      ]);
      setWorkers(ws); setRates(rs); setSummary(sum); setPayments(pmts); setAdvances(advs);
      if (Array.isArray(ttRes) && ttRes.length > 0) {
        setTaskTypes(ttRes.map(t => t.name).filter(Boolean));
      }
    } catch {
      setError('Failed to load data. Ensure the backend is running.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Wage Rate handlers ──────────────────────────────────────────────────

  const handleRateSubmit = async () => {
    if (!rateForm.workerId || !rateForm.taskType || !rateForm.ratePerPiece) return;
    setSaving(true);
    try {
      await upsertWageRate({
        workerId: Number(rateForm.workerId),
        taskType: rateForm.taskType,
        ratePerPiece: Number(rateForm.ratePerPiece),
      });
      setRateForm({ workerId: '', taskType: '', ratePerPiece: '' });
      setRates(await getWageRates());
    } catch { setError('Failed to save rate.'); }
    setSaving(false);
  };

  const handleDeleteRate = async (id) => {
    try {
      await deleteWageRate(id);
      setRates(r => r.filter(x => x.id !== id));
    } catch { setError('Failed to delete rate.'); }
    setDeleteConfirm(null);
  };

  // ── Calculate handlers ──────────────────────────────────────────────────

  const handleCalculate = async () => {
    if (!calcForm.workerId || !calcForm.from || !calcForm.to) return;
    setCalcLoading(true);
    setCalcResult(null);
    setShowPayForm(false);
    try {
      const wid = Number(calcForm.workerId);
      const [result, adv] = await Promise.all([
        calculateWages(wid, calcForm.from, calcForm.to),
        getAdvanceBalance(wid),
      ]);
      setCalcResult(result);
      setAdvBalance(adv);
      setPayAmount(String(result.grossAmount));
      setPayDeduction(String(Math.min(adv.pendingBalance, result.grossAmount)));
    } catch { setError('Calculation failed. Ensure entries exist for this worker and period.'); }
    setCalcLoading(false);
  };

  // ── WhatsApp helpers ───────────────────────────────────────────────────

  const openWhatsAppReceipt = (data) => {
    const worker = workers.find(w => w.id === data.workerId || w.name === data.workerName);
    const phone = data.phone || worker?.phone || '';
    const message = generateWhatsAppMessage(data);
    setWhatsAppModal({
      workerId: data.workerId || worker?.id,
      workerName: data.workerName,
      phone,
      netAmount: data.netAmount,
      isAdvance: data.isAdvance,
      message,
      copied: false,
    });
  };

  const handleSendWhatsApp = () => {
    if (!whatsAppModal) return;
    let cleanPhone = (whatsAppModal.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('03')) {
      cleanPhone = '92' + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith('3') && cleanPhone.length === 10) {
      cleanPhone = '92' + cleanPhone;
    }
    const encoded = encodeURIComponent(whatsAppModal.message);
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleCopyWhatsApp = () => {
    if (!whatsAppModal) return;
    navigator.clipboard.writeText(whatsAppModal.message);
    setWhatsAppModal(m => ({ ...m, copied: true }));
    setTimeout(() => setWhatsAppModal(m => m ? ({ ...m, copied: false }) : null), 2500);
  };

  const handleRecordPayment = async () => {
    if (!calcResult) return;
    setSaving(true);
    try {
      const gross = Number(payAmount) || 0;
      const ded   = Number(payDeduction) || 0;
      const created = await createWagePayment({
        workerId:    calcResult.workerId,
        periodFrom:  new Date(calcForm.from).toISOString(),
        periodTo:    new Date(calcForm.to).toISOString(),
        grossAmount: gross,
        deductions:  ded,
        notes:       payNotes || null,
        recordAsAdvance: payAsAdvance,
      });
      setShowPayForm(false);
      setCalcResult(null);
      setPayAsAdvance(false);
      await loadAll();

      // Open WhatsApp Voucher popup
      const worker = workers.find(w => w.id === calcResult.workerId);
      openWhatsAppReceipt({
        workerId:    calcResult.workerId,
        workerName:  calcResult.workerName,
        phone:       created?.workerPhone || worker?.phone || '',
        grossAmount: gross,
        deductions:  ded,
        netAmount:   gross - ded,
        periodFrom:  calcForm.from,
        periodTo:    calcForm.to,
        notes:       payNotes,
        isAdvance:   false,
      });
    } catch { setError('Failed to record payment.'); }
    setSaving(false);
  };

  const handleDeletePayment = async (id) => {
    try {
      await deleteWagePayment(id);
      setPayments(p => p.filter(x => x.id !== id));
      setSummary(await getWageSummary());
    } catch { setError('Failed to delete payment.'); }
    setDeleteConfirm(null);
  };

  // ── Advance handlers ───────────────────────────────────────────────────

  const handleAdvanceSubmit = async () => {
    if (!advForm.workerId || !advForm.amount) return;
    setSaving(true);
    try {
      const created = await createAdvance({
        workerId:    Number(advForm.workerId),
        amount:      Number(advForm.amount),
        notes:       advForm.notes || null,
        advanceDate: new Date(advForm.advanceDate).toISOString(),
      });
      const worker = workers.find(w => w.id === Number(advForm.workerId));
      const wName = worker?.name || 'Staff Member';
      const wPhone = created?.workerPhone || worker?.phone || '';
      const advAmount = Number(advForm.amount);
      const advDate = advForm.advanceDate;
      const advNotes = advForm.notes;

      setAdvForm({ workerId: '', amount: '', notes: '', advanceDate: today() });
      setAdvances(await getAdvances({}));
      setSummary(await getWageSummary());

      // Open WhatsApp Voucher popup
      openWhatsAppReceipt({
        workerId:    worker?.id,
        workerName:  wName,
        phone:       wPhone,
        grossAmount: 0,
        deductions:  0,
        netAmount:   advAmount,
        advanceDate: advDate,
        notes:       advNotes,
        isAdvance:   true,
      });
    } catch { setError('Failed to record advance.'); }
    setSaving(false);
  };

  const handleSettleAdvance = async (id) => {
    try {
      await settleAdvance(id);
      setAdvances(await getAdvances({}));
      setSummary(await getWageSummary());
    } catch { setError('Failed to settle advance.'); }
    setDeleteConfirm(null);
  };

  const handleDeleteAdvance = async (id) => {
    try {
      await deleteAdvance(id);
      setAdvances(a => a.filter(x => x.id !== id));
      setSummary(await getWageSummary());
    } catch { setError('Failed to delete advance.'); }
    setDeleteConfirm(null);
  };

  // ── Report handler ─────────────────────────────────────────────────────

  const handleReport = async () => {
    if (!reportForm.from || !reportForm.to) return;
    setReportLoading(true);
    setReportResult(null);
    setExpandedWorker(null);
    try {
      const result = await calculateAllWages(reportForm.from, reportForm.to);
      setReportResult(result);
    } catch { setError('Report calculation failed.'); }
    setReportLoading(false);
  };

  // ── Filters ────────────────────────────────────────────────────────────

  const filteredPayments = payments.filter(p => {
    if (payFilter.workerId && p.workerId !== Number(payFilter.workerId)) return false;
    if (payFilter.from && new Date(p.paidAt) < new Date(payFilter.from)) return false;
    if (payFilter.to   && new Date(p.paidAt) > new Date(payFilter.to))   return false;
    return true;
  });

  const filteredRates = rateWorkerFilter
    ? rates.filter(r => r.workerId === Number(rateWorkerFilter))
    : rates;

  const filteredAdvances = advances.filter(a => {
    if (advWorkerFilter && a.workerId !== Number(advWorkerFilter)) return false;
    if (advSettledFilter === 'unsettled' && a.isSettled)           return false;
    if (advSettledFilter === 'settled'   && !a.isSettled)          return false;
    return true;
  });

  if (loading) {
    return (
      <div style={styles.loadingBox(isDark)}>
        <div style={styles.spinner} />
        <div style={{ marginTop: 14, fontWeight: 600 }}>Loading payroll & wage data…</div>
      </div>
    );
  }

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">
      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>💼</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>WORKFORCE MANAGEMENT</div>
            <h1 style={styles.headerTitle(isDark)}>Payroll & Wage Accounting</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={styles.headerBadge}>
            Piece-Rate Payroll
          </span>
          <span style={styles.headerSubBadge(isDark)}>
            {workers.length} Total Staff
          </span>
        </div>
      </div>

      {error && (
        <div style={styles.errorAlert}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={styles.alertCloseBtn}>✕</button>
        </div>
      )}

      {/* ── Bootstrap Nav Pills (Tabs) ── */}
      <div style={styles.tabBar(isDark)}>
        {TABS.map(t => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              style={styles.tabBtn(isActive, isDark)}
              onClick={() => setTab(t.key)}
            >
              <span style={{ marginRight: 6 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div style={styles.content}>

        {/* ── 1. OVERVIEW TAB ─────────────────────────────────────────── */}
        {tab === 'Overview' && summary && (
          <div>
            {/* 5 Executive KPI Cards with Bootstrap Colors */}
            <div style={styles.kpiGrid}>
              <BtKpiCard
                label="Total Gross Paid"
                tag="GROSS WAGES"
                value={fmt(summary.totalPaid)}
                gradient="linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)"
                glow="rgba(13, 110, 253, 0.35)"
                icon="💵"
              />
              <BtKpiCard
                label="Total Deductions"
                tag="ADVANCES DEDUCTED"
                value={fmt(summary.totalDeductions)}
                gradient="linear-gradient(135deg, #b02a37 0%, #dc3545 100%)"
                glow="rgba(220, 53, 69, 0.35)"
                icon="🔻"
              />
              <BtKpiCard
                label="Total Net Paid"
                tag="NET DISBURSED"
                value={fmt(summary.totalNet)}
                gradient="linear-gradient(135deg, #146c43 0%, #198754 100%)"
                glow="rgba(25, 135, 84, 0.35)"
                icon="✅"
              />
              <BtKpiCard
                label="Total Payments"
                tag="DISBURSEMENTS"
                value={summary.totalPayments}
                gradient="linear-gradient(135deg, #087990 0%, #0dcaf0 100%)"
                glow="rgba(13, 202, 240, 0.35)"
                icon="🧾"
              />
              <BtKpiCard
                label="Outstanding Advances"
                tag="PENDING ADVANCE"
                value={fmt(summary.totalOutstandingAdvances)}
                gradient="linear-gradient(135deg, #59359a 0%, #6f42c1 100%)"
                glow="rgba(111, 66, 193, 0.35)"
                icon="⏳"
              />
            </div>

            {/* Finance Integration Card */}
            <div style={styles.financeCard(isDark)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={styles.financeIcon}>🔄</div>
                <div>
                  <div style={styles.financeTitle(isDark)}>Financial Ledger Integration</div>
                  <div style={styles.financeSub(isDark)}>
                    Salary payments automatically post to the general ledger under <strong>Salary &amp; Wages</strong>.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  style={styles.btnOutlineDanger}
                  disabled={syncing}
                  onClick={() => {
                    showConfirm({
                      title: 'Clean Duplicate Entries',
                      message: 'This will remove duplicate salary entries in Finance (keeping one per worker per period). Are you sure you want to continue?',
                      confirmText: 'Yes, Clean Duplicates',
                      isDanger: true,
                      onConfirm: async () => {
                        setSyncing(true);
                        try {
                          const r = await cleanupFinanceDuplicates();
                          showAlert(r.message, 'Cleanup Complete', 'success');
                          await loadAll();
                        } catch {
                          showAlert('Cleanup failed. Make sure backend is running.', 'Error', 'danger');
                        }
                        setSyncing(false);
                      },
                    });
                  }}
                >
                  {syncing ? '⏳ Working…' : '🧹 Fix Duplicate Entries'}
                </button>
                <button
                  style={styles.btnSuccess}
                  disabled={syncing}
                  onClick={async () => {
                    setSyncing(true);
                    try {
                      const r = await syncPayrollToFinance();
                      showAlert(r.message, 'Payroll Synced', 'success');
                    } catch {
                      showAlert('Sync failed. Make sure backend is running.', 'Sync Failed', 'danger');
                    }
                    setSyncing(false);
                  }}
                >
                  {syncing ? '⏳ Syncing…' : '🔄 Sync Payroll to Finance'}
                </button>
              </div>
            </div>

            {/* Recent Payments Table */}
            <div style={styles.cardBox(isDark)}>
              <div style={styles.cardHeader(isDark)}>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🧾 Recent Wage Payments
                </span>
                <span style={styles.countBadge}>
                  {summary.recentPayments.length} Payments
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Worker Name', 'Pay Period', 'Gross Amount', 'Adv. Deduction', 'Net to Worker', 'Paid On', 'Receipt'].map(h => (
                        <th key={h} style={styles.th(isDark)}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentPayments.length === 0 ? (
                      <tr><td colSpan={7} style={styles.empty(isDark)}>No wage payment records yet.</td></tr>
                    ) : (
                      summary.recentPayments.map((p, i) => (
                        <tr key={p.id} style={styles.tr(isDark, i % 2 === 0)}>
                          <td style={styles.td(isDark)}>
                            <strong>{p.workerName}</strong>
                          </td>
                          <td style={styles.td(isDark)}>
                            {fmtDate(p.periodFrom)} – {fmtDate(p.periodTo)}
                          </td>
                          <td style={styles.td(isDark)}>
                            {fmt(p.grossAmount)}
                          </td>
                          <td style={{ ...styles.td(isDark), color: BT.danger, fontWeight: 700 }}>
                            {fmt(p.deductions)}
                          </td>
                          <td style={{ ...styles.td(isDark), color: BT.success, fontWeight: 800 }}>
                            {fmt(p.netAmount)}
                          </td>
                          <td style={styles.td(isDark)}>
                            {fmtDate(p.paidAt)}
                          </td>
                          <td style={styles.td(isDark)}>
                            <button
                              style={styles.whatsAppSmBtn}
                              onClick={() => openWhatsAppReceipt({
                                workerId:    p.workerId,
                                workerName:  p.workerName,
                                phone:       p.workerPhone,
                                grossAmount: p.grossAmount,
                                deductions:  p.deductions,
                                netAmount:   p.netAmount,
                                periodFrom:  p.periodFrom,
                                periodTo:    p.periodTo,
                                paidAt:      p.paidAt,
                                notes:       p.notes,
                                isAdvance:   false,
                              })}
                              title="Send WhatsApp payment receipt"
                            >
                              📲 WhatsApp
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. WAGE RATES TAB ───────────────────────────────────────── */}
        {tab === 'Wage Rates' && (
          <div>
            {/* Form Card */}
            <div style={styles.cardBox(isDark)}>
              <div style={styles.cardHeader(isDark)}>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🏷️ Set Worker Piece Rate
                </span>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={styles.formRow}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
                    <label style={styles.label(isDark)}>Worker</label>
                    <select
                      style={styles.select(isDark)}
                      value={rateForm.workerId}
                      onChange={e => setRateForm(f => ({ ...f, workerId: e.target.value }))}
                    >
                      <option value="">— Select Worker —</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
                    <label style={styles.label(isDark)}>Task Type</label>
                    <select
                      style={styles.select(isDark)}
                      value={rateForm.taskType}
                      onChange={e => setRateForm(f => ({ ...f, taskType: e.target.value }))}
                    >
                      <option value="">— Select Task —</option>
                      {allTaskTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
                    <label style={styles.label(isDark)}>Rate per Piece (PKR)</label>
                    <input
                      style={styles.input(isDark)}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 5.50"
                      value={rateForm.ratePerPiece}
                      onChange={e => setRateForm(f => ({ ...f, ratePerPiece: e.target.value }))}
                    />
                  </div>

                  <button
                    style={styles.btnPrimary}
                    onClick={handleRateSubmit}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : '+ Save Rate'}
                  </button>
                </div>
              </div>
            </div>

            {/* Filter toolbar */}
            <div style={styles.filterToolbar(isDark)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? 'var(--text-main)' : '#495057' }}>
                  Filter by worker:
                </span>
                <select
                  style={{ ...styles.select(isDark), maxWidth: 220 }}
                  value={rateWorkerFilter}
                  onChange={e => setRateWorkerFilter(e.target.value)}
                >
                  <option value="">All Workers</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <span style={styles.countBadge}>
                {filteredRates.length} configured rates
              </span>
            </div>

            {/* Rates Table */}
            <div style={styles.cardBox(isDark)}>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Worker', 'Task Type', 'Rate / Piece', 'Last Updated', 'Actions'].map(h => (
                        <th key={h} style={styles.th(isDark)}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRates.length === 0 ? (
                      <tr><td colSpan={5} style={styles.empty(isDark)}>No piece rates configured.</td></tr>
                    ) : (
                      filteredRates.map((r, i) => (
                        <tr key={r.id} style={styles.tr(isDark, i % 2 === 0)}>
                          <td style={styles.td(isDark)}><strong>{r.workerName}</strong></td>
                          <td style={styles.td(isDark)}>
                            <span style={styles.taskBadge}>{r.taskType}</span>
                          </td>
                          <td style={{ ...styles.td(isDark), fontWeight: 800, color: BT.primary }}>
                            {fmt(r.ratePerPiece)}
                          </td>
                          <td style={styles.td(isDark)}>{fmtDate(r.updatedAt)}</td>
                          <td style={styles.td(isDark)}>
                            {deleteConfirm === `rate-${r.id}` ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button style={styles.btnDangerSm} onClick={() => handleDeleteRate(r.id)}>Confirm</button>
                                <button style={styles.btnSecondarySm} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                              </div>
                            ) : (
                              <button style={styles.iconBtn} onClick={() => setDeleteConfirm(`rate-${r.id}`)} title="Delete Rate">
                                🗑️
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. CALCULATE TAB ────────────────────────────────────────── */}
        {tab === 'Calculate' && (
          <div>
            <div style={styles.cardBox(isDark)}>
              <div style={styles.cardHeader(isDark)}>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🧮 Calculate Single Worker Wages
                </span>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={styles.formRow}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
                    <label style={styles.label(isDark)}>Worker</label>
                    <select
                      style={styles.select(isDark)}
                      value={calcForm.workerId}
                      onChange={e => setCalcForm(f => ({ ...f, workerId: e.target.value }))}
                    >
                      <option value="">— Select Worker —</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={styles.label(isDark)}>From Date</label>
                    <input
                      style={styles.input(isDark)}
                      type="date"
                      value={calcForm.from}
                      onChange={e => setCalcForm(f => ({ ...f, from: e.target.value }))}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={styles.label(isDark)}>To Date</label>
                    <input
                      style={styles.input(isDark)}
                      type="date"
                      value={calcForm.to}
                      onChange={e => setCalcForm(f => ({ ...f, to: e.target.value }))}
                    />
                  </div>

                  <button
                    style={styles.btnPrimary}
                    onClick={handleCalculate}
                    disabled={calcLoading}
                  >
                    {calcLoading ? 'Calculating…' : '🧮 Calculate Wages'}
                  </button>
                </div>
              </div>
            </div>

            {calcResult && (() => {
              const _from = new Date(calcForm.from);
              const _to   = new Date(calcForm.to);
              const alreadyPaid = payments
                .filter(p => p.workerId === calcResult.workerId
                          && new Date(p.periodTo)   >= _from
                          && new Date(p.periodFrom) <= _to)
                .reduce((sum, p) => sum + p.grossAmount, 0);
              const remaining = calcResult.grossAmount - alreadyPaid;

              return (
                <div style={styles.cardBox(isDark)}>
                  <div style={{
                    padding: '16px 20px', borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
                  }}>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: isDark ? '#fff' : '#0f172a' }}>
                        {calcResult.workerName}
                      </h3>
                      <div style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 2 }}>
                        📅 {fmtDate(calcResult.periodFrom)} – {fmtDate(calcResult.periodTo)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#6c757d', fontWeight: 700 }}>GROSS EARNED</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: BT.primary }}>{fmt(calcResult.grossAmount)}</div>
                      </div>
                      {alreadyPaid > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: '#6c757d', fontWeight: 700 }}>ALREADY PAID</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: BT.danger }}>{fmt(alreadyPaid)}</div>
                        </div>
                      )}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#6c757d', fontWeight: 700 }}>REMAINING DUE</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: remaining > 0 ? BT.success : remaining < 0 ? BT.danger : '#6c757d' }}>
                          {remaining < 0 ? `- ${fmt(Math.abs(remaining))}` : fmt(remaining)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {calcResult.breakdown.length === 0 ? (
                    <div style={styles.empty(isDark)}>No entries found for this period, or no wage rates configured.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            {['Task Type', 'Total Pieces', 'Rate / Piece', 'Amount'].map(h => (
                              <th key={h} style={styles.th(isDark)}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {calcResult.breakdown.map((b, i) => (
                            <tr key={b.taskType} style={styles.tr(isDark, i % 2 === 0)}>
                              <td style={styles.td(isDark)}><span style={styles.taskBadge}>{b.taskType}</span></td>
                              <td style={styles.td(isDark)}>{b.totalPieces.toLocaleString()} pcs</td>
                              <td style={styles.td(isDark)}>{fmt(b.ratePerPiece)}</td>
                              <td style={{ ...styles.td(isDark), fontWeight: 700, color: BT.primary }}>{fmt(b.amount)}</td>
                            </tr>
                          ))}
                          <tr style={{ background: isDark ? 'var(--bg-subtle)' : '#f8f9fa' }}>
                            <td colSpan={3} style={{ ...styles.td(isDark), fontWeight: 800, textAlign: 'right' }}>GROSS TOTAL:</td>
                            <td style={{ ...styles.td(isDark), fontWeight: 800, color: BT.success, fontSize: 15 }}>
                              {fmt(calcResult.grossAmount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Advance notice */}
                  {advBalance && advBalance.pendingBalance > 0 && (
                    <div style={{ margin: '14px 20px', padding: 12, background: '#fdf4ff', borderRadius: 8, border: '1px solid #f0abfc' }}>
                      <div style={{ fontWeight: 700, color: BT.purple, marginBottom: 4 }}>
                        Outstanding Advances Balance: {fmt(advBalance.pendingBalance)}
                      </div>
                      {advBalance.unsettledAdvances.map(a => (
                        <div key={a.id} style={{ fontSize: 12, color: '#4b5563' }}>
                          • {fmtDate(a.advanceDate)} — {fmt(a.amount)} {a.notes ? `(${a.notes})` : ''}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Payment Action Bar */}
                  <div style={{ padding: '16px 20px', borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}` }}>
                    {!showPayForm ? (
                      <button
                        style={styles.btnSuccess}
                        onClick={() => {
                          setShowPayForm(true);
                          if (advBalance?.pendingBalance) setPayDeduction(String(advBalance.pendingBalance));
                        }}
                      >
                        💳 Record Payment Now
                      </button>
                    ) : (
                      <div style={{ padding: 16, background: isDark ? 'var(--bg-subtle)' : '#f8fafc', borderRadius: 10, border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}` }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: isDark ? '#fff' : '#0f172a' }}>
                          Record Wage Disbursement
                        </h4>
                        <div style={styles.formRow}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                            <label style={styles.label(isDark)}>Amount Paying Now</label>
                            <input
                              style={styles.input(isDark)}
                              type="number"
                              min="0"
                              step="0.01"
                              value={payAmount}
                              onChange={e => setPayAmount(e.target.value)}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                            <label style={styles.label(isDark)}>Advance Deduction</label>
                            <input
                              style={styles.input(isDark)}
                              type="number"
                              min="0"
                              step="0.01"
                              value={payDeduction}
                              onChange={e => setPayDeduction(e.target.value)}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 2 }}>
                            <label style={styles.label(isDark)}>Notes</label>
                            <input
                              style={styles.input(isDark)}
                              type="text"
                              placeholder="e.g. Month-end wage settlement"
                              value={payNotes}
                              onChange={e => setPayNotes(e.target.value)}
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 14 }}>
                            Net to Worker: <strong style={{ color: BT.success, fontSize: 17 }}>
                              {fmt((Number(payAmount) || 0) - (Number(payDeduction) || 0))}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button style={styles.btnSecondarySm} onClick={() => setShowPayForm(false)}>Cancel</button>
                            <button style={styles.btnSuccess} onClick={handleRecordPayment} disabled={saving}>
                              {saving ? 'Saving…' : 'Confirm & Disburse'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Payment history for selected worker */}
            {calcForm.workerId && (
              <div style={styles.cardBox(isDark)}>
                <div style={styles.cardHeader(isDark)}>
                  <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Payment History — {workers.find(w => w.id === Number(calcForm.workerId))?.name}
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Period', 'Amount Paid', 'Adv. Deduction', 'Net to Worker', 'Paid On', 'Notes', 'Receipt'].map(h => (
                          <th key={h} style={styles.th(isDark)}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.filter(p => p.workerId === Number(calcForm.workerId)).length === 0 ? (
                        <tr><td colSpan={7} style={styles.empty(isDark)}>No prior payments found for this worker.</td></tr>
                      ) : (
                        payments.filter(p => p.workerId === Number(calcForm.workerId)).map((p, i) => (
                          <tr key={p.id} style={styles.tr(isDark, i % 2 === 0)}>
                            <td style={styles.td(isDark)}>{fmtDate(p.periodFrom)} – {fmtDate(p.periodTo)}</td>
                            <td style={styles.td(isDark)}>{fmt(p.grossAmount)}</td>
                            <td style={{ ...styles.td(isDark), color: BT.danger }}>{fmt(p.deductions)}</td>
                            <td style={{ ...styles.td(isDark), color: BT.success, fontWeight: 700 }}>{fmt(p.netAmount)}</td>
                            <td style={styles.td(isDark)}>{fmtDate(p.paidAt)}</td>
                            <td style={styles.td(isDark)}>{p.notes || '—'}</td>
                            <td style={styles.td(isDark)}>
                              <button
                                style={styles.whatsAppSmBtn}
                                onClick={() => openWhatsAppReceipt({
                                  workerId:    p.workerId,
                                  workerName:  p.workerName,
                                  phone:       p.workerPhone,
                                  grossAmount: p.grossAmount,
                                  deductions:  p.deductions,
                                  netAmount:   p.netAmount,
                                  periodFrom:  p.periodFrom,
                                  periodTo:    p.periodTo,
                                  paidAt:      p.paidAt,
                                  notes:       p.notes,
                                  isAdvance:   false,
                                })}
                                title="Send WhatsApp payment receipt"
                              >
                                📲 WhatsApp
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 4. ADVANCES TAB ─────────────────────────────────────────── */}
        {tab === 'Advances' && (
          <div>
            <div style={styles.cardBox(isDark)}>
              <div style={styles.cardHeader(isDark)}>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  💳 Record Worker Cash Advance
                </span>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={styles.formRow}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
                    <label style={styles.label(isDark)}>Worker</label>
                    <select
                      style={styles.select(isDark)}
                      value={advForm.workerId}
                      onChange={e => setAdvForm(f => ({ ...f, workerId: e.target.value }))}
                    >
                      <option value="">— Select Worker —</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 150 }}>
                    <label style={styles.label(isDark)}>Advance Amount (PKR)</label>
                    <input
                      style={styles.input(isDark)}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 5000"
                      value={advForm.amount}
                      onChange={e => setAdvForm(f => ({ ...f, amount: e.target.value }))}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={styles.label(isDark)}>Date Issued</label>
                    <input
                      style={styles.input(isDark)}
                      type="date"
                      value={advForm.advanceDate}
                      onChange={e => setAdvForm(f => ({ ...f, advanceDate: e.target.value }))}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1.5, minWidth: 180 }}>
                    <label style={styles.label(isDark)}>Notes (optional)</label>
                    <input
                      style={styles.input(isDark)}
                      type="text"
                      placeholder="e.g. Emergency advance"
                      value={advForm.notes}
                      onChange={e => setAdvForm(f => ({ ...f, notes: e.target.value }))}
                    />
                  </div>

                  <button
                    style={styles.btnPrimary}
                    onClick={handleAdvanceSubmit}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : '+ Issue Advance'}
                  </button>
                </div>
              </div>
            </div>

            {/* Filter toolbar */}
            <div style={styles.filterToolbar(isDark)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <select
                  style={{ ...styles.select(isDark), maxWidth: 200 }}
                  value={advWorkerFilter}
                  onChange={e => setAdvWorkerFilter(e.target.value)}
                >
                  <option value="">All Workers</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <select
                  style={{ ...styles.select(isDark), maxWidth: 160 }}
                  value={advSettledFilter}
                  onChange={e => setAdvSettledFilter(e.target.value)}
                >
                  <option value="all">All Advances</option>
                  <option value="unsettled">Unsettled (Pending)</option>
                  <option value="settled">Settled</option>
                </select>
                <span style={styles.countBadge}>
                  {filteredAdvances.length} records
                </span>
              </div>
            </div>

            {/* Table */}
            <div style={styles.cardBox(isDark)}>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Worker', 'Amount', 'Date Issued', 'Notes', 'Settlement Status', 'Actions'].map(h => (
                        <th key={h} style={styles.th(isDark)}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdvances.length === 0 ? (
                      <tr><td colSpan={6} style={styles.empty(isDark)}>No advances found.</td></tr>
                    ) : (
                      filteredAdvances.map((a, i) => (
                        <tr key={a.id} style={styles.tr(isDark, i % 2 === 0)}>
                          <td style={styles.td(isDark)}><strong>{a.workerName}</strong></td>
                          <td style={{ ...styles.td(isDark), fontWeight: 800, color: BT.purple }}>{fmt(a.amount)}</td>
                          <td style={styles.td(isDark)}>{fmtDate(a.advanceDate)}</td>
                          <td style={styles.td(isDark)}>{a.notes || '—'}</td>
                          <td style={styles.td(isDark)}>
                            <span style={a.isSettled ? styles.settledBadge : styles.pendingBadge}>
                              {a.isSettled ? `Settled ${fmtDate(a.settledAt)}` : 'Pending'}
                            </span>
                          </td>
                          <td style={styles.td(isDark)}>
                            {deleteConfirm === `adv-${a.id}` ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                {!a.isSettled && (
                                  <button style={styles.btnSuccessSm} onClick={() => handleSettleAdvance(a.id)}>Confirm Settle</button>
                                )}
                                <button style={styles.btnDangerSm} onClick={() => handleDeleteAdvance(a.id)}>Delete</button>
                                <button style={styles.btnSecondarySm} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button
                                  style={styles.whatsAppSmBtn}
                                  onClick={() => openWhatsAppReceipt({
                                    workerId:    a.workerId,
                                    workerName:  a.workerName,
                                    phone:       a.workerPhone,
                                    grossAmount: 0,
                                    deductions:  0,
                                    netAmount:   a.amount,
                                    advanceDate: a.advanceDate,
                                    notes:       a.notes,
                                    isAdvance:   true,
                                  })}
                                  title="Send WhatsApp advance receipt"
                                >
                                  📲 WhatsApp
                                </button>
                                {!a.isSettled && (
                                  <button style={styles.btnSuccessSm} onClick={() => handleSettleAdvance(a.id)}>Settle</button>
                                )}
                                <button style={styles.iconBtn} onClick={() => setDeleteConfirm(`adv-${a.id}`)}>🗑️</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. REPORTS TAB ─────────────────────────────────────────── */}
        {tab === 'Reports' && (
          <div>
            <div style={styles.cardBox(isDark)}>
              <div style={styles.cardHeader(isDark)}>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  📈 All-Workers Wage Summary Report
                </span>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={styles.formRow}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={styles.label(isDark)}>From Date</label>
                    <input
                      style={styles.input(isDark)}
                      type="date"
                      value={reportForm.from}
                      onChange={e => setReportForm(f => ({ ...f, from: e.target.value }))}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={styles.label(isDark)}>To Date</label>
                    <input
                      style={styles.input(isDark)}
                      type="date"
                      value={reportForm.to}
                      onChange={e => setReportForm(f => ({ ...f, to: e.target.value }))}
                    />
                  </div>

                  <button
                    style={styles.btnPrimary}
                    onClick={handleReport}
                    disabled={reportLoading}
                  >
                    {reportLoading ? 'Generating…' : '📊 Generate Report'}
                  </button>
                </div>
              </div>
            </div>

            {reportResult && (
              <div style={styles.cardBox(isDark)}>
                <div style={styles.cardHeader(isDark)}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>
                    Report Results: {fmtDate(reportForm.from)} – {fmtDate(reportForm.to)}
                  </span>
                  <strong style={{ color: BT.success, fontSize: 15 }}>
                    Grand Total: {fmt(reportResult.reduce((a, r) => a + r.grossAmount, 0))}
                  </strong>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Worker', 'Total Pieces', 'Gross Wages', 'Details'].map(h => (
                          <th key={h} style={styles.th(isDark)}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportResult.length === 0 ? (
                        <tr><td colSpan={4} style={styles.empty(isDark)}>No worker activity in this period.</td></tr>
                      ) : (
                        reportResult.map((w, i) => (
                          <tr key={w.workerId} style={styles.tr(isDark, i % 2 === 0)}>
                            <td style={styles.td(isDark)}><strong>{w.workerName}</strong></td>
                            <td style={styles.td(isDark)}>{w.breakdown.reduce((a, b) => a + b.totalPieces, 0).toLocaleString()} pcs</td>
                            <td style={{ ...styles.td(isDark), fontWeight: 800, color: BT.primary }}>{fmt(w.grossAmount)}</td>
                            <td style={styles.td(isDark)}>
                              <button
                                style={styles.btnSecondarySm}
                                onClick={() => setExpandedWorker(expandedWorker === w.workerId ? null : w.workerId)}
                              >
                                {expandedWorker === w.workerId ? 'Hide Details' : 'Show Details'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── WhatsApp Payment Voucher Modal ── */}
      {whatsAppModal && (
        <div style={styles.modalOverlay} onClick={() => setWhatsAppModal(null)}>
          <div style={styles.modalBox(isDark)} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={styles.modalHeader(isDark)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>💬</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? '#ffffff' : '#0f172a' }}>
                    Send WhatsApp Payment Receipt
                  </div>
                  <div style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d', marginTop: 2 }}>
                    Notify staff member directly on WhatsApp about their payment
                  </div>
                </div>
              </div>
              <button
                onClick={() => setWhatsAppModal(null)}
                style={styles.modalCloseBtn(isDark)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Highlight summary banner */}
              <div style={{
                background: isDark ? 'rgba(37, 211, 102, 0.12)' : '#e8f9ee',
                border: '1px solid rgba(37, 211, 102, 0.35)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#86efac' : '#15803d', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {whatsAppModal.isAdvance ? 'Cash Advance' : 'Staff Wage Payment'}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? '#ffffff' : '#1e293b', marginTop: 2 }}>
                    👤 {whatsAppModal.workerName}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#6c757d', fontWeight: 600 }}>Amount Disbursed</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: isDark ? '#4ade80' : '#16a34a' }}>
                    Rs {Number(whatsAppModal.netAmount || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Staff WhatsApp Phone Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#334155' }}>
                  Staff Mobile / WhatsApp Number:
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>
                    📱
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. 03001234567 or +923001234567"
                    value={whatsAppModal.phone}
                    onChange={e => setWhatsAppModal(m => ({ ...m, phone: e.target.value }))}
                    style={{
                      ...styles.input(isDark),
                      paddingLeft: 36,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#64748b' }}>
                  💡 Country code (+92) is automatically prefixed if starting with 03.
                </span>
              </div>

              {/* Message text area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#334155' }}>
                    Message Content (Editable):
                  </label>
                  <span style={{ fontSize: 11, color: isDark ? 'var(--text-muted)' : '#64748b' }}>
                    Preview formatted for WhatsApp
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={whatsAppModal.message}
                  onChange={e => setWhatsAppModal(m => ({ ...m, message: e.target.value }))}
                  style={{
                    ...styles.input(isDark),
                    fontFamily: 'Consolas, Menlo, Monaco, monospace',
                    fontSize: 12,
                    lineHeight: 1.5,
                    resize: 'vertical',
                    padding: '10px 12px',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  style={{
                    ...styles.btnSecondarySm,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {whatsAppModal.copied ? '✅ Copied to Clipboard!' : '📋 Copy Message'}
                </button>

                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  style={{
                    background: '#25D366',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.35)',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  <span style={{ fontSize: 16 }}>📲</span>
                  <span>Open WhatsApp &amp; Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── System Dialog / Alert / Confirm Modal ── */}
      {dialogModal && (
        <div style={styles.modalOverlay} onClick={() => setDialogModal(null)}>
          <div style={{ ...styles.modalBox(isDark), maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div
              style={{
                padding: '1.1rem 1.4rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: dialogModal.type === 'danger'
                  ? 'linear-gradient(135deg, #be123c 0%, #dc2626 100%)'
                  : dialogModal.type === 'success'
                  ? 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)'
                  : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>
                  {dialogModal.type === 'danger' ? '⚠️' : dialogModal.type === 'success' ? '✅' : 'ℹ️'}
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  {dialogModal.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDialogModal(null)}
                style={{
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
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.5rem', fontSize: 14, color: isDark ? 'var(--text-main, #f1f5f9)' : '#334155', lineHeight: 1.6 }}>
              {dialogModal.message}
            </div>

            <div
              style={{
                padding: '1rem 1.4rem',
                borderTop: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                background: isDark ? '#0f172a' : '#f8fafc',
              }}
            >
              {dialogModal.showCancel && (
                <button
                  type="button"
                  style={{
                    background: isDark ? '#1e293b' : '#ffffff',
                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                    color: isDark ? '#e2e8f0' : '#475569',
                    borderRadius: 8,
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => setDialogModal(null)}
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                style={{
                  background: dialogModal.type === 'danger'
                    ? 'linear-gradient(135deg, #be123c 0%, #dc2626 100%)'
                    : dialogModal.type === 'success'
                    ? 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)'
                    : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 22px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                }}
                onClick={() => {
                  if (dialogModal.onConfirm) {
                    dialogModal.onConfirm();
                  } else {
                    setDialogModal(null);
                  }
                }}
              >
                {dialogModal.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Bootstrap KPI Card Sub-Component ──
function BtKpiCard({ label, tag, value, gradient, glow, icon }) {
  return (
    <div style={{
      background: gradient,
      borderRadius: 14,
      padding: '16px 18px',
      color: '#ffffff',
      boxShadow: `0 6px 18px ${glow}`,
      border: '1px solid rgba(255, 255, 255, 0.18)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: 110,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)',
        pointerEvents: 'none'
      }} />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, position: 'relative', zIndex: 1 }}>
          <span style={{
            fontSize: '0.675rem', fontWeight: 800, letterSpacing: '0.05em',
            padding: '2px 8px', borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.22)', backdropFilter: 'blur(4px)',
            color: '#ffffff', textTransform: 'uppercase'
          }}>
            {tag || label}
          </span>
          <span style={{ fontSize: '1.25rem', opacity: 0.9 }}>{icon}</span>
        </div>

        <div style={{ fontSize: 21, fontWeight: 800, color: '#ffffff', lineHeight: 1.15, textShadow: '0 1px 3px rgba(0,0,0,0.25)', position: 'relative', zIndex: 1 }}>
          {value}
        </div>
      </div>

      <div style={{
        fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600,
        marginTop: 10, paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.18)',
        position: 'relative', zIndex: 1
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Styles (Bootstrap 5 Professional Theme) ──
const styles = {
  page: (isDark) => ({
    padding: '1.1rem 1.4rem',
    minHeight: '100vh',
    boxSizing: 'border-box',
    width: '100%',
  }),
  header: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.85rem',
    marginBottom: '1rem',
    padding: '1rem 1.4rem',
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
  }),
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#e7f1ff',
    color: '#0d6efd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.4rem',
  },
  headerBreadcrumb: {
    fontSize: '0.725rem',
    fontWeight: 800,
    color: '#6c757d',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  headerTitle: (isDark) => ({
    fontSize: '1.4rem',
    fontWeight: 800,
    color: isDark ? 'var(--text-main)' : '#212529',
    margin: '2px 0 0 0',
    letterSpacing: '-0.02em',
  }),
  headerBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: 20,
    background: '#e7f1ff',
    color: '#0d6efd',
    border: '1px solid #b6d4fe',
  },
  headerSubBadge: (isDark) => ({
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: 20,
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),
  errorAlert: {
    background: '#f8d7da',
    color: '#842029',
    border: '1px solid #f5c2c7',
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 13,
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#842029',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  },

  // ── Nav Pills (Tabs) ──
  tabBar: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
  }),
  tabBtn: (isActive, isDark) => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 16px',
    borderRadius: 20,
    border: isActive ? '1px solid #0d6efd' : `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    background: isActive ? '#0d6efd' : (isDark ? 'var(--bg-card)' : '#ffffff'),
    color: isActive ? '#ffffff' : (isDark ? 'var(--text-main)' : '#495057'),
    fontSize: '0.825rem',
    fontWeight: isActive ? 700 : 600,
    cursor: 'pointer',
    boxShadow: isActive ? '0 4px 12px rgba(13, 110, 253, 0.35)' : 'none',
    transition: 'all .15s ease',
  }),

  content: {},

  // ── KPI Grid ──
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },

  // ── Finance Integration ──
  financeCard: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    borderLeft: '4px solid #198754',
    borderRadius: 12,
    padding: '14px 18px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
  }),
  financeIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: '#d1e7dd',
    color: '#0f5132',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },
  financeTitle: (isDark) => ({
    fontWeight: 700,
    fontSize: 14,
    color: isDark ? '#fff' : '#0f5132',
  }),
  financeSub: (isDark) => ({
    fontSize: 12,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    marginTop: 2,
  }),
  btnOutlineDanger: {
    background: 'transparent',
    color: '#dc3545',
    border: '1px solid #dc3545',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background .15s',
  },
  btnSuccess: {
    background: '#198754',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(25, 135, 84, 0.28)',
  },

  // ── Card Containers ──
  cardBox: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    overflow: 'hidden',
    marginBottom: 16,
  }),
  cardHeader: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    color: isDark ? 'var(--text-main)' : '#212529',
  }),
  countBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 12,
    background: '#e7f1ff',
    color: '#0d6efd',
  },

  // ── Forms ──
  formRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  label: (isDark) => ({
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
  }),
  select: (isDark) => ({
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
    background: isDark ? 'var(--bg-subtle)' : '#ffffff',
    color: isDark ? 'var(--text-main)' : '#212529',
    fontSize: 13,
    outline: 'none',
  }),
  input: (isDark) => ({
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
    background: isDark ? 'var(--bg-subtle)' : '#ffffff',
    color: isDark ? 'var(--text-main)' : '#212529',
    fontSize: 13,
    outline: 'none',
  }),
  btnPrimary: {
    background: '#0d6efd',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(13, 110, 253, 0.28)',
  },
  btnSecondarySm: {
    background: '#6c757d',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnDangerSm: {
    background: '#dc3545',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnSuccessSm: {
    background: '#198754',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 15,
  },

  // ── Tables ──
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    textAlign: 'left',
  },
  th: (isDark) => ({
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    padding: '10px 16px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),
  tr: (isDark, isEven) => ({
    background: isEven
      ? (isDark ? 'var(--bg-card)' : '#ffffff')
      : (isDark ? 'rgba(255,255,255,0.015)' : '#fafbfc'),
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
  }),
  td: (isDark) => ({
    padding: '11px 16px',
    color: isDark ? 'var(--text-main)' : '#212529',
    verticalAlign: 'middle',
  }),
  empty: (isDark) => ({
    padding: '36px',
    textAlign: 'center',
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    fontSize: 14,
  }),
  taskBadge: {
    background: '#e7f1ff',
    color: '#0d6efd',
    borderRadius: 6,
    padding: '2px 8px',
    fontWeight: 700,
    fontSize: 11,
  },
  settledBadge: {
    background: '#d1e7dd',
    color: '#0f5132',
    borderRadius: 12,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  pendingBadge: {
    background: '#fff3cd',
    color: '#664d03',
    borderRadius: 12,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  filterToolbar: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
    padding: '8px 14px',
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 10,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),
  loadingBox: (isDark) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    color: isDark ? 'var(--text-muted)' : '#6c757d',
  }),
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #dee2e6',
    borderTopColor: '#0d6efd',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  whatsAppSmBtn: {
    background: '#25D366',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    boxShadow: '0 2px 4px rgba(37, 211, 102, 0.25)',
    transition: 'opacity 0.15s ease, transform 0.1s ease',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
    padding: 16,
  },
  modalBox: (isDark) => ({
    background: isDark ? '#1e293b' : '#ffffff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 540,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
    border: `1px solid ${isDark ? '#334155' : '#dee2e6'}`,
    overflow: 'hidden',
  }),
  modalHeader: (isDark) => ({
    padding: '16px 20px',
    borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: isDark ? '#0f172a' : '#f8fafc',
  }),
  modalCloseBtn: (isDark) => ({
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: isDark ? '#94a3b8' : '#64748b',
    padding: '4px 8px',
    borderRadius: 6,
  }),
};
