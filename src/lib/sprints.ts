import type { Sprint } from './types';

// Local preview only: /?shell&today=YYYY-MM-DD pretends it's that day (to show each sprint state). Never ships.
const fakeToday = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('today') : null;

/** Today as YYYY-MM-DD in the viewer's own time zone. */
export function todayISO(now = new Date()) {
  if (fakeToday) return fakeToday;
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86_400_000);

/**
 * Sprint rules (agreed with the team):
 * - "Current" is the sprint whose dates include today; between sprints it's the newest open one.
 * - A sprint is open until someone closes it. Open and past its end date = extended.
 * - The Close sprint button appears from the planned end day onwards, never before.
 */
export function sprintState(sprints: Sprint[], today = todayISO()) {
  const real = sprints.filter((s) => s.kind === 'sprint');
  const byDate = real.find((s) => s.starts_on <= today && today <= s.ends_on && s.status !== 'closed');
  const open = real.filter((s) => s.status === 'open');
  const extended = open.filter((s) => s.ends_on < today).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const current = byDate ?? [...open].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0] ?? null;
  /** Sprints Home shows: the current one plus any still-open extended ones. */
  const active = [...new Set([...extended, ...(current ? [current] : [])])];
  return { current, extended, active };
}

export const isExtended = (s: Sprint, today = todayISO()) => s.kind === 'sprint' && s.status === 'open' && s.ends_on < today;
export const isCloseDay = (s: Sprint, today = todayISO()) => s.kind === 'sprint' && s.status === 'open' && s.ends_on === today;
export const canClose = (s: Sprint, today = todayISO()) => s.kind === 'sprint' && s.status === 'open' && s.ends_on <= today;

export function sprintLabel(s: Sprint, today = todayISO()) {
  if (s.kind === 'break') return 'Break';
  if (s.status === 'closed') return 'Closed';
  if (isExtended(s, today)) return 'Extended';
  if (s.starts_on > today) return 'Upcoming';
  return 'Current';
}

/** "Sprint 21" in the current year; "2027 · Sprint 1" once years differ. */
export function sprintName(s: Sprint, withYear = false) {
  return withYear && s.kind === 'sprint' ? `${s.year} · ${s.name}` : s.name;
}
