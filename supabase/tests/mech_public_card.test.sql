-- Tries to break migration 20261121120000_mech_public_card.sql: mech_card() shows anyone (even logged out) the card of a
-- mech of an approved or dead pilot only, with its approved frame and nothing private; mech_card_versions follows the
-- pilot_profiles rules and holds only short fingerprints by mech id; the saved mech card picture can be written by the
-- pilot's player and GMs only, under exactly "<player id>/mech-card-<character id>-<mech id>.png".
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

insert into public.content_packs (id, name, manifest) overriding system value values (9301, 'Mech card pack', '{}');
insert into public.content_items (id, pack_id, kind, data, edited, draft) values
  ('mf_mc_frame', 9301, 'frames', '{"id": "mf_mc_frame", "name": "Original", "source": "GMS"}', '{"id": "mf_mc_frame", "name": "Edited", "source": "HA"}', false),
  ('mf_mc_draft', 9301, 'frames', '{"id": "mf_mc_draft", "name": "Unpublished", "source": "SSC"}', null, true),
  ('mf_mc_system', 9301, 'systems', '{"id": "mf_mc_system", "name": "Not a frame", "source": "IPS-N"}', null, false);

-- m1 and m2 on the approved pilot, m3 on the dead one, m4 on a pending one.
insert into public.characters (id, player_id, status, pilot_name, callsign, approved_at, submitted_at, mechs) overriding system value values
  (100, '11111111-1111-1111-1111-111111111111', 'approved', 'One', 'Uno', '2026-11-01', '2026-10-30', '[
    "junk",
    {"id": "aaaaaaaa-0000-4000-8000-000000000001", "name": "Lantern", "manufacturer_id": "AB12-CD34-EF56", "appearance": {"text": "shiny"}, "image": "11111111-1111-1111-1111-111111111111/m1.webp"},
    {"id": "aaaaaaaa-0000-4000-8000-000000000002", "name": "Wisp", "manufacturer_id": "ZZZZ-ZZZZ-ZZZZ", "appearance": null, "image": null},
    {"id": "aaaaaaaa-0000-4000-8000-000000000001", "name": "Duplicate", "manufacturer_id": "XXXX-XXXX-XXXX", "appearance": null, "image": null}
  ]'),
  (101, '11111111-1111-1111-1111-111111111111', 'dead', 'Dead', 'Gone', '2026-10-01', '2026-09-30', '[{"id": "aaaaaaaa-0000-4000-8000-000000000003", "name": "Wreck", "manufacturer_id": "DEAD-DEAD-DEAD", "appearance": null, "image": null}]'),
  (200, '22222222-2222-2222-2222-222222222222', 'pending', 'Draft', null, null, now(), '[{"id": "aaaaaaaa-0000-4000-8000-000000000004", "name": "Hidden", "manufacturer_id": "HIDE-HIDE-HIDE", "appearance": null, "image": null}]');
insert into public.character_sheets (character_id, sheet, level, manna, review_note) values
  (100, '{"backstory": {"text": "secret"}, "mechs": {
    "aaaaaaaa-0000-4000-8000-000000000001": {"frame": "mf_mc_frame", "history": {"text": "classified"}, "systems": ["hidden_system"], "mounts": [["hidden_rifle"]]},
    "aaaaaaaa-0000-4000-8000-000000000002": {"frame": "mf_mc_draft"}
  }}', 3, 987, 'GM note'),
  (200, '{"mechs": {"aaaaaaaa-0000-4000-8000-000000000004": {"frame": "mf_mc_frame"}}}', 0, 1500, null);
insert into public.pilot_profiles (character_id, colour, motto) values (100, '#112233', 'private-ish motto'), (200, '#445566', null);
-- An open change on the approved pilot: the card must not show it.
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, based_on)
values (100, '11111111-1111-1111-1111-111111111111',
  '{"mechs": [{"id": "aaaaaaaa-0000-4000-8000-000000000001", "name": "Changed", "manufacturer_id": "CHAN-GEDD-XXXX", "appearance": null, "image": null}]}',
  '{"mechs": {"aaaaaaaa-0000-4000-8000-000000000001": {"frame": "mf_mc_system"}}}', now());

-- ---------------------------------------------------------------------
-- 1. The public mech card, logged out
-- ---------------------------------------------------------------------
set local role anon;
select is(
  (select (character_id, mech_id, mech_name, manufacturer_id, mech_image, frame_id, frame_name, frame_source, callsign, pilot_name, status, colour, card_image, card_version)::text
     from public.mech_card(100, 'aaaaaaaa-0000-4000-8000-000000000001')),
  '(100,aaaaaaaa-0000-4000-8000-000000000001,Lantern,AB12-CD34-EF56,11111111-1111-1111-1111-111111111111/m1.webp,mf_mc_frame,Edited,HA,Uno,One,approved,#112233,,)',
  'anon gets the approved mech (the first with that id, not the open change), with the campaign''s edit of its frame'
);
select is((select count(*)::int from public.mech_card(100, 'aaaaaaaa-0000-4000-8000-000000000001')), 1, 'one row only');
select is((select (mech_name, frame_id, frame_name, frame_source)::text from public.mech_card(100, 'aaaaaaaa-0000-4000-8000-000000000002')), '(Wisp,,,)', 'an unpublished frame isn''t shown');
select is((select (mech_name, status, frame_id, colour)::text from public.mech_card(101, 'aaaaaaaa-0000-4000-8000-000000000003')), '(Wreck,dead,,)', 'a dead pilot''s mech with no sheet or profile still has a card');
select is((select count(*)::int from public.mech_card(200, 'aaaaaaaa-0000-4000-8000-000000000004')), 0, 'no card for a pending pilot''s mech');
select is((select count(*)::int from public.mech_card(100, 'aaaaaaaa-0000-4000-8000-000000000004')), 0, 'no card for another pilot''s mech');
select is((select count(*)::int from public.mech_card(100, 'aaaaaaaa-0000-4000-8000-000000000009')), 0, 'no card for an unknown mech');
select is((select count(*)::int from public.mech_card(100, null)), 0, 'nor for no mech');
select is((select count(*)::int from public.mech_card(99999, 'aaaaaaaa-0000-4000-8000-000000000001')), 0, 'no card for an unknown pilot');
select ok(
  (select to_jsonb(c)::text !~* '(secret|classified|hidden|987|GM note|motto|shiny|Changed|Duplicate|11111111-1111-1111-1111-111111111111/mech)' from public.mech_card(100, 'aaaaaaaa-0000-4000-8000-000000000001') c),
  'the card holds no backstory, history, loadout, manna, notes, motto, appearance or open change'
);
select throws_ok($$ select * from public.characters $$, '42501', null, 'anon still can''t read characters');
select throws_ok($$ select * from public.pilot_profiles $$, '42501', null, 'anon still can''t read profiles');
reset role;

select ok(has_function_privilege('anon', 'public.mech_card(bigint, text)', 'EXECUTE'), 'anon may call mech_card');
select ok(has_function_privilege('authenticated', 'public.mech_card(bigint, text)', 'EXECUTE'), 'so may logged-in users');
select ok(not exists (select 1 from information_schema.routine_privileges where routine_name = 'mech_card' and grantee = 'PUBLIC'), 'but not everyone');

-- ---------------------------------------------------------------------
-- 2. Mech card versions
-- ---------------------------------------------------------------------
select is((select mech_card_versions from public.pilot_profiles where character_id = 100), '{}'::jsonb, 'no versions by default');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select lives_ok($$ update public.pilot_profiles set mech_card_versions = '{"aaaaaaaa-0000-4000-8000-000000000001": "abc"}' where character_id = 100 $$, 'the player records a mech card version');
select lives_ok($$ update public.pilot_profiles set mech_card_versions = jsonb_build_object('aaaaaaaa-0000-4000-8000-000000000001', repeat('a', 64)) where character_id = 100 $$, '64 characters are fine');
select throws_ok($$ update public.pilot_profiles set mech_card_versions = jsonb_build_object('aaaaaaaa-0000-4000-8000-000000000001', repeat('a', 65)) where character_id = 100 $$, '23514', null, 'a version over 64 characters is refused');
select throws_ok($$ update public.pilot_profiles set mech_card_versions = '{"aaaaaaaa-0000-4000-8000-000000000001": 5}' where character_id = 100 $$, '23514', null, 'a version that isn''t text is refused');
select throws_ok($$ update public.pilot_profiles set mech_card_versions = '{"aaaaaaaa-0000-4000-8000-000000000001": null}' where character_id = 100 $$, '23514', null, 'a null version is refused');
select throws_ok($$ update public.pilot_profiles set mech_card_versions = '{"m1": "abc"}' where character_id = 100 $$, '23514', null, 'a key that isn''t a mech id is refused');
select throws_ok($$ update public.pilot_profiles set mech_card_versions = '{"AAAAAAAA-0000-4000-8000-000000000001": "abc"}' where character_id = 100 $$, '23514', null, 'an uppercase mech id is refused');
select throws_ok($$ update public.pilot_profiles set mech_card_versions = '["abc"]' where character_id = 100 $$, '23514', null, 'a list is refused');
select throws_ok($$ update public.pilot_profiles set mech_card_versions = '"abc"' where character_id = 100 $$, '23514', null, 'plain text is refused');
select throws_ok($$ update public.pilot_profiles set mech_card_versions = null where character_id = 100 $$, '23502', null, 'null is refused');
select throws_ok($$ update public.pilot_profiles set mech_card_versions = (select jsonb_object_agg(gen_random_uuid()::text, repeat('a', 64)) from generate_series(1, 200)) where character_id = 100 $$, '23514', null, 'a huge list is refused');
select lives_ok($$ update public.pilot_profiles set mech_card_versions = '{"aaaaaaaa-0000-4000-8000-000000000001": "abc"}' where character_id = 100 $$, 'back to one version');

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update public.pilot_profiles set mech_card_versions = '{"aaaaaaaa-0000-4000-8000-000000000001": "evil"}' where character_id = 100; -- hidden: zero rows

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select lives_ok($$ update public.pilot_profiles set mech_card_versions = '{"aaaaaaaa-0000-4000-8000-000000000004": "gm"}' where character_id = 200 $$, 'a GM records any pilot''s mech card version');
reset role;
select is((select mech_card_versions ->> 'aaaaaaaa-0000-4000-8000-000000000001' from public.pilot_profiles where character_id = 100), 'abc', 'another player can''t change the versions');

set local role anon;
select is((select (card_image, card_version)::text from public.mech_card(100, 'aaaaaaaa-0000-4000-8000-000000000001')),
  '(11111111-1111-1111-1111-111111111111/mech-card-100-aaaaaaaa-0000-4000-8000-000000000001.png,abc)', 'anon gets the saved mech card picture and version');
select is((select (card_image, card_version)::text from public.mech_card(100, 'aaaaaaaa-0000-4000-8000-000000000002')), '(,)', 'no picture for a mech before one is saved');
select is((select count(*)::int from public.mech_card(200, 'aaaaaaaa-0000-4000-8000-000000000004')), 0, 'nor for a pending pilot''s mech that has one');
reset role;

-- ---------------------------------------------------------------------
-- 3. The saved mech card picture
-- ---------------------------------------------------------------------
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
select lives_ok($$ select pg_temp.upsert_card('11111111-1111-1111-1111-111111111111/mech-card-100-aaaaaaaa-0000-4000-8000-000000000001.png', 'one') $$, 'a player uploads their mech''s card picture');
select lives_ok($$ select pg_temp.upsert_card('11111111-1111-1111-1111-111111111111/mech-card-100-aaaaaaaa-0000-4000-8000-000000000001.png', 'two') $$, 'and overwrites it');
select is((select user_metadata ->> 'v' from storage.objects where name = '11111111-1111-1111-1111-111111111111/mech-card-100-aaaaaaaa-0000-4000-8000-000000000001.png'), 'two', 'the new picture replaced the old');
-- Their own folder takes any new name (the older upload policy), but only card names can be overwritten.
insert into storage.objects (bucket_id, name) values ('character-images', '11111111-1111-1111-1111-111111111111/mech-card-100-AAAAAAAA-0000-4000-8000-000000000001.png');
update storage.objects set user_metadata = '{"v": "x"}' where name = '11111111-1111-1111-1111-111111111111/mech-card-100-AAAAAAAA-0000-4000-8000-000000000001.png'; -- hidden: zero rows
select is((select user_metadata from storage.objects where name = '11111111-1111-1111-1111-111111111111/mech-card-100-AAAAAAAA-0000-4000-8000-000000000001.png'), null, 'a near-miss name can''t be overwritten');

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select throws_ok($$ select pg_temp.upsert_card('11111111-1111-1111-1111-111111111111/mech-card-100-aaaaaaaa-0000-4000-8000-000000000001.png', 'evil') $$, '42501', null, 'another player can''t overwrite the mech card picture');
select throws_ok($$ select pg_temp.upsert_card('11111111-1111-1111-1111-111111111111/mech-card-100-aaaaaaaa-0000-4000-8000-000000000002.png', 'evil') $$, '42501', null, 'or upload one into another player''s folder');

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select lives_ok($$ select pg_temp.upsert_card('11111111-1111-1111-1111-111111111111/mech-card-100-aaaaaaaa-0000-4000-8000-000000000001.png', 'gm') $$, 'a GM overwrites any mech card picture');
select lives_ok($$ select pg_temp.upsert_card('22222222-2222-2222-2222-222222222222/mech-card-200-aaaaaaaa-0000-4000-8000-000000000004.png', 'gm') $$, 'and uploads one into any player''s folder');
select lives_ok($$ select pg_temp.upsert_card('22222222-2222-2222-2222-222222222222/card-200.png', 'gm') $$, 'pilot card pictures still work');
-- Near misses a GM can't upload into another player's folder.
select throws_ok(format($$ select pg_temp.upsert_card(%L, 'gm') $$, '22222222-2222-2222-2222-222222222222/' || n), '42501', null, 'refused: ' || replace(n, E'\n', '\n'))
  from unnest(array[
    'mech-card-200-m1.png',
    'mech-card-200-AAAAAAAA-0000-4000-8000-000000000004.png',
    'mech-card-200-aaaaaaaa-0000-4000-8000-000000000004.webp',
    'mech-card-200-aaaaaaaa-0000-4000-8000-000000000004.png.png',
    'mech-card-200-aaaaaaaa-0000-4000-8000-000000000004-x.png',
    'mech-card-200-aaaaaaaa00004000800000000000004.png',
    'mech-card--aaaaaaaa-0000-4000-8000-000000000004.png',
    'mech-card-x-aaaaaaaa-0000-4000-8000-000000000004.png',
    'mech-card-aaaaaaaa-0000-4000-8000-000000000004.png',
    'sub/mech-card-200-aaaaaaaa-0000-4000-8000-000000000004.png',
    'mech-card-200-aaaaaaaa-0000-4000-8000-000000000004.png
'
  ]) n;
select throws_ok($$ select pg_temp.upsert_card('not-a-player/mech-card-200-aaaaaaaa-0000-4000-8000-000000000004.png', 'gm') $$, '42501', null, 'refused: a folder that isn''t a player id');
reset role;
select is((select user_metadata ->> 'v' from storage.objects where name = '11111111-1111-1111-1111-111111111111/mech-card-100-aaaaaaaa-0000-4000-8000-000000000001.png'), 'gm', 'the other player''s writes changed nothing');

select * from finish();
rollback;
