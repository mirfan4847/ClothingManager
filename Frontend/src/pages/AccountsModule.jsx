import { useState, useEffect } from 'react';
import {
  getAccountSummary, getAccountCategories, getAccounts,
  createAccount, updateAccount, getTransactions, addTransaction, deleteTransaction
} from '../services/api';

const CAT_COLORS = { Income: '#70AD47', Expense: '#BE0000', Asset: '#2E75B6', Liability: '#C55A11', Cash: '#7030A0' };
const TABS = ['Overview', 'Accounts', 'Transactions', 'Ledger'];
const initAccForm = { name: '', categoryId: '', openingBalance: '', description: '' };
const initTxForm  = { accountId: '', type: 'Credit', amount: '', description: '', referenceNo: '', date: new Date().toISOString().split('T')[0] };

export default function AccountsModule() {
  const [tab, setTab]               = useState('Overview');
  const [summary, setSummary]       = useState(null);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts]     = useState([]);
  const [transactions, setTx]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showAccForm, setShowAccForm] = useState(false);
  const [showTxForm, setShowTxForm]   = useState(false);
  const [accForm, setAccForm]       = useState(initAccForm);
  const [txForm, setTxForm]         = useState(initTxForm);
  const [editAcc, setEditAcc]         = useState(null);
  const [filterAcc, setFilterAcc]     = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [groupedView, setGroupedView] = useState(true);
  const [collapsed, setCollapsed]     = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving]           = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [sum, cats, accs, txs] = await Promise.all([
        getAccountSummary(),
        getAccountCategories(),
        getAccounts(),
        getTransactions({}),
      ]);
      setSummary(sum);
      setCategories(cats);
      setAccounts(accs);
      setTx(txs);
    } catch (e) {
      setError('Failed to load data. Make sure the backend is running on http://localhost:5001');
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const fmt = (n) => 'PKR ' + Number(n || 0).toLocaleString();

  const saveAccount = async () => {
    if (!accForm.name || !accForm.categoryId) return;
    setSaving(true);
    try {
      if (editAcc) {
        await updateAccount(editAcc.id, { name: accForm.name, categoryId: Number(accForm.categoryId), description: accForm.description });
      } else {
        await createAccount({ name: accForm.name, categoryId: Number(accForm.categoryId), openingBalance: Number(accForm.openingBalance) || 0, description: accForm.description });
      }
      await loadAll();
      setShowAccForm(false); setAccForm(initAccForm); setEditAcc(null);
    } catch { setError('Failed to save account.'); }
    setSaving(false);
  };

  const saveTx = async () => {
    if (!txForm.accountId || !txForm.amount || !txForm.description) return;
    setSaving(true);
    try {
      await addTransaction({ accountId: Number(txForm.accountId), type: txForm.type, amount: Number(txForm.amount), description: txForm.description, referenceNo: txForm.referenceNo, date: new Date(txForm.date).toISOString() });
      await loadAll();
      setShowTxForm(false); setTxForm(initTxForm);
    } catch { setError('Failed to save transaction.'); }
    setSaving(false);
  };

  const handleDeleteTx = async (id) => {
    try {
      await deleteTransaction(id);
      await loadAll();
    } catch { setError('Failed to delete transaction.'); }
    setDeleteConfirm(null);
  };

  const filteredTx = transactions.filter(t => {
    if (filterAcc && t.accountId !== Number(filterAcc)) return false;
    if (filterCat) {
      const acc = accounts.find(a => a.id === t.accountId);
      if (!acc || acc.categoryName !== filterCat) return false;
    }
    return true;
  });

  const goToTx = (cat) => { setTab('Transactions'); setFilterCat(cat); setFilterAcc(''); };
  const goToAccounts = (cat) => { setTab('Accounts'); setFilterCat(cat); setFilterAcc(''); };

  if (loading) return <div style={s.loading}>⏳ Loading accounts data...</div>;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.headerLabel}>Accounts</div>
          <div style={s.headerTitle}>Finance</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={s.btn('#2E75B6')} onClick={() => { setShowAccForm(true); setEditAcc(null); setAccForm(initAccForm); }}>+ New Account</button>
          <button style={s.btn('#70AD47')} onClick={() => setShowTxForm(true)}>+ Add Transaction</button>
        </div>
      </div>

      {error && <div style={s.errorBar}>⚠️ {error} <button onClick={() => setError('')} style={s.errClose}>✕</button></div>}

      {/* Tabs */}
      <div style={s.tabRow}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }}>{t}</button>
        ))}
      </div>

      <div style={s.body}>

        {/* ── OVERVIEW ── */}
        {tab === 'Overview' && summary && (
          <div>
            <div style={s.statsRow}>
              {[
                { label: 'Total Income',      value: fmt(summary.totalIncome),      color: '#70AD47', bg: '#EEF6E6', icon: '📈', hint: 'View income transactions', onClick: () => goToTx('Income') },
                { label: 'Total Expense',     value: fmt(summary.totalExpense),     color: '#BE0000', bg: '#FBEAEA', icon: '📉', hint: 'View expense transactions', onClick: () => goToTx('Expense') },
                { label: 'Net Balance',       value: fmt(summary.netBalance),       color: summary.netBalance >= 0 ? '#2E75B6' : '#BE0000', bg: '#EBF3FB', icon: '💰', hint: 'View all transactions', onClick: () => goToTx('') },
                { label: 'Total Assets',      value: fmt(summary.totalAssets),      color: '#7030A0', bg: '#F3EEF8', icon: '🏦', hint: 'View asset accounts', onClick: () => goToAccounts('Asset') },
                { label: 'Total Liabilities', value: fmt(summary.totalLiabilities), color: '#C55A11', bg: '#FEF3EC', icon: '📋', hint: 'View liability accounts', onClick: () => goToAccounts('Liability') },
              ].map(st => (
                <div key={st.label}
                  onClick={st.onClick}
                  title={st.hint}
                  style={{ ...s.statCard, background: st.bg, borderLeft: `4px solid ${st.color}`, cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                >
                  <div style={{ fontSize: 26 }}>{st.icon}</div>
                  <div style={{ ...s.statNum, color: st.color }}>{st.value}</div>
                  <div style={s.statLabel}>{st.label}</div>
                  <div style={{ fontSize: 10, color: st.color, marginTop: 2, opacity: 0.7 }}>Click to view →</div>
                </div>
              ))}
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>Account Balances</div>
              <table style={s.table}>
                <thead><tr>{['Account', 'Category', 'Balance', 'Status'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {summary.accounts.map((a, i) => {
                    const isExpense = a.categoryName === 'Expense';
                    const dispBal   = isExpense ? Math.abs(a.balance) : a.balance;
                    const balColor  = isExpense ? '#BE0000' : (a.balance >= 0 ? '#70AD47' : '#BE0000');
                    return (
                      <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafd' }}>
                        <td style={s.td}><b>{a.name}</b></td>
                        <td style={s.td}><span style={{ ...s.pill, background: (CAT_COLORS[a.categoryName] || '#888') + '22', color: CAT_COLORS[a.categoryName] || '#888' }}>{a.categoryName}</span></td>
                        <td style={{ ...s.td, fontWeight: 700, color: balColor }}>{fmt(dispBal)}</td>
                        <td style={s.td}><span style={a.isActive ? s.active : s.inactive}>{a.isActive ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={s.cardTitle}>Recent Transactions</div>
                <button style={{ ...s.btn('#2E75B6'), fontSize: 12, padding: '5px 12px' }} onClick={() => { setTab('Transactions'); setFilterCat(''); setFilterAcc(''); }}>View All →</button>
              </div>
              <table style={s.table}>
                <thead><tr>{['Date', 'Account', 'Description', 'Ref No', 'Type', 'Amount', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {transactions.slice(0, 10).map((t, i) => (
                    <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafd' }}>
                      <td style={s.td}>{new Date(t.date).toLocaleDateString()}</td>
                      <td style={s.td}>{t.accountName}</td>
                      <td style={s.td}>{t.description}</td>
                      <td style={s.td}>{t.referenceNo || '—'}</td>
                      <td style={s.td}><span style={t.type === 'Credit' ? s.credit : s.debit}>{t.type}</span></td>
                      <td style={{ ...s.td, fontWeight: 700, color: t.type === 'Credit' ? '#70AD47' : '#BE0000' }}>{fmt(t.amount)}</td>
                      <td style={s.td}><button style={s.delBtn} onClick={() => setDeleteConfirm({ id: t.id, name: t.description })}>Del</button></td>
                    </tr>
                  ))}
                  {transactions.length === 0 && <tr><td colSpan={7} style={s.empty}>No transactions yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ACCOUNTS ── */}
        {tab === 'Accounts' && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={s.cardTitle}>{filterCat ? `${filterCat} Accounts` : 'All Accounts'}</div>
                {filterCat && (
                  <span style={{ background: CAT_COLORS[filterCat] + '22', color: CAT_COLORS[filterCat], borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => setFilterCat('')}>
                    {filterCat} ✕
                  </span>
                )}
              </div>
              <select style={s.filterSelect} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">All Categories</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
                <option value="Asset">Asset</option>
                <option value="Cash">Cash</option>
                <option value="Liability">Liability</option>
              </select>
            </div>
            <table style={s.table}>
              <thead><tr>{['#', 'Account Name', 'Category', 'Description', 'Balance', 'Status', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {accounts.filter(a => !filterCat || a.categoryName === filterCat).map((a, i) => {
                  const isExpense = a.categoryName === 'Expense';
                  const dispBal   = isExpense ? Math.abs(a.balance) : a.balance;
                  const balColor  = isExpense ? '#BE0000' : (a.balance >= 0 ? '#70AD47' : '#BE0000');
                  return (
                    <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafd' }}>
                      <td style={s.td}>{i + 1}</td>
                      <td style={s.td}><b>{a.name}</b></td>
                      <td style={s.td}><span style={{ ...s.pill, background: (CAT_COLORS[a.categoryName] || '#888') + '22', color: CAT_COLORS[a.categoryName] || '#888' }}>{a.categoryName}</span></td>
                      <td style={s.td}>{a.description || '—'}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: balColor }}>{fmt(dispBal)}</td>
                      <td style={s.td}><span style={a.isActive ? s.active : s.inactive}>{a.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td style={s.td}>
                        <button style={s.editBtn} onClick={() => { setEditAcc(a); setAccForm({ name: a.name, categoryId: a.categoryId, openingBalance: a.balance, description: a.description || '' }); setShowAccForm(true); }}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
                {accounts.length === 0 && <tr><td colSpan={7} style={s.empty}>No accounts yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TRANSACTIONS ── */}
        {tab === 'Transactions' && (() => {
          // Group key: for salary entries use worker name, otherwise use account name
          const groupKey = (t) => {
            const m = t.description?.match(/^Salary — (.+?) \(/);
            return m ? `👤 ${m[1]}` : `🏦 ${t.accountName}`;
          };
          const groups = {};
          filteredTx.forEach(t => {
            const k = groupKey(t);
            if (!groups[k]) groups[k] = [];
            groups[k].push(t);
          });
          const toggle = (k) => setCollapsed(c => ({ ...c, [k]: !c[k] }));
          const allOpen = Object.keys(groups).every(k => !collapsed[k]);

          return (
            <div style={s.card}>
              {/* Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={s.cardTitle}>{filterCat ? `${filterCat} Transactions` : 'All Transactions'}</div>
                  {filterCat && (
                    <span style={{ background: CAT_COLORS[filterCat] + '22', color: CAT_COLORS[filterCat], borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setFilterCat('')}>{filterCat} ✕</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => { if (allOpen) { const c = {}; Object.keys(groups).forEach(k => c[k] = true); setCollapsed(c); } else setCollapsed({}); }}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #dde3ec', background: '#f4f6f9', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    {allOpen ? '▲ Collapse All' : '▼ Expand All'}
                  </button>
                  <button onClick={() => setGroupedView(v => !v)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #dde3ec', background: groupedView ? '#2E75B6' : '#f4f6f9', color: groupedView ? '#fff' : '#333', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    {groupedView ? '⊞ Grouped' : '≡ Flat'}
                  </button>
                  <select style={s.filterSelect} value={filterCat} onChange={e => { setFilterCat(e.target.value); setFilterAcc(''); }}>
                    <option value="">All Categories</option>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                    <option value="Asset">Asset</option>
                    <option value="Cash">Cash</option>
                    <option value="Liability">Liability</option>
                  </select>
                  <select style={s.filterSelect} value={filterAcc} onChange={e => { setFilterAcc(e.target.value); setFilterCat(''); }}>
                    <option value="">All Accounts</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <table style={s.table}>
                <thead>
                  <tr>{['Date', 'Account / Name', 'Description', 'Ref No', 'Type', 'Amount', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredTx.length === 0 && <tr><td colSpan={7} style={s.empty}>No transactions found</td></tr>}

                  {groupedView
                    ? Object.entries(groups).map(([key, rows]) => {
                        const isOpen    = !collapsed[key];
                        const total     = rows.reduce((sum, t) => sum + (t.type === 'Credit' ? t.amount : -t.amount), 0);
                        const isSalary  = key.startsWith('👤');
                        const accentClr = isSalary ? '#7030A0' : '#2E75B6';
                        return [
                          // ── Group header row ──
                          <tr key={`hdr-${key}`}
                            onClick={() => toggle(key)}
                            style={{ background: accentClr, cursor: 'pointer', userSelect: 'none' }}>
                            <td colSpan={4} style={{ padding: '10px 14px', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                              <span style={{ marginRight: 10, fontSize: 16 }}>{isOpen ? '▼' : '▶'}</span>
                              {key}
                              <span style={{ marginLeft: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>
                                {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
                              </span>
                            </td>
                            <td colSpan={3} style={{ padding: '10px 14px', color: '#fff', fontWeight: 700, fontSize: 14, textAlign: 'right' }}>
                              <span style={{ marginRight: 16, opacity: 0.8, fontSize: 12 }}>Total:</span>
                              <span style={{ color: total >= 0 ? '#90EE90' : '#FFB3B3' }}>{total >= 0 ? '+' : ''}{fmt(total)}</span>
                            </td>
                          </tr>,
                          // ── Rows ──
                          ...(isOpen ? rows.map((t, i) => (
                            <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafd' }}>
                              <td style={{ ...s.td, paddingLeft: 32 }}>{new Date(t.date).toLocaleDateString()}</td>
                              <td style={s.td}>{t.accountName}</td>
                              <td style={s.td}>{t.description}</td>
                              <td style={s.td}>{t.referenceNo || '—'}</td>
                              <td style={s.td}><span style={t.type === 'Credit' ? s.credit : s.debit}>{t.type}</span></td>
                              <td style={{ ...s.td, fontWeight: 700, color: t.type === 'Credit' ? '#70AD47' : '#BE0000' }}>{fmt(t.amount)}</td>
                              <td style={s.td}><button style={s.delBtn} onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: t.id, name: t.description }); }}>Del</button></td>
                            </tr>
                          )) : [])
                        ];
                      })
                    : filteredTx.map((t, i) => (
                        <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafd' }}>
                          <td style={s.td}>{new Date(t.date).toLocaleDateString()}</td>
                          <td style={s.td}>{t.accountName}</td>
                          <td style={s.td}>{t.description}</td>
                          <td style={s.td}>{t.referenceNo || '—'}</td>
                          <td style={s.td}><span style={t.type === 'Credit' ? s.credit : s.debit}>{t.type}</span></td>
                          <td style={{ ...s.td, fontWeight: 700, color: t.type === 'Credit' ? '#70AD47' : '#BE0000' }}>{fmt(t.amount)}</td>
                          <td style={s.td}><button style={s.delBtn} onClick={() => setDeleteConfirm({ id: t.id, name: t.description })}>Del</button></td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* ── LEDGER ── */}
        {tab === 'Ledger' && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={s.cardTitle}>Ledger View</div>
              <select style={s.filterSelect} value={filterAcc} onChange={e => setFilterAcc(e.target.value)}>
                <option value="">-- Select Account --</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <table style={s.table}>
              <thead><tr>{['Date', 'Description', 'Ref No', 'Debit', 'Credit', 'Balance'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filteredTx.length === 0 && <tr><td colSpan={6} style={s.empty}>Select an account to view ledger</td></tr>}
                {(() => {
                  let bal = 0;
                  return filteredTx.map((t, i) => {
                    bal += t.type === 'Credit' ? t.amount : -t.amount;
                    return (
                      <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafd' }}>
                        <td style={s.td}>{new Date(t.date).toLocaleDateString()}</td>
                        <td style={s.td}>{t.description}</td>
                        <td style={s.td}>{t.referenceNo || '—'}</td>
                        <td style={{ ...s.td, color: '#BE0000', fontWeight: 600 }}>{t.type === 'Debit'  ? fmt(t.amount) : '—'}</td>
                        <td style={{ ...s.td, color: '#70AD47', fontWeight: 600 }}>{t.type === 'Credit' ? fmt(t.amount) : '—'}</td>
                        <td style={{ ...s.td, fontWeight: 700, color: bal >= 0 ? '#2E75B6' : '#BE0000' }}>{fmt(Math.abs(bal))}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Account Modal ── */}
      {showAccForm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>{editAcc ? 'Edit Account' : 'New Account'}</span>
              <button style={s.closeBtn} onClick={() => setShowAccForm(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.formGrid}>
                <div style={s.fg}><label style={s.label}>Account Name *</label><input style={s.input} placeholder="e.g. Main Cash" value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} /></div>
                <div style={s.fg}><label style={s.label}>Category *</label>
                  <select style={s.input} value={accForm.categoryId} onChange={e => setAccForm({ ...accForm, categoryId: e.target.value })}>
                    <option value="">-- Select --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                  </select>
                </div>
                {!editAcc && <div style={s.fg}><label style={s.label}>Opening Balance (PKR)</label><input type="number" style={s.input} placeholder="0" value={accForm.openingBalance} onChange={e => setAccForm({ ...accForm, openingBalance: e.target.value })} /></div>}
                <div style={s.fg}><label style={s.label}>Description</label><input style={s.input} placeholder="Optional" value={accForm.description} onChange={e => setAccForm({ ...accForm, description: e.target.value })} /></div>
              </div>
            </div>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setShowAccForm(false)}>Cancel</button>
              <button style={s.saveBtn} onClick={saveAccount} disabled={saving}>{saving ? 'Saving...' : editAcc ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Transaction Modal ── */}
      {showTxForm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>Add Transaction</span>
              <button style={s.closeBtn} onClick={() => setShowTxForm(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.formGrid}>
                <div style={s.fg}><label style={s.label}>Account *</label>
                  <select style={s.input} value={txForm.accountId} onChange={e => setTxForm({ ...txForm, accountId: e.target.value })}>
                    <option value="">-- Select Account --</option>
                    {accounts.filter(a => a.isActive).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div style={s.fg}><label style={s.label}>Type *</label>
                  <select style={s.input} value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })}>
                    <option value="Credit">Credit (Money In ↑)</option>
                    <option value="Debit">Debit (Money Out ↓)</option>
                  </select>
                </div>
                <div style={s.fg}><label style={s.label}>Amount (PKR) *</label><input type="number" style={s.input} placeholder="0" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} /></div>
                <div style={s.fg}><label style={s.label}>Reference No</label><input style={s.input} placeholder="e.g. REF001" value={txForm.referenceNo} onChange={e => setTxForm({ ...txForm, referenceNo: e.target.value })} /></div>
                <div style={s.fg}><label style={s.label}>Date *</label><input type="date" style={s.input} value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} /></div>
                <div style={s.fg}><label style={s.label}>Description *</label><input style={s.input} placeholder="Details..." value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })} /></div>
              </div>
            </div>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setShowTxForm(false)}>Cancel</button>
              <button style={s.saveBtn} onClick={saveTx} disabled={saving}>{saving ? 'Saving...' : 'Save Transaction'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 400 }}>
            <div style={{ ...s.modalHeader, background: '#BE0000' }}>
              <span style={s.modalTitle}>Confirm Delete</span>
              <button style={s.closeBtn} onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div style={{ padding: '1.5rem', fontSize: 15, color: '#444' }}>
              Delete transaction: <b>{deleteConfirm.name}</b>? This will reverse the balance.
            </div>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={{ ...s.saveBtn, background: '#BE0000' }} onClick={() => handleDeleteTx(deleteConfirm.id)}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page:        { fontFamily: "'Segoe UI', Arial, sans-serif", background: '#F4F6F9', minHeight: '100vh' },
  loading:     { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontSize: 18, color: '#888' },
  header:      { background: '#1e2a3b', padding: '1.2rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { color: '#7a9cc0', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: '1.4rem', fontWeight: 600 },
  btn:         (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }),
  errorBar:    { background: '#FBEAEA', color: '#BE0000', padding: '10px 2rem', display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #f5c6c6' },
  errClose:    { background: 'none', border: 'none', color: '#BE0000', cursor: 'pointer', fontSize: 16 },
  tabRow:      { background: '#fff', borderBottom: '2px solid #eef1f6', display: 'flex', padding: '0 2rem' },
  tabBtn:      { padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#777', borderBottom: '2px solid transparent', marginBottom: -2 },
  tabActive:   { color: '#2E75B6', borderBottom: '2px solid #2E75B6', fontWeight: 600 },
  body:        { padding: '1.5rem 2rem' },
  statsRow:    { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  statCard:    { borderRadius: 10, padding: '1rem 1.5rem', flex: 1, minWidth: 160, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 4 },
  statNum:     { fontSize: '1.2rem', fontWeight: 700 },
  statLabel:   { fontSize: 12, color: '#777' },
  card:        { background: '#fff', borderRadius: 10, padding: '1.2rem', marginBottom: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
  cardTitle:   { fontWeight: 600, fontSize: 15, color: '#1e2a3b', marginBottom: 12 },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { background: '#2E75B6', color: '#fff', padding: '10px 14px', textAlign: 'left', fontWeight: 500 },
  td:          { padding: '10px 14px', borderBottom: '1px solid #eef1f6', verticalAlign: 'middle' },
  empty:       { textAlign: 'center', padding: '2rem', color: '#aaa' },
  pill:        { borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600 },
  active:      { background: '#EEF6E6', color: '#4a8a1e', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 },
  inactive:    { background: '#FBEAEA', color: '#BE0000', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 },
  credit:      { background: '#EEF6E6', color: '#4a8a1e', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  debit:       { background: '#FBEAEA', color: '#BE0000', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  filterSelect:{ padding: '7px 12px', borderRadius: 6, border: '1px solid #dde3ec', fontSize: 13 },
  editBtn:     { background: '#70AD47', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  delBtn:      { background: '#BE0000', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:       { background: '#fff', borderRadius: 12, width: '90%', maxWidth: 600, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
  modalHeader: { background: '#1e2a3b', borderRadius: '12px 12px 0 0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle:  { color: '#fff', fontWeight: 600, fontSize: 16 },
  closeBtn:    { background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' },
  modalBody:   { padding: '1.5rem' },
  formGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  fg:          { display: 'flex', flexDirection: 'column', gap: 4 },
  label:       { fontSize: 12, fontWeight: 600, color: '#555' },
  input:       { padding: '9px 12px', borderRadius: 6, border: '1px solid #cdd5e0', fontSize: 14, outline: 'none' },
  modalFooter: { padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10 },
  cancelBtn:   { background: '#f0f2f5', color: '#555', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontSize: 14 },
  saveBtn:     { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 22px', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};
