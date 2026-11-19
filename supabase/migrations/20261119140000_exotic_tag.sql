-- Every item whose manufacturer is Exotic (source EXOTIC, any case) carries the Exotic Gear tag (tg_exotic). The content editor
-- adds it when it saves; this brings existing items in line, in `data` and in `edited` where there is one. A no-op when none lack it.
create function private.add_exotic_tag(item jsonb) returns jsonb
  language sql
  immutable
as $$
  select case
    when upper(btrim(coalesce(item ->> 'source', ''))) = 'EXOTIC'
      and jsonb_typeof(coalesce(item -> 'tags', '[]'::jsonb)) = 'array'
      and not jsonb_path_exists(item, '$.tags[*] ? (@.id == "tg_exotic" || @ == "tg_exotic")')
    then jsonb_set(item, '{tags}', coalesce(item -> 'tags', '[]'::jsonb) || '[{"id": "tg_exotic"}]'::jsonb)
    else item
  end
$$;

create function private.backfill_exotic_tag() returns void
  language sql
  security invoker
as $$
  update public.content_items
  set data = private.add_exotic_tag(data), edited = private.add_exotic_tag(edited)
  where kind in ('weapons', 'systems', 'mods', 'pilot_gear', 'frames', 'core_bonuses')
    and (data is distinct from private.add_exotic_tag(data) or edited is distinct from private.add_exotic_tag(edited));
$$;

select private.backfill_exotic_tag();

revoke all on function private.add_exotic_tag(jsonb), private.backfill_exotic_tag() from public;
