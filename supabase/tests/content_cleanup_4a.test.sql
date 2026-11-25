-- Content editor step 4a (migration 20261125110000): status_groups, the four damage type rule rows gone,
-- and delete_definition's in-use guard for status groups. Run with: supabase test db. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-4a00-4000-8000-000000000001', 'c4a-player@test.local', '{"full_name": "Player"}'),
  ('dddddddd-4a00-4000-8000-000000000003', 'c4a-owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'owner' where id = 'dddddddd-4a00-4000-8000-000000000003';

insert into public.content_packs (id, name, manifest) overriding system value values (9904, '__C4A_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('__c4_used', 9904, 'rules', '{"id": "__c4_used", "section": "statuses", "group": "__c4_group", "name": "X"}', null),
  ('__c4_moved', 9904, 'rules', '{"id": "__c4_moved", "section": "statuses", "group": "cover", "name": "Y"}', '{"id": "__c4_moved", "section": "statuses", "group": "__c4_moved_group", "name": "Y"}'),
  ('__c4_shadow', 9904, 'rules', '{"id": "__c4_shadow", "section": "statuses", "group": "__c4_shadow_group", "name": "W"}', '{"id": "__c4_shadow", "section": "statuses", "group": "other", "name": "W"}'),
  ('__c4_words', 9904, 'rules', '{"id": "__c4_words", "section": "statuses", "group": "cover", "name": "Z", "text": "Anything other than this, and the conditions"}', null);
insert into public.game_definitions (kind, id, label, data) values
  ('status_groups', '__c4_group', 'Used group', '{"icon": "info", "mode": "mech"}'),
  ('status_groups', '__c4_moved_group', 'Moved group', '{"icon": "info", "mode": "mech"}'),
  ('status_groups', '__c4_shadow_group', 'Shadow group', '{"icon": "info", "mode": "mech"}'),
  ('status_groups', '__c4_free', 'Free group', '{"icon": "info", "mode": "mech"}');

-- Seed
select is((select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'data', data, 'sort', sort, 'hidden', hidden) order by sort)
  from public.game_definitions where kind = 'status_groups' and left(id, 2) <> '__'),
  '[{"id": "cover", "data": {"icon": "shield", "mode": "mech"}, "sort": 0, "label": "Cover and stealth", "hidden": false},
    {"id": "conditions", "data": {"icon": "warning", "mode": "mech"}, "sort": 1, "label": "Conditions", "hidden": false},
    {"id": "other", "data": {"icon": "info", "mode": "mech"}, "sort": 2, "label": "Other statuses", "hidden": false},
    {"id": "pilot", "data": {"icon": "pilot", "mode": "pilot"}, "sort": 3, "label": "On foot", "hidden": false}]'::jsonb,
  'the four status groups are seeded');
select is((select count(*) from public.content_items where kind = 'rules' and id in ('rule_attacks_kinetic', 'rule_attacks_explosive', 'rule_attacks_energy', 'rule_attacks_burn')),
  0::bigint, 'the four damage type rule rows are gone');
select throws_ok($$ insert into public.game_definitions (kind, id, label) values ('nonsense', 'x', 'x') $$, '23514', null, 'an unknown kind is still refused');

-- Re-running the migration's rule row block (hosted may hold owner text)
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('rule_attacks_kinetic', 9904, 'rules', '{"id": "rule_attacks_kinetic", "section": "attacks", "group": "damage_type", "text": ""}', '{"id": "rule_attacks_kinetic", "name": "Kinetic", "text": "Owner kinetic words."}'),
  ('rule_attacks_burn', 9904, 'rules', '{"id": "rule_attacks_burn", "section": "attacks", "group": "damage_type", "text": ""}', null);
-- The migration's data block again, copied from it (the test runner can't include files).
do $do$
declare
  r record;
  def_ public.game_definitions;
  rule_ public.content_items;
  owner_text text;
begin
  -- B. Rule row id and the damage type it described.
  for r in select * from (values
  ('rule_attacks_kinetic', 'Kinetic'), ('rule_attacks_explosive', 'Explosive'),
  ('rule_attacks_energy', 'Energy'), ('rule_attacks_burn', 'Burn')
  ) as v(id, damage) loop
    select * into rule_ from public.content_items where id = r.id and kind = 'rules';
    if not found then
      continue; -- already gone
    end if;
    owner_text := nullif(btrim(coalesce(rule_.edited ->> 'text', rule_.data ->> 'text', '')), '');
    if owner_text is not null then
      select * into def_ from public.game_definitions where kind = 'damage_types' and id = r.damage;
      if not found then
        raise notice 'Deleted % with its text: the damage type % is gone, so the text was not copied: %', r.id, r.damage, owner_text;
      elsif nullif(btrim(coalesce(def_.data ->> 'text', '')), '') is null then
        update public.game_definitions set data = data || jsonb_build_object('text', owner_text) where kind = 'damage_types' and id = r.damage;
        raise notice 'Copied the text of % into damage type %: review it.', r.id, r.damage;
      else
        raise notice 'Deleted % with text that differs from damage type % (kept): %', r.id, r.damage, owner_text;
      end if;
    end if;
    delete from public.content_items where id = r.id and kind = 'rules';
  end loop;
end;
$do$;
select is((select data ->> 'text' from public.game_definitions where kind = 'damage_types' and id = 'Kinetic'), 'Owner kinetic words.', 'owner text on a rule row moves into its damage type');
select is((select data ->> 'text' from public.game_definitions where kind = 'damage_types' and id = 'Burn'), null, 'an empty rule row adds no text');
select is((select count(*) from public.content_items where id in ('rule_attacks_kinetic', 'rule_attacks_burn')), 0::bigint, 'the rule rows are deleted again');
select is((select count(*) from public.game_definitions where kind = 'status_groups' and left(id, 2) <> '__'), 4::bigint, 'the seed does not duplicate or overwrite');

-- Player
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-4a00-4000-8000-000000000001';
select is((select count(*) from public.game_definitions where kind = 'status_groups' and left(id, 2) <> '__'), 4::bigint, 'a player can read status groups');
select throws_ok($$ insert into public.game_definitions (kind, id, label) values ('status_groups', 'mine', 'Mine') $$, '42501', null, 'a player cannot add a status group');
update public.game_definitions set label = 'Hacked' where kind = 'status_groups' and id = 'cover';
select is((select label from public.game_definitions where kind = 'status_groups' and id = 'cover'), 'Cover and stealth', 'a player cannot change a status group');
select throws_ok($$ delete from public.game_definitions where kind = 'status_groups' and id = '__c4_free' $$, '42501', null, 'a player cannot delete a status group');
select throws_ok($$ select public.delete_definition('status_groups', '__c4_free') $$, 'P0001', 'Only owners can delete definitions.', 'a player cannot call the guard');
select throws_ok($$ select public.save_definitions('status_groups', '[]') $$, 'P0001', 'Only owners can save definitions.', 'a player cannot save status groups');

-- Owner
set local request.jwt.claim.sub = 'dddddddd-4a00-4000-8000-000000000003';
select throws_ok($$ select public.delete_definition('status_groups', '__c4_group') $$, 'P0001', 'Used by 1 item', 'a group a rule uses is refused');
select throws_ok($$ select public.delete_definition('status_groups', '__c4_moved_group') $$, 'P0001', 'Used by 1 item', 'a group an edited rule uses is refused');
select lives_ok($$ select public.delete_definition('status_groups', '__c4_shadow_group') $$, 'a group only the overridden data names deletes');
select lives_ok($$ select public.delete_definition('status_groups', '__c4_free') $$, 'an unused owner-added group deletes');
select is((select count(*) from public.game_definitions where id = '__c4_free'), 0::bigint, 'and it is gone');
select lives_ok($$ select public.save_definitions('status_groups', '[{"id": "__c4_new", "label": "New", "data": {"icon": "info", "mode": "mech"}, "sort": 9, "hidden": false}]') $$, 'an owner can save a status group');
select lives_ok($$ select public.delete_definition('status_groups', '__c4_new') $$, 'and delete it');
select throws_ok($$ select public.delete_definition('weapon_types', 'Nothing') $$, 'P0001', 'No such definition.', 'other kinds keep their behaviour');

select * from finish();
rollback;
