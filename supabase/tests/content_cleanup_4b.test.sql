-- Content editor step 4b (migration 20261125120000): mount flags, data-only rows, weapon_mounts gone. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-4b00-4000-8000-000000000001', 'c4b-player@test.local', '{"full_name": "Player"}'),
  ('dddddddd-4b00-4000-8000-000000000003', 'c4b-owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'owner' where id = 'dddddddd-4b00-4000-8000-000000000003';

select is((select array_agg(id order by id) from public.game_definitions where kind = 'mount_types' and data ->> 'integrated' = 'true'), array['Integrated Auxiliary'], 'integrated flag');
select is((select array_agg(id order by id) from public.game_definitions where kind = 'mount_types' and data ->> 'superheavy' = 'true'), array['Superheavy'], 'superheavy flag');
select is((select data -> 'slots' from public.game_definitions where kind = 'mount_types' and id = 'Superheavy'), '[["Superheavy"]]'::jsonb, 'slots kept');
select is((select count(*) from public.game_definitions where kind = 'mount_types'), 8::bigint, 'no new mount rows');
select is((select array_agg(kind || '/' || id order by kind, id) from public.game_definitions where data ->> 'dataOnly' = 'true' and hidden),
  array['weapon_sizes/Ship-class', 'weapon_types/???', 'weapon_types/Special', 'weapon_types/Spool Weapon'], 'data-only rows are hidden');
select is((select count(*) from public.game_definitions where kind = 'weapon_types' and not hidden), 6::bigint, 'pickers still see six weapon types');
select throws_ok($$ insert into public.game_definitions (kind, id, label) values ('weapon_mounts', 'x', 'x') $$, '23514', null, 'weapon_mounts is not a kind');

set local role authenticated;
set local request.jwt.claims = '{"sub": "dddddddd-4b00-4000-8000-000000000001", "role": "authenticated"}';
select is((select count(*) from public.game_definitions where data ->> 'dataOnly' = 'true'), 4::bigint, 'a player reads the flags');
select throws_ok($$ select public.save_definitions('weapon_types', '[]'::jsonb) $$, 'P0001', 'Only owners can save definitions.', 'a player cannot save');
with u as (update public.game_definitions set data = '{}' where id = 'Superheavy' returning 1) select is((select count(*) from u), 0::bigint, 'a player cannot change a flag');

set local request.jwt.claims = '{"sub": "dddddddd-4b00-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok($$ select public.save_definitions('weapon_mounts', '[]'::jsonb) $$, 'P0001', 'Unknown list.', 'save_definitions refuses weapon_mounts');
select lives_ok($$ select public.save_definitions('weapon_types', '[]'::jsonb) $$, 'the owner can save');

select * from finish();
rollback;
