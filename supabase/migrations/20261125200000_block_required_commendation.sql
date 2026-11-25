-- A commendation can't be deleted while an item requires it: hide it instead. Replaces private.block_used_commendation()
-- from 20261125150000_block_used_delete.sql (pilots holding it are still checked first; the trigger stays as it is).
-- Requirements live in content_items (edited ?? data, drafts too) and bionics.requires.
create or replace function private.block_used_commendation() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  users text[];
  items text[];
  needle jsonb := jsonb_build_array(jsonb_build_object('kind', 'commendation', 'id', old.id::text));
begin
  select array_agg(n order by n) into users from (
    select distinct coalesce(nullif(btrim(c.callsign), ''), nullif(btrim(c.pilot_name), ''), 'Unnamed pilot') as n
    from public.pilot_commendations pc join public.characters c on c.id = pc.character_id
    where pc.commendation_id = old.id
  ) x;
  if users is not null then
    raise exception '% ha% this commendation. Hide it instead.',
      case when cardinality(users) = 1 then users[1]
           else array_to_string(users[1:cardinality(users) - 1], ', ') || ' and ' || users[cardinality(users)] end,
      case when cardinality(users) = 1 then 's' else 've' end;
  end if;

  select array_agg(n order by n) into items from (
    select distinct coalesce(nullif(btrim(coalesce(i.edited, i.data) ->> 'name'), ''), i.id) as n
    from public.content_items i
    where coalesce(i.edited, i.data) -> 'requires' @> needle
    union
    select distinct coalesce(nullif(btrim(b.name), ''), 'Unnamed biomod')
    from public.bionics b
    where b.requires @> needle
  ) x;
  if items is not null then
    raise exception '% require% this commendation. Hide it instead.',
      case when cardinality(items) = 1 then items[1]
           else array_to_string(items[1:cardinality(items) - 1], ', ') || ' and ' || items[cardinality(items)] end,
      case when cardinality(items) = 1 then 's' else '' end;
  end if;
  return old;
end;
$$;

