import { Avatar } from './Avatar';
import { DropdownIcon, Menu } from './ui';
import { firstName } from '../lib/format';
import type { Person } from '../lib/types';

/**
 * A compact people field: shows who's picked, opens a checkbox list.
 * Lists the given people (people who left are hidden) plus anyone already picked, so they can be removed.
 */
export function PeoplePicker({ people, selected, empty, onChange }: { people: Person[]; selected: Person[]; empty: string; onChange: (ids: string[]) => void }) {
  const ids = new Set(selected.map((p) => p.id));
  const choices = [...people.filter((p) => p.active !== false || ids.has(p.id)), ...selected.filter((s) => !people.some((p) => p.id === s.id))];
  return (
    <Menu align="left" trigger={(_, t) => (
      <button type="button" className="people-button t-body" onClick={t}>
        {selected.length ? <><Avatar name={selected[0].name} size={20} /><span className="people-names">{selected.map(firstName).join(', ')}</span></> : <span className="muted">{empty}</span>}
        <DropdownIcon open size={16} />
      </button>
    )}>
      {() => (
        <div className="check-list menu-list">
          {choices.sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
            <label key={p.id} className="t-caption">
              <input type="checkbox" checked={ids.has(p.id)} onChange={(e) => {
                const n = new Set(ids); e.target.checked ? n.add(p.id) : n.delete(p.id); onChange([...n]);
              }} /> {p.name}
            </label>
          ))}
        </div>
      )}
    </Menu>
  );
}
