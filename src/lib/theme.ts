import { useEffect, useState } from 'react';

/** Light / Dark / System (follows the computer). Saved per browser; index.html applies it before first paint. */
export type Theme = 'system' | 'light' | 'dark';
const KEY = 'rzbz.theme';

export function readTheme(): Theme {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    applyTheme(theme);
    try { theme === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, theme); } catch { /* private window */ }
  }, [theme]);
  return [theme, setTheme];
}
