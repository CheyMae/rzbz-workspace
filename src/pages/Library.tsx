import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { TextInput } from '../components/TextInput';
import { Dialog, GroupHeader, Loading, Tag } from '../components/ui';
import { useData } from '../lib/data';
import { fmtDate } from '../lib/format';
import type { LibraryItem } from '../lib/types';

const SECTION_EMOJI: Record<string, string> = { 'Asset Library': '🧩', 'Docs & Templates': '📄', 'All Figma Links': '🎨', 'Content Tracker': '📝', 'Data Study': '📈' };
const typeTone = (t: string | null) => {
  const s = (t ?? '').toLowerCase();
  if (s.includes('figma')) return 'blue';
  if (s.includes('process') || s.includes('kickoff')) return 'yellow';
  if (s.includes('component') || s.includes('token') || s.includes('icon') || s.includes('logo')) return 'green';
  return 'default';
};
const linkLabel = (url: string) => (/figma\.com/.test(url) ? 'Open in Figma ↗' : 'Open link ↗');

/** Figma 08 · Library. */
export function Library() {
  const { ready, ws, createLibraryItem } = useData();
  const [section, setSection] = useState('');
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const [more, setMore] = useState<Set<string>>(new Set());
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  if (!ready) return <Loading />;

  const sections = [...new Set(ws.library.map((l) => l.section))];
  const groupsAll = [...new Set(ws.library.map((l) => l.product_group).filter(Boolean))].sort() as string[];
  const rows = ws.library
    .filter((l) => !section || l.section === section)
    .filter((l) => !group || l.product_group === group)
    .filter((l) => !q || `${l.name} ${l.product_group ?? ''} ${l.type ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const bySection = new Map<string, LibraryItem[]>();
  for (const l of rows) (bySection.get(l.section) ?? bySection.set(l.section, []).get(l.section)!).push(l);
  const flip = (s: Set<string>, k: string) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; };

  return (
    <div className="page">
      <PageHeader emoji="📚" title="Library" subtitle={`${ws.library.length} links: Figma files, content trackers, docs and templates`} />
      <div className="toolbar">
        <div className="view-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!section} className={`view-tab t-caption${!section ? ' is-selected' : ''}`} onClick={() => setSection('')}>All · {ws.library.length}</button>
          {sections.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={section === s} className={`view-tab t-caption${section === s ? ' is-selected' : ''}`} onClick={() => setSection(s)}>
              {s} · {ws.library.filter((l) => l.section === s).length}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar">
        <label className="chip chip-green t-caption select-chip">Product:
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by product or group">
            <option value="">All</option>{groupsAll.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        <span className="grow" />
        <label className="search-inline t-caption"><Search size={14} aria-hidden />
          <input placeholder="Find a link" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a link" /></label>
        <Button icon={<Plus size={14} />} onClick={() => setAdding(true)}>New</Button>
      </div>
      <div className="table" role="table">
        <div className="tr th t-caption cols-library" role="row"><span>Name</span><span>Product / Group</span><span>Type</span><span>Link</span><span>Last edited</span></div>
        {[...bySection.entries()].map(([s, items]) => {
          const shown = more.has(s) ? items : items.slice(0, 5);
          return (
            <div key={s} role="rowgroup">
              <GroupHeader open={!closed.has(s)} onToggle={() => setClosed(flip(closed, s))} count={items.length}>{SECTION_EMOJI[s] ?? '🔗'} {s}</GroupHeader>
              {!closed.has(s) && <>
                {shown.map((l) => (
                  <div key={l.id} className="tr t-body cols-library" role="row">
                    <span>{SECTION_EMOJI[s] ?? '🔗'} {l.name}</span>
                    <span>{l.product_group ? <Tag>{l.product_group}</Tag> : <span className="muted">—</span>}</span>
                    <span>{l.type ? <Tag tone={typeTone(l.type)}>{l.type}</Tag> : <span className="muted">—</span>}</span>
                    <span className="t-caption">{l.url ? <a href={l.url} target="_blank" rel="noreferrer" className="link-strong">{linkLabel(l.url)}</a> : <span className="muted">—</span>}</span>
                    <span className="t-caption muted">{l.updated_at > l.created_at ? fmtDate(l.updated_at) : '—'}</span>
                  </div>
                ))}
                {items.length > 5 && <button type="button" className="show-more t-caption muted" onClick={() => setMore(flip(more, s))}>{more.has(s) ? 'Show fewer' : `Show ${items.length - 5} more`}</button>}
              </>}
            </div>
          );
        })}
        {!rows.length && <p className="t-body muted empty-row">Nothing matches.</p>}
      </div>
      {adding && <NewLink sections={sections} onClose={() => setAdding(false)} onSave={async (item) => { await createLibraryItem(item); setAdding(false); }} />}
    </div>
  );
}

function NewLink({ sections, onClose, onSave }: { sections: string[]; onClose: () => void; onSave: (i: { name: string; section: string; url: string; product_group: string | null; type: string | null }) => void }) {
  const [name, setName] = useState(''); const [url, setUrl] = useState('');
  const [section, setSection] = useState(sections[0] ?? 'All Figma Links');
  const [pg, setPg] = useState(''); const [type, setType] = useState('');
  return (
    <Dialog title="Add to the Library" onClose={onClose} footer={<>
      <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
      <Button size="md" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), section, url: url.trim(), product_group: pg.trim() || null, type: type.trim() || null })}>Add link</Button>
    </>}>
      <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <TextInput label="Link" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
      <label className="field"><span className="t-caption-emphasis">Section</span>
        <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>{sections.map((s) => <option key={s}>{s}</option>)}</select></label>
      <TextInput label="Product / Group" value={pg} onChange={(e) => setPg(e.target.value)} />
      <TextInput label="Type" placeholder="Figma file, Component, Design Process…" value={type} onChange={(e) => setType(e.target.value)} />
    </Dialog>
  );
}
