import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Progress } from './ui';
import type { FolderColor } from '../lib/format';

/** Mirrors the Figma "App/Project Folder" (Type = Internal Design / Pulz / ROR / ATMGo / DT → pink / blue / purple / green / sand). Used for project cards too. */
export function ProjectFolder({ to, color, emoji, name, tags, done, total, pill, date, dateWarn, drag }: {
  to: string;
  color: FolderColor;
  emoji?: string | null;
  name: string;
  tags: ReactNode;
  done: number;
  total: number;
  pill: ReactNode;
  date: string;
  dateWarn?: boolean;
  /** Board drag handlers (Home board). */
  drag?: object;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Link to={to} className={`folder folder-${color}`} {...drag}>
      <span className="folder-tab" aria-hidden />
      <span className="folder-body">
        <span className="folder-title t-title-body">
          {emoji && <span aria-hidden>{emoji}</span>}<span>{name}</span>
        </span>
        <span className="folder-tags">{tags}</span>
        <span className="folder-progress">
          <span className="folder-progress-label t-caption">
            <span>{total ? `${done} of ${total} task${total === 1 ? '' : 's'}` : 'No tasks yet'}</span>
            <span>{total ? `${pct}%` : '—'}</span>
          </span>
          <Progress pct={pct} />
        </span>
        <span className="folder-footer t-caption">
          <span className="folder-pill t-caption-emphasis">{pill}</span>
          <span className={dateWarn ? 'text-error' : 'muted'}>{date}</span>
        </span>
      </span>
    </Link>
  );
}
