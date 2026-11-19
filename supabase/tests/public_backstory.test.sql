-- Tries to break the public backstory (migration 20261119190000_public_backstory.sql): a copy exists only while the
-- player makes it public, others can read the copy but never the private sheet, nobody writes the table directly,
-- the toggle doesn't touch the pilot's own updated_at, and the copy follows the sheet.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Ids are hard-coded below. Sequences aren't rolled back, so push the generated ids well past them, once and for good.
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('22222222-2222-2222-2222-222222222222', 'p2@test.local', '{"full_name": "Player Two"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}');
update public.profiles set role = 'gm' where id = '33333333-3333-3333-3333-333333333333';

insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (100, '11111111-1111-1111-1111-111111111111', 'approved', 'One', 'Uno'),
  (200, '22222222-2222-2222-2222-222222222222', 'pending', 'Two', 'Duo');
insert into public.character_sheets (character_id, sheet) values
  (100, '{"backstory": {"type": "doc", "text": "first"}}'),
  (200, '{"backstory": {"type": "doc", "text": "secret"}}');
-- moddatetime stamps now(), which is fixed inside a transaction, so start from an old date to see whether it moves.
set local session_replication_role = replica; -- triggers off, or moddatetime would stamp now() again
update public.characters set updated_at = '2020-01-01' where id in (100, 200);
update public.character_sheets set updated_at = '2020-01-01' where character_id in (100, 200);
set local session_replication_role = origin;

select is((select count(*)::int from public.pilot_public_backstory), 0, 'nothing is public by default');

-- ---------------------------------------------------------------------
-- Player one makes their backstory public
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select lives_ok($$ select public.set_backstory_public(100, true) $$, 'a player can make their own backstory public');
select is((select backstory ->> 'text' from public.pilot_public_backstory where character_id = 100), 'first', 'the copy is the current backstory');
select throws_ok($$ select public.set_backstory_public(200, true) $$, 'P0001', null, 'a player cannot toggle someone else''s');
select throws_ok($$ insert into public.pilot_public_backstory (character_id, backstory) values (100, '{}') $$, '42501', null, 'no direct inserts');
select throws_ok($$ update public.pilot_public_backstory set backstory = '{"text": "forged"}' $$, '42501', null, 'no direct updates');
select throws_ok($$ delete from public.pilot_public_backstory $$, '42501', null, 'no direct deletes');

-- ---------------------------------------------------------------------
-- Player two: reads the public one, never the private sheet
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is((select backstory ->> 'text' from public.pilot_public_backstory where character_id = 100), 'first', 'another player can read a public backstory');
select is((select count(*)::int from public.character_sheets where character_id = 100), 0, 'but not the private sheet');
select is((select count(*)::int from public.pilot_public_backstory where character_id = 200), 0, 'a private backstory has no public row');

-- ---------------------------------------------------------------------
-- The toggle leaves the pilot's timestamps alone; the copy follows the sheet
-- ---------------------------------------------------------------------
reset role;
select is((select updated_at from public.characters where id = 100), '2020-01-01'::timestamptz, 'the toggle did not move characters.updated_at');
select is((select updated_at from public.character_sheets where character_id = 100), '2020-01-01'::timestamptz, 'or character_sheets.updated_at');

update public.character_sheets set sheet = '{"backstory": {"type": "doc", "text": "second"}}' where character_id = 100;
select is((select backstory ->> 'text' from public.pilot_public_backstory where character_id = 100), 'second', 'the public copy follows sheet updates');
update public.character_sheets set sheet = '{"backstory": {"type": "doc", "text": "secret"}}' where character_id = 200;
select is((select count(*)::int from public.pilot_public_backstory where character_id = 200), 0, 'a private sheet update creates no public copy');

-- ---------------------------------------------------------------------
-- Back to private, and a GM
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select lives_ok($$ select public.set_backstory_public(100, false) $$, 'a player can make it private again');
select is((select count(*)::int from public.pilot_public_backstory), 0, 'the public copy is deleted');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select lives_ok($$ select public.set_backstory_public(200, true) $$, 'a GM can make any pilot''s backstory public');
select is((select backstory ->> 'text' from public.pilot_public_backstory where character_id = 200), 'secret', 'and it copies that pilot''s sheet');

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.pilot_public_backstory $$, '42501', null, 'visitors cannot read public backstories');
select throws_ok($$ select public.set_backstory_public(100, true) $$, '42501', null, 'visitors cannot toggle');

select * from finish();
rollback;
