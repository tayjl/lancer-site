-- Weapons on mounts the frame doesn't have, ASCII-only digits, and the private schema lock-down (migration
-- 20261125220000_server_mount_checks_and_hardening.sql). Run with: supabase test db
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'mp@test.local', '{"full_name": "Player A"}'),
  ('c3333333-3333-3333-3333-333333333333', 'mgm@test.local', '{"full_name": "Game Master"}');
update public.profiles set role = 'gm' where id = 'c3333333-3333-3333-3333-333333333333';

-- Two mounts (Main, Flex). The giver weapon unlocks the system, as does the mod. A core bonus carries a mod points bonus
-- written with Arabic-Indic digits.
insert into public.content_packs (id, name, manifest) overriding system value values (9801, '__MOUNT_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data) values
  ('__t_frame', 9801, 'frames', '{"name": "Tframe", "source": "GMT", "mounts": ["Main", "Flex"]}'),
  ('__t_small', 9801, 'frames', '{"name": "Tsmall", "source": "GMT", "mounts": ["Main"]}'),
  ('__t_main', 9801, 'weapons', '{"name": "Main Gun", "mount": "Main"}'),
  ('__t_aux', 9801, 'weapons', '{"name": "Aux Gun", "mount": "Auxiliary"}'),
  ('__t_giver', 9801, 'weapons', '{"name": "Giver Gun", "mount": "Auxiliary", "special_equipment": ["__t_sys"]}'),
  ('__t_sys', 9801, 'systems', '{"name": "Locked System", "talent_item": false}'),
  ('__t_mod', 9801, 'mods', '{"name": "Giver Mod", "special_equipment": ["__t_sys"]}'),
  ('__t_cb', 9801, 'core_bonuses', '{"name": "Odd Digits", "bonuses": [{"id": "mod_points", "val": "١٢"}]}'),
  ('__t_cb1', 9801, 'core_bonuses', '{"name": "Plain Digits", "bonuses": [{"id": "mod_points", "val": "1"}]}');
insert into public.bionics (id, name, manna_cost, mod_point_cost) overriding system value values (9801, 'Heavy Mod', 0, 7);

-- Problems of one mech on the frame, as a sorted list.
create function pg_temp.problems(mech jsonb, extra jsonb default '{}', lvl integer default 0) returns text[]
  language sql as $$
  select coalesce(array_agg(problem order by problem), '{}')
  from public.sheet_rule_problems(extra || jsonb_build_object('mechs', jsonb_build_object('m1', mech)), lvl) $$;

grant execute on function pg_temp.problems(jsonb, jsonb, integer) to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';

-- Valid builds stay clean: every place of Main and Flex, a Flex holding two Auxiliary weapons, a mod on a real weapon.
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main"], ["__t_aux", "__t_aux"]]}'), '{}', 'a full valid build has no problems');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [[], []]}'), '{}', 'an empty build has no problems');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main"]], "systems": ["__t_sys"], "weapon_mods": {"0:0": "__t_mod"}}'), '{}',
  'a mod on a real place still grants');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [[null, ""], ["__t_aux"]]}'), '{}', 'null and empty places are not weapons');
-- Integrated mount, Improved Armament ("flex" in lancer-data) and Mount Retrofitting.
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main"], [], ["__t_aux"]]}', '{"core_bonuses": ["cb_integrated_weapon"]}'), '{}',
  'a weapon on the integrated mount is fine');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [[], [], ["__t_aux", "__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament"]}'), '{}',
  'Improved Armament adds a Flex mount that holds two weapons');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main", "__t_aux"]], "core_mounts": {"cb_mount_retrofitting": 0}}', '{"core_bonuses": ["cb_mount_retrofitting"]}'), '{}',
  'Mount Retrofitting makes the first mount Main/Aux with two places');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main"], [], ["__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament"]}'), '{}',
  'the Flex mount from Improved Armament is a place for a weapon');

-- Phantom places.
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main"], ["__t_aux"], ["__t_aux"]]}'),
  array['Some weapons are on mounts the frame doesn''t have.'], 'a weapon on a mount past the last one is reported');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main"], ["__t_aux"], ["__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament"]}'), '{}',
  'but not once the frame has that mount');
select is(pg_temp.problems('{"frame": "__t_small", "mounts": [["__t_main"], ["__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament"]}'), '{}',
  'a second mount from Improved Armament (read in lower case) is a place');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main", "__t_aux"], []]}'),
  array['Some weapons are in slots the mount doesn''t have.'], 'a second weapon on a one-place mount is reported');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [[], ["__t_aux", "__t_aux", "__t_aux"]]}'),
  array['Some weapons are in slots the mount doesn''t have.'], 'a third weapon on a two-place mount is reported');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [[], [], [], ["__t_aux"]]}', '{"core_bonuses": ["cb_integrated_weapon"]}'),
  array['Some weapons are on mounts the frame doesn''t have.'], 'one past the integrated mount is reported');

-- A phantom weapon grants nothing and satisfies nothing.
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [[], [], ["__t_giver"]], "systems": ["__t_sys"]}'),
  array['Locked System needs Giver Gun or Giver Mod.', 'Some weapons are on mounts the frame doesn''t have.'], 'a weapon on a phantom mount grants nothing');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main"], ["__t_giver"]], "systems": ["__t_sys"]}'), '{}',
  'the same weapon on a real mount grants');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main", "__t_giver"], []], "systems": ["__t_sys"]}'),
  array['Locked System needs Giver Gun or Giver Mod.', 'Some weapons are in slots the mount doesn''t have.'], 'a weapon on a phantom place of a real mount grants nothing');

-- A mod on a phantom place grants nothing.
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main"], [], ["__t_aux"]], "systems": ["__t_sys"], "weapon_mods": {"2:0": "__t_mod"}}'),
  array['Locked System needs Giver Gun or Giver Mod.', 'Some weapons are on mounts the frame doesn''t have.'], 'a mod on a phantom mount grants nothing');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main", "__t_aux"], []], "systems": ["__t_sys"], "weapon_mods": {"0:1": "__t_mod"}}'),
  array['Locked System needs Giver Gun or Giver Mod.', 'Some weapons are in slots the mount doesn''t have.'], 'a mod on a phantom place of a real mount grants nothing');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [["__t_main"]], "systems": ["__t_sys"], "weapon_mods": {"5:0": "__t_mod"}}'),
  array['Locked System needs Giver Gun or Giver Mod.'], 'a mod on a place no weapon sits in grants nothing');

-- ASCII digits only: Arabic-Indic digits in a bonus value are ignored, not a raw cast error.
select lives_ok($$ select pg_temp.problems('{"frame": "__t_frame"}', '{"core_bonuses": ["__t_cb"]}') $$, 'a non-ASCII digit value does not raise');
select is(pg_temp.problems('{"frame": "__t_frame"}', '{"core_bonuses": ["__t_cb"], "bionics": [9801]}'),
  array['Biomods use 7 mod points, but level 0 only gives 6.'], 'and counts as no bonus');
select is(pg_temp.problems('{"frame": "__t_frame"}', '{"core_bonuses": ["__t_cb1"], "bionics": [9801]}'), '{}', 'while an ASCII digit value still counts');

-- Improved Armament by id: one Flex when the frame has fewer than three mounts, whatever the core bonus data holds. The hosted
-- row has no bonuses; the local seed has an add_mount of flex (max 3), which must not add a second one.
reset role;
create function pg_temp.improved(shape text) returns void language sql as $$
  update public.content_items set data = case when shape = 'hosted' then '{"name": "Improved Armament"}'::jsonb
    else '{"name": "Improved Armament", "bonuses": [{"id": "add_mount", "val": "flex", "max": 3}]}'::jsonb end
  where id = 'cb_improved_armament' and kind = 'core_bonuses' $$;
select pg_temp.improved('hosted');
set local role authenticated;
select is((select count(*) from public.content_items where id = 'cb_improved_armament' and data ? 'bonuses'), 0::bigint, 'the test core bonus has no bonuses (hosted shape)');
select is(pg_temp.problems('{"frame": "__t_small", "mounts": [[], ["__t_aux", "__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament"]}'), '{}',
  'hosted shape: a one-mount frame gets one Flex that holds two weapons');
select is(pg_temp.problems('{"frame": "__t_small", "mounts": [[], [], ["__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament"]}'),
  array['Some weapons are on mounts the frame doesn''t have.'], 'hosted shape: a weapon past the added Flex is reported');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [[], [], ["__t_aux", "__t_aux"], ["__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament"]}'),
  array['Some weapons are on mounts the frame doesn''t have.'], 'hosted shape: a two-mount frame gets one Flex, not two');
reset role;
select pg_temp.improved('seed');
set local role authenticated;
select is((select count(*) from public.content_items where id = 'cb_improved_armament' and data -> 'bonuses' @> '[{"id": "add_mount"}]'), 1::bigint, 'the test core bonus has an add_mount (seed shape)');
select is(pg_temp.problems('{"frame": "__t_small", "mounts": [[], ["__t_aux", "__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament"]}'), '{}',
  'seed shape: a one-mount frame gets one Flex that holds two weapons');
select is(pg_temp.problems('{"frame": "__t_small", "mounts": [[], [], ["__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament"]}'),
  array['Some weapons are on mounts the frame doesn''t have.'], 'seed shape: its add_mount is ignored, so a weapon past the Flex is reported');
select is(pg_temp.problems('{"frame": "__t_frame", "mounts": [[], [], ["__t_aux", "__t_aux"], ["__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament"]}'),
  array['Some weapons are on mounts the frame doesn''t have.'], 'seed shape: a two-mount frame still gets only one Flex');
select is(pg_temp.problems('{"frame": "__t_small", "mounts": [[], [], ["__t_aux"]]}', '{"core_bonuses": ["cb_improved_armament", "cb_integrated_weapon"]}'), '{}',
  'the integrated mount comes after the Flex');

-- Private schema: no direct execute for anon, public or the logged-in roles; sessions still get what policies need.
select is((select count(*) from pg_proc where pronamespace = 'private'::regnamespace and has_function_privilege('anon', oid, 'execute')), 0::bigint,
  'anon can execute no private function');
select is((select count(*) from pg_proc p where pronamespace = 'private'::regnamespace
  and exists (select 1 from aclexplode(coalesce(proacl, acldefault('f', proowner))) a where a.grantee = 0)), 0::bigint, 'public can execute no private function');
select is((select count(*) from pg_proc where pronamespace = 'private'::regnamespace and has_function_privilege('authenticated', oid, 'execute')), 0::bigint,
  'a logged-in session cannot call a private function directly either');
select throws_ok($$ select private.roman(4) $$, '42501', null, 'calling a private function as a player is refused');
select is(has_function_privilege('anon', 'public.game_definitions_freeze_id()', 'execute'), false, 'anon cannot execute the freeze-id trigger function');
select is(has_function_privilege('authenticated', 'public.game_definitions_freeze_id()', 'execute'), false, 'nor can a logged-in session');
select is((select array_agg(c order by c) from pg_proc, unnest(proconfig) c where proname in ('add_exotic_tag', 'backfill_exotic_tag') and pronamespace = 'private'::regnamespace),
  array['search_path=""', 'search_path=""'], 'both exotic-tag helpers have a fixed search_path');

-- Triggers and definers that use private code still run for a player and a GM.
reset role;
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (350, 'a1111111-1111-1111-1111-111111111111', 'pending', 'Tee', 'Tee');
insert into public.character_sheets (character_id, sheet, manna) values (350, '{}', 100000);
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select lives_ok($$ update public.character_sheets set sheet = '{"mechs": {}}' where character_id = 350 $$, 'a player edits a pending sheet (triggers run)');
select lives_ok($$ update public.characters set submitted_at = now() where id = 350 $$, 'a player submits (rule check trigger runs)');
set local request.jwt.claim.sub = 'c3333333-3333-3333-3333-333333333333';
select lives_ok($$ select public.approve_pilot(350, now(), 'ok') $$, 'a GM approves (the definer function calls a private one)');
select is((select status::text from public.characters where id = 350), 'approved', 'the pilot is approved');
reset role;
set local role anon;
select throws_ok($$ select private.roman(4) $$, '42501', null, 'anon calling a private function is refused');
reset role;
-- Default grants are the same everywhere: a new public function keeps execute for the API roles (the global revoke from
-- public alone would leave none on hosted), a new private one has none for anon and authenticated.
create function public.zz_probe() returns integer language sql as 'select 1';
select is((select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) r where has_function_privilege(r, 'public.zz_probe()', 'execute')),
  array['anon', 'authenticated', 'service_role'], 'a new public function is executable by anon, authenticated and service_role');
select is((select count(*) from aclexplode((select proacl from pg_proc where oid = 'public.zz_probe()'::regprocedure)) a where a.grantee = 0), 0::bigint,
  'but not by public');
select is(has_function_privilege('anon', 'public.guard_gm_only_sheet_fields()', 'execute') or has_function_privilege('authenticated', 'public.guard_gm_only_sheet_fields()', 'execute'),
  false, 'the sheet guard trigger function cannot be called by anon or logged-in roles');
select is(has_function_privilege('anon', 'public.lore_entries_keep_author()', 'execute') or has_function_privilege('authenticated', 'public.lore_entries_keep_author()', 'execute'),
  false, 'nor the lore author trigger function');
-- A new private function starts closed.
create function private.zz_probe() returns integer language sql as 'select 1';
select is(has_function_privilege('anon', 'private.zz_probe()', 'execute') or has_function_privilege('authenticated', 'private.zz_probe()', 'execute'), false,
  'a new private function is not executable by anon or logged-in roles');

select * from finish();
rollback;
