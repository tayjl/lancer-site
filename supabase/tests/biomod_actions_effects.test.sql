-- Migration 20261125170000: biomod actions column, and bionic_bonuses copied into effect_bonuses. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- The migration ran before the seed, so test the copy on rows of our own. The update below is pasted from the
-- migration and must match it.
insert into public.bionics (id, name, mod_point_cost, effect_bonuses) overriding system value values
  (9701, 'Copy me', 1, '[{"id": "mod_points", "val": 1}]'), (9702, 'No bonuses', 1, '[{"id": "mod_points", "val": 1}]');
insert into public.bionic_bonuses (bionic_id, stat_id, amount) values (9701, 'physicality', 2), (9701, 'acuity', 1);

update public.bionics b set effect_bonuses = b.effect_bonuses || (
  select coalesce(jsonb_agg(jsonb_build_object('id', bb.stat_id, 'val', bb.amount) order by bb.stat_id), '[]')
  from public.bionic_bonuses bb where bb.bionic_id = b.id)
where exists (select 1 from public.bionic_bonuses bb where bb.bionic_id = b.id);

select is((select effect_bonuses from public.bionics where id = 9701),
  '[{"id": "mod_points", "val": 1}, {"id": "acuity", "val": 1}, {"id": "physicality", "val": 2}]'::jsonb,
  'bonus rows are appended to the existing effects, ordered by stat');
select is((select effect_bonuses from public.bionics where id = 9702), '[{"id": "mod_points", "val": 1}]'::jsonb, 'a biomod without bonus rows is untouched');
select is((select count(*) from public.bionic_bonuses where bionic_id = 9701), 2::bigint, 'the old rows stay for the live site');
select is((select actions from public.bionics where id = 9702), '[]'::jsonb, 'actions default to none');
select throws_ok($$ update public.bionics set actions = '{}' where id = 9702 $$, '23514', null, 'actions must be a list');
select throws_ok($$ update public.bionics set actions = (select jsonb_agg('{}'::jsonb) from generate_series(1, 51)) where id = 9702 $$, '23514', null, 'at most 50 actions');
select is((select count(*) from public.bionics where id = 1 and effect_bonuses @> '[{"id": "physicality", "val": 1}]'), (select count(*) from public.bionics where id = 1), 'the seeded Myomer weave carries its stat bonus as an effect');

select * from finish();
rollback;
