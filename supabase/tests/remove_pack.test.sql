-- Removing a pack (migration 20261117173030_remove_pack.sql): owners only, refused while any pilot uses an item
-- (in a sheet or an open change, dead pilots too), and the tables still can't be deleted from directly.
-- Everything happens inside a transaction that's rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Ids are hard-coded below. Sequences aren't rolled back, so push the generated ids well past them, once and for good.
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'rp-p1@test.local', '{"full_name": "Player One"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'rp-p2@test.local', '{"full_name": "Player Two"}'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'rp-gm@test.local', '{"full_name": "Game Master"}'),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'rp-owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'gm' where id = 'bbbbbbbb-0000-4000-8000-000000000003';
update public.profiles set role = 'owner' where id = 'bbbbbbbb-0000-4000-8000-000000000004';

-- Pack 9001 is used by a sheet (a dead pilot's, as a key in the licence map), pack 9002 only by an open draft,
-- pack 9003 by nobody. Pilot 9101 has no callsign, to check the name fallback.
insert into public.content_packs (id, name, manifest) overriding system value values
  (9001, '__RP_SHEET', '{}'), (9002, '__RP_DRAFT', '{}'), (9003, '__RP_UNUSED', '{}');
insert into public.content_items (id, pack_id, kind, data) values
  ('__rp_sheet_item', 9001, 'frames', '{"name": "Sheet frame"}'),
  ('__rp_sheet_other', 9001, 'weapons', '{"name": "Other weapon"}'),
  ('__rp_draft_item', 9002, 'weapons', '{"name": "Draft weapon"}'),
  ('__rp_unused_item', 9003, 'systems', '{"name": "Spare system"}');
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (9100, 'bbbbbbbb-0000-4000-8000-000000000001', 'dead', 'Old One', 'Ghost'),
  (9101, 'bbbbbbbb-0000-4000-8000-000000000002', 'approved', 'Two', null);
insert into public.character_sheets (character_id, sheet) values
  (9100, '{"licences": {"__rp_sheet_item": 2}}'), (9101, '{}');
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet)
  values (9101, 'bbbbbbbb-0000-4000-8000-000000000002', '{"mechs": []}', '{"pilot_gear": ["__rp_draft_item"]}');

-- Only owners
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000001';
select throws_ok($$ select * from public.pack_usage() $$, 'P0001', 'Only owners can see where pack content is used.', 'players cannot see pack usage');
select throws_ok($$ select public.remove_pack(9003) $$, 'P0001', 'Only owners can remove content packs.', 'players cannot remove a pack');
set local request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000003';
select throws_ok($$ select * from public.pack_usage() $$, 'P0001', 'Only owners can see where pack content is used.', 'GMs cannot see pack usage');
select throws_ok($$ select public.remove_pack(9003) $$, 'P0001', 'Only owners can remove content packs.', 'GMs cannot remove a pack');

set local request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000004';
select throws_ok($$ delete from public.content_items where id = '__rp_unused_item' $$, '42501', null, 'owners still cannot delete items directly');

-- Usage
select results_eq(
  $$ select pack_id, character_id, pilot, item_name from public.pack_usage() where pack_id in (9001, 9002, 9003) order by pack_id $$,
  $$ values (9001::bigint, 9100::bigint, 'Ghost'::text, 'Sheet frame'::text), (9002, 9101, 'Two', 'Draft weapon') $$,
  'usage comes from a dead pilot''s sheet and from a draft change, and the name falls back to the pilot name');

-- Removal
select throws_ok($$ select public.remove_pack(9001) $$, 'P0001', 'Ghost uses items from this pack.', 'a pack used by a sheet cannot be removed');
select throws_ok($$ select public.remove_pack(9002) $$, 'P0001', 'Two uses items from this pack.', 'a pack used by a draft cannot be removed');
select is((select count(*)::int from public.content_items where pack_id in (9001, 9002)), 3, 'the refused packs kept their items');
select throws_ok($$ select public.remove_pack(9999) $$, 'P0001', 'Pack 9999 does not exist.', 'an unknown pack is refused');

select lives_ok($$ select public.remove_pack(9003) $$, 'an unused pack can be removed');
select is((select count(*)::int from public.content_items where id = '__rp_unused_item'), 0, 'its items are gone');
select is((select count(*)::int from public.content_packs where id = 9003), 0, 'and so is the pack');

-- Once the draft is withdrawn, its pack is free.
reset role;
delete from public.pending_changes where character_id = 9101;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000004';
select lives_ok($$ select public.remove_pack(9002) $$, 'a pack is free once nothing uses it');

select * from finish();
rollback;
