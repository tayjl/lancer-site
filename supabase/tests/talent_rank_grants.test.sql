-- Free talent ranks from biomods, taken core bonuses and equipped pilot gear (migration 20261126100000_talent_rank_grants.sql).
-- A {"id": "talent_rank", "talent": ..., "val": n} effect adds n ranks of a published talent: no manna, gone with the source,
-- several sources add up, and a total past the highest rank is reported. Run with: supabase test db
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'ra@test.local', '{"full_name": "Player A"}'),
  ('b2222222-2222-2222-2222-222222222222', 'rb@test.local', '{"full_name": "Player B"}'),
  ('d4444444-4444-4444-4444-444444444444', 'rd@test.local', '{"full_name": "Player D"}'),
  ('e5555555-5555-5555-5555-555555555555', 're@test.local', '{"full_name": "Player E"}');

-- Rtal: rank 1 unlocks Locked Sys. Rmp: rank 1 gives 3 mod points. Rgate: needs the Rframe licence at III.
-- Gated Sys needs Rtal I, Gated Sys 2 needs Rtal II. Rdraft is a draft talent.
insert into public.content_packs (id, name, manifest) overriding system value values (9901, '__RANK_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data) values
  ('__r_frame', 9901, 'frames', '{"name": "Rframe", "source": "GMT", "mounts": ["Main"]}'),
  ('__r_tal', 9901, 'talents', '{"name": "Rtal", "ranks": [{"name": "One", "special_equipment": ["__r_lock"]}, {"name": "Two"}, {"name": "Three"}]}'),
  ('__r_mp', 9901, 'talents', '{"name": "Rmp", "ranks": [{"name": "One", "bonuses": [{"id": "mod_points", "val": 3}]}]}'),
  ('__r_gate', 9901, 'talents', '{"name": "Rgate", "ranks": [{"name": "One"}], "requires": [{"kind": "licence", "id": "__r_frame", "rank": 3}]}'),
  ('__r_lock', 9901, 'systems', '{"name": "Locked Sys", "talent_item": false}'),
  ('__r_need1', 9901, 'systems', '{"name": "Gated Sys", "requires": [{"kind": "talent", "id": "__r_tal", "rank": 1}]}'),
  ('__r_need2', 9901, 'systems', '{"name": "Gated Sys 2", "requires": [{"kind": "talent", "id": "__r_tal", "rank": 2}]}'),
  ('__r_cb', 9901, 'core_bonuses', '{"name": "Rank Core", "bonuses": [{"id": "talent_rank", "talent": "__r_tal", "val": 1}]}'),
  ('__r_kit', 9901, 'pilot_gear', '{"name": "Rank Kit", "type": "Gear", "bonuses": [{"id": "talent_rank", "talent": "__r_tal", "val": 1}]}'),
  ('__r_kit2', 9901, 'pilot_gear', '{"name": "Rank Kit 2", "type": "Gear", "bonuses": [{"id": "talent_rank", "talent": "__r_tal", "val": 2}]}'),
  ('__r_self', 9901, 'pilot_gear', '{"name": "Self Kit", "type": "Gear", "requires": [{"kind": "talent", "id": "__r_tal", "rank": 2}],
    "bonuses": [{"id": "talent_rank", "talent": "__r_tal", "val": 1}]}'),
  ('__r_cond', 9901, 'pilot_gear', '{"name": "Cond Kit", "type": "Gear", "bonuses": [{"id": "talent_rank", "talent": "__r_tal", "val": 1, "condition": "only at night"}]}'),
  ('__r_str', 9901, 'pilot_gear', '{"name": "String Kit", "type": "Gear", "bonuses": [{"id": "talent_rank", "talent": "__r_tal", "val": "1"}]}'),
  ('__r_dr', 9901, 'pilot_gear', '{"name": "Draft Talent Kit", "type": "Gear", "bonuses": [{"id": "talent_rank", "talent": "__r_draft", "val": 1}]}'),
  ('__r_unk', 9901, 'pilot_gear', '{"name": "Unknown Talent Kit", "type": "Gear", "bonuses": [{"id": "talent_rank", "talent": "__r_nope", "val": 1}]}'),
  ('__r_mpkit', 9901, 'pilot_gear', '{"name": "Mp Kit", "type": "Gear", "bonuses": [{"id": "talent_rank", "talent": "__r_mp", "val": 1}]}');
insert into public.content_items (id, pack_id, kind, data, draft) values
  ('__r_draft', 9901, 'talents', '{"name": "Rdraft", "ranks": [{"name": "One"}]}', true);
-- Biomods: a free rank of Rtal, of Rtal twice over, of Rgate, of Rmp (cost 7 mod points), and a plain 7 point one.
insert into public.bionics (id, name, manna_cost, mod_point_cost, effect_bonuses) overriding system value values
  (9901, 'Rank Implant', 0, 0, '[{"id": "talent_rank", "talent": "__r_tal", "val": 1}]'),
  (9902, 'Double Implant', 0, 0, '[{"id": "talent_rank", "talent": "__r_tal", "val": 2}]'),
  (9903, 'Gate Implant', 0, 0, '[{"id": "talent_rank", "talent": "__r_gate", "val": 1}]'),
  (9904, 'Mp Implant', 0, 7, '[{"id": "talent_rank", "talent": "__r_mp", "val": 1}]'),
  (9905, 'Plain Implant', 0, 7, '[]'),
  (9906, 'Wide Implant', 0, 0, '[{"id": "talent_rank", "talent": "__r_tal", "val": 4}]');

-- All problems of a sheet, as a sorted list. Gear is owned and equipped by the same keys (k1, k2).
create function pg_temp.probs(sheet jsonb, lvl integer default 0) returns text[]
  language sql as $$
  select coalesce(array_agg(problem order by problem), '{}') from public.sheet_rule_problems(sheet, lvl) $$;
grant execute on function pg_temp.probs(jsonb, integer) to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';

-- Biomod
select is(pg_temp.probs('{"mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'),
  array['Gated Sys needs Rtal I.'], 'without a source the system''s talent requirement is reported');
select is(pg_temp.probs('{"bionics": [9901], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'), '{}',
  'a biomod''s free rank satisfies a mech system''s requirement, with no bought rank');
select is(pg_temp.probs('{"bionics": [], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'),
  array['Gated Sys needs Rtal I.'], 'after the biomod is removed the requirement problem returns');
select is(pg_temp.probs('{"bionics": [9901], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need2"]}}}'),
  array['Gated Sys 2 needs Rtal II.'], 'one free rank is rank I, not II');
select is(pg_temp.probs('{"talents": {"__r_tal": 1}, "bionics": [9901], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need2"]}}}'), '{}',
  'bought I plus free I meets a requirement for II');
select is(pg_temp.probs('{"talents": {"__r_tal": 1}, "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need2"]}}}'),
  array['Gated Sys 2 needs Rtal II.'], 'and bought I alone does not');
select is(pg_temp.probs('{"bionics": [9901], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_lock"]}}}'), '{}',
  'a free rank''s special_equipment unlocks the item');
select is(pg_temp.probs('{"mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_lock"]}}}'),
  array['Locked Sys needs Rtal I.'], 'and it stays locked without the free rank');
select is(pg_temp.probs('{"bionics": [9904], "mechs": {}}'), '{}', 'a free rank''s mod_points bonus counts: one 7-point biomod fits in 6 + 3');
select is(pg_temp.probs('{"bionics": [9905], "mechs": {}}'),
  array['Biomods use 7 mod points, but level 0 only gives 6.'], 'while a plain biomod of the same cost does not fit');
select is(pg_temp.probs('{"bionics": [9904, 9904], "mechs": {}}'),
  array['Biomods use 14 mod points, but only 9 are available.'], 'a biomod installed twice costs twice but its effects count once, as for every effect');

-- Core bonuses
select is(pg_temp.probs('{"core_bonuses": ["__r_cb"], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'), '{}',
  'a taken core bonus gives a free rank');
select is(pg_temp.probs('{"core_bonuses": [], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'),
  array['Gated Sys needs Rtal I.'], 'an untaken core bonus gives nothing');

-- Pilot gear
select is(pg_temp.probs('{"owned_gear": [{"key": "k1", "id": "__r_kit"}], "equipped_gear": ["k1"], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'), '{}',
  'equipped gear gives a free rank');
select is(pg_temp.probs('{"owned_gear": [{"key": "k1", "id": "__r_kit"}], "equipped_gear": [], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'),
  array['Gated Sys needs Rtal I.'], 'owned but unequipped gear gives nothing');
select is(pg_temp.probs('{"owned_gear": [{"key": "k1", "id": "__r_kit"}], "equipped_gear": ["nope"], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'),
  array['Gated Sys needs Rtal I.'], 'an equipped key that isn''t owned gives nothing');
select is(pg_temp.probs('{"owned_gear": [{"key": "k1", "id": "__r_cond"}], "equipped_gear": ["k1"], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'),
  array['Gated Sys needs Rtal I.'], 'a grant with a condition gives nothing');
select is(pg_temp.probs('{"owned_gear": [{"key": "k1", "id": "__r_str"}], "equipped_gear": ["k1"], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'),
  array['Gated Sys needs Rtal I.'], 'a grant with a text value gives nothing');
select is(pg_temp.probs('{"owned_gear": [{"key": "k1", "id": "__r_dr"}], "equipped_gear": ["k1"], "talents": {}, "mechs": {}}'), '{}',
  'a grant of a draft or unknown talent gives nothing and raises no error');
select is(pg_temp.probs('{"owned_gear": [{"key": "k1", "id": "__r_unk"}], "equipped_gear": ["k1"], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need1"]}}}'),
  array['Gated Sys needs Rtal I.'], 'an unknown talent grant leaves other talents alone');

-- Several sources add up
select is(pg_temp.probs('{"bionics": [9901], "core_bonuses": ["__r_cb"], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need2"]}}}'), '{}',
  'a biomod and a core bonus add up to rank II');
select is(pg_temp.probs('{"bionics": [9901, 9901], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need2"]}}}'),
  array['Gated Sys 2 needs Rtal II.'], 'a biomod installed twice gives its rank once');
select is(pg_temp.probs('{"bionics": [9902], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_need2"]}}}'), '{}',
  'one biomod with val 2 gives two ranks');
select is(pg_temp.probs('{"bionics": [9901], "owned_gear": [{"key": "k1", "id": "__r_kit"}], "equipped_gear": ["k1"], "core_bonuses": ["__r_cb"]}'),
  '{}', 'three sources make rank III, the highest, with no problem');

-- A source can't satisfy its own requirement; it reads the bought ranks
select is(pg_temp.probs('{"talents": {"__r_tal": 1}, "owned_gear": [{"key": "k1", "id": "__r_self"}], "equipped_gear": ["k1"]}'),
  array['Self Kit needs Rtal II.'], 'gear that needs Rtal II and gives Rtal I is not met by bought I');
select is(pg_temp.probs('{"talents": {"__r_tal": 2}, "owned_gear": [{"key": "k1", "id": "__r_self"}], "equipped_gear": ["k1"]}'), '{}',
  'but bought II meets it');
select is(pg_temp.probs('{"talents": {"__r_tal": 1}, "bionics": [9901], "owned_gear": [{"key": "k1", "id": "__r_self"}]}'),
  array['Self Kit needs Rtal II.'], 'owned gear reads the bought ranks even when a biomod gives another');

-- A free-only talent skips its own requirements; a bought one is checked against the total
select is(pg_temp.probs('{"bionics": [9903]}'), '{}', 'a talent held only through a free rank skips its own requirements');
select is(pg_temp.probs('{"talents": {"__r_gate": 1}}'), array['Rgate needs GMT Rframe III.'], 'a bought rank of it is checked');
select is(pg_temp.probs('{"talents": {"__r_gate": 1}, "bionics": [9903]}'), array['Rgate needs GMT Rframe III.'], 'also with a free rank on top, and reported once');

-- The cap
select is(pg_temp.probs('{"talents": {"__r_tal": 3}, "bionics": [9901]}'),
  array['Rtal is rank IV with free ranks, but the highest is III.'], 'bought III plus a free rank is reported with the client''s sentence');
select is(pg_temp.probs('{"talents": {"__r_tal": 2}, "bionics": [9901]}'), '{}', 'bought II plus a free rank is rank III, fine');
select is(pg_temp.probs('{"bionics": [9906]}'),
  array['Rtal is rank IV with free ranks, but the highest is III.'], 'a free-only talent over the highest rank is reported too');
select is(pg_temp.probs('{"talents": {"__r_tal": 3}, "bionics": [9902]}'),
  array['Rtal is rank V with free ranks, but the highest is III.'], 'two free ranks make rank V');
select is(pg_temp.probs('{"talents": {"__r_tal": 4}, "bionics": [9901]}'),
  array['Talent __r_tal must be a whole rank from 0 to III.'], 'a bought rank out of range gets only its own message');
select is(pg_temp.probs('{"talents": {"__r_tal": "2"}, "bionics": [9901]}'),
  array['Talent __r_tal must be a whole rank from 0 to III.'], 'so does a text rank');
select is(pg_temp.probs('{"talents": {"__r_tal": 3}, "bionics": [9901], "mechs": {"m1": {"frame": "__r_frame", "mounts": [[]], "systems": ["__r_lock"]}}}'),
  array['Rtal is rank IV with free ranks, but the highest is III.'], 'effects stop at III but still unlock what the talent gives');
reset role;

-- The server: a player's change that adds the source
insert into public.characters (id, player_id, status, pilot_name, callsign, approved_at) overriding system value values
  (401, 'a1111111-1111-1111-1111-111111111111', 'approved', 'Cee', 'Cee', '2000-01-01'),
  (402, 'b2222222-2222-2222-2222-222222222222', 'approved', 'Dee', 'Dee', '2000-01-01'),
  (403, 'd4444444-4444-4444-4444-444444444444', 'pending', 'Eee', 'Eee', null),
  (404, 'e5555555-5555-5555-5555-555555555555', 'pending', 'Eff', 'Eff', null);
insert into public.character_sheets (character_id, sheet, manna) values
  (401, '{"talents": {"__r_tal": 3}}', 100000),
  (402, '{"talents": {"__r_tal": 2}}', 100000),
  (403, '{}', 0),
  (404, '{}', 0);
update public.character_sheets set manna = 2 * public.rule_number('talent_rank_price') where character_id in (403, 404);

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet) values
  (401, 'a1111111-1111-1111-1111-111111111111', '{"pilot_name": "Cee", "callsign": "Cee", "mechs": []}', '{"talents": {"__r_tal": 3}, "bionics": [9901]}');
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 401 and status = 'pending' $$, 'P0001',
  'Rtal is rank IV with free ranks, but the highest is III.', 'a change that adds a source over the highest rank is refused');

set local request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet) values
  (402, 'b2222222-2222-2222-2222-222222222222', '{"pilot_name": "Dee", "callsign": "Dee", "mechs": []}', '{"talents": {"__r_tal": 2}, "bionics": [9901]}');
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 402 and status = 'pending' $$,
  'the same source on bought II is accepted, with no manna charged for the free rank');

-- Free ranks add no manna: exactly enough for the two bought ranks, plus a free one
set local request.jwt.claim.sub = 'd4444444-4444-4444-4444-444444444444';
update public.character_sheets set sheet = '{"talents": {"__r_tal": 2}, "bionics": [9901]}' where character_id = 403;
select lives_ok($$ update public.characters set submitted_at = now() where id = 403 $$,
  'a pilot with exactly enough manna for the bought ranks submits with a free rank on top');
-- The same manna does not cover a third bought rank
set local request.jwt.claim.sub = 'e5555555-5555-5555-5555-555555555555';
update public.character_sheets set sheet = '{"talents": {"__r_tal": 3}}' where character_id = 404;
select throws_like($$ update public.characters set submitted_at = now() where id = 404 $$, 'This spends % manna, but only % was received.',
  'while a third bought rank is charged');

select * from finish();
rollback;
