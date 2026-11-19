import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';

export type FilterOption = { value: string; label: string; emoji?: string };
export type FilterField = { key: string; label: string; icon: ReactNode; options: FilterOption[]; searchable?: boolean };
/** Chosen values per field. Within a field any value matches; across fields all must match. */
export type Filters = Record<string, string[]>;

/**
 * Figma "Filter Chip" (Active / Add): a green chip per filter (click to change, ✕ to remove)
 * and "+ Add filter", which lists the properties you can filter by.
 */
export function FilterBar({ fields, value, onChange }: { fields: FilterField[]; value: Filters; onChange: (f: Filters) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Chips stay in the order they were added.
  const active = Object.keys(value).map((k) => fields.find((f) => f.key === k)).filter(Boolean) as FilterField[];
  const unused = fields.filter((f) => !(f.key in value));

  const set = (key: string, vals: string[]) => onChange({ ...value, [key]: vals });
  const remove = (key: string) => { const n = { ...value }; delete n[key]; onChange(n); };
  // Closing a filter with nothing picked removes it.
  const closeEditor = () => { if (editing && !(value[editing]?.length)) remove(editing); setEditing(null); };

  const summary = (f: FilterField) => {
    const picked = value[f.key] ?? [];
    if (!picked.length) return 'Any';
    const names = picked.map((v) => f.options.find((o) => o.value === v)?.label ?? v);
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  };

  return (
    <div className="filter-bar" role="group" aria-label="Filters">
      {active.map((f) => (
        <Popover key={f.key} open={editing === f.key} onClose={closeEditor} anchor={
          <span className="chip chip-green filter-chip t-caption">
            <button type="button" className="filter-chip-main" aria-haspopup="dialog" aria-expanded={editing === f.key}
              onClick={() => (editing === f.key ? closeEditor() : setEditing(f.key))}>
              {f.label}: {summary(f)}<ChevronDown size={12} aria-hidden />
            </button>
            <button type="button" className="chip-x" aria-label={`Remove ${f.label} filter`} onClick={() => remove(f.key)}><X size={12} /></button>
          </span>
        }>
          <OptionList field={f} picked={value[f.key] ?? []} onChange={(v) => set(f.key, v)} />
        </Popover>
      ))}
      {unused.length > 0 && (
        <Popover open={adding} onClose={() => setAdding(false)} anchor={
          <button type="button" className="chip chip-sand filter-add t-caption" aria-haspopup="menu" aria-expanded={adding} onClick={() => setAdding(!adding)}>
            <Plus size={12} aria-hidden />Add filter
          </button>
        }>
          <div role="menu" className="filter-fields">
            <span className="notes-menu-title t-caption muted">Filter by</span>
            {unused.map((f) => (
              <button key={f.key} type="button" role="menuitem" className="menu-item t-caption"
                onClick={() => { setAdding(false); onChange({ ...value, [f.key]: [] }); setEditing(f.key); }}>
                {f.icon}{f.label}
              </button>
            ))}
          </div>
        </Popover>
      )}
      {active.length > 1 && <button type="button" className="filter-clear t-caption muted" onClick={() => { setEditing(null); onChange({}); }}>Clear filters</button>}
    </div>
  );
}

/** Checkbox list of values (with a search box for long lists, e.g. people). */
function OptionList({ field, picked, onChange }: { field: FilterField; picked: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const shown = field.options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (v: string) => onChange(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]);
  return (
    <div className="filter-options" role="dialog" aria-label={`${field.label} filter`}>
      {field.searchable && (
        <label className="people-search"><Search size={14} aria-hidden />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${field.label.toLowerCase()}`} aria-label={`Find ${field.label.toLowerCase()}`} />
        </label>
      )}
      <div className="menu-list" role="listbox" aria-multiselectable>
        {shown.map((o) => {
          const on = picked.includes(o.value);
          return (
            <button key={o.value} type="button" role="option" aria-selected={on} className="menu-item t-caption filter-option" onClick={() => toggle(o.value)}>
              <span className={`filter-check${on ? ' is-on' : ''}`} aria-hidden>{on && <Check size={12} />}</span>
              {o.emoji && <span aria-hidden>{o.emoji}</span>}{o.label}
            </button>
          );
        })}
        {!shown.length && <p className="t-caption muted filter-none">No matches</p>}
      </div>
    </div>
  );
}

/** A small panel under its anchor; closes on outside click or Esc. */
function Popover({ anchor, open, onClose, children }: { anchor: ReactNode; open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  return (
    <span className="menu-anchor" ref={ref}>
      {anchor}
      {open && <div className="menu filter-pop">{children}</div>}
    </span>
  );
}
