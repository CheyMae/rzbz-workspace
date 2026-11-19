import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Archive, Calendar, CheckSquare, Clock, LayoutGrid, MoreHorizontal, Pin, Plus, Tag as TagIcon, Trash2, Type, User, X } from 'lucide-react';
import { DeleteProject } from './Projects';
import { PeoplePicker } from '../components/PeoplePicker';
import { Button } from '../components/Button';
import { GroupHeader, Loading, Menu, MenuItem, TagSelect, ViewTabs } from '../components/ui';
import { NewTaskRow, TaskBoard, TaskDrawer, TaskRow, TaskTableHead, priorityOptions } from '../components/tasks';
import { useData, useIndex } from '../lib/data';
import { LoadingLine } from '../components/kit';
import { PROJECT_STATUS, fmtDate, plural } from '../lib/format';
import { sprintLabel, todayISO } from '../lib/sprints';
import { usePinned, usePref } from '../lib/prefs';
import type { ProjectStatus, Sprint, Task } from '../lib/types';

const NotesEditor = lazy(() => import('../components/notes/NotesEditor').then((m) => ({ default: m.NotesEditor })));

const statusOptions = (['not_started', 'in_progress', 'paused', 'waiting_for_feedback', 'done', 'canceled'] as ProjectStatus[])
  .map((s) => ({ value: s, ...PROJECT_STATUS[s] }));
/** Type: is this an existing screen, a revamp, or something new. */
const typeOptions = (['Existing', 'Revamp', 'New'] as const).map((t) => ({ value: t as string, label: t, tone: 'blue' as const }));

type View = 'sprint' | 'board';

/** Figma 05 · Project page. Sprints are a property here, with Add sprint. */
export function ProjectPage() {
  const { id } = useParams();
  const { ready, ws, updateProject, setProjectProduct, setProjectPeople, addProjectSprint, removeProjectSprint, deleteProject, createTask } = useData();
  const nav = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const ix = useIndex();
  const pins = usePinned();
  // Board is the default (a new pref key, so everyone starts on Board once).
  const [savedView, setView] = usePref<View>('project.taskView', 'board');
  const view: View = savedView === 'sprint' ? 'sprint' : 'board';
  const [open, setOpen] = useState<{ task: Task; isNew?: boolean } | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const p = ws.projects.find((x) => x.id === id);
  const [name, setName] = useState(p?.name ?? '');
  useEffect(() => { setName(p?.name ?? ''); }, [p?.id]);
  // Arriving from search or the sidebar: open that task, or start a new one.
  const loc = useLocation();
  const arrive = loc.state as { openTask?: string; newTask?: number } | null;
  useEffect(() => {
    if (!ready || !p || !arrive) return;
    if (arrive.openTask) { const t = ws.tasks.find((x) => x.id === arrive.openTask); if (t) setOpen({ task: t }); }
    if (arrive.newTask) void newTask();
    nav(loc.pathname, { replace: true, state: null });
  }, [ready, p?.id, arrive]);

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
  const openTask = (t: Task) => setOpen({ task: t });
  // "New task": make it in the current sprint and open its panel with the name ready to type.
  async function newTask() {
    const draft = { project_id: p!.id, sprint_id: current?.id ?? null, status: 'not_started' as const, title: 'Untitled' };
    const tid = await createTask(draft);
    if (tid) setOpen({ task: { ...draft, id: tid } as Task, isNew: true });
  }

  return (
    <div className="page page-doc page-doc-wide">
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
              <span key={s.id} className="tag tag-default t-caption" data-tip={sprintLabel(s, today)}>
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
        <div className="callout about t-body"><span aria-hidden>💡</span>
          <Suspense fallback={<LoadingLine />}>
            <NotesEditor key={p.id} doc={p.about_doc} legacy={p.about} label="About this project" emptyHint="What is this project for? Type ‘/’ for blocks"
              onChange={(doc, text) => updateProject(p.id, { about_doc: doc, about: text.trim() ? text : null })} />
          </Suspense>
        </div>
      </section>

      <section className="doc-section doc-wide">
        <div className="toolbar">
          <h2 className="t-title-section">Tasks <span className="t-caption muted">{tasks.length}</span></h2>
          <span className="grow" />
          <ViewTabs<View> value={view} onChange={setView} tabs={[
            { value: 'board', label: 'Board', icon: <LayoutGrid size={14} /> }, { value: 'sprint', label: 'By sprint', icon: <Clock size={14} /> },
          ]} />
          <Button icon={<Plus size={14} />} onClick={newTask}>New task</Button>
        </div>
        {view === 'board' ? <TaskBoard tasks={tasks} onOpen={openTask} showProject={false} newTask={{ project_id: p.id, sprint_id: current?.id ?? null }} /> : (
          <div className="table" role="table">
            <TaskTableHead cols={{ sprint: true }} />
            {view === 'sprint' && sprintGroups.map(([k, g]) => (
              <div key={k} role="rowgroup">
                <GroupHeader open={!closed.has(k)} onToggle={() => toggle(k)} count={g.rows.length}>
                  {g.sprint ? <>🏃 {g.sprint.name} <span className="t-caption muted">
                    · {sprintLabel(g.sprint, today).toLowerCase()} · {g.sprint.status === 'closed' ? 'ended' : 'ends'} {fmtDate(g.sprint.ends_on, false)}</span></> : 'No sprint'}
                </GroupHeader>
                {!closed.has(k) && <>
                  {g.rows.map((t) => <TaskRow key={t.id} task={t} onOpen={openTask} cols={{ sprint: true }} />)}
                  <NewTaskRow defaults={{ project_id: p.id, sprint_id: g.sprint?.id ?? null, status: 'not_started' }} label={g.sprint ? `New task in ${g.sprint.name}` : 'New task'} />
                </>}
              </div>
            ))}
            {!sprintGroups.length && <NewTaskRow defaults={{ project_id: p.id, sprint_id: current?.id ?? null, status: 'not_started' }} />}
          </div>
        )}
      </section>
      {open && <TaskDrawer task={open.task} isNew={open.isNew} onClose={() => setOpen(null)} />}
      {deleting && <DeleteProject project={p} taskCount={tasks.length} onClose={() => setDeleting(false)}
        onConfirm={() => { if (pinned) pins.toggle(p.id); deleteProject(p.id); nav('/projects'); }} />}
    </div>
  );
}
