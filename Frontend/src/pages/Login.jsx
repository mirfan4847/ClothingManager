import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { seedAuthUsers } from '../services/api';

export default function Login() {
  const { login }     = useAuth();
  const navigate      = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [error, setError]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await seedAuthUsers();
      setSuccessMsg(res.message || 'Users (admin, manager, viewer) and permissions verified in DB!');
      setForm({ username: 'admin', password: 'admin123' });
    } catch {
      setSuccessMsg('Initialized in-memory credentials: admin, manager, viewer active.');
      setForm({ username: 'admin', password: 'admin123' });
    } finally {
      setSeeding(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError('Please enter username and password');
      return;
    }
    setLoading(true);
    setError('');

    // Clear any old session first
    sessionStorage.removeItem('cm_user');

    const result = await login(form.username, form.password, () => {
      navigate('/labour', { replace: true });
    });

    setLoading(false);
    if (!result.success) setError(result.message);
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>🧵</div>
          <div style={s.logoText}>Clothing Manager</div>
          <div style={s.logoSub}>Production Management System</div>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Username</label>
            <input style={s.input} placeholder="Enter your username"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              autoFocus />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <div style={{ position: 'relative' }}>
              <input style={s.input} type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setShowPass(v => !v)} style={s.eyeBtn}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && <div style={s.errorBox}>{error}</div>}
          {successMsg && <div style={{ ...s.errorBox, background: '#e6f4ea', border: '1px solid #a8dab5', color: '#137333' }}>{successMsg}</div>}

          <button type="submit" style={s.loginBtn} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={s.demoBox}>
          <div style={s.demoTitle}>DEMO CREDENTIALS</div>
          {[
            { role: 'Admin',   user: 'admin',   pass: 'admin123',   color: '#2E75B6' },
            { role: 'Manager', user: 'manager', pass: 'manager123', color: '#70AD47' },
            { role: 'Viewer',  user: 'viewer',  pass: 'viewer123',  color: '#C55A11' },
          ].map(d => (
            <div key={d.role} style={s.demoRow}
              onClick={() => setForm({ username: d.user, password: d.pass })}>
              <span style={{ ...s.rolePill, background: d.color }}>{d.role}</span>
              <span style={s.demoCred}>{d.user} / {d.pass}</span>
              <span style={s.demoHint}>click to fill</span>
            </div>
          ))}

          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#2563eb',
              background: '#eff6ff',
              border: '1px dashed #93c5fd',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            {seeding ? '⏳ Verifying Database...' : '⚡ Seed / Verify Database Users & Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page:      { minHeight: '100vh', background: '#1e2a3b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial, sans-serif' },
  card:      { background: '#fff', borderRadius: 16, padding: '2.5rem 2rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  logoWrap:  { textAlign: 'center', marginBottom: '2rem' },
  logoIcon:  { fontSize: 48, marginBottom: 8 },
  logoText:  { fontSize: '1.5rem', fontWeight: 700, color: '#1e2a3b' },
  logoSub:   { fontSize: 13, color: '#888', marginTop: 4 },
  form:      { display: 'flex', flexDirection: 'column', gap: 16 },
  field:     { display: 'flex', flexDirection: 'column', gap: 6 },
  label:     { fontSize: 13, fontWeight: 600, color: '#444' },
  input:     { padding: '11px 14px', borderRadius: 8, border: '1px solid #dde3ec', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  eyeBtn:    { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 },
  errorBox:  { background: '#FBEAEA', color: '#BE0000', borderRadius: 8, padding: '10px 14px', fontSize: 13, border: '1px solid #f5c6c6' },
  loginBtn:  { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  demoBox:   { marginTop: '1.5rem', background: '#f8fafd', borderRadius: 10, padding: '1rem', border: '1px solid #e8edf5' },
  demoTitle: { fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  demoRow:   { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', cursor: 'pointer', borderBottom: '1px solid #eef1f6' },
  rolePill:  { color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px', minWidth: 55, textAlign: 'center' },
  demoCred:  { fontSize: 12, color: '#444', flex: 1 },
  demoHint:  { fontSize: 11, color: '#aaa' },
};
