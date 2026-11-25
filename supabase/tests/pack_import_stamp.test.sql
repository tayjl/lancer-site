-- Migration 20261125160000: a pack import doesn't stamp content_saves, an editor insert does.
-- Run with: supabase test db. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-4000-8000-0000000000a3', 'pis-owner@test.local', '{"full_name": "Owner"}');
update public.profiles set role = 'owner' where id = 'eeeeeeee-0000-4000-8000-0000000000a3';

insert into public.content_packs (id, name, manifest) overriding system value values (9921, '__PIS_PACK', '{}');
insert into public.content_packs (name, manifest) values ('Campaign homebrew', '{}') on conflict (name) do nothing;

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-0000-4000-8000-0000000000a3';

insert into public.content_items (id, pack_id, kind, data) values ('__pis_imported', 9921, 'weapons', '{"id": "__pis_imported", "name": "Imported"}');
select is((select count(*) from public.content_saves where key = '__pis_imported'), 0::bigint, 'an insert into another pack is not stamped');

insert into public.content_items (id, pack_id, kind, data, draft)
  values ('__pis_homebrew', (select id from public.content_packs where name = 'Campaign homebrew'), 'weapons', '{"id": "__pis_homebrew", "name": "Mine"}', true);
select is((select count(*) from public.content_saves where key = '__pis_homebrew'), 1::bigint, 'an insert into the homebrew pack is stamped');

select * from finish();
rollback;
