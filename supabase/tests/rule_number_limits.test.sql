-- rule_number_limits (migration 20261124100000): the one home of each balance number's default and range.
-- Run with: supabase test db. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'rla@test.local', '{"full_name": "Player A"}');
insert into public.content_packs (id, name, manifest) overriding system value values (9802, '__RL_PACK', '{}');

delete from public.content_items where kind = 'rules' and id like 'rule\_num\_%'; -- leftovers of local editing
select is(public.rule_number('licence_rank_price'), 600::numeric, 'no row gives the default');
select is(public.rule_number('max_licence_rank'), 3::numeric, 'another default');
select throws_ok($$ select public.rule_number('no_such_key') $$, 'P0001', 'Unknown rule number no_such_key', 'an unknown key raises instead of giving NULL');

insert into public.content_items (id, pack_id, kind, data) values
  ('rule_num_licence_rank_price', 9802, 'rules', '{"numbers": [400]}'),
  ('rule_num_max_licence_rank', 9802, 'rules', '{"numbers": [7]}'),
  ('rule_num_talent_rank_price', 9802, 'rules', '{"numbers": [-1]}'),
  ('rule_num_mod_points_base', 9802, 'rules', '{"numbers": [2.5]}'),
  ('rule_num_extra_mech_price', 9802, 'rules', '{"numbers": ["5"]}');
select is(public.rule_number('licence_rank_price'), 400::numeric, 'a row in range wins');
select is(public.rule_number('max_licence_rank'), 3::numeric, 'above the range falls back');
select is(public.rule_number('talent_rank_price'), 300::numeric, 'below the range falls back');
select is(public.rule_number('mod_points_base'), 6::numeric, 'a fraction falls back');
select is(public.rule_number('extra_mech_price'), 500::numeric, 'text falls back');

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select is((select count(*) from public.rule_number_limits), 8::bigint, 'a player can read the limits');
select throws_ok($$ insert into public.rule_number_limits values ('x', 1, 0, 2) $$, '42501', null, 'a player cannot add a limit');
select throws_ok($$ update public.rule_number_limits set def = 1 where key = 'licence_rank_price' $$, '42501', null, 'a player cannot change a limit');
select throws_ok($$ delete from public.rule_number_limits $$, '42501', null, 'a player cannot delete a limit');
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.rule_number_limits $$, '42501', null, 'anon cannot read the limits');

select * from finish();
rollback;
