import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, Clock, ExternalLink, Folder, List, MoreHorizontal, Package, Pin, Plus, Search, Tag as TagIcon, Trash2, Type, User, Users } from 'lucide-react';
import { FilterBar, type FilterField, type Filters } from '../components/filters';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { ConfirmDelete, GroupHeader, Loading, Menu, MenuItem, People, Progress, Tag, TagSelect, ViewTabs } from '../components/ui';
import { ProjectFolder } from '../components/ProjectFolder';
import { priorityOptions } from '../components/tasks';
import { useData, useIndex } from '../lib/data';
import { PRIORITY, PROJECT_STATUS, firstName, fmtDate, folderColor } from '../lib/format';
import { todayISO } from '../lib/sprints';
import { usePinned, usePref } from '../lib/prefs';
import type { Project, ProjectStatus } from '../lib/types';

const TABS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'in_progress', label: 'In Progress' }, { value: 'paused', label: 'Paused' },
  { value: 'done', label: 'Done' }, { value: 'not_started', label: 'Not started' },
];
/** Folders shown per product before "Show more". */
const FOLDER_LIMIT = 8;
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
  const [filters, setFilters] = usePref<Filters>('projects.filters', {});
  const [view, setView] = usePref<'folders' | 'list'>('projects.view', 'folders');
  if (!ready) return <Loading />;

  // HR projects only show under Team › HR Stuff.
  const all = ws.projects.filter((p) => !ix.isTeam(p));
  const today = todayISO();
  const designers = ws.people.filter((x) => x.is_designer);
  const personOpts = (list: typeof ws.people) => list.map((x) => ({ value: x.id, label: x.name }));
  const fields: FilterField[] = [
    { key: 'product', label: 'Product', icon: <Package size={14} />, options: ws.products.filter((x) => x.id !== ix.team?.id).map((x) => ({ value: x.id, label: x.name, emoji: x.emoji ?? undefined })) },
    { key: 'priority', label: 'Priority', icon: <TagIcon size={14} />, options: [...priorityOptions.map((o) => ({ value: o.value, label: o.label })), { value: 'none', label: 'No priority' }] },
    { key: 'lead', label: 'Lead', icon: <User size={14} />, options: personOpts(designers), searchable: true },
    { key: 'support', label: 'Support', icon: <Users size={14} />, options: personOpts(designers), searchable: true },
    { key: 'type', label: 'Type', icon: <Type size={14} />, options: ['Existing', 'Revamp', 'New'].map((t) => ({ value: t, label: t })) },
    { key: 'sprint', label: 'Sprint', icon: <Clock size={14} />, searchable: true,
      options: ws.sprints.filter((x) => x.kind === 'sprint').sort((a, b) => b.starts_on.localeCompare(a.starts_on)).map((x) => ({ value: x.id, label: x.name })) },
  ];
  const any = (key: string, vals: string[]) => { const f = filters[key]; return !f?.length || vals.some((v) => f.includes(v)); };
  const matches = (p: Project) =>
    any('product', [ix.productOf(p)?.id ?? '']) &&
    any('priority', [p.priority ?? 'none']) &&
    any('lead', ix.people(p, 'lead').map((x) => x.id)) &&
    any('support', ix.people(p, 'support').map((x) => x.id)) &&
    any('type', [p.type ?? '']) &&
    any('sprint', ix.projectSprints(p).map((x) => x.id));
  const filtering = Object.values(filters).some((v) => v.length > 0);

  const count = (s: ProjectStatus) => all.filter((p) => p.status === s && matches(p)).length;
  const rows = all
    .filter((p) => tab === 'all' || p.status === tab)
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .filter(matches);

  const groups = new Map<string, { name: string; emoji: string | null; rows: Project[] }>();
  for (const p of rows) {
    const pr = ix.productOf(p);
    const key = pr?.id ?? 'none';
    if (!groups.has(key)) groups.set(key, { name: pr?.name ?? 'No product', emoji: pr?.emoji ?? '—', rows: [] });
    groups.get(key)!.rows.push(p);
  }
  // Biggest product first; Organize (waiting for a product) and No product go last, as on Products.
  const rank = (k: string) => (k === 'none' ? 2 : k === ix.holding?.id ? 1 : 0);
  const sorted = [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1].rows.length - a[1].rows.length);
  const order: ProjectStatus[] = ['in_progress', 'paused', 'waiting_for_feedback', 'not_started', 'done', 'canceled'];
  const toggle = (set: Set<string>, k: string) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); return n; };

  async function newProject() {
    const id = await createProject({ name: 'Untitled project', status: 'not_started', product_id: ix.holding?.id ?? null });
    if (id) nav(`/projects/${id}`);
  }

  return (
    <div className="page">
      <PageHeader emoji="📁" title="Projects" subtitle={`${all.length} projects, grouped by product`} />
      <div className="toolbar">
        <div className="view-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={tab === t.value}
              className={`view-tab t-caption${tab === t.value ? ' is-selected' : ''}`} onClick={() => setTab(t.value)}>
              {t.label} · {t.value === 'all' ? all.filter(matches).length : count(t.value)}
            </button>
          ))}
        </div>
        <span className="grow" />
        <ViewTabs<'folders' | 'list'> value={view} onChange={setView} tabs={[
          { value: 'folders', label: 'Folders', icon: <Folder size={14} /> },
          { value: 'list', label: 'List', icon: <List size={14} /> },
        ]} />
        <label className="search-inline t-caption"><Search size={14} aria-hidden />
          <input placeholder="Find a project" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a project" />
        </label>
        <Button icon={<Plus size={14} />} onClick={newProject}>New project</Button>
      </div>
      <FilterBar fields={fields} value={filters} onChange={setFilters} />

      {view === 'folders' && (
        <div className="folder-sections">
          {sorted.map(([key, g]) => {
            const list = g.rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name));
            const showAll = filtering || !!q || more.has(key);
            const shown = showAll ? list : list.slice(0, FOLDER_LIMIT);
            const active = list.filter((p) => p.status === 'in_progress').length;
            return (
              <section key={key} aria-label={g.name}>
                <GroupHeader open={!closed.has(key)} count={list.length} onToggle={() => setClosed(toggle(closed, key))}
                  right={key === 'none' || ix.holding?.id === key ? undefined : `${active} in progress`}>
                  <span aria-hidden>{g.emoji} </span>{g.name}
                </GroupHeader>
                {!closed.has(key) && <>
                  <div className="folder-grid">
                    {shown.map((p) => {
                      const pr = ix.progress(ix.tasksOf(p));
                      const product = ix.productOf(p);
                      const lead = ix.people(p, 'lead')[0];
                      return (
                        <ProjectFolder key={p.id} to={`/projects/${p.id}`} color={folderColor(product?.name)} emoji={p.emoji ?? product?.emoji} name={p.name}
                          tags={<>
                            <Tag tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Tag>
                            {p.priority && <Tag tone={PRIORITY[p.priority].tone}>{PRIORITY[p.priority].label}</Tag>}
                          </>}
                          done={pr.done} total={pr.total}
                          pill={lead ? firstName(lead) : 'No lead yet'}
                          date={p.ends_on ? fmtDate(p.ends_on, false) : 'No due date'}
                          dateWarn={!!p.ends_on && p.ends_on < today && p.status !== 'done' && p.status !== 'canceled'} />
                      );
                    })}
                  </div>
                  {list.length > FOLDER_LIMIT && !(filtering || q) && (
                    <button type="button" className="show-more t-caption muted" onClick={() => setMore(toggle(more, key))}>
                      {more.has(key) ? 'Show fewer' : `Show ${list.length - FOLDER_LIMIT} more`}
                    </button>
                  )}
                </>}
              </section>
            );
          })}
          {!rows.length && <p className="t-body muted empty-row">No projects match.</p>}
        </div>
      )}

      {view === 'list' && <div className="table" role="table">
        <div className="tr th t-caption cols-projects" role="row">
          <span>Project</span><span>Status</span><span>Priority</span><span>Lead</span><span>End date</span><span>Progress</span><span />
        </div>
        {sorted.map(([key, g]) => {
          const list = g.rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name));
          const showAll = filtering || !!q || more.has(key);
          const shown = showAll ? list : list.slice(0, 4);
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
                {list.length > 4 && !(filtering || q) && (key === 'none' ? (
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
      </div>}
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
