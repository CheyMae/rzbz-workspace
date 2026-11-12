-- Review round 2 (Nov 12, 2026).

-- 1. Designers. Only designers can be a project's lead ("Carry designers") or support.
--    Everyone else can be a project owner, a new role.
alter table people add column if not exists is_designer boolean not null default false;
update people set is_designer = true
where md5(name) in (   -- hashed so names stay out of this public repo
  '05c403adb3702e2173e2c3ecf0f7f18f',
  'a0044ebb6b9f2077f46f7c084b5ee14d',
  '170ab2a71823eaa7f420a6958377e85f'
);
alter type project_role add value if not exists 'owner';

-- 2. Products. The real products, plus two special groups:
--    'holding' = Organize, where new and uncategorized projects wait for a product;
--    'team'    = HR Stuffs, shown on the HR Stuff page in the Team sidebar instead of under Products.
alter table products add column if not exists kind text not null default 'product'
  check (kind in ('product', 'holding', 'team'));
update products set kind = 'holding' where name = 'Organize';
update products set kind = 'team'    where name = 'HR Stuffs';

-- Fold the retired products into their new home, on both the main product and the product links.
create temporary table product_moves (old_name text, new_name text) on commit drop;
insert into product_moves values
  ('RCBC', 'RCBC Pulz'),
  ('RCBC Peak', 'Organize'),
  ('PASADO', 'Organize'),
  ('Shift to Figma', 'Organize');

update projects p set product_id = n.id
from product_moves m
join products o on o.name = m.old_name
join products n on n.name = m.new_name
where p.product_id = o.id;

insert into project_products (project_id, product_id)
select pp.project_id, n.id
from project_products pp
join products o on o.id = pp.product_id
join product_moves m on m.old_name = o.name
join products n on n.name = m.new_name
on conflict do nothing;

delete from products where name in (select old_name from product_moves);  -- their old links go with them

-- Projects with no product at all wait in Organize.
update projects set product_id = (select id from products where name = 'Organize')
where product_id is null
  and not exists (select 1 from project_products l where l.project_id = projects.id);
insert into project_products (project_id, product_id)
select p.id, p.product_id from projects p
where p.product_id = (select id from products where name = 'Organize')
on conflict do nothing;

-- 3. Type is Existing, Revamp or New (fixing the "Exisitng" spelling from Notion).
update projects set type = 'Existing' where type = 'Exisitng';
update tasks    set type = 'Existing' where type = 'Exisitng';
