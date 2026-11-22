-- Game-balance numbers are editable by owners (the developer, 2026-11-22): content items of kind 'rules', section
-- 'numbers', id 'rule_num_<key>', the value in data.numbers[0] (an owner's edit lands in `edited`, read as edited ?? data).
-- Until a row exists, or when its value is missing, not a whole number or outside the range below, the old number is used,
-- so nothing changes until an owner edits one. Only owners can write content_items (RLS), everyone logged in reads it.
--
--   key                  fallback  range      used by
--   starting_manna       2000      0..100000  new sheets' manna default, guard_gm_only_sheet_fields, guard_submit_rules
--   licence_rank_price   600       0..10000   guard_submit_rules
--   talent_rank_price    300       0..10000   guard_submit_rules
--   extra_mech_price     500       0..10000   guard_submit_rules
--   default_gear_price   100       0..10000   guard_submit_rules
--   max_licence_rank     3         1..6       sheet_rule_problems
--   max_talent_rank      3         1..6       sheet_rule_problems
--   mod_points_base      6         0..50      sheet_rule_problems
-- Not in the database (TS only): skill_points_base 2, personal_stat_min 2, personal_stat_max 4, personal_stat_points 4.
--
-- Pending work priced under an old number: approve_change and approve_pilot refuse when a rules number row changed after
-- the submit, so a stale price is never approved silently. The GM sends it back and the player resubmits at the new numbers.

-- In public (not private) because guard_submit_rules runs as the player and players can't use the private schema. Invoker
-- rights are enough: it reads only content_items, which every logged-in user can read, so calling it gains nothing.
create function public.rule_number(key text, fallback numeric, lo numeric, hi numeric) returns numeric
language sql stable set search_path = ''
as $$
  select coalesce((
    select n from (
      select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric end as n
      from (select coalesce(i.edited, i.data) -> 'numbers' -> 0 as v
            from public.content_items i where i.id = 'rule_num_' || key and i.kind = 'rules' and not i.draft) x
    ) y where n % 1 = 0 and n between lo and hi
  ), fallback);
$$;
revoke execute on function public.rule_number(text, numeric, numeric, numeric) from public, anon;
grant execute on function public.rule_number(text, numeric, numeric, numeric) to authenticated;

-- New sheets start with the starting manna (existing sheets keep what they have).
alter table public.character_sheets alter column manna set default public.rule_number('starting_manna', 2000, 0, 100000);

-- Copied from 20261121150000_gm_edit_mode.sql; only the starting manna changes.
create or replace function public.guard_gm_only_sheet_fields() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;
  if tg_op = 'INSERT' and (new.level <> 0 or new.manna <> public.rule_number('starting_manna', 2000, 0, 100000) or new.gm_grants <> '{}') then
    raise exception 'Only GMs and owners can set level, manna and free items.';
  end if;
  if tg_op = 'UPDATE' and (new.level is distinct from old.level or new.manna is distinct from old.manna
                           or new.gm_grants is distinct from old.gm_grants) then
    raise exception 'Only GMs and owners can change level, manna and free items.';
  end if;
  return new;
end;
$$;

-- Copied from 20261121150000_gm_edit_mode.sql; only the five numbers come from rule_number.
create or replace function private.guard_submit_rules() returns trigger
language plpgsql set search_path = ''
as $$
declare
  -- Manna prices and the starting manna: content items 'rule_num_<key>' (kind 'rules'), editable by owners. The numbers
  -- here are the fallbacks (and the ranges a stored value must sit in), the same as RULE_NUMBERS in src/rulesData.ts.
  licence_rank_price numeric := public.rule_number('licence_rank_price', 600, 0, 10000);
  talent_rank_price numeric := public.rule_number('talent_rank_price', 300, 0, 10000);
  extra_mech_price numeric := public.rule_number('extra_mech_price', 500, 0, 10000);
  -- A pilot gear item's price when its manna_cost isn't set (or isn't a whole number, 0 or more).
  default_gear_price numeric := public.rule_number('default_gear_price', 100, 0, 10000);
  -- character_sheets.manna's default, for a pilot with no sheet row yet.
  starting_manna numeric := public.rule_number('starting_manna', 2000, 0, 100000);

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

-- Copied from 20261121140000_homebrew_rules.sql; only the rank limits (0 to III, and the 3 in the talent rank caps) and the
-- mod point base (6) come from rule_number. The grants of the original survive create or replace.
-- Every homebrew-rule problem of one sheet (pilot_level: character_sheets.level). at_mech is the mech's key in
-- sheet.mechs, or null for the pilot. "sheet" should have its equipped_gear settled (settle_pilot_gear), as it will be
-- once approved. Content reads edited ?? data and skips drafts, like loadKind().
create or replace function public.sheet_rule_problems(sheet jsonb, pilot_level integer)
returns table (at_mech text, problem text)
language plpgsql stable set search_path = ''
as $$
declare
  -- The mount types the page knows (MOUNT_SLOTS in src/mechData.ts).
  mount_types constant text[] := array['Auxiliary', 'Integrated Auxiliary', 'Main', 'Superheavy', 'Heavy', 'Flex', 'Main/Aux', 'Aux/Aux'];
  two_place constant text[] := array['Flex', 'Main/Aux', 'Aux/Aux'];
  ia constant text := 'Integrated Auxiliary';
  ranks jsonb := case when jsonb_typeof(sheet -> 'talents') = 'object' then sheet -> 'talents' else '{}' end;
  cores jsonb := case when jsonb_typeof(sheet -> 'core_bonuses') = 'array' then sheet -> 'core_bonuses' else '[]' end;
  biomods jsonb := case when jsonb_typeof(sheet -> 'bionics') = 'array' then sheet -> 'bionics' else '[]' end;
  owned jsonb := case when jsonb_typeof(sheet -> 'owned_gear') = 'array' then sheet -> 'owned_gear' else '[]' end;
  equipped jsonb;
  taken_talents jsonb;
  taken_cores jsonb;
  installed jsonb;
  gear_ids text[];
  used numeric;
  extra numeric;
  points numeric;
  granted_by jsonb;
  mech record;
  fid text;
  f jsonb;
  fname text;
  systems text[];
  mounted text[];
  granting jsonb;
  built_integrated text[];
  unlocked text[];
  mounts text[];
  mount_sources jsonb;
  all_sources jsonb;
  items jsonb;
  choice record;
  num numeric;
  ok boolean;
  max_licence numeric := public.rule_number('max_licence_rank', 3, 1, 6);
  max_talent numeric := public.rule_number('max_talent_rank', 3, 1, 6);
  mod_base numeric := public.rule_number('mod_points_base', 6, 0, 50);
  roman constant text[] := array['I', 'II', 'III', 'IV', 'V', 'VI'];
begin
  -- Anyone logged in can call this, and each mech costs several queries: refuse sheets far beyond real use.
  if (select count(*) from jsonb_object_keys(case when jsonb_typeof(sheet -> 'mechs') = 'object' then sheet -> 'mechs' else '{}' end)) > 50
    or jsonb_array_length(biomods) > 200 or jsonb_array_length(owned) > 500 then
    raise exception 'Sheet too large.';
  end if;

  -- Talent and licence ranks: whole numbers from 0 to the maximum rank, III unless an owner changed it (pilotProblems).
  return query
    select null::text, format('Talent %s must be a whole rank from 0 to %s.', r.key, roman[max_talent::integer])
    from jsonb_each(ranks) r
    where case when jsonb_typeof(r.value) = 'number' then ((r.value #>> '{}')::numeric not between 0 and max_talent or (r.value #>> '{}')::numeric % 1 <> 0) else true end
    union all
    select null::text, case when fr.id is null then r.key
        else coalesce(coalesce(fr.edited, fr.data) ->> 'source', '') || ' ' || coalesce(coalesce(fr.edited, fr.data) ->> 'name', fr.id) end
      || ' licence must be a whole rank from 0 to ' || roman[max_licence::integer] || '.'
    from jsonb_each(case when jsonb_typeof(sheet -> 'licences') = 'object' then sheet -> 'licences' else '{}' end) r
    left join public.content_items fr on fr.id = r.key and fr.kind = 'frames' and not fr.draft
    where case when jsonb_typeof(r.value) = 'number' then ((r.value #>> '{}')::numeric not between 0 and max_licence or (r.value #>> '{}')::numeric % 1 <> 0) else true end;

  -- The equipped pilot gear items (each settled key once), in slot order.
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'd', g.d) order by k.n), '[]') into equipped
  from jsonb_array_elements(case when jsonb_typeof(sheet -> 'equipped_gear') = 'array' then sheet -> 'equipped_gear' else '[]' end) with ordinality k(key, n)
  cross join lateral (select o from jsonb_array_elements(owned) o where jsonb_typeof(o) = 'object' and o -> 'key' = k.key limit 1) o
  join (select i.id, coalesce(i.edited, i.data) as d from public.content_items i where i.kind = 'pilot_gear' and not i.draft) g on g.id = o.o ->> 'id';

  -- Talents with a number rank, taken core bonuses and installed biomods that exist, in catalogue order.
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', coalesce(t.d ->> 'name', t.id), 'rank', (r.value #>> '{}')::numeric,
      'ranks', case when jsonb_typeof(t.d -> 'ranks') = 'array' then t.d -> 'ranks' else '[]' end, 'requires', t.d -> 'requires') order by t.id), '[]')
  into taken_talents
  from jsonb_each(ranks) r
  join (select i.id, coalesce(i.edited, i.data) as d from public.content_items i where i.kind = 'talents' and not i.draft) t on t.id = r.key
  where jsonb_typeof(r.value) = 'number';

  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', coalesce(c.d ->> 'name', c.id), 'd', c.d) order by c.id), '[]')
  into taken_cores
  from (select i.id, coalesce(i.edited, i.data) as d from public.content_items i where i.kind = 'core_bonuses' and not i.draft) c
  where cores @> to_jsonb(c.id);

  select coalesce(jsonb_agg(to_jsonb(b) order by b.name, b.id), '[]') into installed
  from public.bionics b where biomods @> to_jsonb(b.id);

  -- Requirements of ranked talents, taken core bonuses and installed biomods (no item counts for them), and of owned pilot
  -- gear (owned pilot gear counts).
  gear_ids := array(select o ->> 'id' from jsonb_array_elements(owned) o where jsonb_typeof(o) = 'object');
  return query
    select null::text, format('%s needs %s.', s.name, u.thing)
    from (
      select t ->> 'name' as name, t -> 'requires' as needs, '{}'::text[] as have
      from jsonb_array_elements(taken_talents) t where trunc((t ->> 'rank')::numeric) between 1 and max_talent
      union all
      select c ->> 'name', c -> 'd' -> 'requires', '{}' from jsonb_array_elements(taken_cores) c
      union all
      select b ->> 'name', b -> 'requires', '{}' from jsonb_array_elements(installed) b
      union all
      select coalesce(g.d ->> 'name', g.id), g.d -> 'requires', gear_ids
      from (select i.id, coalesce(i.edited, i.data) as d from public.content_items i where i.kind = 'pilot_gear' and not i.draft) g
      where g.id = any(gear_ids)
    ) s
    cross join lateral public.unmet_requirements(s.needs, sheet, s.have) u(thing);

  -- Mod points: each installed biomod's cost (a repeated one twice, an unknown one nothing) against the base (6) + level plus the
  -- unconditional mod_points bonuses.
  select coalesce(sum(b.mod_point_cost), 0) into used
  from jsonb_array_elements(biomods) e
  join public.bionics b on b.id = case when jsonb_typeof(e) = 'number' then (e #>> '{}')::numeric end;

  select coalesce(sum(case
      when jsonb_typeof(x.bonus -> 'val') = 'number' then (x.bonus ->> 'val')::numeric
      when jsonb_typeof(x.bonus -> 'val') = 'string' and x.bonus ->> 'val' ~ '^\s*[-+]?\d{1,9}(\.\d{1,9})?\s*$'
        then regexp_replace(x.bonus ->> 'val', '\s', '', 'g')::numeric
      else 0 end), 0)
  into extra
  from (
    select bo from jsonb_array_elements(equipped) g
      cross join lateral jsonb_array_elements(case when jsonb_typeof(g -> 'd' -> 'bonuses') = 'array' then g -> 'd' -> 'bonuses' else '[]' end) bo
    union all
    select bo from jsonb_array_elements(taken_talents) t
      cross join lateral jsonb_array_elements(t -> 'ranks') with ordinality rk(rank, n)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(rk.rank -> 'bonuses') = 'array' then rk.rank -> 'bonuses' else '[]' end) bo
      where rk.n <= least(max_talent, greatest(0, trunc((t ->> 'rank')::numeric)))
    union all
    select bo from jsonb_array_elements(taken_cores) c
      cross join lateral jsonb_array_elements(case when jsonb_typeof(c -> 'd' -> 'bonuses') = 'array' then c -> 'd' -> 'bonuses' else '[]' end) bo
    union all
    select bo from jsonb_array_elements(installed) b cross join lateral jsonb_array_elements(b -> 'effect_bonuses') bo
  ) x(bonus)
  where jsonb_typeof(x.bonus) = 'object' and x.bonus ->> 'id' = 'mod_points'
    and coalesce(x.bonus -> 'condition', 'null') in ('null', 'false', '0', '""');

  points := greatest(0, mod_base + pilot_level + extra);
  if used > points then
    at_mech := null;
    problem := case when points = mod_base + pilot_level
      then format('Biomods use %s mod points, but level %s only gives %s.', used, pilot_level, trim_scale(points))
      else format('Biomods use %s mod points, but only %s are available.', used, trim_scale(points)) end;
    return next;
  end if;

  for mech in
    select e.key, e.value as m from jsonb_each(case when jsonb_typeof(sheet -> 'mechs') = 'object' then sheet -> 'mechs' else '{}' end) e
    where jsonb_typeof(e.value) = 'object' and jsonb_typeof(e.value -> 'frame') = 'string'
  loop
    select i.id, coalesce(i.edited, i.data) into fid, f from public.content_items i
    where i.id = mech.m ->> 'frame' and i.kind = 'frames' and not i.draft;
    continue when fid is null;
    fname := coalesce(f ->> 'name', fid);
    systems := array(
      select x from jsonb_array_elements_text(case when jsonb_typeof(mech.m -> 'systems') = 'array' then mech.m -> 'systems' else '[]' end) with ordinality s(x, n)
      where x is not null order by n);
    mounted := array(
      select p #>> '{}'
      from jsonb_array_elements(case when jsonb_typeof(mech.m -> 'mounts') = 'array' then mech.m -> 'mounts' else '[]' end) with ordinality mo(places, mi)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(places) = 'array' then places else '[]' end) with ordinality pl(p, pi)
      where jsonb_typeof(p) = 'string' and p #>> '{}' <> '' order by mi, pi);

    -- What taken core bonuses, equipped weapons and systems, installed biomods and taken talent ranks (only the last
    -- exclusive one) build in or unlock (talentGrants).
    select coalesce(jsonb_agg(s.g), '[]') into granting from (
      select c -> 'd' as g from jsonb_array_elements(taken_cores) c
      union all
      select coalesce(i.edited, i.data) from public.content_items i where i.id = any(systems || mounted) and i.kind <> 'frames' and not i.draft
      union all
      select b from jsonb_array_elements(installed) b
      union all
      select rk.rank from jsonb_array_elements(taken_talents) t
        cross join lateral (select case when (t ->> 'rank')::numeric % 1 = 0 then least(max_talent, greatest(0, (t ->> 'rank')::numeric)) else 0 end as upto) u
        cross join lateral jsonb_array_elements(t -> 'ranks') with ordinality rk(rank, n)
        where rk.n <= u.upto and (rk.rank -> 'exclusive' is distinct from 'true'
          or rk.n = (select max(x.n) from jsonb_array_elements(t -> 'ranks') with ordinality x(r, n) where x.n <= u.upto and x.r -> 'exclusive' = 'true'))
    ) s;

    -- The frame's own integrated items (every "integrated" list in it), less its weapons when a source with
    -- replace_integrated builds in a weapon, plus the granted ones (buildFrame).
    with own as (
      select jsonb_array_elements_text(a) as id from jsonb_path_query(f, 'strict $.**.integrated ? (@.type() == "array")') a
    ), given as (
      select jsonb_array_elements_text(case when jsonb_typeof(g -> 'integrated') = 'array' then g -> 'integrated' else '[]' end) as id,
        g -> 'replace_integrated' = 'true' as replacing
      from jsonb_array_elements(granting) g
    ), weapon as (
      select i.id from public.content_items i where i.kind = 'weapons' and not i.draft
    )
    select array(
      select own.id from own
      where not exists (select 1 from given join weapon on weapon.id = given.id where given.replacing)
        or not exists (select 1 from weapon where weapon.id = own.id)
      union
      select given.id from given
    ) into built_integrated;
    unlocked := built_integrated || array(
      select jsonb_array_elements_text(case when jsonb_typeof(g -> 'special_equipment') = 'array' then g -> 'special_equipment' else '[]' end)
      from jsonb_array_elements(granting) g);

    -- Granted equipment: an equipped item that some source can grant (or a talent_item) needs one present (mechProblems).
    if granted_by is null then
      select coalesce(jsonb_object_agg(q.id, q.names), '{}') into granted_by from (
        select g.id, jsonb_agg(distinct g.name) as names from (
          select x.id, coalesce(i.d ->> 'name', i.key) as name
          from (select c.id as key, coalesce(c.edited, c.data) as d from public.content_items c
                where c.kind in ('core_bonuses', 'weapons', 'systems') and not c.draft) i
          cross join lateral (
            select jsonb_array_elements_text(case when jsonb_typeof(i.d -> 'integrated') = 'array' then i.d -> 'integrated' else '[]' end)
            union all
            select jsonb_array_elements_text(case when jsonb_typeof(i.d -> 'special_equipment') = 'array' then i.d -> 'special_equipment' else '[]' end)
          ) x(id)
          union all
          select x.id, coalesce(t.d ->> 'name', t.key) || ' ' || coalesce((array['I', 'II', 'III'])[rk.n], rk.n::text)
          from (select c.id as key, coalesce(c.edited, c.data) as d from public.content_items c where c.kind = 'talents' and not c.draft) t
          cross join lateral jsonb_array_elements(case when jsonb_typeof(t.d -> 'ranks') = 'array' then t.d -> 'ranks' else '[]' end) with ordinality rk(rank, n)
          cross join lateral (
            select jsonb_array_elements_text(case when jsonb_typeof(rk.rank -> 'integrated') = 'array' then rk.rank -> 'integrated' else '[]' end)
            union all
            select jsonb_array_elements_text(case when jsonb_typeof(rk.rank -> 'special_equipment') = 'array' then rk.rank -> 'special_equipment' else '[]' end)
          ) x(id)
          union all
          select x.id, b.name from public.bionics b cross join lateral unnest(b.integrated || b.special_equipment) x(id)
        ) g
        where g.id is not null
        group by g.id
      ) q;
    end if;
    return query
      select mech.key, format('%s needs %s.', coalesce(c.d ->> 'name', e.id),
        coalesce((select string_agg(n, ' or ' order by n) from jsonb_array_elements_text(granted_by -> e.id) n), 'its talent rank'))
      from (select distinct x as id from unnest(systems || mounted) x) e
      left join lateral (
        select coalesce(i.edited, i.data) as d from public.content_items i where i.id = e.id and i.kind <> 'frames' and not i.draft
      ) c on true
      where (granted_by ? e.id or c.d -> 'talent_item' = 'true') and not coalesce(e.id = any(unlocked), false);

    -- The built frame's mounts (buildFrame): its own, Mount Retrofitting's choice, add_mount and superheavy_mounting
    -- bonuses, replace_mount choices, then Integrated Weapon's mount. Bonuses here come from taken core bonuses, taken
    -- talent ranks, systems, the frame, its traits and its core system's passive.
    mounts := array(
      select x from jsonb_array_elements_text(case when jsonb_typeof(f -> 'mounts') = 'array' then f -> 'mounts' else '[]' end) with ordinality m(x, n)
      order by n);
    if cores @> '"cb_mount_retrofitting"' then
      num := case when jsonb_typeof(mech.m -> 'core_mounts' -> 'cb_mount_retrofitting') = 'number'
        then (mech.m -> 'core_mounts' ->> 'cb_mount_retrofitting')::numeric end;
      if num % 1 = 0 and num >= 0 and num < cardinality(mounts) then
        mounts[num::integer + 1] := 'Main/Aux';
      end if;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('key', s.key, 'bonuses', s.bonuses) order by s.ord, s.sub, s.n), '[]') into mount_sources
    from (
      select 1 as ord, c ->> 'id' as sub, 0::bigint as n, c ->> 'id' as key, c -> 'd' -> 'bonuses' as bonuses from jsonb_array_elements(taken_cores) c
      union all
      select 2, t ->> 'id', rk.n, (t ->> 'id') || ':' || rk.n, rk.rank -> 'bonuses'
      from jsonb_array_elements(taken_talents) t cross join lateral jsonb_array_elements(t -> 'ranks') with ordinality rk(rank, n)
      where rk.n <= least(max_talent, greatest(0, trunc((t ->> 'rank')::numeric)))
      union all
      select 3, '', sy.n, sy.x, coalesce(i.edited, i.data) -> 'bonuses'
      from unnest(systems) with ordinality sy(x, n)
      join public.content_items i on i.id = sy.x and i.kind <> 'frames' and not i.draft
      union all
      select 4, '', 0, fid, f -> 'bonuses'
      union all
      select 5, '', tr.n, fid || ':trait:' || (tr.n - 1), tr.t -> 'bonuses'
      from jsonb_array_elements(case when jsonb_typeof(f -> 'traits') = 'array' then f -> 'traits' else '[]' end) with ordinality tr(t, n)
      union all
      select 6, '', 0, fid || ':core', f -> 'core_system' -> 'passive_bonuses' where jsonb_typeof(f -> 'core_system') = 'object'
    ) s;

    for choice in
      select b.b from jsonb_array_elements(mount_sources) with ordinality s(s, sn)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(s.s -> 'bonuses') = 'array' then s.s -> 'bonuses' else '[]' end) with ordinality b(b, bn)
      where b.b ->> 'id' = 'add_mount' and public.permanent_bonus(b.b) and b.b ->> 'val' = any(mount_types)
      order by s.sn, b.bn
    loop
      -- (A CASE can't sit in an IF condition: plpgsql ends the condition at its first THEN.)
      ok := cardinality(mounts) < 20 and coalesce((select count(*) from unnest(mounts) x where x is distinct from ia)
        < (select (choice.b ->> 'max')::numeric where jsonb_typeof(choice.b -> 'max') = 'number'), true);
      if ok then
        mounts := mounts || (choice.b ->> 'val');
      end if;
    end loop;
    if exists (
      select 1 from jsonb_array_elements(mount_sources) s
      cross join lateral jsonb_array_elements(case when jsonb_typeof(s -> 'bonuses') = 'array' then s -> 'bonuses' else '[]' end) b
      where b ->> 'id' = 'superheavy_mounting' and public.permanent_bonus(b)
    ) and (select count(*) from unnest(mounts) x where x is distinct from ia) < 3 then
      mounts := mounts || 'Superheavy'::text;
    end if;
    -- A source's second replace_mount has "#1" on its key (choiceKey).
    for choice in
      select (s.s ->> 'key') || case when r.k > 1 then '#' || (r.k - 1) else '' end as key, r.b ->> 'val' as type
      from jsonb_array_elements(mount_sources) with ordinality s(s, sn)
      cross join lateral (
        select x.b, row_number() over (order by x.bn) as k
        from jsonb_array_elements(case when jsonb_typeof(s.s -> 'bonuses') = 'array' then s.s -> 'bonuses' else '[]' end) with ordinality x(b, bn)
        where x.b ->> 'id' = 'replace_mount'
      ) r
      where public.permanent_bonus(r.b) and r.b ->> 'val' = any(mount_types)
      order by s.sn, r.k
    loop
      num := case when jsonb_typeof(mech.m -> 'core_mounts' -> choice.key) = 'number' then (mech.m -> 'core_mounts' ->> choice.key)::numeric end;
      if num % 1 = 0 and num >= 0 and num < cardinality(mounts) then
        if mounts[num::integer + 1] is distinct from ia then
          mounts[num::integer + 1] := choice.type;
        end if;
      end if;
    end loop;
    if cores @> '"cb_integrated_weapon"' then
      mounts := mounts || ia;
    end if;

    -- What's on the mech: systems, weapons in places the built frame has, mods on those weapons, and built-in items, each
    -- with its data (a weapon's chosen profile adds its name and bonuses, like selectWeaponProfile).
    select coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'id', e.id,
        'name', case when jsonb_typeof(pr.p) = 'object' then coalesce(c.d ->> 'name', e.id) || ' · ' || coalesce(pr.p ->> 'name', 'Profile ' || (pr.at + 1))
                     else coalesce(c.d ->> 'name', e.id) end,
        'requires', c.d -> 'requires',
        'bonuses', case when jsonb_typeof(c.d -> 'bonuses') = 'array' then c.d -> 'bonuses' else '[]' end
          || case when jsonb_typeof(pr.p) = 'object' and jsonb_typeof(pr.p -> 'bonuses') = 'array' then pr.p -> 'bonuses' else '[]' end
      ) order by e.ord, e.n), '[]')
    into items
    from (
      select 'system' as kind, 1 as ord, s.n, s.x as place, s.x as id from unnest(systems) with ordinality s(x, n)
      union all
      select 'weapon', 2, mo.mi * 1000 + pl.pi, (mo.mi - 1) || ':' || (pl.pi - 1), pl.p #>> '{}'
      from jsonb_array_elements(case when jsonb_typeof(mech.m -> 'mounts') = 'array' then mech.m -> 'mounts' else '[]' end) with ordinality mo(places, mi)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(mo.places) = 'array' then mo.places else '[]' end) with ordinality pl(p, pi)
      where jsonb_typeof(pl.p) = 'string' and pl.p #>> '{}' <> '' and mo.mi <= cardinality(mounts)
        and pl.pi <= case when mounts[mo.mi] = any(two_place) then 2 else 1 end
      union all
      select 'mod', 3, 0, w.key, w.value from jsonb_each_text(case when jsonb_typeof(mech.m -> 'weapon_mods') = 'object' then mech.m -> 'weapon_mods' else '{}' end) w
      where case when w.key ~ '^\d{1,4}:\d{1,4}$' then
          split_part(w.key, ':', 1)::integer < cardinality(mounts)
          and split_part(w.key, ':', 2)::integer < case when mounts[split_part(w.key, ':', 1)::integer + 1] = any(two_place) then 2 else 1 end
          and coalesce(mech.m -> 'mounts' -> split_part(w.key, ':', 1)::integer ->> split_part(w.key, ':', 2)::integer, '') <> ''
        else false end
      union all
      select 'integrated', 4, b.n, 'integrated:' || b.x, b.x from unnest(built_integrated) with ordinality b(x, n)
    ) e
    join lateral (
      select coalesce(i.edited, i.data) as d from public.content_items i
      where i.id = e.id and not i.draft and case when e.kind = 'mod' then i.kind = 'mods' else i.kind <> 'frames' end
    ) c on true
    left join lateral (
      select x.at, c.d -> 'profiles' -> x.at as p
      from (select case when opt is null then 0 when jsonb_typeof(opt) = 'number' then
              case when (opt #>> '{}')::numeric % 1 = 0 and (opt #>> '{}')::numeric between 0 and 1000 then (opt #>> '{}')::integer end end as at
            from (select mech.m -> 'weapon_options' -> e.place -> 'profile' as opt) o) x
      where e.kind <> 'mod'
    ) pr on true;

    -- Requirements: the frame and every fitted weapon, system and mod, met by what's on this mech.
    return query
      select mech.key, format('%s needs %s.', x.who, u.thing)
      from (
        select 'The ' || fname || ' frame' as who, f -> 'requires' as needs
        union all
        select e ->> 'name', e -> 'requires' from jsonb_array_elements(items) e where e ->> 'kind' <> 'integrated'
      ) x
      cross join lateral public.unmet_requirements(x.needs, sheet,
        built_integrated || systems || mounted || array(
          select w.value from jsonb_each_text(case when jsonb_typeof(mech.m -> 'weapon_mods') = 'object' then mech.m -> 'weapon_mods' else '{}' end) w)
      ) u(thing);

    -- Replace-mount choices, from every source the mech page counts (mechEffects): each needs a mount of the built
    -- frame that isn't an Integrated Auxiliary one.
    select coalesce(jsonb_agg(s.src order by s.ord, s.sub, s.n), '[]') into all_sources
    from (
      select 1 as ord, '' as sub, 0::bigint as n, jsonb_build_object('key', fid, 'name', fname, 'bonuses', f -> 'bonuses') as src
      union all
      select 2, '', tr.n, jsonb_build_object('key', fid || ':trait:' || (tr.n - 1), 'name', fname || ' · ' || coalesce(tr.t ->> 'name', 'trait'), 'bonuses', tr.t -> 'bonuses')
      from jsonb_array_elements(case when jsonb_typeof(f -> 'traits') = 'array' then f -> 'traits' else '[]' end) with ordinality tr(t, n)
      union all
      select 3, '', 0, jsonb_build_object('key', fid || ':core', 'name', coalesce(f -> 'core_system' ->> 'name', 'core system') || ' · passive',
        'bonuses', f -> 'core_system' -> 'passive_bonuses')
      where jsonb_typeof(f -> 'core_system') = 'object'
      union all
      select 4, '', g.n, jsonb_build_object('key', g.g ->> 'id', 'name', coalesce(g.g -> 'd' ->> 'name', g.g ->> 'id'), 'bonuses', g.g -> 'd' -> 'bonuses')
      from jsonb_array_elements(equipped) with ordinality g(g, n)
      union all
      select 5, '', it.n, jsonb_build_object('key', it.e ->> 'id', 'name', it.e ->> 'name', 'bonuses', it.e -> 'bonuses')
      from jsonb_array_elements(items) with ordinality it(e, n)
      where it.e ->> 'kind' in ('integrated', 'mod') or not coalesce(it.e ->> 'id' = any(built_integrated), false)
      union all
      select 6, c ->> 'id', 0, jsonb_build_object('key', c ->> 'id', 'name', c ->> 'name', 'bonuses', c -> 'd' -> 'bonuses')
      from jsonb_array_elements(taken_cores) c
      union all
      select 7, t ->> 'id', rk.n, jsonb_build_object('key', (t ->> 'id') || ':' || rk.n, 'name', (t ->> 'name') || ' ' || rk.n || ': ' || coalesce(rk.rank ->> 'name', ''),
        'bonuses', rk.rank -> 'bonuses')
      from jsonb_array_elements(taken_talents) t cross join lateral jsonb_array_elements(t -> 'ranks') with ordinality rk(rank, n)
      where (t ->> 'rank')::numeric % 1 = 0 and rk.n <= least(max_talent, (t ->> 'rank')::numeric)
      union all
      select 8, '', b.n, jsonb_build_object('key', 'bionic:' || (b.b ->> 'id'), 'name', b.b ->> 'name', 'bonuses', b.b -> 'effect_bonuses')
      from jsonb_array_elements(installed) with ordinality b(b, n)
    ) s;

    for choice in
      select distinct (s.s ->> 'key') || case when r.k > 1 then '#' || (r.k - 1) else '' end as key, s.s ->> 'name' as name
      from jsonb_array_elements(all_sources) s(s)
      cross join lateral (
        select x.b, row_number() over (order by x.bn) as k
        from jsonb_array_elements(case when jsonb_typeof(s.s -> 'bonuses') = 'array' then s.s -> 'bonuses' else '[]' end) with ordinality x(b, bn)
        where x.b ->> 'id' = 'replace_mount'
      ) r
      where public.permanent_bonus(r.b) and r.b ->> 'val' = any(mount_types)
    loop
      num := case when jsonb_typeof(mech.m -> 'core_mounts' -> choice.key) = 'number' then (mech.m -> 'core_mounts' ->> choice.key)::numeric end;
      ok := false;
      if num % 1 = 0 and num >= 0 and num < cardinality(mounts) then
        ok := mounts[num::integer + 1] is distinct from ia;
      end if;
      if not ok then
        at_mech := mech.key;
        problem := format('%s needs a normal mount.', choice.name);
        return next;
      end if;
    end loop;
  end loop;
end;
$$;


-- =====================================================================
-- Approving: refuse work submitted before a number changed
-- =====================================================================

-- Copied from 20261121110000_pilot_inventory.sql; only the stale-numbers check is new.
create or replace function public.approve_change(change_id bigint, expected_submitted_at timestamptz, note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  change public.pending_changes;
  live jsonb;
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can approve changes.';
  end if;

  select * into change from public.pending_changes where id = change_id for update;
  if not found or change.status <> 'pending' or change.submitted_at is null then
    raise exception 'Change % is not waiting for review.', change_id;
  end if;

  if expected_submitted_at is null
     or date_trunc('milliseconds', change.submitted_at) <> date_trunc('milliseconds', expected_submitted_at) then
    raise exception 'The player edited this change after you opened it. Reload to see the latest.';
  end if;

  if exists (select 1 from public.content_items i where i.kind = 'rules' and i.id like 'rule\_num\_%' and i.updated_at > change.submitted_at) then
    raise exception 'The game numbers changed after this was submitted. Send it back so the player can resubmit.';
  end if;

  -- Lock the character while it's checked and updated.
  perform 1 from public.characters where id = change.character_id for update;

  if date_trunc('milliseconds', private.pilot_last_changed(change.character_id))
     > date_trunc('milliseconds', change.based_on) then
    raise exception 'This character changed after the change was made. Reject it so the player can resubmit.';
  end if;

  -- Only these public columns can be changed by a pending change.
  update public.characters c
  set (pilot_name, callsign, age, gender, sexuality, height, weight, eye_colour, hair_colour,
       appearance, pilot_image, personality, traits, mechs)
    = (p.pilot_name, p.callsign, p.age, p.gender, p.sexuality, p.height, p.weight, p.eye_colour, p.hair_colour,
       p.appearance, p.pilot_image, p.personality, p.traits, p.mechs)
  from jsonb_populate_record(null::public.characters, change.proposed_public) p
  where c.id = change.character_id;

  select s.sheet into live from public.character_sheets s where s.character_id = change.character_id for update;

  insert into public.character_sheets (character_id, sheet)
  values (change.character_id, (public.settle_pilot_gear(change.proposed_sheet, live, false) - 'misc_items')
    || case when live ? 'misc_items' then jsonb_build_object('misc_items', live -> 'misc_items') else '{}' end)
  on conflict (character_id) do update set sheet = excluded.sheet;

  update public.pending_changes
  set status = 'approved', review_reason = nullif(btrim(note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = change_id;
end;
$$;

-- Copied from 20261119120000_pilot_submission.sql; only the stale-numbers check is new.
create or replace function public.approve_pilot(target_character_id bigint, expected_updated_at timestamptz, note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  current_status public.character_status;
  submitted timestamptz;
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can approve pilots.';
  end if;

  -- Lock the character while it's checked and updated.
  select status, submitted_at into current_status, submitted from public.characters where id = target_character_id for update;
  if current_status is distinct from 'pending' or submitted is null then
    raise exception 'Character % is not waiting for approval.', target_character_id;
  end if;

  if expected_updated_at is null
     or date_trunc('milliseconds', private.pilot_last_changed(target_character_id))
        > date_trunc('milliseconds', expected_updated_at) then
    raise exception 'The player changed this pilot after you opened it. Reload to see the latest.';
  end if;

  if exists (select 1 from public.content_items i where i.kind = 'rules' and i.id like 'rule\_num\_%' and i.updated_at > submitted) then
    raise exception 'The game numbers changed after this was submitted. Send it back so the player can resubmit.';
  end if;

  update public.character_sheets
  set review_note = nullif(btrim(note), '')
  where character_id = target_character_id;

  update public.characters
  set status = 'approved', approved_at = now()
  where id = target_character_id;
end;
$$;
