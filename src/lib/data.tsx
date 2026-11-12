import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { LibraryItem, Person, Product, Project, Sprint, Task, TaskStatus } from './types';

/**
 * One shared copy of the live workspace (current projects, their tasks, sprints, people, library).
 * The team is small, so the whole working set loads at once and every screen derives from it.
 * Edits are applied locally first, then saved; a failed save reloads from the database.
 */

interface Link { project_id: string; product_id: string }
interface Role { project_id: string; person_id: string; role: 'lead' | 'support' }
interface PS { project_id: string; sprint_id: string }
interface TA { task_id: string; person_id: string }

export interface Workspace {
  people: Person[];
  products: Product[];
  sprints: Sprint[];
  projects: Project[];
  tasks: Task[];
  library: LibraryItem[];
  projectProducts: Link[];
  projectPeople: Role[];
  projectSprints: PS[];
  taskAssignees: TA[];
}

const empty: Workspace = {
  people: [], products: [], sprints: [], projects: [], tasks: [], library: [],
  projectProducts: [], projectPeople: [], projectSprints: [], taskAssignees: [],
};

async function fetchAll<T>(table: string, select = '*', apply?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase!.from(table).select(select).range(from, from + 999);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const TASK_COLS = 'id,title,project_id,sprint_id,status,priority,phase,type,due_start,due_end,parent_task_id,summary,notes,carried_over_from,is_archived,created_at,updated_at';
const PROJECT_COLS = 'id,name,emoji,product_id,status,priority,type,starts_on,ends_on,about,is_archived,legacy_year,created_at,updated_at';

// Local preview only (npm run dev, then /?shell): read a git-ignored copy of the data and save nothing.
// import.meta.env.DEV is false in the published build, so this never ships.
const devFixture = import.meta.env.DEV && new URLSearchParams(window.location.search).has('shell');

async function loadWorkspace(): Promise<Workspace> {
  if (devFixture) return (await fetch(`${import.meta.env.BASE_URL}dev-fixture/workspace.json`)).json();
  const [people, products, sprints, projects, tasks, library, projectProducts, projectPeople, projectSprints, taskAssignees] =
    await Promise.all([
      fetchAll<Person>('people', '*'),
      fetchAll<Product>('products', 'id,name,emoji,sort_order', (q) => q.order('sort_order')),
      fetchAll<Sprint>('sprints', 'id,year,number,suffix,kind,name,starts_on,ends_on,status,closed_at', (q) => q.order('starts_on')),
      fetchAll<Project>('projects', PROJECT_COLS, (q) => q.eq('is_archived', false).order('name')),
      fetchAll<Task>('tasks', TASK_COLS, (q) => q.eq('is_archived', false).order('due_end', { ascending: true, nullsFirst: false })),
      fetchAll<LibraryItem>('library_items', '*', (q) => q.order('sort_order')),
      fetchAll<Link>('project_products'),
      fetchAll<Role>('project_people'),
      fetchAll<PS>('project_sprints', 'project_id,sprint_id'),
      fetchAll<TA>('task_assignees'),
    ]);
  return { people, products, sprints, projects, tasks, library, projectProducts, projectPeople, projectSprints, taskAssignees };
}

type NewTask = Partial<Task> & { title: string };
type NewProject = Partial<Project> & { name: string };

interface DataApi {
  ready: boolean;
  error: string | null;
  ws: Workspace;
  reload: () => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  createTask: (t: NewTask, assignees?: string[]) => Promise<string | null>;
  setTaskAssignees: (taskId: string, personIds: string[]) => Promise<void>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  createProject: (p: NewProject) => Promise<string | null>;
  setProjectProduct: (projectId: string, productId: string | null) => Promise<void>;
  setProjectPeople: (projectId: string, role: 'lead' | 'support', personIds: string[]) => Promise<void>;
  addProjectSprint: (projectId: string, sprintId: string) => Promise<void>;
  removeProjectSprint: (projectId: string, sprintId: string) => Promise<void>;
  closeSprint: (sprintId: string, mode: 'move' | 'keep') => Promise<{ moved_tasks: number; next_up_tasks: number; next: string } | null>;
  createLibraryItem: (item: Partial<LibraryItem> & { name: string; section: string }) => Promise<void>;
  updatePerson: (id: string, patch: Partial<Person>) => Promise<void>;
}

const Ctx = createContext<DataApi | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [ws, setWs] = useState<Workspace>(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase && !devFixture) { setReady(true); return; }
    try { setWs(await loadWorkspace()); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setReady(true); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /** Apply locally, save, and reload if the save fails. */
  const save = useCallback(async (local: (w: Workspace) => Workspace, remote: () => PromiseLike<{ error: any }>) => {
    setWs(local);
    if (devFixture) return;
    const { error } = await remote();
    if (error) { setError(error.message); await reload(); }
  }, [reload]);

  const api = useMemo<DataApi>(() => ({
    ready, error, ws, reload,

    updateTask: (id, patch) => save(
      (w) => ({ ...w, tasks: w.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
      () => supabase!.from('tasks').update(patch).eq('id', id),
    ),

    createTask: async (t, assignees = []) => {
      const { data, error } = await supabase!.from('tasks').insert(t).select(TASK_COLS).single();
      if (error || !data) { setError(error?.message ?? 'Could not add the task'); return null; }
      if (assignees.length) await supabase!.from('task_assignees').insert(assignees.map((p) => ({ task_id: data.id, person_id: p })));
      await reload();
      return data.id as string;
    },

    setTaskAssignees: async (taskId, personIds) => {
      await save(
        (w) => ({ ...w, taskAssignees: [...w.taskAssignees.filter((a) => a.task_id !== taskId), ...personIds.map((p) => ({ task_id: taskId, person_id: p }))] }),
        async () => {
          const del = await supabase!.from('task_assignees').delete().eq('task_id', taskId);
          if (del.error || !personIds.length) return del;
          return supabase!.from('task_assignees').insert(personIds.map((p) => ({ task_id: taskId, person_id: p })));
        },
      );
    },

    updateProject: (id, patch) => save(
      (w) => ({ ...w, projects: w.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)).filter((p) => !p.is_archived) }),
      () => supabase!.from('projects').update(patch).eq('id', id),
    ),

    createProject: async (p) => {
      const { data, error } = await supabase!.from('projects').insert(p).select('id').single();
      if (error || !data) { setError(error?.message ?? 'Could not add the project'); return null; }
      if (p.product_id) await supabase!.from('project_products').insert({ project_id: data.id, product_id: p.product_id });
      await reload();
      return data.id as string;
    },

    setProjectProduct: (projectId, productId) => save(
      (w) => ({
        ...w,
        projects: w.projects.map((p) => (p.id === projectId ? { ...p, product_id: productId } : p)),
        projectProducts: [...w.projectProducts.filter((l) => l.project_id !== projectId), ...(productId ? [{ project_id: projectId, product_id: productId }] : [])],
      }),
      async () => {
        const a = await supabase!.from('projects').update({ product_id: productId }).eq('id', projectId);
        if (a.error) return a;
        const b = await supabase!.from('project_products').delete().eq('project_id', projectId);
        if (b.error || !productId) return b;
        return supabase!.from('project_products').insert({ project_id: projectId, product_id: productId });
      },
    ),

    setProjectPeople: (projectId, role, personIds) => save(
      (w) => ({
        ...w,
        projectPeople: [
          ...w.projectPeople.filter((r) => !(r.project_id === projectId && r.role === role)),
          ...personIds.map((p) => ({ project_id: projectId, person_id: p, role })),
        ],
      }),
      async () => {
        const del = await supabase!.from('project_people').delete().eq('project_id', projectId).eq('role', role);
        if (del.error || !personIds.length) return del;
        return supabase!.from('project_people').insert(personIds.map((p) => ({ project_id: projectId, person_id: p, role })));
      },
    ),

    addProjectSprint: (projectId, sprintId) => save(
      (w) => ({ ...w, projectSprints: [...w.projectSprints, { project_id: projectId, sprint_id: sprintId }] }),
      () => supabase!.from('project_sprints').insert({ project_id: projectId, sprint_id: sprintId }),
    ),

    removeProjectSprint: (projectId, sprintId) => save(
      (w) => ({ ...w, projectSprints: w.projectSprints.filter((l) => !(l.project_id === projectId && l.sprint_id === sprintId)) }),
      () => supabase!.from('project_sprints').delete().eq('project_id', projectId).eq('sprint_id', sprintId),
    ),

    closeSprint: async (sprintId, mode) => {
      const { data, error } = await supabase!.rpc('close_sprint', { p_sprint: sprintId, p_mode: mode });
      if (error) { setError(error.message); return null; }
      await reload();
      return data as { moved_tasks: number; next_up_tasks: number; next: string };
    },

    updatePerson: (id, patch) => save(
      (w) => ({ ...w, people: w.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
      () => supabase!.from('people').update(patch).eq('id', id),
    ),

    createLibraryItem: async (item) => {
      const { error } = await supabase!.from('library_items').insert(item);
      if (error) setError(error.message);
      await reload();
    },
  }), [ready, error, ws, reload, save]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

/** Lookups and roll-ups built once per data change. */
export function useIndex() {
  const { ws } = useData();
  return useMemo(() => buildIndex(ws), [ws]);
}

export type Index = ReturnType<typeof buildIndex>;

export function buildIndex(ws: Workspace) {
  const person = new Map(ws.people.map((p) => [p.id, p]));
  const product = new Map(ws.products.map((p) => [p.id, p]));
  const sprint = new Map(ws.sprints.map((s) => [s.id, s]));
  const project = new Map(ws.projects.map((p) => [p.id, p]));

  const group = <K, V>(rows: V[], key: (r: V) => K) => {
    const m = new Map<K, V[]>();
    for (const r of rows) { const k = key(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
    return m;
  };

  const tasksByProject = group(ws.tasks, (t) => t.project_id);
  const tasksBySprint = group(ws.tasks, (t) => t.sprint_id);
  const assigneesByTask = group(ws.taskAssignees, (a) => a.task_id);
  const rolesByProject = group(ws.projectPeople, (r) => r.project_id);
  const sprintsByProject = group(ws.projectSprints, (l) => l.project_id);
  const productsByProject = group(ws.projectProducts, (l) => l.project_id);

  const productOf = (p: Project): Product | null => {
    if (p.product_id && product.get(p.product_id)) return product.get(p.product_id)!;
    const first = productsByProject.get(p.id)?.[0];
    return first ? product.get(first.product_id) ?? null : null;
  };
  const people = (p: Project, role: 'lead' | 'support') =>
    (rolesByProject.get(p.id) ?? []).filter((r) => r.role === role).map((r) => person.get(r.person_id)).filter(Boolean) as Person[];
  const assignees = (t: Task) => (assigneesByTask.get(t.id) ?? []).map((a) => person.get(a.person_id)).filter(Boolean) as Person[];
  const projectSprints = (p: Project) =>
    (sprintsByProject.get(p.id) ?? []).map((l) => sprint.get(l.sprint_id)).filter(Boolean)
      .sort((a, b) => a!.starts_on.localeCompare(b!.starts_on)) as Sprint[];
  const tasksOf = (p: Project) => tasksByProject.get(p.id) ?? [];
  const tasksIn = (s: Sprint) => tasksBySprint.get(s.id) ?? [];
  const progress = (tasks: Task[]) => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    return { total, done, open: total - done, pct: total ? Math.round((done / total) * 100) : 0 };
  };

  return {
    person, product, sprint, project, productOf, people, assignees, projectSprints, tasksOf, tasksIn, progress,
    tasksByProject, assigneesByTask,
  };
}

export const isOpenTask = (s: TaskStatus) => s !== 'done' && s !== 'archived';
