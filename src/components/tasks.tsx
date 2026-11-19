import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePref } from '../lib/prefs';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { PeoplePicker } from './PeoplePicker';
import { Button } from './Button';
import { BlockEditor } from './BlockEditor';
import { ConfirmDelete, People, Tag, TagSelect, useBoardDrag } from './ui';
import { useData, useIndex, type Index } from '../lib/data';
import { PRIORITY, TASK_FLOW, TASK_STATUS, fmtDate, firstName } from '../lib/format';
import type { Priority, Task, TaskStatus } from '../lib/types';

export const statusOptions = TASK_FLOW.map((s) => ({ value: s, ...TASK_STATUS[s] }));
export const priorityOptions = (['high', 'medium', 'low'] as Priority[]).map((p) => ({ value: p, ...PRIORITY[p] }));

/** Optional column: Sprint (a dropdown, to move a task to another sprint). */
export type TaskCols = { sprint?: boolean };
const colsClass = (c: TaskCols = {}) => `cols-tasks${c.sprint ? ' has-sprint' : ''}`;

/** Sprints a task can move to: open and upcoming ones, plus the one it's in now. */
function useSprintOptions(current: string | null) {
  const { ws } = useData();
  return ws.sprints.filter((s) => s.kind === 'sprint' && (s.status !== 'closed' || s.id === current))
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
    .map((s) => ({ value: s.id, label: s.status === 'upcoming' ? `${s.name} (next)` : s.name, tone: 'default' as const }));
}

/** One task row (Figma App/Task Row): done box, title, [sprint], status, priority, assignee, due. */
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
      <span /><span>Task</span>{cols?.sprint && <span>Sprint</span>}<span>Status</span><span>Priority</span><span>Assignee</span><span>Due</span>
    </div>
  );
}

/** Inline "+ New task" that keeps you in the list. */
export function NewTaskRow({ defaults, label = 'New task' }: { defaults: Partial<Task>; label?: string }) {
  const { createTask } = useData();
  const [title, setTitle] = useState<string | null>(null);
  if (title === null) {
    return <button type="button" className="add-task" onClick={() => setTitle('')}><Plus size={14} /> {label}</button>;
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

const MIN_PANEL = 400;

/** Side panel to edit one task. Everything saves by itself; text a moment after you stop typing. */
export function TaskDrawer({ task, onClose, isNew }: { task: Task; onClose: () => void; /** Just made: put the cursor in the name. */ isNew?: boolean }) {
  const { ws, error, updateTask, setTaskAssignees, deleteTask } = useData();
  const [confirming, setConfirming] = useState(false);
  const ix = useIndex();
  const live = ws.tasks.find((t) => t.id === task.id) ?? task;
  const [title, setTitle] = useState(live.title);
  useEffect(() => { setTitle(live.title); }, [live.id]);

  // Everything saves by itself (no need to press Done); the top of the panel says when it has.
  const [saveState, setSaveState] = useState<'idle' | 'editing' | 'saving' | 'saved'>('idle');
  const pending = useRef(0);
  const track = (p: Promise<void>) => {
    pending.current++; setSaveState('saving');
    p.finally(() => { if (--pending.current === 0) setSaveState('saved'); });
  };
  const up = (patch: Partial<Task>) => track(updateTask(live.id, patch));
  // The name saves a moment after you stop typing, when you leave the box, and when the panel closes.
  const titleRef = useRef({ title, saved: live.title, id: live.id });
  titleRef.current = { title, saved: live.title, id: live.id };
  const saveTitle = () => { const t = title.trim(); if (t && t !== live.title) up({ title: t }); };
  useEffect(() => {
    if (!title.trim() || title.trim() === live.title) return;
    setSaveState('editing');
    const h = setTimeout(saveTitle, 700); return () => clearTimeout(h);
  }, [title]);
  useEffect(() => () => { const r = titleRef.current; const t = r.title.trim(); if (t && t !== r.saved) updateTask(r.id, { title: t }); }, []);

  // Width: drag the left edge (or use the arrow keys on it); remembered on this browser.
  const [width, setWidth] = usePref<number>('taskPanel.width', 520);
  const [dragW, setDragW] = useState<number | null>(null);
  const maxW = () => Math.max(MIN_PANEL, window.innerWidth - 240);
  const clampW = (w: number) => Math.round(Math.min(maxW(), Math.max(MIN_PANEL, w)));
  const shown = clampW(dragW ?? width);
  useEffect(() => {
    // Escape closes the panel, unless the delete confirmation is open (it closes first).
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.dialog')) onClose(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  const sprints = ws.sprints.filter((s) => s.kind === 'sprint' && (s.status !== 'closed' || s.id === live.sprint_id))
    .sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  const project = live.project_id ? ix.project.get(live.project_id) : null;

  return (
    <div className="scrim scrim-side" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Task: ${live.title}`} style={{ width: `min(${shown}px, 100vw)` }}>
        <div className={`drawer-resize${dragW !== null ? ' is-dragging' : ''}`} role="separator" aria-orientation="vertical" aria-label="Panel width"
          aria-valuenow={shown} aria-valuemin={MIN_PANEL} tabIndex={0} title="Drag to resize · double-click to reset"
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDragW(window.innerWidth - e.clientX); }}
          onPointerMove={(e) => { if (dragW !== null) setDragW(window.innerWidth - e.clientX); }}
          onPointerUp={() => { if (dragW !== null) { setWidth(clampW(dragW)); setDragW(null); } }}
          onDoubleClick={() => setWidth(520)}
          onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setWidth(clampW(shown + (e.key === 'ArrowLeft' ? 40 : -40))); } }} />
        <div className="drawer-top">
          {project ? <Link to={`/projects/${project.id}`} className="t-caption muted plain-link" onClick={onClose}>{project.name}</Link> : <span className="t-caption muted">No project</span>}
          <span className="grow" />
          <span className={`save-state t-caption save-${saveState}`} role="status" aria-live="polite">
            {saveState === 'editing' || saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? (error ? 'Couldn’t save' : <><Check size={14} /> Saved</>) : ''}
          </span>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        {/* The name box grows with its text: an invisible copy of the text sets the height (pure CSS, no measuring). */}
        <div className="grow-text t-title-section" data-value={title}>
          <textarea className="title-input" rows={1} value={title} aria-label="Task name" placeholder="Untitled" autoFocus={isNew}
            onFocus={(e) => isNew && e.currentTarget.select()}
            onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} />
        </div>
        <dl className="props">
          <dt>Status</dt><dd><TagSelect label="Status" value={live.status} options={statusOptions} onChange={(v) => v && up({ status: v })} /></dd>
          <dt>Priority</dt><dd><TagSelect label="Priority" value={live.priority} options={priorityOptions} onChange={(v) => up({ priority: v })} /></dd>
          <dt>Sprint</dt><dd>
            <select className="plain-select" value={live.sprint_id ?? ''} aria-label="Sprint" onChange={(e) => up({ sprint_id: e.target.value || null })}>
              <option value="">No sprint</option>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}{s.status === 'upcoming' ? ' (upcoming)' : ''}</option>)}
            </select>
            {live.status === 'next_up' && <span className="t-caption muted"> Next Up moves to the next sprint when this one closes.</span>}
          </dd>
          <dt>Project</dt><dd>
            <select className="plain-select" value={live.project_id ?? ''} aria-label="Project" onChange={(e) => up({ project_id: e.target.value || null })}>
              <option value="">No project</option>
              {ws.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </dd>
          <dt>Assignees</dt><dd>
            <PeoplePicker people={ws.people} selected={ix.assignees(live)} empty="No one yet" onChange={(ids) => track(setTaskAssignees(live.id, ids))} />
          </dd>
          <dt>Due</dt><dd className="date-pair">
            <input type="date" className="input" value={live.due_start ?? ''} aria-label="Start" onChange={(e) => up({ due_start: e.target.value || null })} />
            <span aria-hidden>→</span>
            <input type="date" className="input" value={live.due_end ?? ''} aria-label="Due" onChange={(e) => up({ due_end: e.target.value || null })} />
          </dd>
        </dl>
        <hr className="rule" />
        <section className="notes-section">
          <span className="t-caption-emphasis">Notes</span>
          <BlockEditor key={live.id} value={live.notes ?? ''} onEditing={() => setSaveState('editing')} onChange={(v) => up({ notes: v || null })} />
        </section>
        {live.summary && <p className="t-caption muted">{live.summary}</p>}
        <div className="drawer-foot">
          <button type="button" className="btn btn-ghost btn-delete" onClick={() => setConfirming(true)}><Trash2 size={14} /> Delete task</button>
          <span className="grow" />
          <span className="t-caption muted">Changes save automatically</span>
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
