-- Tries to break the rewards rules (migration 20261119160000_rewards_and_experience.sql): experience and the reward
-- log are GM-only, every change to level, manna or experience is logged, and the award and level_up functions.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Ids are hard-coded below. Sequences aren't rolled back, so push the generated ids well past them, once and for good.
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}');
update public.profiles set role = 'gm' where id = '33333333-3333-3333-3333-333333333333';

insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (100, '11111111-1111-1111-1111-111111111111', 'approved', 'One', 'Uno');
insert into public.character_sheets (character_id, sheet, level, manna) values (100, '{}', 2, 1500);
insert into public.pilot_progress (character_id, experience) values (100, 800);
delete from public.pilot_reward_log; -- the setup above was logged too

-- ---------------------------------------------------------------------
-- A player (the pilot's own)
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select is((select count(*)::int from public.pilot_progress), 0, 'players cannot read experience');
select is((select count(*)::int from public.pilot_reward_log), 0, 'players cannot read the reward log');
select throws_ok($$ insert into public.pilot_progress (character_id, experience) values (100, 5) $$,
  '42501', null, 'players cannot insert experience');
select throws_ok($$ update public.pilot_progress set experience = 1000 $$,
  '42501', null, 'players cannot update experience');
select throws_ok($$ insert into public.pilot_reward_log (character_id, field, old_value, new_value) values (100, 'level', 0, 9) $$,
  '42501', null, 'players cannot write the reward log');
select throws_ok($$ select public.award(100, 9, 9999, 1000, 'cheat') $$, 'P0001', 'Only GMs and owners can set rewards.',
  'players cannot call award');
select throws_ok($$ select public.level_up(100, 'cheat') $$, 'P0001', 'Only GMs and owners can level pilots up.',
  'players cannot call level_up');

-- ---------------------------------------------------------------------
-- A logged-out visitor
-- ---------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.pilot_progress $$, '42501', null, 'visitors cannot read experience');
select throws_ok($$ select count(*) from public.pilot_reward_log $$, '42501', null, 'visitors cannot read the reward log');
select throws_ok($$ select public.award(100, 9) $$, '42501', null, 'visitors cannot call award');

-- ---------------------------------------------------------------------
-- A GM
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is((select experience from public.pilot_progress where character_id = 100), 800, 'GMs can read experience');
select throws_ok($$ update public.pilot_progress set experience = 900 $$, '42501', null,
  'even GMs write experience only through award');

-- award: only the changed fields are logged, with the reason, who and when.
select lives_ok($$ select public.award(100, 2, 2000, 900, 'Mission 3') $$, 'GMs can award');
select is((select count(*)::int from public.pilot_reward_log where character_id = 100 and field = 'level'), 0,
  'an unchanged level is not logged, and GMs can read the log');
select results_eq(
  $$ select field, old_value, new_value, reason, changed_by from public.pilot_reward_log where character_id = 100 order by id $$,
  $$ values ('manna'::text, 1500, 2000, 'Mission 3'::text, '33333333-3333-3333-3333-333333333333'::uuid),
            ('experience'::text, 800, 900, 'Mission 3'::text, '33333333-3333-3333-3333-333333333333'::uuid) $$,
  'award logs each changed field with the reason and the GM');
select is((select manna from public.character_sheets where character_id = 100), 2000, 'award saved the manna');
select is((select level from public.character_sheets where character_id = 100), 2, 'award left the level alone');

-- Nulls leave fields alone; no reason is a null reason, and the reason does not linger.
select lives_ok($$ select public.award(100, 3) $$, 'award can change only the level');
select is((select reason is null from public.pilot_reward_log where field = 'level' and new_value = 3), true,
  'no reason is logged as null');
select is((select experience from public.pilot_progress where character_id = 100), 900, 'award left experience alone');

-- A direct sheet update (as from the dashboard or an old page) is logged with a null reason.
update public.character_sheets set manna = 2500 where character_id = 100;
select results_eq(
  $$ select old_value, new_value, reason from public.pilot_reward_log where field = 'manna' and new_value = 2500 $$,
  $$ values (2000, 2500, null::text) $$,
  'a direct sheet update is logged with no reason');
update public.character_sheets set review_note = 'hello' where character_id = 100;
select is((select count(*)::int from public.pilot_reward_log where character_id = 100), 4,
  'changing something else logs nothing');

-- Bounds
select throws_ok($$ select public.award(100, null, null, 1001) $$, 'P0001', 'Experience is at most 1000.', 'experience stops at 1000');
select throws_ok($$ select public.award(100, null, null, -1) $$, 'P0001', null, 'experience cannot be negative');
select throws_ok($$ select public.award(100, -1) $$, 'P0001', null, 'level cannot be negative');
select throws_ok($$ select public.award(100, null, -5) $$, 'P0001', null, 'manna cannot be negative');
select throws_ok($$ select public.award(999, 1) $$, 'P0001', null, 'award refuses a pilot with no sheet');

-- A pilot with no experience row yet: it is made, logged from 0.
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (101, '11111111-1111-1111-1111-111111111111', 'approved', 'Two', 'Deuce');
insert into public.character_sheets (character_id, sheet) values (101, '{}');
select lives_ok($$ select public.award(101, null, null, 250) $$, 'award can make the experience row');
select results_eq($$ select old_value, new_value from public.pilot_reward_log where character_id = 101 $$,
  $$ values (0, 250) $$, 'a new experience row is logged from 0');

-- level_up
select throws_ok($$ select public.level_up(101) $$, 'P0001', 'A pilot needs 1000 experience to level up.', 'level_up needs 1000 experience');
select lives_ok($$ select public.award(100, null, null, 1000) $$, 'experience can reach 1000');
select lives_ok($$ select public.level_up(100) $$, 'level_up works at 1000');
select is((select level from public.character_sheets where character_id = 100), 4, 'level_up raised the level by one');
select is((select experience from public.pilot_progress where character_id = 100), 0, 'level_up spent 1000 experience');
select results_eq(
  $$ select field, old_value, new_value, reason from public.pilot_reward_log where character_id = 100 and reason = 'Level up' order by id $$,
  $$ values ('level'::text, 3, 4, 'Level up'::text), ('experience'::text, 1000, 0, 'Level up'::text) $$,
  'level_up logs both changes with the default reason');
select lives_ok($$ select public.award(100, null, null, 1000) $$, 'experience can reach 1000 again');
select lives_ok($$ select public.level_up(100, 'Finished the arc') $$, 'level_up takes a reason');
select is((select count(*)::int from public.pilot_reward_log where reason = 'Finished the arc'), 2, 'level_up logs its own reason');

-- Deleting a pilot takes its log and experience with it.
reset role;
delete from public.characters where id = 100;
select is((select count(*)::int from public.pilot_reward_log where character_id = 100), 0, 'the log goes with the pilot');
select is((select count(*)::int from public.pilot_progress where character_id = 100), 0, 'experience goes with the pilot');

select * from finish();
rollback;
