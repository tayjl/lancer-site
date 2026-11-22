-- Editable game numbers (migration 20261122120000_editable_rule_numbers.sql): rows 'rule_num_<key>' of kind 'rules' set
-- prices and limits. Defaults are unchanged without a row, an owner's edit changes what a submit is charged, nonsense falls
-- back, players and GMs can't change the rows, and work submitted before an edit can't be approved. Run with: supabase test db
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'rna@test.local', '{"full_name": "Player A"}'),
  ('c3333333-3333-3333-3333-333333333333', 'rngm@test.local', '{"full_name": "Game Master"}'),
  ('d4444444-4444-4444-4444-444444444444', 'rnow@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'gm' where id = 'c3333333-3333-3333-3333-333333333333';
update public.profiles set role = 'owner' where id = 'd4444444-4444-4444-4444-444444444444';

insert into public.content_packs (id, name, manifest) overriding system value values (9801, '__RN_PACK', '{}');
insert into public.bionics (id, name, mod_point_cost, manna_cost) overriding system value values (9811, 'Heavy mod', 7, 0);

-- 700: Player A's draft pilot with 1500 manna and three licence ranks (1,800 at the default 600).
insert into public.characters (id, player_id, status, pilot_name, callsign, mechs) overriding system value values
  (700, 'a1111111-1111-1111-1111-111111111111', 'pending', 'Ay', 'Ayy', '[]');
insert into public.character_sheets (character_id, sheet, manna) values (700, '{"licences": {"__rn_l": 3}}', 1500);

-- ---------------------------------------------------------------------
-- No rows: the old numbers
-- ---------------------------------------------------------------------
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 600::numeric, 'no row gives the fallback');

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select throws_ok($$ update public.characters set submitted_at = now() where id = 700 $$, 'P0001',
  'This spends 1,800 manna, but only 1,500 was received.', 'default: 3 licence ranks cost 600 each');
update public.character_sheets set sheet = '{"talents": {"__rn_t": 4}}' where character_id = 700;
select throws_ok($$ update public.characters set submitted_at = now() where id = 700 $$, 'P0001',
  'Talent __rn_t must be a whole rank from 0 to III.', 'default: the top rank is III');
update public.character_sheets set sheet = '{"bionics": [9811]}' where character_id = 700;
select throws_ok($$ update public.characters set submitted_at = now() where id = 700 $$, 'P0001',
  'Biomods use 7 mod points, but level 0 only gives 6.', 'default: 6 mod points at level 0');

-- ---------------------------------------------------------------------
-- Owners edit the numbers; players and GMs can't
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'd4444444-4444-4444-4444-444444444444';
select lives_ok($$ insert into public.content_items (id, pack_id, kind, data) values
  ('rule_num_licence_rank_price', 9801, 'rules', '{"id": "rule_num_licence_rank_price", "name": "Licence rank price", "section": "numbers", "numbers": [600]}'),
  ('rule_num_max_talent_rank', 9801, 'rules', '{"id": "rule_num_max_talent_rank", "name": "Top talent rank", "section": "numbers", "numbers": [3]}'),
  ('rule_num_mod_points_base', 9801, 'rules', '{"id": "rule_num_mod_points_base", "name": "Mod points", "section": "numbers", "numbers": [6]}') $$,
  'an owner adds the rows');
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 600::numeric, 'a row holding the default changes nothing');

set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select is((select count(*) from public.content_items where kind = 'rules'), 3::bigint, 'a player can read the rows');
select throws_ok($$ insert into public.content_items (id, pack_id, kind, data) values
  ('rule_num_starting_manna', 9801, 'rules', '{"numbers": [99999]}') $$, '42501', null, 'a player cannot add a row');
update public.content_items set edited = '{"id": "rule_num_licence_rank_price", "name": "x", "numbers": [0]}' where id = 'rule_num_licence_rank_price';
update public.content_items set data = '{"numbers": [0]}' where id = 'rule_num_licence_rank_price';
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 600::numeric, 'a player cannot change a row');

set local request.jwt.claim.sub = 'c3333333-3333-3333-3333-333333333333';
update public.content_items set edited = '{"id": "rule_num_licence_rank_price", "name": "x", "numbers": [0]}' where id = 'rule_num_licence_rank_price';
update public.content_items set data = '{"numbers": [0]}' where id = 'rule_num_licence_rank_price';
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 600::numeric, 'a GM cannot change a row');
select throws_ok($$ insert into public.content_items (id, pack_id, kind, data) values
  ('rule_num_starting_manna', 9801, 'rules', '{"numbers": [99999]}') $$, '42501', null, 'a GM cannot add a row');

-- ---------------------------------------------------------------------
-- Nonsense falls back
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = 'd4444444-4444-4444-4444-444444444444';
update public.content_items set edited = '{"id": "rule_num_licence_rank_price", "name": "x", "numbers": [-5]}' where id = 'rule_num_licence_rank_price';
select is((select edited -> 'numbers' ->> 0 from public.content_items where id = 'rule_num_licence_rank_price'), '-5', 'the owner can edit');
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 600::numeric, 'negative falls back');
update public.content_items set edited = '{"id": "rule_num_licence_rank_price", "name": "x", "numbers": ["400"]}' where id = 'rule_num_licence_rank_price';
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 600::numeric, 'text falls back');
update public.content_items set edited = '{"id": "rule_num_licence_rank_price", "name": "x", "numbers": [1000000000]}' where id = 'rule_num_licence_rank_price';
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 600::numeric, 'huge falls back');
update public.content_items set edited = '{"id": "rule_num_licence_rank_price", "name": "x", "numbers": [12.5]}' where id = 'rule_num_licence_rank_price';
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 600::numeric, 'a fraction falls back');
update public.content_items set edited = '{"id": "rule_num_licence_rank_price", "name": "x", "numbers": []}' where id = 'rule_num_licence_rank_price';
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 600::numeric, 'an empty list falls back');
update public.content_items set edited = '{"id": "rule_num_licence_rank_price", "name": "x"}' where id = 'rule_num_licence_rank_price';
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 600::numeric, 'a missing list falls back');

-- ---------------------------------------------------------------------
-- A valid edit changes what a submit costs
-- ---------------------------------------------------------------------
update public.content_items set edited = '{"id": "rule_num_licence_rank_price", "name": "x", "numbers": [400]}' where id = 'rule_num_licence_rank_price';
select is(public.rule_number('licence_rank_price', 600, 0, 10000), 400::numeric, 'a valid edit is used');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
update public.character_sheets set sheet = '{"licences": {"__rn_l": 3}}' where character_id = 700;
select lives_ok($$ update public.characters set submitted_at = now() where id = 700 $$, 'at 400 a rank, 3 ranks (1,200) fit in 1,500');
reset role;
update public.characters set submitted_at = null where id = 700;
update public.content_items set edited = '{"id": "rule_num_licence_rank_price", "name": "x", "numbers": [600]}' where id = 'rule_num_licence_rank_price';
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select throws_ok($$ update public.characters set submitted_at = now() where id = 700 $$, 'P0001',
  'This spends 1,800 manna, but only 1,500 was received.', 'back at 600 the same sheet is refused again');

-- Rank limit and mod point base
reset role;
update public.content_items set edited = '{"id": "rule_num_max_talent_rank", "name": "x", "numbers": [4]}' where id = 'rule_num_max_talent_rank';
update public.content_items set edited = '{"id": "rule_num_mod_points_base", "name": "x", "numbers": [8]}' where id = 'rule_num_mod_points_base';
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
update public.character_sheets set sheet = '{"bionics": [9811]}' where character_id = 700;
select lives_ok($$ update public.characters set submitted_at = now() where id = 700 $$, 'a mod point base of 8 fits a 7-point biomod');
reset role;
update public.characters set submitted_at = null where id = 700;
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
update public.character_sheets set sheet = '{"talents": {"__rn_t": 4}}' where character_id = 700;
select lives_ok($$ update public.characters set submitted_at = now() where id = 700 $$, 'a top rank of IV allows rank 4');
reset role;
update public.characters set submitted_at = null where id = 700;
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
update public.character_sheets set sheet = '{"talents": {"__rn_t": 5}}' where character_id = 700;
select throws_ok($$ update public.characters set submitted_at = now() where id = 700 $$, 'P0001',
  'Talent __rn_t must be a whole rank from 0 to IV.', 'rank 5 is still refused');

-- A hidden (draft) row falls back
reset role;
insert into public.content_items (id, pack_id, kind, data, draft) values
  ('rule_num_extra_mech_price', 9801, 'rules', '{"id": "rule_num_extra_mech_price", "name": "x", "numbers": [100]}', true);
select is(public.rule_number('extra_mech_price', 500, 0, 10000), 500::numeric, 'a hidden row falls back');

-- ---------------------------------------------------------------------
-- Work submitted before a number changed can't be approved
-- ---------------------------------------------------------------------
update public.character_sheets set sheet = '{}' where character_id = 700;
update public.characters set submitted_at = now() where id = 700;
-- The submit trigger stamps now(), and a whole test is one transaction, so move the stamp by hand (triggers off).
set local session_replication_role = replica;
update public.characters set submitted_at = now() - interval '1 hour' where id = 700;
set local session_replication_role = origin;
set local role authenticated;
set local request.jwt.claim.sub = 'c3333333-3333-3333-3333-333333333333';
select throws_ok($$ select public.approve_pilot(700, now() + interval '1 hour') $$, 'P0001',
  'The game numbers changed after this was submitted. Send it back so the player can resubmit.',
  'a pilot submitted before an edit is not approved');
reset role;
set local session_replication_role = replica;
update public.characters set submitted_at = now() + interval '1 hour' where id = 700;
set local session_replication_role = origin;
set local role authenticated;
set local request.jwt.claim.sub = 'c3333333-3333-3333-3333-333333333333';
select lives_ok($$ select public.approve_pilot(700, now() + interval '2 hours') $$, 'one submitted after the last edit is approved');

select * from finish();
rollback;
