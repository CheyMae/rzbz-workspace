import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { supabase } from '../lib/supabase';
import type { NavItem } from '../nav';

/** Stand-in for screens still being designed. Shows a live row count so we know the data is reachable. */
export function Placeholder({ item, table, filter }: { item: NavItem; table?: string; filter?: Record<string, unknown> }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!supabase || !table) return;
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    for (const [k, v] of Object.entries(filter ?? {})) q = q.eq(k, v);
    q.then(({ count }) => setCount(count ?? 0));
  }, [table]);
  return (
    <div className="page">
      <PageHeader emoji={item.emoji} title={item.label} subtitle={item.blurb} />
      <div className="callout t-body">
        <span aria-hidden>🚧</span>
        <span>
          This screen is still being designed.
          {table && count !== null && <> The database already has <strong>{count.toLocaleString()}</strong> {table.replace('_', ' ')} for it.</>}
        </span>
      </div>
    </div>
  );
}
