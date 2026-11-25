-- Commendation requirements (migration 20261125190000_commendation_requirements.sql): when a PLAYER submits, an item that
-- requires a commendation is refused unless the pilot has that award in pilot_commendations. A "commendations" key written
-- into the sheet counts for nothing, and a hidden commendation still counts. Run with: supabase test db
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'ca@test.local', '{"full_name": "Player A"}'),
  ('b2222222-2222-2222-2222-222222222222', 'cb@test.local', '{"full_name": "Player B"}'),
  ('c3333333-3333-3333-3333-333333333333', 'cgm@test.local', '{"full_name": "Game Master"}');
update public.profiles set role = 'gm' where id = 'c3333333-3333-3333-3333-333333333333';

insert into public.commendations (id, name, icon, hidden) values
  ('00000000-0000-4000-8000-0000000000c1', 'Test Ace', 'star', false),
  ('00000000-0000-4000-8000-0000000000c2', 'Test Secret', 'star', true);
insert into public.content_packs (id, name, manifest) overriding system value values (9701, '__CR_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data) values
  ('__c_ace', 9701, 'pilot_gear', '{"name": "Ace pistol", "type": "Gear", "requires": [{"kind": "commendation", "id": "00000000-0000-4000-8000-0000000000c1"}]}'),
  ('__c_ace2', 9701, 'pilot_gear', '{"name": "Ace rifle", "type": "Gear", "requires": [{"kind": "commendation", "id": "00000000-0000-4000-8000-0000000000c1"}]}'),
  ('__c_secret', 9701, 'pilot_gear', '{"name": "Secret kit", "type": "Gear", "requires": [{"kind": "commendation", "id": "00000000-0000-4000-8000-0000000000c2"}]}'),
  ('__c_secret2', 9701, 'pilot_gear', '{"name": "Secret rifle", "type": "Gear", "requires": [{"kind": "commendation", "id": "00000000-0000-4000-8000-0000000000c2"}]}'),
  ('__c_gone', 9701, 'pilot_gear', '{"name": "Ghost kit", "type": "Gear", "requires": [{"kind": "commendation", "id": "00000000-0000-4000-8000-0000000000c9"}]}');

-- 400: Player A's pilot, awarded both commendations (later approved, Test Ace then taken back). 401: Player B's new pilot,
-- no awards.
insert into public.characters (id, player_id, status, pilot_name, callsign, mechs) overriding system value values
  (400, 'a1111111-1111-1111-1111-111111111111', 'pending', 'Ay', 'Ayy', '[]'),
  (401, 'b2222222-2222-2222-2222-222222222222', 'pending', 'Bee', 'Beebee', '[]');
insert into public.character_sheets (character_id, sheet, manna) values
  (400, '{}', 100000),
  (401, '{}', 100000);
insert into public.pilot_commendations (character_id, commendation_id) values
  (400, '00000000-0000-4000-8000-0000000000c1'),
  (400, '00000000-0000-4000-8000-0000000000c2');

-- unmet_requirements itself: the name comes from commendations, an unknown id shows as itself, a missing list is met.
select is((select string_agg(t, ', ') from public.unmet_requirements(
  '[{"kind": "commendation", "id": "00000000-0000-4000-8000-0000000000c1"}, {"kind": "commendation", "id": "nope"}]', '{}', '{}') t),
  'Test Ace, nope', 'unmet commendations are named, an unknown id shows as the id');
select is((select count(*) from public.unmet_requirements(
  '[{"kind": "commendation", "id": "00000000-0000-4000-8000-0000000000c1"}]', '{"commendations": ["00000000-0000-4000-8000-0000000000c1"]}', '{}')),
  0::bigint, 'an awarded commendation is met');

-- ---------------------------------------------------------------------
-- A new pilot (Player B, no awards)
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';

select lives_ok($$ update public.character_sheets set sheet = '{"owned_gear": [{"key": "k1", "id": "__c_ace"}]}' where character_id = 401 $$,
  'a draft needing a commendation saves');
select throws_ok($$ update public.characters set submitted_at = now() where id = 401 $$, 'P0001',
  'Ace pistol needs Test Ace.', 'an item needing a commendation is refused without the award');
update public.character_sheets set sheet = '{"owned_gear": [{"key": "k1", "id": "__c_ace"}], "commendations": ["00000000-0000-4000-8000-0000000000c1"]}' where character_id = 401;
select throws_ok($$ update public.characters set submitted_at = now() where id = 401 $$, 'P0001',
  'Ace pistol needs Test Ace.', 'a commendations list written into the sheet counts for nothing');
select throws_ok($$ insert into public.pilot_commendations (character_id, commendation_id) values (401, '00000000-0000-4000-8000-0000000000c1') $$,
  '42501', null, 'a player can''t give themselves the award');
update public.character_sheets set sheet = '{"owned_gear": [{"key": "k1", "id": "__c_gone"}]}' where character_id = 401;
select throws_ok($$ update public.characters set submitted_at = now() where id = 401 $$, 'P0001',
  'Ghost kit needs 00000000-0000-4000-8000-0000000000c9.', 'a requirement on a commendation that doesn''t exist is unmet');

-- ---------------------------------------------------------------------
-- A new pilot (Player A, awarded): met, and a hidden commendation still counts
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
update public.character_sheets set sheet = '{"owned_gear": [{"key": "k1", "id": "__c_ace"}, {"key": "k2", "id": "__c_secret"}]}' where character_id = 400;
select lives_ok($$ update public.characters set submitted_at = now() where id = 400 $$,
  'a pilot with the awards submits, the hidden commendation counting too');

-- ---------------------------------------------------------------------
-- A change: a lost award isn't a new problem, a new item needing one is
-- ---------------------------------------------------------------------
reset role;
update public.characters set status = 'approved', submitted_at = null where id = 400;
update public.character_sheets set sheet = '{"owned_gear": [{"key": "k1", "id": "__c_ace"}, {"key": "k2", "id": "__c_secret"}]}' where character_id = 400;
delete from public.pilot_commendations where character_id = 400 and commendation_id = '00000000-0000-4000-8000-0000000000c1';
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet)
  values (400, 'a1111111-1111-1111-1111-111111111111', '{"mechs": []}',
    '{"owned_gear": [{"key": "k1", "id": "__c_ace"}, {"key": "k2", "id": "__c_secret"}]}');
set local role authenticated;
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$,
  'after the award was taken back, a change keeping the owned item still submits');
reset role;
update public.pending_changes set submitted_at = null,
  proposed_sheet = '{"owned_gear": [{"key": "k1", "id": "__c_ace"}, {"key": "k2", "id": "__c_secret"}, {"key": "k3", "id": "__c_ace2"}], "commendations": ["00000000-0000-4000-8000-0000000000c1"]}'
  where character_id = 400;
set local role authenticated;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$, 'P0001',
  'Ace rifle needs Test Ace.', 'a change adding another item that needs the lost award is refused, faked list or not');

-- The pending row's own id isn't the pilot's: the award is looked up by character_id. Pilot 400 holds only Test Secret now.
reset role;
update public.pending_changes set
  proposed_sheet = '{"owned_gear": [{"key": "k1", "id": "__c_ace"}, {"key": "k2", "id": "__c_secret"}, {"key": "k3", "id": "__c_secret2"}]}'
  where character_id = 400;
set local role authenticated;
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$,
  'a change adding an item that needs an award the pilot holds submits');
reset role;
update public.pending_changes set submitted_at = null,
  proposed_sheet = '{"owned_gear": [{"key": "k1", "id": "__c_ace"}, {"key": "k2", "id": "__c_secret"}, {"key": "k4", "id": "__c_ace2"}]}'
  where character_id = 400;
set local role authenticated;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$, 'P0001',
  'Ace rifle needs Test Ace.', 'a change adding an item that needs an award the pilot lacks is refused');

select * from finish();
rollback;
