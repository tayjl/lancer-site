-- Tries to break the pithub rules (same as lore) as a player, a GM, an owner and a logged-out visitor.
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
insert into public.pithub_entries (id, title, kind, published_at, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Public file', 'place', now(), '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Secret draft', 'story', null, '33333333-3333-3333-3333-333333333333');

-- ---------------------------------------------------------------------
-- A player
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select is((select count(*)::int from public.pithub_entries where id::text like 'aaaaaaaa-%'), 1,
  'players see only the published entry');
select is((select count(*)::int from public.pithub_entries where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0,
  'players cannot read a draft');
select throws_ok(
  $$ insert into public.pithub_entries (title, kind) values ('Player entry', 'story') $$,
  '42501', null, 'players cannot add pithub entries');
-- Hidden updates and deletes affect zero rows without an error, so the GM section checks nothing changed.
update public.pithub_entries set title = 'Hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.pithub_entries set published_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002';
delete from public.pithub_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.pithub_entries set image = '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.webp'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------
-- A GM
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is((select title from public.pithub_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Public file',
  'players cannot edit or delete a published entry');
select is((select published_at is null from public.pithub_entries where id = 'aaaaaaaa-0000-0000-0000-000000000002'), true,
  'players cannot publish a draft');
select is((select count(*)::int from public.pithub_entries where id::text like 'aaaaaaaa-%'), 2,
  'GMs see drafts as well');

select lives_ok(
  $$ insert into public.pithub_entries (id, title, kind, summary)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'GM story', 'story', 'Short.') $$,
  'GMs can add pithub entries');
select is((select created_by from public.pithub_entries where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  '33333333-3333-3333-3333-333333333333'::uuid, 'created_by is the logged-in GM');

-- Trying to forge the author: the shared trigger replaces it with the real one.
insert into public.pithub_entries (id, title, kind, created_by)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'Forged', 'event', '11111111-1111-1111-1111-111111111111');
select is((select created_by from public.pithub_entries where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  '33333333-3333-3333-3333-333333333333'::uuid, 'created_by cannot be set to someone else on insert');
update public.pithub_entries set created_by = '11111111-1111-1111-1111-111111111111'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is((select created_by from public.pithub_entries where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  '33333333-3333-3333-3333-333333333333'::uuid, 'created_by cannot be changed afterwards');

select lives_ok(
  $$ update public.pithub_entries set published_at = now() where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  'GMs can publish a draft');
select lives_ok(
  $$ delete from public.pithub_entries where id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  'GMs can delete pithub entries');
select is((select count(*)::int from public.pithub_entries where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0,
  'the deleted entry is gone');

select throws_ok($$ insert into public.pithub_entries (title, kind) values ('   ', 'story') $$,
  '23514', null, 'a blank title is refused');
select throws_ok($$ insert into public.pithub_entries (title, kind) values ('Ok', 'rumour') $$,
  '23514', null, 'an unknown kind is refused');

select is((select image is null from public.pithub_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001'), true,
  'players cannot set an entry image');
select lives_ok(
  $$ update public.pithub_entries set image = '33333333-3333-3333-3333-333333333333/22222222-2222-2222-2222-222222222222.webp'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'GMs can set a valid entry image path');
select throws_ok(
  $$ update public.pithub_entries set image = 'https://evil.example/x.png' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '23514', null, 'a URL is refused as an entry image');
select throws_ok(
  $$ update public.pithub_entries set image = '../x.webp' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '23514', null, 'a malformed path is refused as an entry image');

-- ---------------------------------------------------------------------
-- An owner counts as a GM
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select is((select count(*)::int from public.pithub_entries where id::text like 'aaaaaaaa-%'), 2, 'owners see drafts');
select lives_ok(
  $$ update public.pithub_entries set title = 'Edited by owner' where id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  'owners can edit pithub entries');

-- Players still read the image on a published entry.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select is((select image from public.pithub_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '33333333-3333-3333-3333-333333333333/22222222-2222-2222-2222-222222222222.webp', 'players read the image on a published entry');

-- ---------------------------------------------------------------------
-- Logged-out visitors
-- ---------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.pithub_entries $$, '42501', null,
  'logged-out visitors cannot read pithub entries');

reset role;
select * from finish();
rollback;
