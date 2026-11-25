-- delete_bionic (migration 20261125140000): owners only, refused while a sheet or open change has the biomod. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-0600-4000-8000-000000000001', 'bd-player@test.local', '{"full_name": "Player"}'),
  ('dddddddd-0600-4000-8000-000000000002', 'bd-gm@test.local', '{"full_name": "Game Master"}'),
  ('dddddddd-0600-4000-8000-000000000003', 'bd-owner@test.local', '{"full_name": "Owner"}'),
  ('dddddddd-0600-4000-8000-000000000004', 'bd-player2@test.local', '{"full_name": "Player two"}');
update public.profiles set role = 'gm' where id = 'dddddddd-0600-4000-8000-000000000002';
update public.profiles set role = 'owner' where id = 'dddddddd-0600-4000-8000-000000000003';

-- 9601 is on a sheet, 9602 only in an open change, 9603 is unused (with a bonus row)
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (9600, 'dddddddd-0600-4000-8000-000000000001', 'approved', 'One', 'Wren'),
  (9610, 'dddddddd-0600-4000-8000-000000000004', 'approved', 'Two', null);
insert into public.character_sheets (character_id, sheet) values
  (9600, '{"bionics": [9601]}'), (9610, '{"bionics": []}');
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, based_on)
  values (9610, 'dddddddd-0600-4000-8000-000000000004', '{}', '{"bionics": [9602]}', now());
insert into public.bionics (id, name, mod_point_cost) overriding system value values
  (9601, 'On a sheet', 1), (9602, 'In a change', 1), (9603, 'Unused', 1);
insert into public.bionic_bonuses (bionic_id, stat_id, amount) values (9603, 'physicality', 1);

set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-0600-4000-8000-000000000001';
select throws_ok($$ select public.delete_bionic(9603) $$, 'P0001', 'Only owners can delete content.', 'a player cannot delete a biomod');
set local request.jwt.claim.sub = 'dddddddd-0600-4000-8000-000000000002';
select throws_ok($$ select public.delete_bionic(9603) $$, 'P0001', 'Only owners can delete content.', 'a GM cannot delete a biomod');
select throws_ok($$ delete from public.bionics where id = 9603 $$, '42501', null, 'a GM has no direct delete either');

set local request.jwt.claim.sub = 'dddddddd-0600-4000-8000-000000000003';
select throws_ok($$ select public.delete_bionic(9601) $$, 'P0001', 'Wren uses this biomod.', 'refused while a sheet has it');
select throws_ok($$ select public.delete_bionic(9602) $$, 'P0001', 'Two uses this biomod.', 'refused while an open change has it');
select lives_ok($$ select public.delete_bionic(9603) $$, 'an unused biomod is deleted');
select is((select count(*) from public.bionics where id = 9603), 0::bigint, 'the biomod is gone');
select is((select count(*) from public.bionic_bonuses where bionic_id = 9603), 0::bigint, 'its bonus rows went with it');
select is((select count(*) from public.bionics where id in (9601, 9602)), 2::bigint, 'the used ones are still there');

select * from finish();
rollback;
