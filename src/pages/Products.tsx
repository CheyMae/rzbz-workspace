import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Loading, Tag } from '../components/ui';
import { useData, useIndex } from '../lib/data';
import { folderColor, plural } from '../lib/format';

/** The products the team designs for. Each card opens that product's page with all its projects. */
export function Products() {
  const { ready, ws } = useData();
  const ix = useIndex();
  if (!ready) return <Loading />;
  return (
    <div className="page">
      <PageHeader emoji="📦" title="Products" subtitle="The products the team designs for. Open one to see all its projects." />
      <div className="product-grid">
        {ws.products.filter((p) => p.kind !== 'team').sort((a, b) => Number(a.kind === 'holding') - Number(b.kind === 'holding')).map((pr) => {
          const projects = ws.projects.filter((p) => ix.productOf(p)?.id === pr.id);
          const active = projects.filter((p) => p.status === 'in_progress');
          return (
            <Link key={pr.id} to={`/products/${pr.id}`} className={`product-card folder-${folderColor(pr.name)}`}>
              <h2 className="t-title-subsection">{pr.emoji} {pr.name}</h2>
              <p className="t-caption muted">{pr.kind === 'holding' ? `${plural(projects.length, 'project')} waiting for a product` : `${plural(projects.length, 'project')} · ${active.length} in progress`}</p>
              <ul className="plain-list">
                {active.slice(0, 5).map((p) => <li key={p.id} className="t-caption">{p.name}</li>)}
              </ul>
              {projects.length === 0 && <Tag>No current projects</Tag>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
