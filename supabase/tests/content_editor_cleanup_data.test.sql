-- content_editor_cleanup_data (migration 20261124110000): the stored seed rows follow the new seed.
-- Run with: supabase test db. Read-only checks of the migrated rows, so they hold for local owner edits too.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is((select count(*) from public.content_items where kind = 'rules' and id like 'rule\_tag\_list\_%'), 0::bigint, 'the Tags card list rows are gone');
select is((select count(*) from public.content_items where id = 'rule_notes_overcharge_later'), 0::bigint, 'the later-uses overcharge note is gone');
select is((select count(*) from public.content_items where kind = 'rules' and id like 'rule\_num\_%' and coalesce(edited, data) ->> 'group' is distinct from 'economy'), 0::bigint, 'every economy number is in the economy group');
select is((select count(*) from public.content_items where id in ('rule_numbers_overcharge_heat', 'rule_numbers_repair_cost') and coalesce(edited, data) ->> 'group' is distinct from 'combat'), 0::bigint, 'the combat numbers are in the combat group');
select is((select count(*) from public.content_items where kind = 'rules' and data ->> 'text' like '%{REPAIR}%'), 0::bigint, 'no stored text uses the old {REPAIR} placeholder');
select is((select count(*) from public.content_items where kind = 'tags' and id in ('tg_limited', 'tg_unique', 'tg_ap') and data ->> 'combat_page' is distinct from 'true'), 0::bigint, 'the listed tags carry the combat page flag');

select * from finish();
rollback;
