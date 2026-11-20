-- Tries to break the pilot inventory (migration 20261121110000_pilot_inventory.sql): owned pilot gear, equipping
-- without approval (equip_pilot_gear), server-decided free items, bought gear costing manna at submit, no refunds,
-- approve_change keeping the live equipped list, first approval marking the free loadout, the backfill, and
-- GM-only misc items.
-- Run with: supabase test db. Everything happens inside a transaction that's rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('d4444444-4444-4444-4444-444444444444', 'pd@test.local', '{"full_name": "Player D"}'),
  ('e5555555-5555-5555-5555-555555555555', 'pe@test.local', '{"full_name": "Player E"}'),
  ('f6666666-6666-6666-6666-666666666666', 'pf@test.local', '{"full_name": "Player F"}'),
  ('a7777777-7777-7777-7777-777777777777', 'pgm@test.local', '{"full_name": "Game Master"}'),
  ('b8888888-8888-8888-8888-888888888888', 'pg@test.local', '{"full_name": "Player G"}'),
  ('c9999999-9999-9999-9999-999999999999', 'ph@test.local', '{"full_name": "Player H"}');
update public.profiles set role = 'gm' where id = 'a7777777-7777-7777-7777-777777777777';

-- Prices: Armour 100 (unset), Heavy armour 250, Pistol 400 (the edit's price wins over the original 50), Rifle 100
-- (its edit has no price, so the original 999 doesn't count), Kit 100 (an invalid price), Exotic gadget (Exotic).
insert into public.content_packs (id, name, manifest) overriding system value values (9701, '__INVENTORY_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('__pi_armor', 9701, 'pilot_gear', '{"id": "__pi_armor", "name": "Armour", "type": "Armor"}', null),
  ('__pi_armor2', 9701, 'pilot_gear', '{"id": "__pi_armor2", "name": "Heavy armour", "type": "Armor", "manna_cost": 250}', null),
  ('__pi_gun', 9701, 'pilot_gear', '{"id": "__pi_gun", "name": "Old pistol", "type": "Weapon", "manna_cost": 50}',
    '{"id": "__pi_gun", "name": "Pistol", "type": "Weapon", "manna_cost": 400}'),
  ('__pi_gun2', 9701, 'pilot_gear', '{"id": "__pi_gun2", "name": "Rifle", "type": "Weapon", "manna_cost": 999}',
    '{"id": "__pi_gun2", "name": "Rifle", "type": "Weapon"}'),
  ('__pi_kit', 9701, 'pilot_gear', '{"id": "__pi_kit", "name": "Kit", "type": "Gear", "manna_cost": -5}', null),
  ('__pi_exotic', 9701, 'pilot_gear', '{"id": "__pi_exotic", "name": "Exotic gadget", "type": "Gear", "source": "EXOTIC"}', null),
  ('__pi_str', 9701, 'pilot_gear', '{"id": "__pi_str", "name": "Wordy kit", "type": "Gear", "manna_cost": "lots"}', null);

-- 700: Player D's approved pilot (800 manna; it last changed long ago). 701: Player E's approved pilot. 702: Player F's
-- new pilot (a draft). 703: Player D's dead pilot. 704 and 705: the GM's approved and pending pilots, in the old shape.
insert into public.characters (id, player_id, status, pilot_name, callsign, updated_at) overriding system value values
  (700, 'd4444444-4444-4444-4444-444444444444', 'approved', 'Dee', 'Dee', '2000-01-01'),
  (701, 'e5555555-5555-5555-5555-555555555555', 'approved', 'Ee', 'Ee', '2000-01-01'),
  (702, 'f6666666-6666-6666-6666-666666666666', 'pending', 'Ef', 'Ef', '2000-01-01'),
  (703, 'd4444444-4444-4444-4444-444444444444', 'dead', 'Old Dee', 'Old Dee', '2000-01-01'),
  (704, 'a7777777-7777-7777-7777-777777777777', 'approved', 'Gee', 'Gee', '2000-01-01'),
  (705, 'a7777777-7777-7777-7777-777777777777', 'pending', 'Gee Two', 'Gee Two', '2000-01-01');
-- 706: the GM's pilot, approved before: its starting armour is free, the bought heavy armour and pistol aren't.
insert into public.characters (id, player_id, status, pilot_name, callsign, approved_at) overriding system value values
  (706, 'a7777777-7777-7777-7777-777777777777', 'approved', 'Gee Three', 'Gee Three', '2000-01-01');
insert into public.character_sheets (character_id, sheet, manna, updated_at) values
  (700, '{"owned_gear": [
      {"key": "a1", "id": "__pi_armor", "free": true}, {"key": "w1", "id": "__pi_gun", "free": true},
      {"key": "w2", "id": "__pi_gun2", "free": true}, {"key": "w3", "id": "__pi_gun", "free": false},
      {"key": "k1", "id": "__pi_kit", "free": true}, {"key": "u1", "id": "__pi_missing", "free": false},
      {"key": "a2", "id": "__pi_armor2", "free": false}],
    "equipped_gear": ["a1", "w1"]}', 800, '2000-01-01'),
  (701, '{"owned_gear": [{"key": "e1", "id": "__pi_kit", "free": true}], "equipped_gear": []}', 2000, '2000-01-01'),
  (702, '{"owned_gear": [], "equipped_gear": []}', 2000, '2000-01-01'),
  (703, '{"owned_gear": [{"key": "d1", "id": "__pi_kit", "free": true}], "equipped_gear": ["d1"]}', 2000, '2000-01-01'),
  (704, '{"pilot_gear": ["__pi_gun", "__pi_kit", "__pi_gun"], "pilot_gear_notes": {"Weapon:1": "Second gun", "Gear:0": "Kit note"}}', 2000, '2000-01-01'),
  (705, '{"pilot_gear": ["__pi_armor"]}', 2000, '2000-01-01'),
  (706, '{"owned_gear": [{"key": "b1", "id": "__pi_armor2", "free": false}, {"key": "s1", "id": "__pi_armor", "free": true},
      {"key": "g1", "id": "__pi_gun", "free": false}], "equipped_gear": []}', 2000, '2000-01-01');
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet) values
  (704, 'a7777777-7777-7777-7777-777777777777', '{"mechs": []}',
   '{"pilot_gear": ["__pi_gun", "__pi_gun", "__pi_kit", "__pi_kit"], "pilot_gear_notes": {"Weapon:0": "Renamed"}}');


-- ---------------------------------------------------------------------
-- Backfill (old pilot_gear -> owned_gear and equipped_gear)
-- ---------------------------------------------------------------------
-- As in the migration: converting isn't an edit, so updated_at triggers are off while it runs.
alter table public.character_sheets disable trigger character_sheets_updated_at;
alter table public.pending_changes disable trigger pending_changes_updated_at;
select ok(private.backfill_owned_gear() >= 3, 'the backfill converts the old sheets and change');
alter table public.character_sheets enable trigger character_sheets_updated_at;
alter table public.pending_changes enable trigger pending_changes_updated_at;
select is(private.backfill_owned_gear(), 0, 'and running it again changes nothing');

select is((select jsonb_path_query_array(sheet -> 'owned_gear', '$[*].id') from public.character_sheets where character_id = 704),
  '["__pi_gun", "__pi_kit", "__pi_gun"]', 'each old id becomes an owned item, in order');
select is((select jsonb_path_query_array(sheet -> 'owned_gear', '$[*].notes') from public.character_sheets where character_id = 704),
  '["Kit note", "Second gun"]', 'notes move to the item in their slot');
select is((select jsonb_path_query_array(sheet -> 'owned_gear', '$[*].free') from public.character_sheets where character_id = 704),
  '[true, true, true]', 'an approved pilot owns its old gear free');
select is((select sheet -> 'equipped_gear' from public.character_sheets where character_id = 704),
  (select jsonb_path_query_array(sheet -> 'owned_gear', '$[*].key') from public.character_sheets where character_id = 704),
  'everything is equipped');
select ok((select not (sheet ? 'pilot_gear' or sheet ? 'pilot_gear_notes') from public.character_sheets where character_id = 704),
  'the old fields are gone');
select is((select updated_at from public.character_sheets where character_id = 704), '2000-01-01'::timestamptz,
  'converting doesn''t count as the sheet changing');
select is((select jsonb_path_query_array(sheet -> 'owned_gear', '$[*].free') from public.character_sheets where character_id = 705),
  '[]', 'a pending pilot''s free flags are left for its first approval');

select is(
  (select jsonb_path_query_array(p.proposed_sheet -> 'owned_gear', '$[0 to 2].key') from public.pending_changes p where p.character_id = 704),
  (select jsonb_build_array(o -> 0 -> 'key', o -> 2 -> 'key', o -> 1 -> 'key')
   from (select sheet -> 'owned_gear' as o from public.character_sheets where character_id = 704) s),
  'a change reuses the sheet''s keys for the same item at the same occurrence');
select ok(
  (select not exists (
     select 1 from public.character_sheets s, jsonb_array_elements(s.sheet -> 'owned_gear') e
     where s.character_id = 704 and e -> 'key' = p.proposed_sheet -> 'owned_gear' -> 3 -> 'key')
   and p.proposed_sheet -> 'owned_gear' -> 3 -> 'free' = 'false'
   from public.pending_changes p where p.character_id = 704),
  'an extra item in a change gets a new key and isn''t free');
select is((select proposed_sheet -> 'owned_gear' -> 0 ->> 'notes' from public.pending_changes where character_id = 704),
  'Renamed', 'a change''s notes come from its own slots');


-- ---------------------------------------------------------------------
-- Equipping (Player D)
-- ---------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.equip_pilot_gear(bigint, text[])', 'execute'), 'anon can''t equip');

set local role authenticated;
set local request.jwt.claim.sub = 'd4444444-4444-4444-4444-444444444444';

select is(public.equip_pilot_gear(700, array['a1', 'w1', 'w3', 'k1']), '2000-01-01'::timestamptz,
  'a player equips their own gear and the sheet''s updated_at doesn''t move');
select is((select sheet -> 'equipped_gear' from public.character_sheets where character_id = 700), '["a1", "w1", "w3", "k1"]',
  'and it is saved');
select throws_ok($$ select public.equip_pilot_gear(700, array['a1', 'u1']) $$, 'P0001', 'Not pilot gear.',
  'an owned item whose content isn''t pilot gear can''t be equipped');
select throws_ok($$ select public.equip_pilot_gear(700, array['a1', 'nope']) $$, 'P0001', 'Not owned.', 'gear it doesn''t own is refused');
select throws_ok($$ select public.equip_pilot_gear(700, array['a1', 'a1']) $$, 'P0001', 'Equipped twice.', 'the same copy twice is refused');
select throws_ok($$ select public.equip_pilot_gear(700, array['w1', 'w2', 'w3']) $$, 'P0001', 'Only 2 pilot weapons fit.',
  'a third weapon is refused');
select throws_ok($$ select public.equip_pilot_gear(700, array['a1', 'a2']) $$, 'P0001', 'Only 1 pilot armour fits.',
  'a second armour is refused');
select throws_ok($$ select public.equip_pilot_gear(701, array['e1']) $$, 'P0001', 'Not your pilot.',
  'someone else''s pilot is refused');
select throws_ok($$ select public.equip_pilot_gear(703, array['d1']) $$, 'P0001', 'Only an approved pilot can change equipped gear.',
  'a dead pilot is refused');
update public.character_sheets set sheet = sheet || '{"equipped_gear": []}' where character_id = 700;
select is((select sheet -> 'equipped_gear' from public.character_sheets where character_id = 700), '["a1", "w1", "w3", "k1"]',
  'a direct write to an approved sheet changes nothing');

set local request.jwt.claim.sub = 'f6666666-6666-6666-6666-666666666666';
update public.character_sheets set sheet = '{"owned_gear": [{"key": "p1", "id": "__pi_armor"}], "equipped_gear": []}'
  where character_id = 702;
select throws_ok($$ select public.equip_pilot_gear(702, array['p1']) $$, 'P0001', 'Only an approved pilot can change equipped gear.',
  'a pending pilot equips through its draft sheet, not this');

set local request.jwt.claim.sub = 'a7777777-7777-7777-7777-777777777777';
select lives_ok($$ select public.equip_pilot_gear(701, array['e1']) $$, 'a GM equips any approved pilot''s gear');


-- ---------------------------------------------------------------------
-- Buying through a change (Player D, 800 manna; already bought: Pistol 400, Heavy armour 250, an unknown item 0)
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = 'd4444444-4444-4444-4444-444444444444';
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet)
select 700, 'd4444444-4444-4444-4444-444444444444', '{"pilot_name": "Dee", "callsign": "Dee", "mechs": []}',
  jsonb_set(sheet, '{owned_gear}', sheet -> 'owned_gear'
    || '[{"key": "n1", "id": "__pi_gun2", "free": true}, {"key": "n2", "id": "__pi_kit", "free": true}]')
  || '{"equipped_gear": ["n1"]}'
from public.character_sheets where character_id = 700;

select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 700 and status = 'pending' $$, 'P0001',
  'This spends 850 manna, but only 800 was received.', 'bought gear claiming to be free is charged anyway (edited, unset and invalid prices)');

update public.pending_changes
set proposed_sheet = jsonb_set(proposed_sheet, '{owned_gear}', (proposed_sheet -> 'owned_gear') - 8
  || '[{"key": "a1", "id": "__pi_armor", "free": true}]')
where character_id = 700 and status = 'pending';
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 700 and status = 'pending' $$, 'P0001',
  'This spends 850 manna, but only 800 was received. Owned pilot gear has a missing or repeated key.',
  'a second copy under a free item''s key is charged, and the repeated key is refused');

update public.pending_changes
set proposed_sheet = jsonb_set(proposed_sheet, '{owned_gear}', (proposed_sheet -> 'owned_gear') - 3 - 7)
where character_id = 700 and status = 'pending';
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 700 and status = 'pending' $$, 'P0001',
  'Owned pilot gear can''t be removed: Pistol.', 'dropping bought gear for a refund is refused');

update public.pending_changes
set proposed_sheet = (select jsonb_set(sheet, '{owned_gear}', sheet -> 'owned_gear'
                        || '[{"key": "n1", "id": "__pi_gun2"}, {"key": "n3", "id": "__pi_nope"}]')
                      from public.character_sheets where character_id = 700)
where character_id = 700 and status = 'pending';
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 700 and status = 'pending' $$, 'P0001',
  'Unknown item (__pi_nope).', 'a newly owned id that isn''t pilot gear is refused');

update public.pending_changes
set proposed_sheet = (select jsonb_set(sheet, '{owned_gear}', sheet -> 'owned_gear'
                        || '[{"key": "n1", "id": "__pi_gun2"}, {"key": "n4", "id": "__pi_str"}]')
                      from public.character_sheets where character_id = 700)
where character_id = 700 and status = 'pending';
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 700 and status = 'pending' $$, 'P0001',
  'This spends 850 manna, but only 800 was received.', 'a manna_cost that isn''t a number costs 100 and doesn''t break the check');

-- The approved sheet's unknown item (u1, backfilled) is still owned here, and passes.
update public.pending_changes
set proposed_sheet = (select jsonb_set(sheet, '{owned_gear}', sheet -> 'owned_gear' || '[{"key": "n1", "id": "__pi_gun2", "free": true}]')
                      from public.character_sheets where character_id = 700)
where character_id = 700 and status = 'pending';
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 700 and status = 'pending' $$,
  'buying within the manna received submits');

select lives_ok($$ select public.equip_pilot_gear(700, array['a1', 'w1']) $$, 'the player still equips while the change waits');

set local request.jwt.claim.sub = 'a7777777-7777-7777-7777-777777777777';
select lives_ok($$ select public.approve_change(
    (select id from public.pending_changes where character_id = 700 and status = 'pending'),
    (select submitted_at from public.pending_changes where character_id = 700 and status = 'pending')) $$,
  'equipping didn''t make the change stale, so the GM approves it');

reset role;
select is((select sheet -> 'equipped_gear' from public.character_sheets where character_id = 700), '["a1", "w1"]',
  'approving keeps the live equipped list, not the change''s');
select is((select jsonb_path_query_array(sheet -> 'owned_gear', '$[*].free') from public.character_sheets where character_id = 700),
  '[true, true, true, false, true, false, false, false]', 'the bought item isn''t free, and earlier flags stay as they were');

-- A GM-made change that drops an equipped item: it leaves the equipped list too.
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, submitted_at)
select 700, 'a7777777-7777-7777-7777-777777777777', '{"pilot_name": "Dee", "callsign": "Dee", "mechs": []}',
  jsonb_set(sheet, '{owned_gear}', (sheet -> 'owned_gear') - 1), now()
from public.character_sheets where character_id = 700;
set local role authenticated;
select lives_ok($$ select public.approve_change(
    (select id from public.pending_changes where character_id = 700 and status = 'pending'),
    (select submitted_at from public.pending_changes where character_id = 700 and status = 'pending')) $$,
  'the GM approves a change that removes an equipped item');
reset role;
select is((select sheet -> 'equipped_gear' from public.character_sheets where character_id = 700), '["a1"]',
  'equipped keys that are no longer owned are dropped');


-- ---------------------------------------------------------------------
-- A new pilot (Player F, 2000 manna): the first 1 armour, 2 weapons and 3 gear are free
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'f6666666-6666-6666-6666-666666666666';
update public.character_sheets set sheet = '{"licences": {"__pi_lic": 3}, "owned_gear": [
    {"key": "p1", "id": "__pi_armor", "free": true}, {"key": "p2", "id": "__pi_armor2", "free": true},
    {"key": "p3", "id": "__pi_gun", "free": true}, {"key": "p4", "id": "__pi_gun", "free": true},
    {"key": "p5", "id": "__pi_gun2", "free": true}, {"key": "p6", "id": "__pi_kit", "free": true},
    {"key": "p7", "id": "__pi_kit", "free": true}, {"key": "p8", "id": "__pi_kit", "free": true},
    {"key": "p9", "id": "__pi_kit", "free": true}],
  "equipped_gear": ["p1", "p2", "ghost", "p3", "p4", "p5", "p6", "p7", "p8", "p9"]}'
where character_id = 702;
select throws_ok($$ update public.characters set submitted_at = now() where id = 702 $$, 'P0001',
  'This spends 2,250 manna, but only 2,000 was received.', 'gear past the free loadout is charged, whatever the sheet says');

update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear,0,id}', '"__pi_exotic"') - 'licences' where character_id = 702;
select throws_ok($$ update public.characters set submitted_at = now() where id = 702 $$, 'P0001',
  'Exotic items need a GM to add them: Exotic gadget.', 'restricted gear in owned_gear is caught');

update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear,0,id}', '"__pi_armor"') where character_id = 702;
update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear,8,key}', '"p1"') where character_id = 702;
select throws_ok($$ update public.characters set submitted_at = now() where id = 702 $$, 'P0001',
  'Owned pilot gear has a missing or repeated key.', 'a repeated key is refused');
update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear,8,key}', '""') where character_id = 702;
select throws_ok($$ update public.characters set submitted_at = now() where id = 702 $$, 'P0001',
  'Owned pilot gear has a missing or repeated key.', 'an empty key is refused');
update public.character_sheets set sheet = sheet #- '{owned_gear,8,key}' where character_id = 702;
select throws_ok($$ update public.characters set submitted_at = now() where id = 702 $$, 'P0001',
  'Owned pilot gear has a missing or repeated key.', 'a missing key is refused');
update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear,8}', '{"key": "p9", "id": "__pi_nope"}') where character_id = 702;
select throws_ok($$ update public.characters set submitted_at = now() where id = 702 $$, 'P0001',
  'Unknown item (__pi_nope).', 'a new pilot''s unknown id is refused');
update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear,8}', '{"key": "p9", "id": "__pi_kit", "free": true}')
  where character_id = 702;
select lives_ok($$ update public.characters set submitted_at = now() where id = 702 $$, 'within the manna received it submits');

set local request.jwt.claim.sub = 'a7777777-7777-7777-7777-777777777777';
select lives_ok($$ select public.approve_pilot(702, clock_timestamp()) $$, 'the GM approves the pilot');
reset role;
select is((select jsonb_path_query_array(sheet -> 'owned_gear', '$[*].free') from public.character_sheets where character_id = 702),
  '[true, false, true, true, false, true, true, true, false]', 'first approval marks the first 1 armour, 2 weapons and 3 gear free');
select is((select sheet -> 'equipped_gear' from public.character_sheets where character_id = 702), '["p1", "p3", "p4", "p6", "p7", "p8"]',
  'and keeps the pilot''s equipped list, trimmed to 1 armour, 2 weapons and 3 gear, without keys it doesn''t own');
select is(public.settle_pilot_gear('{"owned_gear": [{"key": "x", "id": "__pi_missing"}], "equipped_gear": ["x"]}', null, true) -> 'equipped_gear',
  '[]', 'first approval drops equipped items that aren''t pilot gear');

-- A GM moves an approved pilot back to pending and approves it again: it gains no free items.
update public.characters set status = 'pending' where id = 706;
update public.characters set status = 'approved' where id = 706;
select is((select jsonb_path_query_array(sheet -> 'owned_gear', '$[*].free') from public.character_sheets where character_id = 706),
  '[false, true, false]', 'approving a pilot again keeps only the free flags it had');

-- A GM approved pilot from before approved_at (a free flag on an owned entry gives it away) gains nothing either.
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (709, 'a7777777-7777-7777-7777-777777777777', 'approved', 'Gee Four', 'Gee Four');
insert into public.character_sheets (character_id, sheet) values
  (709, '{"owned_gear": [{"key": "b1", "id": "__pi_armor2", "free": false}, {"key": "s1", "id": "__pi_armor", "free": true}], "equipped_gear": []}');
update public.characters set status = 'pending' where id = 709;
update public.characters set status = 'approved' where id = 709;
select is((select jsonb_path_query_array(sheet -> 'owned_gear', '$[*].free') from public.character_sheets where character_id = 709),
  '[false, true]', 'a pilot approved before approved_at existed keeps only the free flags it had');


-- ---------------------------------------------------------------------
-- Players never write "free" (Player G's pilot, approved before and moved back to pending by a GM; Player H's new pilot)
-- ---------------------------------------------------------------------
insert into public.characters (id, player_id, status, pilot_name, callsign, approved_at) overriding system value values
  (707, 'b8888888-8888-8888-8888-888888888888', 'approved', 'Gie', 'Gie', '2000-01-01');
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (708, 'c9999999-9999-9999-9999-999999999999', 'pending', 'Aitch', 'Aitch');
insert into public.character_sheets (character_id, sheet) values
  (707, '{"owned_gear": [{"key": "q1", "id": "__pi_armor", "free": true}, {"key": "q2", "id": "__pi_armor2", "free": false},
      {"key": "q3", "id": "__pi_gun", "free": false}], "equipped_gear": []}');
update public.characters set status = 'pending' where id = 707;

set local role authenticated;
set local request.jwt.claim.sub = 'b8888888-8888-8888-8888-888888888888';
update public.character_sheets set sheet = '{"owned_gear": [{"key": "q1", "id": "__pi_armor", "free": true},
    {"key": "q2", "id": "__pi_armor2", "free": true}, {"key": "q3", "id": "__pi_gun", "free": true},
    {"key": "q4", "id": "__pi_gun2", "free": true}], "equipped_gear": []}'
  where character_id = 707;
select is((select sheet -> 'owned_gear' from public.character_sheets where character_id = 707),
  '[{"key": "q1", "id": "__pi_armor", "free": true}, {"key": "q2", "id": "__pi_armor2", "free": false},
    {"key": "q3", "id": "__pi_gun", "free": false}, {"key": "q4", "id": "__pi_gun2"}]',
  'a player writing free flags on a pending sheet gets the saved flags back, and none on a new item');
select throws_ok($$ update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear,0,id}', '"__pi_armor2"') where character_id = 707 $$,
  'P0001', 'Owned pilot gear can''t be removed: Armour.', 'a free item can''t be swapped for a pricier one');
select throws_ok($$ update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear}', (sheet -> 'owned_gear') - 2) where character_id = 707 $$,
  'P0001', 'Owned pilot gear can''t be removed: Pistol.', 'a pilot approved before can''t drop owned gear while pending');
select throws_ok($$ update public.character_sheets set sheet = sheet || '{"owned_gear": "none"}' where character_id = 707 $$,
  'P0001', 'Owned pilot gear can''t be removed: Armour, Heavy armour, Pistol.', 'or throw the whole list away');
select lives_ok($$ update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear}', (sheet -> 'owned_gear') - 3) where character_id = 707 $$,
  'gear added since the last approval can still be taken off');
update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear}', sheet -> 'owned_gear' || '[{"key": "q4", "id": "__pi_gun2"}]')
  where character_id = 707;
select lives_ok($$ update public.characters set submitted_at = now() where id = 707 $$, 'the player submits it');

set local request.jwt.claim.sub = 'a7777777-7777-7777-7777-777777777777';
select lives_ok($$ select public.approve_pilot(707, clock_timestamp()) $$, 'the GM approves it again');
select is((select jsonb_path_query_array(sheet -> 'owned_gear', '$[*].free') from public.character_sheets where character_id = 707),
  '[true, false, false, false]', 'approving again doesn''t honour the forged flags');
update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear,1,free}', 'true') where character_id = 707;
select is((select sheet -> 'owned_gear' -> 1 -> 'free' from public.character_sheets where character_id = 707), 'true'::jsonb,
  'a GM can still set free flags');

set local request.jwt.claim.sub = 'c9999999-9999-9999-9999-999999999999';
insert into public.character_sheets (character_id, sheet)
  values (708, '{"owned_gear": [{"key": "h1", "id": "__pi_armor", "free": true}, {"key": "h2", "id": "__pi_gun", "free": false}]}');
reset role;
select is((select sheet -> 'owned_gear' from public.character_sheets where character_id = 708),
  '[{"key": "h1", "id": "__pi_armor"}, {"key": "h2", "id": "__pi_gun"}]', 'a new pilot''s sheet is saved without free flags');


-- ---------------------------------------------------------------------
-- Misc items: only GMs and owners change them (Player H's pending pilot 708, Player E's approved pilot 701)
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pi@test.local', '{"full_name": "Player I"}');
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (710, 'aaaaaaaa-0000-0000-0000-000000000001', 'pending', 'Eye', 'Eye');

set local role authenticated;
set local request.jwt.claim.sub = 'a7777777-7777-7777-7777-777777777777';
select lives_ok($$ update public.character_sheets
    set sheet = sheet || '{"misc_items": [{"key": "m1", "name": "Keycard", "notes": "Opens the hangar."}, {"key": "m2", "name": "Medal"}]}'
    where character_id = 708 $$, 'a GM adds misc items');
select lives_ok($$ update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items,1,name}', '"Bronze medal"') where character_id = 708 $$,
  'a GM edits one');
select lives_ok($$ update public.character_sheets set sheet = sheet || '{"misc_items": [{"key": "x1", "name": "Favour owed"}, {"key": "x0", "name": "Spare"}]}'
    where character_id = 701 $$, 'a GM gives an approved pilot misc items');
select lives_ok($$ update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items}', (sheet -> 'misc_items') - 1) where character_id = 701 $$,
  'a GM removes one');
select is((select sheet -> 'misc_items' from public.character_sheets where character_id = 701), '[{"key": "x1", "name": "Favour owed"}]',
  'and it is gone');

select throws_ok($$ update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items,0,name}', '"   "') where character_id = 708 $$,
  'P0001', 'Misc item names must be 1 to 60 characters.', 'a blank name is refused');
select throws_ok(format($q$ update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items,0,name}', '"%s"') where character_id = 708 $q$,
  repeat('x', 61)), 'P0001', 'Misc item names must be 1 to 60 characters.', 'a 61-character name is refused');
select lives_ok(format($q$ update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items,0,name}', '" %s "') where character_id = 708 $q$,
  repeat('x', 60)), 'a 60-character name (after trimming) is fine');
select throws_ok(format($q$ update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items,0,notes}', '"%s"') where character_id = 708 $q$,
  repeat('n', 141)), 'P0001', 'Misc item notes must be 140 characters or fewer.', 'notes past 140 characters are refused');
select throws_ok($$ update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items,1,key}', '"m1"') where character_id = 708 $$,
  'P0001', 'Misc items have a missing or repeated key.', 'a repeated key is refused');
select throws_ok($$ update public.character_sheets set sheet = sheet #- '{misc_items,1,key}' where character_id = 708 $$,
  'P0001', 'Misc items have a missing or repeated key.', 'a missing key is refused');
select throws_ok($$ update public.character_sheets set sheet = sheet || '{"misc_items": "keycard"}' where character_id = 708 $$,
  'P0001', 'Misc items must be a list.', 'misc items that aren''t a list are refused');
update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items,0,name}', '"Keycard"') where character_id = 708;

set local request.jwt.claim.sub = 'c9999999-9999-9999-9999-999999999999';
select is((select sheet -> 'misc_items' from public.pilot_sheet(708)),
  '[{"key": "m1", "name": "Keycard", "notes": "Opens the hangar."}, {"key": "m2", "name": "Bronze medal"}]',
  'the pilot''s player sees its misc items');
update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items}', sheet -> 'misc_items' || '[{"key": "m3", "name": "Forged"}]')
  where character_id = 708;
update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items,0,notes}', '"Opens everything."') where character_id = 708;
select is((select sheet -> 'misc_items' from public.character_sheets where character_id = 708),
  '[{"key": "m1", "name": "Keycard", "notes": "Opens the hangar."}, {"key": "m2", "name": "Bronze medal"}]',
  'a player''s write can''t add or change misc items');
update public.character_sheets set sheet = sheet - 'misc_items' where character_id = 708;
select is((select jsonb_array_length(sheet -> 'misc_items') from public.character_sheets where character_id = 708), 2,
  'or remove them');

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into public.character_sheets (character_id, sheet) values (710, '{"misc_items": [{"key": "z1", "name": "Free tank"}]}');
select ok((select not sheet ? 'misc_items' from public.character_sheets where character_id = 710),
  'a new pilot''s sheet is saved without misc items');

set local request.jwt.claim.sub = 'e5555555-5555-5555-5555-555555555555';
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet)
select 701, 'e5555555-5555-5555-5555-555555555555', '{"pilot_name": "Ee", "callsign": "Ee", "mechs": []}',
  jsonb_set(sheet, '{misc_items,0,name}', '"Two favours owed"')
from public.character_sheets where character_id = 701;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 701 and status = 'pending' $$, 'P0001',
  'Misc items can only be changed by a GM.', 'a change that alters misc items is refused');
update public.pending_changes set proposed_sheet = (select sheet from public.character_sheets where character_id = 701)
  where character_id = 701 and status = 'pending';
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 701 and status = 'pending' $$,
  'a change carrying the live misc items submits');

-- A GM adds an item after the change was made (without the sheet's updated_at moving, so the change isn't stale).
reset role;
alter table public.character_sheets disable trigger character_sheets_updated_at;
update public.character_sheets set sheet = jsonb_set(sheet, '{misc_items}', sheet -> 'misc_items' || '[{"key": "x2", "name": "Medal"}]')
  where character_id = 701;
alter table public.character_sheets enable trigger character_sheets_updated_at;
set local role authenticated;
set local request.jwt.claim.sub = 'a7777777-7777-7777-7777-777777777777';
select lives_ok($$ select public.approve_change(
    (select id from public.pending_changes where character_id = 701 and status = 'pending'),
    (select submitted_at from public.pending_changes where character_id = 701 and status = 'pending')) $$,
  'the GM approves the change');
select is((select sheet -> 'misc_items' from public.character_sheets where character_id = 701),
  '[{"key": "x1", "name": "Favour owed"}, {"key": "x2", "name": "Medal"}]', 'approving keeps the live misc items, not the change''s');
reset role;

select * from finish();
rollback;
