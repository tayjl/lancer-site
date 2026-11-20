-- New pilots start with 2000 manna (it was 1500). Only the column's default changes: pilots that already have a sheet
-- keep what they have (no backfill, no reward log rows).
alter table public.character_sheets alter column manna set default 2000;

-- Copied from 20261119150000_starting_manna.sql; only the starting manna changes.
-- A player's first sheet insert (made when a pilot registers) takes the defaults, so the guard accepts the default
-- manna (2000) and still refuses any other value. Level must still start at 0.
create or replace function public.guard_gm_only_sheet_fields() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;
  if tg_op = 'INSERT' and (new.level <> 0 or new.manna <> 2000) then
    raise exception 'Only GMs and owners can set level and manna.';
  end if;
  if tg_op = 'UPDATE' and (new.level is distinct from old.level or new.manna is distinct from old.manna) then
    raise exception 'Only GMs and owners can change level and manna.';
  end if;
  return new;
end;
$$;

-- Copied from 20261119170000_enforce_picker_rules.sql (see its header for what this checks); only the starting manna
-- changes. Its two triggers already point at it, so they stay as they are.
create or replace function private.guard_submit_rules() returns trigger
language plpgsql set search_path = ''
as $$
declare
  -- Manna prices. Keep these in step with PRICES in src/rules.ts (src/rules.test.ts reads this file to check).
  licence_rank_price constant integer := 600;
  talent_rank_price constant integer := 300;
  extra_mech_price constant integer := 500;
  -- character_sheets.manna's default (20261121090000_starting_manna_2000.sql), for a pilot with no sheet row yet.
  starting_manna constant integer := 2000;

  proposed jsonb;
  approved jsonb;
  mechs jsonb;
  received numeric;
  spent numeric;
  exotic_names text;
  gm_names text;
  problems text[] := '{}';
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;

  if tg_table_name = 'characters' then
    select s.sheet, s.manna into proposed, received from public.character_sheets s where s.character_id = new.id;
    mechs := new.mechs;
  else
    proposed := new.proposed_sheet;
    mechs := new.proposed_public -> 'mechs';
    select s.sheet, s.manna into approved, received from public.character_sheets s where s.character_id = new.character_id;
  end if;
  proposed := coalesce(proposed, '{}');
  approved := coalesce(approved, '{}');
  received := coalesce(received, starting_manna);

  -- 1. Restricted content that is in the proposal and wasn't already approved. Content reads edited ?? data, like loadKind().
  with item as (
    select i.id, i.kind, coalesce(i.edited, i.data) as d from public.content_items i
  ), flagged as (
    select it.id, coalesce(it.d ->> 'name', it.id) as name,
      upper(btrim(coalesce(it.d ->> 'source', ''))) = 'EXOTIC'
        or exists (
          select 1 from jsonb_array_elements(case when jsonb_typeof(it.d -> 'tags') = 'array' then it.d -> 'tags' else '[]' end) t
          where upper(btrim(coalesce(t ->> 'id', t #>> '{}'))) = 'TG_EXOTIC'
        ) as exotic,
      exists (
        select 1
        from unnest(array[it.d ->> 'source', it.d ->> 'type', it.d ->> 'license', it.d ->> 'category', f.d ->> 'source', f.d ->> 'name']) label
        where upper(btrim(label)) in ('HORUS', 'NHC')
      ) as gm
    from item it
    left join item f on f.kind = 'frames' and f.id = it.d ->> 'license_id'
  ), added as (
    select name, exotic, gm from flagged
    where (exotic or gm)
      and position(to_jsonb(id)::text in proposed::text) > 0
      and position(to_jsonb(id)::text in approved::text) = 0
    union all
    select b.name,
      upper(btrim(coalesce(b.source, ''))) = 'EXOTIC',
      upper(btrim(coalesce(b.source, ''))) in ('HORUS', 'NHC')
    from public.bionics b
    where upper(btrim(coalesce(b.source, ''))) in ('EXOTIC', 'HORUS', 'NHC')
      and coalesce(proposed -> 'bionics' @> to_jsonb(b.id), false)
      and not coalesce(approved -> 'bionics' @> to_jsonb(b.id), false)
  )
  select string_agg(distinct name, ', ') filter (where exotic),
         string_agg(distinct name, ', ') filter (where gm and not exotic)
  into exotic_names, gm_names
  from added;

  if exotic_names is not null then
    problems := problems || ('Exotic items need a GM to add them: ' || exotic_names || '.');
  end if;
  if gm_names is not null then
    problems := problems || ('GM-only items need a GM to add them: ' || gm_names || '.');
  end if;

  -- 2. Manna: licence ranks and talent ranks (their numbers added up), each biomod at its own price (an unknown id costs
  -- nothing, a repeated id is paid twice), and every mech after the first. Not-a-number entries count for nothing.
  select
    coalesce((
      select sum(greatest(0, (e.value #>> '{}')::numeric)
                 * case k.key when 'licences' then licence_rank_price else talent_rank_price end)
      from (values ('licences'), ('talents')) k(key)
      cross join lateral jsonb_each(case when jsonb_typeof(proposed -> k.key) = 'object' then proposed -> k.key else '{}' end) e
      where jsonb_typeof(e.value) = 'number'
    ), 0)
    + coalesce((
      select sum(b.manna_cost)
      from jsonb_array_elements(case when jsonb_typeof(proposed -> 'bionics') = 'array' then proposed -> 'bionics' else '[]' end) e
      join public.bionics b on b.id = case when jsonb_typeof(e) = 'number' then (e #>> '{}')::numeric end
    ), 0)
    + greatest(0, case when jsonb_typeof(mechs) = 'array' then jsonb_array_length(mechs) else 0 end - 1) * extra_mech_price
  into spent;

  if spent > received then
    problems := problems || format('This spends %s manna, but only %s was received.',
      to_char(spent, 'FM999,999,999,999'), to_char(received, 'FM999,999,999,999'));
  end if;

  if cardinality(problems) > 0 then
    raise exception '%', array_to_string(problems, ' ');
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_submit_rules() from public;
