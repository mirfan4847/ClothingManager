import { useTheme, THEME_COLORS, THEME_MODES } from '../context/ThemeContext';

export default function ThemeModal() {
  const {
    isThemeModalOpen,
    closeThemeModal,
    mode,
    setMode,
    themeColor,
    setThemeColor,
    currentColor,
    isDark,
  } = useTheme();

  if (!isThemeModalOpen) return null;

  return (
    <div style={m.overlay} onClick={closeThemeModal}>
      <div style={m.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={m.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>🎨</span>
            <div>
              <div style={m.title}>Theme & Mood Settings</div>
              <div style={m.subtitle}>Customize your visual appearance and display mood</div>
            </div>
          </div>
          <button onClick={closeThemeModal} style={m.closeBtn}>✕</button>
        </div>

        {/* Section 1: Display Mood / Mode */}
        <div style={m.section}>
          <div style={m.sectionLabel}>
            <span>🌙 DISPLAY MOOD</span>
            <span style={m.badgeActive}>{mode.toUpperCase()}</span>
          </div>
          <div style={m.modeGrid}>
            {THEME_MODES.map(item => {
              const active = mode === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setMode(item.id)}
                  style={{
                    ...m.modeCard,
                    borderColor: active ? currentColor.primary : (isDark ? '#334155' : '#e2e8f0'),
                    background: active
                      ? (isDark ? 'rgba(46,117,182,0.18)' : currentColor.light)
                      : (isDark ? '#0f172a' : '#fff'),
                    boxShadow: active ? `0 0 0 2px ${currentColor.primary}` : 'none',
                  }}
                >
                  <div style={m.modeHead}>
                    <span style={{ fontSize: 22 }}>{item.icon}</span>
                    {active && <span style={{ color: currentColor.primary, fontWeight: 800, fontSize: 13 }}>✓ Active</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginTop: 6, color: isDark ? '#fff' : '#1e2a3b' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                    {item.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Accent Design Colors */}
        <div style={m.section}>
          <div style={m.sectionLabel}>
            <span>🎨 ACCENT DESIGN</span>
            <span style={m.badgeActive}>{currentColor.name}</span>
          </div>
          <div style={m.colorGrid}>
            {THEME_COLORS.map(c => {
              const active = themeColor === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setThemeColor(c.id)}
                  style={{
                    ...m.colorCard,
                    borderColor: active ? c.primary : (isDark ? '#334155' : '#e2e8f0'),
                    background: isDark ? '#0f172a' : '#fff',
                    boxShadow: active ? `0 0 0 2px ${c.primary}` : 'none',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                    {active ? '✓' : ''}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: isDark ? '#fff' : '#1e2a3b', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: c.primary, fontWeight: 600 }}>
                      {c.primary}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Preview Card */}
        <div style={{ ...m.previewBox, background: isDark ? '#0f172a' : '#f8f9fa', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: currentColor.primary, letterSpacing: 1, textTransform: 'uppercase' }}>
            ⚡ Live Preview
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: isDark ? '#fff' : '#1e2a3b' }}>
                Clothing Manager Interface
              </div>
              <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                Showing theme: <strong>{currentColor.name}</strong> · Mood: <strong>{mode}</strong>
              </div>
            </div>
            <button
              style={{
                background: currentColor.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Accent Button
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={m.footer}>
          <button onClick={closeThemeModal} style={{ ...m.saveBtn, background: currentColor.primary }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

const m = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 580,
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    maxHeight: '92vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottom: '1px solid rgba(125,125,125,0.15)',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    color: '#888',
    padding: '4px 8px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  sectionLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: '#888',
  },
  badgeActive: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 12,
    background: 'rgba(125,125,125,0.15)',
  },
  modeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 10,
  },
  modeCard: {
    borderRadius: 12,
    border: '1.5px solid',
    padding: '12px 14px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modeHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 10,
  },
  colorCard: {
    borderRadius: 12,
    border: '1.5px solid',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  previewBox: {
    borderRadius: 12,
    padding: '14px 16px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  saveBtn: {
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
};

