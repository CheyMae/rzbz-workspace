import { Link } from 'react-router-dom';
import { CalendarRange, Infinity as AllTime } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Avatar } from '../components/Avatar';
import { Loading, Progress, ViewTabs } from '../components/ui';
import { isOpenTask, useData, useIndex } from '../lib/data';
import { sprintState, todayISO } from '../lib/sprints';
import { fmtDate, firstName, plural } from '../lib/format';
import { usePref } from '../lib/prefs';
import type { Project, Task } from '../lib/types';

type Period = 'sprint' | 'all';
const ACTIVE = ['in_progress', 'not_started', 'paused', 'waiting_for_feedback'];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/**
 * Team › Analytics: a one-screen overview of how the projects and the designers are doing.
 * HR projects are left out, as on Home and Projects.
 */
export function Analytics() {
  const { ready, ws } = useData();
  const ix = useIndex();
  const [period, setPeriod] = usePref<Period>('analytics.period', 'sprint');
  if (!ready) return <Loading />;

  const today = todayISO();
  const { active } = sprintState(ws.sprints, today);
  const activeIds = new Set(active.map((s) => s.id));
  const sprintNames = active.map((s) => s.name).join(' + ') || 'No open sprint';

  // What's in scope: the open sprints, or everything that isn't archived.
  const workProjects = ws.projects.filter((p) => !ix.isTeam(p));
  const workIds = new Set(workProjects.map((p) => p.id));
  const tasks: Task[] = ws.tasks.filter((t) => (!t.project_id || workIds.has(t.project_id)) && (period === 'all' || (t.sprint_id && activeIds.has(t.sprint_id))));
  const inSprint = new Set([
    ...ws.projectSprints.filter((l) => activeIds.has(l.sprint_id)).map((l) => l.project_id),
    ...tasks.map((t) => t.project_id).filter(Boolean) as string[],
  ]);
  const projects: Project[] = period === 'all' ? workProjects : workProjects.filter((p) => inSprint.has(p.id));

  // Projects
  const count = (s: string) => projects.filter((p) => p.status === s).length;
  const activeProjects = projects.filter((p) => ACTIVE.includes(p.status));
  const lateProjects = activeProjects.filter((p) => p.ends_on && p.ends_on < today).sort((a, b) => a.ends_on!.localeCompare(b.ends_on!));
  const noLead = activeProjects.filter((p) => !ix.people(p, 'lead').length);

  // Tasks
  const done = tasks.filter((t) => t.status === 'done').length;
  const open = tasks.filter((t) => isOpenTask(t.status));
  const lateTasks = open.filter((t) => t.due_end && t.due_end < today);
  const unassigned = open.filter((t) => !ix.assignees(t).length);

  // Designers: what each person leads, supports and has on their plate.
  const designers = ix.designers.map((person) => {
    const mine = tasks.filter((t) => ix.assignees(t).some((a) => a.id === person.id));
    const myOpen = mine.filter((t) => isOpenTask(t.status));
    return {
      person,
      leads: activeProjects.filter((p) => ix.people(p, 'lead').some((x) => x.id === person.id)).length,
      supports: activeProjects.filter((p) => ix.people(p, 'support').some((x) => x.id === person.id)).length,
      open: myOpen.length,
      done: mine.length - myOpen.length,
      late: myOpen.filter((t) => t.due_end && t.due_end < today).length,
    };
  }).sort((a, b) => b.open - a.open || b.leads - a.leads || a.person.name.localeCompare(b.person.name));
  const busiest = designers.find((d) => d.open > 0);

  // Products: how each product's projects are moving.
  const products = ws.products.filter((x) => x.id !== ix.team?.id).map((pr) => {
    const ps = projects.filter((p) => ix.productOf(p)?.id === pr.id);
    const ts = tasks.filter((t) => t.project_id && ps.some((p) => p.id === t.project_id));
    return {
      pr, total: ps.length, inProgress: ps.filter((p) => p.status === 'in_progress').length,
      paused: ps.filter((p) => p.status === 'paused').length, done: ps.filter((p) => p.status === 'done').length,
      tasksDone: ts.filter((t) => t.status === 'done').length, tasks: ts.length,
    };
  }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);

  const scope = period === 'all' ? 'all current work' : sprintNames;

  return (
    <div className="page">
      <PageHeader emoji="📊" title="Analytics" subtitle="How the projects and the designers are doing, at a glance." />
      <div className="toolbar">
        <ViewTabs<Period> value={period} onChange={setPeriod} tabs={[
          { value: 'sprint', label: 'Open sprints', icon: <CalendarRange size={14} /> },
          { value: 'all', label: 'All time', icon: <AllTime size={14} /> },
        ]} />
        <span className="grow" />
        <span className="t-caption muted">{period === 'all' ? 'Every project and task that isn’t archived' : sprintNames}</span>
      </div>

      <div className="callout callout-sand t-body"><span aria-hidden>💡</span><span>
        {plural(activeProjects.length, 'active project')} and {plural(open.length, 'open task')} in {scope}. {pct(done, tasks.length)}% of tasks are done.
        {busiest && ` ${firstName(busiest.person)} has the most open tasks (${busiest.open}).`}
        {lateTasks.length > 0 && ` ${plural(lateTasks.length, 'task is', 'tasks are')} past due.`}
      </span></div>

      <div className="an-grid">
        <section className="panel">
          <h2 className="t-title-subsection">Projects</h2>
          <div className="an-tiles">
            <Tile n={projects.length} label="projects" />
            <Tile n={count('in_progress')} label="in progress" dot="in_progress" />
            <Tile n={count('paused')} label="paused" dot="paused" />
            <Tile n={count('not_started')} label="not started" dot="not_started" />
            <Tile n={count('done')} label="done" dot="done" />
            <Tile n={lateProjects.length} label="past end date" warn={lateProjects.length > 0} />
          </div>
        </section>
        <section className="panel">
          <h2 className="t-title-subsection">Tasks</h2>
          <div className="an-tiles">
            <Tile n={tasks.length} label="tasks" />
            <Tile n={open.length} label="open" dot="in_progress" />
            <Tile n={done} label="done" dot="done" />
            <Tile n={`${pct(done, tasks.length)}%`} label="complete" />
            <Tile n={lateTasks.length} label="past due" warn={lateTasks.length > 0} />
            <Tile n={unassigned.length} label="no one assigned" warn={unassigned.length > 0} />
          </div>
        </section>
      </div>

      <section className="panel">
        <header className="panel-header">
          <h2 className="t-title-subsection">Designers</h2>
          <span className="legend t-caption"><span className="dot dot-done" /> Done <span className="dot dot-open" /> Open</span>
        </header>
        <p className="t-caption muted">Leading and supporting count active projects. Tasks are the ones assigned to each person.</p>
        <div className="table" role="table">
          <div className="tr th t-caption an-cols-people" role="row">
            <span>Designer</span><span>Leading</span><span>Supporting</span><span>Open tasks</span><span>Done</span><span>Past due</span><span>Done vs open</span>
          </div>
          {designers.map((d) => (
            <div key={d.person.id} className="tr t-body an-cols-people" role="row">
              <span className="an-person"><Avatar name={d.person.name} size={20} />{d.person.name}</span>
              <span>{d.leads}</span>
              <span>{d.supports}</span>
              <span className="t-body-emphasis">{d.open}</span>
              <span>{d.done}</span>
              <span className={d.late ? 'text-error' : 'muted'}>{d.late}</span>
              <span>{d.open + d.done > 0
                ? <span className="split-bar" aria-label={`${d.done} done, ${d.open} open`}>
                    <span className="split-done" style={{ flex: d.done || 0.0001 }} /><span className="split-open" style={{ flex: d.open || 0.0001 }} />
                  </span>
                : <span className="muted t-caption">No tasks</span>}</span>
            </div>
          ))}
          {!designers.length && <p className="t-body muted empty-row">No designers on the team list yet.</p>}
        </div>
      </section>

      <section className="panel">
        <h2 className="t-title-subsection">Products</h2>
        <div className="table" role="table">
          <div className="tr th t-caption an-cols-products" role="row">
            <span>Product</span><span>Projects</span><span>In progress</span><span>Paused</span><span>Done</span><span>Tasks done</span>
          </div>
          {products.map((r) => (
            <div key={r.pr.id} className="tr t-body an-cols-products" role="row">
              <Link to={`/products/${r.pr.id}`} className="row-link">{r.pr.emoji} {r.pr.name}</Link>
              <span>{r.total}</span><span>{r.inProgress}</span><span>{r.paused}</span><span>{r.done}</span>
              <span className="progress-cell t-caption"><Progress pct={pct(r.tasksDone, r.tasks)} /><span>{r.tasks ? `${r.tasksDone}/${r.tasks}` : '—'}</span></span>
            </div>
          ))}
          {!products.length && <p className="t-body muted empty-row">No projects in {scope}.</p>}
        </div>
      </section>

      {(lateProjects.length > 0 || noLead.length > 0) && (
        <div className="an-grid">
          {lateProjects.length > 0 && (
            <section className="panel">
              <h2 className="t-title-subsection">Past their end date</h2>
              <ul className="plain-list an-list">
                {lateProjects.slice(0, 8).map((p) => (
                  <li key={p.id} className="t-body"><Link to={`/projects/${p.id}`} className="plain-link">{p.emoji ?? ix.productOf(p)?.emoji} {p.name}</Link>
                    <span className="t-caption text-error">{fmtDate(p.ends_on)}</span></li>
                ))}
              </ul>
              {lateProjects.length > 8 && <p className="t-caption muted">and {lateProjects.length - 8} more</p>}
            </section>
          )}
          {noLead.length > 0 && (
            <section className="panel">
              <h2 className="t-title-subsection">No lead yet</h2>
              <ul className="plain-list an-list">
                {noLead.slice(0, 8).map((p) => (
                  <li key={p.id} className="t-body"><Link to={`/projects/${p.id}`} className="plain-link">{p.emoji ?? ix.productOf(p)?.emoji} {p.name}</Link>
                    <span className="t-caption muted">{ix.productOf(p)?.name ?? 'No product'}</span></li>
                ))}
              </ul>
              {noLead.length > 8 && <p className="t-caption muted">and {noLead.length - 8} more</p>}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ n, label, dot, warn }: { n: number | string; label: string; dot?: string; warn?: boolean }) {
  return (
    <div className="stat-tile">
      <span className={`t-title-section${warn ? ' text-error' : ''}`}>{n}</span>
      <span className="t-caption muted an-tile-label">{dot && <span className={`dot dot-${dot}`} aria-hidden />}{label}</span>
    </div>
  );
}
