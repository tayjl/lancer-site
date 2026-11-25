-- Migration 20261125160000: importing a pack is not a save. stamp_save is the 20261124130000 body with one change: a
-- content_items insert into a pack other than 'Campaign homebrew' is left unstamped. The homebrew pack
-- (where the editor creates items) still stamps. pack_id is not null, so there is no null case.
create or replace function private.stamp_save() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  o jsonb;
  j jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  row_key text := case when tg_table_name = 'game_definitions' then (j ->> 'kind') || '/' || (j ->> 'id') else j ->> 'id' end;
begin
  if tg_op = 'DELETE' then
    delete from public.content_saves where source = tg_table_name and key = row_key;
    return old;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if tg_table_name = 'content_items' and tg_op = 'INSERT' and exists (
       select 1 from public.content_packs p where p.id = (j ->> 'pack_id')::bigint and p.name <> 'Campaign homebrew') then
    return new;
  end if;
  if tg_table_name = 'content_items' and tg_op = 'UPDATE' then
    o := to_jsonb(old);
    if o -> 'edited' is not distinct from j -> 'edited' and o -> 'draft' = j -> 'draft'
       and not (o -> 'data' is distinct from j -> 'data' and exists (
         select 1 from public.content_packs p where p.id = (j ->> 'pack_id')::bigint and p.name = 'Campaign homebrew')) then
      return new;
    end if;
  end if;
  insert into public.content_saves (source, key, saved_by, saved_at)
  values (tg_table_name, row_key, auth.uid(), now())
  on conflict (source, key) do update set saved_by = excluded.saved_by, saved_at = excluded.saved_at;
  return new;
end;
$$;
revoke execute on function private.stamp_save() from public, anon, authenticated;
