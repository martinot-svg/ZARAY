'use client';

import { useEffect, useState, type Ref } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';
const KEY = 'zaray-interface-theme';

/** User controlled visual theme; never affects company, site, auth or payment data. */
export default function ThemeSwitch({ className = '', buttonRef, hideNativeTitle = false }: { className?: string; buttonRef?: Ref<HTMLButtonElement>; hideNativeTitle?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => {
    let initial: Theme = 'dark';
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') initial = saved;
    } catch {
      // Private browsing without storage retains a stable usable dark theme.
    }
    document.documentElement.setAttribute('data-zaray-theme', initial);
    setTheme(initial);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-zaray-theme', next);
    setTheme(next);
    try { window.localStorage.setItem(KEY, next); } catch { /* Non-persistent browsing. */ }
  }

  return <button ref={buttonRef} type="button" className={'zaray-theme-switch ' + className}
    onClick={toggle} aria-label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}
    title={hideNativeTitle ? undefined : theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
    aria-pressed={theme === 'light'}>
    <span className="zaray-theme-icon">
      {theme === 'dark' ? <Sun size={18} aria-hidden="true"/> : <Moon size={18} aria-hidden="true"/>}
    </span>
    <span className="zaray-theme-switch-label">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
  </button>;
}
