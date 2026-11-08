import { useState, useEffect } from 'react';
import {
  getAccountSummary, getAccountCategories, getAccounts,
  createAccount, updateAccount, getTransactions, addTransaction, deleteTransaction
} from '../services/api';
import { useTheme } from '../context/ThemeContext';

// ── Bootstrap Category Palette ──
const CAT_COLORS = {
  Income:    { bg: '#d1e7dd', color: '#0f5132', border: '#badbcc' },
  Expense:   { bg: '#f8d7da', color: '#842029', border: '#f5c2c7' },
  Asset:     { bg: '#cfe2ff', color: '#084298', border: '#b6d4fe' },
  Liability: { bg: '#fff3cd', color: '#664d03', border: '#ffecb5' },
  Cash:      { bg: '#cff4fc', color: '#055160', border: '#b6effb' },
};

const TABS = [
  { key: 'Overview',     icon: '📊', label: 'Overview' },
  { key: 'Accounts',     icon: '🏦', label: 'Accounts' },
  { key: 'Transactions', icon: '🧾', label: 'Transactions' },
  { key: 'Ledger',       icon: '📑', label: 'Ledger' },
];

const initAccForm = { name: '', categoryId: '', openingBalance: '', description: '' };
const initTxForm  = { accountId: '', type: 'Credit', amount: '', description: '', referenceNo: '', date: new Date().toISOString().split('T')[0] };

export default function AccountsModule() {
  const { isDark, currentColor } = useTheme();

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
      setError('Failed to load financial data. Ensure the backend is active.');
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const fmt = (n) => 'PKR ' + Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const saveAccount = async () => {
    if (!accForm.name || !accForm.categoryId) return;
    setSaving(true);
    try {
      if (editAcc) {
        await updateAccount(editAcc.id, {
          name: accForm.name,
          categoryId: Number(accForm.categoryId),
          description: accForm.description,
        });
      } else {
        await createAccount({
          name: accForm.name,
          categoryId: Number(accForm.categoryId),
          openingBalance: Number(accForm.openingBalance) || 0,
          description: accForm.description,
        });
      }
      setShowAccForm(false);
      setAccForm(initAccForm);
      setEditAcc(null);
      await loadAll();
    } catch {
      setError('Failed to save account.');
    }
    setSaving(false);
  };

  const saveTx = async () => {
    if (!txForm.accountId || !txForm.amount || !txForm.description) return;
    setSaving(true);
    try {
      await addTransaction({
        accountId: Number(txForm.accountId),
        type: txForm.type,
        amount: Number(txForm.amount),
        description: txForm.description,
        referenceNo: txForm.referenceNo || null,
        date: new Date(txForm.date).toISOString(),
      });
      setShowTxForm(false);
      setTxForm(initTxForm);
      await loadAll();
    } catch {
      setError('Failed to record transaction.');
    }
    setSaving(false);
  };

  const handleDeleteTx = async (id) => {
    try {
      await deleteTransaction(id);
      setDeleteConfirm(null);
      await loadAll();
    } catch {
      setError('Failed to delete transaction.');
    }
  };

  const goToTx = (catName) => {
    setTab('Transactions');
    setFilterCat(catName);
    setFilterAcc('');
  };

  const goToAccounts = (cat) => {
    setTab('Accounts');
    setFilterCat(cat);
    setFilterAcc('');
  };

  if (loading) {
    return (
      <div style={styles.loadingBox(isDark)}>
        <div style={styles.spinner} />
        <div style={{ marginTop: 14, fontWeight: 600 }}>Loading financial ledger...</div>
      </div>
    );
  }

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">
      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>🏦</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>FINANCIAL LEDGER</div>
            <h1 style={styles.headerTitle(isDark)}>Accounts &amp; Finance</h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            style={styles.btnPrimary}
            onClick={() => { setShowAccForm(true); setEditAcc(null); setAccForm(initAccForm); }}
          >
            + New Account
          </button>
          <button
            style={styles.btnSuccess}
            onClick={() => setShowTxForm(true)}
          >
            + Add Transaction
          </button>
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
                label="Total Income"
                tag="INCOME"
                value={fmt(summary.totalIncome)}
                gradient="linear-gradient(135deg, #146c43 0%, #198754 100%)"
                glow="rgba(25, 135, 84, 0.35)"
                icon="📈"
                hint="View income transactions"
                onClick={() => goToTx('Income')}
              />
              <BtKpiCard
                label="Total Expense"
                tag="EXPENSES"
                value={fmt(summary.totalExpense)}
                gradient="linear-gradient(135deg, #b02a37 0%, #dc3545 100%)"
                glow="rgba(220, 53, 69, 0.35)"
                icon="📉"
                hint="View expense transactions"
                onClick={() => goToTx('Expense')}
              />
              <BtKpiCard
                label="Net Balance"
                tag="NET POSITION"
                value={fmt(summary.netBalance)}
                gradient={summary.netBalance >= 0
                  ? 'linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)'
                  : 'linear-gradient(135deg, #b02a37 0%, #dc3545 100%)'}
                glow={summary.netBalance >= 0 ? 'rgba(13, 110, 253, 0.35)' : 'rgba(220, 53, 69, 0.35)'}
                icon="💰"
                hint="View all transactions"
                onClick={() => goToTx('')}
              />
              <BtKpiCard
                label="Total Assets"
                tag="ASSETS"
                value={fmt(summary.totalAssets)}
                gradient="linear-gradient(135deg, #59359a 0%, #6f42c1 100%)"
                glow="rgba(111, 66, 193, 0.35)"
                icon="🏦"
                hint="View asset accounts"
                onClick={() => goToAccounts('Asset')}
              />
              <BtKpiCard
                label="Total Liabilities"
                tag="LIABILITIES"
                value={fmt(summary.totalLiabilities)}
                gradient="linear-gradient(135deg, #c2410c 0%, #fd7e14 100%)"
                glow="rgba(253, 126, 20, 0.35)"
                icon="📋"
                hint="View liability accounts"
                onClick={() => goToAccounts('Liability')}
              />
            </div>

            {/* Account Balances Table Card */}
            <div style={styles.cardBox(isDark)}>
              <div style={styles.cardHeader(isDark)}>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🏦 Account Balances
                </span>
                <span style={styles.countBadge}>
                  {summary.accounts.length} Active Accounts
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Account Name', 'Category', 'Balance', 'Status'].map(h => (
                        <th key={h} style={styles.th(isDark)}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.accounts.map((a, i) => {
                      const isExpense = a.categoryName === 'Expense';
                      const dispBal   = isExpense ? Math.abs(a.balance) : a.balance;
                      const balColor  = isExpense ? '#dc3545' : (a.balance >= 0 ? '#198754' : '#dc3545');
                      const catStyle  = CAT_COLORS[a.categoryName] || { bg: '#f8f9fa', color: '#6c757d', border: '#dee2e6' };

                      return (
                        <tr key={a.id} style={styles.tr(isDark, i % 2 === 0)}>
                          <td style={styles.td(isDark)}>
                            <strong>{a.name}</strong>
                          </td>
                          <td style={styles.td(isDark)}>
                            <span style={styles.catPill(catStyle.bg, catStyle.color, catStyle.border)}>
                              {a.categoryName}
                            </span>
                          </td>
                          <td style={{ ...styles.td(isDark), fontWeight: 800, color: balColor, fontSize: 14 }}>
                            {fmt(dispBal)}
                          </td>
                          <td style={styles.td(isDark)}>
                            <span style={a.isActive ? styles.activeBadge : styles.inactiveBadge}>
                              {a.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Transactions Table Card */}
            <div style={styles.cardBox(isDark)}>
              <div style={styles.cardHeader(isDark)}>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🧾 Recent Financial Transactions
                </span>
                <button
                  style={styles.btnOutlinePrimary}
                  onClick={() => { setTab('Transactions'); setFilterCat(''); setFilterAcc(''); }}
                >
                  View All Transactions →
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Date', 'Account', 'Description', 'Ref No', 'Type', 'Amount', 'Action'].map(h => (
                        <th key={h} style={styles.th(isDark)}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 8).map((t, i) => (
                      <tr key={t.id} style={styles.tr(isDark, i % 2 === 0)}>
                        <td style={styles.td(isDark)}>
                          📅 {new Date(t.date).toLocaleDateString('en-PK')}
                        </td>
                        <td style={styles.td(isDark)}>
                          <strong>{t.accountName}</strong>
                        </td>
                        <td style={styles.td(isDark)}>{t.description}</td>
                        <td style={styles.td(isDark)}>
                          <span style={styles.refBadge}>{t.referenceNo || '—'}</span>
                        </td>
                        <td style={styles.td(isDark)}>
                          <span style={t.type === 'Credit' ? styles.creditBadge : styles.debitBadge}>
                            {t.type}
                          </span>
                        </td>
                        <td style={{ ...styles.td(isDark), fontWeight: 800, color: t.type === 'Credit' ? '#198754' : '#dc3545', fontSize: 14 }}>
                          {fmt(t.amount)}
                        </td>
                        <td style={styles.td(isDark)}>
                          <button
                            style={styles.delBtn}
                            onClick={() => setDeleteConfirm({ id: t.id, name: t.description })}
                            title="Delete transaction"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr><td colSpan={7} style={styles.empty(isDark)}>No transactions recorded yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. ACCOUNTS TAB ─────────────────────────────────────────── */}
        {tab === 'Accounts' && (
          <div style={styles.cardBox(isDark)}>
            <div style={styles.cardHeader(isDark)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>
                  {filterCat ? `${filterCat} Accounts` : 'All Accounts'}
                </span>
                {filterCat && (
                  <span
                    style={{ background: '#e7f1ff', color: '#0d6efd', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => setFilterCat('')}
                  >
                    {filterCat} ✕
                  </span>
                )}
              </div>
              <select
                style={styles.select(isDark)}
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
                <option value="Asset">Asset</option>
                <option value="Cash">Cash</option>
                <option value="Liability">Liability</option>
              </select>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['#', 'Account Name', 'Category', 'Description', 'Balance', 'Status', 'Actions'].map(h => (
                      <th key={h} style={styles.th(isDark)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.filter(a => !filterCat || a.categoryName === filterCat).map((a, i) => {
                    const isExpense = a.categoryName === 'Expense';
                    const dispBal   = isExpense ? Math.abs(a.balance) : a.balance;
                    const balColor  = isExpense ? '#dc3545' : (a.balance >= 0 ? '#198754' : '#dc3545');
                    const catStyle  = CAT_COLORS[a.categoryName] || { bg: '#f8f9fa', color: '#6c757d', border: '#dee2e6' };

                    return (
                      <tr key={a.id} style={styles.tr(isDark, i % 2 === 0)}>
                        <td style={styles.td(isDark)}>{i + 1}</td>
                        <td style={styles.td(isDark)}><strong>{a.name}</strong></td>
                        <td style={styles.td(isDark)}>
                          <span style={styles.catPill(catStyle.bg, catStyle.color, catStyle.border)}>
                            {a.categoryName}
                          </span>
                        </td>
                        <td style={styles.td(isDark)}>{a.description || '—'}</td>
                        <td style={{ ...styles.td(isDark), fontWeight: 800, color: balColor, fontSize: 14 }}>
                          {fmt(dispBal)}
                        </td>
                        <td style={styles.td(isDark)}>
                          <span style={a.isActive ? styles.activeBadge : styles.inactiveBadge}>
                            {a.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={styles.td(isDark)}>
                          <button
                            style={styles.editBtn}
                            onClick={() => {
                              setEditAcc(a);
                              setAccForm({ name: a.name, categoryId: a.categoryId, openingBalance: a.balance, description: a.description || '' });
                              setShowAccForm(true);
                            }}
                          >
                            ✏️ Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {accounts.length === 0 && (
                    <tr><td colSpan={7} style={styles.empty(isDark)}>No accounts created yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 3. TRANSACTIONS TAB ─────────────────────────────────────── */}
        {tab === 'Transactions' && (
          <div style={styles.cardBox(isDark)}>
            <div style={styles.cardHeader(isDark)}>
              <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>
                All Transactions ({transactions.length})
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  style={styles.select(isDark)}
                  value={filterAcc}
                  onChange={e => setFilterAcc(e.target.value)}
                >
                  <option value="">All Accounts</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select
                  style={styles.select(isDark)}
                  value={filterCat}
                  onChange={e => setFilterCat(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Date', 'Account', 'Description', 'Ref No', 'Type', 'Amount', 'Action'].map(h => (
                      <th key={h} style={styles.th(isDark)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions
                    .filter(t => !filterAcc || t.accountId === Number(filterAcc))
                    .map((t, i) => (
                      <tr key={t.id} style={styles.tr(isDark, i % 2 === 0)}>
                        <td style={styles.td(isDark)}>📅 {new Date(t.date).toLocaleDateString('en-PK')}</td>
                        <td style={styles.td(isDark)}><strong>{t.accountName}</strong></td>
                        <td style={styles.td(isDark)}>{t.description}</td>
                        <td style={styles.td(isDark)}><span style={styles.refBadge}>{t.referenceNo || '—'}</span></td>
                        <td style={styles.td(isDark)}>
                          <span style={t.type === 'Credit' ? styles.creditBadge : styles.debitBadge}>
                            {t.type}
                          </span>
                        </td>
                        <td style={{ ...styles.td(isDark), fontWeight: 800, color: t.type === 'Credit' ? '#198754' : '#dc3545', fontSize: 14 }}>
                          {fmt(t.amount)}
                        </td>
                        <td style={styles.td(isDark)}>
                          <button
                            style={styles.delBtn}
                            onClick={() => setDeleteConfirm({ id: t.id, name: t.description })}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 4. LEDGER TAB ───────────────────────────────────────────── */}
        {tab === 'Ledger' && (
          <div style={styles.cardBox(isDark)}>
            <div style={styles.cardHeader(isDark)}>
              <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>
                📑 General Ledger Account View
              </span>
              <button
                style={styles.btnSecondarySm}
                onClick={() => setGroupedView(v => !v)}
              >
                {groupedView ? 'Flat Table' : 'Grouped by Account'}
              </button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {accounts.map(acc => {
                const accTxs = transactions.filter(t => t.accountId === acc.id);
                if (accTxs.length === 0) return null;
                const isCollapsed = collapsed[acc.id];

                return (
                  <div key={acc.id} style={styles.ledgerAccCard(isDark)}>
                    <div
                      style={styles.ledgerHeader(isDark)}
                      onClick={() => setCollapsed(c => ({ ...c, [acc.id]: !c[acc.id] }))}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{isCollapsed ? '▶' : '▼'}</span>
                        <strong style={{ fontSize: 15 }}>{acc.name}</strong>
                        <span style={styles.countBadge}>{accTxs.length} entries</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: acc.balance >= 0 ? '#198754' : '#dc3545' }}>
                        Balance: {fmt(acc.balance)}
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              {['Date', 'Description', 'Ref No', 'Type', 'Amount'].map(h => (
                                <th key={h} style={styles.th(isDark)}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {accTxs.map((t, idx) => (
                              <tr key={t.id} style={styles.tr(isDark, idx % 2 === 0)}>
                                <td style={styles.td(isDark)}>{new Date(t.date).toLocaleDateString('en-PK')}</td>
                                <td style={styles.td(isDark)}>{t.description}</td>
                                <td style={styles.td(isDark)}>{t.referenceNo || '—'}</td>
                                <td style={styles.td(isDark)}>
                                  <span style={t.type === 'Credit' ? styles.creditBadge : styles.debitBadge}>
                                    {t.type}
                                  </span>
                                </td>
                                <td style={{ ...styles.td(isDark), fontWeight: 700, color: t.type === 'Credit' ? '#198754' : '#dc3545' }}>
                                  {fmt(t.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── Add / Edit Account Modal ── */}
      {showAccForm && (
        <div style={styles.overlay}>
          <div style={styles.modal(isDark)}>
            <div style={styles.modalHeader('#0d6efd')}>
              <span style={styles.modalTitle}>{editAcc ? 'Edit Financial Account' : 'Create New Account'}</span>
              <button style={styles.closeBtn} onClick={() => setShowAccForm(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGrid}>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label(isDark)}>Account Name *</label>
                  <input
                    style={styles.input(isDark)}
                    placeholder="e.g. Bank Alfalah or Stitching Expense"
                    value={accForm.name}
                    onChange={e => setAccForm({ ...accForm, name: e.target.value })}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label(isDark)}>Category *</label>
                  <select
                    style={styles.select(isDark)}
                    value={accForm.categoryId}
                    onChange={e => setAccForm({ ...accForm, categoryId: e.target.value })}
                  >
                    <option value="">— Select Category —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {!editAcc && (
                  <div style={styles.formGroup}>
                    <label style={styles.label(isDark)}>Opening Balance (PKR)</label>
                    <input
                      style={styles.input(isDark)}
                      type="number"
                      placeholder="0"
                      value={accForm.openingBalance}
                      onChange={e => setAccForm({ ...accForm, openingBalance: e.target.value })}
                    />
                  </div>
                )}
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label(isDark)}>Description</label>
                  <input
                    style={styles.input(isDark)}
                    placeholder="Account purpose or bank details..."
                    value={accForm.description}
                    onChange={e => setAccForm({ ...accForm, description: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div style={styles.modalFooter(isDark)}>
              <button style={styles.cancelBtn(isDark)} onClick={() => setShowAccForm(false)}>Cancel</button>
              <button style={styles.btnPrimary} onClick={saveAccount} disabled={saving}>
                {saving ? 'Saving…' : editAcc ? 'Update Account' : 'Save Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Transaction Modal ── */}
      {showTxForm && (
        <div style={styles.overlay}>
          <div style={styles.modal(isDark)}>
            <div style={styles.modalHeader('#198754')}>
              <span style={styles.modalTitle}>Record Financial Transaction</span>
              <button style={styles.closeBtn} onClick={() => setShowTxForm(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGrid}>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label(isDark)}>Account *</label>
                  <select
                    style={styles.select(isDark)}
                    value={txForm.accountId}
                    onChange={e => setTxForm({ ...txForm, accountId: e.target.value })}
                  >
                    <option value="">— Select Account —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.categoryName})</option>)}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label(isDark)}>Transaction Type *</label>
                  <select
                    style={styles.select(isDark)}
                    value={txForm.type}
                    onChange={e => setTxForm({ ...txForm, type: e.target.value })}
                  >
                    <option value="Credit">Credit (Money In ↑)</option>
                    <option value="Debit">Debit (Money Out ↓)</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label(isDark)}>Amount (PKR) *</label>
                  <input
                    style={styles.input(isDark)}
                    type="number"
                    placeholder="0"
                    value={txForm.amount}
                    onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label(isDark)}>Reference No</label>
                  <input
                    style={styles.input(isDark)}
                    placeholder="e.g. CHQ-1049 or REF001"
                    value={txForm.referenceNo}
                    onChange={e => setTxForm({ ...txForm, referenceNo: e.target.value })}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label(isDark)}>Transaction Date *</label>
                  <input
                    style={styles.input(isDark)}
                    type="date"
                    value={txForm.date}
                    onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                  />
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label(isDark)}>Description *</label>
                  <input
                    style={styles.input(isDark)}
                    placeholder="Details about this payment or deposit..."
                    value={txForm.description}
                    onChange={e => setTxForm({ ...txForm, description: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div style={styles.modalFooter(isDark)}>
              <button style={styles.cancelBtn(isDark)} onClick={() => setShowTxForm(false)}>Cancel</button>
              <button style={styles.btnSuccess} onClick={saveTx} disabled={saving}>
                {saving ? 'Saving…' : 'Record Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal(isDark), maxWidth: 420 }}>
            <div style={styles.modalHeader('#dc3545')}>
              <span style={styles.modalTitle}>Confirm Delete</span>
              <button style={styles.closeBtn} onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div style={{ padding: '1.4rem', fontSize: 14, color: isDark ? 'var(--text-main)' : '#212529', lineHeight: 1.5 }}>
              Are you sure you want to delete transaction <b>{deleteConfirm.name}</b>?
              <div style={{ fontSize: 12, color: '#dc3545', marginTop: 8 }}>
                This will reverse the associated account balance.
              </div>
            </div>
            <div style={styles.modalFooter(isDark)}>
              <button style={styles.cancelBtn(isDark)} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={styles.btnDanger} onClick={() => handleDeleteTx(deleteConfirm.id)}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bootstrap KPI Card Sub-Component ──
function BtKpiCard({ label, tag, value, gradient, glow, icon, hint, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={hint}
      style={{
        background: gradient,
        borderRadius: 14,
        padding: '16px 18px',
        color: '#ffffff',
        boxShadow: hov ? `0 10px 26px ${glow}` : `0 6px 18px ${glow}`,
        border: '1px solid rgba(255, 255, 255, 0.18)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 110,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.16s ease, box-shadow 0.16s ease',
        transform: hov ? 'translateY(-3px)' : 'none',
      }}
    >
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
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'relative', zIndex: 1
      }}>
        <span>{label}</span>
        <span style={{ fontSize: 11, opacity: 0.8 }}>View →</span>
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

  // ── Nav Pills ──
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

  // ── Buttons ──
  btnPrimary: {
    background: '#0d6efd',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(13, 110, 253, 0.28)',
  },
  btnSuccess: {
    background: '#198754',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(25, 135, 84, 0.28)',
  },
  btnDanger: {
    background: '#dc3545',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnOutlinePrimary: {
    background: '#e7f1ff',
    color: '#0d6efd',
    border: '1px solid #cff4fc',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
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
  editBtn: {
    background: '#e7f1ff',
    color: '#0d6efd',
    border: '1px solid #b6d4fe',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  delBtn: {
    background: '#f8d7da',
    color: '#dc3545',
    border: '1px solid #f5c2c7',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    cursor: 'pointer',
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

  // ── Badges ──
  catPill: (bg, color, border) => ({
    background: bg,
    color: color,
    border: `1px solid ${border}`,
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
  }),
  activeBadge: {
    background: '#d1e7dd',
    color: '#0f5132',
    border: '1px solid #badbcc',
    borderRadius: 12,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  inactiveBadge: {
    background: '#f8d7da',
    color: '#842029',
    border: '1px solid #f5c2c7',
    borderRadius: 12,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  creditBadge: {
    background: '#d1e7dd',
    color: '#0f5132',
    border: '1px solid #badbcc',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
  },
  debitBadge: {
    background: '#f8d7da',
    color: '#842029',
    border: '1px solid #f5c2c7',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
  },
  refBadge: {
    background: '#f8f9fa',
    border: '1px solid #ced4da',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 11,
    color: '#495057',
    fontWeight: 600,
  },

  // ── Form Inputs ──
  select: (isDark) => ({
    padding: '7px 12px',
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
    width: '100%',
    boxSizing: 'border-box',
  }),
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: (isDark) => ({
    fontSize: 12,
    fontWeight: 700,
    color: isDark ? 'var(--text-muted)' : '#495057',
  }),

  // ── Ledger Specific ──
  ledgerAccCard: (isDark) => ({
    marginBottom: 14,
    borderRadius: 10,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    overflow: 'hidden',
  }),
  ledgerHeader: (isDark) => ({
    padding: '12px 16px',
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),

  // ── Modals ──
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 560,
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),
  modalHeader: (color) => ({
    background: `linear-gradient(135deg, ${color} 0%, #1e293b 100%)`,
    padding: '1.1rem 1.4rem',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
  modalTitle: {
    fontSize: '1.1rem',
    fontWeight: 800,
    margin: 0,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.2)',
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
  },
  modalBody: {
    padding: '1.4rem',
  },
  modalFooter: (isDark) => ({
    padding: '1rem 1.4rem',
    borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
  }),
  cancelBtn: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#ced4da'}`,
    color: isDark ? 'var(--text-main)' : '#495057',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
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
};
