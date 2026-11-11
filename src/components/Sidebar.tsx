import { NavLink } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { mainNav, teamNav, footerNav, type NavItem } from '../nav';

function Item({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.path} end={item.path === '/'} className={({ isActive }) => `nav-item${isActive ? ' is-selected' : ''}`}>
      <ChevronRight size={14} className="nav-disclosure" aria-hidden />
      <span className="nav-emoji" aria-hidden>{item.emoji}</span>
      <span className="nav-label">{item.label}</span>
    </NavLink>
  );
}

/** Mirrors the Figma "App/Sidebar" component. */
export function Sidebar() {
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
      {mainNav.map((i) => <Item key={i.path} item={i} />)}
      <div className="nav-group-label t-caption-emphasis">Team</div>
      {teamNav.map((i) => <Item key={i.path} item={i} />)}
      <div className="nav-spacer" />
      {footerNav.map((i) => <Item key={i.path} item={i} />)}
    </nav>
  );
}
