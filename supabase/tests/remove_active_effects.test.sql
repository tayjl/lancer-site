-- The hidden effects removal (migration 20261121160000_remove_active_effects.sql): every "active_effects" key goes, at any
-- depth, in `data` and in `edited`; sibling keys stay; a null edit stays null. Rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.content_packs (id, name, manifest) overriding system value values (9701, '__AE_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('__ae_frame', 9701, 'frames',
   '{"id": "__ae_frame", "name": "Frame", "traits": [{"name": "T", "description": "Trait text.", "bonuses": [{"id": "hp", "val": 1}], "active_effects": [{"name": "x"}]}], "core_system": {"name": "Core", "description": "Core text.", "actions": [{"name": "A", "active_effects": [{"name": "deep"}]}], "active_effects": [{"name": "y"}]}}',
   null),
  ('__ae_sys', 9701, 'systems',
   '{"id": "__ae_sys", "name": "System", "active_effects": [], "effect": "Effect text."}',
   '{"id": "__ae_sys", "name": "Edited", "effect": "Edited text.", "actions": [{"name": "B", "active_effects": [{"name": "z"}]}]}'),
  ('__ae_plain', 9701, 'weapons', '{"id": "__ae_plain", "name": "Plain", "effect": "Says active_effects in words."}', null);

select lives_ok($$ select private.backfill_active_effects() $$, 'the removal runs');
select ok((select bool_and(not (coalesce(data::text, '') || coalesce(edited::text, '')) like '%"active_effects"%') from public.content_items where pack_id = 9701),
  'no active_effects key is left anywhere');
select is((select data from public.content_items where id = '__ae_frame'),
  '{"id": "__ae_frame", "name": "Frame", "traits": [{"name": "T", "description": "Trait text.", "bonuses": [{"id": "hp", "val": 1}]}], "core_system": {"name": "Core", "description": "Core text.", "actions": [{"name": "A"}]}}'::jsonb,
  'nested ones go (a trait, the core system, an action inside it) and the siblings stay');
select is((select edited from public.content_items where id = '__ae_frame'), null, 'a null edit stays null');
select is((select data from public.content_items where id = '__ae_sys'), '{"id": "__ae_sys", "name": "System", "effect": "Effect text."}'::jsonb,
  'a top-level one goes, even an empty list');
select is((select edited from public.content_items where id = '__ae_sys'),
  '{"id": "__ae_sys", "name": "Edited", "effect": "Edited text.", "actions": [{"name": "B"}]}'::jsonb, 'an edited version loses them too');
select is((select data from public.content_items where id = '__ae_plain'), '{"id": "__ae_plain", "name": "Plain", "effect": "Says active_effects in words."}'::jsonb,
  'the words in text are left alone');
select is(private.strip_active_effects('[1, "a", null, [{"active_effects": 1, "k": 2}]]'), '[1, "a", null, [{"k": 2}]]'::jsonb,
  'lists keep their order and plain values');
select ok(not has_function_privilege('authenticated', 'private.strip_active_effects(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.backfill_active_effects()', 'execute'), 'signed-in users can''t run either function');

select * from finish();
rollback;
