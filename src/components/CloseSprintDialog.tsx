import { useState } from 'react';
import { Button } from './Button';
import { Dialog } from './ui';
import { isOpenTask, useData, useIndex } from '../lib/data';
import { daysBetween, todayISO } from '../lib/sprints';
import { fmtDate, plural } from '../lib/format';
import type { Sprint } from '../lib/types';

/** Figma 09 · Close sprint. Closing is manual; nothing is lost either way. */
export function CloseSprintDialog({ sprint, onClose }: { sprint: Sprint; onClose: () => void }) {
  const { ws, closeSprint } = useData();
  const ix = useIndex();
  const [mode, setMode] = useState<'move' | 'keep'>('move');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const today = todayISO();
  const next = ws.sprints.filter((s) => s.kind === 'sprint' && s.starts_on > sprint.starts_on)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
  const nextName = next?.name ?? 'the next sprint';
  const tasks = ix.tasksIn(sprint);
  const open = tasks.filter((t) => isOpenTask(t.status));
  const nextUp = open.filter((t) => t.status === 'next_up');
  const rest = open.filter((t) => t.status !== 'next_up');
  const projects = new Set(open.map((t) => t.project_id).filter(Boolean)).size;
  const count = (s: string) => open.filter((t) => t.status === s).length;
  const unassigned = open.filter((t) => !ix.assignees(t).length).length;
  const doneButOpen = [...new Set(open.map((t) => t.project_id))]
    .map((id) => (id ? ix.project.get(id) : undefined)).filter((p) => p?.status === 'done');
  const ago = daysBetween(sprint.ends_on, today);

  async function confirm() {
    setBusy(true);
    const r = await closeSprint(sprint.id, mode);
    setBusy(false);
    if (r) setResult(`${sprint.name} is closed. ${r.next} is now open` +
      (r.moved_tasks ? `, with ${plural(r.moved_tasks, 'task')} moved over` : '') +
      (r.next_up_tasks ? ` and ${plural(r.next_up_tasks, 'Next Up task')} started as Not started` : '') + '.');
  }

  if (result) {
    return (
      <Dialog title="Sprint closed" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
        <p className="t-body">{result}</p>
      </Dialog>
    );
  }

  return (
    <Dialog title={`Close ${sprint.name}?`} onClose={onClose}
      footer={<>
        <Button variant="ghost" size="md" onClick={onClose}>Not yet</Button>
        <Button size="md" onClick={confirm} disabled={busy}>{busy ? 'Closing…' : `Close ${sprint.name}`}</Button>
      </>}>
      <p className="t-body muted">
        {sprint.name} {ago > 0 ? `ended on ${fmtDate(sprint.ends_on, false)}, ${plural(ago, 'day')} ago` : 'ends today'}.
        {' '}It stays open until someone closes it, so nothing gets lost. {plural(open.length, 'task')} across {plural(projects, 'project')} {open.length === 1 ? 'is' : 'are'} still open.
      </p>
      <div className="stat-tiles">
        {[['Not started', 'not_started'], ['In progress', 'in_progress'], ['Design ready', 'design_ready'], ['Next up', 'next_up']].map(([l, s]) => (
          <div key={s} className="stat-tile"><span className="t-title-section">{count(s)}</span><span className="t-caption muted">{l}</span></div>
        ))}
      </div>
      {rest.length > 0 && <>
        <p className="t-body-emphasis">What should happen to the {plural(rest.length, 'open task')}?</p>
        <div className="radio-cards" role="radiogroup">
          <label className={`radio-card${mode === 'move' ? ' is-selected' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'move'} onChange={() => setMode('move')} />
            <span><span className="t-body-emphasis">Move them to {nextName}</span>
              <span className="t-caption muted">Recommended. Their projects then show both sprints.</span></span>
          </label>
          <label className={`radio-card${mode === 'keep' ? ' is-selected' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'keep'} onChange={() => setMode('keep')} />
            <span><span className="t-body-emphasis">Keep them in {sprint.name}</span>
              <span className="t-caption muted">{sprint.name} closes and the tasks stay listed under it.</span></span>
          </label>
        </div>
      </>}
      {nextUp.length > 0 && (
        <p className="t-caption muted">{plural(nextUp.length, 'Next Up task')} belong{nextUp.length === 1 ? 's' : ''} to {nextName} and will start there as Not started.</p>
      )}
      {(unassigned > 0 || doneButOpen.length > 0) && (
        <div className="callout callout-yellow t-body"><span aria-hidden>💡</span><span>
          Check before closing:{unassigned > 0 && ` ${plural(unassigned, 'open task')} ${unassigned === 1 ? 'has' : 'have'} no assignee.`}
          {doneButOpen.length === 1 && ` ${doneButOpen[0]!.name} is marked Done but still has open tasks.`}
          {doneButOpen.length > 1 && ` ${doneButOpen.length} projects are marked Done but still have open tasks: ${doneButOpen.map((p) => p!.name).join(', ')}.`}
        </span></div>
      )}
    </Dialog>
  );
}
