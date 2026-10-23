import { useState, useEffect, useCallback } from 'react';
import {
  getAllStaff, getWageRates, upsertWageRate, deleteWageRate,
  calculateWages, calculateAllWages, getWageSummary, getWagePayments,
  createWagePayment, deleteWagePayment,
  getAdvances, createAdvance, settleAdvance, deleteAdvance, getAdvanceBalance,
  syncPayrollToFinance, cleanupFinanceDuplicates,
} from '../services/api';

const TASK_TYPES = ['Front', 'Bazo', 'Tape', 'Pocket', 'Gala', 'Lable', 'Moda', 'Quantity', 'TotalPiece'];
const TABS = ['Overview', 'Wage Rates', 'Calculate', 'Advances', 'Reports'];

const fmt     = (n) => 'PKR ' + Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK') : '—';
const today        = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

export default function WageModule() {
  const [tab, setTab]         = useState('Overview');
  const [workers, setWorkers] = useState([]);
  const [rates, setRates]     = useState([]);
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Wage Rates form
  const [rateForm, setRateForm]               = useState({ workerId: '', taskType: '', ratePerPiece: '' });
  const [rateWorkerFilter, setRateWorkerFilter] = useState('');

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
      const [ws, rs, sum, pmts, advs] = await Promise.all([
        getAllStaff(), getWageRates(), getWageSummary(), getWagePayments({}), getAdvances({}),
      ]);
      setWorkers(ws); setRates(rs); setSummary(sum); setPayments(pmts); setAdvances(advs);
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

  // ── Calculate handlers ─────────────────────────────────────────────────

  const handleCalculate = async () => {
    if (!calcForm.workerId || !calcForm.from || !calcForm.to) return;
    setCalcLoading(true);
    setCalcResult(null);
    setAdvBalance(null);
    setShowPayForm(false);
    setPayAmount('');
    setPayDeduction('');
    setPayNotes('');
    setPayAsAdvance(false);
    try {
      const [result, balance] = await Promise.all([
        calculateWages(calcForm.workerId, calcForm.from, calcForm.to),
        getAdvanceBalance(calcForm.workerId),
      ]);
      setCalcResult(result);
      setAdvBalance(balance);
      const from = new Date(calcForm.from);
      const to   = new Date(calcForm.to);
      const alreadyPaid = payments
        .filter(p => p.workerId === Number(calcForm.workerId)
                  && new Date(p.periodTo)   >= from
                  && new Date(p.periodFrom) <= to)
        .reduce((sum, p) => sum + p.grossAmount, 0);
      setPayAmount(String(Math.max(0, result.grossAmount - alreadyPaid)));
    } catch { setError('Calculation failed. Check backend connection.'); }
    setCalcLoading(false);
  };

  const handleRecordPayment = async () => {
    if (!calcResult) return;
    setSaving(true);
    const paying     = Number(payAmount) || 0;
    const deductions = Number(payDeduction) || 0;
    try {
      await createWagePayment({
        workerId:    calcResult.workerId,
        grossAmount: paying,
        deductions,
        netAmount:   paying - deductions,
        notes:       payNotes || null,
        periodFrom:  new Date(calcForm.from).toISOString(),
        periodTo:    new Date(calcForm.to).toISOString(),
        paidAt:      new Date().toISOString(),
      });
      if (payAsAdvance && paying > 0) {
        await createAdvance({
          workerId:    calcResult.workerId,
          amount:      paying,
          notes:       payNotes ? `[Advance] ${payNotes}` : 'Advance (bonus/extra payment)',
          advanceDate: new Date().toISOString(),
        });
      }
      await loadAll();
      setShowPayForm(false);
      setCalcResult(null);
      setAdvBalance(null);
      setPayAsAdvance(false);
    } catch { setError('Failed to record payment.'); }
    setSaving(false);
  };

  // ── Advance handlers ───────────────────────────────────────────────────

  const handleAdvanceSubmit = async () => {
    if (!advForm.workerId || !advForm.amount) return;
    setSaving(true);
    try {
      await createAdvance({
        workerId:    Number(advForm.workerId),
        amount:      Number(advForm.amount),
        notes:       advForm.notes || null,
        advanceDate: new Date(advForm.advanceDate).toISOString(),
      });
      setAdvForm({ workerId: '', amount: '', notes: '', advanceDate: today() });
      setAdvances(await getAdvances({}));
      setSummary(await getWageSummary());
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

  if (loading) return <div style={s.loading}>Loading wage data…</div>;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.headerLabel}>Salary</div>
          <div style={s.headerTitle}>Payroll</div>
        </div>
      </div>

      {error && (
        <div style={s.errorBanner}>
          {error}
          <button onClick={() => setError('')} style={s.closeBtn}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabBar}>
        {TABS.map(t => (
          <button key={t} style={s.tabBtn(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div style={s.content}>

        {/* ── OVERVIEW ──────────────────────────────────────────────── */}
        {tab === 'Overview' && summary && (
          <div>
            <div style={s.cardGrid}>
              <StatCard label="Total Gross Paid"        value={fmt(summary.totalPaid)}                color="#2E75B6" />
              <StatCard label="Total Deductions"        value={fmt(summary.totalDeductions)}          color="#BE0000" />
              <StatCard label="Total Net Paid"          value={fmt(summary.totalNet)}                 color="#70AD47" />
              <StatCard label="Total Payments"          value={summary.totalPayments}                 color="#C55A11" />
              <StatCard label="Outstanding Advances"    value={fmt(summary.totalOutstandingAdvances)} color="#7030A0" />
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, color: '#15803d', fontSize: 14 }}>📊 Finance Integration</div>
                <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>New payments auto-record in Finance. Each salary uses a unique reference (like lot numbers) to prevent duplicates.</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{ background: '#BE0000', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', opacity: syncing ? 0.7 : 1 }}
                  disabled={syncing}
                  onClick={async () => {
                    if (!window.confirm('This will remove duplicate salary entries in Finance (keeps one per worker per period). Continue?')) return;
                    setSyncing(true);
                    try {
                      const r = await cleanupFinanceDuplicates();
                      alert(r.message);
                      await loadAll();
                    } catch { alert('Cleanup failed. Make sure backend is running.'); }
                    setSyncing(false);
                  }}>
                  {syncing ? '⏳ Working…' : '🧹 Fix Duplicate Finance Entries'}
                </button>
                <button
                  style={{ background: '#15803d', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', opacity: syncing ? 0.7 : 1 }}
                  disabled={syncing}
                  onClick={async () => {
                    setSyncing(true);
                    try {
                      const r = await syncPayrollToFinance();
                      alert(r.message);
                    } catch { alert('Sync failed. Make sure backend is running.'); }
                    setSyncing(false);
                  }}>
                  {syncing ? '⏳ Syncing…' : '🔄 Sync Past Payroll to Finance'}
                </button>
              </div>
            </div>

            <div style={s.sectionTitle}>Recent Payments</div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>{['Worker','Period','Amount Paid','Adv. Deduction','Net to Worker','Paid On'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {summary.recentPayments.length === 0
                    ? <tr><td colSpan={6} style={s.empty}>No payments yet.</td></tr>
                    : summary.recentPayments.map(p => (
                      <tr key={p.id} style={s.tr}>
                        <td style={s.td}><b>{p.workerName}</b></td>
                        <td style={s.td}>{fmtDate(p.periodFrom)} – {fmtDate(p.periodTo)}</td>
                        <td style={s.td}>{fmt(p.grossAmount)}</td>
                        <td style={{ ...s.td, color: '#BE0000' }}>{fmt(p.deductions)}</td>
                        <td style={{ ...s.td, color: '#70AD47', fontWeight: 700 }}>{fmt(p.netAmount)}</td>
                        <td style={s.td}>{fmtDate(p.paidAt)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── WAGE RATES ────────────────────────────────────────────── */}
        {tab === 'Wage Rates' && (
          <div>
            <div style={s.card}>
              <div style={s.cardTitle}>Set / Update Rate</div>
              <div style={s.formRow}>
                <select style={s.select} value={rateForm.workerId}
                  onChange={e => setRateForm(f => ({ ...f, workerId: e.target.value }))}>
                  <option value="">— Select Worker —</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <select style={s.select} value={rateForm.taskType}
                  onChange={e => setRateForm(f => ({ ...f, taskType: e.target.value }))}>
                  <option value="">— Select Task —</option>
                  {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input style={s.input} type="number" min="0" step="0.01"
                  placeholder="Rate per piece (PKR)"
                  value={rateForm.ratePerPiece}
                  onChange={e => setRateForm(f => ({ ...f, ratePerPiece: e.target.value }))} />
                <button style={s.btn('#2E75B6')} onClick={handleRateSubmit} disabled={saving}>
                  {saving ? '…' : 'Save Rate'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: '#444' }}>Filter by worker:</span>
              <select style={{ ...s.select, maxWidth: 220 }} value={rateWorkerFilter}
                onChange={e => setRateWorkerFilter(e.target.value)}>
                <option value="">All Workers</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>{['Worker','Task Type','Rate / Piece','Last Updated','Action'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredRates.length === 0
                    ? <tr><td colSpan={5} style={s.empty}>No rates configured.</td></tr>
                    : filteredRates.map(r => (
                      <tr key={r.id} style={s.tr}>
                        <td style={s.td}>{r.workerName}</td>
                        <td style={s.td}><span style={s.badge}>{r.taskType}</span></td>
                        <td style={{ ...s.td, fontWeight: 700, color: '#2E75B6' }}>{fmt(r.ratePerPiece)}</td>
                        <td style={s.td}>{fmtDate(r.updatedAt)}</td>
                        <td style={s.td}>
                          {deleteConfirm === `rate-${r.id}` ? (
                            <>
                              <button style={s.btn('#BE0000')} onClick={() => handleDeleteRate(r.id)}>Confirm</button>
                              <button style={{ ...s.btn('#888'), marginLeft: 6 }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                            </>
                          ) : (
                            <button style={s.iconBtn} onClick={() => setDeleteConfirm(`rate-${r.id}`)}>🗑️</button>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CALCULATE (single worker) ──────────────────────────────── */}
        {tab === 'Calculate' && (
          <div>
            <div style={s.card}>
              <div style={s.cardTitle}>Calculate Worker Wages</div>
              <div style={s.formRow}>
                <select style={s.select} value={calcForm.workerId}
                  onChange={e => setCalcForm(f => ({ ...f, workerId: e.target.value }))}>
                  <option value="">— Select Worker —</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label style={s.label}>From</label>
                  <input style={s.input} type="date" value={calcForm.from}
                    onChange={e => setCalcForm(f => ({ ...f, from: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label style={s.label}>To</label>
                  <input style={s.input} type="date" value={calcForm.to}
                    onChange={e => setCalcForm(f => ({ ...f, to: e.target.value }))} />
                </div>
                <button style={s.btn('#2E75B6')} onClick={handleCalculate} disabled={calcLoading}>
                  {calcLoading ? 'Calculating…' : 'Calculate'}
                </button>
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
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={s.cardTitle}>{calcResult.workerName}</div>
                    <div style={{ color: '#888', fontSize: 13 }}>
                      {fmtDate(calcResult.periodFrom)} – {fmtDate(calcResult.periodTo)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: '#888' }}>Total Gross</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#2E75B6' }}>{fmt(calcResult.grossAmount)}</div>
                    </div>
                    {alreadyPaid > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#888' }}>Already Paid</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#BE0000' }}>{fmt(alreadyPaid)}</div>
                      </div>
                    )}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: '#888' }}>Remaining Balance</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: remaining > 0 ? '#70AD47' : remaining < 0 ? '#BE0000' : '#aaa' }}>
                        {remaining < 0 ? `- ${fmt(Math.abs(remaining))}` : fmt(remaining)}
                      </div>
                    </div>
                  </div>
                </div>

                {calcResult.breakdown.length === 0 ? (
                  <div style={s.empty}>No entries found for this period, or no wage rates configured.</div>
                ) : (
                  <table style={s.table}>
                    <thead>
                      <tr>{['Task','Pieces','Rate / Piece','Amount'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {calcResult.breakdown.map(b => (
                        <tr key={b.taskType} style={s.tr}>
                          <td style={s.td}><span style={s.badge}>{b.taskType}</span></td>
                          <td style={s.td}>{b.totalPieces.toLocaleString()}</td>
                          <td style={s.td}>{fmt(b.ratePerPiece)}</td>
                          <td style={{ ...s.td, fontWeight: 700, color: '#2E75B6' }}>{fmt(b.amount)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} style={{ ...s.td, fontWeight: 700, textAlign: 'right' }}>GROSS TOTAL</td>
                        <td style={{ ...s.td, fontWeight: 800, color: '#70AD47', fontSize: 15 }}>{fmt(calcResult.grossAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* Advance balance section */}
                {advBalance && advBalance.pendingBalance > 0 && (
                  <div style={{ marginTop: 14, padding: 12, background: '#f9f0ff', borderRadius: 8, border: '1px solid #d9b3ff' }}>
                    <div style={{ fontWeight: 700, color: '#7030A0', marginBottom: 6 }}>
                      Outstanding Advances — {fmt(advBalance.pendingBalance)}
                    </div>
                    {advBalance.unsettledAdvances.map(a => (
                      <div key={a.id} style={{ fontSize: 13, color: '#555', marginBottom: 3 }}>
                        {fmtDate(a.advanceDate)} — {fmt(a.amount)}{a.notes ? ` (${a.notes})` : ''}
                      </div>
                    ))}
                  </div>
                )}

                {remaining <= 0 && !showPayForm ? (
                  <div style={{ marginTop: 14 }}>
                    {remaining < 0 ? (
                      <div style={{ padding: 12, background: '#fff3f3', borderRadius: 8, border: '1px solid #f5c6cb', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, color: '#BE0000', fontSize: 14 }}>
                          ⚠️ Overpaid by {fmt(Math.abs(remaining))}
                        </div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                          PKR {Math.abs(remaining).toLocaleString()} extra was paid above gross wages. Deduct this from the next period's salary.
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 12, background: '#e8f5e9', borderRadius: 8, color: '#388e3c', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                        ✓ Fully paid for this period
                      </div>
                    )}
                    <button style={s.btn('#C55A11')} onClick={() => {
                      setShowPayForm(true);
                      setPayAmount('');
                      setPayDeduction('');
                      setPayNotes('');
                      setPayAsAdvance(true);
                    }}>
                      + Add Bonus / Extra Payment
                    </button>
                  </div>
                ) : !showPayForm ? (
                  <div style={{ marginTop: 14 }}>
                    <button style={s.btn('#70AD47')} onClick={() => {
                      setShowPayForm(true);
                      if (advBalance?.pendingBalance) setPayDeduction(String(advBalance.pendingBalance));
                    }}>
                      Record as Payment
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 14, padding: 14, background: '#f0f7ee', borderRadius: 8, border: '1px solid #c6e0b4' }}>
                    <div style={s.cardTitle}>Record Payment</div>
                    <div style={s.formRow}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <label style={s.label}>Amount Paying Now (PKR)</label>
                        <input style={s.input} type="number" min="0" step="0.01" placeholder="0"
                          value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <label style={s.label}>Advance Deduction (PKR)</label>
                        <input style={s.input} type="number" min="0" step="0.01" placeholder="0"
                          value={payDeduction} onChange={e => setPayDeduction(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <label style={s.label}>Notes (optional)</label>
                        <input style={s.input} type="text" placeholder="e.g. 30-4-26"
                          value={payNotes} onChange={e => setPayNotes(e.target.value)} />
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, cursor: 'pointer', userSelect: 'none', padding: '10px 14px', background: payAsAdvance ? '#fff8f0' : '#f8f9fa', border: `1.5px solid ${payAsAdvance ? '#C55A11' : '#d1d9e6'}`, borderRadius: 8 }}>
                      <input type="checkbox" checked={payAsAdvance} onChange={e => setPayAsAdvance(e.target.checked)}
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#C55A11' }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: payAsAdvance ? '#C55A11' : '#666' }}>
                          Deduct from future salary
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          Records this as an advance — will be deducted automatically when calculating next wages
                        </div>
                      </div>
                    </label>
                    <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', border: '1px solid #86efac', marginTop: 8, fontSize: 12, color: '#15803d' }}>
                      📊 This payment will automatically be recorded in Finance under <strong>Salary &amp; Wages</strong>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 14 }}>
                      Net to Worker: <strong style={{ color: '#70AD47', fontSize: 16 }}>
                        {fmt((Number(payAmount) || 0) - (Number(payDeduction) || 0))}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button style={s.btn('#70AD47')} onClick={handleRecordPayment} disabled={saving}>
                        {saving ? '…' : 'Confirm Payment'}
                      </button>
                      <button style={s.btn('#888')} onClick={() => setShowPayForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}

            {/* Payment history for selected worker */}
            {calcForm.workerId && (
              <div>
                <div style={s.sectionTitle}>Payment History — {workers.find(w => w.id === Number(calcForm.workerId))?.name}</div>
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>{['Period','Amount Paid','Advance Deduction','Net to Worker','Paid On','Notes'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {payments.filter(p => p.workerId === Number(calcForm.workerId)).length === 0
                        ? <tr><td colSpan={6} style={s.empty}>No payment history.</td></tr>
                        : payments.filter(p => p.workerId === Number(calcForm.workerId)).map(p => (
                          <tr key={p.id} style={s.tr}>
                            <td style={s.td}>{fmtDate(p.periodFrom)} – {fmtDate(p.periodTo)}</td>
                            <td style={s.td}>{fmt(p.grossAmount)}</td>
                            <td style={{ ...s.td, color: '#BE0000' }}>{fmt(p.deductions)}</td>
                            <td style={{ ...s.td, color: '#70AD47', fontWeight: 700 }}>{fmt(p.netAmount)}</td>
                            <td style={s.td}>{fmtDate(p.paidAt)}</td>
                            <td style={{ ...s.td, color: '#888', fontSize: 12 }}>{p.notes || '—'}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ADVANCES ──────────────────────────────────────────────── */}
        {tab === 'Advances' && (
          <div>
            {/* Add advance form */}
            <div style={s.card}>
              <div style={s.cardTitle}>Record Advance</div>
              <div style={s.formRow}>
                <select style={s.select} value={advForm.workerId}
                  onChange={e => setAdvForm(f => ({ ...f, workerId: e.target.value }))}>
                  <option value="">— Select Worker —</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <input style={s.input} type="number" min="0" step="0.01" placeholder="Amount (PKR)"
                  value={advForm.amount}
                  onChange={e => setAdvForm(f => ({ ...f, amount: e.target.value }))} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label style={s.label}>Date</label>
                  <input style={s.input} type="date" value={advForm.advanceDate}
                    onChange={e => setAdvForm(f => ({ ...f, advanceDate: e.target.value }))} />
                </div>
                <input style={{ ...s.input, flex: 1 }} type="text" placeholder="Notes (optional)"
                  value={advForm.notes}
                  onChange={e => setAdvForm(f => ({ ...f, notes: e.target.value }))} />
                <button style={s.btn('#7030A0')} onClick={handleAdvanceSubmit} disabled={saving}>
                  {saving ? '…' : 'Record Advance'}
                </button>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <select style={{ ...s.select, maxWidth: 200 }} value={advWorkerFilter}
                onChange={e => setAdvWorkerFilter(e.target.value)}>
                <option value="">All Workers</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select style={{ ...s.select, maxWidth: 160 }} value={advSettledFilter}
                onChange={e => setAdvSettledFilter(e.target.value)}>
                <option value="all">All Advances</option>
                <option value="unsettled">Unsettled</option>
                <option value="settled">Settled</option>
              </select>
              <span style={{ fontSize: 13, color: '#888' }}>{filteredAdvances.length} record(s)</span>
            </div>

            {/* Summary pills */}
            {filteredAdvances.length > 0 && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <SummaryPill label="Total" value={fmt(filteredAdvances.reduce((a, x) => a + x.amount, 0))} color="#7030A0" />
                <SummaryPill label="Unsettled" value={fmt(filteredAdvances.filter(x => !x.isSettled).reduce((a, x) => a + x.amount, 0))} color="#BE0000" />
                <SummaryPill label="Settled" value={fmt(filteredAdvances.filter(x => x.isSettled).reduce((a, x) => a + x.amount, 0))} color="#70AD47" />
              </div>
            )}

            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>{['Worker','Amount','Date','Notes','Status','Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredAdvances.length === 0
                    ? <tr><td colSpan={6} style={s.empty}>No advances found.</td></tr>
                    : filteredAdvances.map(a => (
                      <tr key={a.id} style={s.tr}>
                        <td style={s.td}><b>{a.workerName}</b></td>
                        <td style={{ ...s.td, fontWeight: 700, color: '#7030A0' }}>{fmt(a.amount)}</td>
                        <td style={s.td}>{fmtDate(a.advanceDate)}</td>
                        <td style={{ ...s.td, color: '#888', fontSize: 12 }}>{a.notes || '—'}</td>
                        <td style={s.td}>
                          <span style={{
                            ...s.badge,
                            background: a.isSettled ? '#e8f5e9' : '#fff3e0',
                            color: a.isSettled ? '#388e3c' : '#e65100',
                          }}>
                            {a.isSettled ? `Settled ${fmtDate(a.settledAt)}` : 'Pending'}
                          </span>
                        </td>
                        <td style={s.td}>
                          {deleteConfirm === `adv-${a.id}` ? (
                            <>
                              {!a.isSettled && (
                                <button style={{ ...s.btn('#70AD47'), marginRight: 4 }}
                                  onClick={() => handleSettleAdvance(a.id)}>Mark Settled</button>
                              )}
                              <button style={s.btn('#BE0000')} onClick={() => handleDeleteAdvance(a.id)}>Delete</button>
                              <button style={{ ...s.btn('#888'), marginLeft: 4 }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                            </>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              {!a.isSettled && (
                                <button style={{ ...s.btn('#70AD47'), padding: '5px 12px', fontSize: 12 }}
                                  onClick={() => handleSettleAdvance(a.id)}>Settle</button>
                              )}
                              <button style={s.iconBtn} onClick={() => setDeleteConfirm(`adv-${a.id}`)}>🗑️</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REPORTS (all workers) ──────────────────────────────────── */}
        {tab === 'Reports' && (
          <div>
            <div style={s.card}>
              <div style={s.cardTitle}>All-Workers Wage Report</div>
              <div style={s.formRow}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label style={s.label}>From</label>
                  <input style={s.input} type="date" value={reportForm.from}
                    onChange={e => setReportForm(f => ({ ...f, from: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label style={s.label}>To</label>
                  <input style={s.input} type="date" value={reportForm.to}
                    onChange={e => setReportForm(f => ({ ...f, to: e.target.value }))} />
                </div>
                <button style={s.btn('#2E75B6')} onClick={handleReport} disabled={reportLoading}>
                  {reportLoading ? 'Calculating…' : 'Generate Report'}
                </button>
              </div>
            </div>

            {reportResult && (
              <div>
                {/* Summary bar */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <StatCard label="Period" value={`${fmtDate(reportResult.periodFrom)} – ${fmtDate(reportResult.periodTo)}`} color="#555" />
                  <StatCard label="Workers with Wages" value={reportResult.workerCount} color="#2E75B6" />
                  <StatCard label="Total Gross" value={fmt(reportResult.totalGross)} color="#70AD47" />
                </div>

                {reportResult.workers.length === 0 ? (
                  <div style={{ ...s.card, textAlign: 'center', color: '#aaa', padding: 40 }}>
                    No wages found for this period. Check that wage rates are configured and entries exist.
                  </div>
                ) : (
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>{['Worker','Tasks','Total Pieces','Gross Amount','% of Total','Details'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {reportResult.workers.map(w => (
                          <>
                            <tr key={w.workerId} style={{ ...s.tr, background: expandedWorker === w.workerId ? '#f0f7ee' : undefined }}>
                              <td style={s.td}><b>{w.workerName}</b></td>
                              <td style={s.td}>{w.breakdown.length}</td>
                              <td style={s.td}>{w.breakdown.reduce((a, b) => a + b.totalPieces, 0).toLocaleString()}</td>
                              <td style={{ ...s.td, fontWeight: 700, color: '#70AD47' }}>{fmt(w.grossAmount)}</td>
                              <td style={s.td}>
                                {reportResult.totalGross > 0
                                  ? `${((w.grossAmount / reportResult.totalGross) * 100).toFixed(1)}%`
                                  : '—'}
                              </td>
                              <td style={s.td}>
                                <button style={{ ...s.btn(expandedWorker === w.workerId ? '#555' : '#2E75B6'), padding: '4px 12px', fontSize: 12 }}
                                  onClick={() => setExpandedWorker(x => x === w.workerId ? null : w.workerId)}>
                                  {expandedWorker === w.workerId ? 'Hide' : 'Show'}
                                </button>
                              </td>
                            </tr>
                            {expandedWorker === w.workerId && w.breakdown.map(b => (
                              <tr key={`${w.workerId}-${b.taskType}`} style={{ background: '#f8fff8' }}>
                                <td style={{ ...s.td, paddingLeft: 32, color: '#888' }} colSpan={2}>
                                  <span style={s.badge}>{b.taskType}</span>
                                </td>
                                <td style={{ ...s.td, color: '#555' }}>{b.totalPieces.toLocaleString()} pcs × {fmt(b.ratePerPiece)}</td>
                                <td style={{ ...s.td, color: '#2E75B6', fontWeight: 600 }}>{fmt(b.amount)}</td>
                                <td colSpan={2} />
                              </tr>
                            ))}
                          </>
                        ))}
                        <tr style={{ background: '#e8f5e9' }}>
                          <td colSpan={3} style={{ ...s.td, fontWeight: 700, textAlign: 'right' }}>GRAND TOTAL</td>
                          <td style={{ ...s.td, fontWeight: 800, color: '#388e3c', fontSize: 15 }}>{fmt(reportResult.totalGross)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* All Payments table */}
            <div style={{ marginTop: 28 }}>
              <div style={s.sectionTitle}>All Payment Records</div>
              <div style={s.card}>
                <div style={s.formRow}>
                  <select style={s.select} value={payFilter.workerId}
                    onChange={e => setPayFilter(f => ({ ...f, workerId: e.target.value }))}>
                    <option value="">All Workers</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <label style={s.label}>From</label>
                    <input style={s.input} type="date" value={payFilter.from}
                      onChange={e => setPayFilter(f => ({ ...f, from: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <label style={s.label}>To</label>
                    <input style={s.input} type="date" value={payFilter.to}
                      onChange={e => setPayFilter(f => ({ ...f, to: e.target.value }))} />
                  </div>
                  <button style={s.btn('#888')} onClick={() => setPayFilter({ workerId: '', from: '', to: '' })}>Clear</button>
                </div>
              </div>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>{['#','Worker','Period','Gross','Deductions','Net','Paid On','Notes',''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredPayments.length === 0
                      ? <tr><td colSpan={9} style={s.empty}>No payments found.</td></tr>
                      : filteredPayments.map((p, i) => (
                        <tr key={p.id} style={s.tr}>
                          <td style={{ ...s.td, color: '#aaa' }}>{i + 1}</td>
                          <td style={s.td}><b>{p.workerName}</b></td>
                          <td style={s.td}>{fmtDate(p.periodFrom)} – {fmtDate(p.periodTo)}</td>
                          <td style={s.td}>{fmt(p.grossAmount)}</td>
                          <td style={{ ...s.td, color: '#BE0000' }}>{fmt(p.deductions)}</td>
                          <td style={{ ...s.td, color: '#70AD47', fontWeight: 700 }}>{fmt(p.netAmount)}</td>
                          <td style={s.td}>{fmtDate(p.paidAt)}</td>
                          <td style={{ ...s.td, color: '#888', fontSize: 12 }}>{p.notes || '—'}</td>
                          <td style={s.td}>
                            {deleteConfirm === `pay-${p.id}` ? (
                              <>
                                <button style={s.btn('#BE0000')} onClick={async () => {
                                  try { await deleteWagePayment(p.id); setPayments(x => x.filter(y => y.id !== p.id)); }
                                  catch { setError('Failed to delete payment.'); }
                                  setDeleteConfirm(null);
                                }}>Confirm</button>
                                <button style={{ ...s.btn('#888'), marginLeft: 6 }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                              </>
                            ) : (
                              <button style={s.iconBtn} onClick={() => setDeleteConfirm(`pay-${p.id}`)}>🗑️</button>
                            )}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
              {filteredPayments.length > 0 && (
                <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                  <SummaryPill label="Gross"      value={fmt(filteredPayments.reduce((a, p) => a + p.grossAmount, 0))} color="#2E75B6" />
                  <SummaryPill label="Deductions" value={fmt(filteredPayments.reduce((a, p) => a + p.deductions, 0))}  color="#BE0000" />
                  <SummaryPill label="Net"        value={fmt(filteredPayments.reduce((a, p) => a + p.netAmount, 0))}   color="#70AD47" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 2px 8px #0001', borderTop: `4px solid ${color}`, minWidth: 150 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SummaryPill({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${color}`, borderRadius: 8, padding: '6px 18px', fontSize: 13 }}>
      <span style={{ color: '#888' }}>{label}: </span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  page:        { padding: '24px', fontFamily: 'Segoe UI, Arial, sans-serif', minHeight: '100vh' },
  loading:     { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', fontSize: 18, color: '#888' },
  header:      { background: 'linear-gradient(135deg,#1e2a3b,#2E75B6)', borderRadius: 12, padding: '20px 28px', marginBottom: 20, color: '#fff' },
  headerLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, opacity: 0.7 },
  headerTitle: { fontSize: 24, fontWeight: 800, marginTop: 4 },
  errorBanner: { background: '#fff3f3', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#BE0000', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: '#BE0000', fontSize: 16 },
  tabBar:      { display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' },
  tabBtn:      (a) => ({ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, background: a ? '#2E75B6' : '#e8eef5', color: a ? '#fff' : '#444', transition: 'all .15s' }),
  content:     {},
  cardGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 24 },
  card:        { background: '#fff', borderRadius: 10, padding: '18px 20px', boxShadow: '0 2px 8px #0001', marginBottom: 20 },
  cardTitle:   { fontWeight: 700, fontSize: 15, color: '#1e2a3b', marginBottom: 12 },
  sectionTitle:{ fontWeight: 700, fontSize: 15, color: '#444', margin: '16px 0 10px' },
  formRow:     { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' },
  label:       { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  select:      { padding: '9px 12px', borderRadius: 7, border: '1px solid #d1d9e6', fontSize: 13, background: '#fff', minWidth: 160 },
  input:       { padding: '9px 12px', borderRadius: 7, border: '1px solid #d1d9e6', fontSize: 13, minWidth: 140 },
  btn:         (c) => ({ padding: '9px 18px', background: c, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: 13 }),
  iconBtn:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 },
  tableWrap:   { overflowX: 'auto', background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px #0001' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { background: '#1e2a3b', color: '#fff', padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' },
  tr:          { borderBottom: '1px solid #f0f0f0' },
  td:          { padding: '10px 14px', color: '#333', verticalAlign: 'middle' },
  empty:       { padding: '30px', textAlign: 'center', color: '#aaa' },
  badge:       { background: '#e8eef5', color: '#2E75B6', borderRadius: 5, padding: '2px 8px', fontWeight: 600, fontSize: 12 },
};
