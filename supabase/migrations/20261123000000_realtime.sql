-- Live updates: send row changes on the workspace tables to signed-in browsers (Supabase Realtime).
-- Realtime still applies each table's row-level security, so only members receive anything.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['people', 'products', 'sprints', 'projects', 'tasks', 'library_items',
                           'project_products', 'project_people', 'project_sprints', 'task_assignees']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
