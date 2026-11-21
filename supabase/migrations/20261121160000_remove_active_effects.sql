-- COMP/CON's hidden "active_effects" (short rewordings of an item's rules text) are removed from the site's content, at any
-- depth, in `data` and in `edited` (a null edit stays null). Nothing else in the JSON changes. A backup of every one is in
-- docs/data/hidden-effects-backup.json. The changed rows get a new updated_at (moddatetime trigger), so an owner with one of
-- them open in the content editor is told to reload: acceptable for a one-off.
create function private.strip_active_effects(item jsonb) returns jsonb
  language plpgsql
  immutable
  set search_path = ''
as $$
begin
  case jsonb_typeof(item)
    when 'object' then
      return (select coalesce(jsonb_object_agg(e.key, private.strip_active_effects(e.value)), '{}'::jsonb)
              from jsonb_each(item) e where e.key <> 'active_effects');
    when 'array' then
      return (select coalesce(jsonb_agg(private.strip_active_effects(a.value) order by a.n), '[]'::jsonb)
              from jsonb_array_elements(item) with ordinality a(value, n));
    else
      return item;
  end case;
end;
$$;

create function private.backfill_active_effects() returns void
  language sql
  security invoker
  set search_path = ''
as $$
  update public.content_items
  set data = private.strip_active_effects(data), edited = private.strip_active_effects(edited)
  where data::text like '%"active_effects"%' or edited::text like '%"active_effects"%';
$$;

select private.backfill_active_effects();

revoke all on function private.strip_active_effects(jsonb), private.backfill_active_effects() from public, anon, authenticated;
