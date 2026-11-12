import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, List, PieChart, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { SprintBanner } from '../components/SprintBanner';
import { ProjectFolder } from '../components/ProjectFolder';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { Chip, GroupHeader, Loading, People, Progress, Tag, ViewTabs } from '../components/ui';
import { isOpenTask, useData, useIndex, type Index } from '../lib/data';
import { sprintState, todayISO } from '../lib/sprints';
import { BOARD_STATUSES, PRIORITY, PROJECT_STATUS, fmtDate, firstName, folderColor, plural } from '../lib/format';
import type { Person, Project, ProjectStatus, Sprint, Task } from '../lib/types';
import { usePref } from '../lib/prefs';

type View = 'board' | 'list' | 'ownership';

/** Home = projects in the open sprints (Figma 02 / 02b / 03). Projects shows everything. */
export function Home() {
  const { ready, ws, createProject, addProjectSprint } = useData();
  const ix = useIndex();
  const nav = useNavigate();
  const [view, setView] = usePref<View>('home.view', 'board');
  const [productId, setProductId] = useState<string>('');
  const today = todayISO();
  const { current, extended, active } = useMemo(() => sprintState(ws.sprints, today), [ws.sprints, today]);

  const activeIds = new Set(active.map((s) => s.id));
  const sprintTasks = ws.tasks.filter((t) => t.sprint_id && activeIds.has(t.sprint_id));
  const projectIds = new Set([
    ...ws.projectSprints.filter((l) => activeIds.has(l.sprint_id)).map((l) => l.project_id),
    ...sprintTasks.map((t) => t.project_id).filter(Boolean) as string[],
  ]);
  const projects = ws.projects
    .filter((p) => projectIds.has(p.id))
    .filter((p) => !productId || ix.productOf(p)?.id === productId);

  if (!ready) return <Loading />;

  const sprintChip = active.map((s) => (s.ends_on < today && s.status === 'open' ? `${s.name.replace('Sprint ', '')} (extended)` : s.name.replace('Sprint ', ''))).join(' + ');

  async function newProject() {
    // A project made from Home belongs to the current sprint, so it shows up here.
    const id = await createProject({ name: 'Untitled project', status: 'not_started' });
    if (!id) return;
    if (current) await addProjectSprint(id, current.id);
    nav(`/projects/${id}`);
  }

  return (
    <div className="page">
      <PageHeader emoji="🏠" title="Home" subtitle="Projects in the open sprints. To see every project, go to Projects." />
      <SprintBanner current={current} extended={extended} />
      <div className="toolbar">
        <ViewTabs<View> value={view} onChange={setView} tabs={[
          { value: 'board', label: 'Board', icon: <LayoutGrid size={14} /> },
          { value: 'list', label: 'List by product', icon: <List size={14} /> },
          { value: 'ownership', label: 'Ownership', icon: <PieChart size={14} /> },
        ]} />
        <span className="grow" />
        <Button icon={<Plus size={14} />} onClick={newProject}>New project</Button>
      </div>
      <div className="toolbar">
        {active.length > 0 && <Chip>{active.length > 1 ? 'Sprints' : 'Sprint'}: {sprintChip}</Chip>}
        <label className="chip chip-sand t-caption select-chip">
          <Plus size={12} aria-hidden /> Product:
          <select value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Filter by product">
            <option value="">All</option>
            {ws.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      {view === 'board' && <Board projects={projects} ix={ix} tasks={sprintTasks} today={today} />}
      {view === 'list' && <ListByProduct projects={projects} ix={ix} />}
      {view === 'ownership' && <Ownership projects={projects} ix={ix} tasks={sprintTasks} active={active} people={ws.people} allProjects={ws.projects} today={today} />}
    </div>
  );
}

const boardStatus = (s: ProjectStatus): ProjectStatus => (s === 'waiting_for_feedback' ? 'paused' : s === 'canceled' ? 'done' : s);

function card(p: Project, ix: Index, tasks: Task[], today: string, pill?: React.ReactNode) {
  const product = ix.productOf(p);
  const mine = tasks.filter((t) => t.project_id === p.id);
  const pr = ix.progress(mine);
  const lead = ix.people(p, 'lead')[0];
  return (
    <ProjectFolder key={p.id} to={`/projects/${p.id}`} color={folderColor(product?.name)} emoji={p.emoji ?? product?.emoji} name={p.name}
      tags={<>
        <Tag tone="blue">{product?.name ?? 'No product'}</Tag>
        {p.priority && <Tag tone={PRIORITY[p.priority].tone}>{PRIORITY[p.priority].label}</Tag>}
      </>}
      done={pr.done} total={pr.total}
      pill={pill ?? (lead ? firstName(lead) : 'No lead yet')}
      date={p.ends_on ? fmtDate(p.ends_on, false) : 'No due date'}
      dateWarn={!!p.ends_on && p.ends_on < today && p.status !== 'done'} />
  );
}

function Board({ projects, ix, tasks, today }: { projects: Project[]; ix: Index; tasks: Task[]; today: string }) {
  const [showAllDone, setShowAllDone] = useState(false);
  return (
    <div className="board">
      {BOARD_STATUSES.map((st) => {
        const col = projects.filter((p) => boardStatus(p.status) === st);
        const limit = st === 'done' && !showAllDone ? 3 : Infinity;
        return (
          <section key={st} className={`board-col col-${st}`} aria-label={PROJECT_STATUS[st].label}>
            <header className="col-header t-caption-emphasis">
              <span className={`dot dot-${st}`} aria-hidden />{PROJECT_STATUS[st].label}<span className="muted">{col.length}</span>
            </header>
            {col.slice(0, limit).map((p) => card(p, ix, tasks, today))}
            {col.length > limit && (
              <button type="button" className="link-button t-caption col-more" onClick={() => setShowAllDone(true)}>+ {col.length - limit} more</button>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ListByProduct({ projects, ix }: { projects: Project[]; ix: Index }) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const groups = new Map<string, { name: string; emoji: string | null; rows: Project[] }>();
  for (const p of projects) {
    const pr = ix.productOf(p);
    const key = pr?.id ?? 'none';
    if (!groups.has(key)) groups.set(key, { name: pr?.name ?? 'No product', emoji: pr?.emoji ?? null, rows: [] });
    groups.get(key)!.rows.push(p);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].rows.length - a[1].rows.length);
  const order: ProjectStatus[] = ['in_progress', 'not_started', 'paused', 'waiting_for_feedback', 'done', 'canceled'];
  return (
    <div className="table" role="table">
      <div className="tr th t-caption" role="row">
        <span>Project</span><span>Priority</span><span>Status</span><span>Lead</span><span>End date</span><span>Progress</span>
      </div>
      {sorted.map(([key, g]) => (
        <div key={key} role="rowgroup">
          <GroupHeader open={!closed.has(key)} count={g.rows.length}
            onToggle={() => setClosed((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; })}>
            {g.emoji && <span aria-hidden>{g.emoji} </span>}{g.name}
          </GroupHeader>
          {!closed.has(key) && g.rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)).map((p) => {
            const pr = ix.progress(ix.tasksOf(p));
            return (
              <div key={p.id} className="tr t-body" role="row">
                <RowLink to={`/projects/${p.id}`}>{p.emoji ?? g.emoji} {p.name}</RowLink>
                <span>{p.priority ? <Tag tone={PRIORITY[p.priority].tone}>{PRIORITY[p.priority].label}</Tag> : <span className="muted">—</span>}</span>
                <span><Tag tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Tag></span>
                <span className="t-caption"><People people={ix.people(p, 'lead')} /></span>
                <span className="t-caption">{fmtDate(p.ends_on)}</span>
                <span className="progress-cell t-caption"><Progress pct={pr.pct} /><span>{pr.pct}%</span></span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function RowLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="row-link t-body">{children}</Link>;
}

function Ownership({ projects, ix, tasks, active, people, allProjects, today }: {
  projects: Project[]; ix: Index; tasks: Task[]; active: Sprint[]; people: Person[]; allProjects: Project[]; today: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sprintNames = active.map((s) => s.name).join(' + ') || 'this sprint';
  const activeProjects = allProjects.filter((p) => ['in_progress', 'not_started', 'paused', 'waiting_for_feedback'].includes(p.status));

  const leadCount = new Map<string, number>();
  for (const p of activeProjects) for (const l of ix.people(p, 'lead')) leadCount.set(l.id, (leadCount.get(l.id) ?? 0) + 1);
  const topLead = [...leadCount.entries()].sort((a, b) => b[1] - a[1]);
  const unassignedTasks = tasks.filter((t) => isOpenTask(t.status) && !ix.assignees(t).length).length;

  type Row = { project: Project; role: 'Lead' | 'Support' | 'Helping' };
  const groups = people.map((person) => {
    const rows: Row[] = [];
    for (const p of projects) {
      const isLead = ix.people(p, 'lead').some((x) => x.id === person.id);
      const isSupport = ix.people(p, 'support').some((x) => x.id === person.id);
      const hasTasks = tasks.some((t) => t.project_id === p.id && ix.assignees(t).some((a) => a.id === person.id));
      if (isLead || isSupport || hasTasks) rows.push({ project: p, role: isLead ? 'Lead' : isSupport ? 'Support' : 'Helping' });
    }
    const mine = tasks.filter((t) => ix.assignees(t).some((a) => a.id === person.id));
    const leads = rows.filter((r) => r.role === 'Lead').length;
    rows.sort((a, b) => ['Lead', 'Support', 'Helping'].indexOf(a.role) - ['Lead', 'Support', 'Helping'].indexOf(b.role));
    return { person, rows, mine, leads, leadsOverall: leadCount.get(person.id) ?? 0 };
  }).filter((g) => g.rows.length || g.leadsOverall)
    .sort((a, b) => b.mine.length - a.mine.length || b.rows.length - a.rows.length);

  const noLead = projects.filter((p) => !ix.people(p, 'lead').length);

  return (
    <>
      {topLead.length > 0 && (
        <div className="callout callout-sand t-body"><span aria-hidden>💡</span><span>
          {firstName(ix.person.get(topLead[0][0]))} leads {topLead[0][1]} of the {activeProjects.length} active projects
          {topLead[1] ? `, ${topLead[1][1] ? (topLead[0][1] / topLead[1][1]).toFixed(1).replace('.0', '') + '× as many as anyone else' : 'more than anyone else'}` : ''}.
          {unassignedTasks > 0 && ` ${plural(unassignedTasks, 'task')} in ${sprintNames} ${unassignedTasks === 1 ? 'has' : 'have'} no one assigned.`}
        </span></div>
      )}
      <section className="panel">
        <header className="panel-header">
          <h2 className="t-title-subsection">Who has what</h2>
          <span className="legend t-caption"><span className="dot dot-done" /> Done <span className="dot dot-open" /> Open</span>
        </header>
        <p className="t-caption muted">Each folder is a project. Click a folder to open it.</p>
        {groups.map(({ person, rows, mine, leads, leadsOverall }) => {
          const done = mine.filter((t) => t.status === 'done').length;
          const open = mine.length - done;
          const isOpen = expanded.has(person.id);
          return (
            <div key={person.id} className="owner-group">
              <div className="owner-header">
                <Avatar name={person.name} size={20} />
                <span className="t-body-emphasis">{firstName(person)}</span>
                <span className="t-caption muted">
                  {rows.length ? `${plural(rows.length, 'project')} · leads ${leads}` : `Leads ${leadsOverall} · none in ${sprintNames}`}
                </span>
                <span className="grow" />
                {rows.length > 0 ? <>
                  <span className="split-bar" aria-hidden>
                    <span className="split-done" style={{ flex: done || 0.0001 }} /><span className="split-open" style={{ flex: open || 0.0001 }} />
                  </span>
                  <span className="t-caption muted">{done} done · {open} open</span>
                  {rows.length > 4 && (
                    <button type="button" className="link-button t-caption-emphasis" onClick={() => setExpanded((s) => { const n = new Set(s); n.has(person.id) ? n.delete(person.id) : n.add(person.id); return n; })}>
                      {isOpen ? 'Show fewer' : `See all ${rows.length} ↗`}
                    </button>
                  )}
                </> : <span className="t-caption muted">No tasks this sprint</span>}
              </div>
              {rows.length > 0 && (
                <div className="folder-grid">
                  {rows.slice(0, isOpen ? undefined : 4).map((r) => card(r.project, ix, tasks, today, r.role))}
                </div>
              )}
            </div>
          );
        })}
        {noLead.length > 0 && (
          <div className="owner-group">
            <div className="owner-header"><span className="t-body-emphasis">Unassigned</span><span className="t-caption muted">{plural(noLead.length, 'project')}</span></div>
            <div className="folder-grid">{noLead.map((p) => card(p, ix, tasks, today, 'No lead'))}</div>
          </div>
        )}
      </section>
    </>
  );
}
