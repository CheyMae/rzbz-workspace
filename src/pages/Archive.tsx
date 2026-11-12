import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { GroupHeader, Tag } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useData } from '../lib/data';
import { PROJECT_STATUS, TASK_STATUS } from '../lib/format';
import type { Project, ProjectStatus, TaskStatus } from '../lib/types';

interface ATask { id: string; title: string; status: TaskStatus; legacy_sprint: string | null; due_end: string | null; project_id: string | null }

/** Past projects and tasks (2023 onwards), loaded only when you open the Archive. */
export function Archive() {
  const { reload } = useData();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [tasks, setTasks] = useState<ATask[] | null>(null);
  const [taskCount, setTaskCount] = useState<number | null>(null);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase.from('projects').select('*').eq('is_archived', true).order('legacy_year', { ascending: false }).order('name').limit(1000);
    setProjects((data ?? []) as Project[]);
    const { count } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('is_archived', true);
    setTaskCount(count ?? 0);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!supabase || q.trim().length < 2) { setTasks(null); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase!.from('tasks').select('id,title,status,legacy_sprint,due_end,project_id')
        .eq('is_archived', true).ilike('title', `%${q.trim()}%`).limit(50);
      setTasks((data ?? []) as ATask[]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function restore(p: Project) {
    await supabase!.from('projects').update({ is_archived: false }).eq('id', p.id);
    await Promise.all([load(), reload()]);
  }

  const byYear = new Map<string, Project[]>();
  for (const p of projects ?? []) { const k = String(p.legacy_year ?? 'Moved here'); (byYear.get(k) ?? byYear.set(k, []).get(k)!).push(p); }
  const flip = (k: string) => setClosed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="page">
      <PageHeader emoji="🗄️" title="Archive" subtitle={`Past projects and tasks. ${projects ? `${projects.length} projects` : '…'}${taskCount !== null ? ` · ${taskCount.toLocaleString()} tasks` : ''}.`} />
      <div className="toolbar">
        <label className="search-inline t-caption"><Search size={14} aria-hidden />
          <input placeholder="Search archived tasks" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search archived tasks" /></label>
      </div>
      {tasks && (
        <div className="table" role="table">
          <div className="tr th t-caption cols-archive-tasks" role="row"><span>Task</span><span>Status</span><span>Old sprint</span></div>
          {tasks.map((t) => (
            <div key={t.id} className="tr t-body cols-archive-tasks" role="row">
              <span>{t.title}</span><span><Tag tone={TASK_STATUS[t.status]?.tone}>{TASK_STATUS[t.status]?.label ?? t.status}</Tag></span>
              <span className="t-caption muted">{t.legacy_sprint ?? '—'}</span>
            </div>
          ))}
          {!tasks.length && <p className="t-body muted empty-row">No archived tasks match.</p>}
        </div>
      )}
      {!tasks && projects && (
        <div className="table" role="table">
          {[...byYear.entries()].map(([y, rows]) => (
            <div key={y} role="rowgroup">
              <GroupHeader open={!closed.has(y)} onToggle={() => flip(y)} count={rows.length}>{y}</GroupHeader>
              {!closed.has(y) && rows.map((p) => (
                <div key={p.id} className="tr t-body cols-archive" role="row">
                  <span>{p.emoji ?? '📁'} {p.name}</span>
                  <span><Tag tone={PROJECT_STATUS[p.status as ProjectStatus]?.tone}>{PROJECT_STATUS[p.status as ProjectStatus]?.label}</Tag></span>
                  <Button variant="ghost" onClick={() => restore(p)}>Restore</Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
