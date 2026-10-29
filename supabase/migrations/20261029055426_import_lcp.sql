-- A pack and all its items must save together. Invoker security keeps existing
-- owner RLS policies in force; the explicit role check fails before any writes.
create function public.import_lcp(
  pack_manifest jsonb,
  pack_items jsonb,
  expected_pack_id bigint default null,
  expected_imported_at timestamptz default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  existing public.content_packs%rowtype;
  saved_id bigint;
  total integer;
  updated integer;
  retained integer;
  written integer;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Only owners can import content packs.';
  end if;
  if jsonb_typeof(pack_manifest) is distinct from 'object' then
    raise exception 'The manifest must be a JSON object.';
  end if;
  if exists (
    select 1 from unnest(array['name','author','version']) as required(key)
    where jsonb_typeof(pack_manifest->key) is distinct from 'string'
      or length(btrim(pack_manifest->>key)) not between 1 and 300
  ) or jsonb_typeof(pack_manifest->'description') is distinct from 'string' then
    raise exception 'The manifest needs a name, author, version and description.';
  end if;
  if pack_manifest->>'version' !~ '^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9_.-]+)?(\+[A-Za-z0-9_.-]+)?$' then
    raise exception 'The pack version should look like 1.0.0.';
  end if;
  if jsonb_typeof(pack_items) is distinct from 'array' then
    raise exception 'The pack items must be a list.';
  end if;
  total := jsonb_array_length(pack_items);
  if total not between 1 and 10000 or octet_length(pack_items::text) > 25000000
    or octet_length(pack_manifest::text) > 200000 then
    raise exception 'This import is too large, or contains no items.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(pack_items) as incoming(item)
    where jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'id') is distinct from 'string'
      or length(btrim(item->>'id')) not between 1 and 300
      or item->>'id' <> btrim(item->>'id')
      or jsonb_typeof(item->'kind') is distinct from 'string'
      or item->>'kind' not in ('frames','weapons','systems','pilot_gear','talents','core_bonuses','tags','manufacturers')
      or jsonb_typeof(item->'data') is distinct from 'object'
      or item->'data'->>'id' is distinct from item->>'id'
      or jsonb_typeof(item->'data'->'name') is distinct from 'string'
      or length(btrim(item->'data'->>'name')) < 1
  ) then
    raise exception 'Every item needs a valid ID, supported type, matching data ID and name.';
  end if;
  if (select count(distinct item->>'id') from jsonb_array_elements(pack_items) as incoming(item)) <> total then
    raise exception 'Duplicate item IDs in this pack.';
  end if;

  -- Serialise importer calls so conflicts are checked against a consistent catalogue.
  perform pg_catalog.pg_advisory_xact_lock(20261029, 1);
  select * into existing from public.content_packs
    where name = btrim(pack_manifest->>'name') for update;
  if existing.id is distinct from expected_pack_id or existing.imported_at is distinct from expected_imported_at then
    raise exception 'The installed pack changed after preview. Refresh the preview and try again.';
  end if;
  if exists (
    select 1 from public.content_items i
    join jsonb_array_elements(pack_items) as incoming(item) on i.id = item->>'id'
    where i.pack_id is distinct from existing.id or i.kind is distinct from item->>'kind'
  ) then
    raise exception 'An item ID belongs to another pack or would change type. No content was imported.';
  end if;
  select count(*) into updated from public.content_items i
    where i.pack_id = existing.id and exists (
      select 1 from jsonb_array_elements(pack_items) as incoming(item) where item->>'id' = i.id);
  select count(*) into retained from public.content_items i
    where i.pack_id = existing.id and not exists (
      select 1 from jsonb_array_elements(pack_items) as incoming(item) where item->>'id' = i.id);

  if existing.id is null then
    insert into public.content_packs (name, version, manifest, imported_by)
    values (btrim(pack_manifest->>'name'), pack_manifest->>'version', pack_manifest, auth.uid())
    returning id into saved_id;
  else
    saved_id := existing.id;
    update public.content_packs set version = pack_manifest->>'version', manifest = pack_manifest,
      imported_by = auth.uid(), imported_at = clock_timestamp(), enabled = true
      where id = saved_id;
  end if;
  insert into public.content_items (id, pack_id, kind, data)
    select item->>'id', saved_id, item->>'kind', item->'data'
    from jsonb_array_elements(pack_items) as incoming(item)
    on conflict (id) do update set data = excluded.data
      where public.content_items.pack_id = saved_id and public.content_items.kind = excluded.kind;
  get diagnostics written = row_count;
  if written <> total then
    raise exception 'The catalogue changed during import. No content was imported; preview again.';
  end if;
  -- Items absent from an update remain stored, preserving existing pilot references.
  return jsonb_build_object('pack_id', saved_id, 'added', total - updated, 'updated', updated, 'retained', retained);
end;
$$;

revoke execute on function public.import_lcp(jsonb,jsonb,bigint,timestamptz) from public, anon;
grant execute on function public.import_lcp(jsonb,jsonb,bigint,timestamptz) to authenticated;
