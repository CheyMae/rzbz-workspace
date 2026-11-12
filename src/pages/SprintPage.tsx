import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LayoutGrid, List, User } from 'lucide-react';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { CloseSprintDialog } from '../components/CloseSprintDialog';
import { ProjectFolder } from '../components/ProjectFolder';
import { GroupHeader, Loading, Progress, Stat, ViewTabs } from '../components/ui';
import { NewTaskRow, TaskBoard, TaskDrawer, TaskRow, TaskTableHead } from '../components/tasks';
import { useData, useIndex, type Index } from '../lib/data';
import { firstName, fmtRange, folderColor, fmtDate, plural } from '../lib/format';
import { canClose, sprintLabel, todayISO } from '../lib/sprints';
import { usePref } from '../lib/prefs';
import type { Person, Project, Sprint, Task } from '../lib/types';

type View = 'project' | 'status' | 'assignee';

/** Figma 07 / 07b / 07c · one sprint. */
export function SprintPage() {
  const { id } = useParams();
  const { ready, ws } = useData();
  const ix = useIndex();
  const [view, setView] = usePref<View>('sprint.view', 'project');
  const [open, setOpen] = useState<Task | null>(null);
  const [closing, setClosing] = useState(false);
  if (!ready) return <Loading />;
  const s = ws.sprints.find((x) => x.id === id);
  if (!s || s.kind !== 'sprint') return <div className="page"><p className="t-body">Sprint not found. <Link to="/sprints">Back to Sprints</Link></p></div>;

  const today = todayISO();
  const real = ws.sprints.filter((x) => x.kind === 'sprint');
  const i = real.findIndex((x) => x.id === s.id);
  const prev = real[i - 1], next = real[i + 1];
  const tasks = ix.tasksIn(s);
  const pr = ix.progress(tasks);
  const projectCount = new Set(tasks.map((t) => t.project_id).filter(Boolean)).size;
  const label = sprintLabel(s, today);

  return (
    <div className="page">
      <div className="doc-top t-caption">
        <nav className="crumbs" aria-label="Breadcrumb"><Link to="/sprints">🏃 Sprints</Link><span aria-hidden>/</span><span>{s.name}</span></nav>
        <span className="grow" />
        {prev && <Link to={`/sprints/${prev.id}`} className="plain-link">‹ {prev.name}</Link>}
        {next && <Link to={`/sprints/${next.id}`} className="plain-link">{next.name} ›</Link>}
      </div>
      <header className="page-header">
        <span className="page-emoji" aria-hidden>🏃</span>
        <h1 className="t-title-screen">{s.name}</h1>
        <p className={`t-body ${label === 'Extended' ? 'warn' : 'muted'}`}>{fmtRange(s.starts_on, s.ends_on)} · {label.toLowerCase()}{label === 'Current' ? ' sprint' : ''}</p>
      </header>

      <section className="sprint-card">
        <div className="sprint-main">
          <div className="sprint-progress">
            <div className="sprint-progress-label t-caption-emphasis"><span>{pr.done} of {pr.total} tasks done</span><span className="muted">{pr.pct}%</span></div>
            <Progress pct={pr.pct} />
          </div>
          <Stat value={projectCount} label="projects" />
          <Stat value={pr.open} label="open" />
          <Stat value={pr.done} label="done" />
          {canClose(s, today) && <Button variant="danger" onClick={() => setClosing(true)}>Close sprint</Button>}
        </div>
      </section>

      <div className="toolbar">
        <ViewTabs<View> value={view} onChange={setView} tabs={[
          { value: 'project', label: 'By project', icon: <List size={14} /> },
          { value: 'status', label: 'Board by status', icon: <LayoutGrid size={14} /> },
          { value: 'assignee', label: 'By assignee', icon: <User size={14} /> },
        ]} />
      </div>

      {view === 'project' && <ByProject tasks={tasks} ix={ix} sprint={s} onOpen={setOpen} />}
      {view === 'status' && <>
        <p className="t-caption muted">Next Up tasks are planned for the next sprint. When {s.name} closes they move there as Not started.</p>
        <TaskBoard tasks={tasks} onOpen={setOpen} />
      </>}
      {view === 'assignee' && <ByAssignee tasks={tasks} ix={ix} people={ws.people} sprint={s} />}

      {open && <TaskDrawer task={open} onClose={() => setOpen(null)} />}
      {closing && <CloseSprintDialog sprint={s} onClose={() => setClosing(false)} />}
    </div>
  );
}

function ByProject({ tasks, ix, sprint, onOpen }: { tasks: Task[]; ix: Index; sprint: Sprint; onOpen: (t: Task) => void }) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [more, setMore] = useState<Set<string>>(new Set());
  const groups = new Map<string, Task[]>();
  for (const t of tasks) { const k = t.project_id ?? 'none'; (groups.get(k) ?? groups.set(k, []).get(k)!).push(t); }
  const sorted = [...groups.entries()].sort((a, b) => (a[0] === 'none' ? 1 : b[0] === 'none' ? -1 : b[1].length - a[1].length));
  const flip = (set: Set<string>, k: string) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); return n; };
  return (
    <div className="table" role="table">
      <TaskTableHead />
      {sorted.map(([k, rows]) => {
        const p = k === 'none' ? null : ix.project.get(k);
        const product = p ? ix.productOf(p) : null;
        const done = rows.filter((t) => t.status === 'done').length;
        const shown = more.has(k) ? rows : rows.slice(0, 4);
        return (
          <div key={k} role="rowgroup">
            <GroupHeader open={!closed.has(k)} onToggle={() => setClosed(flip(closed, k))} right={`${done} of ${rows.length} done`}>
              {p ? <><Link to={`/projects/${p.id}`} className="plain-link">{p.emoji ?? product?.emoji} {p.name}</Link>
                {product && <span className="t-caption muted"> {product.name}</span>}</> : 'No project'}
            </GroupHeader>
            {!closed.has(k) && <>
              {shown.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} />)}
              {rows.length > 4 && <button type="button" className="show-more t-caption muted" onClick={() => setMore(flip(more, k))}>{more.has(k) ? 'Show fewer' : `Show ${rows.length - 4} more`}</button>}
            </>}
          </div>
        );
      })}
      {!tasks.length && <p className="t-body muted empty-row">No tasks in this sprint yet.</p>}
      {sprint.status !== 'closed' && <NewTaskRow defaults={{ sprint_id: sprint.id, status: 'not_started' }} label="New task in this sprint" />}
    </div>
  );
}

/** Figma 07c: one group per person, a folder per project with that person's tasks this sprint. */
function ByAssignee({ tasks, ix, people, sprint }: { tasks: Task[]; ix: Index; people: Person[]; sprint: Sprint }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const today = todayISO();
  const unassigned = tasks.filter((t) => !ix.assignees(t).length);
  const noProject = unassigned.filter((t) => !t.project_id);

  type G = { key: string; person: Person | null; mine: Task[] };
  const groups: G[] = people.map((person) => ({ key: person.id, person, mine: tasks.filter((t) => ix.assignees(t).some((a) => a.id === person.id)) }))
    .filter((g) => g.mine.length).sort((a, b) => b.mine.length - a.mine.length);
  if (unassigned.length) groups.push({ key: 'none', person: null, mine: unassigned });
  const idle = people.filter((p) => !groups.some((g) => g.person?.id === p.id) && ix.people.length && tasks.length)
    .filter((p) => [...ix.project.values()].some((pr) => ix.people(pr, 'lead').some((l) => l.id === p.id) && pr.status === 'in_progress'));

  const role = (p: Project, person: Person | null) => {
    if (!person) return 'No one';
    if (ix.people(p, 'lead').some((x) => x.id === person.id)) return 'Lead';
    if (ix.people(p, 'support').some((x) => x.id === person.id)) return 'Support';
    return 'Helping';
  };

  return (
    <section className="panel">
      {unassigned.length > 0 && (
        <div className="callout callout-sand t-body"><span aria-hidden>💡</span><span>
          {plural(unassigned.length, 'task')} in {sprint.name} {unassigned.length === 1 ? 'has' : 'have'} no assignee{noProject.length ? `, and ${noProject.length} of those ${noProject.length === 1 ? 'has' : 'have'} no project` : ''}.
        </span></div>
      )}
      {groups.map(({ key, person, mine }) => {
        const byProject = new Map<string, Task[]>();
        for (const t of mine) if (t.project_id) (byProject.get(t.project_id) ?? byProject.set(t.project_id, []).get(t.project_id)!).push(t);
        const projects = [...byProject.entries()].map(([pid, ts]) => ({ p: ix.project.get(pid)!, ts })).filter((x) => x.p)
          .sort((a, b) => b.ts.length - a.ts.length);
        const done = mine.filter((t) => t.status === 'done').length;
        const isOpen = expanded.has(key);
        const loose = mine.filter((t) => !t.project_id).length;
        return (
          <div key={key} className="owner-group">
            <div className="owner-header">
              {person && <Avatar name={person.name} size={20} />}
              <span className="t-body-emphasis">{person ? firstName(person) : 'Unassigned'}</span>
              <span className="t-caption muted">{plural(mine.length, 'task')} · {plural(projects.length, 'project')}</span>
              <span className="grow" />
              <span className="split-bar" aria-hidden><span className="split-done" style={{ flex: done || 0.0001 }} /><span className="split-open" style={{ flex: mine.length - done || 0.0001 }} /></span>
              <span className="t-caption muted">{done} done · {mine.length - done} open</span>
              {projects.length > 4 && (
                <button type="button" className="link-button t-caption-emphasis" onClick={() => setExpanded((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; })}>
                  {isOpen ? 'Show fewer' : `See all ${projects.length} ↗`}
                </button>
              )}
            </div>
            <div className="folder-grid">
              {projects.slice(0, isOpen ? undefined : 4).map(({ p, ts }) => {
                const product = ix.productOf(p);
                const d = ts.filter((t) => t.status === 'done').length;
                const due = ts.map((t) => t.due_end).filter(Boolean).sort().pop() ?? null;
                return (
                  <ProjectFolder key={p.id} to={`/projects/${p.id}`} color={folderColor(product?.name)} emoji={p.emoji ?? product?.emoji} name={p.name}
                    tags={<span className="tag tag-default t-caption">{product?.name ?? 'No product'}</span>}
                    done={d} total={ts.length} pill={role(p, person)}
                    date={due ? fmtDate(due, false) : 'No due date'} dateWarn={!!due && due < today && d < ts.length} />
                );
              })}
            </div>
            {loose > 0 && <p className="t-caption muted">+ {plural(loose, 'task')} with no project</p>}
          </div>
        );
      })}
      {idle.map((p) => (
        <div key={p.id} className="owner-group">
          <div className="owner-header"><Avatar name={p.name} size={20} /><span className="t-body-emphasis">{firstName(p)}</span>
            <span className="t-caption muted">none in {sprint.name}</span><span className="grow" /><span className="t-caption muted">No tasks this sprint</span></div>
        </div>
      ))}
    </section>
  );
}
