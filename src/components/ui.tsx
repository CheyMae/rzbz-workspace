import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { firstName, type Tone } from '../lib/format';
import type { Person } from '../lib/types';

/** Figma "Tag". */
export function Tag({ tone = 'default', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`tag tag-${tone} t-caption`} title={title}>{children}</span>;
}

/** A tag that is also a dropdown (status, priority). Native select keeps it keyboard- and screen-reader-friendly. */
export function TagSelect<T extends string>({ value, options, onChange, label, placeholder = '—' }: {
  value: T | null;
  options: { value: T; label: string; tone: Tone }[];
  onChange: (v: T | null) => void;
  label: string;
  placeholder?: string;
}) {
  const cur = options.find((o) => o.value === value);
  return (
    <span className={`tag-select tag tag-${cur?.tone ?? 'empty'} t-caption`}>
      <span aria-hidden>{cur?.label ?? placeholder}</span>
      <select aria-label={label} value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as T | null)}
        onClick={(e) => e.stopPropagation()}>
        {!cur && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </span>
  );
}

export function Progress({ pct, label }: { pct: number; label?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function People({ people, empty = '—' }: { people: Person[]; empty?: string }) {
  if (!people.length) return <span className="muted">{empty}</span>;
  return (
    <span className="people">
      <Avatar name={people[0].name} size={20} />
      <span>{people.map(firstName).join(', ')}</span>
    </span>
  );
}

/** Pill row of view switches (Board / List by product / Ownership …). */
export function ViewTabs<T extends string>({ tabs, value, onChange }: {
  tabs: { value: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="view-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={t.value === value} type="button"
          className={`view-tab t-caption${t.value === value ? ' is-selected' : ''}`} onClick={() => onChange(t.value)}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, onClear, tone = 'green' }: { children: ReactNode; onClear?: () => void; tone?: 'green' | 'sand' }) {
  return (
    <span className={`chip chip-${tone} t-caption`}>
      {children}
      {onClear && <button type="button" className="chip-x" aria-label="Clear" onClick={onClear}><X size={12} /></button>}
    </span>
  );
}

/** A collapsible group heading for tables (product, section, sprint). */
export function GroupHeader({ open, onToggle, children, count, right }: {
  open: boolean; onToggle: () => void; children: ReactNode; count?: number; right?: ReactNode;
}) {
  return (
    <div className="group-header">
      <button type="button" className="group-toggle" aria-expanded={open} onClick={onToggle}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="t-title-body">{children}</span>
        {count !== undefined && <span className="t-caption muted">{count}</span>}
      </button>
      {right && <span className="t-caption muted group-right">{right}</span>}
    </div>
  );
}

/** Small popover menu (row ⋯ menu, Add sprint). Closes on outside click and Escape. */
export function Menu({ trigger, children, align = 'right' }: {
  trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <span className="menu-anchor" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && <div className={`menu menu-${align}`} role="menu">{children(() => setOpen(false))}</div>}
    </span>
  );
}

export function MenuItem({ icon, children, onClick }: { icon?: ReactNode; children: ReactNode; onClick: () => void }) {
  return <button type="button" role="menuitem" className="menu-item t-caption" onClick={onClick}>{icon}{children}</button>;
}

export function Dialog({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog${wide ? ' dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="t-title-section">{title}</h2>
        {children}
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return <div className="stat"><span className="t-title-section">{value}</span><span className="t-caption muted">{label}</span></div>;
}

export function Loading() {
  return <div className="page"><div className="skeleton-block" aria-busy="true" /></div>;
}
