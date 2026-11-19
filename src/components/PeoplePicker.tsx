import { useState } from 'react';
import { Search } from 'lucide-react';
import { Avatar } from './Avatar';
import { DropdownIcon, Menu } from './ui';
import { firstName } from '../lib/format';
import type { Person } from '../lib/types';

/**
 * A compact people field: shows who's picked, opens a checkbox list.
 * Type to narrow the list; Enter ticks the first match.
 * Lists the given people (people who left are hidden) plus anyone already picked, so they can be removed.
 */
export function PeoplePicker({ people, selected, empty, onChange }: { people: Person[]; selected: Person[]; empty: string; onChange: (ids: string[]) => void }) {
  const ids = new Set(selected.map((p) => p.id));
  const [q, setQ] = useState('');
  const choices = [...people.filter((p) => p.active !== false || ids.has(p.id)), ...selected.filter((s) => !people.some((p) => p.id === s.id))];
  return (
    <Menu align="left" trigger={(_, t) => (
      <button type="button" className="people-button t-body" onClick={() => { setQ(''); t(); }}>
        {selected.length ? <><Avatar name={selected[0].name} size={20} /><span className="people-names">{selected.map(firstName).join(', ')}</span></> : <span className="muted">{empty}</span>}
        <DropdownIcon open size={16} />
      </button>
    )}>
      {() => {
        const needle = q.trim().toLowerCase();
        const list = choices.sort((a, b) => a.name.localeCompare(b.name)).filter((p) => !needle || p.name.toLowerCase().includes(needle));
        const toggle = (id: string, on: boolean) => { const n = new Set(ids); on ? n.add(id) : n.delete(id); onChange([...n]); };
        return (
        <div className="people-menu">
          <label className="people-search t-caption"><Search size={14} aria-hidden />
            <input autoFocus placeholder="Type a name" value={q} aria-label="Search people" onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) { e.preventDefault(); toggle(list[0].id, !ids.has(list[0].id)); setQ(''); } }} />
          </label>
        <div className="check-list menu-list">
          {list.map((p) => (
            <label key={p.id} className="t-caption">
              <input type="checkbox" checked={ids.has(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} /> {p.name}
            </label>
          ))}
          {!list.length && <p className="t-caption muted">No one matches “{q.trim()}”.</p>}
        </div>
        </div>
        );
      }}
    </Menu>
  );
}
