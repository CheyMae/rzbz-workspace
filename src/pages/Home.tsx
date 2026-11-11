import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

interface SprintRow { id: string; number: number; starts_on: string; ends_on: string; is_extended: boolean; days_past_end: number }

const fmt = (d: string, year = false) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) });

/** Shell version of Home: the open-sprint banners (settled in Figma). The board comes next. */
export function Home() {
  const { previousVisit } = useAuth();
  const [sprints, setSprints] = useState<SprintRow[] | null>(null);
  const [stats, setStats] = useState<Record<string, { done: number; total: number }>>({});

  useEffect(() => {
    if (!supabase) { setSprints([]); return; }
    (async () => {
      const { data } = await supabase.from('sprint_overview').select('*').eq('status', 'open').order('number');
      setSprints((data as SprintRow[]) ?? []);
      const next: Record<string, { done: number; total: number }> = {};
      for (const s of data ?? []) {
        const base = () => supabase!.from('tasks').select('*', { count: 'exact', head: true }).eq('sprint_id', s.id).eq('is_archived', false);
        const [{ count: total }, { count: done }] = await Promise.all([base(), base().eq('status', 'done')]);
        next[s.id] = { done: done ?? 0, total: total ?? 0 };
      }
      setStats(next);
    })();
  }, []);

  return (
    <div className="page">
      <PageHeader emoji="🏠" title="Home" subtitle="Projects in the open sprints. To see every project, go to Projects." />
      {previousVisit && (
        <p className="t-caption muted">Last visit: {previousVisit.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
      )}
      <section className="sprint-stack" aria-label="Open sprints">
        {sprints === null && <div className="sprint-banner skeleton" />}
        {sprints?.map((s) => {
          const st = stats[s.id];
          const pct = st && st.total ? Math.round((st.done / st.total) * 100) : 0;
          return (
            <article key={s.id} className="sprint-banner">
              <div className="sprint-title">
                <h2 className="t-title-subsection">Sprint {s.number} · {s.is_extended ? 'extended' : 'current'}</h2>
                <p className={`t-caption ${s.is_extended ? 'warn' : 'muted'}`}>
                  {fmt(s.starts_on)} → {fmt(s.ends_on, !s.is_extended)}
                  {s.is_extended && ` · ${s.days_past_end} day${s.days_past_end === 1 ? '' : 's'} past its end date`}
                </p>
              </div>
              <div className="sprint-progress">
                <div className="sprint-progress-label t-caption-emphasis">
                  <span>{st ? `${st.done} of ${st.total} tasks done` : '…'}</span><span className="muted">{pct}%</span>
                </div>
                <div className="progress"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="stat"><span className="t-title-section">{st ? st.total - st.done : '–'}</span><span className="t-caption muted">open tasks</span></div>
            </article>
          );
        })}
        {sprints?.length === 0 && <p className="t-body muted">No open sprint.</p>}
      </section>
      <div className="callout t-body"><span aria-hidden>🚧</span><span>The board, list and ownership views come next, once their screens are final.</span></div>
    </div>
  );
}
