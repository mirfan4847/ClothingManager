import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getRoles, updateRolePerms } from '../services/api';

const ROLE_COLORS = {
  Admin:   { primary: '#0d6efd', gradient: 'linear-gradient(135deg, #0a58ca 0%, #0d6efd 100%)', glow: 'rgba(13, 110, 253, 0.35)', badge: '#cfe2ff', text: '#084298' },
  Manager: { primary: '#198754', gradient: 'linear-gradient(135deg, #146c43 0%, #198754 100%)', glow: 'rgba(25, 135, 84, 0.35)', badge: '#d1e7dd', text: '#0f5132' },
  Viewer:  { primary: '#fd7e14', gradient: 'linear-gradient(135deg, #c2410c 0%, #fd7e14 100%)', glow: 'rgba(253, 126, 20, 0.35)', badge: '#ffe5d0', text: '#9a3412' },
};

const PERM_GROUPS = [
  {
    label: 'Production / Workforce',
    icon: '⚙️',
    perms: [
      { key: 'canViewLabour',   label: 'View Labour' },
      { key: 'canAddLabour',    label: 'Add Labour' },
      { key: 'canEditLabour',   label: 'Edit Labour' },
      { key: 'canDeleteLabour', label: 'Delete Labour' },
      { key: 'canViewWorkers',  label: 'View Workers' },
      { key: 'canAddEntry',     label: 'Add Entry' },
      { key: 'canEditEntry',    label: 'Edit Entry' },
      { key: 'canDeleteEntry',  label: 'Delete Entry' },
    ],
  },
  {
    label: 'Finance / Accounts',
    icon: '📊',
    perms: [
      { key: 'canViewAccounts',      label: 'View Accounts' },
      { key: 'canAddTransaction',    label: 'Add Transaction' },
      { key: 'canEditTransaction',   label: 'Edit Transaction' },
      { key: 'canDeleteTransaction', label: 'Delete Transaction' },
      { key: 'canManageAccounts',    label: 'Manage Accounts' },
    ],
  },
  {
    label: 'Payroll / Wages',
    icon: '💼',
    perms: [
      { key: 'canViewWages',     label: 'View Wages' },
      { key: 'canRecordPayment', label: 'Record Payment' },
      { key: 'canManageWages',   label: 'Manage Wages' },
    ],
  },
  {
    label: 'Configuration & Settings',
    icon: '🔧',
    perms: [
      { key: 'canViewSettings',   label: 'View Settings' },
      { key: 'canAddSettings',    label: 'Add Settings' },
      { key: 'canEditSettings',   label: 'Edit Settings' },
      { key: 'canDeleteSettings', label: 'Delete Settings' },
    ],
  },
  {
    label: 'System & Security',
    icon: '🛡️',
    perms: [
      { key: 'canManageRoles', label: 'Manage Roles' },
      { key: 'canViewReports', label: 'View Reports' },
    ],
  },
];

const ROLE_DESC = {
  Admin:   'Full system administrator with unrestricted privileges across all modules.',
  Manager: 'Operational manager with operational editing permissions (cannot delete critical accounting ledger).',
  Viewer:  'Read-only observer with analytical inspection permissions.',
};

export default function RoleManagement() {
  const { can } = useAuth();
  const { isDark } = useTheme();

  const [perms,   setPerms]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(null);
  const [saved,   setSaved]   = useState(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    getRoles()
      .then(data => {
        const map = {};
        data.forEach(r => { map[r.role] = r.permissions || {}; });
        setPerms(map);
      })
      .catch(() => setError('Failed to load permissions from server.'))
      .finally(() => setLoading(false));
  }, []);

  if (!can('canManageRoles')) {
    return (
      <div style={styles.denied(isDark)}>
        <div style={{ fontSize: 64 }}>🔒</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc3545', margin: '16px 0 8px' }}>Access Denied</div>
        <div style={{ color: isDark ? 'var(--text-muted)' : '#6c757d', fontSize: 14 }}>
          You do not have administrative permission to manage roles.
        </div>
      </div>
    );
  }

  const toggle = (role, key) => {
    if (role === 'Admin') return;
    setPerms(prev => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role]?.[key] },
    }));
  };

  const save = async (role) => {
    setSaving(role);
    setError('');
    try {
      await updateRolePerms(role, perms[role]);
      setSaved(role);
      setTimeout(() => setSaved(null), 2500);
    } catch {
      setError(`Failed to save permissions for ${role}.`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingBox(isDark)}>
        <div style={styles.spinner} />
        <div style={{ marginTop: 14, fontWeight: 600 }}>Loading role policies…</div>
      </div>
    );
  }

  return (
    <div style={styles.page(isDark)} className="hide-scrollbar">

      {/* ── Executive Header Banner (Bootstrap 5 Style) ── */}
      <div style={styles.header(isDark)}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIconWrap}>
            <span>🛡️</span>
          </div>
          <div>
            <div style={styles.headerBreadcrumb}>SECURITY &amp; GOVERNANCE</div>
            <h1 style={styles.headerTitle(isDark)}>Access Control &amp; Role Permissions</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={styles.headerBadge}>
            RBAC Matrix
          </span>
          <span style={styles.headerSubBadge(isDark)}>
            3 System Roles Configured
          </span>
        </div>
      </div>

      <div style={styles.content}>

        {error && (
          <div style={styles.errorAlert}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} style={styles.closeBtn}>✕</button>
          </div>
        )}

        {/* ── 3 Role KPI Cards (Bootstrap Colors) ── */}
        <div style={styles.kpiGrid}>
          {Object.keys(ROLE_COLORS).map(role => {
            const rc = ROLE_COLORS[role];
            const permCount = Object.values(perms[role] || {}).filter(Boolean).length;
            return (
              <div
                key={role}
                style={{
                  background: rc.gradient,
                  borderRadius: 14,
                  padding: '16px 20px',
                  color: '#ffffff',
                  boxShadow: `0 8px 24px ${rc.glow}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 110,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={styles.roleTag}>ROLE POLICY</span>
                  <div style={styles.roleBadgeWhite}>{role}</div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>
                    {role === 'Admin' ? 'All Permissions' : `${permCount} Active Permissions`}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
                    {ROLE_DESC[role]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Role Policy Permission Cards Grid ── */}
        <div style={styles.rolesGrid}>
          {Object.keys(ROLE_COLORS).map(role => {
            const rc = ROLE_COLORS[role];
            const isSaving = saving === role;
            const isSaved = saved === role;

            return (
              <div key={role} style={styles.roleCard(isDark, rc.primary)}>
                <div style={styles.roleHead(isDark)}>
                  <div style={{ ...styles.avatar, background: rc.primary }}>{role[0]}</div>
                  <div>
                    <div style={styles.roleName(isDark)}>{role} Access Policy</div>
                    <div style={{ fontSize: 12, color: isDark ? 'var(--text-muted)' : '#6c757d' }}>
                      {role === 'Admin' ? 'Locked (Root Superuser)' : 'Configurable granular rules'}
                    </div>
                  </div>
                </div>

                {/* Groups */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {PERM_GROUPS.map(group => (
                    <div key={group.label} style={styles.group(isDark)}>
                      <div style={styles.groupLabel(isDark)}>
                        <span style={{ marginRight: 6 }}>{group.icon}</span>
                        {group.label}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {group.perms.map(({ key, label }) => {
                          const granted = perms[role]?.[key] ?? false;
                          const locked  = role === 'Admin';
                          return (
                            <div key={key} style={styles.permRow(isDark)}>
                              <span style={{ fontSize: 13, color: isDark ? 'var(--text-main)' : '#212529', fontWeight: 500 }}>
                                {label}
                              </span>
                              <button
                                onClick={() => toggle(role, key)}
                                disabled={locked}
                                style={styles.toggle(granted, locked)}
                                title={locked ? 'Admin always has full access' : (granted ? 'Click to revoke' : 'Click to grant')}
                              >
                                <div style={styles.toggleKnob(granted)} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {role !== 'Admin' && (
                  <button
                    onClick={() => save(role)}
                    disabled={isSaving}
                    style={isSaved ? styles.btnSuccessSaved : styles.btnPrimarySave}
                  >
                    {isSaving ? '⏳ Saving Policy…' : isSaved ? '✓ Policy Saved Successfully' : `Save ${role} Permissions`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Overview Table (Bootstrap Styled) ── */}
        <div style={styles.cardBox(isDark)}>
          <div style={styles.cardHeader(isDark)}>
            <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              📋 Permissions Cross-Reference Overview
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th(isDark)}>Permission Capability</th>
                  {Object.keys(ROLE_COLORS).map(r => (
                    <th key={r} style={{ ...styles.th(isDark), textAlign: 'center', color: ROLE_COLORS[r].primary, fontWeight: 800 }}>
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERM_GROUPS.map(group => [
                  <tr key={group.label + '_hdr'}>
                    <td colSpan={4} style={styles.groupRow(isDark)}>
                      <span style={{ marginRight: 6 }}>{group.icon}</span>
                      {group.label}
                    </td>
                  </tr>,
                  ...group.perms.map(({ key, label }, i) => (
                    <tr key={key} style={styles.tr(isDark, i % 2 === 0)}>
                      <td style={{ ...styles.td(isDark), fontWeight: 600 }}>{label}</td>
                      {Object.keys(ROLE_COLORS).map(role => (
                        <td key={role} style={{ ...styles.td(isDark), textAlign: 'center' }}>
                          <span style={(perms[role]?.[key]) ? styles.yesBadge : styles.noBadge}>
                            {(perms[role]?.[key]) ? '✓ Granted' : '✗ Denied'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Styles Object ──
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

  content: {
    padding: '20px 24px 36px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 14,
  },

  roleTag: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    background: 'rgba(255, 255, 255, 0.22)',
    padding: '2px 8px',
    borderRadius: 6,
    backdropFilter: 'blur(4px)',
  },

  roleBadgeWhite: {
    background: '#ffffff',
    color: '#212529',
    borderRadius: 20,
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 800,
  },

  rolesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
    alignItems: 'flex-start',
  },

  roleCard: (isDark, accentColor) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    padding: '18px 20px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    borderTop: `4px solid ${accentColor}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  }),

  roleHead: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#e9ecef'}`,
  }),

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 18,
    flexShrink: 0,
    boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
  },

  roleName: (isDark) => ({
    fontWeight: 800,
    fontSize: 16,
    color: isDark ? '#ffffff' : '#212529',
  }),

  group: (isDark) => ({
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    borderRadius: 10,
    padding: '12px 14px',
    border: `1px solid ${isDark ? 'var(--border-color)' : '#e9ecef'}`,
  }),

  groupLabel: (isDark) => ({
    fontSize: 11,
    fontWeight: 800,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
  }),

  permRow: (isDark) => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 0',
    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}`,
  }),

  toggle: (granted, locked) => ({
    width: 44,
    height: 24,
    borderRadius: 12,
    border: 'none',
    position: 'relative',
    transition: 'background .2s',
    flexShrink: 0,
    background: granted ? '#198754' : '#ced4da',
    cursor: locked ? 'default' : 'pointer',
    opacity: locked ? 0.75 : 1,
  }),

  toggleKnob: (granted) => ({
    position: 'absolute',
    top: 2,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#ffffff',
    transition: 'transform .2s',
    boxShadow: '0 1px 3px rgba(0,0,0,.3)',
    transform: granted ? 'translateX(22px)' : 'translateX(2px)',
  }),

  btnPrimarySave: {
    width: '100%',
    background: '#0d6efd',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '10px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(13, 110, 253, 0.35)',
    transition: 'all .15s',
  },

  btnSuccessSaved: {
    width: '100%',
    background: '#198754',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '10px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'default',
    boxShadow: '0 2px 6px rgba(25, 135, 84, 0.35)',
  },

  cardBox: (isDark) => ({
    background: isDark ? 'var(--bg-card)' : '#ffffff',
    borderRadius: 14,
    border: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    boxShadow: '0 .125rem .25rem rgba(0,0,0,.04)',
    overflow: 'hidden',
  }),

  cardHeader: (isDark) => ({
    padding: '14px 20px',
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }),

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },

  th: (isDark) => ({
    background: isDark ? 'var(--bg-subtle)' : '#f8f9fa',
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 800,
    color: isDark ? 'var(--text-muted)' : '#6c757d',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderBottom: `2px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),

  groupRow: (isDark) => ({
    padding: '8px 16px',
    background: isDark ? '#0f172a' : '#e7f1ff',
    color: isDark ? '#60a5fa' : '#0a58ca',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderTop: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#dee2e6'}`,
  }),

  tr: (isDark, isEven) => ({
    borderBottom: `1px solid ${isDark ? 'var(--border-color)' : '#f1f5f9'}`,
    background: isEven ? (isDark ? 'var(--bg-card)' : '#ffffff') : (isDark ? 'rgba(255,255,255,0.015)' : '#fafbfc'),
  }),

  td: (isDark) => ({
    padding: '10px 16px',
    color: isDark ? 'var(--text-main)' : '#212529',
    verticalAlign: 'middle',
  }),

  yesBadge: {
    background: '#d1e7dd',
    color: '#0f5132',
    border: '1px solid #badbcc',
    borderRadius: 20,
    padding: '3px 10px',
    fontWeight: 700,
    fontSize: 11,
    display: 'inline-block',
  },

  noBadge: {
    background: '#f8d7da',
    color: '#842029',
    border: '1px solid #f5c2c7',
    borderRadius: 20,
    padding: '3px 10px',
    fontWeight: 700,
    fontSize: 11,
    display: 'inline-block',
  },

  errorAlert: {
    background: '#f8d7da',
    border: '1px solid #f5c2c7',
    borderRadius: 8,
    padding: '12px 16px',
    color: '#842029',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
    color: '#842029',
  },

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
    borderTopColor: '#0d6efd',
    animation: 'spin 0.8s linear infinite',
  },

  denied: (isDark) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    padding: 30,
  }),
};
