-- Tries to break delete_my_account() (migration 20261121180000_delete_my_account.sql): a user deletes only themselves,
-- their pilots and everything hanging off them go, what they wrote for others stays with the author cleared,
-- logged-out visitors can't call it and the last owner can't leave.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
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
  (101, '11111111-1111-1111-1111-111111111111', 'dead', 'Gone'),
  (200, '22222222-2222-2222-2222-222222222222', 'approved', 'Two');
insert into public.character_sheets (character_id, sheet) values (100, '{}'), (200, '{}');
insert into public.pilot_progress (character_id, experience) values (100, 5), (200, 5);
insert into public.pilot_profiles (character_id, colour, motto) values (100, '#112233', 'one'), (200, '#445566', 'two');
insert into public.organisations (id, name) overriding system value values (900, 'Test Union');
insert into public.reputation (character_id, organisation_id, level_id, updated_by) values
  (100, 900, (select id from public.reputation_levels where name = 'Neutral'), '33333333-3333-3333-3333-333333333333'),
  (200, 900, (select id from public.reputation_levels where name = 'Neutral'), '33333333-3333-3333-3333-333333333333');
insert into public.pending_changes (id, character_id, submitted_by, proposed_public, proposed_sheet) overriding system value values
  (5001, 100, '11111111-1111-1111-1111-111111111111', '{}', '{}'),
  -- Player One's change on a pilot a GM has since handed to Player Two.
  (5002, 200, '11111111-1111-1111-1111-111111111111', '{}', '{}');
insert into public.pending_changes (id, character_id, submitted_by, proposed_public, proposed_sheet, status, reviewed_by, reviewed_at)
  overriding system value values
  (5003, 200, '22222222-2222-2222-2222-222222222222', '{}', '{}', 'approved', '33333333-3333-3333-3333-333333333333', now());
insert into public.pilot_reward_log (character_id, field, old_value, new_value, changed_by) values
  (200, 'manna', 0, 10, '33333333-3333-3333-3333-333333333333');

-- Authors are stamped from the logged-in user by triggers, so seed these "as" that user.
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.pilot_timeline (id, character_id, kind, title) values
  ('a0000000-0000-4000-8000-000000000001', 100, 'player', 'One note');
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into public.pilot_timeline (id, character_id, kind, title) values
  ('a0000000-0000-4000-8000-000000000002', 200, 'gm', 'GM note on Two');
insert into public.lore_entries (id, title, kind, published_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'GM lore', 'place', now());
insert into public.pithub_entries (id, title, kind) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'GM file', 'story');
insert into public.commendations (id, name, icon) values ('c0000000-0000-4000-8000-000000000001', 'Steady hands', 'star');
insert into public.pilot_commendations (id, character_id, commendation_id, reason) values
  ('d0000000-0000-4000-8000-000000000001', 200, 'c0000000-0000-4000-8000-000000000001', 'seeded');
reset request.jwt.claim.sub;

-- ---------------------------------------------------------------------
-- A logged-out visitor
-- ---------------------------------------------------------------------
set local role anon;
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'logged-out visitors cannot call it');
reset role;

-- ---------------------------------------------------------------------
-- Player One deletes their account
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select throws_ok($$ select public.delete_my_account('22222222-2222-2222-2222-222222222222'::uuid) $$, '42883', null,
  'it takes no argument, so nobody can name another user');
select lives_ok($$ select public.delete_my_account() $$, 'a player can delete their own account');
reset role;

select is((select count(*)::int from auth.users where id = '11111111-1111-1111-1111-111111111111'), 0, 'their login is gone');
select is((select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 0, 'their profile is gone');
select is((select count(*)::int from public.characters where id in (100, 101)), 0, 'all their pilots are gone, dead ones too');
select is((select count(*)::int from public.character_sheets where character_id = 100), 0, 'their sheet is gone');
select is((select count(*)::int from public.pilot_progress where character_id = 100), 0, 'their experience is gone');
select is((select count(*)::int from public.pilot_profiles where character_id = 100), 0, 'their pilot profile is gone');
select is((select count(*)::int from public.reputation where character_id = 100), 0, 'reputation about their pilot is gone');
select is((select count(*)::int from public.pending_changes where id = 5001), 0, 'changes to their pilot are gone');
select is((select count(*)::int from public.pilot_timeline where character_id = 100), 0, 'their service record is gone');

select is((select count(*)::int from auth.users where id = '22222222-2222-2222-2222-222222222222'), 1, 'other players stay');
select is((select count(*)::int from public.characters where id = 200), 1, 'other pilots stay');
select is((select count(*)::int from public.character_sheets where character_id = 200), 1, 'other sheets stay');
select is((select count(*)::int from public.reputation where character_id = 200), 1, 'other reputation stays');
select is((select count(*)::int from public.pilot_timeline where id = 'a0000000-0000-4000-8000-000000000002'), 1, 'other service records stay');
select is((select submitted_by from public.pending_changes where id = 5002), null::uuid,
  'their change on a pilot that is now someone else''s stays with the submitter cleared');

-- ---------------------------------------------------------------------
-- The GM deletes their account: what they wrote stays, author cleared
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select lives_ok($$ select public.delete_my_account() $$, 'a GM can delete their own account');
reset role;

select is((select created_by from public.lore_entries where id = 'bbbbbbbb-0000-0000-0000-000000000001'), null::uuid,
  'lore they wrote stays with no author');
select is((select created_by from public.pithub_entries where id = 'bbbbbbbb-0000-0000-0000-000000000002'), null::uuid,
  'pithub entries they wrote stay with no author');
select is((select created_by from public.pilot_timeline where id = 'a0000000-0000-4000-8000-000000000002'), null::uuid,
  'their service record entry on another pilot stays with no author');
select is((select awarded_by from public.pilot_commendations where id = 'd0000000-0000-4000-8000-000000000001'), null::uuid,
  'their commendation stays with no giver');
select is((select changed_by from public.pilot_reward_log where character_id = 200 and field = 'manna' and new_value = 10), null::uuid,
  'their reward log line stays with no author');
select is((select updated_by from public.reputation where character_id = 200), null::uuid,
  'reputation they set stays with no author');
select is((select reviewed_by from public.pending_changes where id = 5003), null::uuid,
  'changes they reviewed stay with no reviewer');

-- Clearing the author is still blocked while the author exists.
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into public.lore_entries (id, title, kind) values ('bbbbbbbb-0000-0000-0000-000000000003', 'Owner lore', 'story');
update public.lore_entries set created_by = null where id = 'bbbbbbbb-0000-0000-0000-000000000003';
select is((select created_by from public.lore_entries where id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  '44444444-4444-4444-4444-444444444444'::uuid, 'a living author cannot be cleared');
reset request.jwt.claim.sub;

-- ---------------------------------------------------------------------
-- Owners (the local database may hold real owners: demote them so the test owner is the only one)
-- ---------------------------------------------------------------------
update public.profiles set role = 'player' where role = 'owner' and id <> '44444444-4444-4444-4444-444444444444';
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select throws_ok($$ select public.delete_my_account() $$, 'P0001',
  'You are the last owner. Make someone else an owner first.', 'the last owner cannot delete their account');
reset role;
select is((select count(*)::int from auth.users where id = '44444444-4444-4444-4444-444444444444'), 1, 'the last owner is still there');

insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-5555-5555-555555555555', 'owner2@test.local', '{"full_name": "Owner Two"}');
update public.profiles set role = 'owner' where id = '55555555-5555-5555-5555-555555555555';
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'an owner can leave while another owner remains');
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select throws_ok($$ select public.delete_my_account() $$, 'P0001',
  'You are the last owner. Make someone else an owner first.', 'then the remaining owner is the last one');
reset role;

select * from finish();
rollback;
