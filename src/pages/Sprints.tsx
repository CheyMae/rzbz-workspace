import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Loading, Progress, Tag } from '../components/ui';
import { useData, useIndex } from '../lib/data';
import { fmtRange } from '../lib/format';
import { sprintLabel, todayISO } from '../lib/sprints';

const tone = { Current: 'yellow', Extended: 'red', Upcoming: 'blue', Closed: 'default', Break: 'default' } as const;

/** Figma 06 · Sprints: newest first, with breaks shown where the team paused. */
export function Sprints() {
  const { ready, ws } = useData();
  const ix = useIndex();
  const [all, setAll] = useState(false);
  if (!ready) return <Loading />;
  const today = todayISO();
  const rows = [...ws.sprints].sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  const real = rows.filter((s) => s.kind === 'sprint');
  const shown = all ? rows : rows.slice(0, 9);
  const first = real[real.length - 1];

  return (
    <div className="page">
      <PageHeader emoji="🏃" title="Sprints"
        subtitle={`${real.length} sprints since ${first ? new Date(first.starts_on + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}. Two weeks each, open until someone closes them.`} />
      <div className="table" role="table">
        <div className="tr th t-caption cols-sprints" role="row"><span>Sprint</span><span>Dates</span><span>Tasks</span><span>Open</span><span>Progress</span></div>
        {shown.map((s) => {
          const label = sprintLabel(s, today);
          if (s.kind === 'break') {
            return (
              <div key={s.id} className="tr t-body cols-sprints row-break" role="row">
                <span className="muted">⏸ Break</span><span className="t-caption muted">{fmtRange(s.starts_on, s.ends_on)}</span><span /><span /><span className="t-caption muted">No sprint</span>
              </div>
            );
          }
          const pr = ix.progress(ix.tasksIn(s));
          return (
            <div key={s.id} className={`tr t-body cols-sprints${label === 'Current' || label === 'Extended' ? ' row-current' : ''}`} role="row">
              <span className="sprint-name">
                <Link to={`/sprints/${s.id}`} className="row-link">🏃 {s.name}</Link>
                {label !== 'Closed' && <Tag tone={tone[label]}>{label}</Tag>}
              </span>
              <span className="t-caption">{fmtRange(s.starts_on, s.ends_on)}</span>
              <span className="t-caption">{pr.total || '—'}</span>
              <span className="t-caption">{pr.open || '—'}</span>
              <span className="progress-cell t-caption">{pr.total ? <><Progress pct={pr.pct} /><span>{pr.pct}%</span></> : <span className="muted">No tasks yet</span>}</span>
            </div>
          );
        })}
        {rows.length > 9 && (
          <button type="button" className="show-more t-caption muted" onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : `Show ${rows.length - 9} earlier`}
          </button>
        )}
      </div>
      <p className="t-caption muted">Sprints 1–4 (mid-2025) aren’t tracked here; their tasks are in the Archive.</p>
    </div>
  );
}
