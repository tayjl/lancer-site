-- The in-browser content editor (owners only; the existing "Owners manage ..." policies already allow it).
--
-- Imported items can be edited without losing the edit when their pack is updated: the campaign's version lives in
-- content_items.edited, apart from the pack's own data. import_lcp only ever writes data (on conflict ... set data),
-- so an update keeps every edit. The site reads edited ?? data. Reverting is setting edited back to null.
-- New homebrew items go in the owners' own pack ("Campaign homebrew") and start as drafts, which the site's pickers
-- and archives skip until an owner publishes them. A published item can't go back to a draft: pilots may already use it.
alter table public.content_items
  add column edited jsonb,
  add column draft boolean not null default false,
  add column updated_at timestamptz not null default now(),
  add constraint content_items_edited_valid check (
    edited is null or (jsonb_typeof(edited) = 'object' and edited->>'id' = id and length(btrim(coalesce(edited->>'name', ''))) > 0)
  );

-- When a row last changed, so the editor can tell it was saved somewhere else and refuse to overwrite it (the same
-- guard the pilot sheet uses). The two site tables the editor also changes get it too.
alter table public.bionics add column updated_at timestamptz not null default now();
alter table public.pilot_stats add column updated_at timestamptz not null default now();

create trigger content_items_updated_at before update on public.content_items
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger bionics_updated_at before update on public.bionics
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger pilot_stats_updated_at before update on public.pilot_stats
  for each row execute procedure extensions.moddatetime (updated_at);

create function private.keep_published() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not old.draft and new.draft then
    raise exception 'A published item can''t go back to a draft: pilots may already use it.';
  end if;
  return new;
end;
$$;

create trigger content_items_keep_published before update on public.content_items
  for each row execute procedure private.keep_published();

-- The pilots (one row each) that use one item, in their sheet or in an open change (a draft or one waiting for
-- review), dead ones too. Owners only. Found the way pack_usage() finds them: the id as a quoted JSON string anywhere
-- in the sheet, which can also match inside writing (that only blocks a delete, the safe side). Bionics are numbers in
-- a list, so they're looked for exactly: is_bionic.
create function public.item_usage(item_id text, is_bionic boolean default false)
returns table (character_id bigint, pilot text)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only owners can see where content is used.';
  end if;

  return query
  with sheets as materialized (
    select s.character_id, s.sheet as body from public.character_sheets s
    union all
    select p.character_id, p.proposed_sheet from public.pending_changes p where p.status = 'pending'
  )
  select distinct c.id,
         coalesce(nullif(btrim(c.callsign), ''), nullif(btrim(c.pilot_name), ''), 'Unnamed pilot')
  from sheets t
  join public.characters c on c.id = t.character_id
  where case when is_bionic then t.body->'bionics' @> to_jsonb(item_id::bigint)
             else position(to_jsonb(item_id)::text in t.body::text) > 0 end;
end;
$$;

-- Deletes one item of the owners' own pack, unless a pilot uses it. Official items are removed with their pack
-- (remove_pack), or put back to the original (edited = null), never one by one.
create function public.delete_content_item(target_id text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  users text[];
begin
  if not public.is_owner() then
    raise exception 'Only owners can delete content.';
  end if;
  if not exists (
    select 1 from public.content_items i join public.content_packs p on p.id = i.pack_id
    where i.id = target_id and p.name = 'Campaign homebrew'
  ) then
    raise exception 'Only items in the Campaign homebrew pack can be deleted.';
  end if;

  -- Nobody can start using the item between the check and the delete.
  lock table public.character_sheets, public.pending_changes in share mode;

  select array_agg(u.pilot order by u.pilot) into users from public.item_usage(target_id) u;
  if users is not null then
    raise exception '% use% this item.',
      case when cardinality(users) = 1 then users[1]
           else array_to_string(users[1:cardinality(users) - 1], ', ') || ' and ' || users[cardinality(users)] end,
      case when cardinality(users) = 1 then 's' else '' end;
  end if;

  delete from public.content_items where id = target_id;
end;
$$;

-- Creates (target_id null) or changes a bionic and its stat bonuses together, all-or-nothing. A bonus must point at
-- a stat that exists (the foreign key). Invoker security: the owner policies on both tables still apply.
-- Returns the bionic's id and new updated_at. A bionic changed since expected_updated_at is refused.
create function public.save_bionic(
  new_name text,
  new_description text,
  new_mod_cost integer,
  new_retired boolean,
  new_bonuses jsonb,
  target_id bigint default null,
  expected_updated_at timestamptz default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  saved_id bigint;
  saved_at timestamptz;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Only owners can change bionics.';
  end if;
  if length(btrim(coalesce(new_name, ''))) = 0 then
    raise exception 'A bionic needs a name.';
  end if;
  if jsonb_typeof(new_bonuses) is distinct from 'array'
    or exists (select 1 from jsonb_array_elements(new_bonuses) as b(item) where jsonb_typeof(item) is distinct from 'object'
               or jsonb_typeof(item->'stat_id') is distinct from 'string' or jsonb_typeof(item->'amount') is distinct from 'number')
    or (select count(distinct item->>'stat_id') from jsonb_array_elements(new_bonuses) as b(item)) <> jsonb_array_length(new_bonuses)
  then
    raise exception 'The bonuses must be a list with one amount per stat.';
  end if;

  if target_id is null then
    insert into public.bionics (name, description, mod_point_cost, retired)
    values (btrim(new_name), new_description, new_mod_cost, new_retired)
    returning id, updated_at into saved_id, saved_at;
  else
    update public.bionics set name = btrim(new_name), description = new_description,
      mod_point_cost = new_mod_cost, retired = new_retired
    where id = target_id and updated_at = expected_updated_at
    returning id, updated_at into saved_id, saved_at;
    if saved_id is null then
      raise exception 'This bionic changed somewhere else, or no longer exists.';
    end if;
    delete from public.bionic_bonuses where bionic_id = saved_id;
  end if;

  insert into public.bionic_bonuses (bionic_id, stat_id, amount)
    select saved_id, b.stat_id, b.amount from jsonb_to_recordset(new_bonuses) as b(stat_id text, amount integer);

  return jsonb_build_object('id', saved_id, 'updated_at', saved_at);
end;
$$;

revoke execute on function public.item_usage(text, boolean), public.delete_content_item(text),
  public.save_bionic(text, text, integer, boolean, jsonb, bigint, timestamptz) from public, anon;
grant execute on function public.item_usage(text, boolean), public.delete_content_item(text),
  public.save_bionic(text, text, integer, boolean, jsonb, bigint, timestamptz) to authenticated;
