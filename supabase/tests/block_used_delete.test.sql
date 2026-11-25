-- Used factions and commendations can't be deleted (migration 20261125150000). Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-0700-4000-8000-000000000001', 'bu-a@test.local', '{"full_name": "A"}'),
  ('dddddddd-0700-4000-8000-000000000002', 'bu-b@test.local', '{"full_name": "B"}'),
  ('dddddddd-0700-4000-8000-000000000003', 'bu-owner@test.local', '{"full_name": "Owner"}'),
  ('dddddddd-0700-4000-8000-000000000004', 'bu-c@test.local', '{"full_name": "C"}');
update public.profiles set role = 'owner' where id = 'dddddddd-0700-4000-8000-000000000003';

insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (9700, 'dddddddd-0700-4000-8000-000000000001', 'approved', 'Ana', null),
  (9701, 'dddddddd-0700-4000-8000-000000000002', 'approved', 'Bo', 'Bo'),
  (9702, 'dddddddd-0700-4000-8000-000000000004', 'approved', ' ', null);
insert into public.organisations (id, name) overriding system value values (9700, 'Used faction'), (9701, 'Free faction'), (9702, 'Shared faction');
insert into public.reputation (character_id, organisation_id, level_id)
  select c, o, (select id from public.reputation_levels order by sort_order limit 1) from (values (9700, 9700), (9700, 9702), (9701, 9702), (9702, 9702)) v (c, o);
insert into public.commendations (id, name, icon) values
  ('dddddddd-0700-4000-9000-000000000001', 'Used medal', 'star'),
  ('dddddddd-0700-4000-9000-000000000002', 'Free medal', 'star'),
  ('dddddddd-0700-4000-9000-000000000003', 'Shared medal', 'star');
insert into public.pilot_commendations (character_id, commendation_id) values
  (9700, 'dddddddd-0700-4000-9000-000000000001'),
  (9700, 'dddddddd-0700-4000-9000-000000000003'), (9701, 'dddddddd-0700-4000-9000-000000000003'), (9702, 'dddddddd-0700-4000-9000-000000000003');

set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-0700-4000-8000-000000000003';

select throws_ok($$ delete from public.organisations where id = 9700 $$, 'P0001', 'Ana has a reputation with this faction. Hide it instead.', 'a used faction is refused, with the name');
select throws_ok($$ delete from public.organisations where id = 9702 $$, 'P0001', 'Ana, Bo and Unnamed pilot have a reputation with this faction. Hide it instead.', 'several names: callsign, else pilot name, else Unnamed pilot');
select is((select count(*) from public.reputation where character_id = 9700), 2::bigint, 'the pilot''s reputation rows survive the refused delete');
select lives_ok($$ delete from public.organisations where id = 9701 $$, 'an unused faction is deleted');
select is((select count(*) from public.organisations where id = 9701), 0::bigint, 'the unused faction is gone');

select throws_ok($$ delete from public.commendations where id = 'dddddddd-0700-4000-9000-000000000001' $$, 'P0001', 'Ana has this commendation. Hide it instead.', 'a used commendation is refused, with the name');
select throws_ok($$ delete from public.commendations where id = 'dddddddd-0700-4000-9000-000000000003' $$, 'P0001', 'Ana, Bo and Unnamed pilot have this commendation. Hide it instead.', 'several names');
select is((select count(*) from public.pilot_commendations where character_id = 9700), 2::bigint, 'the awards survive the refused delete');
select lives_ok($$ delete from public.commendations where id = 'dddddddd-0700-4000-9000-000000000002' $$, 'an unused commendation is deleted');

-- Deleting a pilot still removes their own rows (the foreign keys cascade)
reset role;
delete from public.characters where id = 9700;
select is((select count(*) from public.pilot_commendations where character_id = 9700), 0::bigint, 'deleting a pilot removes their awards');
select is((select count(*) from public.reputation where character_id = 9700), 0::bigint, 'deleting a pilot removes their reputation');
select is((select count(*) from public.commendations where id = 'dddddddd-0700-4000-9000-000000000001'), 1::bigint, 'the commendation itself stays');

select * from finish();
rollback;
