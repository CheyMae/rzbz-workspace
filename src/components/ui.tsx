import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
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
        <DropdownIcon open={open} />
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

export function MenuItem({ icon, children, onClick, danger }: { icon?: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" role="menuitem" className={`menu-item t-caption${danger ? ' menu-item-danger' : ''}`} onClick={onClick}>{icon}{children}</button>;
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

/**
 * Drag and drop between board columns. Cards call dragProps(id); columns spread dropProps(column).
 * Uses native HTML drag events (mouse and trackpad); the status dropdowns stay as the keyboard way.
 */
export function useBoardDrag(onMove: (id: string, column: string) => void) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData('text/x-rzbz-id', id); e.dataTransfer.effectAllowed = 'move'; setDragging(id); },
    onDragEnd: () => { setDragging(null); setOver(null); },
    'data-dragging': dragging === id || undefined,
  });
  const dropProps = (column: string) => ({
    onDragOver: (e: React.DragEvent) => { if (!dragging) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== column) setOver(column); },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === column ? null : o)); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/x-rzbz-id') || dragging;
      setDragging(null); setOver(null);
      if (id) onMove(id, column);
    },
    'data-drop-over': over === column || undefined,
  });
  return { dragProps, dropProps };
}

/** The Figma "Dropdown" icon (a small rounded triangle), used for collapsible groups outside the sidebar. */
export function DropdownIcon({ open, size = 20 }: { open: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="dropdown-icon" style={{ transform: open ? undefined : 'rotate(-90deg)' }}>
      <path fill="currentColor" d="M8.71 11.71l2.59 2.59a1 1 0 0 0 1.41 0l2.59-2.59A1 1 0 0 0 14.59 10H9.41a1 1 0 0 0-.7 1.71z" />
    </svg>
  );
}

/** "Are you sure?" for permanent deletes. */
export function ConfirmDelete({ title, children, confirmLabel, onConfirm, onClose }: {
  title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Dialog title={title} onClose={onClose} footer={<>
      <button type="button" className="btn btn-secondary btn-md" onClick={onClose} autoFocus>Cancel</button>
      <button type="button" className="btn btn-danger btn-md" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
    </>}>
      <p className="t-body">{children}</p>
      <p className="t-caption muted">This can’t be undone.</p>
    </Dialog>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return <div className="stat"><span className="t-title-section">{value}</span><span className="t-caption muted">{label}</span></div>;
}

export function Loading() {
  return <div className="page"><div className="skeleton-block" aria-busy="true" /></div>;
}
