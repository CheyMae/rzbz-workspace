-- Sprint records: real dates, sprint years, breaks, no overlaps, and the "Next up" rule.
--
-- Rules from here on:
--   * Sprints are numbered within a year: "2027 · Sprint 1" starts the first Monday of January.
--   * Two weeks each, Monday -> the second Friday. Only the app creates the next one.
--   * A pause gets a "Break" record instead of skipping or reusing a number.
--   * Sprints and breaks can't overlap.
--   * Closing a sprint moves its "Next up" tasks into the next sprint as "Not started".

alter table sprints drop constraint sprints_number_key;
alter table sprints
  add column year   int,
  add column suffix text not null default '',                 -- e.g. 'b' for the second Sprint 20
  add column kind   text not null default 'sprint' check (kind in ('sprint', 'break')),
  alter column number drop not null,
  add constraint sprints_number_needed check (kind = 'break' or number is not null);
alter table sprints
  add column name text generated always as
    (case when kind = 'break' then 'Break' else 'Sprint ' || number || suffix end) stored;

-- ---------------------------------------------------------------------------
-- Fix the live records (skipped on a fresh database: the seed already has them right).
-- ---------------------------------------------------------------------------
do $$
declare s20 uuid; s20b uuid;
begin
  if not exists (select 1 from sprints) then return; end if;

  update sprints set year = 2026;

  -- Sprints 1-4 (mid-2025) are no longer tracked: their tasks go to the archive with the old label.
  update tasks t set legacy_sprint = 'Sprint ' || s.number, sprint_id = null, is_archived = true
    from sprints s where t.sprint_id = s.id and s.number <= 4;
  update tasks set carried_over_from = null
    where carried_over_from in (select id from sprints where number <= 4);
  delete from sprints where number <= 4;

  -- Real dates, as recorded by the team.
  update sprints s set starts_on = d.st, ends_on = d.en,
         closed_at = case when s.status = 'closed' then (d.en + time '18:00') at time zone 'Asia/Manila' end
  from (values
    (5,  date '2025-12-22', date '2026-01-02'), (6,  '2026-01-05', '2026-01-16'),
    (7,  '2026-01-19', '2026-01-30'), (8,  '2026-02-02', '2026-02-13'),
    (9,  '2026-02-16', '2026-02-27'), (10, '2026-03-02', '2026-03-13'),
    (11, '2026-03-16', '2026-03-27'), (12, '2026-03-30', '2026-04-10'),
    (13, '2026-04-13', '2026-04-24'), (14, '2026-04-27', '2026-05-08'),
    (15, '2026-05-11', '2026-05-22'), (16, '2026-05-25', '2026-06-05'),
    (17, '2026-06-08', '2026-06-19'), (18, '2026-06-22', '2026-07-03'),
    (19, '2026-07-06', '2026-07-17'), (20, '2026-07-20', '2026-07-31'),
    (21, '2026-10-26', '2026-11-08')
  ) as d(n, st, en)
  where s.number = d.n;

  -- "Sprint 20" was used twice. The October one becomes Sprint 20b; tasks are split by due date.
  select id into s20 from sprints where number = 20;
  insert into sprints (id, year, number, suffix, starts_on, ends_on, status, closed_at)
  values ('92edde73-0ac1-57fa-b2d9-01cb88a81d67', 2026, 20, 'b', '2026-10-12', '2026-10-25', 'closed',
          (date '2026-10-25' + time '18:00') at time zone 'Asia/Manila')
  returning id into s20b;
  update tasks set sprint_id = s20b
    where sprint_id = s20 and coalesce(due_end, due_start) >= date '2026-09-01';
  delete from project_sprints ps
    where ps.sprint_id = s20
      and not exists (select 1 from tasks t where t.sprint_id = s20 and t.project_id = ps.project_id);

  -- The unnamed gap between Sprint 20 and Sprint 20b.
  insert into sprints (id, year, kind, starts_on, ends_on, status)
  values ('5f366196-f538-5035-b7f7-110c441d801d', 2026, 'break', '2026-08-01', '2026-10-11', 'closed');

  -- Sprint 22, agreed with the team: Mon Nov 23 -> Fri Dec 4. Opens when Sprint 21 is closed.
  insert into sprints (id, year, number, starts_on, ends_on, status)
  values ('ec0abc85-d5b7-5464-8c27-b72084be2328', 2026, 22, '2026-11-23', '2026-12-04', 'upcoming');
end $$;

alter table sprints alter column year set not null;
create unique index sprints_year_number on sprints (year, number, suffix) where kind = 'sprint';
alter table sprints add constraint sprints_no_overlap
  exclude using gist (daterange(starts_on, ends_on, '[]') with &&);

-- The view listed the old columns; rebuild it.
drop view sprint_overview;
create view sprint_overview as
select s.*,
       (s.kind = 'sprint' and s.status = 'open' and current_date > s.ends_on) as is_extended,
       greatest(current_date - s.ends_on, 0)                                  as days_past_end
from sprints s;
alter view sprint_overview set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Sprint actions
-- ---------------------------------------------------------------------------
-- Creates the sprint after the newest record: the next Monday, two weeks to the second Friday.
-- A sprint starting in a new year restarts at Sprint 1.
create or replace function ensure_next_sprint() returns sprints
language plpgsql security definer set search_path = public as $$
declare last_end date; last sprints; nxt sprints; st date;
begin
  if not is_member() then raise exception 'not allowed'; end if;
  select max(ends_on) into last_end from sprints;
  select * into last from sprints where kind = 'sprint' order by starts_on desc limit 1;
  st := last_end + (8 - extract(isodow from last_end)::int);   -- next Monday after the newest record
  insert into sprints (year, number, starts_on, ends_on, status)
  values (case when extract(year from st) > last.year then extract(year from st)::int else last.year end,
          case when extract(year from st) > last.year then 1 else last.number + 1 end,
          st, st + 11, 'upcoming')
  returning * into nxt;
  return nxt;
end $$;

-- mode: 'move' = unfinished tasks go to the next sprint; 'keep' = they stay.
-- Either way, "Next up" tasks belong to the next sprint and start there as "Not started".
create or replace function close_sprint(p_sprint uuid, p_mode text default 'move') returns jsonb
language plpgsql security definer set search_path = public as $$
declare s sprints; nxt sprints; moved int := 0; next_up int := 0;
begin
  if not is_member() then raise exception 'not allowed'; end if;
  select * into s from sprints where id = p_sprint for update;
  if s.kind <> 'sprint' then raise exception 'Only sprints can be closed'; end if;
  if s.status = 'closed' then raise exception '% is already closed', s.name; end if;

  select * into nxt from sprints where kind = 'sprint' and starts_on > s.starts_on order by starts_on limit 1;
  if nxt.id is null then nxt := ensure_next_sprint(); end if;

  update tasks set sprint_id = nxt.id, status = 'not_started'
  where sprint_id = s.id and status = 'next_up';
  get diagnostics next_up = row_count;

  if p_mode = 'move' then
    update tasks set sprint_id = nxt.id, carried_over_from = s.id
    where sprint_id = s.id and status not in ('done', 'archived');
    get diagnostics moved = row_count;
  end if;

  update sprints set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = s.id;
  update sprints set status = 'open' where id = nxt.id and status = 'upcoming';

  insert into activity_log (entity, entity_id, action, changes)
  values ('sprints', s.id, 'close_sprint',
          jsonb_build_object('sprint', s.name, 'mode', p_mode, 'moved_tasks', moved,
                             'next_up_tasks', next_up, 'next_sprint', nxt.name));
  return jsonb_build_object('closed', s.name, 'next', nxt.name, 'moved_tasks', moved, 'next_up_tasks', next_up);
end $$;

revoke all on function ensure_next_sprint() from anon, public;
revoke all on function close_sprint(uuid, text) from anon, public;
grant execute on function ensure_next_sprint(), close_sprint(uuid, text) to authenticated;
