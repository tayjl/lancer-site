-- The content editor (migration 20261117201816_content_editor.sql): owners only, edits kept through pack updates,
-- drafts, deleting only unused homebrew, and the all-or-nothing bionic save. Rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-0000-4000-8000-000000000001', 'ce-player@test.local', '{"full_name": "Player"}'),
  ('cccccccc-0000-4000-8000-000000000002', 'ce-gm@test.local', '{"full_name": "Game Master"}'),
  ('cccccccc-0000-4000-8000-000000000003', 'ce-owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'gm' where id = 'cccccccc-0000-4000-8000-000000000002';
update public.profiles set role = 'owner' where id = 'cccccccc-0000-4000-8000-000000000003';

-- An official pack with one item (edited later), the homebrew pack with a draft and a used published item, and a
-- pilot whose sheet uses the published one and bionic 9301.
-- (Using the editor locally makes a real "Campaign homebrew" pack; it goes, with its items, inside this rolled-back transaction.)
delete from public.content_packs where name = 'Campaign homebrew';
insert into public.content_packs (id, name, manifest) overriding system value values
  (9201, '__CE_OFFICIAL', '{}'), (9202, 'Campaign homebrew', '{}');
insert into public.content_items (id, pack_id, kind, data, draft) values
  ('__ce_official', 9201, 'weapons', '{"id": "__ce_official", "name": "Official gun"}', false),
  ('__ce_draft', 9202, 'pilot_gear', '{"id": "__ce_draft", "name": "Draft gear"}', true),
  ('__ce_used', 9202, 'pilot_gear', '{"id": "__ce_used", "name": "Used gear"}', false),
  ('__ce_free', 9202, 'tags', '{"id": "__ce_free", "name": "Free tag"}', false);
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (9200, 'cccccccc-0000-4000-8000-000000000001', 'approved', 'One', 'Wren');
insert into public.character_sheets (character_id, sheet) values (9200, '{"pilot_gear": ["__ce_used"], "bionics": [9301]}');
insert into public.bionics (id, name, mod_point_cost) overriding system value values (9301, 'Old arm', 1), (9302, 'Spare', 1);
insert into public.bionic_bonuses (bionic_id, stat_id, amount) values (9301, 'physicality', 1);

-- Players and GMs can change nothing and call nothing
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000001';
update public.content_items set edited = '{"id": "__ce_official", "name": "Hacked"}' where id = '__ce_official';
select is((select edited from public.content_items where id = '__ce_official'), null, 'a player cannot edit content');
select throws_ok($$ select * from public.item_usage('__ce_used') $$, 'P0001', 'Only owners can see where content is used.', 'players cannot see usage');
select throws_ok($$ select public.delete_content_item('__ce_free') $$, 'P0001', 'Only owners can delete content.', 'players cannot delete content');
select throws_ok($$ select public.save_bionic('X', '', '', '', 500, 1, false, '[]') $$, 'P0001', 'Only owners can change biomods.', 'players cannot save a bionic');
set local request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000002';
update public.content_items set edited = '{"id": "__ce_official", "name": "Hacked"}' where id = '__ce_official';
select is((select edited from public.content_items where id = '__ce_official'), null, 'a GM cannot edit content');
select throws_ok($$ select public.delete_content_item('__ce_free') $$, 'P0001', 'Only owners can delete content.', 'GMs cannot delete content');
select throws_ok($$ select public.save_bionic('X', '', '', '', 500, 1, false, '[]') $$, 'P0001', 'Only owners can change biomods.', 'GMs cannot save a bionic');

-- An owner edits an official item; a pack update keeps the edit and changes only the pack's own data
set local request.jwt.claim.sub = 'cccccccc-0000-4000-8000-000000000003';
select lives_ok($$ update public.content_items set edited = '{"id": "__ce_official", "name": "Campaign gun"}' where id = '__ce_official' $$, 'an owner can edit an official item');
select throws_ok($$ update public.content_items set edited = '{"id": "other", "name": "Wrong id"}' where id = '__ce_official' $$, '23514', null, 'an edit must keep the item''s id');
select throws_ok($$ update public.content_items set edited = '{"id": "__ce_official", "name": " "}' where id = '__ce_official' $$, '23514', null, 'an edit needs a name');
select lives_ok($$ select public.import_lcp(
  '{"name": "__CE_OFFICIAL", "author": "Test", "version": "2.0.0", "description": "Update"}',
  '[{"id": "__ce_official", "kind": "weapons", "data": {"id": "__ce_official", "name": "Official gun v2"}}]',
  9201, (select imported_at from public.content_packs where id = 9201)) $$, 'the pack can be updated');
select is((select data->>'name' from public.content_items where id = '__ce_official'), 'Official gun v2', 'the update changed the pack''s own data');
select is((select edited->>'name' from public.content_items where id = '__ce_official'), 'Campaign gun', 'the update kept the campaign''s edit');
select lives_ok($$ update public.content_items set edited = null where id = '__ce_official' $$, 'an edit can be reverted');

-- Drafts
select lives_ok($$ update public.content_items set data = '{"id": "__ce_draft", "name": "Draft gear 2"}' where id = '__ce_draft' $$, 'a draft can be edited');
select lives_ok($$ select public.import_lcp(
  '{"name": "Campaign homebrew", "author": "Test", "version": "1.0.0", "description": "Re-import"}',
  '[{"id": "__ce_draft", "kind": "pilot_gear", "data": {"id": "__ce_draft", "name": "Draft gear 3"}}]',
  9202, (select imported_at from public.content_packs where id = 9202)) $$, 'the homebrew pack can be re-imported');
select is((select draft from public.content_items where id = '__ce_draft'), true, 'editing or re-importing does not publish a draft');
select lives_ok($$ update public.content_items set draft = false where id = '__ce_draft' $$, 'an owner can publish a draft');
select throws_ok($$ update public.content_items set draft = true where id = '__ce_draft' $$, 'P0001', 'A published item can''t go back to a draft: pilots may already use it.', 'a published item cannot go back to a draft');

select lives_ok($$ update public.content_items set data = '{"id": "__ce_free", "name": "Free tag 2"}' where id = '__ce_free' $$, 'an owner can change a homebrew item');

-- Usage and deleting
select results_eq($$ select character_id, pilot from public.item_usage('__ce_used') $$, $$ values (9200::bigint, 'Wren'::text) $$, 'usage finds the pilot whose sheet holds the item');
select is((select count(*)::int from public.item_usage('__ce_free')), 0, 'an unused item has no users');
select results_eq($$ select pilot from public.item_usage('9301', true) $$, $$ values ('Wren'::text) $$, 'bionic usage matches the number exactly');
select is((select count(*)::int from public.item_usage('9302', true)), 0, 'an unused bionic has no users');
select is((select count(*)::int from public.item_usage('3', true)), 0, 'a bionic id is not matched inside other numbers');
select throws_ok($$ select public.delete_content_item('__ce_used') $$, 'P0001', 'Wren uses this item.', 'a used item cannot be deleted');
select throws_ok($$ select public.delete_content_item('__ce_official') $$, 'P0001', 'Only items in the Campaign homebrew pack can be deleted.', 'official items cannot be deleted one by one');
select throws_ok($$ delete from public.content_items where id = '__ce_free' $$, '42501', null, 'there is still no direct delete');
select lives_ok($$ select public.delete_content_item('__ce_free') $$, 'an unused homebrew item can be deleted');
select is((select count(*)::int from public.content_items where id = '__ce_free'), 0, 'and it is gone');

-- Bionics: created, changed and guarded together with their bonuses
select lives_ok($$ select public.save_bionic('  Neural link ', 'Faster', ' Head ', '<p>+1 acuity</p>', 750, 2, false, '[{"stat_id": "acuity", "amount": 2}]') $$, 'a bionic can be created with its bonuses');
select is((select count(*)::int from public.bionics where name = 'Neural link'), 1, 'the name is trimmed');
select is((select b.amount from public.bionic_bonuses b join public.bionics n on n.id = b.bionic_id where n.name = 'Neural link' and b.stat_id = 'acuity'), 2, 'its bonus is saved');
select results_eq($$ select slot, effect, manna_cost from public.bionics where name = 'Neural link' $$, $$ values ('Head'::text, '<p>+1 acuity</p>'::text, 750) $$, 'slot, effect and price are saved (slot trimmed)');
select lives_ok($$ select public.save_bionic('Old arm', 'Heavier', 'Arm', '<p>Hits harder</p>', 900, 1, false, '[]', 9301, (select updated_at from public.bionics where id = 9301)) $$, 'slot, effect and price can be changed');
select results_eq($$ select slot, manna_cost from public.bionics where id = 9301 $$, $$ values ('Arm'::text, 900) $$, 'the changed slot and price are kept');
select lives_ok($$ select public.save_bionic('Visor', '', 'Eyes', '', 500, 1, false, '[]', null, null, ' HORUS ') $$, 'a biomod can be created with a manufacturer');
select is((select source from public.bionics where name = 'Visor'), 'HORUS', 'the manufacturer is saved (trimmed)');
select lives_ok($$ select public.save_bionic('Old arm', 'Heavier', 'Arm', '<p>Hits harder</p>', 900, 1, false, '[]', 9301, (select updated_at from public.bionics where id = 9301), 'IPS-N') $$, 'the manufacturer can be set on update');
select is((select source from public.bionics where id = 9301), 'IPS-N', 'the changed manufacturer is kept');
select lives_ok($$ select public.save_bionic('Old arm', 'Heavier', 'Arm', '<p>Hits harder</p>', 900, 1, false, '[]', 9301, (select updated_at from public.bionics where id = 9301), '') $$, 'an empty manufacturer is allowed');
select is((select source from public.bionics where id = 9301), null, 'an empty manufacturer is stored as none');
select throws_ok($$ select public.save_bionic('Bad price', '', '', '', -1, 1, false, '[]') $$, '23514', null, 'a negative price is refused');
select lives_ok($$ select public.save_bionic('Old arm', 'Heavier', '', '', 500, 1, false, '[{"stat_id": "dexterity", "amount": 1}]', 9301, (select updated_at from public.bionics where id = 9301)) $$, 'a bionic can be changed');
select results_eq($$ select stat_id from public.bionic_bonuses where bionic_id = 9301 $$, $$ values ('dexterity'::text) $$, 'its bonuses are replaced, not added to');
select throws_ok($$ select public.save_bionic('Old arm', '', '', '', 500, 1, false, '[]', 9301, now() - interval '1 day') $$, 'P0001', 'This biomod changed somewhere else, or no longer exists.', 'a stale save is refused');
select throws_ok($$ select public.save_bionic('Old arm', '', '', '', 500, 1, false, '[{"stat_id": "nonsense", "amount": 1}]', 9301, (select updated_at from public.bionics where id = 9301)) $$, '23503', null, 'a bonus must point at a stat that exists');
select is((select count(*)::int from public.bionic_bonuses where bionic_id = 9301 and stat_id = 'dexterity'), 1, 'the refused save changed nothing');
select throws_ok($$ select public.save_bionic('Twice', '', '', '', 500, 1, false, '[{"stat_id": "acuity", "amount": 1}, {"stat_id": "acuity", "amount": 2}]') $$, 'P0001', 'The bonuses must be a list with one amount per stat.', 'one amount per stat');

select * from finish();
rollback;
