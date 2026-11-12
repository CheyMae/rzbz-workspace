-- Notes from the View Here review (Nov 12, 2026).

-- 1. "Design Ready" is no longer a step: a design that is ready is Done.
--    The enum value stays (Postgres can't drop it safely), but no task uses it and the app no longer offers it.
update tasks set status = 'done' where status = 'design_ready';

-- 2. People who have left stay in the history (their past tasks and roles), but drop out of the
--    assignee and lead pickers. Members can switch this per person in Settings → Team.
alter table people add column if not exists active boolean not null default true;

-- Hashed so names stay out of this public repo.
update people set active = false
where md5(name) in (
  '8fd0b64bf5369ef63e328c02a31b4d28',
  'f856fd5b404d1dd3f6361291deafd4b2',
  'cbc73492c1f0f1fa7060fb401f99bd14',
  '9194671cad2345aec9e5a3b018443a74'
);
