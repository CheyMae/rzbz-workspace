import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { CloseSprintDialog } from '../components/CloseSprintDialog';
import { Loading, Tag } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { useData, useIndex } from '../lib/data';
import { PROJECT_STATUS, firstName, fmtDate, plural } from '../lib/format';
import { daysBetween, sprintState, todayISO } from '../lib/sprints';
import type { ProjectStatus, Sprint } from '../lib/types';

/** Everything before this came from the Notion import, so it isn't "new". */
const IMPORTED_BEFORE = '2026-11-12T00:00:00Z';

interface Log { at: string; actor: string | null; entity: string; entity_id: string | null; action: string; changes: any }

/** Figma 11 · Welcome back recap: shown after a few days away (and any time from /welcome). */
export function Welcome() {
  const { session, previousVisit } = useAuth();
  const { ready, ws } = useData();
  const ix = useIndex();
  const nav = useNavigate();
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [closing, setClosing] = useState<Sprint | null>(null);
  const since = previousVisit ?? new Date(Date.now() - 7 * 86_400_000);

  useEffect(() => {
    if (!supabase) { setLogs([]); return; }
    supabase.from('activity_log').select('at,actor,entity,entity_id,action,changes').gte('at', since.toISOString())
      .order('at', { ascending: false }).limit(500).then(({ data }) => setLogs((data ?? []) as Log[]));
  }, [since.getTime()]);

  if (!ready || !logs) return <Loading />;
  const today = todayISO();
  const me = ws.people.find((p) => p.email && p.email === session?.user.email?.toLowerCase());
  const days = Math.max(1, daysBetween(since.toISOString().slice(0, 10), today));
  const { current, extended } = sprintState(ws.sprints, today);
  const sinceISO = since.toISOString() > IMPORTED_BEFORE ? since.toISOString() : IMPORTED_BEFORE;

  const newForMe = me ? ws.tasks.filter((t) => t.created_at > sinceISO && ix.assignees(t).some((a) => a.id === me.id)) : [];
  const lateLeads = me ? ws.projects.filter((p) => p.ends_on && p.ends_on < today && !['done', 'canceled'].includes(p.status)
    && ix.people(p, 'lead').some((l) => l.id === me.id)) : [];
  const doneLogs = logs.filter((l) => l.entity === 'tasks' && l.changes?.status?.to === 'done');
  const doneTasks = [...new Set(doneLogs.map((l) => l.entity_id))].map((id) => ws.tasks.find((t) => t.id === id)).filter(Boolean);
  const projectLogs = logs.filter((l) => l.entity === 'projects' && (l.action === 'insert' || l.changes?.status));
  const seen = new Set<string>();
  const projectChanges = projectLogs.filter((l) => l.entity_id && !seen.has(l.entity_id) && seen.add(l.entity_id));
  const newLinks = ws.library.filter((l) => l.created_at > sinceISO);

  return (
    <div className="page">
      <header className="page-header">
        <span className="page-emoji" aria-hidden>👋</span>
        <h1 className="t-title-screen">Welcome back{me ? `, ${firstName(me)}` : ''}</h1>
        <p className="t-body muted">Your last visit was {fmtDate(since.toISOString(), false)}, {plural(days, 'day')} ago. Here is what changed while you were away.</p>
      </header>

      <section className="panel">
        <h2 className="t-title-subsection">Needs you</h2>
        {extended.map((s) => (
          <div key={s.id} className="recap-row">
            <span aria-hidden>🏃</span>
            <span className="grow"><span className="t-body">{s.name} passed its end date ({fmtDate(s.ends_on, false)}) and is still open</span>
              <span className="t-caption muted">{plural(ix.progress(ix.tasksIn(s)).open, 'open task')}. Close it, or keep it open a little longer.</span></span>
            <Button onClick={() => setClosing(s)}>Close sprint</Button>
          </div>
        ))}
        {newForMe.length > 0 && (
          <div className="recap-row"><span aria-hidden>📝</span>
            <span className="grow"><span className="t-body">{plural(newForMe.length, 'new task')} {newForMe.length === 1 ? 'was' : 'were'} assigned to you</span>
              <span className="t-caption muted">{newForMe.slice(0, 3).map((t) => t.title).join(', ')}{newForMe.length > 3 ? '…' : ''}</span></span>
            {newForMe[0].sprint_id && <Button variant="secondary" onClick={() => nav(`/sprints/${newForMe[0].sprint_id}`)}>View tasks</Button>}
          </div>
        )}
        {lateLeads.slice(0, 3).map((p) => (
          <div key={p.id} className="recap-row"><span aria-hidden>⚠️</span>
            <span className="grow"><span className="t-body">{p.name} is past its end date ({fmtDate(p.ends_on, false)})</span>
              <span className="t-caption muted">You lead this project. Update the date or move it to Done.</span></span>
            <Button variant="secondary" onClick={() => nav(`/projects/${p.id}`)}>Open project</Button>
          </div>
        ))}
        {!extended.length && !newForMe.length && !lateLeads.length && <p className="t-body muted">Nothing needs you right now.</p>}
      </section>

      <div className="recap-grid">
        <div className="recap-col">
          <section className="panel">
            <h2 className="t-title-subsection">Sprints</h2>
            {current && !extended.includes(current) && (
              <div className="recap-row"><span className="grow"><span className="t-body">{current.name} {current.starts_on > sinceISO.slice(0, 10) ? `started on ${fmtDate(current.starts_on, false)}` : 'is the current sprint'}</span>
                <span className="t-caption muted">{plural(ix.tasksIn(current).length, 'task')} · ends {fmtDate(current.ends_on, false)}</span></span><Tag tone="green">Current</Tag></div>
            )}
            {extended.map((s) => {
              const pr = ix.progress(ix.tasksIn(s));
              return <div key={s.id} className="recap-row"><span className="grow"><span className="t-body">{s.name} is extended</span>
                <span className="t-caption muted">{pr.done} of {pr.total} tasks done · {plural(daysBetween(s.ends_on, today), 'day')} past its end date</span></span><Tag tone="yellow">Extended</Tag></div>;
            })}
          </section>
          <section className="panel">
            <h2 className="t-title-subsection">Project changes</h2>
            {projectChanges.slice(0, 5).map((l) => {
              const p = ws.projects.find((x) => x.id === l.entity_id);
              if (!p) return null;
              const st = PROJECT_STATUS[p.status as ProjectStatus];
              return <div key={l.entity_id} className="recap-row"><span className="grow">
                <Link to={`/projects/${p.id}`} className="plain-link t-body">{p.name}</Link>
                <span className="t-caption muted">{l.action === 'insert' ? 'New project' : `${PROJECT_STATUS[l.changes.status.from as ProjectStatus]?.label ?? l.changes.status.from} → ${st.label}`} · {fmtDate(l.at, false)}</span>
              </span><Tag tone={st.tone}>{st.label}</Tag></div>;
            })}
            {!projectChanges.length && <p className="t-caption muted">No project changes.</p>}
          </section>
        </div>
        <div className="recap-col">
          <section className="panel">
            <h2 className="t-title-subsection">Done while you were away ({doneTasks.length})</h2>
            {doneTasks.slice(0, 5).map((t) => {
              const p = t!.project_id ? ix.project.get(t!.project_id) : null;
              return <div key={t!.id} className="recap-row"><span aria-hidden>✅</span><span className="grow"><span className="t-body">{t!.title}</span>
                <span className="t-caption muted">{p?.name ?? 'No project'}{ix.assignees(t!)[0] ? ` · ${firstName(ix.assignees(t!)[0])}` : ''}</span></span></div>;
            })}
            {doneTasks.length > 5 && <p className="t-caption muted">+ {doneTasks.length - 5} more</p>}
            {!doneTasks.length && <p className="t-caption muted">Nothing was marked done.</p>}
          </section>
          <section className="panel">
            <h2 className="t-title-subsection">New in Library</h2>
            {newLinks.slice(0, 5).map((l) => <div key={l.id} className="recap-row"><span className="grow"><span className="t-body">{l.name}</span>
              <span className="t-caption muted">{l.type ?? l.section} · added {fmtDate(l.created_at, false)}</span></span></div>)}
            {!newLinks.length && <p className="t-caption muted">No new links.</p>}
          </section>
        </div>
      </div>
      <div className="toolbar"><Button size="md" onClick={() => nav('/')}>Go to Home</Button></div>
      {closing && <CloseSprintDialog sprint={closing} onClose={() => setClosing(null)} />}
    </div>
  );
}
