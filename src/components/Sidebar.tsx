import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MoreHorizontal, Pin, PinOff, Plus, Search } from 'lucide-react';
import { mainNav, teamNav, footerNav, type NavItem } from '../nav';
import { usePinned, usePref } from '../lib/prefs';
import { useData, useIndex } from '../lib/data';
import { sprintState, todayISO } from '../lib/sprints';
import type { Project } from '../lib/types';
import { DropdownIcon, Menu, MenuItem } from './ui';
import { Kbd } from './kit';
import { SearchPalette } from './SearchPalette';

type Child = { key: string; to: string; emoji: string; label: string; state?: unknown; project?: Project; muted?: boolean };

/**
 * Figma "Sidebar Item": Level 0/1, Expanded true/false, Default/Hover/Selected,
 * with ··· and + on hover. The chevron opens the item's children; the label opens the page.
 */
function Item({ id, to, emoji, label, end, level = 0, kids, empty, expanded, onExpand, actions, state }: {
  id: string; to: string; emoji: string; label: string; end?: boolean; level?: 0 | 1;
  kids?: Child[]; empty?: string; expanded?: boolean; onExpand?: (id: string) => void; actions?: ReactNode; state?: unknown;
}) {
  const canExpand = !!onExpand;
  return (
    <>
      <div className={`nav-row level-${level}`}>
        <NavLink to={to} end={end} state={state} className={({ isActive }) => `nav-item${isActive && !state ? ' is-selected' : ''}`}>
          {canExpand
            ? <button type="button" className="nav-disclosure" aria-expanded={!!expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onExpand!(id); }}>
                <DropdownIcon open={!!expanded} size={14} />
              </button>
            : <span className="nav-disclosure" aria-hidden />}
          <span className="nav-emoji" aria-hidden>{emoji}</span>
          <span className="nav-label">{label}</span>
        </NavLink>
        {actions && <span className="nav-actions">{actions}</span>}
      </div>
      {expanded && (kids?.length
        ? kids.map((k) => <ChildItem key={k.key} k={k} />)
        : <div className="nav-empty t-caption muted">{empty ?? 'Nothing inside'}</div>)}
    </>
  );
}

function ChildItem({ k }: { k: Child }) {
  return (
    <div className="nav-row level-1">
      <NavLink to={k.to} state={k.state} className={({ isActive }) => `nav-item${isActive && !k.state ? ' is-selected' : ''}${k.muted ? ' is-muted' : ''}`}>
        <span className="nav-disclosure" aria-hidden />
        <span className="nav-emoji" aria-hidden>{k.emoji}</span>
        <span className="nav-label">{k.label}</span>
      </NavLink>
      {k.project && <span className="nav-actions"><ProjectActions project={k.project} /></span>}
    </div>
  );
}

/** ··· (pin / unpin) and + (new task) on a project in the sidebar. */
function ProjectActions({ project }: { project: Project }) {
  const pins = usePinned();
  const nav = useNavigate();
  const pinned = pins.isPinned(project.id);
  return (
    <>
      <Menu align="left" fixed trigger={(open, toggle) => (
        <button type="button" className="nav-action" aria-label={`More for ${project.name}`} aria-expanded={open} onClick={toggle}><MoreHorizontal size={14} /></button>
      )}>
        {(close) => <MenuItem icon={pinned ? <PinOff size={14} /> : <Pin size={14} />} onClick={() => { pins.toggle(project.id); close(); }}>{pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}</MenuItem>}
      </Menu>
      <button type="button" className="nav-action" aria-label={`New task in ${project.name}`}
        onClick={() => nav(`/projects/${project.id}`, { state: { newTask: Date.now() } })}><Plus size={14} /></button>
    </>
  );
}

/** Mirrors the Figma "App/Sidebar" component: main, Team, Pinned, then Archive and Settings at the bottom. */
export function Sidebar() {
  const pins = usePinned();
  const { ws, createProject, addProjectSprint } = useData();
  const ix = useIndex();
  const nav = useNavigate();
  const [open, setOpen] = usePref<string[]>('sidebar.expanded', []);
  const [searching, setSearching] = useState(false);
  const expand = (id: string) => setOpen(open.includes(id) ? open.filter((x) => x !== id) : [...open, id]);
  const isOpen = (id: string) => open.includes(id);

  // ⌘K / Ctrl+K opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !e.defaultPrevented) { e.preventDefault(); setSearching((s) => !s); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const today = todayISO();
  const { active, current } = useMemo(() => sprintState(ws.sprints, today), [ws.sprints, today]);
  const projectChild = (p: Project): Child => ({ key: p.id, to: `/projects/${p.id}`, emoji: p.emoji ?? ix.productOf(p)?.emoji ?? '📄', label: p.name, project: p });

  const children: Record<string, { kids: Child[]; empty: string }> = useMemo(() => {
    const activeIds = new Set(active.map((s) => s.id));
    const inSprint = new Set([
      ...ws.projectSprints.filter((l) => activeIds.has(l.sprint_id)).map((l) => l.project_id),
      ...ws.tasks.filter((t) => t.sprint_id && activeIds.has(t.sprint_id)).map((t) => t.project_id).filter(Boolean) as string[],
    ]);
    return {
      '/projects': { kids: ws.projects.filter((p) => inSprint.has(p.id)).map(projectChild), empty: 'No projects in this sprint' },
      '/sprints': {
        kids: ws.sprints.filter((s) => s.kind === 'sprint' && s.status !== 'closed').sort((a, b) => a.starts_on.localeCompare(b.starts_on))
          .map((s) => ({ key: s.id, to: `/sprints/${s.id}`, emoji: s.status === 'open' ? '🏃' : '🗓️', label: s.name })),
        empty: 'No open sprints',
      },
      '/products': { kids: ws.products.map((p) => ({ key: p.id, to: `/products/${p.id}`, emoji: p.emoji ?? '📦', label: p.name })), empty: 'No products yet' },
    };
  }, [ws, active]);

  const newProject = async () => {
    const id = await createProject({ name: 'Untitled project', status: 'not_started', product_id: ix.holding?.id ?? null });
    if (!id) return;
    if (current) await addProjectSprint(id, current.id);
    nav(`/projects/${id}`);
  };

  const navItem = (i: NavItem) => {
    const c = children[i.path];
    return (
      <Item key={i.path} id={i.path} to={i.path} emoji={i.emoji} label={i.label} end={i.path === '/'}
        kids={c?.kids} empty={c?.empty} expanded={!!c && isOpen(i.path)} onExpand={c ? expand : undefined}
        actions={i.path === '/projects' ? <button type="button" className="nav-action" aria-label="New project" onClick={newProject}><Plus size={14} /></button> : undefined} />
    );
  };

  const pinned = pins.ids.map((id) => ws.projects.find((p) => p.id === id)).filter(Boolean) as Project[];
  return (
    <nav className="sidebar" aria-label="Workspace">
      <div className="workspace">
        <span className="workspace-badge t-caption-emphasis" aria-hidden>R</span>
        <span className="t-body-emphasis">RZBZ Design Team</span>
      </div>
      <button className="search-field" type="button" onClick={() => setSearching(true)} data-no-tip>
        <Search size={16} aria-hidden />
        <span className="t-body">Search…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <div className="nav-gap" />
      {mainNav.map(navItem)}
      <div className="nav-group-label t-caption-emphasis">Team</div>
      {teamNav.map(navItem)}
      {pinned.length > 0 && <>
        <div className="nav-group-label t-caption-emphasis">Pinned</div>
        {pinned.map((p) => {
          // A pinned project opens to its unfinished tasks; clicking one opens its panel.
          const id = `pin:${p.id}`;
          const tasks = ws.tasks.filter((t) => t.project_id === p.id && t.status !== 'done' && t.status !== 'archived');
          return (
            <Item key={p.id} id={id} to={`/projects/${p.id}`} emoji={p.emoji ?? ix.productOf(p)?.emoji ?? '📄'} label={p.name}
              expanded={isOpen(id)} onExpand={expand} empty="No open tasks"
              kids={tasks.map((t) => ({ key: t.id, to: `/projects/${p.id}`, state: { openTask: t.id }, emoji: '☑️', label: t.title }))}
              actions={<ProjectActions project={p} />} />
          );
        })}
      </>}
      <div className="nav-spacer" />
      {footerNav.map(navItem)}
      {searching && <SearchPalette onClose={() => setSearching(false)} />}
    </nav>
  );
}
