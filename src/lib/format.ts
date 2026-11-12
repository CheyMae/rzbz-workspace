import type { Person, Priority, ProjectStatus, TaskStatus } from './types';

const d = (iso: string) => new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);

export const fmtDate = (iso: string | null | undefined, year = true) =>
  iso ? d(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) }) : '—';

/** "Nov 23 → Dec 4, 2026"; shows both years when they differ. */
export const fmtRange = (a: string, b: string) =>
  `${fmtDate(a, d(a).getFullYear() !== d(b).getFullYear())} → ${fmtDate(b)}`;

export const firstName = (p: Person | null | undefined) => (p ? p.name.trim().split(/\s+/)[0] : '');

export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export type Tone = 'default' | 'red' | 'yellow' | 'green' | 'blue';

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  not_started: { label: 'Not started yet', tone: 'default' },
  in_progress: { label: 'In Progress', tone: 'yellow' },
  paused: { label: 'Paused', tone: 'red' },
  done: { label: 'Done', tone: 'green' },
  waiting_for_feedback: { label: 'Waiting for feedback', tone: 'blue' },
  canceled: { label: 'Canceled', tone: 'default' },
};
export const BOARD_STATUSES: ProjectStatus[] = ['not_started', 'in_progress', 'paused', 'done'];

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  not_started: { label: 'Not Started', tone: 'default' },
  next_up: { label: 'Next Up', tone: 'blue' },
  in_progress: { label: 'In Progress', tone: 'yellow' },
  design_ready: { label: 'Design Ready', tone: 'blue' },
  done: { label: 'Done', tone: 'green' },
  archived: { label: 'Archived', tone: 'default' },
};
export const TASK_FLOW: TaskStatus[] = ['not_started', 'next_up', 'in_progress', 'design_ready', 'done'];

export const PRIORITY: Record<Priority, { label: string; tone: Tone }> = {
  high: { label: 'High', tone: 'red' },
  medium: { label: 'Medium', tone: 'yellow' },
  low: { label: 'Low', tone: 'default' },
};

/** Folder / card colour per product (from the App/Project Folder component). */
export type FolderColor = 'pink' | 'blue' | 'purple' | 'green' | 'sand';
const PRODUCT_COLOR: Record<string, FolderColor> = {
  'internal design': 'pink', 'rcbc pulz': 'blue', 'rcbc pulz app': 'blue', diskartech: 'purple', rcbc: 'green', 'atm go': 'sand',
};
export const folderColor = (productName: string | undefined | null): FolderColor =>
  PRODUCT_COLOR[(productName ?? '').toLowerCase()] ?? 'sand';
