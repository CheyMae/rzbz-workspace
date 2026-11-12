import { NavLink } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { mainNav, teamNav, footerNav, type NavItem } from '../nav';
import { usePinned } from '../lib/prefs';
import { useData, useIndex } from '../lib/data';

function Item({ to, emoji, label, end }: { to: string; emoji: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' is-selected' : ''}`}>
      <ChevronRight size={14} className="nav-disclosure" aria-hidden />
      <span className="nav-emoji" aria-hidden>{emoji}</span>
      <span className="nav-label">{label}</span>
    </NavLink>
  );
}
const navItem = (i: NavItem) => <Item key={i.path} to={i.path} emoji={i.emoji} label={i.label} end={i.path === '/'} />;

/** Mirrors the Figma "App/Sidebar" component: main, Team, Pinned, then Archive and Settings at the bottom. */
export function Sidebar() {
  const pins = usePinned();
  const { ws } = useData();
  const ix = useIndex();
  const pinned = pins.ids.map((id) => ws.projects.find((p) => p.id === id)).filter(Boolean);
  return (
    <nav className="sidebar" aria-label="Workspace">
      <div className="workspace">
        <span className="workspace-badge t-caption-emphasis" aria-hidden>R</span>
        <span className="t-body-emphasis">RZBZ Design Team</span>
      </div>
      <button className="search-field" type="button" disabled title="Search is coming soon">
        <Search size={16} aria-hidden />
        <span className="t-body">Search…</span>
        <kbd className="t-caption">⌘K</kbd>
      </button>
      <div className="nav-gap" />
      {mainNav.map(navItem)}
      <div className="nav-group-label t-caption-emphasis">Team</div>
      {teamNav.map(navItem)}
      {pinned.length > 0 && <>
        <div className="nav-group-label t-caption-emphasis">Pinned</div>
        {pinned.map((p) => <Item key={p!.id} to={`/projects/${p!.id}`} emoji={p!.emoji ?? ix.productOf(p!)?.emoji ?? '📄'} label={p!.name} />)}
      </>}
      <div className="nav-spacer" />
      {footerNav.map(navItem)}
    </nav>
  );
}
