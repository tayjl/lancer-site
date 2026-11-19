-- The automatic service-record entries (migration 20261120100000_timeline_milestones.sql): each notable event writes one
-- "auto" entry, pending pilots don't get mech/licence/level entries, and players still can't write "auto" rows.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}');
update public.profiles set role = 'gm' where id = '33333333-3333-3333-3333-333333333333';

insert into public.characters (id, player_id, status, pilot_name, mechs) overriding system value values
  (100, '11111111-1111-1111-1111-111111111111', 'pending', 'One', '[]'),
  (200, '11111111-1111-1111-1111-111111111111', 'approved', 'Two', '[]');
insert into public.character_sheets (character_id, sheet) values (100, '{}'), (200, '{}');
insert into public.content_packs (id, name, version, manifest) overriding system value values (9001, 'Test pack', '1', '{}');
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('mf_test_frame', 9001, 'frames', '{"id":"mf_test_frame","name":"Original Name"}', '{"id":"mf_test_frame","name":"Edited Name"}');

create function pg_temp.titles(pilot bigint) returns text[] language sql
as $$ select coalesce(array_agg(title order by title), '{}') from public.pilot_timeline where character_id = pilot and kind = 'auto' $$;

-- A pending pilot: no mech, licence or level entries.
update public.characters set mechs = '[{"id":"m1","name":"Lantern"}]' where id = 100;
update public.character_sheets set level = 2, sheet = '{"licences":{"mf_test_frame":1}}' where character_id = 100;
select is(pg_temp.titles(100), '{}'::text[], 'a pending pilot gets no mech, level or licence entries');

-- Approved.
update public.characters set status = 'approved' where id = 100;
select is(pg_temp.titles(100), array['Approved for duty'], 'approving writes "Approved for duty"');
select is((select occurred_on from public.pilot_timeline where character_id = 100 and kind = 'auto'), current_date, 'dated today');
select is((select body from public.pilot_timeline where character_id = 100 and kind = 'auto'), null, 'with no body');
update public.characters set pilot_name = 'One!' where id = 100;
select is(pg_temp.titles(100), array['Approved for duty'], 'editing the card writes nothing');

-- An approved pilot.
update public.characters set mechs = '[{"id":"m1","name":"Lantern"},{"id":"m2","name":"Ember"}]' where id = 100;
select ok(pg_temp.titles(100) @> array['New mech: Ember'], 'a new mech writes "New mech: name"');
select ok(not pg_temp.titles(100) @> array['New mech: Lantern'], 'a mech that was already there does not');
update public.characters set mechs = '[{"id":"m1","name":"Lantern II"},{"id":"m2","name":"Ember"}]' where id = 100;
select is((select count(*)::int from public.pilot_timeline where character_id = 100 and title like 'New mech%'), 1, 'renaming a mech writes nothing');

update public.character_sheets set level = 3 where character_id = 100;
select ok(pg_temp.titles(100) @> array['Reached level 3'], 'a level up writes "Reached level n"');
update public.character_sheets set level = 2 where character_id = 100;
select is((select count(*)::int from public.pilot_timeline where character_id = 100 and title like 'Reached level%'), 1, 'lowering the level writes nothing');

update public.character_sheets set sheet = '{"licences":{"mf_test_frame":2}}' where character_id = 100;
select ok(pg_temp.titles(100) @> array['Edited Name licence, rank II'], 'a licence rank writes the frame''s (edited) name and the rank in Roman numerals');
update public.character_sheets set sheet = '{"licences":{"mf_test_frame":2,"unknown_frame":1}}' where character_id = 100;
select ok(pg_temp.titles(100) @> array['unknown_frame licence, rank I'], 'an unknown frame falls back to its id');
update public.character_sheets set sheet = '{"licences":{"mf_test_frame":2,"unknown_frame":1},"bionics":[]}' where character_id = 100;
select is((select count(*)::int from public.pilot_timeline where character_id = 100 and title like '%licence%'), 2, 'unchanged ranks write nothing');

-- Dead.
update public.characters set status = 'dead' where id = 100;
select ok(pg_temp.titles(100) @> array['Killed in action'], 'dying writes "Killed in action"');

-- Commendations.
insert into public.commendations (id, name, icon) values ('c0000000-0000-4000-8000-000000000001', 'Steady hands', 'star');
insert into public.pilot_commendations (character_id, commendation_id, reason) values (200, 'c0000000-0000-4000-8000-000000000001', 'Held the line');
select is(
  (select body from public.pilot_timeline where character_id = 200 and title = 'Awarded Steady hands'),
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Held the line"}]}]}'::jsonb,
  'an award writes "Awarded name" with the reason as a paragraph body');
insert into public.pilot_commendations (character_id, commendation_id) values (200, 'c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.pilot_timeline where character_id = 200 and title = 'Awarded Steady hands' and body is null), 1, 'an award with no reason has no body');

-- Players still can't write auto rows.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select throws_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (200, 'auto', 'Forged') $$, '42501', null, 'a player cannot insert an auto entry');
update public.character_sheets set level = 9 where character_id = 200; -- an approved pilot's sheet isn't the player's to write: zero rows
select is((select count(*)::int from public.pilot_timeline where title like 'Reached level 9'), 0, 'and nothing was written');
reset role;

select * from finish();
rollback;
