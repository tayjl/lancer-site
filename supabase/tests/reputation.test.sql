-- Tries to break the reputation rules (migration 20261119180000_reputation.sql): factions, levels and reputation are
-- GM-only, owners manage the factions, and the five levels are seeded in order.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Ids are hard-coded below. Sequences aren't rolled back, so push the generated ids well past them, once and for good.
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}'),
  ('44444444-4444-4444-4444-444444444444', 'owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'gm' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'owner' where id = '44444444-4444-4444-4444-444444444444';

insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (100, '11111111-1111-1111-1111-111111111111', 'approved', 'One', 'Uno');
insert into public.organisations (id, name) overriding system value values (900, 'Test Union');
insert into public.reputation (character_id, organisation_id, level_id)
  values (100, 900, (select id from public.reputation_levels where name = 'Neutral'));

-- The levels, in order.
select results_eq(
  $$ select name from public.reputation_levels order by sort_order $$,
  $$ values ('Hostile'::text), ('Unfriendly'), ('Neutral'), ('Friendly'), ('Allied') $$,
  'the five levels are seeded, lowest to highest');

-- ---------------------------------------------------------------------
-- A player (the pilot's own)
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select is((select count(*)::int from public.organisations), 0, 'players cannot read factions');
select is((select count(*)::int from public.reputation_levels), 0, 'players cannot read levels');
select is((select count(*)::int from public.reputation), 0, 'players cannot read reputation, even their own');
select throws_ok($$ insert into public.organisations (name) values ('Mine') $$, '42501', null, 'players cannot add factions');
select throws_ok($$ insert into public.reputation (character_id, organisation_id, level_id)
  values (100, 900, (select id from public.reputation_levels where name = 'Allied')) $$, '42501', null, 'players cannot write reputation');
-- Without row access, updates and deletes find no rows and change nothing.
update public.reputation set level_id = (select id from public.reputation_levels where name = 'Allied');
update public.organisations set name = 'Hacked';
delete from public.reputation;
reset role;
select is((select level_id from public.reputation where character_id = 100), (select id from public.reputation_levels where name = 'Neutral'),
  'a player cannot update or delete reputation');
select is((select name from public.organisations where id = 900), 'Test Union', 'a player cannot rename a faction');

-- ---------------------------------------------------------------------
-- A GM
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is((select count(*)::int from public.organisations where id = 900), 1, 'GMs can read factions');
select is((select count(*)::int from public.reputation_levels), 5, 'GMs can read levels');
select lives_ok($$ insert into public.reputation (character_id, organisation_id, level_id, updated_by)
  values (100, 900, (select id from public.reputation_levels where name = 'Allied'), '33333333-3333-3333-3333-333333333333')
  on conflict (character_id, organisation_id) do update set level_id = excluded.level_id, updated_by = excluded.updated_by $$,
  'GMs can set reputation (an upsert)');
select is((select l.name from public.reputation r join public.reputation_levels l on l.id = r.level_id where r.character_id = 100), 'Allied',
  'the level was saved');
select throws_ok($$ insert into public.organisations (name) values ('GM faction') $$, '42501', null, 'GMs cannot add factions');
select lives_ok($$ delete from public.reputation where character_id = 100 $$, 'GMs can clear reputation');
select is((select count(*)::int from public.reputation), 0, 'the row is gone');

-- ---------------------------------------------------------------------
-- An owner
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select lives_ok($$ insert into public.organisations (name) values ('Owner faction') $$, 'owners can add factions');
select throws_ok($$ insert into public.organisations (name) values (repeat('x', 61)) $$, '23514', null, 'a 61 character faction name is refused');
select throws_ok($$ insert into public.organisations (name) values ('   ') $$, '23514', null, 'a blank faction name is refused');
select is((select convalidated from pg_constraint where conname = 'organisations_name_length'), true, 'the name length rule is a fully checked constraint');
select lives_ok($$ insert into public.organisations (name) values (repeat('y', 60)) $$, 'a 60 character faction name is allowed');
select lives_ok($$ update public.organisations set name = 'Renamed union' where id = 900 $$, 'owners can rename factions');
select throws_ok($$ insert into public.organisations (name) values ('Renamed union') $$, '23505', null, 'faction names are unique');
select lives_ok($$ delete from public.organisations where id = 900 $$, 'owners can delete factions');
select is((select count(*)::int from public.organisations where name = 'Owner faction'), 1, 'the new faction exists');

-- ---------------------------------------------------------------------
-- A logged-out visitor
-- ---------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.organisations $$, '42501', null, 'visitors cannot read factions');
select throws_ok($$ select count(*) from public.reputation $$, '42501', null, 'visitors cannot read reputation');

select * from finish();
rollback;
