import { useCallback, useEffect, useState } from 'react';

/** Per-viewer conveniences (last view, pinned projects). Kept in this browser only; safe if storage is blocked. */
function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem('rzbz.' + key); return v === null ? fallback : (JSON.parse(v) as T); }
  catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem('rzbz.' + key, JSON.stringify(value)); } catch { /* storage blocked: keep in memory */ }
  window.dispatchEvent(new CustomEvent('rzbz-pref', { detail: key }));
}

export function usePref<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent).detail === key) setValue(read(key, fallback)); };
    window.addEventListener('rzbz-pref', on);
    return () => window.removeEventListener('rzbz-pref', on);
  }, [key]);
  const set = useCallback((v: T) => { setValue(v); write(key, v); }, [key]);
  return [value, set];
}

export function usePinned() {
  const [ids, setIds] = usePref<string[]>('pinned', []);
  return {
    ids,
    isPinned: (id: string) => ids.includes(id),
    toggle: (id: string) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
  };
}
