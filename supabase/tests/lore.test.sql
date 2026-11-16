-- Tries to break the lore rules as a player, a GM, an owner and a logged-out visitor.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}'),
  ('44444444-4444-4444-4444-444444444444', 'owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'gm' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'owner' where id = '44444444-4444-4444-4444-444444444444';

-- One published entry and one draft, made by the GM.
insert into public.lore_entries (id, title, kind, published_at, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Public place', 'place', now(), '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Secret draft', 'story', null, '33333333-3333-3333-3333-333333333333');

-- ---------------------------------------------------------------------
-- A player
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select is((select count(*)::int from public.lore_entries where id::text like 'aaaaaaaa-%'), 1,
  'players see only the published entry');
select is((select count(*)::int from public.lore_entries where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0,
  'players cannot read a draft');
select throws_ok(
  $$ insert into public.lore_entries (title, kind) values ('Player lore', 'story') $$,
  '42501', null, 'players cannot add lore');
-- Updates and deletes that the policies hide affect zero rows instead of raising an error,
-- so the GM section below checks that nothing changed.
update public.lore_entries set title = 'Hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.lore_entries set published_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002';
delete from public.lore_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------
-- A GM
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is((select title from public.lore_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Public place',
  'players cannot edit or delete a published entry');
select is((select published_at is null from public.lore_entries where id = 'aaaaaaaa-0000-0000-0000-000000000002'), true,
  'players cannot publish a draft');
select is((select count(*)::int from public.lore_entries where id::text like 'aaaaaaaa-%'), 2,
  'GMs see drafts as well');

select lives_ok(
  $$ insert into public.lore_entries (id, title, kind, summary)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'GM story', 'story', 'Short.') $$,
  'GMs can add lore');
select is((select created_by from public.lore_entries where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  '33333333-3333-3333-3333-333333333333'::uuid, 'created_by is the logged-in GM');
select is((select body from public.lore_entries where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  '{"type":"doc","content":[]}'::jsonb, 'the body starts as an empty document');

-- Trying to forge the author: the trigger replaces it with the real one.
insert into public.lore_entries (id, title, kind, created_by)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'Forged', 'event', '11111111-1111-1111-1111-111111111111');
select is((select created_by from public.lore_entries where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  '33333333-3333-3333-3333-333333333333'::uuid, 'created_by cannot be set to someone else on insert');
update public.lore_entries set created_by = '11111111-1111-1111-1111-111111111111'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is((select created_by from public.lore_entries where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  '33333333-3333-3333-3333-333333333333'::uuid, 'created_by cannot be changed afterwards');

select lives_ok(
  $$ update public.lore_entries set published_at = now() where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  'GMs can publish a draft');
select lives_ok(
  $$ delete from public.lore_entries where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  'GMs can delete lore');
select is((select count(*)::int from public.lore_entries where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0,
  'the deleted entry is gone');

-- Bad values are refused.
select throws_ok($$ insert into public.lore_entries (title, kind) values ('   ', 'story') $$,
  '23514', null, 'a blank title is refused');
select throws_ok($$ insert into public.lore_entries (title, kind) values (repeat('x', 121), 'story') $$,
  '23514', null, 'a title over 120 characters is refused');
select throws_ok($$ insert into public.lore_entries (title, kind) values ('Ok', 'rumour') $$,
  '23514', null, 'an unknown kind is refused');
select throws_ok($$ insert into public.lore_entries (title, kind, summary) values ('Ok', 'story', repeat('x', 301)) $$,
  '23514', null, 'a summary over 300 characters is refused');

-- ---------------------------------------------------------------------
-- An owner counts as a GM
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select is((select count(*)::int from public.lore_entries where id::text like 'aaaaaaaa-%'), 2, 'owners see drafts');
select lives_ok(
  $$ update public.lore_entries set title = 'Edited by owner' where id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  'owners can edit lore');

-- ---------------------------------------------------------------------
-- Logged-out visitors
-- ---------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.lore_entries $$, '42501', null,
  'logged-out visitors cannot read lore');

reset role;
select * from finish();
rollback;
