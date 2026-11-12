import { PageHeader } from '../components/PageHeader';
import type { NavItem } from '../nav';

/** HR Stuff, Hiring People and Analytics: kept in the sidebar, empty for now. */
export function Placeholder({ item }: { item: NavItem }) {
  return (
    <div className="page">
      <PageHeader emoji={item.emoji} title={item.label} subtitle={item.blurb} />
      <div className="callout t-body"><span aria-hidden>🗒️</span><span>Nothing here yet.</span></div>
    </div>
  );
}
