-- Migration 20261124130000: hidden on factions and commendations, and content_saves (the editor's "Saved by", owners only).
-- Run with: supabase test db. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'hs-player@test.local', '{"full_name": "Player"}'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'hs-gm@test.local', '{"full_name": "Game Master"}'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'hs-owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'gm' where id = 'eeeeeeee-0000-4000-8000-000000000002';
update public.profiles set role = 'owner' where id = 'eeeeeeee-0000-4000-8000-000000000003';

insert into public.content_packs (id, name, manifest) overriding system value values (9911, '__HS_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data) values ('__hs_gun', 9911, 'weapons', '{"id": "__hs_gun", "name": "Gun"}');
insert into public.organisations (id, name) overriding system value values (9911, '__hs_faction');
insert into public.commendations (id, name, icon) values ('99110000-0000-4000-8000-000000000001', '__hs_medal', 'medal');
select is((select hidden from public.organisations where id = 9911), false, 'a faction is shown by default');
select is((select hidden from public.commendations where name = '__hs_medal'), false, 'a commendation is shown by default');
select is((select count(*) from public.content_saves where key in ('__hs_gun', '9911', '99110000-0000-4000-8000-000000000001')), 0::bigint, 'a change with no logged-in user is not stamped');

-- Player
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000001';
select is((select count(*) from public.content_saves), 0::bigint, 'a player sees no saves');
select throws_ok($$ insert into public.content_saves (source, key, saved_by) values ('bionics', '1', null) $$, '42501', null, 'a player cannot write a stamp');
update public.organisations set hidden = true where id = 9911;
update public.commendations set hidden = true where name = '__hs_medal';
select is((select hidden from public.commendations where name = '__hs_medal'), false, 'a player cannot hide a commendation');

-- GM
set local request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000002';
select is((select count(*) from public.content_saves), 0::bigint, 'a GM sees no saves');
select is((select count(*) from public.organisations where hidden), 0::bigint, 'a player or GM change leaves factions shown');
update public.commendations set hidden = true where name = '__hs_medal';
select is((select hidden from public.commendations where name = '__hs_medal'), false, 'a GM cannot hide a commendation');
update public.organisations set hidden = true where id = 9911;
select is((select hidden from public.organisations where id = 9911), false, 'a GM cannot hide a faction');
update public.content_items set edited = '{"id": "__hs_gun", "name": "Gun", "hidden": true}' where id = '__hs_gun';
select is((select edited is null from public.content_items where id = '__hs_gun'), true, 'a GM cannot hide an item');

-- Owner
set local request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000003';
update public.commendations set hidden = true where name = '__hs_medal';
select is((select hidden from public.commendations where name = '__hs_medal'), true, 'an owner hides a commendation');
update public.organisations set hidden = true where id = 9911;
select is((select hidden from public.organisations where id = 9911), true, 'an owner hides a faction');
select is((select count(*) from public.content_saves where source = 'commendations' and saved_by = 'eeeeeeee-0000-4000-8000-000000000003'), 1::bigint, 'the commendation save names the owner');
select is((select count(*) from public.content_saves where source = 'organisations' and key = '9911'), 1::bigint, 'the faction save is stamped');

-- Hiding an official item: only edited changes
update public.content_items set edited = '{"id": "__hs_gun", "name": "Gun", "hidden": true}' where id = '__hs_gun';
select is((select saved_by from public.content_saves where source = 'content_items' and key = '__hs_gun'), 'eeeeeeee-0000-4000-8000-000000000003'::uuid, 'an edit of an item is stamped');
select is((select coalesce(edited, data) ->> 'hidden' from public.content_items where id = '__hs_gun'), 'true', 'the item reads as hidden');

-- A pack update rewrites data only: not a save
reset role;
update public.content_saves set saved_by = null, saved_at = '2020-01-01' where source = 'content_items' and key = '__hs_gun';
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-000000000003';
update public.content_items set data = '{"id": "__hs_gun", "name": "Gun v2"}' where id = '__hs_gun';
select is((select saved_at from public.content_saves where source = 'content_items' and key = '__hs_gun'), '2020-01-01'::timestamptz, 'a pack re-import (data only) is not stamped');

-- Bionics and definitions
insert into public.bionics (id, name) overriding system value values (9911, '__hs_bionic');
select is((select saved_by from public.content_saves where source = 'bionics' and key = '9911'), 'eeeeeeee-0000-4000-8000-000000000003'::uuid, 'a bionic save is stamped');
insert into public.game_definitions (kind, id, label) values ('uses', '__hs_use', 'X');
select is((select count(*) from public.content_saves where source = 'game_definitions' and key = 'uses/__hs_use'), 1::bigint, 'a definition save is stamped');
select is((select p.display_name from public.content_saves s join public.profiles p on p.id = s.saved_by where s.source = 'bionics' and s.key = '9911'), 'Owner', 'the editor can read the saver''s name');
select throws_ok($$ insert into public.content_saves (source, key, saved_by) values ('bionics', 'forged', null) $$, '42501', null, 'even an owner cannot write a stamp by hand');
select throws_ok($$ update public.content_saves set saved_by = null $$, '42501', null, 'even an owner cannot change a stamp');
reset role;
delete from public.game_definitions where kind = 'uses' and id = '__hs_use';
select is((select count(*) from public.content_saves where key = 'uses/__hs_use'), 0::bigint, 'deleting a row drops its stamp');
set local role authenticated;
select throws_ok($$ select private.stamp_save() $$, '42501', null, 'the trigger function is not callable');

-- Anon
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.content_saves $$, '42501', null, 'anon cannot read saves');

select * from finish();
rollback;
