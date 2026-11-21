-- GM edit mode can do anything (migration 20261121150000_gm_edit_mode.sql): only GMs and owners set gm_grants, a
-- player's change isn't charged for what a GM gave free (only up to what the sheet holds, never a refund), and GMs edit
-- every service record entry while players keep only their own. Run with: supabase test db
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'ga@test.local', '{"full_name": "Player A"}'),
  ('b2222222-2222-2222-2222-222222222222', 'gb@test.local', '{"full_name": "Player B"}'),
  ('c3333333-3333-3333-3333-333333333333', 'ggm@test.local', '{"full_name": "Game Master"}');
update public.profiles set role = 'gm' where id = 'c3333333-3333-3333-3333-333333333333';

insert into public.content_packs (id, name, manifest) overriding system value values (9801, '__GM_EDIT_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('__ge_gun', 9801, 'pilot_gear', '{"id": "__ge_gun", "name": "Pistol", "type": "Weapon", "manna_cost": 400}', null);
insert into public.bionics (id, name, manna_cost) overriding system value values (9101, 'Grant arm', 500);

-- 400: Player A's approved pilot, 3 licence ranks (2 given free by a GM), 1000 manna, an open draft change.
-- 401: Player B's submitted pilot. 402: Player B's draft pilot with no sheet yet.
insert into public.characters (id, player_id, status, pilot_name, submitted_at) overriding system value values
  (400, 'a1111111-1111-1111-1111-111111111111', 'approved', 'Ay', now()),
  (401, 'b2222222-2222-2222-2222-222222222222', 'pending', 'Bee', now()),
  (402, 'b2222222-2222-2222-2222-222222222222', 'pending', 'Bee Two', null);
insert into public.character_sheets (character_id, sheet, manna, gm_grants) values
  (400, '{"licences": {"__l": 3}}', 1000, '{"licences": {"__l": 2}}'),
  (401, '{}', 2000, '{}');
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet)
  values (400, 'a1111111-1111-1111-1111-111111111111', '{"mechs": []}', '{"licences": {"__l": 3}}');
insert into public.pilot_timeline (id, character_id, kind, title, created_by) values
  ('e0000000-0000-4000-8000-000000000001', 400, 'player', 'Player wrote this', 'a1111111-1111-1111-1111-111111111111'),
  ('e0000000-0000-4000-8000-000000000002', 400, 'auto', 'Site wrote this', null),
  ('e0000000-0000-4000-8000-000000000003', 400, 'gm', 'GM wrote this', 'c3333333-3333-3333-3333-333333333333');


-- ---------------------------------------------------------------------
-- gm_grants: players read their own, never write it
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';

select is((select gm_grants from public.character_sheets where character_id = 400), '{"licences": {"__l": 2}}'::jsonb,
  'a player reads the grants on their own pilot');
update public.character_sheets set gm_grants = '{"licences": {"__l": 3}}' where character_id = 400;
select is((select gm_grants from public.character_sheets where character_id = 400), '{"licences": {"__l": 2}}'::jsonb,
  'a player cannot change the grants on their approved pilot');

set local request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
select throws_ok($$ insert into public.character_sheets (character_id, gm_grants) values (402, '{"mechs": 3}') $$, 'P0001',
  'Only GMs and owners can set level, manna and free items.', 'a player cannot start a sheet with grants');
select lives_ok($$ insert into public.character_sheets (character_id) values (402) $$, 'a plain new sheet still works');
select throws_ok($$ update public.character_sheets set gm_grants = '{"mechs": 3}' where character_id = 402 $$, 'P0001',
  'Only GMs and owners can change level, manna and free items.', 'a player cannot give their draft pilot grants');


-- ---------------------------------------------------------------------
-- gm_grants: GMs set it, within the shape
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = 'c3333333-3333-3333-3333-333333333333';

select throws_ok($$ update public.character_sheets set gm_grants = '{"licences": {"__l": -1}}' where character_id = 400 $$, '23514', null, 'no negative grants');
select throws_ok($$ update public.character_sheets set gm_grants = '{"talents": {"__t": 1.5}}' where character_id = 400 $$, '23514', null, 'grants are whole numbers');
select throws_ok($$ update public.character_sheets set gm_grants = '{"mechs": "2"}' where character_id = 400 $$, '23514', null, 'mechs is a number');
select throws_ok($$ update public.character_sheets set gm_grants = '{"gear": ["__ge_gun"]}' where character_id = 400 $$, '23514', null, 'gear is an object');
select throws_ok($$ update public.character_sheets set gm_grants = '{"frames": {"x": 1}}' where character_id = 400 $$, '23514', null, 'no unknown keys');
select throws_ok($$ update public.character_sheets set gm_grants = '[]' where character_id = 400 $$, '23514', null, 'grants are an object');
update public.character_sheets set gm_grants = '{"licences": {"__l": 2}, "bionics": {"9101": 1}, "gear": {"__ge_gun": 1}, "mechs": 1}'
  where character_id = 400;
select is((select gm_grants ->> 'mechs' from public.character_sheets where character_id = 400), '1', 'a GM can give free ranks and items');
update public.character_sheets set sheet = '{"licences": {"__l": 3}}' where character_id = 401;
select is((select sheet from public.character_sheets where character_id = 401), '{"licences": {"__l": 3}}'::jsonb,
  'a GM can edit a submitted pilot''s sheet');


-- ---------------------------------------------------------------------
-- A player's change: granted ranks and items aren't charged, up to what the sheet holds (1000 manna received)
-- ---------------------------------------------------------------------
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';

select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$,
  'the approved licences pass: 2 of 3 ranks are free (600)');
update public.pending_changes set submitted_at = null where character_id = 400;

update public.pending_changes set proposed_sheet = '{"licences": {"__l": 3, "__m": 1}}' where character_id = 400;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$, 'P0001',
  'This spends 1,200 manna, but only 1,000 was received.', 'ranks past the grant cost manna');

update public.pending_changes set proposed_sheet = '{"licences": {"__l": 1}, "talents": {"__t": 3, "__u": 1}}' where character_id = 400;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$, 'P0001',
  'This spends 1,200 manna, but only 1,000 was received.', 'dropping granted ranks refunds nothing');

update public.pending_changes set proposed_sheet = '{"licences": {"__l": 2}, "bionics": [9101, 9101]}',
  proposed_public = '{"mechs": [{"id": "m1"}, {"id": "m2"}, {"id": "m3"}]}' where character_id = 400;
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$,
  'one granted biomod and one granted extra mech are free (500 + 500)');
update public.pending_changes set submitted_at = null where character_id = 400;

update public.pending_changes set proposed_sheet = '{"licences": {"__l": 2}, "bionics": [9101, 9101, 9101]}' where character_id = 400;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$, 'P0001',
  'This spends 1,500 manna, but only 1,000 was received.', 'biomods past the grant cost manna');

update public.pending_changes set proposed_public = '{"mechs": []}',
  proposed_sheet = '{"licences": {"__l": 3}, "owned_gear": [{"key": "k1", "id": "__ge_gun"}, {"key": "k2", "id": "__ge_gun"}]}'
  where character_id = 400;
select lives_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$,
  'one granted gear item is free (600 + 400)');
update public.pending_changes set submitted_at = null where character_id = 400;

update public.pending_changes set
  proposed_sheet = '{"licences": {"__l": 3}, "owned_gear": [{"key": "k1", "id": "__ge_gun"}, {"key": "k2", "id": "__ge_gun"}, {"key": "k3", "id": "__ge_gun"}]}'
  where character_id = 400;
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$, 'P0001',
  'This spends 1,400 manna, but only 1,000 was received.', 'gear past the grant costs manna');

select lives_ok($$ update public.pending_changes set proposed_sheet = proposed_sheet || '{"gm_grants": {"licences": {"__l": 9}}}' where character_id = 400 $$,
  'a grant inside the proposed sheet saves as a draft');
select throws_ok($$ update public.pending_changes set submitted_at = now() where character_id = 400 $$, 'P0001',
  'This spends 1,400 manna, but only 1,000 was received.', 'but is ignored: grants come only from the sheet row');


-- ---------------------------------------------------------------------
-- Service record: GMs edit every entry, players only their own
-- ---------------------------------------------------------------------
update public.pilot_timeline set title = 'Mine' where id = 'e0000000-0000-4000-8000-000000000001';
select is((select title from public.pilot_timeline where id = 'e0000000-0000-4000-8000-000000000001'), 'Mine', 'a player still edits their own entry');
update public.pilot_timeline set title = 'Forged' where id in ('e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.pilot_timeline where title = 'Forged'), 0, 'a player cannot edit site or GM entries');

set local request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
update public.pilot_timeline set title = 'Forged' where id = 'e0000000-0000-4000-8000-000000000001';
select is((select title from public.pilot_timeline where id = 'e0000000-0000-4000-8000-000000000001'), 'Mine', 'another player cannot edit a player''s entry');

set local request.jwt.claim.sub = 'c3333333-3333-3333-3333-333333333333';
update public.pilot_timeline set title = 'GM fixed'
  where id in ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.pilot_timeline where title = 'GM fixed'), 3, 'a GM edits player, site and GM entries');
select is((select kind from public.pilot_timeline where id = 'e0000000-0000-4000-8000-000000000001'), 'player', 'the entry keeps its kind');
delete from public.pilot_timeline where id = 'e0000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.pilot_timeline where id = 'e0000000-0000-4000-8000-000000000001'), 0, 'a GM deletes a player''s entry');

select * from finish();
rollback;
