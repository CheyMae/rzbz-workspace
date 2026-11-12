export type ProjectStatus = 'not_started' | 'in_progress' | 'paused' | 'done' | 'waiting_for_feedback' | 'canceled';
export type TaskStatus = 'not_started' | 'next_up' | 'in_progress' | 'design_ready' | 'done' | 'archived';
export type Priority = 'low' | 'medium' | 'high';

export interface Person { id: string; name: string; email: string | null }
export interface Product { id: string; name: string; emoji: string | null; sort_order: number }

export interface Sprint {
  id: string;
  year: number;
  number: number | null;
  suffix: string;
  kind: 'sprint' | 'break';
  name: string;
  starts_on: string;
  ends_on: string;
  status: 'upcoming' | 'open' | 'closed';
  closed_at: string | null;
}

export interface Project {
  id: string;
  name: string;
  emoji: string | null;
  product_id: string | null;
  status: ProjectStatus;
  priority: Priority | null;
  type: string | null;
  starts_on: string | null;
  ends_on: string | null;
  about: string | null;
  is_archived: boolean;
  legacy_year: number | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  project_id: string | null;
  sprint_id: string | null;
  status: TaskStatus;
  priority: Priority | null;
  phase: string | null;
  type: string | null;
  due_start: string | null;
  due_end: string | null;
  parent_task_id: string | null;
  summary: string | null;
  notes: string | null;
  carried_over_from: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LibraryItem {
  id: string;
  section: string;
  name: string;
  product_group: string | null;
  type: string | null;
  status: string | null;
  url: string | null;
  second_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
