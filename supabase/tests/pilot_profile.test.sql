-- Tries to break the pilot profile tables (migration 20261120090000_pilot_profile.sql): a pilot's own player edits the
-- profile (colour, motto, banner, gallery) unless the pilot is dead, GMs and owners edit any, everyone logged in reads,
-- and the same for the service record and commendations tables.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Ids are hard-coded below. Sequences aren't rolled back, so push the generated ids well past them, once and for good.
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('22222222-2222-2222-2222-222222222222', 'p2@test.local', '{"full_name": "Player Two"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}'),
  ('44444444-4444-4444-4444-444444444444', 'owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'gm' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'owner' where id = '44444444-4444-4444-4444-444444444444';

insert into public.characters (id, player_id, status, pilot_name) overriding system value values
  (100, '11111111-1111-1111-1111-111111111111', 'approved', 'One'),
  (200, '22222222-2222-2222-2222-222222222222', 'pending', 'Two'),
  (300, '11111111-1111-1111-1111-111111111111', 'dead', 'Gone');

-- Seeded as the database owner: Two's and Gone's profiles, and some timeline entries and commendations.
insert into public.pilot_profiles (character_id, colour, motto) values (200, '#112233', 'two'), (300, '#445566', 'gone');
insert into public.pilot_timeline (id, character_id, kind, title) values
  ('a0000000-0000-4000-8000-000000000001', 100, 'gm', 'GM note'),
  ('a0000000-0000-4000-8000-000000000002', 100, 'auto', 'Auto note'),
  ('a0000000-0000-4000-8000-000000000003', 200, 'player', 'Two note'),
  ('a0000000-0000-4000-8000-000000000004', 300, 'player', 'Gone note');
insert into public.commendations (id, name, icon) values ('c0000000-0000-4000-8000-000000000001', 'Steady hands', 'star');
insert into public.pilot_commendations (id, character_id, commendation_id, reason) values
  ('d0000000-0000-4000-8000-000000000001', 100, 'c0000000-0000-4000-8000-000000000001', 'seeded');

-- ---------------------------------------------------------------------
-- Player One (owns 100 living and 300 dead)
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select lives_ok($$ insert into public.pilot_profiles (character_id, colour, motto) values (100, '#aabbcc', 'Hello') $$, 'a player can add the profile of their own pilot');
select throws_ok($$ insert into public.pilot_profiles (character_id, colour) values (300, '#aabbcc') $$, '42501', null, 'not for a dead pilot (insert)');
select lives_ok($$ update public.pilot_profiles set colour = '#010203' where character_id = 100 $$, 'a player can update it');
update public.pilot_profiles set colour = '#ffffff' where character_id = 300; -- hidden: zero rows
update public.pilot_profiles set colour = '#ffffff' where character_id = 200; -- hidden: zero rows
delete from public.pilot_profiles where character_id = 100; -- no delete policy for players: zero rows
select is((select count(*)::int from public.pilot_profiles where character_id = 100), 1, 'players cannot delete a profile');
select is((select colour from public.pilot_profiles where character_id = 300), '#445566', 'a dead pilot''s profile cannot be changed by their player');
select is((select colour from public.pilot_profiles where character_id = 200), '#112233', 'nor can another pilot''s');
select is((select count(*)::int from public.pilot_profiles where character_id in (100, 200, 300)), 3, 'everyone logged in reads every profile');

select throws_ok($$ update public.pilot_profiles set colour = '#abc' where character_id = 100 $$, '23514', null, 'a colour must be #rrggbb (short)');
select throws_ok($$ update public.pilot_profiles set colour = 'red' where character_id = 100 $$, '23514', null, 'a colour must be #rrggbb (a name)');
select throws_ok($$ update public.pilot_profiles set colour = '#12345g' where character_id = 100 $$, '23514', null, 'a colour must be #rrggbb (not hex)');
select lives_ok($$ update public.pilot_profiles set colour = null where character_id = 100 $$, 'a colour can be cleared');
select lives_ok($$ update public.pilot_profiles set motto = repeat('m', 120) where character_id = 100 $$, 'a 120 character motto is fine');
select throws_ok($$ update public.pilot_profiles set motto = repeat('m', 121) where character_id = 100 $$, '23514', null, 'a motto over 120 characters is refused');
select throws_ok($$ update public.pilot_profiles set banner_image = 'https://evil.example/x.png' where character_id = 100 $$, '23514', null, 'a banner must be an upload path');
select lives_ok(
  $$ update public.pilot_profiles set banner_image = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp' where character_id = 100 $$,
  'a banner can be an upload path');

select lives_ok(
  $$ update public.pilot_profiles set gallery = '[
    {"path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.webp", "caption": "one"},
    {"path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2.jpg", "caption": ""},
    {"path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3.webp"},
    {"path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4.webp", "caption": "four"}
  ]'::jsonb where character_id = 100 $$,
  'a gallery of 4 pictures is fine');
select throws_ok(
  $$ update public.pilot_profiles set gallery = '[
    {"path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.webp", "caption": ""},
    {"path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2.webp", "caption": ""},
    {"path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3.webp", "caption": ""},
    {"path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4.webp", "caption": ""},
    {"path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5.webp", "caption": ""}
  ]'::jsonb where character_id = 100 $$,
  '23514', null, 'a gallery of 5 pictures is refused');
select throws_ok(
  $$ update public.pilot_profiles set gallery = '[{"path": "https://evil.example/x.png", "caption": ""}]'::jsonb where character_id = 100 $$,
  '23514', null, 'a gallery picture must be an upload path');
select throws_ok(
  $$ update public.pilot_profiles set gallery = jsonb_build_array(jsonb_build_object(
       'path', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.webp', 'caption', repeat('c', 141))) where character_id = 100 $$,
  '23514', null, 'a caption over 140 characters is refused');
select throws_ok($$ update public.pilot_profiles set gallery = '{}'::jsonb where character_id = 100 $$, '23514', null, 'a gallery must be an array');
select throws_ok($$ update public.pilot_profiles set gallery = '["x"]'::jsonb where character_id = 100 $$, '23514', null, 'gallery items must be objects');

-- Service record
select lives_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (100, 'player', 'My first sortie') $$, 'a player can add a player entry to their own pilot');
select throws_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (100, 'gm', 'Forged') $$, '42501', null, 'not a gm entry');
select throws_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (100, 'auto', 'Forged') $$, '42501', null, 'not an auto entry');
select throws_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (200, 'player', 'Forged') $$, '42501', null, 'not on another pilot');
select throws_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (300, 'player', 'Forged') $$, '42501', null, 'not on a dead pilot');
select throws_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (100, 'player', '') $$, '23514', null, 'a title is needed');
select throws_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (100, 'player', repeat('t', 101)) $$, '23514', null, 'a title is at most 100 characters');
select throws_ok($$ insert into public.pilot_timeline (character_id, kind, title, body) values (100, 'player', 'Body', '"text"'::jsonb) $$, '23514', null, 'a body is a rich text object');
select lives_ok(
  $$ insert into public.pilot_timeline (id, character_id, kind, title, body, created_by) values
     ('a0000000-0000-4000-8000-000000000010', 100, 'player', 'Forged author', '{"type":"doc","content":[]}', '22222222-2222-2222-2222-222222222222') $$,
  'a player can write a body');
select is((select created_by from public.pilot_timeline where id = 'a0000000-0000-4000-8000-000000000010'), '11111111-1111-1111-1111-111111111111'::uuid, 'created_by is always the logged-in user');
select lives_ok($$ update public.pilot_timeline set title = 'Renamed' where id = 'a0000000-0000-4000-8000-000000000010' $$, 'a player can edit their own entry');
update public.pilot_timeline set kind = 'gm' where id = 'a0000000-0000-4000-8000-000000000010'; -- the trigger keeps the kind
select is((select kind from public.pilot_timeline where id = 'a0000000-0000-4000-8000-000000000010'), 'player', 'an entry cannot change kind');
update public.pilot_timeline set character_id = 200 where id = 'a0000000-0000-4000-8000-000000000010'; -- the trigger keeps it where it is
select is((select character_id from public.pilot_timeline where id = 'a0000000-0000-4000-8000-000000000010'), 100::bigint, 'an entry cannot move to another pilot');
update public.pilot_timeline set title = 'Forged' where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004');
delete from public.pilot_timeline where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004');
select is((select count(*)::int from public.pilot_timeline where title = 'Forged'), 0, 'a player cannot edit gm, auto, other pilots'' or dead pilots'' entries');
select is((select count(*)::int from public.pilot_timeline where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004')), 4, 'nor delete them');
select is((select count(*)::int from public.pilot_timeline where character_id in (100, 200, 300)), 7, 'everyone logged in reads every entry (the seeded award made an auto one)');
select lives_ok($$ delete from public.pilot_timeline where id = 'a0000000-0000-4000-8000-000000000010' $$, 'a player can delete their own entry');
select is((select count(*)::int from public.pilot_timeline where id = 'a0000000-0000-4000-8000-000000000010'), 0, 'and it is gone');

-- Commendations
select throws_ok($$ insert into public.commendations (name, icon) values ('Mine', 'star') $$, '42501', null, 'a player cannot add a commendation');
update public.commendations set name = 'Forged';
delete from public.commendations;
select is((select name from public.commendations where id = 'c0000000-0000-4000-8000-000000000001'), 'Steady hands', 'a player cannot edit or delete commendations');
select is((select count(*)::int from public.pilot_commendations where character_id = 100), 1, 'everyone logged in reads awards');
select throws_ok($$ insert into public.pilot_commendations (character_id, commendation_id) values (100, 'c0000000-0000-4000-8000-000000000001') $$, '42501', null, 'a player cannot give an award');
delete from public.pilot_commendations;
select is((select count(*)::int from public.pilot_commendations where character_id = 100), 1, 'or take one away');

-- ---------------------------------------------------------------------
-- Player Two: reads, but edits nothing of One's
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select throws_ok($$ insert into public.pilot_profiles (character_id, colour) values (100, '#000000') $$, '42501', null, 'a player cannot add a profile to another player''s pilot');
update public.pilot_profiles set colour = '#ffffff', motto = 'hijacked' where character_id = 100;
select is((select motto from public.pilot_profiles where character_id = 100), repeat('m', 120), 'another player cannot edit One''s profile');
select lives_ok($$ update public.pilot_profiles set motto = 'mine' where character_id = 200 $$, 'a player edits their own pending pilot''s profile');
select is((select count(*)::int from public.pilot_timeline where character_id in (100, 200, 300)), 6, 'Two reads the service record');
update public.pilot_timeline set title = 'Forged' where character_id = 100;
select is((select count(*)::int from public.pilot_timeline where title = 'Forged'), 0, 'Two cannot edit One''s entries');

-- ---------------------------------------------------------------------
-- The GM
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select lives_ok($$ update public.pilot_profiles set colour = '#00ff00' where character_id = 100 $$, 'a GM edits any profile');
select lives_ok($$ update public.pilot_profiles set colour = '#00ff00' where character_id = 300 $$, 'even a dead pilot''s');
select is((select colour from public.pilot_profiles where character_id = 300), '#00ff00', 'and it saved');
select lives_ok($$ delete from public.pilot_profiles where character_id = 300 $$, 'a GM can clear (delete) a profile');
select is((select count(*)::int from public.pilot_profiles where character_id = 300), 0, 'and it is gone');
select lives_ok($$ insert into public.pilot_profiles (character_id, colour) values (300, '#123456') $$, 'a GM can add a profile for any pilot');

select lives_ok($$ insert into public.pilot_timeline (id, character_id, kind, title) values ('a0000000-0000-4000-8000-000000000020', 200, 'gm', 'Commended') $$, 'a GM adds a gm entry anywhere');
select throws_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (200, 'player', 'Forged') $$, '42501', null, 'a GM cannot write a player entry');
select throws_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (200, 'auto', 'Forged') $$, '42501', null, 'a GM cannot write an auto entry');
select lives_ok($$ update public.pilot_timeline set title = 'Edited' where id = 'a0000000-0000-4000-8000-000000000020' $$, 'a GM edits a gm entry');
update public.pilot_timeline set title = 'Forged' where id = 'a0000000-0000-4000-8000-000000000003';
select is((select title from public.pilot_timeline where id = 'a0000000-0000-4000-8000-000000000003'), 'Forged', 'a GM can edit a player''s entry (20261121150000_gm_edit_mode.sql)');
select lives_ok($$ delete from public.pilot_timeline where id in ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002') $$, 'a GM deletes any entry');
select is((select count(*)::int from public.pilot_timeline where id in ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002')), 0, 'and they are gone');

select throws_ok($$ insert into public.commendations (name, icon) values ('Mine', 'star') $$, '42501', null, 'a GM cannot add a commendation');
update public.commendations set name = 'Forged';
select is((select name from public.commendations where id = 'c0000000-0000-4000-8000-000000000001'), 'Steady hands', 'a GM cannot edit commendations');
select lives_ok(
  $$ insert into public.pilot_commendations (id, character_id, commendation_id, reason, awarded_by) values
     ('d0000000-0000-4000-8000-000000000002', 200, 'c0000000-0000-4000-8000-000000000001', 'Well done', '11111111-1111-1111-1111-111111111111') $$,
  'a GM gives an award');
select is((select awarded_by from public.pilot_commendations where id = 'd0000000-0000-4000-8000-000000000002'), '33333333-3333-3333-3333-333333333333'::uuid, 'awarded_by is always the logged-in GM');
select throws_ok($$ insert into public.pilot_commendations (character_id, commendation_id, reason) values (200, 'c0000000-0000-4000-8000-000000000001', repeat('r', 301)) $$, '23514', null, 'a reason is at most 300 characters');
select lives_ok($$ delete from public.pilot_commendations where id = 'd0000000-0000-4000-8000-000000000002' $$, 'a GM takes an award back');
select is((select count(*)::int from public.pilot_commendations where character_id = 100), 1, 'and it is gone');

-- ---------------------------------------------------------------------
-- The owner
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select lives_ok($$ update public.pilot_profiles set colour = '#ff0000' where character_id = 200 $$, 'an owner edits any profile');
select lives_ok($$ insert into public.pilot_timeline (character_id, kind, title) values (100, 'gm', 'Owner note') $$, 'an owner adds a gm entry');
select lives_ok($$ insert into public.commendations (id, name, description, icon) values ('c0000000-0000-4000-8000-000000000002', 'Cool head', 'Kept calm', 'shield') $$, 'an owner adds a commendation');
select throws_ok($$ insert into public.commendations (name, icon) values ('Cool head', 'star') $$, '23505', null, 'names are unique');
select throws_ok($$ insert into public.commendations (name, icon) values ('Bad icon', 'Not An Icon') $$, '23514', null, 'an icon is a plain icon name');
select lives_ok($$ update public.commendations set description = 'Kept very calm' where id = 'c0000000-0000-4000-8000-000000000002' $$, 'an owner edits a commendation');
select lives_ok($$ insert into public.pilot_commendations (character_id, commendation_id) values (100, 'c0000000-0000-4000-8000-000000000002') $$, 'an owner gives an award');
select lives_ok($$ delete from public.commendations where id = 'c0000000-0000-4000-8000-000000000002' $$, 'an owner deletes a commendation');
select is((select count(*)::int from public.pilot_commendations where commendation_id = 'c0000000-0000-4000-8000-000000000002'), 0, 'its awards go with it');

-- ---------------------------------------------------------------------
-- Logged-out visitors
-- ---------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select * from public.pilot_profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.pilot_timeline $$, '42501', null, 'anon cannot read the service record');
select throws_ok($$ select * from public.commendations $$, '42501', null, 'anon cannot read commendations');
select throws_ok($$ select * from public.pilot_commendations $$, '42501', null, 'anon cannot read awards');
select throws_ok($$ insert into public.pilot_profiles (character_id, colour) values (200, '#000000') $$, '42501', null, 'anon cannot write');

-- Deleting a pilot takes its rows with it.
reset role;
delete from public.characters where id = 200;
select is((select count(*)::int from public.pilot_profiles where character_id = 200), 0, 'a deleted pilot''s profile goes with it');
select is((select count(*)::int from public.pilot_timeline where character_id = 200), 0, 'and its service record');

select * from finish();
rollback;
