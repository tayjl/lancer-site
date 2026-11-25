-- Content editor step 4a.
-- A. status_groups, a new Definitions kind: the combat page's status cards (id is what a statuses rule stores in data.group,
--    mode says which view shows the card). Seed equals DEFAULT_DEFINITIONS in src/definitions.ts (definitions.test.ts).
-- B. The four damage type rule rows go. Text an owner wrote on one is copied into its damage type first.
-- C. delete_definition and save_definitions know status_groups. A group is in use while a statuses rule has it.

alter table public.game_definitions drop constraint if exists game_definitions_kind_check;
alter table public.game_definitions add constraint game_definitions_kind_check check (kind in ('damage_types', 'range_types',
  'activations', 'uses', 'frame_roles', 'frame_sizes', 'weapon_types', 'weapon_sizes', 'weapon_mounts', 'mount_types',
  'gear_types', 'system_types', 'deployable_types', 'status_groups'));

insert into public.game_definitions (kind, id, label, data, sort) values
  ('status_groups', 'cover', 'Cover and stealth', '{"icon":"shield","mode":"mech"}', 0),
  ('status_groups', 'conditions', 'Conditions', '{"icon":"warning","mode":"mech"}', 1),
  ('status_groups', 'other', 'Other statuses', '{"icon":"info","mode":"mech"}', 2),
  ('status_groups', 'pilot', 'On foot', '{"icon":"pilot","mode":"pilot"}', 3)
on conflict (kind, id) do nothing;

do $do$
declare
  r record;
  def_ public.game_definitions;
  rule_ public.content_items;
  owner_text text;
begin
  -- B. Rule row id and the damage type it described.
  for r in select * from (values
  ('rule_attacks_kinetic', 'Kinetic'), ('rule_attacks_explosive', 'Explosive'),
  ('rule_attacks_energy', 'Energy'), ('rule_attacks_burn', 'Burn')
  ) as v(id, damage) loop
    select * into rule_ from public.content_items where id = r.id and kind = 'rules';
    if not found then
      continue; -- already gone
    end if;
    owner_text := nullif(btrim(coalesce(rule_.edited ->> 'text', rule_.data ->> 'text', '')), '');
    if owner_text is not null then
      select * into def_ from public.game_definitions where kind = 'damage_types' and id = r.damage;
      if not found then
        raise notice 'Deleted % with its text: the damage type % is gone, so the text was not copied: %', r.id, r.damage, owner_text;
      elsif nullif(btrim(coalesce(def_.data ->> 'text', '')), '') is null then
        update public.game_definitions set data = data || jsonb_build_object('text', owner_text) where kind = 'damage_types' and id = r.damage;
        raise notice 'Copied the text of % into damage type %: review it.', r.id, r.damage;
      else
        raise notice 'Deleted % with text that differs from damage type % (kept): %', r.id, r.damage, owner_text;
      end if;
    end if;
    delete from public.content_items where id = r.id and kind = 'rules';
  end loop;
end;
$do$;

create or replace function public.delete_definition(target_kind text, target_id text) returns void
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

  -- A status group is used by the status rules in it: data.group holds the id exactly (a rule's edit may move it).
  if target_kind = 'status_groups' then
    select count(*) into used from public.content_items i
    where i.kind = 'rules'
      and coalesce(i.edited, i.data) ->> 'section' = 'statuses'
      and coalesce(i.edited, i.data) ->> 'group' = target_id;
    if used > 0 then
      raise exception 'Used by % %', used, case when used = 1 then 'item' else 'items' end;
    end if;
    delete from public.game_definitions where kind = target_kind and id = target_id;
    return;
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

create or replace function public.save_definitions(target_kind text, rows jsonb) returns void
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
    'weapon_types', 'weapon_sizes', 'weapon_mounts', 'mount_types', 'gear_types', 'system_types', 'deployable_types', 'status_groups') then
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
