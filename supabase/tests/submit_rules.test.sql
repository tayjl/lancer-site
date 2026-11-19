-- Tries to bypass the picker rules from the console (migration 20261119170000_enforce_picker_rules.sql): when a PLAYER
-- submits a new pilot or a change, newly added GM-only and Exotic content is refused, and so is spending more manna than
-- was received. Drafts save freely; GMs are never checked. Run with: supabase test db
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Ids are hard-coded below. Sequences aren't rolled back, so push the generated ids well past them, once and for good.
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'sa@test.local', '{"full_name": "Player A"}'),
  ('b2222222-2222-2222-2222-222222222222', 'sb@test.local', '{"full_name": "Player B"}'),
  ('c3333333-3333-3333-3333-333333333333', 'sgm@test.local', '{"full_name": "Game Master"}');
update public.profiles set role = 'gm' where id = 'c3333333-3333-3333-3333-333333333333';

-- Test content. An Exotic weapon, a system that only carries the Exotic tag, a HORUS frame (its licence) with a gun of
-- that licence, a plain weapon, an item whose edit made it Exotic, and one whose edit made it ordinary.
insert into public.content_packs (id, name, manifest) overriding system value values (9501, '__SUBMIT_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('__x_maul', 9501, 'weapons', '{"id": "__x_maul", "name": "Plasma Maul", "source": "EXOTIC"}', null),
  ('__x_sys', 9501, 'systems', '{"id": "__x_sys", "name": "Ghost Cell", "source": "GMS", "tags": [{"id": "tg_exotic"}]}', null),
  ('__x_frame', 9501, 'frames', '{"id": "__x_frame", "name": "Horus Frame", "source": "HORUS", "license_id": "__x_frame"}', null),
  ('__x_gear', 9501, 'weapons', '{"id": "__x_gear", "name": "Horus gun", "source": "GMS", "license_id": "__x_frame", "license_level": 1}', null),
  ('__x_ok', 9501, 'weapons', '{"id": "__x_ok", "name": "Plain gun", "source": "GMS"}', null),
  ('__x_edit', 9501, 'weapons', '{"id": "__x_edit", "name": "Plain old", "source": "GMS"}', '{"id": "__x_edit", "name": "Edited Gun", "source": " exotic "}'),
  ('__x_unex', 9501, 'weapons', '{"id": "__x_unex", "name": "Was Exotic", "source": "EXOTIC"}', '{"id": "__x_unex", "name": "Now Plain", "source": "GMS"}');
insert into public.bionics (id, name, manna_cost, source) overriding system value values
  (9001, 'Exotic Eye', 0, 'EXOTIC'),
  (9002, 'Exotic Ear', 0, ' exotic '),
  (9003, 'Cheap arm', 500, null),
  (9004, 'Dear arm', 700, null),
  (9005, 'Horus Eye', 0, 'HORUS');

-- 200: Player A's new pilot (a draft). 201: Player B's approved pilot, which already has an Exotic weapon, a held
-- HORUS licence and an Exotic biomod (a GM granted them), 1500 manna and an open draft change.
-- 202 and 203: the GM's own approved and pending pilots.
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (200, 'a1111111-1111-1111-1111-111111111111', 'pending', 'Ay', 'Ayy'),
  (201, 'b2222222-2222-2222-2222-222222222222', 'approved', 'Bee', 'Beebee'),
  (202, 'c3333333-3333-3333-3333-333333333333', 'approved', 'GM One', 'Gee'),
  (203, 'c3333333-3333-3333-3333-333333333333', 'pending', 'GM Two', 'Gee Too');
insert into public.character_sheets (character_id, sheet, manna) values
  (200, '{}', 1500),
  (201, '{"pilot_gear": ["__x_maul"], "licences": {"__x_frame": 1}, "bionics": [9001]}', 1500),
  (202, '{}', 1500),
  (203, '{}', 1500);
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet)
  values (201, 'b2222222-2222-2222-2222-222222222222', '{"mechs": []}',
          '{"pilot_gear": ["__x_maul"], "licences": {"__x_frame": 1}, "bionics": [9001]}');
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet)
  values (202, 'c3333333-3333-3333-3333-333333333333', '{"mechs": []}', '{}');


-- ---------------------------------------------------------------------
-- A new pilot (Player A)
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';

select lives_ok($$ update public.character_sheets set sheet = '{"pilot_gear": ["__x_maul"]}' where character_id = 200 $$,
  'a draft saves with anything in it');
select throws_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'P0001',
  'Exotic items need a GM to add them: Plasma Maul.', 'a new pilot with an Exotic weapon is refused');
select is((select submitted_at from public.characters where id = 200), null, 'and stays a draft');

update public.character_sheets set sheet = '{"mechs": {"m1": {"systems": ["__x_sys"]}}}' where character_id = 200;
select throws_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'P0001',
  'Exotic items need a GM to add them: Ghost Cell.', 'a system with only the Exotic tag counts, even inside a mech');

update public.character_sheets set sheet = '{"licences": {"__x_frame": 1}}' where character_id = 200;
select throws_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'P0001',
  'GM-only items need a GM to add them: Horus Frame.', 'a HORUS licence is caught by its key');

update public.character_sheets set sheet = '{"pilot_gear": ["__x_gear"]}' where character_id = 200;
select throws_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'P0001',
  'GM-only items need a GM to add them: Horus gun.', 'an item of a HORUS licence is GM-only');

update public.character_sheets set sheet = '{"bionics": [9001, 9002, 9005]}' where character_id = 200;
select throws_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'P0001',
  'Exotic items need a GM to add them: Exotic Ear, Exotic Eye. GM-only items need a GM to add them: Horus Eye.',
  'Exotic and HORUS biomods (any case) are both named');

update public.character_sheets set sheet = '{"pilot_gear": ["__x_edit"]}' where character_id = 200;
select throws_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'P0001',
  'Exotic items need a GM to add them: Edited Gun.', 'an edit that makes an item Exotic counts');

update public.character_sheets set sheet = '{"pilot_gear": ["__x_ok", "__x_unex"], "licences": {"__x_other": 1}}' where character_id = 200;
select lives_ok($$ update public.characters set submitted_at = now() where id = 200 $$,
  'plain content passes, and an edit that made an item ordinary counts');
select isnt((select submitted_at from public.characters where id = 200), null, 'the pilot is submitted');
update public.characters set submitted_at = null where id = 200;

-- Manna: 1500 was received.
update public.character_sheets set sheet = '{"licences": {"__a": 2, "__b": 1}}' where character_id = 200;
select throws_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'P0001',
  'This spends 1,800 manna, but only 1,500 was received.', 'overspending licence ranks is refused');
update public.character_sheets set sheet = '{"licences": {"__a": 2}, "talents": {"__t": 1}}' where character_id = 200;
select lives_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'spending exactly what was received passes');
update public.characters set submitted_at = null where id = 200;

update public.character_sheets set sheet = '{"bionics": [9003, 9004], "talents": {"__t": 1}}' where character_id = 200;
select lives_ok($$ update public.characters set submitted_at = now() where id = 200 $$,
  'biomods cost their own price (500 + 700 + a 300 talent rank = 1,500)');
update public.characters set submitted_at = null where id = 200;
update public.character_sheets set sheet = '{"bionics": [9003, 9003, 9004], "talents": {"__t": 1}}' where character_id = 200;
select throws_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'P0001',
  'This spends 2,000 manna, but only 1,500 was received.', 'a repeated biomod is paid for twice');

update public.character_sheets set sheet = '{}' where character_id = 200;
update public.characters set mechs = '[{"id": "1"}, {"id": "2"}, {"id": "3"}, {"id": "4"}]' where id = 200;
select lives_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'four mechs cost 3 x 500 = 1,500, which passes');
update public.characters set submitted_at = null where id = 200;
update public.characters set mechs = '[{"id": "1"}, {"id": "2"}, {"id": "3"}, {"id": "4"}, {"id": "5"}]' where id = 200;
select throws_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'P0001',
  'This spends 2,000 manna, but only 1,500 was received.', 'the extra-mech price counts');

update public.character_sheets set sheet = '{"pilot_gear": ["__x_maul"], "talents": {"__t": 3}}' where character_id = 200;
select throws_ok($$ update public.characters set submitted_at = now() where id = 200 $$, 'P0001',
  'Exotic items need a GM to add them: Plasma Maul. This spends 2,900 manna, but only 1,500 was received.',
  'every problem is named at once');


-- ---------------------------------------------------------------------
-- A change to an approved pilot (Player B)
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';

select lives_ok(
  $$ update public.pending_changes set proposed_sheet =
       '{"pilot_gear": ["__x_maul", "__x_sys"], "licences": {"__x_frame": 1}, "bionics": [9001]}' where character_id = 201 $$,
  'a draft change saves with anything in it');
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 201 $$, 'P0001',
  'Exotic items need a GM to add them: Ghost Cell.', 'adding a new Exotic item is refused (the held ones are not named)');
select is((select submitted_at from public.pending_changes where character_id = 201), null, 'and the change stays a draft');

update public.pending_changes set proposed_sheet = '{"pilot_gear": ["__x_maul"], "licences": {"__x_frame": 2}, "bionics": [9001]}' where character_id = 201;
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 201 $$,
  'items the approved sheet already had can stay, and a held HORUS licence can be raised');
update public.pending_changes set submitted_at = null where character_id = 201;

update public.pending_changes set proposed_sheet = '{"pilot_gear": ["__x_maul", "__x_gear"], "licences": {"__x_frame": 1}, "bionics": [9001]}' where character_id = 201;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 201 $$, 'P0001',
  'GM-only items need a GM to add them: Horus gun.', 'a new GM-only item is refused');

update public.pending_changes set proposed_sheet = '{"licences": {"__x_frame": 1}, "bionics": [9001, 9002, 9005]}' where character_id = 201;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 201 $$, 'P0001',
  'Exotic items need a GM to add them: Exotic Ear. GM-only items need a GM to add them: Horus Eye.', 'new Exotic and HORUS biomods are refused');

update public.pending_changes set proposed_sheet = '{"licences": {"__x_frame": 3}}' where character_id = 201;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 201 $$, 'P0001',
  'This spends 1,800 manna, but only 1,500 was received.', 'overspending is refused');
update public.pending_changes set proposed_sheet = '{"licences": {"__x_frame": 2}, "talents": {"__t": 1}}' where character_id = 201;
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 201 $$, 'spending exactly the balance passes');
update public.pending_changes set submitted_at = null where character_id = 201;

update public.pending_changes set proposed_sheet = '{"bionics": [9003]}',
  proposed_public = '{"mechs": [{"id": "1"}, {"id": "2"}, {"id": "3"}]}' where character_id = 201;
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 201 $$,
  'two extra mechs (1,000) and a 500 biomod come to exactly 1,500');
update public.pending_changes set submitted_at = null where character_id = 201;
update public.pending_changes set proposed_public = '{"mechs": [{"id": "1"}, {"id": "2"}, {"id": "3"}, {"id": "4"}]}' where character_id = 201;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 201 $$, 'P0001',
  'This spends 2,000 manna, but only 1,500 was received.', 'the extra-mech price counts, from the proposed card');


-- ---------------------------------------------------------------------
-- GMs are never checked
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'c3333333-3333-3333-3333-333333333333';

select lives_ok($$ update public.character_sheets set sheet = '{"pilot_gear": ["__x_maul", "__x_gear"], "licences": {"__x_frame": 3}, "bionics": [9001]}'
  where character_id = 201 $$, 'a GM edits any sheet directly');
update public.character_sheets set sheet = '{"pilot_gear": ["__x_maul"], "licences": {"__x_frame": 3}}' where character_id = 203;
select lives_ok($$ update public.characters set submitted_at = now() where id = 203 $$, 'a GM submits their own pilot, Exotic and overspent');
update public.pending_changes set proposed_sheet = '{"pilot_gear": ["__x_maul"], "licences": {"__x_frame": 3}}' where character_id = 202;
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 202 $$, 'a GM submits their own change, Exotic and overspent');

select * from finish();
rollback;
