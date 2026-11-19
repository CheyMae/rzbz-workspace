import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, ExternalLink, Search } from 'lucide-react';
import { useData, useIndex } from '../lib/data';
import { usePinned } from '../lib/prefs';
import { allNav } from '../nav';
import { Kbd } from './kit';

type Result = { id: string; group: string; emoji: string; label: string; sub?: string; external?: boolean; go: () => void };

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
/** Every word typed must appear somewhere in the text; earlier/whole-word matches rank higher. */
function score(text: string, words: string[]) {
  const t = norm(text);
  let s = 0;
  for (const w of words) {
    const i = t.indexOf(w);
    if (i < 0) return -1;
    s += (i === 0 ? 30 : /\W/.test(t[i - 1] ?? ' ') ? 15 : 0) + 10 - Math.min(i, 10);
  }
  return s;
}

const GROUP_LIMIT = 6;

/**
 * ⌘K search (Figma "Search Field" + "Menu Item"): pages, projects, tasks, sprints, products and library links.
 * Arrow keys move, Enter opens, Esc closes.
 */
export function SearchPalette({ onClose }: { onClose: () => void }) {
  const { ws } = useData();
  const ix = useIndex();
  const pins = usePinned();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const go = (to: string, state?: unknown) => () => { onClose(); nav(to, { state }); };

  const all = useMemo<Result[]>(() => {
    const projects = ws.projects.map((p) => ({
      id: `p-${p.id}`, group: 'Projects', emoji: p.emoji ?? ix.productOf(p)?.emoji ?? '📄', label: p.name,
      sub: ix.productOf(p)?.name, go: go(`/projects/${p.id}`),
    }));
    const tasks = ws.tasks.map((t) => {
      const project = t.project_id ? ws.projects.find((p) => p.id === t.project_id) : null;
      const to = project ? `/projects/${project.id}` : t.sprint_id ? `/sprints/${t.sprint_id}` : null;
      return to && {
        id: `t-${t.id}`, group: 'Tasks', emoji: t.status === 'done' ? '✅' : '☑️', label: t.title,
        sub: project?.name ?? ws.sprints.find((s) => s.id === t.sprint_id)?.name, go: go(to, { openTask: t.id }),
        extra: t.notes ?? '',
      };
    }).filter(Boolean) as (Result & { extra: string })[];
    const pages = allNav.map((n) => ({ id: `n-${n.path}`, group: 'Pages', emoji: n.emoji, label: n.label, sub: n.blurb, go: go(n.path) }));
    const sprints = ws.sprints.filter((s) => s.kind === 'sprint').map((s) => ({
      id: `s-${s.id}`, group: 'Sprints', emoji: s.status === 'open' ? '🏃' : '🗓️', label: s.name,
      sub: s.status === 'open' ? 'Open' : s.status === 'upcoming' ? 'Upcoming' : 'Closed', go: go(`/sprints/${s.id}`),
    }));
    const products = ws.products.map((p) => ({ id: `pr-${p.id}`, group: 'Products', emoji: p.emoji ?? '📦', label: p.name, go: go(`/products/${p.id}`) }));
    const library = ws.library.filter((l) => l.url).map((l) => ({
      id: `l-${l.id}`, group: 'Library', emoji: '📚', label: l.name, sub: [l.version, l.product_group].filter(Boolean).join(' · ') || l.section,
      external: true, go: () => { onClose(); window.open(l.url!, '_blank', 'noopener'); },
    }));
    return [...pages, ...projects, ...tasks, ...sprints, ...products, ...library];
  }, [ws]);

  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) {
      // Nothing typed: pinned projects, then the pages.
      const pinned = pins.ids.map((id) => all.find((r) => r.id === `p-${id}`)).filter(Boolean) as Result[];
      return [...pinned.map((r) => ({ ...r, group: 'Pinned' })), ...all.filter((r) => r.group === 'Pages')];
    }
    const groups = new Map<string, { r: Result; s: number }[]>();
    for (const r of all) {
      let s = score(`${r.label} ${r.sub ?? ''}`, words);
      if (s < 0 && 'extra' in r) s = score(String((r as { extra: string }).extra), words) >= 0 ? 1 : -1; // task notes count, but rank low
      if (s < 0) continue;
      if (!groups.has(r.group)) groups.set(r.group, []);
      groups.get(r.group)!.push({ r, s });
    }
    const order = ['Pages', 'Projects', 'Tasks', 'Sprints', 'Products', 'Library'];
    return order.flatMap((g) => (groups.get(g) ?? []).sort((a, b) => b.s - a.s).slice(0, GROUP_LIMIT).map((x) => x.r));
  }, [q, all, pins.ids]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); results[active]?.go(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
  };

  let lastGroup = '';
  // Rendered on <body> so it sits above the page, not inside the sidebar's stacking layer.
  return createPortal(
    <div className="scrim scrim-top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <label className="palette-field">
          <Search size={18} aria-hidden />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search projects, tasks, sprints, library…"
            role="combobox" aria-expanded aria-controls="palette-list" aria-activedescendant={results[active] ? `pal-${results[active].id}` : undefined} className="t-body" />
          <Kbd>Esc</Kbd>
        </label>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {results.length === 0 && <p className="palette-empty t-body muted">No results for “{q}”</p>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? (lastGroup = r.group) : null;
            return (
              <div key={r.id} role="presentation">
                {head && <div className="palette-group t-caption-emphasis">{head}</div>}
                <button type="button" id={`pal-${r.id}`} role="option" aria-selected={i === active}
                  className={`menu-item palette-item${i === active ? ' is-active' : ''}`}
                  onMouseMove={() => setActive(i)} onClick={r.go}>
                  <span className="nav-emoji" aria-hidden>{r.emoji}</span>
                  <span className="palette-label t-body">{r.label}</span>
                  {r.sub && <span className="palette-sub t-caption muted">{r.sub}</span>}
                  {r.external ? <ExternalLink size={14} className="palette-enter" aria-hidden />
                    : i === active && <CornerDownLeft size={14} className="palette-enter" aria-hidden />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot t-caption muted"><span><Kbd>↑</Kbd><Kbd>↓</Kbd> to move</span><span><Kbd>↵</Kbd> to open</span></div>
      </div>
    </div>,
    document.body,
  );
}
