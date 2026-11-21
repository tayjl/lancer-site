-- GM edit mode can do anything (the developer, 2026-11-21): GMs and owners break the rules on purpose, giving ranks and
-- items for free and editing any service record entry. Three changes:
-- 1. character_sheets.gm_grants: what a GM gave for free. Only GMs and owners change it; players read their own row.
-- 2. guard_submit_rules counts the grants, so a player's later change on a pilot with grants isn't charged for them.
-- 3. GMs and owners edit every service record entry, player-written and site-made ones too.
-- Every other trigger on pilots, sheets, changes and the service record already lets GMs and owners through, except
-- "a dead pilot cannot come back" (dead_is_final), which stays. "One living pilot per player" only checks players.


-- =====================================================================
-- 1. gm_grants
-- =====================================================================

-- { "licences": { "<licence id>": ranks }, "talents": { "<talent id>": ranks }, "bionics": { "<bionic id>": count },
--   "gear": { "<pilot gear id>": count }, "mechs": count }, every key optional, every number whole and 0 or more.
-- That many of those ranks or items are free: per entry, min(granted, held) isn't charged (see guard_submit_rules and
-- mannaSpent in src/rules.ts). Not part of the sheet JSON, so a pending change can't carry grants.
alter table public.character_sheets
  add column gm_grants jsonb not null default '{}' check (
    jsonb_typeof(gm_grants) = 'object'
    and gm_grants - '{licences,talents,bionics,gear,mechs}'::text[] = '{}'
    and not jsonb_path_exists(gm_grants, '$.mechs ? (@.type() != "number" || @ < 0 || @.floor() != @)')
    and not jsonb_path_exists(gm_grants, '$.keyvalue() ? (@.key != "mechs" && @.value.type() != "object")')
    and not jsonb_path_exists(gm_grants, '$.keyvalue() ? (@.key != "mechs").value.* ? (@.type() != "number" || @ < 0 || @.floor() != @)')
    and octet_length(gm_grants::text) <= 20000
  );

-- Copied from 20261121090000_starting_manna_2000.sql; gm_grants joins level and manna.
create or replace function public.guard_gm_only_sheet_fields() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;
  if tg_op = 'INSERT' and (new.level <> 0 or new.manna <> 2000 or new.gm_grants <> '{}') then
    raise exception 'Only GMs and owners can set level, manna and free items.';
  end if;
  if tg_op = 'UPDATE' and (new.level is distinct from old.level or new.manna is distinct from old.manna
                           or new.gm_grants is distinct from old.gm_grants) then
    raise exception 'Only GMs and owners can change level, manna and free items.';
  end if;
  return new;
end;
$$;


-- =====================================================================
-- 3. Service record: GMs and owners edit any entry (it was "gm" entries only). Kind and author still can't change
-- (keep_timeline_origin). Players keep their own "player" entries.
-- =====================================================================

drop policy "GMs edit gm entries" on public.pilot_timeline;
create policy "GMs edit any entry" on public.pilot_timeline
  for update to authenticated using ((select public.is_gm())) with check ((select public.is_gm()));


-- =====================================================================
-- 2. guard_submit_rules: step 2 takes off what a GM gave for free (otherwise as in 20261121140000_homebrew_rules.sql)
-- =====================================================================

create or replace function private.guard_submit_rules() returns trigger
language plpgsql set search_path = ''
as $$
declare
  -- Manna prices. Keep these in step with PRICES in src/rules.ts (src/rules.test.ts reads this file to check).
  licence_rank_price constant integer := 600;
  talent_rank_price constant integer := 300;
  extra_mech_price constant integer := 500;
  -- A pilot gear item's price when its manna_cost isn't set (or isn't a whole number, 0 or more).
  default_gear_price constant integer := 100;
  -- character_sheets.manna's default (20261121090000_starting_manna_2000.sql), for a pilot with no sheet row yet.
  starting_manna constant integer := 2000;

  proposed jsonb;
  approved jsonb;
  grants jsonb;
  mechs jsonb;
  received numeric;
  spent numeric;
  exotic_names text;
  gm_names text;
  removed_names text;
  pilot_level integer;
  problems text[] := '{}';
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;

  if tg_table_name = 'characters' then
    select s.sheet, s.manna, s.level, s.gm_grants into proposed, received, pilot_level, grants from public.character_sheets s where s.character_id = new.id;
    mechs := new.mechs;
  else
    proposed := new.proposed_sheet;
    mechs := new.proposed_public -> 'mechs';
    select s.sheet, s.manna, s.level, s.gm_grants into approved, received, pilot_level, grants from public.character_sheets s where s.character_id = new.character_id;
  end if;
  proposed := coalesce(proposed, '{}');
  approved := coalesce(approved, '{}');
  received := coalesce(received, starting_manna);
  pilot_level := coalesce(pilot_level, 0);
  grants := coalesce(grants, '{}');

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
  -- nothing, a repeated id is paid twice), every mech after the first, and every owned pilot gear item that isn't free
  -- at its price (an unknown id costs nothing, like biomods). Not-a-number entries count for nothing.
  -- What a GM gave for free (gm_grants) isn't charged: per entry, max(0, held - granted) is, so removing a granted item
  -- refunds nothing and spending never goes below 0. Keep in step with mannaSpent in src/rules.ts.
  select
    coalesce((
      select sum(greatest(0, (e.value #>> '{}')::numeric - coalesce((grants -> k.key ->> e.key)::numeric, 0))
                 * case k.key when 'licences' then licence_rank_price else talent_rank_price end)
      from (values ('licences'), ('talents')) k(key)
      cross join lateral jsonb_each(case when jsonb_typeof(proposed -> k.key) = 'object' then proposed -> k.key else '{}' end) e
      where jsonb_typeof(e.value) = 'number'
    ), 0)
    + coalesce((
      select sum(greatest(0, c.held - coalesce((grants -> 'bionics' ->> c.id::text)::numeric, 0)) * c.manna_cost)
      from (
        select b.id, b.manna_cost, count(*) as held
        from jsonb_array_elements(case when jsonb_typeof(proposed -> 'bionics') = 'array' then proposed -> 'bionics' else '[]' end) e
        join public.bionics b on b.id = case when jsonb_typeof(e) = 'number' then (e #>> '{}')::numeric end
        group by b.id, b.manna_cost
      ) c
    ), 0)
    + greatest(0, greatest(0, case when jsonb_typeof(mechs) = 'array' then jsonb_array_length(mechs) else 0 end - 1)
                  - coalesce((grants ->> 'mechs')::numeric, 0)) * extra_mech_price
    + coalesce((
      select sum(greatest(0, c.held - coalesce((grants -> 'gear' ->> c.id)::numeric, 0)) * c.price)
      from (
        -- Nested cases, so the cast only ever sees a number.
        select g.id, count(*) as held,
          coalesce(case when jsonb_typeof(g.d -> 'manna_cost') = 'number' then
            case when (g.d ->> 'manna_cost')::numeric >= 0 and (g.d ->> 'manna_cost')::numeric % 1 = 0
                 then (g.d ->> 'manna_cost')::numeric end end, default_gear_price) as price
        from jsonb_array_elements(public.settle_pilot_gear(proposed,
          case when tg_table_name = 'pending_changes' then approved end, tg_table_name = 'characters') -> 'owned_gear') e
        join (select i.id, coalesce(i.edited, i.data) as d from public.content_items i where i.kind = 'pilot_gear') g
          on g.id = e ->> 'id'
        where e -> 'free' is distinct from 'true'::jsonb
        group by 1, 3
      ) c
    ), 0)
  into spent;

  if spent > received then
    problems := problems || format('This spends %s manna, but only %s was received.',
      to_char(spent, 'FM999,999,999,999'), to_char(received, 'FM999,999,999,999'));
  end if;

  -- 3. No refunds: every owned item on the approved sheet must still be owned (same key, same item). A new pilot has
  -- no approved sheet, so this only applies to changes.
  select string_agg(distinct coalesce(coalesce(i.edited, i.data) ->> 'name', l ->> 'id'), ', ')
  into removed_names
  from jsonb_array_elements(case when jsonb_typeof(approved -> 'owned_gear') = 'array' then approved -> 'owned_gear' else '[]' end) l
  left join public.content_items i on i.id = l ->> 'id'
  where jsonb_typeof(l) = 'object'
    and not coalesce(proposed -> 'owned_gear' @> jsonb_build_array(jsonb_build_object('key', l -> 'key', 'id', l -> 'id')), false);

  if removed_names is not null then
    problems := problems || ('Owned pilot gear can''t be removed: ' || removed_names || '.');
  end if;

  -- 4. Every owned entry has its own key, and a newly owned one (not on the approved sheet with the same key and item;
  -- for a new pilot, every one) is a pilot gear item. Unknown ids already approved, like backfilled ones, still pass.
  if exists (
    select 1
    from jsonb_array_elements(case when jsonb_typeof(proposed -> 'owned_gear') = 'array' then proposed -> 'owned_gear' else '[]' end) e
    having count(*) filter (where jsonb_typeof(e -> 'key') is distinct from 'string' or e ->> 'key' = '') > 0
      or count(*) <> count(distinct e ->> 'key')
  ) then
    problems := problems || 'Owned pilot gear has a missing or repeated key.'::text;
  end if;

  problems := problems || array(
    select distinct format('Unknown item (%s).', e ->> 'id')
    from jsonb_array_elements(case when jsonb_typeof(proposed -> 'owned_gear') = 'array' then proposed -> 'owned_gear' else '[]' end) e
    where not exists (select 1 from public.content_items i where i.kind = 'pilot_gear' and i.id = e ->> 'id')
      and not coalesce(approved -> 'owned_gear' @> jsonb_build_array(jsonb_build_object('key', e -> 'key', 'id', e -> 'id')), false)
    order by 1
  );

  -- 5. Misc items are the GM's: a change carries the live list unchanged.
  if tg_table_name = 'pending_changes'
     and coalesce(proposed -> 'misc_items', '[]') is distinct from coalesce(approved -> 'misc_items', '[]') then
    problems := problems || 'Misc items can only be changed by a GM.'::text;
  end if;

  -- 6. Homebrew rules (public.sheet_rule_problems): requirements, granted equipment, replace-mount choices and biomod mod
  -- points. Only problems the approved sheet doesn't already have (a new pilot has none), so what a GM approved can stay.
  -- A mech's problems start with its name from the public card, like the page's rule check.
  problems := problems || array(
    select case when p.at_mech is null then p.problem else coalesce((
        select nullif(btrim(e ->> 'name'), '') from jsonb_array_elements(case when jsonb_typeof(mechs) = 'array' then mechs else '[]' end) e
        where e ->> 'id' = p.at_mech limit 1), 'A mech') || ': ' || p.problem end
    from (
      select * from public.sheet_rule_problems(public.settle_pilot_gear(proposed,
        case when tg_table_name = 'pending_changes' then approved end, tg_table_name = 'characters'), pilot_level)
      except
      select * from public.sheet_rule_problems(approved, pilot_level)
    ) p
    order by p.at_mech nulls first, p.problem
  );

  if cardinality(problems) > 0 then
    raise exception '%', array_to_string(problems, ' ');
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_submit_rules() from public;
