import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, Calendar, CheckSquare, Clock, MoreHorizontal, Pin, Plus, Tag as TagIcon, Trash2, Type, User, X } from 'lucide-react';
import { DeleteProject } from './Projects';
import { PeoplePicker } from '../components/PeoplePicker';
import { GroupHeader, Loading, Menu, MenuItem, TagSelect, ViewTabs } from '../components/ui';
import { NewTaskRow, TaskBoard, TaskDrawer, TaskRow, TaskTableHead, priorityOptions } from '../components/tasks';
import { useData, useIndex } from '../lib/data';
import { PROJECT_STATUS, fmtDate, plural } from '../lib/format';
import { sprintLabel, todayISO } from '../lib/sprints';
import { usePinned, usePref } from '../lib/prefs';
import type { ProjectStatus, Sprint, Task } from '../lib/types';

const statusOptions = (['not_started', 'in_progress', 'paused', 'waiting_for_feedback', 'done', 'canceled'] as ProjectStatus[])
  .map((s) => ({ value: s, ...PROJECT_STATUS[s] }));
/** Type: is this an existing screen, a revamp, or something new. */
const typeOptions = (['Existing', 'Revamp', 'New'] as const).map((t) => ({ value: t as string, label: t, tone: 'blue' as const }));

type View = 'sprint' | 'board';

/** Figma 05 · Project page. Sprints are a property here, with Add sprint. */
export function ProjectPage() {
  const { id } = useParams();
  const { ready, ws, updateProject, setProjectProduct, setProjectPeople, addProjectSprint, removeProjectSprint, deleteProject } = useData();
  const nav = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const ix = useIndex();
  const pins = usePinned();
  const [savedView, setView] = usePref<View>('project.view', 'sprint');
  const view: View = savedView === 'board' ? 'board' : 'sprint';
  const [open, setOpen] = useState<Task | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const p = ws.projects.find((x) => x.id === id);
  const [name, setName] = useState(p?.name ?? '');
  const [about, setAbout] = useState(p?.about ?? '');
  useEffect(() => { setName(p?.name ?? ''); setAbout(p?.about ?? ''); }, [p?.id]);

  if (!ready) return <Loading />;
  if (!p) return <div className="page"><p className="t-body">This project isn’t here. It may be archived. <Link to="/projects">Back to Projects</Link></p></div>;

  const today = todayISO();
  const product = ix.productOf(p);
  const leads = ix.people(p, 'lead');
  const support = ix.people(p, 'support');
  const owners = ix.people(p, 'owner');
  // Lead and support are designers only; anyone else can be the project owner.
  const designers = ws.people.filter((x) => x.is_designer);
  const others = ws.people.filter((x) => !x.is_designer && x.active !== false);
  const tasks = ix.tasksOf(p);
  const pr = ix.progress(tasks);
  const sprints = ix.projectSprints(p);
  const addable = ws.sprints.filter((s) => s.kind === 'sprint' && s.status !== 'closed' && !sprints.some((x) => x.id === s.id));
  const pinned = pins.isPinned(p.id);

  // Tasks grouped by sprint (newest first), or as a board.
  const bySprint = new Map<string, { sprint: Sprint | null; rows: Task[] }>();
  for (const t of tasks) {
    const k = t.sprint_id ?? 'none';
    if (!bySprint.has(k)) bySprint.set(k, { sprint: t.sprint_id ? ix.sprint.get(t.sprint_id) ?? null : null, rows: [] });
    bySprint.get(k)!.rows.push(t);
  }
  const sprintGroups = [...bySprint.entries()].sort((a, b) => (b[1].sprint?.starts_on ?? '0').localeCompare(a[1].sprint?.starts_on ?? '0'));
  const toggle = (k: string) => setClosed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const current = sprints.find((s) => s.status === 'open') ?? addable.find((s) => s.status === 'open');

  return (
    <div className="page page-doc">
      <div className="doc-top t-caption">
        <nav className="crumbs" aria-label="Breadcrumb"><Link to="/projects">📁 Projects</Link><span aria-hidden>/</span><span>{p.emoji ?? product?.emoji} {p.name}</span></nav>
        <span className="grow" />
        <button type="button" className={`btn btn-${pinned ? 'secondary' : 'ghost'}`} onClick={() => pins.toggle(p.id)}>
          <Pin size={14} /> {pinned ? 'Pinned' : 'Pin'}
        </button>
        <Menu trigger={(_, t) => <button type="button" className="icon-button" aria-label="More for this project" onClick={t}><MoreHorizontal size={16} /></button>}>
          {(close) => <>
            <MenuItem icon={<Archive size={14} />} onClick={() => { close(); updateProject(p.id, { is_archived: true }); nav('/projects'); }}>Move to archive</MenuItem>
            <MenuItem icon={<Trash2 size={14} />} danger onClick={() => { close(); setDeleting(true); }}>Delete project</MenuItem>
          </>}
        </Menu>
      </div>

      <header className="page-header">
        <span className="page-emoji" aria-hidden>{p.emoji ?? product?.emoji ?? '📄'}</span>
        <input className="title-input t-title-screen" value={name} aria-label="Project name"
          onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== p.name && updateProject(p.id, { name: name.trim() })} />
      </header>

      <dl className="props props-wide">
        <dt><TagIcon size={16} /> Status</dt>
        <dd><TagSelect label="Status" value={p.status} options={statusOptions} onChange={(v) => v && updateProject(p.id, { status: v })} /></dd>

        <dt><TagIcon size={16} /> Product</dt>
        <dd>
          <span className="tag tag-blue tag-select t-caption"><span aria-hidden>{product ? `${product.emoji ?? ''} ${product.name}` : 'No product'}</span>
            <select aria-label="Product" value={product?.id ?? ''} onChange={(e) => setProjectProduct(p.id, e.target.value || null)}>
              <option value="">No product</option>
              {ws.products.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </span>
        </dd>

        <dt><User size={16} /> Project owner</dt>
        <dd><PeoplePicker people={others} selected={owners} empty="—" onChange={(ids) => setProjectPeople(p.id, 'owner', ids)} /></dd>

        <dt><User size={16} /> Carry designers</dt>
        <dd><PeoplePicker people={designers} selected={leads} empty="No lead yet" onChange={(ids) => setProjectPeople(p.id, 'lead', ids)} /></dd>

        <dt><User size={16} /> Support</dt>
        <dd><PeoplePicker people={designers} selected={support} empty="—" onChange={(ids) => setProjectPeople(p.id, 'support', ids)} /></dd>

        <dt><Calendar size={16} /> Dates</dt>
        <dd className="date-pair">
          <input type="date" className="input input-plain" value={p.starts_on ?? ''} aria-label="Start date" onChange={(e) => updateProject(p.id, { starts_on: e.target.value || null })} />
          <span aria-hidden>→</span>
          <input type="date" className="input input-plain" value={p.ends_on ?? ''} aria-label="End date" onChange={(e) => updateProject(p.id, { ends_on: e.target.value || null })} />
        </dd>

        <dt><Clock size={16} /> Sprints</dt>
        <dd className="sprint-chips">
          {sprints.map((s) => {
            const hasTasks = tasks.some((t) => t.sprint_id === s.id);
            return (
              <span key={s.id} className="tag tag-default t-caption" title={sprintLabel(s, today)}>
                <Link to={`/sprints/${s.id}`} className="plain-link">{s.name}</Link>
                {!hasTasks && <button type="button" className="chip-x" aria-label={`Remove ${s.name}`} onClick={() => removeProjectSprint(p.id, s.id)}><X size={10} /></button>}
              </span>
            );
          })}
          {addable.length > 0 && (
            <Menu align="left" trigger={(_, t) => <button type="button" className="btn btn-ghost" onClick={t}><Plus size={14} /> Add sprint</button>}>
              {(close) => addable.map((s) => (
                <MenuItem key={s.id} onClick={() => { addProjectSprint(p.id, s.id); close(); }}>
                  {s.name} · {sprintLabel(s, today).toLowerCase()} · {fmtDate(s.starts_on, false)}
                </MenuItem>
              ))}
            </Menu>
          )}
        </dd>

        <dt><TagIcon size={16} /> Priority</dt>
        <dd><TagSelect label="Priority" value={p.priority} options={priorityOptions} onChange={(v) => updateProject(p.id, { priority: v })} /></dd>

        <dt><Type size={16} /> Type</dt>
        <dd><TagSelect label="Type" value={p.type} options={typeOptions} placeholder="—" onChange={(v) => updateProject(p.id, { type: v })} /></dd>

        <dt><CheckSquare size={16} /> Task progress</dt>
        <dd className="t-body">{pr.total ? `${pr.pct}% · ${pr.done} of ${plural(pr.total, 'task')} done` : 'No tasks yet'}</dd>
      </dl>

      <hr className="rule" />
      <section className="doc-section">
        <h2 className="t-title-subsection">About this project</h2>
        <label className="callout about t-body"><span aria-hidden>💡</span>
          <textarea rows={Math.max(2, Math.ceil((about.length || 1) / 90))} value={about} placeholder="What is this project for?"
            aria-label="About this project" onChange={(e) => setAbout(e.target.value)}
            onBlur={() => about !== (p.about ?? '') && updateProject(p.id, { about: about || null })} />
        </label>
      </section>

      <section className="doc-section">
        <div className="toolbar">
          <h2 className="t-title-section">Tasks <span className="t-caption muted">{tasks.length}</span></h2>
          <span className="grow" />
          <ViewTabs<View> value={view} onChange={setView} tabs={[
            { value: 'sprint', label: 'By sprint' }, { value: 'board', label: 'Board' },
          ]} />
        </div>
        {view === 'board' ? <TaskBoard tasks={tasks} onOpen={setOpen} showProject={false} newTask={{ project_id: p.id, sprint_id: current?.id ?? null }} /> : (
          <div className="table" role="table">
            <TaskTableHead cols={{ sprint: true }} />
            {view === 'sprint' && sprintGroups.map(([k, g]) => (
              <div key={k} role="rowgroup">
                <GroupHeader open={!closed.has(k)} onToggle={() => toggle(k)} count={g.rows.length}>
                  {g.sprint ? <>🏃 {g.sprint.name} <span className="t-caption muted">
                    · {sprintLabel(g.sprint, today).toLowerCase()} · {g.sprint.status === 'closed' ? 'ended' : 'ends'} {fmtDate(g.sprint.ends_on, false)}</span></> : 'No sprint'}
                </GroupHeader>
                {!closed.has(k) && g.rows.map((t) => <TaskRow key={t.id} task={t} onOpen={setOpen} cols={{ sprint: true }} />)}
              </div>
            ))}
            <NewTaskRow defaults={{ project_id: p.id, sprint_id: current?.id ?? null, status: 'not_started' }} />
          </div>
        )}
      </section>
      {open && <TaskDrawer task={open} onClose={() => setOpen(null)} />}
      {deleting && <DeleteProject project={p} taskCount={tasks.length} onClose={() => setDeleting(false)}
        onConfirm={() => { if (pinned) pins.toggle(p.id); deleteProject(p.id); nav('/projects'); }} />}
    </div>
  );
}
