-- Tries to bypass the homebrew rules from the console (migration 20261121140000_homebrew_rules.sql): when a PLAYER submits,
-- unmet requirements, granted equipment without its source, a bad replace-mount choice and too many biomod mod points are
-- refused. Problems already on the approved sheet stay; drafts save freely; GMs are never checked. Also the new biomod
-- fields in save_bionic. Run with: supabase test db
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'ha@test.local', '{"full_name": "Player A"}'),
  ('b2222222-2222-2222-2222-222222222222', 'hb@test.local', '{"full_name": "Player B"}'),
  ('c3333333-3333-3333-3333-333333333333', 'hgm@test.local', '{"full_name": "Game Master"}'),
  ('d4444444-4444-4444-4444-444444444444', 'how@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'gm' where id = 'c3333333-3333-3333-3333-333333333333';
update public.profiles set role = 'owner' where id = 'd4444444-4444-4444-4444-444444444444';

insert into public.content_packs (id, name, manifest) overriding system value values (9601, '__HB_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data) values
  ('__h_brawler', 9601, 'talents', '{"name": "Brawler", "ranks": [{"name": "B1", "bonuses": [{"id": "mod_points", "val": 1}]}, {"name": "B2", "special_equipment": ["__h_fist"]}, {"name": "B3"}]}'),
  ('__h_needy', 9601, 'talents', '{"name": "Needy", "ranks": [{"name": "N1"}], "requires": [{"kind": "talent", "id": "__h_brawler", "rank": 2}]}'),
  ('__h_excl', 9601, 'talents', '{"name": "Exclusive", "ranks": [{"name": "E1", "exclusive": true, "special_equipment": ["__h_fist2"]}, {"name": "E2", "exclusive": true}]}'),
  ('__h_core', 9601, 'core_bonuses', '{"name": "Core Thing", "source": "HBT", "requires": [{"kind": "licence", "id": "__h_frame", "rank": 2}]}'),
  ('__h_mounter', 9601, 'core_bonuses', '{"name": "Mount Swap", "source": "HBT", "bonuses": [{"id": "replace_mount", "val": "Heavy"}]}'),
  ('__h_mounter2', 9601, 'core_bonuses', '{"name": "Double Swap", "source": "HBT", "bonuses": [{"id": "replace_mount", "val": "Main"}, {"id": "replace_mount", "val": "Aux/Aux"}]}'),
  ('__h_frame', 9601, 'frames', '{"name": "Testframe", "source": "HBT", "mounts": ["Main", "Flex"]}'),
  ('__h_picky', 9601, 'frames', '{"name": "Picky", "source": "HBT", "mounts": ["Main", "Main"], "requires": [{"kind": "item", "id": "__h_gun"}]}'),
  ('__h_gun', 9601, 'weapons', '{"name": "Test Gun", "mount": "Main"}'),
  ('__h_fist', 9601, 'weapons', '{"name": "Granted Fist", "mount": "Main"}'),
  ('__h_fist2', 9601, 'weapons', '{"name": "Exclusive Fist", "mount": "Main"}'),
  ('__h_sys', 9601, 'systems', '{"name": "Needs Gun", "requires": [{"kind": "item", "id": "__h_gun"}]}'),
  ('__h_kit', 9601, 'pilot_gear', '{"name": "Kit", "type": "Gear", "requires": [{"kind": "item", "id": "__h_pass"}]}'),
  ('__h_pass', 9601, 'pilot_gear', '{"name": "Pass", "type": "Gear"}'),
  ('__h_modkit', 9601, 'pilot_gear', '{"name": "Mod Kit", "type": "Gear", "bonuses": [{"id": "mod_points", "val": 2}, {"id": "mod_points", "val": 5, "condition": "never"}]}');
insert into public.bionics (id, name, mod_point_cost, requires, special_equipment) overriding system value values
  (9101, 'Heavy mod', 7, '[{"kind": "talent", "id": "__h_brawler", "rank": 1}]', '{}'),
  (9102, 'Granting bio', 0, '[]', '{__h_fist}'),
  (9103, 'Big mod', 8, '[]', '{}');

-- 300: Player A's new pilot (a draft) with one mech, Rusty. 301: Player B's approved pilot, which already has Needy
-- without Brawler II (a GM approved it), with an open draft change. 302: the GM's own pending pilot.
insert into public.characters (id, player_id, status, pilot_name, callsign, mechs) overriding system value values
  (300, 'a1111111-1111-1111-1111-111111111111', 'pending', 'Ay', 'Ayy', '[{"id": "m1", "name": "Rusty"}]'),
  (301, 'b2222222-2222-2222-2222-222222222222', 'approved', 'Bee', 'Beebee', '[]'),
  (302, 'c3333333-3333-3333-3333-333333333333', 'pending', 'GM Two', 'Gee', '[]');
insert into public.character_sheets (character_id, sheet, manna) values
  (300, '{}', 100000),
  (301, '{"talents": {"__h_needy": 1}}', 100000),
  (302, '{"talents": {"__h_needy": 1}}', 100000);
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet)
  values (301, 'b2222222-2222-2222-2222-222222222222', '{"mechs": []}', '{"talents": {"__h_needy": 1}}');


-- ---------------------------------------------------------------------
-- A new pilot (Player A)
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';

-- Requirements
select lives_ok($$ update public.character_sheets set sheet = '{"talents": {"__h_needy": 1}}' where character_id = 300 $$,
  'a draft with an unmet requirement saves');
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Needy needs Brawler II.', 'a talent needing another talent rank is refused');
update public.character_sheets set sheet = '{"talents": {"__h_needy": 1, "__h_brawler": 1}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Needy needs Brawler II.', 'a lower rank is not enough');

update public.character_sheets set sheet = '{"talents": {"__h_needy": 1.5, "__h_brawler": 1}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Needy needs Brawler II. Talent __h_needy must be a whole rank from 0 to III.',
  'a fractional rank is refused and still has its requirements checked');
update public.character_sheets set sheet = '{"talents": {"__h_brawler": "3"}, "licences": {"__h_frame": 4, "__h_nowhere": -1}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  '__h_nowhere licence must be a whole rank from 0 to III. HBT Testframe licence must be a whole rank from 0 to III. Talent __h_brawler must be a whole rank from 0 to III.',
  'text, negative and too-high talent and licence ranks are refused');

update public.character_sheets set sheet = '{"core_bonuses": ["__h_core"], "licences": {"__h_frame": 1}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Core Thing needs HBT Testframe II.', 'a core bonus needing a licence rank is refused, named by manufacturer and frame');

update public.character_sheets set sheet = '{"bionics": [9101]}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Biomods use 7 mod points, but level 0 only gives 6. Heavy mod needs Brawler I.',
  'a biomod needing a talent is refused, and so is going over the mod limit');

update public.character_sheets set sheet = '{"owned_gear": [{"key": "k1", "id": "__h_kit"}], "equipped_gear": ["k1"]}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Kit needs Pass.', 'pilot gear needing another owned item is refused');

-- Mod points
update public.character_sheets set sheet = '{"bionics": [9103], "owned_gear": [{"key": "k1", "id": "__h_modkit"}], "equipped_gear": []}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Biomods use 8 mod points, but level 0 only gives 6.', 'owned but unequipped gear gives no mod points');
update public.character_sheets set sheet = '{"bionics": [9103, 9103], "owned_gear": [{"key": "k1", "id": "__h_modkit"}], "equipped_gear": ["k1"]}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Biomods use 16 mod points, but only 8 are available.', 'equipped gear adds its unconditional mod points, a repeated biomod costs twice');

-- Mechs: requirements
update public.character_sheets set sheet = '{"mechs": {"m1": {"frame": "__h_picky"}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: The Picky frame needs Test Gun.', 'a frame needing an item on the mech is refused, with the mech''s name');
update public.character_sheets set sheet = '{"mechs": {"m1": {"frame": "__h_frame", "systems": ["__h_sys"]}}, "owned_gear": [{"key": "k1", "id": "__h_pass"}]}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Needs Gun needs Test Gun.', 'a system needing an item on the mech is refused (pilot gear doesn''t count)');

-- Mechs: granted equipment
update public.character_sheets set sheet = '{"mechs": {"m1": {"frame": "__h_frame", "mounts": [["__h_fist"]]}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Granted Fist needs Brawler II or Granting bio.', 'granted equipment without a source is refused, naming every source');
update public.character_sheets set sheet = '{"talents": {"__h_excl": 2}, "mechs": {"m1": {"frame": "__h_frame", "mounts": [["__h_fist2"]]}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Exclusive Fist needs Exclusive I.', 'a later exclusive rank replaces an earlier one''s grants');

-- Mechs: replace-mount choices
update public.character_sheets set sheet = '{"core_bonuses": ["__h_mounter"], "mechs": {"m1": {"frame": "__h_frame"}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Mount Swap needs a normal mount.', 'a replace_mount with no choice is refused');
update public.character_sheets set sheet = '{"core_bonuses": ["__h_mounter"], "mechs": {"m1": {"frame": "__h_frame", "core_mounts": {"__h_mounter": 2}}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Mount Swap needs a normal mount.', 'a mount the frame doesn''t have is refused');
update public.character_sheets set sheet = '{"core_bonuses": ["__h_mounter", "cb_integrated_weapon"], "mechs": {"m1": {"frame": "__h_frame", "core_mounts": {"__h_mounter": 2}}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Mount Swap needs a normal mount.', 'an Integrated Auxiliary mount is refused');
update public.character_sheets set sheet = '{"core_bonuses": ["__h_mounter2"], "mechs": {"m1": {"frame": "__h_frame", "core_mounts": {"__h_mounter2": 0, "__h_mounter2#1": 0.5}}}}' where character_id = 300;
select throws_ok($$ update public.characters set submitted_at = now() where id = 300 $$, 'P0001',
  'Rusty: Double Swap needs a normal mount.', 'a source''s second replace_mount has its own choice, a whole number');

-- Everything met at once
update public.character_sheets set sheet = '{
  "talents": {"__h_needy": 1, "__h_brawler": 2, "__h_excl": 1},
  "licences": {"__h_frame": 2},
  "core_bonuses": ["__h_core", "__h_mounter2"],
  "bionics": [9101, 9102],
  "owned_gear": [{"key": "k1", "id": "__h_kit"}, {"key": "k2", "id": "__h_pass"}],
  "equipped_gear": ["k1", "k2"],
  "mechs": {"m1": {"frame": "__h_picky", "mounts": [["__h_gun"]], "systems": ["__h_sys"], "core_mounts": {"__h_mounter2": 0, "__h_mounter2#1": 1}},
            "m2": {"frame": "__h_frame", "mounts": [["__h_fist"], ["__h_fist2"]], "core_mounts": {"__h_mounter2": 1, "__h_mounter2#1": 0}}}
}' where character_id = 300;
select lives_ok($$ update public.characters set submitted_at = now() where id = 300 $$,
  'a pilot meeting every requirement, with its granted items and mount choices, submits');


-- ---------------------------------------------------------------------
-- A change (Player B): what the GM approved stays
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';

select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 301 $$,
  'a change keeping an approved unmet requirement submits');
reset role;
update public.pending_changes set submitted_at = null, proposed_sheet = '{"talents": {"__h_needy": 1}, "core_bonuses": ["__h_core"]}' where character_id = 301;
set local role authenticated;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 301 $$, 'P0001',
  'Core Thing needs HBT Testframe II.', 'a new problem in a change is refused, the approved one isn''t listed');


-- ---------------------------------------------------------------------
-- GMs are never checked
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = 'c3333333-3333-3333-3333-333333333333';
select lives_ok($$ update public.characters set submitted_at = now() where id = 302 $$, 'a GM submits their own pilot with an unmet requirement');


-- ---------------------------------------------------------------------
-- sheet_rule_problems called straight from the console: huge sheets are refused
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select lives_ok($$ select public.sheet_rule_problems(jsonb_build_object('mechs',
  (select jsonb_object_agg('m' || g, '{"frame": "__h_frame"}'::jsonb) from generate_series(1, 50) g)), 0) $$, '50 mechs are checked');
select throws_ok($$ select public.sheet_rule_problems(jsonb_build_object('mechs',
  (select jsonb_object_agg('m' || g, '{"frame": "__h_frame"}'::jsonb) from generate_series(1, 51) g)), 0) $$, 'P0001',
  'Sheet too large.', '51 mechs are refused');
select throws_ok($$ select public.sheet_rule_problems(jsonb_build_object('bionics', (select jsonb_agg(g) from generate_series(1, 201) g)), 0) $$, 'P0001',
  'Sheet too large.', '201 biomods are refused');
select throws_ok($$ select public.sheet_rule_problems(jsonb_build_object('owned_gear',
  (select jsonb_agg(jsonb_build_object('key', 'k' || g, 'id', '__h_pass')) from generate_series(1, 501) g)), 0) $$, 'P0001',
  'Sheet too large.', '501 owned pilot gear entries are refused');


-- ---------------------------------------------------------------------
-- save_bionic: the new fields, owners only
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select throws_ok($$ select public.save_bionic('Sneaky', '', '', '', 0, 0, false, '[]', null, null, null,
  '[{"id": "mod_points", "val": 99}]') $$, 'P0001', 'Only owners can change biomods.', 'a player can''t save a biomod');

set local request.jwt.claim.sub = 'd4444444-4444-4444-4444-444444444444';
select lives_ok($$ select public.save_bionic('Wired', '', 'Arm', '', 10, 1, false, '[]', null, null, 'HBT',
  '[{"id": "mod_points", "val": 1}]', '{__h_gun}', '{__h_fist}', true, '[{"kind": "talent", "id": "__h_brawler", "rank": 1}]') $$,
  'an owner saves a biomod with the new fields');
select results_eq($$ select effect_bonuses, integrated, special_equipment, replace_integrated, requires from public.bionics where name = 'Wired' $$,
  $$ values ('[{"id": "mod_points", "val": 1}]'::jsonb, '{__h_gun}'::text[], '{__h_fist}'::text[], true, '[{"kind": "talent", "id": "__h_brawler", "rank": 1}]'::jsonb) $$,
  'and they are stored');
select throws_ok($$ select public.save_bionic('Bad', '', '', '', 0, 0, false, '[]', null, null, null, '{"id": "x"}') $$, 'P0001',
  'The effect bonuses must be a list of bonuses.', 'effect bonuses must be a list');
select throws_ok($$ select public.save_bionic('Bad', '', '', '', 0, 0, false, '[]', null, null, null, '[]', '{}', '{}', false, '["x"]') $$, 'P0001',
  'The requirements must be a list.', 'requirements must be a list of entries');

select * from finish();
rollback;
