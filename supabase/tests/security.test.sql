-- Tries to break the security rules as each kind of user. Run with: supabase test db
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Test users: two players, a GM and an owner. The sign-up trigger gives each one a player profile.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('22222222-2222-2222-2222-222222222222', 'p2@test.local', '{"full_name": "Player Two"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}'),
  ('44444444-4444-4444-4444-444444444444', 'owner@test.local', '{"full_name": "Owner"}');

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Player One', 'signing up creates a profile with the Discord name');
select is(
  (select role::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'player', 'new users start as players');

update public.profiles set role = 'gm' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'owner' where id = '44444444-4444-4444-4444-444444444444';

-- Player Two already has an approved character (id 100) with a sheet and a reputation.
insert into public.characters (id, player_id, status, pilot_name, callsign)
  overriding system value
  values (100, '22222222-2222-2222-2222-222222222222', 'approved', 'Two', 'Deuce');
insert into public.character_sheets (character_id, sheet, mod_points) values (100, '{"manna": 50}', 2);
insert into public.organisations (id, name) overriding system value values (1, 'Harrison Armory');
insert into public.reputation_levels (id, name) overriding system value values (1, 'Neutral');
insert into public.reputation (character_id, organisation_id, level_id) values (100, 1, 1);


-- ---------------------------------------------------------------------
-- Player One: a new player with no character yet
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select is((select count(*)::int from public.profiles), 4, 'players can see every profile');
select throws_ok(
  $$ update public.profiles set role = 'owner' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'players cannot change their own role');

select throws_ok(
  $$ insert into public.characters (player_id, status, pilot_name)
     values ('11111111-1111-1111-1111-111111111111', 'approved', 'Sneaky') $$,
  '42501', null, 'players cannot create an approved character');
select throws_ok(
  $$ insert into public.characters (player_id, pilot_name)
     values ('22222222-2222-2222-2222-222222222222', 'Impostor') $$,
  '42501', null, 'players cannot create a character for someone else');
select lives_ok(
  $$ insert into public.characters (player_id, pilot_name)
     values ('11111111-1111-1111-1111-111111111111', 'One') $$,
  'players can create a pending character');
select throws_ok(
  $$ insert into public.characters (player_id, pilot_name)
     values ('11111111-1111-1111-1111-111111111111', 'One Again') $$,
  '42501', null, 'players cannot have two living characters');

select lives_ok(
  $$ insert into public.character_sheets (character_id, sheet)
     select id, '{"manna": 0}' from public.characters where pilot_name = 'One' $$,
  'players can fill in the sheet of their pending character');
select lives_ok(
  $$ update public.characters set callsign = 'Uno' where pilot_name = 'One' $$,
  'players can edit their pending character');
select throws_ok(
  $$ update public.characters set status = 'approved' where pilot_name = 'One' $$,
  '42501', null, 'players cannot approve their own character');

select is((select count(*)::int from public.characters where id = 100), 1,
  'players can see other characters'' public cards');
select is((select count(*)::int from public.character_sheets where character_id = 100), 0,
  'players cannot see other players'' sheets');
select is((select count(*)::int from public.reputation), 0, 'players cannot see reputation');
select is((select count(*)::int from public.organisations), 0, 'players cannot see organisations');
select is((select count(*)::int from public.pilot_stats), 5, 'players can see the pilot stats list');
select throws_ok(
  $$ insert into public.bionics (name) values ('Free Arm') $$,
  '42501', null, 'players cannot add bionics');
select throws_ok(
  $$ select public.mark_dead(100) $$,
  'P0001', null, 'players cannot mark someone else''s character dead');
select throws_ok(
  $$ select public.approve_change(1) $$,
  'P0001', null, 'players cannot run approve_change');


-- ---------------------------------------------------------------------
-- Player Two: owns approved character 100
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

with attempt as (
  update public.characters set callsign = 'Hacked' where id = 100 returning 1
)
select is((select count(*)::int from attempt), 0, 'players cannot edit their approved character directly');

with attempt as (
  update public.character_sheets set mod_points = 99 where character_id = 100 returning 1
)
select is((select count(*)::int from attempt), 0, 'players cannot edit their approved sheet directly');

select lives_ok(
  $$ insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, based_on)
     values (100, '22222222-2222-2222-2222-222222222222',
             '{"pilot_name": "Two", "callsign": "Deuce Prime", "mechs": []}', '{"manna": 40}', now()) $$,
  'players can propose a change to their approved character');
select throws_ok(
  $$ insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, based_on)
     values (100, '22222222-2222-2222-2222-222222222222', '{"pilot_name": "Two", "mechs": []}', '{}', now()) $$,
  '23505', null, 'only one pending change per character');
select lives_ok(
  $$ update public.pending_changes set proposed_sheet = '{"manna": 30}'
     where character_id = 100 and status = 'pending' $$,
  'players can edit their pending change');
select throws_ok(
  $$ update public.pending_changes set status = 'approved'
     where character_id = 100 and status = 'pending' $$,
  '42501', null, 'players cannot approve their own change');
select throws_ok(
  $$ select public.approve_change(
       (select id from public.pending_changes where character_id = 100 and status = 'pending')) $$,
  'P0001', null, 'players cannot approve their own change through approve_change');

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.pending_changes), 0, 'players cannot see other players'' changes');


-- ---------------------------------------------------------------------
-- GM
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is((select count(*)::int from public.character_sheets where character_id = 100), 1, 'GMs can see every sheet');
select is((select count(*)::int from public.reputation), 1, 'GMs can see reputation');
select throws_ok(
  $$ insert into public.bionics (name) values ('GM Arm') $$,
  '42501', null, 'GMs cannot add bionics (owners only)');
select throws_ok(
  $$ update public.pending_changes set status = 'approved'
     where character_id = 100 and status = 'pending' $$,
  '42501', null, 'GMs cannot approve with a plain update');
select lives_ok(
  $$ select public.approve_change(
       (select id from public.pending_changes where character_id = 100 and status = 'pending')) $$,
  'GMs can approve a change');
select is((select callsign from public.characters where id = 100), 'Deuce Prime', 'approving updates the public card');
select is((select sheet ->> 'manna' from public.character_sheets where character_id = 100), '30',
  'approving updates the sheet');
select is((select mod_points from public.character_sheets where character_id = 100), 2,
  'approving leaves mod points alone');
select is((select status::text from public.pending_changes where character_id = 100), 'approved',
  'the approved change is kept as history');

-- A change based on an old version of the character must be refused.
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select lives_ok(
  $$ insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, based_on)
     values (100, '22222222-2222-2222-2222-222222222222',
             '{"pilot_name": "Two", "callsign": "Stale", "mechs": []}', '{"manna": 0}', now() - interval '1 hour') $$,
  'players can propose another change once the last one is reviewed');

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select throws_ok(
  $$ select public.approve_change(
       (select id from public.pending_changes where character_id = 100 and status = 'pending')) $$,
  'P0001', null, 'approve_change refuses a change made before the character last changed');
select throws_ok(
  $$ update public.pending_changes set status = 'rejected'
     where character_id = 100 and status = 'pending' $$,
  '23514', null, 'rejecting a change needs a reason');
select lives_ok(
  $$ update public.pending_changes set status = 'rejected', review_reason = 'Out of date, please resubmit'
     where character_id = 100 and status = 'pending' $$,
  'GMs can reject a change with a reason');


-- ---------------------------------------------------------------------
-- Owner
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select lives_ok(
  $$ with b as (
       insert into public.bionics (name, manna_cost, mod_point_cost) values ('Reflex Booster', 100, 1) returning id
     )
     insert into public.bionic_bonuses (bionic_id, stat_id, amount) select id, 'dexterity', 2 from b $$,
  'owners can add bionics and their bonuses');
select throws_ok(
  $$ insert into public.bionic_bonuses (bionic_id, stat_id, amount)
     select id, 'charisma', 1 from public.bionics where name = 'Reflex Booster' $$,
  '23503', null, 'a bonus must point at a stat that exists');
select throws_ok(
  $$ delete from public.bionics where name = 'Reflex Booster' $$,
  '42501', null, 'bionics cannot be deleted, only retired');


-- ---------------------------------------------------------------------
-- Death and images, as Player Two
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select lives_ok($$ select public.mark_dead(100) $$, 'players can mark their own character dead');
select is((select status::text from public.characters where id = 100), 'dead', 'the character is now dead');
select throws_ok($$ select public.mark_dead(100) $$, 'P0001', null, 'dead characters stay dead');
select lives_ok(
  $$ insert into public.characters (player_id, pilot_name)
     values ('22222222-2222-2222-2222-222222222222', 'Two (flash clone)') $$,
  'after a death, the player can make a new character');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('character-images', '22222222-2222-2222-2222-222222222222/pilot.png') $$,
  'players can upload images into their own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('character-images', '11111111-1111-1111-1111-111111111111/pilot.png') $$,
  '42501', null, 'players cannot upload into someone else''s folder');


-- ---------------------------------------------------------------------
-- Logged-out visitors
-- ---------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.characters $$, '42501', null, 'logged-out visitors cannot read characters');
select throws_ok($$ select count(*) from public.profiles $$, '42501', null, 'logged-out visitors cannot read profiles');

reset role;
select * from finish();
rollback;
