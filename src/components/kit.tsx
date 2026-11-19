import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar } from './Avatar';
import type { Person } from '../lib/types';

/** Figma "Kbd": a key or shortcut, e.g. ⌘K. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd t-caption">{children}</kbd>;
}

/** Figma "Spinner" (sm 16 / md 20). */
export function Spinner({ size = 'sm', label }: { size?: 'sm' | 'md'; label?: string }) {
  return <span className={`spinner spinner-${size}`} role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

/** "Loading…" with a spinner, for small areas (Suspense fallbacks, panels). */
export function LoadingLine({ children = 'Loading…' }: { children?: ReactNode }) {
  return <p className="loading-line t-body muted"><Spinner />{children}</p>;
}

/**
 * Figma "Avatar" Type=Overflow + "Presence Stack": overlapped avatars, then +N.
 * Hover shows everyone's names.
 */
export function AvatarStack({ people, max = 3, size = 20 }: { people: Person[]; max?: number; size?: 20 | 24 | 32 }) {
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const extra = people.length - shown.length;
  return (
    <span className={`avatar-stack stack-${size}`} data-tip={people.map((p) => p.name).join(', ')}>
      {shown.map((p) => <Avatar key={p.id} name={p.name} size={size} />)}
      {extra > 0 && <span className="avatar avatar-overflow" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>+{extra}</span>}
      <span className="sr-only">{people.map((p) => p.name).join(', ')}</span>
    </span>
  );
}

/**
 * Figma "Tooltip" (with an optional shortcut). One bubble for the whole app.
 * Shows for anything with data-tip (and data-kbd for a shortcut), and for icon-only
 * buttons that have an aria-label. Appears after a short pause, or on keyboard focus.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; kbd?: string; x: number; y: number; below: boolean } | null>(null);
  const timer = useRef<number>();
  const current = useRef<Element | null>(null);

  useEffect(() => {
    const textOf = (el: Element) => {
      const t = el.getAttribute('data-tip');
      if (t) return t;
      const label = el.getAttribute('aria-label');
      // Icon-only buttons: an aria-label and no words on the button itself.
      if (label && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && !(el.textContent ?? '').trim()) return label;
      return null;
    };
    const find = (t: EventTarget | null) => {
      let el = t instanceof Element ? t : null;
      while (el && el !== document.body) {
        if (el.closest('[data-no-tip]')) return null;
        if (textOf(el)) return el;
        el = el.parentElement;
      }
      return null;
    };
    const hide = () => { window.clearTimeout(timer.current); current.current = null; setTip(null); };
    const show = (el: Element, delay: number) => {
      if (current.current === el) return;
      hide();
      current.current = el;
      timer.current = window.setTimeout(() => {
        if (!el.isConnected) return;
        const r = el.getBoundingClientRect();
        const below = r.top < 48;
        setTip({ text: textOf(el)!, kbd: el.getAttribute('data-kbd') ?? undefined, x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below });
      }, delay);
    };
    const over = (e: MouseEvent) => { const el = find(e.target); if (el) show(el, 450); else if (current.current) hide(); };
    const focus = (e: FocusEvent) => {
      const el = find(e.target);
      if (el && (e.target as Element).matches(':focus-visible')) show(el, 0);
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    document.addEventListener('mousedown', hide, true);
    document.addEventListener('keydown', hide, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('mousedown', hide, true);
      document.removeEventListener('keydown', hide, true);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  // Keep the bubble on screen.
  const ref = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  useEffect(() => {
    if (!tip || !ref.current) { setShift(0); return; }
    const r = ref.current.getBoundingClientRect();
    setShift(r.left < 8 ? 8 - r.left : r.right > window.innerWidth - 8 ? window.innerWidth - 8 - r.right : 0);
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={ref} className={`tooltip t-caption${tip.below ? ' below' : ''}`} role="tooltip"
      style={{ left: tip.x + shift, top: tip.y }}>
      <span>{tip.text}</span>
      {tip.kbd && <span className="tooltip-kbd">{tip.kbd}</span>}
    </div>
  );
}
