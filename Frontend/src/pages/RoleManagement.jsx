import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRoles, updateRolePerms } from '../services/api';

const ROLE_COLORS = { Admin: '#2E75B6', Manager: '#70AD47', Viewer: '#C55A11' };

const PERM_GROUPS = [
  {
    label: 'Production / Labour',
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
    perms: [
      { key: 'canViewWages',    label: 'View Wages' },
      { key: 'canRecordPayment', label: 'Record Payment' },
      { key: 'canManageWages',  label: 'Manage Wages' },
    ],
  },
  {
    label: 'Configuration',
    perms: [
      { key: 'canViewSettings',   label: 'View Settings' },
      { key: 'canAddSettings',    label: 'Add Settings' },
      { key: 'canEditSettings',   label: 'Edit Settings' },
      { key: 'canDeleteSettings', label: 'Delete Settings' },
    ],
  },
  {
    label: 'System',
    perms: [
      { key: 'canManageRoles', label: 'Manage Roles' },
      { key: 'canViewReports', label: 'View Reports' },
    ],
  },
];

const ALL_PERM_KEYS = PERM_GROUPS.flatMap(g => g.perms.map(p => p.key));

export default function RoleManagement() {
  const { can } = useAuth();
  const [perms,   setPerms]   = useState({});   // { Admin: {canX: bool}, Manager: {...}, Viewer: {...} }
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(null);  // role name being saved
  const [saved,   setSaved]   = useState(null);  // role name just saved
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
      <div style={ss.denied}>
        <div style={{ fontSize: 64 }}>🔒</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#BE0000', margin: '16px 0 8px' }}>Access Denied</div>
        <div style={{ color: '#888', fontSize: 14 }}>You don't have permission to manage roles.</div>
      </div>
    );
  }

  const toggle = (role, key) => {
    if (role === 'Admin') return; // Admin always has all permissions
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
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setError(`Failed to save permissions for ${role}.`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading permissions...</div>;

  return (
    <div>
      <div style={ss.header}>
        <div>
          <div style={ss.headerLabel}>Admin</div>
          <div style={ss.headerTitle}>Access Control</div>
        </div>
        <div style={{ color: '#7a9cc0', fontSize: 13 }}>Click toggles to edit · Save per role</div>
      </div>

      {error && <div style={ss.errorBanner}>{error}</div>}

      <div style={ss.body}>
        <div style={ss.rolesGrid}>
          {Object.keys(ROLE_COLORS).map(role => (
            <div key={role} style={{ ...ss.roleCard, borderTop: `4px solid ${ROLE_COLORS[role]}` }}>

              {/* Role header */}
              <div style={ss.roleHead}>
                <div style={{ ...ss.avatar, background: ROLE_COLORS[role] }}>{role[0]}</div>
                <div>
                  <div style={ss.roleName}>{role}</div>
                  <div style={ss.roleDesc}>{ROLE_DESC[role]}</div>
                </div>
              </div>

              {/* Permission groups */}
              {PERM_GROUPS.map(group => (
                <div key={group.label} style={ss.group}>
                  <div style={ss.groupLabel}>{group.label}</div>
                  {group.perms.map(({ key, label }) => {
                    const granted = perms[role]?.[key] ?? false;
                    const locked  = role === 'Admin';
                    return (
                      <div key={key} style={ss.permRow}>
                        <span style={ss.permLabel}>{label}</span>
                        <button
                          onClick={() => toggle(role, key)}
                          disabled={locked}
                          style={{
                            ...ss.toggle,
                            background: granted ? '#70AD47' : '#ddd',
                            cursor: locked ? 'default' : 'pointer',
                            opacity: locked ? 0.7 : 1,
                          }}
                          title={locked ? 'Admin always has full access' : (granted ? 'Click to revoke' : 'Click to grant')}
                        >
                          <div style={{ ...ss.toggleKnob, transform: granted ? 'translateX(18px)' : 'translateX(2px)' }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Save button */}
              {role !== 'Admin' && (
                <button
                  onClick={() => save(role)}
                  disabled={saving === role}
                  style={{ ...ss.saveBtn, background: saved === role ? '#70AD47' : ROLE_COLORS[role] }}
                >
                  {saving === role ? 'Saving…' : saved === role ? '✓ Saved' : 'Save Changes'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Overview table */}
        <div style={ss.tableWrap}>
          <div style={ss.tableTitle}>Permissions Overview</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={ss.table}>
              <thead>
                <tr>
                  <th style={ss.th}>Permission</th>
                  {Object.keys(ROLE_COLORS).map(r => (
                    <th key={r} style={{ ...ss.th, color: ROLE_COLORS[r] }}>{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERM_GROUPS.map(group => [
                  <tr key={group.label + '_hdr'}>
                    <td colSpan={4} style={ss.groupRow}>{group.label}</td>
                  </tr>,
                  ...group.perms.map(({ key, label }, i) => (
                    <tr key={key} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafd' }}>
                      <td style={ss.td}>{label}</td>
                      {Object.keys(ROLE_COLORS).map(role => (
                        <td key={role} style={{ ...ss.td, textAlign: 'center' }}>
                          <span style={(perms[role]?.[key]) ? ss.yes : ss.no}>
                            {(perms[role]?.[key]) ? '✓' : '✗'}
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

const ROLE_DESC = {
  Admin:   'Full access to all features',
  Manager: 'Can manage but not delete critical data',
  Viewer:  'Read-only access',
};

const ss = {
  header:      { background: '#1e2a3b', padding: '1.2rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { color: '#7a9cc0', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: '1.4rem', fontWeight: 600 },
  errorBanner: { background: '#fbeaea', color: '#BE0000', padding: '10px 2rem', fontSize: 13 },
  body:        { padding: '1.5rem 2rem', fontFamily: 'Segoe UI, Arial, sans-serif' },
  rolesGrid:   { display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start' },
  roleCard:    { background: '#fff', borderRadius: 10, padding: '1.2rem', flex: 1, minWidth: 240, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' },
  roleHead:    { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar:      { width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 },
  roleName:    { fontWeight: 700, fontSize: 15, color: '#1e2a3b' },
  roleDesc:    { fontSize: 11, color: '#888', marginTop: 2 },
  group:       { marginBottom: 12 },
  groupLabel:  { fontSize: 10, fontWeight: 700, color: '#7a9cc0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid #eef1f6' },
  permRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 },
  permLabel:   { color: '#444' },
  toggle:      { width: 42, height: 22, borderRadius: 11, border: 'none', position: 'relative', transition: 'background .2s', flexShrink: 0 },
  toggleKnob:  { position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'transform .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' },
  saveBtn:     { width: '100%', marginTop: 14, padding: '8px', borderRadius: 6, border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'background .3s' },
  tableWrap:   { background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' },
  tableTitle:  { padding: '1rem 1.5rem', fontWeight: 600, fontSize: 15, borderBottom: '1px solid #eef1f6', color: '#1e2a3b' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { background: '#1e2a3b', color: '#fff', padding: '10px 16px', textAlign: 'left', fontWeight: 500 },
  td:          { padding: '8px 16px', borderBottom: '1px solid #eef1f6' },
  groupRow:    { padding: '6px 16px', background: '#f0f4fa', fontSize: 11, fontWeight: 700, color: '#4a6080', letterSpacing: 1, textTransform: 'uppercase' },
  yes:         { background: '#EEF6E6', color: '#4a8a1e', borderRadius: 4, padding: '2px 8px', fontWeight: 700 },
  no:          { background: '#FBEAEA', color: '#BE0000', borderRadius: 4, padding: '2px 8px', fontWeight: 700 },
  denied:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'Segoe UI, Arial, sans-serif' },
};
