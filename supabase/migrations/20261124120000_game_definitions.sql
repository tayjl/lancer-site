-- The small game lists (damage types, range types, mount types ...) as content rows instead of code constants.
-- Everyone logged in reads them; only owners add or change a row. Deleting goes through delete_definition(), which refuses
-- while an item or a pilot sheet still uses the id.
create table public.game_definitions (
  kind text not null check (kind in ('damage_types', 'range_types', 'activations', 'uses', 'frame_roles', 'frame_sizes',
    'weapon_types', 'weapon_sizes', 'weapon_mounts', 'mount_types', 'gear_types', 'system_types', 'deployable_types')),
  -- The exact value stored on items and sheets. Never renamed: change the label instead.
  id text not null check (id <> ''),
  label text not null check (btrim(label) <> ''),
  -- What a kind needs beyond its label: icon (icon file name), colour (a CSS variable NAME from style.css, never a hex),
  -- slots and hint (mount types).
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  sort integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (kind, id),
  -- Frame sizes are compared as numbers by delete_definition.
  check (kind <> 'frame_sizes' or id ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$')
);
create trigger game_definitions_updated_at
  before update on public.game_definitions
  for each row execute procedure extensions.moddatetime (updated_at);

-- Items and sheets store the id, so renaming one would orphan them.
create function public.game_definitions_freeze_id() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.kind is distinct from old.kind then
    raise exception 'A definition''s id can''t change.';
  end if;
  return new;
end;
$$;
create trigger game_definitions_freeze_id
  before update on public.game_definitions
  for each row execute function public.game_definitions_freeze_id();

alter table public.game_definitions enable row level security;
create policy "Logged-in users read definitions" on public.game_definitions for select to authenticated using (true);
create policy "Owners add definitions" on public.game_definitions for insert to authenticated with check ((select public.is_owner()));
create policy "Owners change definitions" on public.game_definitions for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
revoke all on public.game_definitions from public, anon, authenticated;
grant select, insert, update on public.game_definitions to authenticated;

-- Owner only. Refuses while the id appears as a quoted JSON value in a content item (original or edited) or in a pilot
-- sheet or pending change. A conservative text match: a shared word like "Main" can block a delete, never allow a wrong one.
create function public.delete_definition(target_kind text, target_id text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  needle text := to_jsonb(target_id)::text;
  size_number numeric;
  used integer;
begin
  if not public.is_owner() then
    raise exception 'Only owners can delete definitions.';
  end if;
  if target_kind = 'frame_sizes' then
    if target_id !~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' then
      raise exception 'A frame size must be a number.';
    end if;
    size_number := target_id::numeric;
  end if;
  if not exists (select 1 from public.game_definitions where kind = target_kind and id = target_id) then
    raise exception 'No such definition.';
  end if;

  -- Nobody can start using the id between the check and the delete.
  lock table public.character_sheets, public.pending_changes in share mode;

  -- Frame sizes are stored as numbers (9.0 equals 9), so compare them as numbers.
  select (select count(*) from public.content_items i
          where case when target_kind = 'frame_sizes'
                     then exists (select 1 from jsonb_path_query(i.data, '$.**.size') v where jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric = size_number)
                          or exists (select 1 from jsonb_path_query(i.edited, '$.**.size') v where jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric = size_number)
                     else position(needle in i.data::text) > 0 or position(needle in coalesce(i.edited::text, '')) > 0 end)
       + (select count(*) from public.character_sheets s
          where case when target_kind = 'frame_sizes'
                     then exists (select 1 from jsonb_path_query(s.sheet, '$.**.size') v where jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric = size_number)
                     else position(needle in s.sheet::text) > 0 end)
       + (select count(*) from public.pending_changes p
          where p.status = 'pending'
            and case when target_kind = 'frame_sizes'
                     then exists (select 1 from jsonb_path_query(p.proposed_sheet, '$.**.size') v where jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric = size_number)
                     else position(needle in p.proposed_sheet::text) > 0 end)
  into used;
  if used > 0 then
    raise exception 'Used by % %', used, case when used = 1 then 'item' else 'items' end;
  end if;

  delete from public.game_definitions where kind = target_kind and id = target_id;
end;
$$;
revoke execute on function public.delete_definition(text, text) from public, anon;
grant execute on function public.delete_definition(text, text) to authenticated;

-- Owner only. Saves one kind's whole list in one transaction: any bad row or stale row undoes the lot. Adds and updates only,
-- never deletes (delete_definition does that). rows is an array of {id, label, data, sort, hidden, updated_at?}. updated_at
-- is the value the editor loaded for an existing row: when it differs from the stored one, someone else saved first.
create function public.save_definitions(target_kind text, rows jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb;
  seen text[] := '{}';
  row_id text;
  stored timestamptz;
begin
  if not public.is_owner() then
    raise exception 'Only owners can save definitions.';
  end if;
  if target_kind is null or target_kind not in ('damage_types', 'range_types', 'activations', 'uses', 'frame_roles', 'frame_sizes',
    'weapon_types', 'weapon_sizes', 'weapon_mounts', 'mount_types', 'gear_types', 'system_types', 'deployable_types') then
    raise exception 'Unknown list.';
  end if;
  if rows is null or jsonb_typeof(rows) <> 'array' then
    raise exception 'Send the list as an array.';
  end if;
  if jsonb_array_length(rows) > 200 then
    raise exception 'A list can have at most 200 rows.';
  end if;

  for r in select value from jsonb_array_elements(rows) loop
    if jsonb_typeof(r) <> 'object' then
      raise exception 'Each row must be an object.';
    end if;
    if jsonb_typeof(r -> 'id') is distinct from 'string' or (r ->> 'id') = '' then
      raise exception 'Every row needs an id.';
    end if;
    row_id := r ->> 'id';
    if row_id = any (seen) then
      raise exception 'The id % is used twice.', row_id;
    end if;
    seen := seen || row_id;
    if target_kind = 'frame_sizes' and row_id !~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' then
      raise exception 'A frame size must be a number.';
    end if;
    if char_length(row_id) > 60 then
      raise exception 'An id can have at most 60 characters.';
    end if;
    if jsonb_typeof(r -> 'label') is distinct from 'string' or btrim(r ->> 'label') = '' then
      raise exception 'Every row needs a label.';
    end if;
    if char_length(r ->> 'label') > 60 then
      raise exception 'A label can have at most 60 characters.';
    end if;
    if jsonb_typeof(r -> 'data') is distinct from 'object' then
      raise exception 'Row data must be an object.';
    end if;
    if pg_column_size(r -> 'data') > 8192 then
      raise exception 'Row data is too large.';
    end if;
    if jsonb_typeof(r -> 'sort') is distinct from 'number'
       or (r ->> 'sort')::numeric <> trunc((r ->> 'sort')::numeric)
       or abs((r ->> 'sort')::numeric) > 1000000 then
      raise exception 'Sort must be a whole number.';
    end if;
    if jsonb_typeof(r -> 'hidden') is distinct from 'boolean' then
      raise exception 'Hidden must be true or false.';
    end if;

    select d.updated_at into stored from public.game_definitions d
      where d.kind = target_kind and d.id = row_id for update;
    if found then
      if jsonb_typeof(r -> 'updated_at') is distinct from 'string' or (r ->> 'updated_at')::timestamptz <> stored then
        raise exception 'Someone else changed this.';
      end if;
    elsif jsonb_typeof(r -> 'updated_at') = 'string' then
      raise exception 'Someone else changed this.';
    end if;

    insert into public.game_definitions (kind, id, label, data, sort, hidden)
    values (target_kind, row_id, r ->> 'label', r -> 'data', (r ->> 'sort')::numeric::integer, (r ->> 'hidden')::boolean)
    on conflict (kind, id) do update
      set label = excluded.label, data = excluded.data, sort = excluded.sort, hidden = excluded.hidden;
  end loop;
end;
$$;
revoke execute on function public.save_definitions(text, jsonb) from public, anon;
grant execute on function public.save_definitions(text, jsonb) to authenticated;

-- Keep in step with the constants in src (the definitions test compares them). One row per current value; id is what items store.
insert into public.game_definitions (kind, id, label, data, sort) values
  ('damage_types', 'Kinetic', 'Kinetic', '{"icon":"kinetic","colour":"--dmg-kinetic"}', 0),
  ('damage_types', 'Energy', 'Energy', '{"icon":"energy","colour":"--dmg-energy"}', 1),
  ('damage_types', 'Explosive', 'Explosive', '{"icon":"explosive","colour":"--dmg-explosive"}', 2),
  ('damage_types', 'Burn', 'Burn', '{"icon":"burn","colour":"--dmg-burn"}', 3),
  ('damage_types', 'Heat', 'Heat', '{"icon":"heat","colour":"--dmg-heat"}', 4),
  ('damage_types', 'Variable', 'Variable', '{"icon":"variable","colour":"--dmg-variable"}', 5),
  ('range_types', 'Range', 'Range', '{"icon":"range"}', 0),
  ('range_types', 'Threat', 'Threat', '{"icon":"threat"}', 1),
  ('range_types', 'Line', 'Line', '{"icon":"line"}', 2),
  ('range_types', 'Cone', 'Cone', '{"icon":"cone"}', 3),
  ('range_types', 'Blast', 'Blast', '{"icon":"blast"}', 4),
  ('range_types', 'Burst', 'Burst', '{"icon":"burst"}', 5),
  ('activations', 'Quick', 'Quick', '{"icon":"activation_quick","colour":"--act-quick"}', 0),
  ('activations', 'Full', 'Full', '{"icon":"activation_full","colour":"--act-full"}', 1),
  ('activations', 'Reaction', 'Reaction', '{"icon":"reaction","colour":"--act-reaction"}', 2),
  ('activations', 'Protocol', 'Protocol', '{"icon":"protocol","colour":"--act-protocol"}', 3),
  ('activations', 'Free', 'Free', '{"icon":"free_action","colour":"--act-free"}', 4),
  ('activations', 'Quick Tech', 'Quick Tech', '{"icon":"tech_quick","colour":"--act-tech"}', 5),
  ('activations', 'Full Tech', 'Full Tech', '{"icon":"tech_full","colour":"--act-tech"}', 6),
  ('activations', 'Invade', 'Invade', '{"icon":"tech_quick","colour":"--act-tech"}', 7),
  ('activations', 'Overcharge', 'Overcharge', '{"icon":"overcharge","colour":"--act-overcharge"}', 8),
  ('uses', 'Turn', 'Turn', '{}', 0),
  ('uses', 'Next Turn', 'Next Turn', '{}', 1),
  ('uses', 'Round', 'Round', '{}', 2),
  ('uses', 'Next Round', 'Next Round', '{}', 3),
  ('uses', 'Scene', 'Scene', '{}', 4),
  ('uses', 'Encounter', 'Encounter', '{}', 5),
  ('uses', 'Mission', 'Mission', '{}', 6),
  ('uses', 'Free', 'Free', '{}', 7),
  ('frame_roles', 'Balanced', 'Balanced', '{}', 0),
  ('frame_roles', 'Striker', 'Striker', '{}', 1),
  ('frame_roles', 'Defender', 'Defender', '{}', 2),
  ('frame_roles', 'Support', 'Support', '{}', 3),
  ('frame_roles', 'Controller', 'Controller', '{}', 4),
  ('frame_roles', 'Artillery', 'Artillery', '{}', 5),
  ('frame_sizes', '0.5', '½', '{}', 0),
  ('frame_sizes', '1', '1', '{}', 1),
  ('frame_sizes', '2', '2', '{}', 2),
  ('frame_sizes', '3', '3', '{}', 3),
  ('weapon_types', 'Rifle', 'Rifle', '{}', 0),
  ('weapon_types', 'Cannon', 'Cannon', '{}', 1),
  ('weapon_types', 'CQB', 'CQB', '{}', 2),
  ('weapon_types', 'Launcher', 'Launcher', '{}', 3),
  ('weapon_types', 'Melee', 'Melee', '{}', 4),
  ('weapon_types', 'Nexus', 'Nexus', '{}', 5),
  ('weapon_sizes', 'Auxiliary', 'Auxiliary', '{}', 0),
  ('weapon_sizes', 'Main', 'Main', '{}', 1),
  ('weapon_sizes', 'Heavy', 'Heavy', '{}', 2),
  ('weapon_sizes', 'Superheavy', 'Superheavy', '{}', 3),
  ('mount_types', 'Main', 'Main', '{"slots":[["Main","Auxiliary"]],"hint":"Takes one Main or Auxiliary weapon."}', 0),
  ('mount_types', 'Heavy', 'Heavy', '{"slots":[["Superheavy","Heavy","Main","Auxiliary"]],"hint":"Takes one weapon of any size."}', 1),
  ('mount_types', 'Superheavy', 'Superheavy', '{"slots":[["Superheavy"]],"hint":"Takes one Superheavy weapon."}', 2),
  ('mount_types', 'Flex', 'Flex', '{"slots":[["Main","Auxiliary"],["Auxiliary"]],"hint":"Takes one Main or two Auxiliary weapons."}', 3),
  ('mount_types', 'Main/Aux', 'Main/Aux', '{"slots":[["Main","Auxiliary"],["Auxiliary"]],"hint":"Takes one Main and one Auxiliary weapon."}', 4),
  ('mount_types', 'Aux/Aux', 'Aux/Aux', '{"slots":[["Auxiliary"],["Auxiliary"]],"hint":"Takes two Auxiliary weapons."}', 5),
  ('mount_types', 'Auxiliary', 'Auxiliary', '{"slots":[["Auxiliary"]]}', 6),
  ('mount_types', 'Integrated Auxiliary', 'Integrated Auxiliary', '{"slots":[["Auxiliary"]]}', 7),
  ('gear_types', 'Armor', 'Armor', '{}', 0),
  ('gear_types', 'Weapon', 'Weapon', '{}', 1),
  ('gear_types', 'Gear', 'Gear', '{}', 2),
  ('system_types', 'System', 'System', '{}', 0),
  ('system_types', 'AI', 'AI', '{}', 1),
  ('system_types', 'Shield', 'Shield', '{}', 2),
  ('system_types', 'Deployable', 'Deployable', '{}', 3),
  ('system_types', 'Drone', 'Drone', '{}', 4),
  ('system_types', 'Tech', 'Tech', '{}', 5),
  ('system_types', 'Armor', 'Armor', '{}', 6),
  ('system_types', 'Flight System', 'Flight System', '{}', 7),
  ('system_types', 'Integrated', 'Integrated', '{}', 8),
  ('deployable_types', 'Deployable', 'Deployable', '{}', 0),
  ('deployable_types', 'Drone', 'Drone', '{}', 1),
  ('deployable_types', 'Mine', 'Mine', '{}', 2);
