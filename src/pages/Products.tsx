import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Loading, Tag } from '../components/ui';
import { useData, useIndex } from '../lib/data';
import { folderColor, plural } from '../lib/format';

/** The products the team designs for, with their current projects. */
export function Products() {
  const { ready, ws } = useData();
  const ix = useIndex();
  if (!ready) return <Loading />;
  return (
    <div className="page">
      <PageHeader emoji="📦" title="Products" subtitle="The products the team designs for." />
      <div className="product-grid">
        {ws.products.map((pr) => {
          const projects = ws.projects.filter((p) => ix.productOf(p)?.id === pr.id);
          const active = projects.filter((p) => p.status === 'in_progress');
          return (
            <section key={pr.id} className={`product-card folder-${folderColor(pr.name)}`}>
              <h2 className="t-title-subsection">{pr.emoji} {pr.name}</h2>
              <p className="t-caption muted">{plural(projects.length, 'project')} · {active.length} in progress</p>
              <ul className="plain-list">
                {active.slice(0, 5).map((p) => <li key={p.id}><Link to={`/projects/${p.id}`} className="plain-link t-caption">{p.name}</Link></li>)}
              </ul>
              {projects.length === 0 && <Tag>No current projects</Tag>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
