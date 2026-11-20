-- Image uploads: who can put files in the bucket and take them out, and what a card's image column may hold.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Ids are hard-coded below. Sequences aren't rolled back, so push the generated ids well past them, once and for good.
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

-- Supabase refuses plain SQL deletes from storage tables unless this is set (the real API sets it itself).
set local storage.allow_delete_query = 'true';

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('22222222-2222-2222-2222-222222222222', 'p2@test.local', '{"full_name": "Player Two"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}');
update public.profiles set role = 'gm' where id = '33333333-3333-3333-3333-333333333333';

insert into public.characters (id, player_id, pilot_name) overriding system value values
  (200, '11111111-1111-1111-1111-111111111111', 'One');

insert into storage.objects (bucket_id, name, owner_id) values
  ('character-images', '22222222-2222-2222-2222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp', '22222222-2222-2222-2222-222222222222'),
  ('character-images', '22222222-2222-2222-2222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp', '22222222-2222-2222-2222-222222222222');

select is((select public from storage.buckets where id = 'character-images'), true, 'the image bucket is public to read');
select is((select file_size_limit from storage.buckets where id = 'character-images'), 1048576::bigint, 'uploads are limited to 1 MB');
select is((select allowed_mime_types from storage.buckets where id = 'character-images'), array['image/webp', 'image/jpeg', 'image/png'], 'only WebP, JPEG and (for card pictures) PNG are accepted');

-- ---------------------------------------------------------------------
-- Player One
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('character-images', '11111111-1111-1111-1111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp', '11111111-1111-1111-1111-111111111111') $$,
  'players can upload into their own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('character-images', '22222222-2222-2222-2222-222222222222/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp') $$,
  '42501', null, 'players cannot upload into someone else''s folder');

-- Hidden updates and deletes affect zero rows instead of raising an error; the GM section checks the files survived.
delete from storage.objects where name = '22222222-2222-2222-2222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';
update storage.objects set name = '11111111-1111-1111-1111-111111111111/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.webp'
 where name = '11111111-1111-1111-1111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp';
select is((select count(*)::int from storage.objects where name = '11111111-1111-1111-1111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp'), 1,
  'uploaded files cannot be renamed or overwritten (only card pictures can)');

select lives_ok(
  $$ update public.characters set pilot_image = '11111111-1111-1111-1111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp' where id = 200 $$,
  'a card can hold an uploaded image path');
reset role;
select is((select pilot_image from public.characters where id = 200), '11111111-1111-1111-1111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp', 'the path was saved');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select throws_ok(
  $$ update public.characters set pilot_image = 'https://evil.example/x.png' where id = 200 $$,
  '23514', null, 'a card cannot point at an outside link');
select throws_ok(
  $$ update public.characters set pilot_image = '../22222222-2222-2222-2222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp' where id = 200 $$,
  '23514', null, 'a card cannot hold a path that is not exactly an upload');

-- ---------------------------------------------------------------------
-- A GM
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is((select count(*)::int from storage.objects where name = '22222222-2222-2222-2222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp'), 1,
  'a player cannot delete someone else''s file');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('character-images', '22222222-2222-2222-2222-222222222222/ffffffff-ffff-4fff-8fff-ffffffffffff.webp') $$,
  '42501', null, 'GMs upload into their own folder too, never someone else''s');
delete from storage.objects where name = '22222222-2222-2222-2222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';
select is((select count(*)::int from storage.objects where name = '22222222-2222-2222-2222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp'), 0,
  'GMs can delete a file in anyone''s folder');

-- ---------------------------------------------------------------------
-- Player Two deletes their own file
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
delete from storage.objects where name = '22222222-2222-2222-2222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp';
select is((select count(*)::int from storage.objects where name = '22222222-2222-2222-2222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp'), 0,
  'players can delete files in their own folder');

reset role;
select * from finish();
rollback;
