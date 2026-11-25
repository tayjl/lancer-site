-- Content cleanup step 3b (migration 20261125100000): the loadout numbers (loadout_armour, loadout_weapons, loadout_gear)
-- decide what is free and what fits, and the data half only touches rows that still hold the old seed text.
-- Run with: supabase test db. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'c3a@test.local', '{"full_name": "Player A"}'),
  ('b2222222-2222-2222-2222-222222222222', 'c3b@test.local', '{"full_name": "Player B"}');
insert into public.content_packs (id, name, manifest) overriding system value values (9803, '__C3B_PACK', '{}');
delete from public.content_items where kind = 'rules' and id like 'rule\_num\_%'; -- leftovers of local editing

insert into public.content_items (id, pack_id, kind, data) values
  ('__c3_armor', 9803, 'pilot_gear', '{"id": "__c3_armor", "name": "Armour", "type": "Armor"}'),
  ('__c3_armor2', 9803, 'pilot_gear', '{"id": "__c3_armor2", "name": "Heavy armour", "type": "Armor", "manna_cost": 250}'),
  ('__c3_gun', 9803, 'pilot_gear', '{"id": "__c3_gun", "name": "Pistol", "type": "Weapon"}'),
  ('__c3_gun2', 9803, 'pilot_gear', '{"id": "__c3_gun2", "name": "Rifle", "type": "Weapon"}'),
  ('__c3_kit', 9803, 'pilot_gear', '{"id": "__c3_kit", "name": "Kit", "type": "Gear"}');

-- 900: Player A's new pilot (no manna). 901: Player B's approved pilot owning two of each armour and weapon.
insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (900, 'a1111111-1111-1111-1111-111111111111', 'pending', 'Ay', 'Ay'),
  (901, 'b2222222-2222-2222-2222-222222222222', 'approved', 'Bee', 'Bee');
insert into public.character_sheets (character_id, sheet, manna) values
  (900, '{"owned_gear": [{"key": "p1", "id": "__c3_armor"}, {"key": "p2", "id": "__c3_armor2"}], "equipped_gear": []}', 0),
  (901, '{"owned_gear": [{"key": "a1", "id": "__c3_armor", "free": true}, {"key": "a2", "id": "__c3_armor2", "free": true},
      {"key": "w1", "id": "__c3_gun", "free": true}, {"key": "w2", "id": "__c3_gun2", "free": true}, {"key": "k1", "id": "__c3_kit", "free": true}],
    "equipped_gear": []}', 0);

-- ---------------------------------------------------------------------
-- Defaults are today's numbers
-- ---------------------------------------------------------------------
select is((select array[public.rule_number('loadout_armour'), public.rule_number('loadout_weapons'), public.rule_number('loadout_gear')]),
  array[1, 2, 3]::numeric[], 'the loadout defaults are 1 armour, 2 weapons and 3 gear');
select is((select jsonb_path_query_array(public.settle_pilot_gear(sheet, null, true) -> 'owned_gear', '$[*].free') from public.character_sheets where character_id = 901),
  '[true, false, true, true, true]', 'by default the first armour, two weapons and a gear are free');

-- ---------------------------------------------------------------------
-- Changing a number changes what is free
-- ---------------------------------------------------------------------
insert into public.content_items (id, pack_id, kind, data) values
  ('rule_num_loadout_armour', 9803, 'rules', '{"numbers": [2]}'),
  ('rule_num_loadout_weapons', 9803, 'rules', '{"numbers": [1]}'),
  ('rule_num_loadout_gear', 9803, 'rules', '{"numbers": [0]}');
select is((select jsonb_path_query_array(public.settle_pilot_gear(sheet, null, true) -> 'owned_gear', '$[*].free') from public.character_sheets where character_id = 901),
  '[true, true, true, false, false]', 'with 2 armour, 1 weapon and 0 gear the free items follow');
update public.content_items set data = '{"numbers": [9]}' where id = 'rule_num_loadout_armour';
select is(public.rule_number('loadout_armour'), 1::numeric, 'a number outside 0 to 6 falls back to the default');
update public.content_items set data = '{"numbers": [2]}' where id = 'rule_num_loadout_armour';

-- ---------------------------------------------------------------------
-- Changing a number changes what the submit check refuses (Player A, no manna)
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select lives_ok($$ update public.characters set submitted_at = now() where id = 900 $$, 'two armours submit when two are free');
reset role;
update public.characters set submitted_at = null where id = 900;
update public.content_items set data = '{"numbers": [1]}' where id = 'rule_num_loadout_armour';
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select throws_ok($$ update public.characters set submitted_at = now() where id = 900 $$, 'P0001',
  'This spends 250 manna, but only 0 was received.', 'with one free armour the second is charged and refused');

-- A player still can't write "free": a new item gets none, even with the number raised.
reset role;
update public.content_items set data = '{"numbers": [6]}' where id = 'rule_num_loadout_armour';
set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear}', (sheet -> 'owned_gear') || '{"key": "p3", "id": "__c3_armor", "free": true}')
  where character_id = 900;
select is((select sheet -> 'owned_gear' -> 2 -> 'free' from public.character_sheets where character_id = 900), null,
  'a player''s free flag on a new item is dropped');
select is((select sheet -> 'owned_gear' -> 1 -> 'free' from public.character_sheets where character_id = 900), null,
  'and a player can''t add one to an existing item');
reset role;

-- ---------------------------------------------------------------------
-- Equipping follows the numbers, and the message uses them
-- ---------------------------------------------------------------------
update public.content_items set data = '{"numbers": [1]}' where id = 'rule_num_loadout_armour';
update public.content_items set data = '{"numbers": [2]}' where id = 'rule_num_loadout_weapons';
update public.content_items set data = '{"numbers": [3]}' where id = 'rule_num_loadout_gear';
set local role authenticated;
set local request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
select throws_ok($$ select public.equip_pilot_gear(901, array['a1', 'a2']) $$, 'P0001', 'Only 1 pilot armour fits.', 'one armour by default');
select lives_ok($$ select public.equip_pilot_gear(901, array['a1', 'w1', 'w2']) $$, 'two weapons by default');
reset role;

update public.content_items set data = '{"numbers": [2]}' where id = 'rule_num_loadout_armour';
update public.content_items set data = '{"numbers": [1]}' where id = 'rule_num_loadout_weapons';
update public.content_items set data = '{"numbers": [0]}' where id = 'rule_num_loadout_gear';
set local role authenticated;
set local request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
select lives_ok($$ select public.equip_pilot_gear(901, array['a1', 'a2']) $$, 'two armours fit when the number is 2');
select throws_ok($$ select public.equip_pilot_gear(901, array['w1', 'w2']) $$, 'P0001', 'Only 1 pilot weapon fits.', 'the message uses the number, singular');
select throws_ok($$ select public.equip_pilot_gear(901, array['k1']) $$, 'P0001', 'No pilot gear fits.', 'zero gear slots');
reset role;
update public.content_items set data = '{"numbers": [4]}' where id = 'rule_num_loadout_weapons';
update public.content_items set data = '{"numbers": [1]}' where id = 'rule_num_loadout_armour';
update public.character_sheets set sheet = jsonb_set(sheet, '{owned_gear}', (sheet -> 'owned_gear') ||
  '[{"key": "w3", "id": "__c3_gun"}, {"key": "w4", "id": "__c3_gun"}, {"key": "w5", "id": "__c3_gun"}]') where character_id = 901;
set local role authenticated;
set local request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
select throws_ok($$ select public.equip_pilot_gear(901, array['w1', 'w2', 'w3', 'w4', 'w5']) $$, 'P0001', 'Only 4 pilot weapons fit.', 'the message uses the number, plural');
reset role;

-- ---------------------------------------------------------------------
-- Data half: the same loop as the migration, on two rows and one delete
-- ---------------------------------------------------------------------
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('__c3_tag', 9803, 'tags', '{"id": "__c3_tag", "name": "Tag", "description": "Old words."}',
    '{"id": "__c3_tag", "name": "Tag", "description": "Owner words."}'),
  ('__c3_plain', 9803, 'rules', '{"id": "__c3_plain", "text": "Old words."}', null),
  ('__c3_moved', 9803, 'rules', '{"id": "__c3_moved", "text": "Someone changed this."}', null),
  ('__c3_gone', 9803, 'rules', '{"id": "__c3_gone", "text": "Old seed."}', null),
  ('__c3_kept', 9803, 'rules', '{"id": "__c3_kept", "text": "Old seed."}', '{"id": "__c3_kept", "name": "Kept", "text": "Mine."}');

do $do$
declare
  r record;
  row_ public.content_items;
begin
  for r in select * from (values
    ('__c3_tag', 'tags', 'description', $t$Old words.$t$, $t$New words.$t$),
    ('__c3_plain', 'rules', 'text', $t$Old words.$t$, $t$New words.$t$),
    ('__c3_moved', 'rules', 'text', $t$Old words.$t$, $t$New words.$t$)
  ) as v(id, kind, col, old_text, new_text) loop
    select * into row_ from public.content_items where id = r.id and kind = r.kind;
    if not found then
      raise notice 'Skipped %: no such row.', r.id;
    elsif row_.data -> r.col = to_jsonb(r.new_text) then
      null;
    elsif row_.data -> r.col is distinct from to_jsonb(r.old_text) then
      raise notice 'Skipped % (%): the stored text is not the old seed text.', r.id, r.col;
    else
      update public.content_items set data = jsonb_set(data, array[r.col], to_jsonb(r.new_text)) where id = r.id and kind = r.kind;
      if row_.edited is not null then
        raise notice 'Updated the seed text of % (%), but the owner has edited it: review the edit.', r.id, r.col;
      end if;
    end if;
  end loop;

  for r in select * from (values
    ('__c3_gone', $t$Old seed.$t$),
    ('__c3_kept', $t$Old seed.$t$)
  ) as v(id, old_text) loop
    select * into row_ from public.content_items where id = r.id and kind = 'rules';
    if not found then
      null;
    elsif row_.edited is not null or row_.data ->> 'text' is distinct from r.old_text then
      raise notice 'Kept %: it was edited or changed. Delete it by hand if it is not needed.', r.id;
    else
      delete from public.content_items where id = r.id and kind = 'rules';
    end if;
  end loop;
end;
$do$;

select is((select data ->> 'text' from public.content_items where id = '__c3_plain'), 'New words.', 'an unchanged row gets the new text');
select is((select data ->> 'description' from public.content_items where id = '__c3_tag'), 'New words.', 'an edited row''s original gets it too');
select is((select edited ->> 'description' from public.content_items where id = '__c3_tag'), 'Owner words.', 'and the owner''s edit is untouched');
select is((select data ->> 'text' from public.content_items where id = '__c3_moved'), 'Someone changed this.', 'a row that no longer holds the old text is left alone');
select ok(not exists (select 1 from public.content_items where id = '__c3_gone'), 'an untouched removed row is deleted');
select is((select edited ->> 'text' from public.content_items where id = '__c3_kept'), 'Mine.', 'an edited removed row is kept');

select * from finish();
rollback;
