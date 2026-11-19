-- The Exotic Gear tag backfill (migration 20261119140000_exotic_tag.sql): items from the Exotic manufacturer get tg_exotic in
-- `data` and in `edited`, nothing else changes, and the table's checks still hold. Rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.content_packs (id, name, manifest) overriding system value values (9401, '__EXOTIC_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('__ex_bare', 9401, 'weapons', '{"id": "__ex_bare", "name": "Bare", "source": "EXOTIC"}', null),
  ('__ex_lower', 9401, 'systems', '{"id": "__ex_lower", "name": "Lower", "source": " exotic ", "tags": [{"id": "tg_unique"}]}', '{"id": "__ex_lower", "name": "Edited", "source": "EXOTIC", "tags": []}'),
  ('__ex_done', 9401, 'mods', '{"id": "__ex_done", "name": "Done", "source": "EXOTIC", "tags": [{"id": "tg_exotic"}]}', null),
  ('__ex_plain', 9401, 'weapons', '{"id": "__ex_plain", "name": "Plain", "source": "GMS"}', null),
  ('__ex_proto', 9401, 'weapons', '{"id": "__ex_proto", "name": "Proto", "source": "NHC", "tags": [{"id": "tg_exotic"}]}', null),
  ('__ex_gear', 9401, 'pilot_gear', '{"id": "__ex_gear", "name": "Gear", "source": "EXOTIC", "tags": ["tg_unique"]}', null),
  ('__ex_talent', 9401, 'talents', '{"id": "__ex_talent", "name": "Talent", "source": "EXOTIC"}', null);

select lives_ok($$ select private.backfill_exotic_tag() $$, 'the backfill runs');
select is((select data -> 'tags' from public.content_items where id = '__ex_bare'), '[{"id": "tg_exotic"}]'::jsonb, 'an Exotic item with no tags gets the tag');
select is((select data -> 'tags' from public.content_items where id = '__ex_lower'), '[{"id": "tg_unique"}, {"id": "tg_exotic"}]'::jsonb, 'the tag is added to the others, whatever the source''s case and spaces');
select is((select edited -> 'tags' from public.content_items where id = '__ex_lower'), '[{"id": "tg_exotic"}]'::jsonb, 'an edited version gets it too');
select is((select edited from public.content_items where id = '__ex_bare'), null, 'no edit is made up');
select is((select data -> 'tags' from public.content_items where id = '__ex_done'), '[{"id": "tg_exotic"}]'::jsonb, 'an item that has the tag is left alone');
select is((select data from public.content_items where id = '__ex_plain'), '{"id": "__ex_plain", "name": "Plain", "source": "GMS"}'::jsonb, 'other manufacturers are left alone');
select is((select data -> 'tags' from public.content_items where id = '__ex_proto'), '[{"id": "tg_exotic"}]'::jsonb, 'a tagged prototype keeps its manufacturer and tag');
select is((select data -> 'tags' from public.content_items where id = '__ex_gear'), '["tg_unique", {"id": "tg_exotic"}]'::jsonb, 'plain-id tags are kept');
select is((select data -> 'tags' from public.content_items where id = '__ex_talent'), null, 'kinds without the tag are left alone');
select is((select count(*)::int from public.content_items where id = '__ex_lower' and edited ->> 'id' = id), 1, 'an edit keeps its id');
select lives_ok($$ select private.backfill_exotic_tag() $$, 'running it again is harmless');
select is((select data -> 'tags' from public.content_items where id = '__ex_bare'), '[{"id": "tg_exotic"}]'::jsonb, 'and adds nothing twice');

select * from finish();
rollback;
