import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, PieChart, Search } from 'lucide-react';
import { GroupHeader, Loading, People, Progress, Stat, TagSelect, ViewTabs } from '../components/ui';
import { priorityOptions } from '../components/tasks';
import { useData, useIndex, type Index } from '../lib/data';
import { PROJECT_STATUS, fmtDate, folderColor, plural } from '../lib/format';
import { sprintLabel, todayISO } from '../lib/sprints';
import { usePref } from '../lib/prefs';
import type { Project, ProjectStatus, Sprint } from '../lib/types';

type View = 'sprint' | 'progress';

const STATUS_ORDER: ProjectStatus[] = ['in_progress', 'not_started', 'waiting_for_feedback', 'paused', 'done', 'canceled'];
const statusOptions = STATUS_ORDER.map((s) => ({ value: s, ...PROJECT_STATUS[s] }));

/** One product: every one of its projects, grouped by sprint or by progress. */
export function ProductPage({ productId, crumb }: { productId?: string; crumb?: { to: string; label: string } } = {}) {
  const params = useParams();
  const id = productId ?? params.id;
  const { ready, ws, updateProject } = useData();
  const ix = useIndex();
  const [view, setView] = usePref<View>('product.view', 'sprint');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  if (!ready) return <Loading />;
  const product = ws.products.find((p) => p.id === id);
  if (!product) return <div className="page"><p className="t-body">Nothing here yet. <Link to="/products">Back to Products</Link></p></div>;

  const today = todayISO();
  const projects = ws.projects.filter((p) => ix.productOf(p)?.id === product.id);
  const tasks = projects.flatMap((p) => ix.tasksOf(p));
  const pr = ix.progress(tasks);
  // Search narrows the list (by project name or lead); the summary above still counts every project.
  const needle = q.trim().toLowerCase();
  const listed = needle ? projects.filter((p) => `${p.name} ${ix.people(p, 'lead').map((x) => x.name).join(' ')}`.toLowerCase().includes(needle)) : projects;
  const toggle = (k: string) => setClosed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // By sprint: each project sits under the newest sprint it belongs to (linked, or through its tasks).
  const latestSprint = (p: Project): Sprint | null => {
    const ids = new Set([...ix.projectSprints(p).map((s) => s.id), ...ix.tasksOf(p).map((t) => t.sprint_id).filter(Boolean) as string[]]);
    return [...ids].map((i) => ix.sprint.get(i)).filter((s): s is Sprint => !!s && s.kind === 'sprint')
      .sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0] ?? null;
  };
  type G = { key: string; title: React.ReactNode; note?: string; rows: Project[] };
  let groups: G[];
  if (view === 'sprint') {
    const m = new Map<string, { sprint: Sprint | null; rows: Project[] }>();
    for (const p of listed) {
      const s = latestSprint(p);
      const k = s?.id ?? 'none';
      if (!m.has(k)) m.set(k, { sprint: s, rows: [] });
      m.get(k)!.rows.push(p);
    }
    groups = [...m.entries()]
      .sort((a, b) => (b[1].sprint?.starts_on ?? '0').localeCompare(a[1].sprint?.starts_on ?? '0'))
      .map(([k, g]) => ({
        key: k,
        title: g.sprint ? <>🏃 {g.sprint.name}</> : 'No sprint',
        note: g.sprint ? `${sprintLabel(g.sprint, today).toLowerCase()} · ${fmtDate(g.sprint.starts_on, false)} → ${fmtDate(g.sprint.ends_on, false)}` : undefined,
        rows: g.rows.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name)),
      }));
  } else {
    groups = STATUS_ORDER.map((st) => ({
      key: st,
      title: PROJECT_STATUS[st].label,
      rows: listed.filter((p) => p.status === st).sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((g) => g.rows.length);
  }

  return (
    <div className="page">
      <div className="doc-top t-caption">
        <nav className="crumbs" aria-label="Breadcrumb"><Link to={crumb?.to ?? '/products'}>{crumb?.label ?? '📦 Products'}</Link><span aria-hidden>/</span><span>{product.emoji} {product.name}</span></nav>
      </div>
      <header className="page-header">
        <span className="page-emoji" aria-hidden>{product.emoji ?? '📦'}</span>
        <h1 className="t-title-screen">{product.name}</h1>
        <p className="t-body muted">{plural(projects.length, 'project')} · {projects.filter((p) => p.status === 'in_progress').length} in progress</p>
      </header>

      <section className={`sprint-card product-summary folder-${folderColor(product.name)}`}>
        <div className="sprint-main">
          <div className="sprint-progress">
            <div className="sprint-progress-label t-caption-emphasis"><span>{pr.done} of {plural(pr.total, 'task')} done</span><span className="muted">{pr.pct}%</span></div>
            <Progress pct={pr.pct} />
          </div>
          {(['in_progress', 'not_started', 'paused', 'done'] as ProjectStatus[]).map((s) => (
            <Stat key={s} value={projects.filter((p) => (s === 'paused' ? p.status === 'paused' || p.status === 'waiting_for_feedback' : p.status === s)).length} label={PROJECT_STATUS[s].label.toLowerCase()} />
          ))}
        </div>
      </section>

      <div className="toolbar">
        <ViewTabs<View> value={view} onChange={setView} tabs={[
          { value: 'sprint', label: 'By sprint', icon: <Clock size={14} /> },
          { value: 'progress', label: 'By progress', icon: <PieChart size={14} /> },
        ]} />
        <span className="grow" />
        <label className="search-inline t-caption"><Search size={14} aria-hidden />
          <input placeholder="Find a project" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Find a project in ${product.name}`} />
        </label>
      </div>

      <div className="table" role="table">
        <div className="tr th t-caption cols-product" role="row">
          <span>Project</span><span>Status</span><span>Priority</span><span>Lead</span><span>End date</span><span>Progress</span>
        </div>
        {groups.map((g) => (
          <div key={g.key} role="rowgroup">
            <GroupHeader open={!closed.has(g.key)} count={g.rows.length} onToggle={() => toggle(g.key)} right={g.note}>{g.title}</GroupHeader>
            {!closed.has(g.key) && g.rows.map((p) => <Row key={p.id} p={p} ix={ix} onStatus={(v) => updateProject(p.id, { status: v })} onPriority={(v) => updateProject(p.id, { priority: v })} emoji={product.emoji} />)}
          </div>
        ))}
        {!projects.length && <p className="t-body muted empty-row">No projects for {product.name} yet.</p>}
        {projects.length > 0 && !listed.length && <p className="t-body muted empty-row">No projects match “{q.trim()}”.</p>}
      </div>
    </div>
  );
}

function Row({ p, ix, emoji, onStatus, onPriority }: {
  p: Project; ix: Index; emoji: string | null;
  onStatus: (v: ProjectStatus) => void; onPriority: (v: Project['priority']) => void;
}) {
  const pr = ix.progress(ix.tasksOf(p));
  return (
    <div className="tr t-body cols-product" role="row">
      <Link to={`/projects/${p.id}`} className="row-link">{p.emoji ?? emoji} {p.name}</Link>
      <span><TagSelect label={`Status of ${p.name}`} value={p.status} options={statusOptions} onChange={(v) => v && onStatus(v)} /></span>
      <span><TagSelect label={`Priority of ${p.name}`} value={p.priority} options={priorityOptions} placeholder="—" onChange={onPriority} /></span>
      <span className="t-caption"><People people={ix.people(p, 'lead')} /></span>
      <span className="t-caption">{fmtDate(p.ends_on)}</span>
      <span className="progress-cell t-caption"><Progress pct={pr.pct} /><span>{pr.total ? `${pr.pct}%` : '—'}</span></span>
    </div>
  );
}
