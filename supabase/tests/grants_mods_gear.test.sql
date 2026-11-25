-- Mods and equipped pilot gear grant mech equipment (migration 20261125210000_grants_on_mods_and_gear.sql). When a PLAYER
-- submits, a system or weapon that a mod or an equipped gear item grants is accepted with that source and refused without it,
-- and the refusal names the source. Run with: supabase test db
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'ga@test.local', '{"full_name": "Player A"}');

insert into public.content_packs (id, name, manifest) overriding system value values (9701, '__GM_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data) values
  ('__g_frame', 9701, 'frames', '{"name": "Gframe", "source": "GMT", "mounts": ["Main", "Flex"]}'),
  ('__g_base', 9701, 'weapons', '{"name": "Base Gun", "mount": "Main"}'),
  ('__g_sys', 9701, 'systems', '{"name": "Mod Locked", "talent_item": false}'),
  ('__g_gun', 9701, 'weapons', '{"name": "Gear Locked", "mount": "Main"}'),
  ('__g_mod', 9701, 'mods', '{"name": "Mod Source", "special_equipment": ["__g_sys"]}'),
  ('__g_plain', 9701, 'mods', '{"name": "Plain Mod"}'),
  ('__g_kit', 9701, 'pilot_gear', '{"name": "Gear Source", "type": "Gear", "special_equipment": ["__g_gun"]}'),
  ('__g_gmod', 9701, 'mods', '{"name": "Gated Mod", "special_equipment": ["__g_sys"], "requires": [{"kind": "licence", "id": "__g_frame", "rank": 3}]}'),
  ('__g_esys', 9701, 'systems', '{"name": "Edited Locked", "talent_item": false}'),
  ('__g_emod', 9701, 'mods', '{"name": "Old Mod"}');
insert into public.content_items (id, pack_id, kind, data, draft) values
  ('__g_dmod', 9701, 'mods', '{"name": "Draft Mod", "special_equipment": ["__g_sys"]}', true),
  ('__g_dgun', 9701, 'weapons', '{"name": "Draft Gun", "mount": "Main"}', true),
  ('__g_dkit', 9701, 'pilot_gear', '{"name": "Draft Kit", "type": "Gear", "special_equipment": ["__g_gun"]}', true);
update public.content_items set edited = '{"name": "New Mod", "special_equipment": ["__g_esys"]}' where id = '__g_emod';

insert into public.characters (id, player_id, status, pilot_name, callsign, mechs) overriding system value values
  (300, 'a1111111-1111-1111-1111-111111111111', 'pending', 'Ay', 'Ayy', '[{"id": "m1", "name": "Rusty"}]');
insert into public.character_sheets (character_id, sheet, manna) values (300, '{}', 100000);

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';

-- Mods
update public.character_sheets set sheet = '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"]}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Mod Locked needs Gated Mod or Mod Source.', 'a system a mod grants is refused without the mod, naming it');
update public.character_sheets set sheet = '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"0:0": "__g_plain"}}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Mod Locked needs Gated Mod or Mod Source.', 'a mod that grants nothing doesn''t unlock it');
select is((select count(*) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"0:0": "__g_mod"}}}}', 0)), 0::bigint,
  'a system a mod grants is accepted with the mod on a weapon');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [[]], "systems": ["__g_sys"], "weapon_mods": {"0:0": "__g_mod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'the same mod after the weapon is removed from that place grants nothing');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"zzz": "__g_mod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'a mod at a junk key grants nothing');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"7:7": "__g_mod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'a mod at an out-of-range place grants nothing');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"0:1": "__g_mod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'a mod at an empty place of a mount with a weapon grants nothing');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"0:0\n": "__g_mod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'a key with a trailing newline grants nothing');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"x0:0": "__g_mod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'a key with a prefix grants nothing');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"0:0:0": "__g_mod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'a key with three parts grants nothing');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"\u0663:\u0663": "__g_mod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'a key with non-ASCII digits grants nothing and raises no error');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_dgun"]], "systems": ["__g_sys"], "weapon_mods": {"0:0": "__g_mod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'a mod on a draft weapon grants nothing');

-- Pilot gear
update public.character_sheets set sheet = '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_gun"]]}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Gear Locked needs Gear Source.', 'a weapon pilot gear grants is refused without it, naming it');
update public.character_sheets set sheet = '{"owned_gear": [{"key": "k1", "id": "__g_kit"}], "mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_gun"]]}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Gear Locked needs Gear Source.', 'owned but unequipped gear grants nothing');

-- The happy path: both sources at once
update public.character_sheets set sheet = '{
  "owned_gear": [{"key": "k1", "id": "__g_kit"}], "equipped_gear": ["k1"],
  "mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"], ["__g_gun"]], "systems": ["__g_sys"], "weapon_mods": {"0:0": "__g_mod"}}}
}' where character_id = 300;
select lives_ok($$ update public.characters set submitted_at = now() where id = 300 $$,
  'a pilot with a mod-granted system and a gear-granted weapon submits');

-- A mod's own requirements gate what it grants, wherever it is fitted (a stray key must not skip the check)
select is((select array_agg(problem order by problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"0:0": "__g_gmod"}}}}', 0)),
  array['Gated Mod needs GMT Gframe III.', 'Mod Locked needs Gated Mod or Mod Source.'],
  'a mod with an unmet licence is reported and grants nothing on a real place');
select is((select array_agg(problem order by problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"zzz": "__g_gmod"}}}}', 0)),
  array['Gated Mod needs GMT Gframe III.', 'Mod Locked needs Gated Mod or Mod Source.'],
  'the same mod at a stray key is reported and grants nothing');
select is((select array_agg(problem order by problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"7:7": "__g_gmod"}}}}', 0)),
  array['Gated Mod needs GMT Gframe III.', 'Mod Locked needs Gated Mod or Mod Source.'],
  'and at an out-of-range place');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"licences": {"__g_frame": 3}, "mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"zzz": "__g_gmod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'a stray mod with its requirement met still grants nothing');
select is((select count(*) from public.sheet_rule_problems(
  '{"licences": {"__g_frame": 3}, "mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"0:0": "__g_gmod"}}}}', 0)),
  0::bigint, 'a mod on an equipped weapon with its requirement met grants');

-- Drafts grant nothing; the edited copy is what counts, name included
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_sys"], "weapon_mods": {"0:0": "__g_dmod"}}}}', 0)),
  array['Mod Locked needs Gated Mod or Mod Source.'], 'a draft mod grants nothing and isn''t named');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"owned_gear": [{"key": "k9", "id": "__g_dkit"}], "equipped_gear": ["k9"], "mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_gun"]]}}}', 0)),
  array['Gear Locked needs Gear Source.'], 'draft gear in equipped grants nothing');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_esys"]}}}', 0)),
  array['Edited Locked needs New Mod.'], 'a grant that only the edited copy has is named by the edited name');
select is((select count(*) from public.sheet_rule_problems(
  '{"mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_base"]], "systems": ["__g_esys"], "weapon_mods": {"0:0": "__g_emod"}}}}', 0)),
  0::bigint, 'and the edited-only grant works');
select is((select array_agg(problem) from public.sheet_rule_problems(
  '{"owned_gear": [{"key": "k1", "id": "__g_kit"}], "equipped_gear": ["nope"], "mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_gun"]]}}}', 0)),
  array['Gear Locked needs Gear Source.'], 'an equipped key that isn''t owned grants nothing');

-- A pending change can't equip gear: an approved pilot's live equipped list is the truth
reset role;
insert into public.characters (id, player_id, status, pilot_name, callsign, approved_at) overriding system value values
  (301, 'a1111111-1111-1111-1111-111111111111', 'approved', 'Bee', 'Bee', '2000-01-01');
update public.characters set status = 'dead' where id = 300;
insert into public.character_sheets (character_id, sheet, manna) values
  (301, '{"owned_gear": [{"key": "k1", "id": "__g_kit", "free": true}], "equipped_gear": []}', 100000);
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet) values
  (301, 'a1111111-1111-1111-1111-111111111111', '{"pilot_name": "Bee", "callsign": "Bee", "mechs": []}',
   '{"owned_gear": [{"key": "k1", "id": "__g_kit", "free": true}], "equipped_gear": ["k1"], "mechs": {"m1": {"frame": "__g_frame", "mounts": [["__g_gun"]]}}}');
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 301 and status = 'pending' $$, 'P0001',
  'A mech: Gear Locked needs Gear Source.', 'a pending change that equips gear doesn''t unlock what it grants');

select * from finish();
rollback;
