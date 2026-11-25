-- Free talent ranks: a biomod, taken core bonus or equipped pilot gear item can give ranks of a talent.
-- An effect {"id": "talent_rank", "talent": "<talent id>", "val": <whole number, 1 or more>} (no condition) in a biomod's
-- effect_bonuses or in the bonuses of a core bonus or pilot gear item adds that many ranks of a published talent. Several
-- sources add up. Free ranks are never stored: bought + free is the total.
-- public.sheet_rule_problems (copied from 20261125220000, signature and grants unchanged) differs only here:
-- 1. taken_talents (mod point bonuses, mount sources, granted equipment, replace-mount sources) reads the total, capped at
--    the highest talent rank by the existing least(max_talent, ...). Each row also carries 'bought'.
-- 2. A talent's own requirements are checked against the total, only when bought is 1 or more. A free-only talent skips them.
--    Core bonuses, biomods and gear read the bought ranks, so a source can't satisfy its own requirement.
-- 3. Mech-level requirement checks (mod grants, frame, weapons, systems, mods) read the total.
-- 4. A total past the highest rank (a bought rank that passed the range check, plus free ranks) is reported:
--    "<talent> is rank IV with free ranks, but the highest is III." (same sentence as pilotProblems.)
-- 5. The "granted by" names use the roman list, so they follow the highest talent rank.
-- private.guard_submit_rules is unchanged: its manna sum reads the bought ranks, and it already refuses new problems.
CREATE OR REPLACE FUNCTION public.sheet_rule_problems(sheet jsonb, pilot_level integer)
 RETURNS TABLE(at_mech text, problem text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  -- The built-in mount types. The page reads game_definitions.mount_types, so a mount type an owner adds there is not known
  -- here: an add_mount or replace_mount of it is ignored by the server, and a weapon in such a place is reported.
  mount_types constant text[] := array['Auxiliary', 'Integrated Auxiliary', 'Main', 'Superheavy', 'Heavy', 'Flex', 'Main/Aux', 'Aux/Aux'];
  two_place constant text[] := array['Flex', 'Main/Aux', 'Aux/Aux'];
  ia constant text := 'Integrated Auxiliary';
  ranks jsonb := case when jsonb_typeof(sheet -> 'talents') = 'object' then sheet -> 'talents' else '{}' end;
  cores jsonb := case when jsonb_typeof(sheet -> 'core_bonuses') = 'array' then sheet -> 'core_bonuses' else '[]' end;
  biomods jsonb := case when jsonb_typeof(sheet -> 'bionics') = 'array' then sheet -> 'bionics' else '[]' end;
  owned jsonb := case when jsonb_typeof(sheet -> 'owned_gear') = 'array' then sheet -> 'owned_gear' else '[]' end;
  equipped jsonb;
  taken_talents jsonb;
  granted jsonb;
  ranked jsonb;
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
  max_licence numeric := public.rule_number('max_licence_rank');
  max_talent numeric := public.rule_number('max_talent_rank');
  mod_base numeric := public.rule_number('mod_points_base');
  roman constant text[] := array['I', 'II', 'III', 'IV', 'V', 'VI'];
begin
  -- Anyone logged in can call this, and each mech costs several queries: refuse sheets far beyond real use.
  if (select count(*) from jsonb_object_keys(case when jsonb_typeof(sheet -> 'mechs') = 'object' then sheet -> 'mechs' else '{}' end)) > 50
    or jsonb_array_length(biomods) > 200 or jsonb_array_length(owned) > 500 then
    raise exception 'Sheet too large.';
  end if;

  -- The equipped pilot gear items (each settled key once), in slot order.
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'd', g.d) order by k.n), '[]') into equipped
  from jsonb_array_elements(case when jsonb_typeof(sheet -> 'equipped_gear') = 'array' then sheet -> 'equipped_gear' else '[]' end) with ordinality k(key, n)
  cross join lateral (select o from jsonb_array_elements(owned) o where jsonb_typeof(o) = 'object' and o -> 'key' = k.key limit 1) o
  join (select i.id, coalesce(i.edited, i.data) as d from public.content_items i where i.kind = 'pilot_gear' and not i.draft) g on g.id = o.o ->> 'id';

  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', coalesce(c.d ->> 'name', c.id), 'd', c.d) order by c.id), '[]')
  into taken_cores
  from (select i.id, coalesce(i.edited, i.data) as d from public.content_items i where i.kind = 'core_bonuses' and not i.draft) c
  where cores @> to_jsonb(c.id);

  select coalesce(jsonb_agg(to_jsonb(b) order by b.name, b.id), '[]') into installed
  from public.bionics b where biomods @> to_jsonb(b.id);

  -- Free talent ranks: unconditional talent_rank bonuses (a whole number from 1) on taken core bonuses, installed biomods and
  -- equipped pilot gear, for published talents. Several sources of one talent add up. Never stored: ranked is the sheet with
  -- bought + free ranks, used for effects and for requirements of talents, mechs and mech items. Taken core bonuses, biomods
  -- and gear keep reading the bought ranks, so a source can't satisfy its own requirement (talentRanks, rankedSheet).
  select coalesce(jsonb_object_agg(x.t, x.n), '{}') into granted from (
    select s.t, sum(s.n) as n from (
      select bo ->> 'talent' as t, case when jsonb_typeof(bo -> 'val') = 'number' then (bo ->> 'val')::numeric end as n
      from (select c -> 'd' -> 'bonuses' as list from jsonb_array_elements(taken_cores) c
            union all select b -> 'effect_bonuses' from jsonb_array_elements(installed) b
            union all select g -> 'd' -> 'bonuses' from jsonb_array_elements(equipped) g) l
      cross join lateral jsonb_array_elements(case when jsonb_typeof(l.list) = 'array' then l.list else '[]' end) bo
      where jsonb_typeof(bo) = 'object' and bo ->> 'id' = 'talent_rank' and jsonb_typeof(bo -> 'talent') = 'string'
        and coalesce(bo -> 'condition', 'null') in ('null', 'false', '0', '""')
        and exists (select 1 from public.content_items i where i.kind = 'talents' and not i.draft and i.id = bo ->> 'talent')
    ) s
    where s.n >= 1 and s.n % 1 = 0
    group by s.t) x;

  select case when jsonb_typeof(sheet) = 'object' then jsonb_set(sheet, '{talents}', coalesce(jsonb_object_agg(k.key, k.n), '{}')) else sheet end
  into ranked
  from (
    -- A bought number that isn't a whole rank from 0 stays as it is (the range message reports it, and its requirements are still
    -- checked) and takes no free ranks.
    select coalesce(b.key, g.key) as key, coalesce(b.n, 0) + case when b.n is null or (b.n >= 0 and b.n % 1 = 0) then coalesce(g.n, 0) else 0 end as n
    from (select r.key, (r.value #>> '{}')::numeric as n from jsonb_each(ranks) r where jsonb_typeof(r.value) = 'number') b
    full join (select e.key, (e.value #>> '{}')::numeric as n from jsonb_each(granted) e) g on g.key = b.key
  ) k;

  -- Talents with a number rank (bought + free), taken core bonuses and installed biomods that exist, in catalogue order.
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', coalesce(t.d ->> 'name', t.id), 'rank', (r.value #>> '{}')::numeric,
      'bought', coalesce(case when jsonb_typeof(ranks -> r.key) = 'number' then (ranks ->> r.key)::numeric end, 0),
      'ranks', case when jsonb_typeof(t.d -> 'ranks') = 'array' then t.d -> 'ranks' else '[]' end, 'requires', t.d -> 'requires') order by t.id), '[]')
  into taken_talents
  from jsonb_each(case when jsonb_typeof(ranked -> 'talents') = 'object' then ranked -> 'talents' else '{}' end) r
  join (select i.id, coalesce(i.edited, i.data) as d from public.content_items i where i.kind = 'talents' and not i.draft) t on t.id = r.key
  where jsonb_typeof(r.value) = 'number';

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
    where case when jsonb_typeof(r.value) = 'number' then ((r.value #>> '{}')::numeric not between 0 and max_licence or (r.value #>> '{}')::numeric % 1 <> 0) else true end
    union all
    -- Free ranks from biomods, core bonuses and gear take a talent past the highest rank (pilotProblems). Only for a bought rank
    -- that passed the check above.
    select null::text, format('%s is rank %s with free ranks, but the highest is %s.', coalesce(coalesce(t.edited, t.data) ->> 'name', r.key),
      case when (r.value #>> '{}')::numeric <= array_length(roman, 1) then roman[(r.value #>> '{}')::integer] else (r.value #>> '{}') end, roman[max_talent::integer])
    from jsonb_each(case when jsonb_typeof(ranked -> 'talents') = 'object' then ranked -> 'talents' else '{}' end) r
    left join public.content_items t on t.id = r.key and t.kind = 'talents' and not t.draft
    where jsonb_typeof(r.value) = 'number' and (r.value #>> '{}')::numeric > max_talent
      and (not ranks ? r.key or coalesce(case when jsonb_typeof(ranks -> r.key) = 'number'
        then (ranks ->> r.key)::numeric between 0 and max_talent and (ranks ->> r.key)::numeric % 1 = 0 end, false));

  -- Requirements of ranked talents, taken core bonuses and installed biomods (no item counts for them), and of owned pilot
  -- gear (owned pilot gear counts).
  gear_ids := array(select o ->> 'id' from jsonb_array_elements(owned) o where jsonb_typeof(o) = 'object');
  return query
    select null::text, format('%s needs %s.', s.name, u.thing)
    from (
      -- A talent's own requirements are checked against bought + free ranks, only when a rank is bought (a free-only talent
      -- skips them). The other three read the bought ranks (sheet), so a source can't satisfy its own requirement.
      select t ->> 'name' as name, t -> 'requires' as needs, '{}'::text[] as have, ranked as pilot
      from jsonb_array_elements(taken_talents) t where trunc((t ->> 'bought')::numeric) between 1 and max_talent
      union all
      select c ->> 'name', c -> 'd' -> 'requires', '{}', sheet from jsonb_array_elements(taken_cores) c
      union all
      select b ->> 'name', b -> 'requires', '{}', sheet from jsonb_array_elements(installed) b
      union all
      select coalesce(g.d ->> 'name', g.id), g.d -> 'requires', gear_ids, sheet
      from (select i.id, coalesce(i.edited, i.data) as d from public.content_items i where i.kind = 'pilot_gear' and not i.draft) g
      where g.id = any(gear_ids)
    ) s
    cross join lateral public.unmet_requirements(s.needs, s.pilot, s.have) u(thing);

  -- Mod points: each installed biomod's cost (a repeated one twice, an unknown one nothing) against the base (6) + level plus the
  -- unconditional mod_points bonuses.
  select coalesce(sum(b.mod_point_cost), 0) into used
  from jsonb_array_elements(biomods) e
  join public.bionics b on b.id = case when jsonb_typeof(e) = 'number' then (e #>> '{}')::numeric end;

  select coalesce(sum(case
      when jsonb_typeof(x.bonus -> 'val') = 'number' then (x.bonus ->> 'val')::numeric
      when jsonb_typeof(x.bonus -> 'val') = 'string' and x.bonus ->> 'val' ~ '^\s*[-+]?[0-9]{1,9}(\.[0-9]{1,9})?\s*$'
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
    -- The built frame's mounts (buildFrame), worked out first because a weapon in a place the frame lacks counts for
    -- nothing: its own, Improved Armament's Flex, Mount Retrofitting's choice, add_mount and superheavy_mounting
    -- bonuses, replace_mount choices, then Integrated Weapon's mount. Bonuses here come from taken core bonuses, taken
    -- talent ranks, systems, the frame, its traits and its core system's passive.
    mounts := array(
      select x from jsonb_array_elements_text(case when jsonb_typeof(f -> 'mounts') = 'array' then f -> 'mounts' else '[]' end) with ordinality m(x, n)
      order by n);
    -- Improved Armament is decided by id, as buildFrame does: one Flex mount when the frame has fewer than three. Its own
    -- bonuses (the hosted data has none, local seed data has an add_mount) are left out of the sources below.
    if cores @> '"cb_improved_armament"' and cardinality(mounts) < 3 then
      mounts := mounts || 'Flex'::text;
    end if;
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
      where c ->> 'id' <> 'cb_improved_armament'
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
      select b.b, t.type from jsonb_array_elements(mount_sources) with ordinality s(s, sn)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(s.s -> 'bonuses') = 'array' then s.s -> 'bonuses' else '[]' end) with ordinality b(b, bn)
      cross join lateral (select m from unnest(mount_types) m where lower(m) = lower(btrim(b.b ->> 'val'))) t(type)
      where b.b ->> 'id' = 'add_mount' and public.permanent_bonus(b.b)
      order by s.sn, b.bn
    loop
      -- (A CASE can't sit in an IF condition: plpgsql ends the condition at its first THEN.)
      ok := cardinality(mounts) < 20 and coalesce((select count(*) from unnest(mounts) x where x is distinct from ia)
        < (select (choice.b ->> 'max')::numeric where jsonb_typeof(choice.b -> 'max') = 'number'), true);
      if ok then
        mounts := mounts || choice.type;
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
      select (s.s ->> 'key') || case when r.k > 1 then '#' || (r.k - 1) else '' end as key, t.type
      from jsonb_array_elements(mount_sources) with ordinality s(s, sn)
      cross join lateral (
        select x.b, row_number() over (order by x.bn) as k
        from jsonb_array_elements(case when jsonb_typeof(s.s -> 'bonuses') = 'array' then s.s -> 'bonuses' else '[]' end) with ordinality x(b, bn)
        where x.b ->> 'id' = 'replace_mount'
      ) r
      cross join lateral (select m from unnest(mount_types) m where lower(m) = lower(btrim(r.b ->> 'val'))) t(type)
      where public.permanent_bonus(r.b)
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

    -- Weapons in the places the built frame has. A weapon in a place it lacks (a mount past the last one, or a second place on
    -- a one-place mount) is reported, as mechProblems does, and grants and satisfies nothing.
    mounted := array(
      select p #>> '{}'
      from jsonb_array_elements(case when jsonb_typeof(mech.m -> 'mounts') = 'array' then mech.m -> 'mounts' else '[]' end) with ordinality mo(places, mi)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(places) = 'array' then places else '[]' end) with ordinality pl(p, pi)
      where jsonb_typeof(p) = 'string' and p #>> '{}' <> '' and mi <= cardinality(mounts)
        and pi <= case when mounts[mi] = any(two_place) then 2 else 1 end
      order by mi, pi);
    if exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(mech.m -> 'mounts') = 'array' then mech.m -> 'mounts' else '[]' end) with ordinality mo(places, mi)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(places) = 'array' then places else '[]' end) pl(p)
      where jsonb_typeof(p) = 'string' and p #>> '{}' <> '' and mi > cardinality(mounts)) then
      at_mech := mech.key;
      problem := 'Some weapons are on mounts the frame doesn''t have.';
      return next;
    end if;
    if exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(mech.m -> 'mounts') = 'array' then mech.m -> 'mounts' else '[]' end) with ordinality mo(places, mi)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(places) = 'array' then places else '[]' end) with ordinality pl(p, pi)
      where jsonb_typeof(p) = 'string' and p #>> '{}' <> '' and mi <= cardinality(mounts)
        and pi > case when mounts[mi] = any(two_place) then 2 else 1 end) then
      at_mech := mech.key;
      problem := 'Some weapons are in slots the mount doesn''t have.';
      return next;
    end if;

    -- What taken core bonuses, equipped weapons and systems, installed biomods and taken talent ranks (only the last
    -- exclusive one) build in or unlock (talentGrants).
    select coalesce(jsonb_agg(s.g), '[]') into granting from (
      select c -> 'd' as g from jsonb_array_elements(taken_cores) c
      union all
      select coalesce(i.edited, i.data) from public.content_items i where i.id = any(systems || mounted) and i.kind <> 'frames' and not i.draft
      union all
      select b from jsonb_array_elements(installed) b
      union all
      select g -> 'd' from jsonb_array_elements(equipped) g
      union all
      -- A fitted mod grants only when a weapon sits in its place ("mount:place", a place the built frame has) and its own
      -- requirements are met by the systems, weapons and mods on this mech (the same check as below, less built-in items).
      -- Stray keys and places the frame lacks grant nothing. A built-in weapon has no place to hold a mod.
      select coalesce(i.edited, i.data) from public.content_items i
      where i.kind = 'mods' and not i.draft and i.id in (
        select w.value from jsonb_each_text(case when jsonb_typeof(mech.m -> 'weapon_mods') = 'object' then mech.m -> 'weapon_mods' else '{}' end) w
        where w.key ~ '^[0-9]{1,4}:[0-9]{1,4}$'
          and split_part(w.key, ':', 1)::integer < cardinality(mounts)
          and split_part(w.key, ':', 2)::integer < case when mounts[split_part(w.key, ':', 1)::integer + 1] = any(two_place) then 2 else 1 end
          and exists (
          select 1 from public.content_items wi where wi.kind = 'weapons' and not wi.draft
            and wi.id = mech.m -> 'mounts' -> split_part(w.key, ':', 1)::integer ->> split_part(w.key, ':', 2)::integer))
        and not exists (select 1 from public.unmet_requirements(coalesce(i.edited, i.data) -> 'requires', ranked,
          systems || mounted || array(select w.value from jsonb_each_text(case when jsonb_typeof(mech.m -> 'weapon_mods') = 'object' then mech.m -> 'weapon_mods' else '{}' end) w)))
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
                where c.kind in ('core_bonuses', 'weapons', 'systems', 'mods', 'pilot_gear') and not c.draft) i
          cross join lateral (
            select jsonb_array_elements_text(case when jsonb_typeof(i.d -> 'integrated') = 'array' then i.d -> 'integrated' else '[]' end)
            union all
            select jsonb_array_elements_text(case when jsonb_typeof(i.d -> 'special_equipment') = 'array' then i.d -> 'special_equipment' else '[]' end)
          ) x(id)
          union all
          select x.id, coalesce(t.d ->> 'name', t.key) || ' ' || coalesce(roman[rk.n], rk.n::text)
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
      where case when w.key ~ '^[0-9]{1,4}:[0-9]{1,4}$' then
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
        select e ->> 'name', e -> 'requires' from jsonb_array_elements(items) e where e ->> 'kind' not in ('integrated', 'mod')
        union all
        -- Every fitted mod, a stray key too, so one that grants can't skip its own requirements.
        select coalesce(coalesce(i.edited, i.data) ->> 'name', i.id), coalesce(i.edited, i.data) -> 'requires'
        from jsonb_each_text(case when jsonb_typeof(mech.m -> 'weapon_mods') = 'object' then mech.m -> 'weapon_mods' else '{}' end) w
        join public.content_items i on i.id = w.value and i.kind = 'mods' and not i.draft
      ) x
      cross join lateral public.unmet_requirements(x.needs, ranked,
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
      where c ->> 'id' <> 'cb_improved_armament'
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
      where public.permanent_bonus(r.b) and exists (select 1 from unnest(mount_types) m where lower(m) = lower(btrim(r.b ->> 'val')))
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
$function$;
