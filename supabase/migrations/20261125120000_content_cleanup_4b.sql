-- Content editor step 4b: what src/ hard-coded about mounts and weapon types moves into Definitions rows.
-- A. mount_types data flags: integrated (Integrated Auxiliary), superheavy (Superheavy).
-- B. Data-only rows, hidden so no picker offers them but an item that has one still passes: the weapon size 'Ship-class'
--    (weapons store it in "mount", which the editor checks against weapon_sizes) and the weapon types 'Special',
--    'Spool Weapon', '???'. data.dataOnly marks them.
-- C. weapon_mounts leaves the kind check and save_definitions (no rows, no readers).

-- Hosted may hold weapon_mounts rows saved under 4a, which would make the new check abort.
delete from public.game_definitions where kind = 'weapon_mounts';
alter table public.game_definitions drop constraint if exists game_definitions_kind_check;
alter table public.game_definitions add constraint game_definitions_kind_check check (kind in ('damage_types', 'range_types',
  'activations', 'uses', 'frame_roles', 'frame_sizes', 'weapon_types', 'weapon_sizes', 'mount_types',
  'gear_types', 'system_types', 'deployable_types', 'status_groups'));

update public.game_definitions set data = data || '{"integrated": true}' where kind = 'mount_types' and id = 'Integrated Auxiliary';
update public.game_definitions set data = data || '{"superheavy": true}' where kind = 'mount_types' and id = 'Superheavy';

insert into public.game_definitions (kind, id, label, data, sort, hidden) values
  ('weapon_sizes', 'Ship-class', 'Ship-class', '{"dataOnly":true}', 4, true),
  ('weapon_types', 'Special', 'Special', '{"dataOnly":true}', 6, true),
  ('weapon_types', 'Spool Weapon', 'Spool Weapon', '{"dataOnly":true}', 7, true),
  ('weapon_types', '???', '???', '{"dataOnly":true}', 8, true)
on conflict (kind, id) do nothing;

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
    'weapon_types', 'weapon_sizes', 'mount_types', 'gear_types', 'system_types', 'deployable_types', 'status_groups') then
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
