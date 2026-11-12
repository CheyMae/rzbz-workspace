import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, ExternalLink, MoreHorizontal, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { ConfirmDelete, GroupHeader, Loading, Menu, MenuItem, People, Progress, TagSelect } from '../components/ui';
import { priorityOptions } from '../components/tasks';
import { useData, useIndex } from '../lib/data';
import { PROJECT_STATUS, fmtDate } from '../lib/format';
import { usePinned } from '../lib/prefs';
import type { Project, ProjectStatus } from '../lib/types';

const TABS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'in_progress', label: 'In Progress' }, { value: 'paused', label: 'Paused' },
  { value: 'done', label: 'Done' }, { value: 'not_started', label: 'Not started' },
];
const statusOptions = (['not_started', 'in_progress', 'paused', 'waiting_for_feedback', 'done', 'canceled'] as ProjectStatus[])
  .map((s) => ({ value: s, ...PROJECT_STATUS[s] }));

/** Figma 04 · Projects: every current project, grouped by product. */
export function Projects() {
  const { ready, ws, updateProject, createProject, deleteProject } = useData();
  const [deleting, setDeleting] = useState<Project | null>(null);
  const ix = useIndex();
  const nav = useNavigate();
  const pins = usePinned();
  const [tab, setTab] = useState<ProjectStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [more, setMore] = useState<Set<string>>(new Set());
  if (!ready) return <Loading />;

  const count = (s: ProjectStatus) => ws.projects.filter((p) => p.status === s).length;
  const rows = ws.projects
    .filter((p) => tab === 'all' || p.status === tab)
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  const groups = new Map<string, { name: string; emoji: string | null; rows: Project[] }>();
  for (const p of rows) {
    const pr = ix.productOf(p);
    const key = pr?.id ?? 'none';
    if (!groups.has(key)) groups.set(key, { name: pr?.name ?? 'No product', emoji: pr?.emoji ?? '—', rows: [] });
    groups.get(key)!.rows.push(p);
  }
  const sorted = [...groups.entries()].sort((a, b) => (a[0] === 'none' ? 1 : b[0] === 'none' ? -1 : b[1].rows.length - a[1].rows.length));
  const order: ProjectStatus[] = ['in_progress', 'paused', 'waiting_for_feedback', 'not_started', 'done', 'canceled'];
  const toggle = (set: Set<string>, k: string) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); return n; };

  async function newProject() {
    const id = await createProject({ name: 'Untitled project', status: 'not_started', product_id: ix.holding?.id ?? null });
    if (id) nav(`/projects/${id}`);
  }

  return (
    <div className="page">
      <PageHeader emoji="📁" title="Projects" subtitle={`${ws.projects.length} projects, grouped by product`} />
      <div className="toolbar">
        <div className="view-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={tab === t.value}
              className={`view-tab t-caption${tab === t.value ? ' is-selected' : ''}`} onClick={() => setTab(t.value)}>
              {t.label} · {t.value === 'all' ? ws.projects.length : count(t.value)}
            </button>
          ))}
        </div>
        <span className="grow" />
        <label className="search-inline t-caption"><Search size={14} aria-hidden />
          <input placeholder="Find a project" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a project" />
        </label>
        <Button icon={<Plus size={14} />} onClick={newProject}>New project</Button>
      </div>

      <div className="table" role="table">
        <div className="tr th t-caption cols-projects" role="row">
          <span>Project</span><span>Status</span><span>Priority</span><span>Lead</span><span>End date</span><span>Progress</span><span />
        </div>
        {sorted.map(([key, g]) => {
          const list = g.rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name));
          const shown = more.has(key) ? list : list.slice(0, 4);
          return (
            <div key={key} role="rowgroup">
              <GroupHeader open={!closed.has(key)} count={list.length} onToggle={() => setClosed(toggle(closed, key))}>
                <span aria-hidden>{g.emoji} </span>{g.name}
              </GroupHeader>
              {!closed.has(key) && <>
                {shown.map((p) => {
                  const pr = ix.progress(ix.tasksOf(p));
                  const product = ix.productOf(p);
                  return (
                    <div key={p.id} className="tr t-body cols-projects" role="row">
                      <Link to={`/projects/${p.id}`} className="row-link">{p.emoji ?? product?.emoji} {p.name}</Link>
                      <span><TagSelect label={`Status of ${p.name}`} value={p.status} options={statusOptions}
                        onChange={(v) => v && updateProject(p.id, { status: v })} /></span>
                      <span><TagSelect label={`Priority of ${p.name}`} value={p.priority} options={priorityOptions} placeholder="—"
                        onChange={(v) => updateProject(p.id, { priority: v })} /></span>
                      <span className="t-caption"><People people={ix.people(p, 'lead')} /></span>
                      <span className="t-caption">{fmtDate(p.ends_on)}</span>
                      <span className="progress-cell t-caption"><Progress pct={pr.pct} /><span>{pr.total ? `${pr.pct}%` : '—'}</span></span>
                      <Menu trigger={(_, t) => <button type="button" className="icon-button" aria-label={`More for ${p.name}`} onClick={t}><MoreHorizontal size={16} /></button>}>
                        {(close) => <>
                          <MenuItem icon={<Pin size={14} />} onClick={() => { pins.toggle(p.id); close(); }}>{pins.isPinned(p.id) ? 'Unpin from sidebar' : 'Pin to sidebar'}</MenuItem>
                          <MenuItem icon={<ExternalLink size={14} />} onClick={() => nav(`/projects/${p.id}`)}>Open</MenuItem>
                          <MenuItem icon={<Archive size={14} />} onClick={() => { updateProject(p.id, { is_archived: true }); close(); }}>Move to archive</MenuItem>
                          <MenuItem icon={<Trash2 size={14} />} danger onClick={() => { setDeleting(p); close(); }}>Delete project</MenuItem>
                        </>}
                      </Menu>
                    </div>
                  );
                })}
                {list.length > 4 && (key === 'none' ? (
                  <button type="button" className="show-more t-caption muted" onClick={() => setMore(toggle(more, key))}>
                    {more.has(key) ? 'Show fewer' : `Show ${list.length - 4} more`}
                  </button>
                ) : (
                  // The rest of a product's projects live on its Product page (HR Stuff for the HR group).
                  <Link className="show-more t-caption muted plain-link"
                    to={ws.products.find((x) => x.id === key)?.kind === 'team' ? '/hr' : `/products/${key}`}>
                    Show {list.length - 4} more in {g.name} →
                  </Link>
                ))}
              </>}
            </div>
          );
        })}
        {!rows.length && <p className="t-body muted empty-row">No projects match.</p>}
      </div>
      {deleting && <DeleteProject project={deleting} taskCount={ix.tasksOf(deleting).length} onClose={() => setDeleting(null)}
        onConfirm={() => { pins.isPinned(deleting.id) && pins.toggle(deleting.id); deleteProject(deleting.id); }} />}
    </div>
  );
}

/** Confirmation for deleting a project, shared with the project page. */
export function DeleteProject({ project, taskCount, onConfirm, onClose }: { project: Project; taskCount: number; onConfirm: () => void; onClose: () => void }) {
  return (
    <ConfirmDelete title="Delete this project?" confirmLabel={taskCount ? `Delete project and ${taskCount} task${taskCount === 1 ? '' : 's'}` : 'Delete project'}
      onConfirm={onConfirm} onClose={onClose}>
      “{project.name}”{taskCount ? ` and its ${taskCount} task${taskCount === 1 ? '' : 's'}` : ''} will be removed everywhere.
      To keep it but hide it, use Move to archive instead.
    </ConfirmDelete>
  );
}
