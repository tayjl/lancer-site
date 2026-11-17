-- Owners can remove an imported pack, but only while no pilot uses any of its items: pilots store item ids in
-- their sheet, so a missing item would break their sheet. The tables still have no delete grant; this is the
-- only way to delete.

-- One row per pilot per item that the pilot uses: in their sheet, or in an open change (a draft or one waiting
-- for review). Dead pilots count too. Owners only.
-- The id is looked for as a quoted JSON string in the sheet's text, which finds it both as a value (gear lists,
-- frames, mounts) and as a key (the licence and talent maps). It can also match inside writing, which only blocks
-- a removal, the safe side.
create function public.pack_usage()
returns table (pack_id bigint, character_id bigint, pilot text, item_name text)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only owners can see where pack content is used.';
  end if;

  -- Each sheet is turned into text once ("materialized"), not once per item.
  return query
  with sheets as materialized (
    select s.character_id, s.sheet::text as body from public.character_sheets s
    union all
    select p.character_id, p.proposed_sheet::text from public.pending_changes p where p.status = 'pending'
  )
  select distinct i.pack_id, c.id,
         coalesce(nullif(btrim(c.callsign), ''), nullif(btrim(c.pilot_name), ''), 'Unnamed pilot'),
         coalesce(i.data->>'name', i.id)
  from sheets t
  join public.characters c on c.id = t.character_id
  join public.content_items i on position(to_jsonb(i.id)::text in t.body) > 0;
end;
$$;

-- Deletes a pack and its items, all-or-nothing, unless a pilot uses any of them. Owners only.
create function public.remove_pack(target_pack_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  users text[];
begin
  if not public.is_owner() then
    raise exception 'Only owners can remove content packs.';
  end if;
  if not exists (select 1 from public.content_packs where id = target_pack_id) then
    raise exception 'Pack % does not exist.', target_pack_id;
  end if;

  -- Nobody can start using an item between the check and the delete.
  lock table public.character_sheets, public.pending_changes in share mode;

  select array_agg(distinct u.pilot order by u.pilot) into users
  from public.pack_usage() u where u.pack_id = target_pack_id;
  if users is not null then
    raise exception '% use% items from this pack.',
      case when cardinality(users) = 1 then users[1]
           else array_to_string(users[1:cardinality(users) - 1], ', ') || ' and ' || users[cardinality(users)] end,
      case when cardinality(users) = 1 then 's' else '' end;
  end if;

  delete from public.content_items where pack_id = target_pack_id;
  delete from public.content_packs where id = target_pack_id;
end;
$$;

revoke execute on function public.pack_usage(), public.remove_pack(bigint) from public, anon;
grant execute on function public.pack_usage(), public.remove_pack(bigint) to authenticated;
