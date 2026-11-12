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
  design_ready: { label: 'Done', tone: 'green' },
  done: { label: 'Done', tone: 'green' },
  archived: { label: 'Archived', tone: 'default' },
};
/** Board columns and status choices. Design Ready was folded into Done (Nov 2026). */
export const TASK_FLOW: TaskStatus[] = ['not_started', 'in_progress', 'done', 'next_up'];

export const PRIORITY: Record<Priority, { label: string; tone: Tone }> = {
  high: { label: 'High', tone: 'red' },
  medium: { label: 'Medium', tone: 'yellow' },
  low: { label: 'Low', tone: 'default' },
};

/**
 * Folder / card colour per product, following the App/Project Folder "Type" variants:
 * Internal Design = pink, Pulz = blue, ROR = purple, ATMGo = green, DT (DiskarTech) = sand.
 * Other RCBC products share Pulz blue; internal work (HR, Organize, Shift to Figma…) shares Internal Design pink.
 */
export type FolderColor = 'pink' | 'blue' | 'purple' | 'green' | 'sand';
export const folderColor = (productName: string | undefined | null): FolderColor => {
  const n = (productName ?? '').toLowerCase();
  if (n.includes('diskartech') || n === 'dt') return 'sand';
  if (n.includes('atm go') || n === 'atmgo') return 'green';
  if (n === 'ror') return 'purple';
  if (n.includes('pulz') || n.startsWith('rcbc')) return 'blue';
  return 'pink';
};
