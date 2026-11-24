-- game_definitions (migration 20261124120000): everyone logged in reads, only owners write, delete_definition refuses used ids.
-- Run with: supabase test db. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-0000-4000-8000-000000000001', 'gd-player@test.local', '{"full_name": "Player"}'),
  ('dddddddd-0000-4000-8000-000000000002', 'gd-gm@test.local', '{"full_name": "Game Master"}'),
  ('dddddddd-0000-4000-8000-000000000003', 'gd-owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'gm' where id = 'dddddddd-0000-4000-8000-000000000002';
update public.profiles set role = 'owner' where id = 'dddddddd-0000-4000-8000-000000000003';

insert into public.content_packs (id, name, manifest) overriding system value values (9901, '__GD_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data) values
  ('__gd_gun', 9901, 'weapons', '{"id": "__gd_gun", "type": "__gd_type"}'),
  ('__gd_frame', 9901, 'frames', '{"id": "__gd_frame", "stats": {"size": 7.25}}'),
  ('__gd_big', 9901, 'frames', '{"id": "__gd_big", "stats": {"size": 9.0}}'),
  ('__gd_two_a', 9901, 'frames', '{"id": "__gd_two_a", "stats": {"size": 6.5}}'),
  ('__gd_two_b', 9901, 'frames', '{"id": "__gd_two_b", "stats": {"size": 6.5}}');
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (9900, 'dddddddd-0000-4000-8000-000000000001', 'approved', 'One', 'Wren');
insert into public.character_sheets (character_id, sheet) values (9900, '{"mechs": [{"mounts": ["__gd_mount"]}]}');
insert into public.game_definitions (kind, id, label) values ('damage_types', '__gd_free', 'Unused'), ('weapon_types', '__gd_type', 'T'), ('mount_types', '__gd_mount', 'M'), ('frame_sizes', '7.25', 'S'), ('frame_sizes', '7.5', 'S2'), ('frame_sizes', '9', 'S9'), ('frame_sizes', '6.5', 'S65');

select is((select count(*) from public.game_definitions where kind = 'mount_types' and left(id, 2) <> '__'), 8::bigint, 'seeded mount types');

-- Player
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-0000-4000-8000-000000000001';
select ok((select count(*) from public.game_definitions) >= 72, 'a player can read the definitions');
select throws_ok($$ insert into public.game_definitions (kind, id, label) values ('uses', 'Never', 'Never') $$, '42501', null, 'a player cannot add');
update public.game_definitions set label = 'Hacked' where kind = 'uses' and id = 'Turn';
select is((select label from public.game_definitions where kind = 'uses' and id = 'Turn'), 'Turn', 'a player cannot change');
select throws_ok($$ delete from public.game_definitions where id = '__gd_free' $$, '42501', null, 'a player cannot delete directly');
select throws_ok($$ select public.delete_definition('damage_types', '__gd_free') $$, 'P0001', 'Only owners can delete definitions.', 'a player cannot call the guard');
select throws_ok($$ select public.save_definitions('uses', '[]') $$, 'P0001', 'Only owners can save definitions.', 'a player cannot save a list');

-- GM
set local request.jwt.claim.sub = 'dddddddd-0000-4000-8000-000000000002';
select throws_ok($$ insert into public.game_definitions (kind, id, label) values ('uses', 'Never', 'Never') $$, '42501', null, 'a GM cannot add');
update public.game_definitions set label = 'Hacked' where kind = 'uses' and id = 'Turn';
select is((select label from public.game_definitions where kind = 'uses' and id = 'Turn'), 'Turn', 'a GM cannot change');
select throws_ok($$ select public.delete_definition('damage_types', '__gd_free') $$, 'P0001', 'Only owners can delete definitions.', 'a GM cannot delete');
select throws_ok($$ select public.save_definitions('uses', '[]') $$, 'P0001', 'Only owners can save definitions.', 'a GM cannot save a list');

-- Owner
set local request.jwt.claim.sub = 'dddddddd-0000-4000-8000-000000000003';
insert into public.game_definitions (kind, id, label, data) values ('damage_types', 'Sonic', 'Sonic', '{"colour": "--dmg-energy"}');
select is((select label from public.game_definitions where id = 'Sonic'), 'Sonic', 'an owner can add');
update public.game_definitions set label = 'Sound' where id = 'Sonic';
select is((select label from public.game_definitions where id = 'Sonic'), 'Sound', 'an owner can change');
select throws_ok($$ insert into public.game_definitions (kind, id, label) values ('nonsense', 'x', 'x') $$, '23514', null, 'an unknown kind is refused');
select throws_ok($$ delete from public.game_definitions where id = 'Sonic' $$, '42501', null, 'even an owner cannot delete directly');
select throws_ok($$ select public.delete_definition('weapon_types', '__gd_type') $$, 'P0001', 'Used by 1 item', 'an id used by an item is refused');
select throws_ok($$ select public.delete_definition('mount_types', '__gd_mount') $$, 'P0001', 'Used by 1 item', 'an id used by a pilot sheet is refused');
select throws_ok($$ select public.delete_definition('frame_sizes', '7.25') $$, 'P0001', 'Used by 1 item', 'a numeric size used by a frame is refused');
select throws_ok($$ select public.delete_definition('frame_sizes', '9') $$, 'P0001', 'Used by 1 item', 'size 9.0 blocks deleting 9');
select throws_ok($$ insert into public.game_definitions (kind, id, label) values ('frame_sizes', '1(', 'Bad') $$, '23514', null, 'a non-numeric frame size id is refused');
select throws_ok($$ select public.delete_definition('frame_sizes', '1(') $$, 'P0001', 'A frame size must be a number.', 'the guard names a non-numeric size');
select throws_ok($$ update public.game_definitions set id = 'Renamed' where id = 'Sonic' $$, 'P0001', 'A definition''s id can''t change.', 'renaming is refused');
select throws_ok($$ update public.game_definitions set kind = 'uses' where id = 'Sonic' $$, 'P0001', 'A definition''s id can''t change.', 'moving kind is refused');
select lives_ok($$ select public.delete_definition('frame_sizes', '7.5') $$, 'an unused size is deleted');
select lives_ok($$ select public.delete_definition('damage_types', '__gd_free') $$, 'an unused id is deleted');
select is((select count(*) from public.game_definitions where id = '__gd_free'), 0::bigint, 'it is gone');
select throws_ok($$ select public.delete_definition('damage_types', 'nothing') $$, 'P0001', 'No such definition.', 'a missing id is refused');
select throws_ok($$ select public.delete_definition('frame_sizes', '6.5') $$, 'P0001', 'Used by 2 items', 'plural message for two items');

-- save_definitions: happy path (new row, changed label, hidden toggle, reorder)
select lives_ok(format($$ select public.save_definitions('uses', '[
  {"id": "Turn", "label": "Each turn", "data": {}, "sort": 1, "hidden": true, "updated_at": %s},
  {"id": "Round", "label": "Round", "data": {}, "sort": 0, "hidden": false, "updated_at": %s},
  {"id": "__gd_new", "label": "New", "data": {"colour": "--act-free"}, "sort": 9.0, "hidden": false}]') $$,
  to_json((select updated_at from public.game_definitions where kind = 'uses' and id = 'Turn')::text)::text,
  to_json((select updated_at from public.game_definitions where kind = 'uses' and id = 'Round')::text)::text), 'an owner saves a list, sort 9.0 included');
select is((select label || hidden::text || sort from public.game_definitions where kind = 'uses' and id = 'Turn'), 'Each turntrue1', 'label, hidden and order saved');
select is((select sort from public.game_definitions where kind = 'uses' and id = 'Round'), 0, 'reordered');
select is((select label from public.game_definitions where kind = 'uses' and id = '__gd_new'), 'New', 'new row added');
select is((select count(*) from public.game_definitions where kind = 'uses'), 9::bigint, 'nothing deleted by a save');

-- Stale protection
select lives_ok(format($$ select public.save_definitions('uses', '[{"id": "Turn", "label": "Fresh", "data": {}, "sort": 1, "hidden": false, "updated_at": %s}]') $$,
  to_json((select updated_at from public.game_definitions where kind = 'uses' and id = 'Turn')::text)::text), 'a matching updated_at saves');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "Turn", "label": "Stale", "data": {}, "sort": 1, "hidden": false, "updated_at": "2020-01-01T00:00:00Z"}]') $$,
  'P0001', 'Someone else changed this.', 'a stale updated_at is refused');
select is((select label from public.game_definitions where kind = 'uses' and id = 'Turn'), 'Fresh', 'stale save changed nothing');

select throws_ok($$ select public.save_definitions('uses', '[{"id": "Turn", "label": "NoStamp", "data": {}, "sort": 1, "hidden": false}]') $$,
  'P0001', 'Someone else changed this.', 'an existing row without updated_at is refused');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "Turn", "label": "NoStamp", "data": {}, "sort": 1, "hidden": false, "updated_at": null}]') $$,
  'P0001', 'Someone else changed this.', 'a null updated_at is refused');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "Turn", "label": "NoStamp", "data": {}, "sort": 1, "hidden": false, "updated_at": 5}]') $$,
  'P0001', 'Someone else changed this.', 'a numeric updated_at is refused');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "__gd_gone", "label": "Back", "data": {}, "sort": 1, "hidden": false, "updated_at": "2020-01-01T00:00:00Z"}]') $$,
  'P0001', 'Someone else changed this.', 'a stale edit of a deleted row is not re-created');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "N1", "label": "x", "data": {}, "sort": 1, "hidden": false}, {"id": "123456789012345678901234567890123456789012345678901234567890X", "label": "x", "data": {}, "sort": 1, "hidden": false}]') $$,
  'P0001', 'An id can have at most 60 characters.', 'a 61 character id is refused');
select throws_ok(format($$ select public.save_definitions('uses', '[{"id": "N1", "label": "x", "data": {"pad": "%s"}, "sort": 1, "hidden": false}]') $$, repeat('a', 9000)),
  'P0001', 'Row data is too large.', 'data over 8KB is refused');
select throws_ok($$ select public.save_definitions('frame_sizes', '[{"id": "01", "label": "x", "data": {}, "sort": 1, "hidden": false}]') $$,
  'P0001', 'A frame size must be a number.', 'frame size 01 refused');
select throws_ok($$ select public.save_definitions('frame_sizes', '[{"id": "1.0", "label": "x", "data": {}, "sort": 1, "hidden": false}]') $$,
  'P0001', 'A frame size must be a number.', 'frame size 1.0 refused');

-- Bad payloads roll back the whole call: the first row is valid in each
select throws_ok($$ select public.save_definitions('uses', '[{"id": "N1", "label": "Changed", "data": {}, "sort": 0, "hidden": false}, {"id": "N1", "label": "Dup", "data": {}, "sort": 0, "hidden": false}]') $$, 'P0001', 'The id N1 is used twice.', 'duplicate ids refused');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "N1", "label": "Changed", "data": {}, "sort": 0, "hidden": false}, {"id": "X", "label": " ", "data": {}, "sort": 0, "hidden": false}]') $$, 'P0001', 'Every row needs a label.', 'empty label refused');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "N1", "label": "Changed", "data": {}, "sort": 0, "hidden": false}, {"id": "X", "label": "x", "data": [], "sort": 0, "hidden": false}]') $$, 'P0001', 'Row data must be an object.', 'non-object data refused');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "N1", "label": "Changed", "data": {}, "sort": 0, "hidden": false}, {"id": "X", "label": "x", "data": {}, "sort": 1.5, "hidden": false}]') $$, 'P0001', 'Sort must be a whole number.', 'fractional sort refused');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "N1", "label": "Changed", "data": {}, "sort": 0, "hidden": false}, {"id": "X", "label": "x", "data": {}, "sort": "1", "hidden": false}]') $$, 'P0001', 'Sort must be a whole number.', 'text sort refused');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "N1", "label": "Changed", "data": {}, "sort": 0, "hidden": false}, {"id": "X", "label": "x", "data": {}, "sort": 1, "hidden": "no"}]') $$, 'P0001', 'Hidden must be true or false.', 'text hidden refused');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "N1", "label": "Changed", "data": {}, "sort": 0, "hidden": false}, {"id": 5, "label": "x", "data": {}, "sort": 1, "hidden": false}]') $$, 'P0001', 'Every row needs an id.', 'non-string id refused');
select throws_ok($$ select public.save_definitions('uses', '[{"id": "N1", "label": "Changed", "data": {}, "sort": 0, "hidden": false}, {"id": "X", "label": "1234567890123456789012345678901234567890123456789012345678901", "data": {}, "sort": 1, "hidden": false}]') $$, 'P0001', 'A label can have at most 60 characters.', 'long label refused');
select throws_ok($$ select public.save_definitions('frame_sizes', '[{"id": "4", "label": "4", "data": {}, "sort": 0, "hidden": false}, {"id": "big", "label": "x", "data": {}, "sort": 1, "hidden": false}]') $$, 'P0001', 'A frame size must be a number.', 'non-numeric frame size refused');
select throws_ok($$ select public.save_definitions('nonsense', '[]') $$, 'P0001', 'Unknown list.', 'unknown kind refused');
select throws_ok($$ select public.save_definitions('uses', '{}') $$, 'P0001', 'Send the list as an array.', 'non-array refused');
select throws_ok($$ select public.save_definitions('uses', (select jsonb_agg(jsonb_build_object('id', 'r' || n, 'label', 'x', 'data', '{}'::jsonb, 'sort', n, 'hidden', false)) from generate_series(1, 201) n)) $$, 'P0001', 'A list can have at most 200 rows.', '201 rows refused');
select is((select label from public.game_definitions where kind = 'uses' and id = 'Round'), 'Round', 'earlier rows unchanged after failed calls');
select is((select count(*) from public.game_definitions where kind = 'uses' and id in ('X', 'r1')), 0::bigint, 'no new rows after failed calls');
select is((select count(*) from public.game_definitions where kind = 'frame_sizes' and id = '4'), 0::bigint, 'no size added after a failed call');

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.game_definitions $$, '42501', null, 'anon cannot read');
select throws_ok($$ select public.save_definitions('uses', '[]') $$, '42501', null, 'anon cannot save');

select * from finish();
rollback;
