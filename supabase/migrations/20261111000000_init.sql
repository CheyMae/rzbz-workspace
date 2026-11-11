-- RZBZ Design workspace: initial schema
-- Priority order (from the brief): projects -> tasks -> sprints, then the library.
-- Every table is locked behind row-level security: only signed-in members can read or write.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
-- The board uses the first four. The last two only appear on archived (2023-25) projects.
create type project_status as enum ('not_started', 'in_progress', 'paused', 'done', 'waiting_for_feedback', 'canceled');
create type task_status    as enum ('not_started', 'next_up', 'in_progress', 'design_ready', 'done', 'archived');
create type priority_level as enum ('low', 'medium', 'high');
create type sprint_status  as enum ('upcoming', 'open', 'closed');
create type project_role   as enum ('lead', 'support');

-- ---------------------------------------------------------------------------
-- Members: the allow-list of people who may sign in and see data.
-- Rows are added from the dashboard / seed only, never from the app.
-- ---------------------------------------------------------------------------
create table members (
  email      text primary key check (email = lower(email)),
  role       text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table people (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  email      text unique references members(email) on update cascade on delete set null,
  created_at timestamptz not null default now()
);

create table products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  emoji             text,
  description       text,
  platforms         text,
  design_system_url text,
  notes             text,
  sort_order        int not null default 0
);

create table sprints (
  id         uuid primary key default gen_random_uuid(),
  number     int  not null unique,
  starts_on  date not null,
  ends_on    date not null,
  status     sprint_status not null default 'upcoming',
  closed_at  timestamptz,
  closed_by  uuid references auth.users(id),
  check (ends_on >= starts_on)
);
-- At most one sprint is "current" in the sense of newest open; extended = open and past ends_on.
create view sprint_overview as
select s.*,
       (s.status = 'open' and current_date > s.ends_on) as is_extended,
       greatest(current_date - s.ends_on, 0)            as days_past_end
from sprints s;

create table projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  emoji           text,
  product_id      uuid references products(id) on delete set null,
  status          project_status not null default 'not_started',
  priority        priority_level,
  type            text,
  owner_requester text,
  starts_on       date,
  ends_on         date,
  about           text,
  legacy_code     text,          -- e.g. DEIG-3 from the archive
  legacy_year     int,
  notion_id       text unique,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on projects (status) where not is_archived;

-- Some projects span products (e.g. Internal Design + RCBC Pulz). projects.product_id is the main one.
create table project_products (
  project_id uuid not null references projects(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (project_id, product_id)
);

create table project_people (
  project_id uuid not null references projects(id) on delete cascade,
  person_id  uuid not null references people(id)   on delete cascade,
  role       project_role not null,
  primary key (project_id, person_id, role)
);

-- Which sprints a project is in. Filled automatically from tasks, and by "Add sprint".
create table project_sprints (
  project_id uuid not null references projects(id) on delete cascade,
  sprint_id  uuid not null references sprints(id)  on delete cascade,
  added_at   timestamptz not null default now(),
  added_by   uuid default auth.uid() references auth.users(id),
  primary key (project_id, sprint_id)
);

create table tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  project_id     uuid references projects(id) on delete set null,
  sprint_id      uuid references sprints(id)  on delete set null,
  legacy_sprint  text,           -- archive tasks: old 2023-25 sprint label, not linked
  status         task_status not null default 'not_started',
  priority       priority_level,
  phase          text,
  type           text,
  tags           text,
  day            text,
  effort         text,
  due_start      date,
  due_end        date,
  parent_task_id uuid references tasks(id) on delete set null,
  summary        text,
  notes          text,
  deliverables   text,
  blocked_by     text,
  links          text,
  attachments    text,
  carried_over_from uuid references sprints(id),
  notion_id      text unique,
  is_archived    boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on tasks (project_id);
create index on tasks (sprint_id);
create index on tasks (status);

create table task_assignees (
  task_id   uuid not null references tasks(id)  on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (task_id, person_id)
);

create table library_items (
  id            uuid primary key default gen_random_uuid(),
  section       text not null,
  name          text not null,
  product_group text,
  type          text,
  status        text,
  url           text,
  second_url    text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table launch_plan (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  product     text,
  status      text,
  launch_year int
);

-- Free-form Notion-style pages (HR Stuff, Hiring People, notes...). Content = BlockNote JSON.
create table pages (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references pages(id) on delete cascade,
  slug       text unique,
  title      text not null default 'Untitled',
  emoji      text,
  content    jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- What changed, for the Welcome back recap.
create table activity_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor     uuid default auth.uid() references auth.users(id),
  entity    text not null,
  entity_id uuid,
  action    text not null,          -- insert | update | delete | close_sprint
  changes   jsonb
);
create index on activity_log (at desc);

create table member_state (
  user_id      uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  last_seen_at timestamptz not null default now(),
  prev_seen_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger projects_touch before update on projects      for each row execute function touch_updated_at();
create trigger tasks_touch    before update on tasks         for each row execute function touch_updated_at();
create trigger library_touch  before update on library_items for each row execute function touch_updated_at();
create trigger pages_touch    before update on pages         for each row execute function touch_updated_at();

-- A task in a sprint puts its project in that sprint.
create or replace function link_project_sprint() returns trigger language plpgsql as $$
begin
  if new.project_id is not null and new.sprint_id is not null then
    insert into project_sprints (project_id, sprint_id) values (new.project_id, new.sprint_id)
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger tasks_link_sprint after insert or update of sprint_id, project_id on tasks
  for each row execute function link_project_sprint();

-- Activity log: records only the columns that changed. Skipped during seeding (no signed-in user).
create or replace function log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare diff jsonb; rid uuid;
begin
  if tg_op = 'DELETE' then rid := old.id; else rid := new.id; end if;
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value)) into diff
    from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key not in ('updated_at', 'sort_order');
    if diff is null then return new; end if;
  elsif tg_op = 'INSERT' then diff := to_jsonb(new);
  else diff := to_jsonb(old);
  end if;
  insert into activity_log (entity, entity_id, action, changes)
  values (tg_table_name, rid, lower(tg_op), diff);
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
create trigger projects_log after insert or update or delete on projects      for each row execute function log_activity();
create trigger tasks_log    after insert or update or delete on tasks         for each row execute function log_activity();
create trigger library_log  after insert or update or delete on library_items for each row execute function log_activity();

-- ---------------------------------------------------------------------------
-- Sprint actions
-- ---------------------------------------------------------------------------
-- Sprints are two weeks long. Creates the sprint after the newest one if it doesn't exist yet.
create or replace function ensure_next_sprint() returns sprints
language plpgsql security definer set search_path = public as $$
declare last sprints; nxt sprints;
begin
  if not is_member() then raise exception 'not allowed'; end if;
  select * into last from sprints order by number desc limit 1;
  insert into sprints (number, starts_on, ends_on, status)
  values (last.number + 1, last.ends_on + 1, last.ends_on + 14, 'open')
  returning * into nxt;
  return nxt;
end $$;

-- mode: 'move' = open tasks go to the next sprint; 'keep' = they stay, marked carried over.
create or replace function close_sprint(p_sprint uuid, p_mode text default 'move') returns jsonb
language plpgsql security definer set search_path = public as $$
declare s sprints; nxt sprints; moved int := 0;
begin
  if not is_member() then raise exception 'not allowed'; end if;
  select * into s from sprints where id = p_sprint for update;
  if s.status = 'closed' then raise exception 'Sprint % is already closed', s.number; end if;

  select * into nxt from sprints where number = s.number + 1;
  if nxt.id is null then nxt := ensure_next_sprint(); end if;

  if p_mode = 'move' then
    update tasks set sprint_id = nxt.id, carried_over_from = s.id
    where sprint_id = s.id and status not in ('done', 'archived');
    get diagnostics moved = row_count;
  end if;

  update sprints set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = s.id;
  update sprints set status = 'open' where id = nxt.id and status = 'upcoming';

  insert into activity_log (entity, entity_id, action, changes)
  values ('sprints', s.id, 'close_sprint',
          jsonb_build_object('sprint', s.number, 'mode', p_mode, 'moved_tasks', moved, 'next_sprint', nxt.number));
  return jsonb_build_object('closed', s.number, 'next', nxt.number, 'moved_tasks', moved);
end $$;

-- Called on each visit: returns when you were last here (for the recap) and records this visit.
create or replace function touch_last_seen() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare prev timestamptz;
begin
  if not is_member() then raise exception 'not allowed'; end if;
  select last_seen_at into prev from member_state where user_id = auth.uid();
  insert into member_state (user_id, last_seen_at, prev_seen_at) values (auth.uid(), now(), prev)
  on conflict (user_id) do update set prev_seen_at = member_state.last_seen_at, last_seen_at = now();
  return prev;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security: members only, everywhere.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['people','products','sprints','projects','project_products','project_people','project_sprints',
                           'tasks','task_assignees','library_items','launch_plan','pages']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "members read"  on %I for select to authenticated using (is_member())', t);
    execute format('create policy "members write" on %I for all    to authenticated using (is_member()) with check (is_member())', t);
  end loop;
end $$;

alter table members      enable row level security;
create policy "members see the list" on members for select to authenticated using (is_member());

alter table activity_log enable row level security;
create policy "members read activity" on activity_log for select to authenticated using (is_member());

alter table member_state enable row level security;
create policy "own state" on member_state for all to authenticated
  using (user_id = auth.uid() and is_member()) with check (user_id = auth.uid() and is_member());

alter view sprint_overview set (security_invoker = true);

revoke all on function ensure_next_sprint() from anon, public;
revoke all on function close_sprint(uuid, text) from anon, public;
revoke all on function touch_last_seen() from anon, public;
grant execute on function ensure_next_sprint(), close_sprint(uuid, text), touch_last_seen() to authenticated;
