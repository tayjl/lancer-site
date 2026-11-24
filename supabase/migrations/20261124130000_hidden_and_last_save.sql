-- Content editor cleanup, phase 7a: "hidden from players" for factions and commendations, and the editor's "Saved by NAME, date".
--
-- Hidden. Items of every content_items kind are hidden with edited.hidden (data.hidden for homebrew), which the site already
-- reads as edited ?? data, so they need nothing here. Bionics keep using retired. Factions and commendations get a column.
-- The existing owner-only write policies cover it. Hidden rows stay readable: it only means "not offered", and pilots who
-- already have the bionic or award still show it.
alter table public.organisations add column hidden boolean not null default false;
alter table public.commendations add column hidden boolean not null default false;

-- Last save. One owner-only table instead of an updated_by column on five tables that every player can read: a column can't
-- be hidden from players by privileges (they share the authenticated role), and a separate table also leaves every
-- existing select * alone. Only the trigger below writes it (no insert, update or delete grant for anyone).
-- source is the table name; key is the row's id (game_definitions: kind/id).
create table public.content_saves (
  source text not null check (source in ('content_items', 'bionics', 'organisations', 'commendations', 'game_definitions')),
  key text not null,
  saved_by uuid references public.profiles (id) on delete set null,
  saved_at timestamptz not null default now(),
  primary key (source, key)
);
create index content_saves_saved_by_idx on public.content_saves (saved_by);

alter table public.content_saves enable row level security;
revoke all on public.content_saves from public, anon, authenticated;
grant select on public.content_saves to authenticated;
create policy "Owners read last saves" on public.content_saves for select to authenticated using ((select public.is_owner()));

-- Stamps the logged-in user and time. Nothing a client sends can reach it. No logged-in user (a migration, the dashboard)
-- leaves the stamp alone. Re-importing a pack rewrites 'data' of official items, which isn't a save, so an update counts only
-- when the owner's copy (edited) or draft changed, or when a homebrew item's data did.
create function private.stamp_save() returns trigger
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

create trigger content_items_stamp_save after insert or update or delete on public.content_items
  for each row execute function private.stamp_save();
create trigger bionics_stamp_save after insert or update or delete on public.bionics
  for each row execute function private.stamp_save();
create trigger organisations_stamp_save after insert or update or delete on public.organisations
  for each row execute function private.stamp_save();
create trigger commendations_stamp_save after insert or update or delete on public.commendations
  for each row execute function private.stamp_save();
create trigger game_definitions_stamp_save after insert or update or delete on public.game_definitions
  for each row execute function private.stamp_save();
