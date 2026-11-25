-- Content editor step 4c (migration 20261125130000): pilotCard, hideOnCard, Armour label. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-4c00-4000-8000-000000000001', 'c4c-player@test.local', '{"full_name": "Player"}'),
  ('dddddddd-4c00-4000-8000-000000000003', 'c4c-owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'owner' where id = 'dddddddd-4c00-4000-8000-000000000003';

select is((select array_agg(id order by id) from public.game_definitions where kind = 'gear_types' and data ->> 'pilotCard' = 'true'), array['Armor', 'Gear'], 'pilotCard on Armor and Gear only');
select is((select label from public.game_definitions where kind = 'gear_types' and id = 'Armor'), 'Armour', 'gear Armor is labelled Armour');
select is((select label from public.game_definitions where kind = 'system_types' and id = 'Armor'), 'Armour', 'system Armor is labelled Armour');
select is((select count(*) from public.game_definitions where id = 'Armor' and kind in ('gear_types', 'system_types')), 2::bigint, 'ids stay Armor');
-- The local seed may hold the tags or not, so test on rows of our own. The two updates below are pasted from the migration and must match it.
insert into public.content_packs (name, manifest) values ('c4c-test-pack', '{}');
insert into public.content_items (kind, id, pack_id, data, edited)
select 'tags', t.id, p.id, jsonb_build_object('id', t.id, 'name', t.id, 'note', 'pack'), t.edited
from (values ('tg_gear', null::jsonb), ('tg_pilot_weapon', '{"id": "tg_pilot_weapon", "name": "Mine"}'::jsonb), ('tg_personal_armor', null), ('tg_other', null)) t (id, edited)
cross join (select id from public.content_packs where name = 'c4c-test-pack') p
on conflict (id) do update set data = excluded.data, edited = excluded.edited;
update public.content_items set edited = coalesce(edited, data) || '{"hideOnCard": true}'
where kind = 'tags' and id in ('tg_gear', 'tg_pilot_weapon', 'tg_personal_armor');
update public.content_items set edited = coalesce(edited, data) || '{"hideOnCard": true}'
where kind = 'tags' and id in ('tg_gear', 'tg_pilot_weapon', 'tg_personal_armor');
update public.content_items set data = jsonb_build_object('id', id, 'name', id, 'note', 're-import') where kind = 'tags';
select is((select count(*) from public.content_items where kind = 'tags' and id in ('tg_gear', 'tg_pilot_weapon', 'tg_personal_armor') and coalesce(edited, data) ->> 'hideOnCard' is distinct from 'true'), 0::bigint, 'the flag survives a re-import and a second run');
select is((select edited ->> 'name' from public.content_items where kind = 'tags' and id = 'tg_pilot_weapon'), 'Mine', 'an earlier editor change is kept');
select is((select edited ->> 'note' from public.content_items where kind = 'tags' and id = 'tg_gear'), 'pack', 'the pack data is copied into edited');
select is((select count(*) from public.content_items where kind = 'tags' and id in ('tg_gear', 'tg_pilot_weapon', 'tg_personal_armor', 'tg_other') and (data ? 'hideOnCard' or (id = 'tg_other' and coalesce(edited, data) ? 'hideOnCard'))), 0::bigint, 'data and other tags never get it');

set local role authenticated;
set local request.jwt.claims = '{"sub": "dddddddd-4c00-4000-8000-000000000001", "role": "authenticated"}';
select is((select count(*) from public.game_definitions where data ->> 'pilotCard' = 'true'), 2::bigint, 'a player reads the flag');
with u as (update public.game_definitions set data = '{}' where kind = 'gear_types' and id = 'Gear' returning 1) select is((select count(*) from u), 0::bigint, 'a player cannot change pilotCard');
with u as (update public.game_definitions set label = 'x' where id = 'Armor' returning 1) select is((select count(*) from u), 0::bigint, 'a player cannot change a label');
with u as (update public.content_items set data = '{}' where kind = 'tags' returning 1) select is((select count(*) from u), 0::bigint, 'a player cannot change a tag flag');
select throws_ok($$ select public.save_definitions('gear_types', '[]'::jsonb) $$, 'P0001', 'Only owners can save definitions.', 'a player cannot save');

set local request.jwt.claims = '{"sub": "dddddddd-4c00-4000-8000-000000000003", "role": "authenticated"}';
select lives_ok($$ select public.save_definitions('gear_types', '[]'::jsonb) $$, 'the owner can save');

select * from finish();
rollback;
