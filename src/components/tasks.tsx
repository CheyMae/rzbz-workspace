import { useEffect, useState, type ReactNode } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { ConfirmDelete, People, Tag, TagSelect, useBoardDrag } from './ui';
import { useData, useIndex, type Index } from '../lib/data';
import { PRIORITY, TASK_FLOW, TASK_STATUS, fmtDate, firstName } from '../lib/format';
import type { Priority, Task, TaskStatus } from '../lib/types';

export const statusOptions = TASK_FLOW.map((s) => ({ value: s, ...TASK_STATUS[s] }));
export const priorityOptions = (['high', 'medium', 'low'] as Priority[]).map((p) => ({ value: p, ...PRIORITY[p] }));

/** Optional columns: Phase (text) and Sprint (a dropdown, to move a task to another sprint). */
export type TaskCols = { phase?: boolean; sprint?: boolean };
const colsClass = (c: TaskCols = {}) => `cols-tasks${c.phase ? ' has-phase' : ''}${c.sprint ? ' has-sprint' : ''}`;

/** Sprints a task can move to: open and upcoming ones, plus the one it's in now. */
function useSprintOptions(current: string | null) {
  const { ws } = useData();
  return ws.sprints.filter((s) => s.kind === 'sprint' && (s.status !== 'closed' || s.id === current))
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
    .map((s) => ({ value: s.id, label: s.status === 'upcoming' ? `${s.name} (next)` : s.name, tone: 'default' as const }));
}

/** One task row (Figma App/Task Row): done box, title, [phase], [sprint], status, priority, assignee, due. */
export function TaskRow({ task, onOpen, project, cols }: { task: Task; onOpen: (t: Task) => void; project?: ReactNode; cols?: TaskCols }) {
  const { updateTask } = useData();
  const ix = useIndex();
  const sprintOptions = useSprintOptions(task.sprint_id);
  const done = task.status === 'done';
  return (
    <div className={`tr t-body ${colsClass(cols)}`} role="row">
      <button type="button" className={`checkbox${done ? ' is-checked' : ''}`} role="checkbox" aria-checked={done}
        aria-label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
        onClick={() => updateTask(task.id, { status: done ? 'in_progress' : 'done' })}>
        {done && <Check size={12} strokeWidth={3} />}
      </button>
      <button type="button" className="row-link task-title" onClick={() => onOpen(task)}>
        {task.title}{project && <span className="t-caption muted"> · {project}</span>}
      </button>
      {cols?.phase && <span className={`t-caption${task.phase ? '' : ' muted'}`} title={task.phase ?? undefined}>{task.phase ?? '—'}</span>}
      {cols?.sprint && <span><TagSelect label={`Sprint of ${task.title}`} value={task.sprint_id} options={sprintOptions} placeholder="No sprint"
        onChange={(v) => updateTask(task.id, { sprint_id: v })} /></span>}
      <span><TagSelect label={`Status of ${task.title}`} value={task.status} options={statusOptions}
        onChange={(v) => v && updateTask(task.id, { status: v })} /></span>
      <span><TagSelect label={`Priority of ${task.title}`} value={task.priority} options={priorityOptions} placeholder="—"
        onChange={(v) => updateTask(task.id, { priority: v })} /></span>
      <span className="t-caption"><People people={ix.assignees(task)} /></span>
      <span className="t-caption">{fmtDate(task.due_end ?? task.due_start)}</span>
    </div>
  );
}

export function TaskTableHead({ cols }: { cols?: TaskCols } = {}) {
  return (
    <div className={`tr th t-caption ${colsClass(cols)}`} role="row">
      <span /><span>Task</span>{cols?.phase && <span>Phase</span>}{cols?.sprint && <span>Sprint</span>}<span>Status</span><span>Priority</span><span>Assignee</span><span>Due</span>
    </div>
  );
}

/** Inline "+ New task" that keeps you in the list. */
export function NewTaskRow({ defaults, label = 'New task' }: { defaults: Partial<Task>; label?: string }) {
  const { createTask } = useData();
  const [title, setTitle] = useState<string | null>(null);
  if (title === null) {
    return <button type="button" className="show-more t-caption muted" onClick={() => setTitle('')}><Plus size={12} /> {label}</button>;
  }
  return (
    <form className="new-row" onSubmit={async (e) => { e.preventDefault(); if (title.trim()) { await createTask({ ...defaults, title: title.trim() }); } setTitle(null); }}>
      <input autoFocus className="input" placeholder="Task name, then Enter" value={title}
        onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setTitle(null)} aria-label="New task name" />
    </form>
  );
}

/** Columns by task status (Figma 07b). */
export function TaskBoard({ tasks, onOpen, showProject = true, newTask }: {
  tasks: Task[]; onOpen: (t: Task) => void; showProject?: boolean;
  /** When set, each column gets "+ New task" that starts in that column's status. */
  newTask?: Partial<Task>;
}) {
  const ix = useIndex();
  const { updateTask } = useData();
  const [all, setAll] = useState<Set<TaskStatus>>(new Set());
  // Drag a card to another column to change its status.
  const { dragProps, dropProps } = useBoardDrag((id, col) => {
    const t = tasks.find((x) => x.id === id);
    if (t && t.status !== col) updateTask(id, { status: col as TaskStatus });
  });
  return (
    <div className="board board-5">
      {TASK_FLOW.map((st) => {
        const col = tasks.filter((t) => t.status === st);
        const limit = all.has(st) ? Infinity : 6;
        return (
          <section key={st} className={`board-col tcol-${st}`} aria-label={TASK_STATUS[st].label} {...dropProps(st)}>
            <header className="col-header t-caption-emphasis"><span className={`dot tdot-${st}`} aria-hidden />{TASK_STATUS[st].label}<span className="muted">{col.length}</span></header>
            {col.slice(0, limit).map((t) => <TaskCard key={t.id} task={t} ix={ix} onOpen={onOpen} showProject={showProject} drag={dragProps(t.id)} />)}
            {col.length > limit && <button type="button" className="link-button t-caption col-more" onClick={() => setAll(new Set([...all, st]))}>+ {col.length - limit} more</button>}
            {!col.length && !newTask && <p className="t-caption muted col-empty">Nothing here</p>}
            {newTask && <NewTaskRow defaults={{ ...newTask, status: st }} />}
          </section>
        );
      })}
    </div>
  );
}

function TaskCard({ task, ix, onOpen, showProject, drag }: { task: Task; ix: Index; onOpen: (t: Task) => void; showProject: boolean; drag?: object }) {
  const project = task.project_id ? ix.project.get(task.project_id) : null;
  const who = ix.assignees(task);
  return (
    <button type="button" className="task-card" onClick={() => onOpen(task)} {...drag}>
      <span className="t-body-emphasis">{task.title}</span>
      {showProject && <span className="t-caption muted">{project ? `${project.emoji ?? ix.productOf(project)?.emoji ?? ''} ${project.name}` : 'No project'}</span>}
      {task.priority && <span><Tag tone={PRIORITY[task.priority].tone}>{PRIORITY[task.priority].label}</Tag></span>}
      <span className="task-card-foot t-caption">
        {who[0] ? <><Avatar name={who[0].name} size={20} /><span className="task-card-who">{who.map(firstName).join(', ')}</span></> : <span className="muted">No one</span>}
        <span className="grow" />
        <span className={task.due_end ? '' : 'muted'}>{task.due_end ? fmtDate(task.due_end, false) : 'No due date'}</span>
      </span>
    </button>
  );
}

/** Side panel to edit one task. Text saves when you leave the field; everything else saves at once. */
export function TaskDrawer({ task, onClose }: { task: Task; onClose: () => void }) {
  const { ws, updateTask, setTaskAssignees, deleteTask } = useData();
  const [confirming, setConfirming] = useState(false);
  const ix = useIndex();
  const live = ws.tasks.find((t) => t.id === task.id) ?? task;
  const [title, setTitle] = useState(live.title);
  const [notes, setNotes] = useState(live.notes ?? '');
  useEffect(() => { setTitle(live.title); setNotes(live.notes ?? ''); }, [live.id]);
  useEffect(() => {
    // Escape closes the panel, unless the delete confirmation is open (it closes first).
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.dialog')) onClose(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  const assigned = new Set(ix.assignees(live).map((p) => p.id));
  const sprints = ws.sprints.filter((s) => s.kind === 'sprint' && (s.status !== 'closed' || s.id === live.sprint_id))
    .sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  const project = live.project_id ? ix.project.get(live.project_id) : null;

  return (
    <div className="scrim scrim-side" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Task: ${live.title}`}>
        <div className="drawer-top">
          {project ? <Link to={`/projects/${project.id}`} className="t-caption muted plain-link" onClick={onClose}>{project.name}</Link> : <span className="t-caption muted">No project</span>}
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        <textarea className="title-input t-title-section" rows={2} value={title} aria-label="Task name"
          onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== live.title && updateTask(live.id, { title: title.trim() })} />
        <dl className="props">
          <dt>Status</dt><dd><TagSelect label="Status" value={live.status} options={statusOptions} onChange={(v) => v && updateTask(live.id, { status: v })} /></dd>
          <dt>Priority</dt><dd><TagSelect label="Priority" value={live.priority} options={priorityOptions} onChange={(v) => updateTask(live.id, { priority: v })} /></dd>
          <dt>Sprint</dt><dd>
            <select className="plain-select" value={live.sprint_id ?? ''} aria-label="Sprint" onChange={(e) => updateTask(live.id, { sprint_id: e.target.value || null })}>
              <option value="">No sprint</option>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}{s.status === 'upcoming' ? ' (upcoming)' : ''}</option>)}
            </select>
            {live.status === 'next_up' && <span className="t-caption muted"> Next Up moves to the next sprint when this one closes.</span>}
          </dd>
          <dt>Project</dt><dd>
            <select className="plain-select" value={live.project_id ?? ''} aria-label="Project" onChange={(e) => updateTask(live.id, { project_id: e.target.value || null })}>
              <option value="">No project</option>
              {ws.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </dd>
          <dt>Assignees</dt><dd className="check-list">
            {ws.people.filter((p) => p.active !== false || assigned.has(p.id)).sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
              <label key={p.id} className="t-caption">
                <input type="checkbox" checked={assigned.has(p.id)} onChange={(e) => {
                  const next = new Set(assigned); e.target.checked ? next.add(p.id) : next.delete(p.id);
                  setTaskAssignees(live.id, [...next]);
                }} /> {p.name}
              </label>
            ))}
          </dd>
          <dt>Due</dt><dd className="date-pair">
            <input type="date" className="input" value={live.due_start ?? ''} aria-label="Start" onChange={(e) => updateTask(live.id, { due_start: e.target.value || null })} />
            <span aria-hidden>→</span>
            <input type="date" className="input" value={live.due_end ?? ''} aria-label="Due" onChange={(e) => updateTask(live.id, { due_end: e.target.value || null })} />
          </dd>
          <dt>Phase</dt><dd>
            <input className="input input-plain" list="phase-options" defaultValue={live.phase ?? ''} key={live.id} placeholder="—" aria-label="Phase"
              onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== live.phase) updateTask(live.id, { phase: v }); }} />
            <datalist id="phase-options">{[...new Set(ws.tasks.filter((t) => t.project_id === live.project_id && t.phase).map((t) => t.phase!))].map((ph) => <option key={ph} value={ph} />)}</datalist>
          </dd>
        </dl>
        <label className="field"><span className="t-caption-emphasis">Notes</span>
          <textarea className="input" rows={8} value={notes} onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (live.notes ?? '') && updateTask(live.id, { notes: notes || null })} />
        </label>
        {live.summary && <p className="t-caption muted">{live.summary}</p>}
        <div className="drawer-foot">
          <button type="button" className="btn btn-ghost btn-delete" onClick={() => setConfirming(true)}><Trash2 size={14} /> Delete task</button>
          <span className="grow" />
          <Button variant="secondary" onClick={onClose}>Done</Button>
        </div>
        {confirming && (
          <ConfirmDelete title="Delete this task?" confirmLabel="Delete task" onClose={() => setConfirming(false)}
            onConfirm={() => { deleteTask(live.id); onClose(); }}>
            “{live.title}” will be removed from {project ? project.name : 'the workspace'} and every board.
          </ConfirmDelete>
        )}
      </aside>
    </div>
  );
}
