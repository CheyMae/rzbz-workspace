import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Button';
import { Progress, Stat } from './ui';
import { CloseSprintDialog } from './CloseSprintDialog';
import { useIndex } from '../lib/data';
import { canClose, daysBetween, isCloseDay, isExtended, todayISO } from '../lib/sprints';
import { fmtDate, fmtRange, plural } from '../lib/format';
import type { Sprint } from '../lib/types';

/**
 * Home's sprint card (Figma 02 · Home · Board).
 * - Before the planned end day: no Close sprint button.
 * - On the planned end day: the button sits in the card.
 * - After it, while still open (extended): a red strip per extended sprint, each with its own button.
 */
export function SprintBanner({ current, extended }: { current: Sprint | null; extended: Sprint[] }) {
  const ix = useIndex();
  const [closing, setClosing] = useState<Sprint | null>(null);
  const today = todayISO();
  if (!current) return <div className="sprint-card"><p className="t-body muted">No open sprint.</p></div>;

  const tasks = ix.tasksIn(current);
  const pr = ix.progress(tasks);
  const projects = new Set(tasks.map((t) => t.project_id).filter(Boolean)).size;
  const mainExtended = isExtended(current, today);
  const strips = extended.filter((s) => s.id !== current.id);

  return (
    <section className="sprint-card" aria-label="Sprints">
      <div className="sprint-main">
        <div className="sprint-title">
          <Link to={`/sprints/${current.id}`} className="plain-link"><h2 className="t-title-subsection">
            {current.name} · {mainExtended ? 'extended' : isCloseDay(current, today) ? 'ends today' : 'current'}
          </h2></Link>
          <p className={`t-caption ${mainExtended ? 'warn' : 'muted'}`}>
            {fmtRange(current.starts_on, current.ends_on)}
            {mainExtended && ` · ${plural(daysBetween(current.ends_on, today), 'day')} past its end date`}
          </p>
        </div>
        <div className="sprint-progress">
          <div className="sprint-progress-label t-caption-emphasis"><span>{pr.done} of {pr.total} tasks done</span><span className="muted">{pr.pct}%</span></div>
          <Progress pct={pr.pct} label={`${current.name} progress`} />
        </div>
        <Stat value={projects} label="projects" />
        <Stat value={pr.open} label="open tasks" />
        {canClose(current, today) && <Button variant="danger" onClick={() => setClosing(current)}>Close sprint</Button>}
      </div>
      {strips.map((s) => {
        const p = ix.progress(ix.tasksIn(s));
        const ago = daysBetween(s.ends_on, today);
        return (
          <div key={s.id} className="sprint-strip t-caption">
            <span className="t-caption-emphasis">{s.name} isn’t closed yet</span>
            <span className="warn">Ended {fmtDate(s.ends_on, false)} · {ago === 1 ? 'yesterday' : `${ago} days ago`}</span>
            <span className="grow" />
            <span className="muted">{p.done} of {p.total} tasks done · {p.open} still open</span>
            <Button variant="danger" onClick={() => setClosing(s)}>Close sprint</Button>
          </div>
        );
      })}
      {closing && <CloseSprintDialog sprint={closing} onClose={() => setClosing(null)} />}
    </section>
  );
}
