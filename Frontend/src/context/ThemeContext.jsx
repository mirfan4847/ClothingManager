import { createContext, useContext, useState, useEffect } from 'react';

export const THEME_COLORS = [
  { id: 'blue',    name: 'Ocean Blue',   primary: '#2E75B6', hover: '#1a568c', light: '#eff6ff', border: '#bfdbfe', ring: 'rgba(46,117,182,0.35)' },
  { id: 'emerald', name: 'Emerald',      primary: '#059669', hover: '#047857', light: '#ecfdf5', border: '#a7f3d0', ring: 'rgba(5,150,105,0.35)' },
  { id: 'purple',  name: 'Royal Purple', primary: '#7c3aed', hover: '#6d28d9', light: '#f5f3ff', border: '#ddd6fe', ring: 'rgba(124,58,237,0.35)' },
  { id: 'amber',   name: 'Sunset Amber', primary: '#d97706', hover: '#b45309', light: '#fffbeb', border: '#fde68a', ring: 'rgba(217,119,6,0.35)' },
  { id: 'rose',    name: 'Crimson Rose', primary: '#e11d48', hover: '#be123c', light: '#fff1f2', border: '#fecdd3', ring: 'rgba(225,29,72,0.35)' },
  { id: 'cyan',    name: 'Cyber Cyan',   primary: '#0891b2', hover: '#0e7490', light: '#ecfeff', border: '#a5f3fc', ring: 'rgba(8,145,178,0.35)' },
];

export const THEME_MODES = [
  { id: 'light',    label: 'Light',    icon: '☀️', desc: 'Clean & high-contrast daytime mode' },
  { id: 'dark',     label: 'Dark',     icon: '🌙', desc: 'Sleek dark slate for comfortable eye care' },
  { id: 'midnight', label: 'Midnight', icon: '🌌', desc: 'Deep OLED true-black aesthetic' },
  { id: 'auto',     label: 'System',   icon: '💻', desc: 'Syncs automatically with your operating system' },
];

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    return localStorage.getItem('cm_theme_mode') || 'light';
  });

  const [themeColor, setThemeColorState] = useState(() => {
    return localStorage.getItem('cm_theme_color') || 'blue';
  });

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Detect system dark mode preference
  const [systemIsDark, setSystemIsDark] = useState(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = e => setSystemIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const activeMode = mode === 'auto' ? (systemIsDark ? 'dark' : 'light') : mode;
  const isDark = activeMode === 'dark' || activeMode === 'midnight';

  const currentColor = THEME_COLORS.find(c => c.id === themeColor) || THEME_COLORS[0];

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', activeMode);
    root.setAttribute('data-color', themeColor);

    // Set dynamic CSS properties on root
    root.style.setProperty('--color-primary', currentColor.primary);
    root.style.setProperty('--color-primary-hover', currentColor.hover);
    root.style.setProperty('--color-primary-light', currentColor.light);
    root.style.setProperty('--color-primary-border', currentColor.border);
    root.style.setProperty('--color-primary-ring', currentColor.ring);
  }, [activeMode, themeColor, currentColor]);

  const setMode = (newMode) => {
    setModeState(newMode);
    localStorage.setItem('cm_theme_mode', newMode);
  };

  const setThemeColor = (newColor) => {
    setThemeColorState(newColor);
    localStorage.setItem('cm_theme_color', newColor);
  };

  const toggleMode = () => {
    const next = isDark ? 'light' : 'dark';
    setMode(next);
  };

  const openThemeModal = () => setIsThemeModalOpen(true);
  const closeThemeModal = () => setIsThemeModalOpen(false);

  return (
    <ThemeContext.Provider value={{
      mode,
      setMode,
      activeMode,
      themeColor,
      setThemeColor,
      currentColor,
      isDark,
      toggleMode,
      isThemeModalOpen,
      openThemeModal,
      closeThemeModal,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

