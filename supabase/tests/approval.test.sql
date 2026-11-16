-- Tries to break the approval workflow as each kind of user (migration 20261116225551_approval_hardening.sql):
-- locked submitted changes, based_on clamped by the database, approve_change / reject_change / approve_pilot,
-- one living pilot, dead is final, and who can delete characters. Run with: supabase test db
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Test users: six players, a GM and an owner. The sign-up trigger gives each one a player profile.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('22222222-2222-2222-2222-222222222222', 'p2@test.local', '{"full_name": "Player Two"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}'),
  ('44444444-4444-4444-4444-444444444444', 'owner@test.local', '{"full_name": "Owner"}'),
  ('55555555-5555-5555-5555-555555555555', 'p4@test.local', '{"full_name": "Player Four"}'),
  ('66666666-6666-6666-6666-666666666666', 'p5@test.local', '{"full_name": "Player Five"}'),
  ('77777777-7777-7777-7777-777777777777', 'p6@test.local', '{"full_name": "Player Six"}'),
  ('88888888-8888-8888-8888-888888888888', 'p7@test.local', '{"full_name": "Player Seven"}');

update public.profiles set role = 'gm' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'owner' where id = '44444444-4444-4444-4444-444444444444';

-- Set up as the database owner, so none of the player rules apply yet.
-- 100: Player Two's approved pilot. 103: Player Four's approved pilot, with a sheet and a waiting change.
-- 104: a dead pilot. 105: Player Seven's approved pilot. 106 and 107: Players Five and Six's pending pilots.
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (100, '22222222-2222-2222-2222-222222222222', 'approved', 'Two', 'Deuce'),
  (103, '55555555-5555-5555-5555-555555555555', 'approved', 'Four', 'Quad'),
  (104, '22222222-2222-2222-2222-222222222222', 'dead', 'Old Two', 'Ghost'),
  (105, '88888888-8888-8888-8888-888888888888', 'approved', 'Seven', 'Lucky'),
  (106, '66666666-6666-6666-6666-666666666666', 'pending', 'Five', 'Fiver'),
  (107, '77777777-7777-7777-7777-777777777777', 'pending', 'Six', 'Sixer');
insert into public.character_sheets (character_id, sheet) values (100, '{"manna": 50}'), (103, '{}');
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet)
  values (103, '55555555-5555-5555-5555-555555555555', '{"pilot_name": "Four", "mechs": []}', '{}');


-- ---------------------------------------------------------------------
-- Player Two proposes a change to approved pilot 100
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select lives_ok(
  $$ insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, based_on)
     values (100, '22222222-2222-2222-2222-222222222222',
             '{"pilot_name": "Two", "callsign": "Deuce Prime", "mechs": []}', '{"manna": 40}', '2099-01-01') $$,
  'players can propose a change');
select is(
  (select based_on from public.pending_changes where character_id = 100),
  (select greatest(c.updated_at, s.updated_at)
   from public.characters c join public.character_sheets s on s.character_id = c.id where c.id = 100),
  'a forged future based_on is clamped to when the pilot last changed');
select throws_ok(
  $$ update public.pending_changes set based_on = now() + interval '1 day' where character_id = 100 $$,
  'P0001', 'based_on is set when a change is created and never changes.', 'players cannot change based_on');

-- A draft is theirs to edit, but not to review.
select lives_ok(
  $$ update public.pending_changes set proposed_sheet = '{"manna": 30}' where character_id = 100 $$,
  'players can edit their draft');
select throws_ok(
  $$ update public.pending_changes set status = 'approved' where character_id = 100 $$,
  'P0001', 'Only GMs can change who a change belongs to or how it was reviewed.', 'players cannot set status');
select throws_ok(
  $$ update public.pending_changes set review_reason = 'Great' where character_id = 100 $$,
  'P0001', null, 'players cannot write the review note');
select throws_ok(
  $$ update public.pending_changes set reviewed_by = '22222222-2222-2222-2222-222222222222' where character_id = 100 $$,
  'P0001', null, 'players cannot set reviewed_by');
select throws_ok(
  $$ update public.pending_changes set created_at = now() - interval '1 day' where character_id = 100 $$,
  'P0001', null, 'players cannot change created_at');

-- Nobody can approve a draft.
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select throws_ok(
  $$ select public.approve_change((select id from public.pending_changes where character_id = 100),
       (select submitted_at from public.pending_changes where character_id = 100)) $$,
  'P0001', null, 'GMs cannot approve a draft');
select throws_ok(
  $$ select public.reject_change((select id from public.pending_changes where character_id = 100), 'No') $$,
  'P0001', null, 'GMs cannot reject a draft');

-- Submitted: locked, except for taking it back.
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select lives_ok(
  $$ update public.pending_changes set submitted_at = now() where character_id = 100 $$,
  'players can submit their change');
select throws_ok(
  $$ update public.pending_changes set proposed_sheet = '{"manna": 1000}' where character_id = 100 $$,
  'P0001', 'This change is waiting for review. Choose Edit change to change it.',
  'players cannot edit the proposed sheet of a submitted change');
select throws_ok(
  $$ update public.pending_changes set proposed_public = '{"pilot_name": "Hacked", "mechs": []}' where character_id = 100 $$,
  'P0001', 'This change is waiting for review. Choose Edit change to change it.',
  'players cannot edit the proposed card of a submitted change');
select throws_ok(
  $$ update public.pending_changes set submitted_at = now() + interval '1 day' where character_id = 100 $$,
  'P0001', null, 'players cannot move the submitted time');
select throws_ok(
  $$ select public.approve_change((select id from public.pending_changes where character_id = 100),
       (select submitted_at from public.pending_changes where character_id = 100)) $$,
  'P0001', null, 'players cannot approve their own change');
select throws_ok(
  $$ select public.reject_change((select id from public.pending_changes where character_id = 100), 'No') $$,
  'P0001', 'Only GMs and owners can reject changes.', 'players cannot reject a change');

select lives_ok(
  $$ update public.pending_changes set submitted_at = null where character_id = 100 $$,
  'players can take a submitted change back to a draft');
select lives_ok(
  $$ update public.pending_changes set proposed_sheet = '{"manna": 35}' where character_id = 100 $$,
  'players can edit it again once it is a draft');
select lives_ok(
  $$ update public.pending_changes set submitted_at = '2000-01-01' where character_id = 100 $$,
  'players can submit it again');
select cmp_ok(
  (select submitted_at from public.pending_changes where character_id = 100), '>', '2020-01-01'::timestamptz,
  'the database stamps the submitted time, so an old one cannot be replayed');


-- ---------------------------------------------------------------------
-- GM reviews it
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select throws_ok(
  $$ select public.reject_change((select id from public.pending_changes where character_id = 100), '   ') $$,
  'P0001', 'Write a reason first, so the player knows what to fix.', 'rejecting needs a reason');
select throws_ok(
  $$ select public.approve_change((select id from public.pending_changes where character_id = 100),
       (select submitted_at - interval '1 second' from public.pending_changes where character_id = 100), 'Nice work') $$,
  'P0001', 'The player edited this change after you opened it. Reload to see the latest.',
  'approve_change refuses when the change was resubmitted after the GM opened it');
select throws_ok(
  $$ select public.approve_change((select id from public.pending_changes where character_id = 100), null, 'Nice work') $$,
  'P0001', null, 'approve_change needs the submitted time the GM loaded');
select lives_ok(
  $$ select public.approve_change((select id from public.pending_changes where character_id = 100),
       (select submitted_at from public.pending_changes where character_id = 100), '  Nice work  ') $$,
  'GMs can approve a change with a note');
select is((select review_reason from public.pending_changes where character_id = 100), 'Nice work',
  'the approval note is saved, trimmed');
select is((select status::text from public.pending_changes where character_id = 100), 'approved', 'the change is approved');
select is((select reviewed_by from public.pending_changes where character_id = 100), '33333333-3333-3333-3333-333333333333'::uuid,
  'the approver is recorded');
select is((select callsign from public.characters where id = 100), 'Deuce Prime', 'approving updates the public card');
select is((select sheet ->> 'manna' from public.character_sheets where character_id = 100), '35', 'approving updates the sheet');

-- A second change goes stale: the pilot changes after it was made (as the database owner, with moddatetime
-- paused so updated_at can be set to a later time, since now() doesn't move inside a test).
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select lives_ok(
  $$ insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, submitted_at)
     values (100, '22222222-2222-2222-2222-222222222222', '{"pilot_name": "Two", "callsign": "Stale", "mechs": []}', '{}', now()) $$,
  'players can propose another change once the last one is reviewed');

reset role;
alter table public.characters disable trigger characters_updated_at;
update public.characters set updated_at = now() + interval '1 hour' where id = 100;
alter table public.characters enable trigger characters_updated_at;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select throws_ok(
  $$ select public.approve_change((select id from public.pending_changes where character_id = 100 and status = 'pending'),
       (select submitted_at from public.pending_changes where character_id = 100 and status = 'pending'), 'Fine') $$,
  'P0001', 'This character changed after the change was made. Reject it so the player can resubmit.',
  'approve_change refuses a change made before the pilot last changed');
select lives_ok(
  $$ select public.reject_change((select id from public.pending_changes where character_id = 100 and status = 'pending'), '  Out of date  ') $$,
  'GMs can reject a change with a reason');
select is((select review_reason from public.pending_changes where character_id = 100 and status = 'rejected'), 'Out of date',
  'the rejection reason is saved, trimmed');
select is((select reviewed_by from public.pending_changes where character_id = 100 and status = 'rejected'),
  '33333333-3333-3333-3333-333333333333'::uuid, 'the rejecter is recorded');
select isnt((select reviewed_at from public.pending_changes where character_id = 100 and status = 'rejected'), null,
  'the rejection time is recorded');
select throws_ok(
  $$ select public.reject_change((select id from public.pending_changes where character_id = 100 and status = 'rejected'), 'Again') $$,
  'P0001', null, 'a reviewed change cannot be rejected again');

-- Approving with no note leaves the note empty.
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
-- (The pilot's last change is in the future after the step above, so this change says it was based on that.)
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, submitted_at, based_on)
  values (100, '22222222-2222-2222-2222-222222222222', '{"pilot_name": "Two", "mechs": []}', '{}', now(),
          (select greatest(c.updated_at, s.updated_at)
           from public.characters c join public.character_sheets s on s.character_id = c.id where c.id = 100));
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select lives_ok(
  $$ select public.approve_change((select id from public.pending_changes where character_id = 100 and status = 'pending'),
       (select submitted_at from public.pending_changes where character_id = 100 and status = 'pending')) $$,
  'GMs can approve a change with no note');
select is((select count(*)::int from public.pending_changes where character_id = 100 and status = 'approved' and review_reason is null),
  1, 'no note is saved as null');

-- Withdrawing a submitted change is still allowed.
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
-- A player who loaded the pilot before it last changed keeps their earlier based_on.
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, submitted_at, based_on)
  values (100, '22222222-2222-2222-2222-222222222222', '{"pilot_name": "Two", "mechs": []}', '{}', now(), '2000-01-01');
select is((select based_on from public.pending_changes where character_id = 100 and status = 'pending'),
  '2000-01-01'::timestamptz, 'an honest earlier based_on is kept');
with attempt as (
  delete from public.pending_changes where character_id = 100 and status = 'pending' returning 1
)
select is((select count(*)::int from attempt), 1, 'players can withdraw a submitted change');


-- ---------------------------------------------------------------------
-- A new pilot: one living pilot, and approve_pilot
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select lives_ok(
  $$ insert into public.characters (player_id, pilot_name) values ('11111111-1111-1111-1111-111111111111', 'One') $$,
  'a player can create a pending pilot');
select throws_ok(
  $$ insert into public.characters (player_id, pilot_name) values ('11111111-1111-1111-1111-111111111111', 'One Again') $$,
  'P0001', 'You already have a living pilot.', 'a player cannot create a second living pilot');
select lives_ok(
  $$ insert into public.character_sheets (character_id, sheet)
     select id, '{}' from public.characters where pilot_name = 'One' $$,
  'the player fills in the sheet');
select throws_ok(
  $$ select public.approve_pilot((select id from public.characters where pilot_name = 'One'), now(), 'Hi') $$,
  'P0001', 'Only GMs and owners can approve pilots.', 'players cannot approve a pilot');

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select lives_ok(
  $$ insert into public.characters (player_id, pilot_name)
     values ('33333333-3333-3333-3333-333333333333', 'GM One'), ('33333333-3333-3333-3333-333333333333', 'GM Two') $$,
  'GMs can have several living pilots');
select throws_ok(
  $$ select public.approve_pilot(100, now(), 'Hi') $$,
  'P0001', 'Character 100 is not waiting for approval.', 'approve_pilot refuses an approved pilot');
select throws_ok(
  $$ select public.approve_pilot((select id from public.characters where pilot_name = 'One'), null, 'Hi') $$,
  'P0001', 'The player changed this pilot after you opened it. Reload to see the latest.', 'approve_pilot needs the time the GM loaded');
select throws_ok(
  $$ select public.approve_pilot(
       (select id from public.characters where pilot_name = 'One'),
       (select greatest(c.updated_at, s.updated_at) - interval '1 millisecond'
        from public.characters c join public.character_sheets s on s.character_id = c.id where c.pilot_name = 'One'),
       'Hi') $$,
  'P0001', 'The player changed this pilot after you opened it. Reload to see the latest.',
  'approve_pilot refuses when the pilot changed after the GM loaded it');
select lives_ok(
  $$ select public.approve_pilot(
       (select id from public.characters where pilot_name = 'One'),
       (select greatest(c.updated_at, s.updated_at)
        from public.characters c join public.character_sheets s on s.character_id = c.id where c.pilot_name = 'One'),
       '  Welcome  ') $$,
  'GMs can approve a pilot with a note');
select is((select review_note from public.character_sheets s join public.characters c on c.id = s.character_id where c.pilot_name = 'One'),
  'Welcome', 'the pilot note is saved, trimmed');
select is((select status::text from public.characters where pilot_name = 'One'), 'approved', 'the pilot is approved');
select isnt((select approved_at from public.characters where pilot_name = 'One'), null, 'the approval time is recorded');

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select throws_ok(
  $$ insert into public.characters (player_id, pilot_name) values ('11111111-1111-1111-1111-111111111111', 'One Again') $$,
  'P0001', null, 'an approved pilot counts as living too');


-- ---------------------------------------------------------------------
-- Dead is final
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select throws_ok(
  $$ update public.characters set status = 'approved' where id = 104 $$,
  'P0001', 'A dead pilot cannot come back.', 'GMs cannot revive a dead pilot');
select throws_ok(
  $$ update public.characters set status = 'pending' where id = 104 $$,
  'P0001', null, 'GMs cannot make a dead pilot pending');
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select throws_ok(
  $$ update public.characters set status = 'approved' where id = 104 $$,
  'P0001', null, 'owners cannot revive a dead pilot either');
select lives_ok(
  $$ update public.characters set callsign = 'Still Ghost' where id = 104 $$,
  'other edits to a dead pilot still work');

set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select lives_ok($$ select public.mark_dead(105) $$, 'players can still mark their own pilot dead');
select is((select status::text from public.characters where id = 105), 'dead', 'the pilot is dead');


-- ---------------------------------------------------------------------
-- Deleting characters
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
with attempt as (delete from public.characters where id = 103 returning 1)
select is((select count(*)::int from attempt), 0, 'players cannot delete their own approved pilot');

set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
with attempt as (delete from public.characters where id = 107 returning 1)
select is((select count(*)::int from attempt), 0, 'players cannot delete someone else''s pending pilot');
with attempt as (delete from public.characters where id = 106 returning 1)
select is((select count(*)::int from attempt), 1, 'players can withdraw their own pending pilot');

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
with attempt as (delete from public.characters where id = 103 returning 1)
select is((select count(*)::int from attempt), 0, 'GMs cannot delete an approved pilot');
with attempt as (delete from public.characters where id = 107 returning 1)
select is((select count(*)::int from attempt), 0, 'GMs cannot delete a pending pilot');

set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
with attempt as (delete from public.characters where id = 103 returning 1)
select is((select count(*)::int from attempt), 1, 'owners can delete any pilot');
select is((select count(*)::int from public.character_sheets where character_id = 103), 0, 'deleting a pilot deletes its sheet');
select is((select count(*)::int from public.pending_changes where character_id = 103), 0, 'deleting a pilot deletes its changes');

reset role;
select * from finish();
rollback;
