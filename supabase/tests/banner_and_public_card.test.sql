-- Tries to break migration 20261120110000_banner_position_and_public_card.sql: the banner position follows the existing
-- pilot_profiles rules and its ranges, and pilot_card() shows anyone (even logged out) the ID card of an approved or dead
-- pilot only, with nothing private, while anon still can't read the tables. The saved card picture can be written and
-- overwritten by the pilot's player and GMs only.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Ids are hard-coded below. Sequences aren't rolled back, so push the generated ids well past them, once and for good.
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('22222222-2222-2222-2222-222222222222', 'p2@test.local', '{"full_name": "Player Two"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}');
update public.profiles set role = 'gm' where id = '33333333-3333-3333-3333-333333333333';

insert into public.characters (id, player_id, status, pilot_name, callsign, approved_at, submitted_at, pilot_image) overriding system value values
  (100, '11111111-1111-1111-1111-111111111111', 'approved', 'One', 'Uno', '2026-11-01', '2026-10-30', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp'),
  (101, '11111111-1111-1111-1111-111111111111', 'dead', 'Dead', 'Gone', '2026-10-01', '2026-09-30', null),
  (200, '22222222-2222-2222-2222-222222222222', 'pending', 'Draft', null, null, null, null),
  (201, '22222222-2222-2222-2222-222222222222', 'pending', 'Submitted', null, null, now(), null),
  (202, '22222222-2222-2222-2222-222222222222', 'pending', 'Sent back', null, null, null, null);
insert into public.character_sheets (character_id, sheet, level, manna, review_note) values
  (100, '{"backstory": {"text": "secret"}, "licences": {"a": 2, "b": 1, "c": -4, "d": "x"}}', 3, 987, 'GM note'),
  (202, '{}', 0, 1500, 'sent back');
insert into public.pilot_profiles (character_id, colour, motto) values (100, '#112233', 'private-ish motto'), (200, '#445566', null);
insert into public.commendations (id, name, icon) values
  ('c0000000-0000-4000-8000-000000000001', 'First', 'star'),
  ('c0000000-0000-4000-8000-000000000002', 'Second', 'shield');
insert into public.pilot_commendations (character_id, commendation_id, awarded_at) values
  (100, 'c0000000-0000-4000-8000-000000000002', '2026-11-02'),
  (100, 'c0000000-0000-4000-8000-000000000001', '2026-11-03');
-- An open change on the approved pilot: the card must not show it.
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, based_on)
values (100, '11111111-1111-1111-1111-111111111111', '{"pilot_name": "Changed", "callsign": "Changed"}', '{"licences": {"a": 3, "b": 3, "e": 3}}', now());

-- ---------------------------------------------------------------------
-- 1. Banner position
-- ---------------------------------------------------------------------
select is((select (banner_x, banner_y, banner_zoom)::text from public.pilot_profiles where character_id = 100), '(50,50,1)', 'the banner is centred and unzoomed by default');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select lives_ok($$ update public.pilot_profiles set banner_y = 20, banner_x = 75.5, banner_zoom = 2.5 where character_id = 100 $$, 'a player can move their own pilot''s banner');
select is((select banner_y from public.pilot_profiles where character_id = 100), 20::real, 'and it is saved');
update public.pilot_profiles set banner_y = 10 where character_id = 200; -- hidden: zero rows
select is((select banner_y from public.pilot_profiles where character_id = 200), 50::real, 'another pilot''s banner can''t be moved');
select throws_ok($$ update public.pilot_profiles set banner_y = 101 where character_id = 100 $$, '23514', null, 'a position over 100 is refused');
select throws_ok($$ update public.pilot_profiles set banner_x = -1 where character_id = 100 $$, '23514', null, 'a position under 0 is refused');
select throws_ok($$ update public.pilot_profiles set banner_x = 'NaN' where character_id = 100 $$, '23514', null, 'NaN is refused');
select throws_ok($$ update public.pilot_profiles set banner_zoom = 0.5 where character_id = 100 $$, '23514', null, 'a zoom under 1 is refused');
select throws_ok($$ update public.pilot_profiles set banner_zoom = 3.5 where character_id = 100 $$, '23514', null, 'a zoom over 3 is refused');
select throws_ok($$ update public.pilot_profiles set banner_zoom = null where character_id = 100 $$, '23502', null, 'the zoom can''t be null');
reset role;

-- ---------------------------------------------------------------------
-- 2. The public card, logged out
-- ---------------------------------------------------------------------
set local role anon;
select is(
  (select (id, callsign, pilot_name, status, approved_at::date, level, licence_level, pilot_image, colour, medals)::text from public.pilot_card(100)),
  '(100,Uno,One,approved,2026-11-01,3,3,11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp,#112233,"{shield,star}")',
  'anon gets the approved pilot''s card (not the open change), medals in award order'
);
select is((select (pilot_name, level, licence_level, colour, medals)::text from public.pilot_card(101)), '(Dead,0,0,,{})', 'a dead pilot with no sheet or profile still has a card');
select is((select count(*)::int from public.pilot_card(200)), 0, 'no card for a draft pilot');
select is((select count(*)::int from public.pilot_card(201)), 0, 'no card for a submitted pilot');
select is((select count(*)::int from public.pilot_card(202)), 0, 'no card for a sent-back pilot');
select is((select count(*)::int from public.pilot_card(99999)), 0, 'no card for an unknown id');
select ok(
  (select to_jsonb(c)::text !~ '(secret|987|GM note|motto|backstory|manna|Changed|player)' from public.pilot_card(100) c),
  'the card holds no backstory, manna, notes, motto, player or open change'
);
select throws_ok($$ select * from public.characters $$, '42501', null, 'anon still can''t read characters');
select throws_ok($$ select * from public.pilot_profiles $$, '42501', null, 'anon still can''t read profiles');
select throws_ok($$ select * from public.character_sheets $$, '42501', null, 'anon still can''t read sheets');
reset role;

select ok(has_function_privilege('anon', 'public.pilot_card(bigint)', 'EXECUTE'), 'anon may call pilot_card');
select ok(has_function_privilege('authenticated', 'public.pilot_card(bigint)', 'EXECUTE'), 'so may logged-in users');

-- ---------------------------------------------------------------------
-- 3. The saved card picture
-- ---------------------------------------------------------------------
select is((select allowed_mime_types from storage.buckets where id = 'character-images'), array['image/webp', 'image/jpeg', 'image/png'], 'the bucket accepts PNG too');
select is((select file_size_limit from storage.buckets where id = 'character-images'), 1048576::bigint, 'still 1 MB at most');
insert into storage.objects (bucket_id, name, owner_id) values
  ('character-images', '11111111-1111-1111-1111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp', '11111111-1111-1111-1111-111111111111');

-- Like the storage API's upsert (which needs the insert, select and update policies): replace the file, or add it.
create function pg_temp.upsert_card(path text, v text) returns void language plpgsql as $f$
begin
  update storage.objects set user_metadata = jsonb_build_object('v', v) where bucket_id = 'character-images' and name = path;
  if not found then
    insert into storage.objects (bucket_id, name, user_metadata) values ('character-images', path, jsonb_build_object('v', v));
  end if;
end
$f$;
grant execute on function pg_temp.upsert_card(text, text) to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select lives_ok($$ select pg_temp.upsert_card('11111111-1111-1111-1111-111111111111/card-100.png', 'one') $$, 'a player uploads their pilot''s card picture');
select lives_ok($$ select pg_temp.upsert_card('11111111-1111-1111-1111-111111111111/card-100.png', 'two') $$, 'and overwrites it');
select is((select user_metadata ->> 'v' from storage.objects where name = '11111111-1111-1111-1111-111111111111/card-100.png'), 'two', 'the new picture replaced the old');
update storage.objects set user_metadata = '{"v": "x"}'
 where name = '11111111-1111-1111-1111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp'; -- hidden: zero rows
select is((select user_metadata from storage.objects where name = '11111111-1111-1111-1111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp'), null, 'other uploads still can''t be overwritten');
select lives_ok($$ update public.pilot_profiles set card_version = 'abc' where character_id = 100 $$, 'the player records the card version');
select throws_ok($$ update public.pilot_profiles set card_version = repeat('a', 65) where character_id = 100 $$, '23514', null, 'a card version over 64 characters is refused');

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select throws_ok($$ select pg_temp.upsert_card('11111111-1111-1111-1111-111111111111/card-100.png', 'evil') $$, '42501', null, 'another player can''t overwrite the card picture');
select throws_ok($$ select pg_temp.upsert_card('11111111-1111-1111-1111-111111111111/card-101.png', 'evil') $$, '42501', null, 'or upload one for another player''s pilot');
update storage.objects set user_metadata = '{"v": "evil"}' where name = '11111111-1111-1111-1111-111111111111/card-100.png'; -- hidden: zero rows
update public.pilot_profiles set card_version = 'evil' where character_id = 100; -- hidden: zero rows

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select lives_ok($$ select pg_temp.upsert_card('11111111-1111-1111-1111-111111111111/card-100.png', 'gm') $$, 'a GM overwrites any card picture');
select lives_ok($$ select pg_temp.upsert_card('22222222-2222-2222-2222-222222222222/card-200.png', 'gm') $$, 'and uploads one into any player''s folder');
select throws_ok($$ select pg_temp.upsert_card('22222222-2222-2222-2222-222222222222/card-200.webp', 'gm') $$, '42501', null, 'but only card pictures');
reset role;
select is((select user_metadata ->> 'v' from storage.objects where name = '11111111-1111-1111-1111-111111111111/card-100.png'), 'gm', 'the other player''s writes changed nothing');
update public.pilot_profiles set card_version = 'pending' where character_id = 200;

set local role anon;
select is((select (card_image, card_version)::text from public.pilot_card(100)), '(11111111-1111-1111-1111-111111111111/card-100.png,abc)', 'anon gets the saved card picture and version');
select is((select (card_image, card_version)::text from public.pilot_card(101)), '(,)', 'no picture before one is saved');
select is((select count(*)::int from public.pilot_card(200)), 0, 'nor for a draft pilot that has one');
reset role;

select * from finish();
rollback;
