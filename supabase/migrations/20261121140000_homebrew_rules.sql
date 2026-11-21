-- Homebrew content fields (the developer, 2026-11-21): requirements, granted equipment, replace-mount choices and mod
-- points from bonuses, checked when a player submits, like the other picker rules.
--
-- 1. Biomods get the fields every other kind has (src/gameData.ts Bionic): effect_bonuses (any bonus id; "bonuses" stays
--    the personal-stat table), integrated and special_equipment (item ids it builds in or unlocks), replace_integrated,
--    and requires. save_bionic takes them as new last arguments.
-- 2. guard_submit_rules gets a 6th step, public.sheet_rule_problems(), mirroring src/rules.ts and src/mechData.ts:
--    - requirements (unmetRequirements): a ranked talent's, taken core bonus's, installed biomod's and owned pilot gear's
--      "requires" hold against the sheet, and on each mech the frame's and every fitted weapon's, system's and mod's,
--      where an item requirement means equipped on that mech (or owned, for pilot gear);
--    - granted equipment (mechProblems): a weapon or system that a core bonus, talent rank, weapon, system or biomod
--      builds in or unlocks (or a talent_item) needs one of those sources present (talentGrants);
--    - replace-mount choices (mountReplacements, choiceKey): the mount each replace_mount bonus replaces is a real mount
--      of the built frame and not an Integrated Auxiliary one;
--    - ranks (pilotProblems): every talent and licence rank is a whole number from 0 to III;
--    - biomod mod points (modPointLimit): installed biomods cost at most 6 + level plus every unconditional mod_points
--      bonus from equipped pilot gear, taken talent ranks, core bonuses and installed biomods.
--    A sheet with more than 50 mechs, 200 biomods or 500 owned pilot gear entries is refused outright ("Sheet too large.").
--    Only problems the approved sheet doesn't already have count, so whatever a GM approved can stay (like step 1's
--    "newly added"). GMs and owners are never checked, as before.
--    shortcut: these differ from the page in edge cases only: a string bonus value counts only when it's a plain number
--    (no {ll} formulas), every published weapon and system counts as a granting source (the page leaves out built-in ones),
--    a core bonus's replace_integrated weapon is told from a system by its kind, and source names are listed
--    alphabetically. Upgrade if a GM ever sees the page and the database disagree.


-- =====================================================================
-- 1. Biomods: the shared homebrew fields
-- =====================================================================

alter table public.bionics
  add column effect_bonuses jsonb not null default '[]'
    check (case when jsonb_typeof(effect_bonuses) = 'array' then jsonb_array_length(effect_bonuses) <= 50 else false end),
  add column integrated text[] not null default '{}' check (cardinality(integrated) <= 50),
  add column special_equipment text[] not null default '{}' check (cardinality(special_equipment) <= 50),
  add column replace_integrated boolean not null default false,
  add column requires jsonb not null default '[]'
    check (case when jsonb_typeof(requires) = 'array' then jsonb_array_length(requires) <= 50 else false end);

drop function public.save_bionic(text, text, text, text, integer, integer, boolean, jsonb, bigint, timestamptz, text);

-- Same as before, with the new fields as last arguments.
create function public.save_bionic(
  new_name text,
  new_description text,
  new_slot text,
  new_effect text,
  new_price integer,
  new_mod_cost integer,
  new_retired boolean,
  new_bonuses jsonb,
  target_id bigint default null,
  expected_updated_at timestamptz default null,
  new_source text default null,
  new_effect_bonuses jsonb default '[]',
  new_integrated text[] default '{}',
  new_special_equipment text[] default '{}',
  new_replace_integrated boolean default false,
  new_requires jsonb default '[]'
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  saved_id bigint;
  saved_at timestamptz;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Only owners can change biomods.';
  end if;
  if length(btrim(coalesce(new_name, ''))) = 0 then
    raise exception 'A biomod needs a name.';
  end if;
  if jsonb_typeof(new_bonuses) is distinct from 'array'
    or exists (select 1 from jsonb_array_elements(new_bonuses) as b(item) where jsonb_typeof(item) is distinct from 'object'
               or jsonb_typeof(item->'stat_id') is distinct from 'string' or jsonb_typeof(item->'amount') is distinct from 'number')
    or (select count(distinct item->>'stat_id') from jsonb_array_elements(new_bonuses) as b(item)) <> jsonb_array_length(new_bonuses)
  then
    raise exception 'The bonuses must be a list with one amount per stat.';
  end if;
  if jsonb_typeof(new_effect_bonuses) is distinct from 'array'
    or exists (select 1 from jsonb_array_elements(new_effect_bonuses) as b(item) where jsonb_typeof(item) is distinct from 'object'
               or jsonb_typeof(item->'id') is distinct from 'string')
  then
    raise exception 'The effect bonuses must be a list of bonuses.';
  end if;
  if jsonb_typeof(new_requires) is distinct from 'array'
    or exists (select 1 from jsonb_array_elements(new_requires) as r(item) where jsonb_typeof(item) is distinct from 'object')
  then
    raise exception 'The requirements must be a list.';
  end if;

  if target_id is null then
    insert into public.bionics (name, description, slot, effect, manna_cost, mod_point_cost, retired, source,
      effect_bonuses, integrated, special_equipment, replace_integrated, requires)
    values (btrim(new_name), new_description, btrim(coalesce(new_slot, '')), coalesce(new_effect, ''), new_price, new_mod_cost, new_retired, nullif(btrim(coalesce(new_source, '')), ''),
      new_effect_bonuses, coalesce(new_integrated, '{}'), coalesce(new_special_equipment, '{}'), coalesce(new_replace_integrated, false), new_requires)
    returning id, updated_at into saved_id, saved_at;
  else
    update public.bionics set name = btrim(new_name), description = new_description, slot = btrim(coalesce(new_slot, '')),
      effect = coalesce(new_effect, ''), manna_cost = new_price, mod_point_cost = new_mod_cost, retired = new_retired,
      source = nullif(btrim(coalesce(new_source, '')), ''), effect_bonuses = new_effect_bonuses,
      integrated = coalesce(new_integrated, '{}'), special_equipment = coalesce(new_special_equipment, '{}'),
      replace_integrated = coalesce(new_replace_integrated, false), requires = new_requires
    where id = target_id and updated_at = expected_updated_at
    returning id, updated_at into saved_id, saved_at;
    if saved_id is null then
      raise exception 'This biomod changed somewhere else, or no longer exists.';
    end if;
    delete from public.bionic_bonuses where bionic_id = saved_id;
  end if;

  insert into public.bionic_bonuses (bionic_id, stat_id, amount)
    select saved_id, b.stat_id, b.amount from jsonb_to_recordset(new_bonuses) as b(stat_id text, amount integer);

  return jsonb_build_object('id', saved_id, 'updated_at', saved_at);
end;
$$;

revoke execute on function public.save_bionic(text, text, text, text, integer, integer, boolean, jsonb, bigint, timestamptz, text, jsonb, text[], text[], boolean, jsonb) from public, anon;
grant execute on function public.save_bionic(text, text, text, text, integer, integer, boolean, jsonb, bigint, timestamptz, text, jsonb, text[], text[], boolean, jsonb) to authenticated;


-- =====================================================================
-- 2. The homebrew rules, as one sheet's problems
-- =====================================================================
-- In public (not private) because guard_submit_rules runs as the player and players can't use the private schema. They
-- read only their arguments, content_items and bionics (which every logged-in user can read), so calling them gains nothing.

-- A bonus that always applies (src/bonuses.ts permanentBonus): no condition, no detail, no weapon or range filter.
create function public.permanent_bonus(bonus jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(bonus -> 'condition', 'null') in ('null', 'false', '0', '""')
    and coalesce(bonus -> 'detail', 'null') in ('null', 'false', '0', '""')
    and not exists (
      select 1 from unnest(array['damage_types', 'range_types', 'weapon_types', 'weapon_sizes']) k
      where jsonb_typeof(bonus -> k) = 'array' and bonus -> k <> '[]'
    );
$$;

-- What a "requires" list names that the sheet hasn't got (src/rules.ts unmetRequirements), in order: "Brawler II",
-- "IPS-N Drake II", a core bonus's or item's name (the id when it isn't published). "owned": the item ids that count.
create function public.unmet_requirements(needs jsonb, pilot jsonb, owned text[]) returns setof text
language sql stable set search_path = ''
as $$
  select case q.kind
      when 'talent' then coalesce(c.d ->> 'name', q.id) || ' ' || q.rank_name
      when 'licence' then case when c.id is null then q.id else coalesce(c.d ->> 'source', '') || ' ' || coalesce(c.d ->> 'name', c.id) end
        || ' ' || q.rank_name
      else coalesce(c.d ->> 'name', q.id)
    end
  from jsonb_array_elements(case when jsonb_typeof(needs) = 'array' then needs else '[]' end) with ordinality r(need, n)
  cross join lateral (
    select r.need ->> 'kind' as kind, r.need ->> 'id' as id, x.rank,
      case when x.rank in (1, 2, 3) then (array['I', 'II', 'III'])[x.rank::integer] else trim_scale(x.rank)::text end as rank_name
    -- A missing or zero rank means I, like Number(rank) || 1.
    from (select coalesce(nullif(case when jsonb_typeof(r.need -> 'rank') = 'number' then (r.need ->> 'rank')::numeric end, 0), 1) as rank) x
  ) q
  left join lateral (
    select i.id, coalesce(i.edited, i.data) as d from public.content_items i
    where i.id = q.id and not i.draft
      and (q.kind = 'item' or i.kind = case q.kind when 'talent' then 'talents' when 'licence' then 'frames' else 'core_bonuses' end)
  ) c on true
  where jsonb_typeof(r.need) = 'object' and q.kind in ('talent', 'licence', 'core_bonus', 'item') and jsonb_typeof(r.need -> 'id') = 'string'
    and case q.kind
      when 'core_bonus' then not coalesce(pilot -> 'core_bonuses' @> to_jsonb(q.id), false)
      when 'item' then not coalesce(q.id = any(owned), false)
      else coalesce(case when jsonb_typeof(pilot -> (q.kind || 's') -> q.id) = 'number' then (pilot -> (q.kind || 's') ->> q.id)::numeric end, 0) < q.rank
    end
  order by r.n;
$$;

-- Every homebrew-rule problem of one sheet (pilot_level: character_sheets.level). at_mech is the mech's key in
-- sheet.mechs, or null for the pilot. "sheet" should have its equipped_gear settled (settle_pilot_gear), as it will be
-- once approved. Content reads edited ?? data and skips drafts, like loadKind().
create function public.sheet_rule_problems(sheet jsonb, pilot_level integer)
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
begin
  -- Anyone logged in can call this, and each mech costs several queries: refuse sheets far beyond real use.
  if (select count(*) from jsonb_object_keys(case when jsonb_typeof(sheet -> 'mechs') = 'object' then sheet -> 'mechs' else '{}' end)) > 50
    or jsonb_array_length(biomods) > 200 or jsonb_array_length(owned) > 500 then
    raise exception 'Sheet too large.';
  end if;

  -- Talent and licence ranks: whole numbers from 0 to III (pilotProblems).
  return query
    select null::text, format('Talent %s must be a whole rank from 0 to III.', r.key)
    from jsonb_each(ranks) r
    where case when jsonb_typeof(r.value) = 'number' then (r.value #>> '{}')::numeric not in (0, 1, 2, 3) else true end
    union all
    select null::text, case when fr.id is null then r.key
        else coalesce(coalesce(fr.edited, fr.data) ->> 'source', '') || ' ' || coalesce(coalesce(fr.edited, fr.data) ->> 'name', fr.id) end
      || ' licence must be a whole rank from 0 to III.'
    from jsonb_each(case when jsonb_typeof(sheet -> 'licences') = 'object' then sheet -> 'licences' else '{}' end) r
    left join public.content_items fr on fr.id = r.key and fr.kind = 'frames' and not fr.draft
    where case when jsonb_typeof(r.value) = 'number' then (r.value #>> '{}')::numeric not in (0, 1, 2, 3) else true end;

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
      from jsonb_array_elements(taken_talents) t where trunc((t ->> 'rank')::numeric) between 1 and 3
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

  -- Mod points: each installed biomod's cost (a repeated one twice, an unknown one nothing) against 6 + level plus the
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
      where rk.n <= least(3, greatest(0, trunc((t ->> 'rank')::numeric)))
    union all
    select bo from jsonb_array_elements(taken_cores) c
      cross join lateral jsonb_array_elements(case when jsonb_typeof(c -> 'd' -> 'bonuses') = 'array' then c -> 'd' -> 'bonuses' else '[]' end) bo
    union all
    select bo from jsonb_array_elements(installed) b cross join lateral jsonb_array_elements(b -> 'effect_bonuses') bo
  ) x(bonus)
  where jsonb_typeof(x.bonus) = 'object' and x.bonus ->> 'id' = 'mod_points'
    and coalesce(x.bonus -> 'condition', 'null') in ('null', 'false', '0', '""');

  points := greatest(0, 6 + pilot_level + extra);
  if used > points then
    at_mech := null;
    problem := case when points = 6 + pilot_level
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
        cross join lateral (select case when (t ->> 'rank')::numeric % 1 = 0 then least(3, greatest(0, (t ->> 'rank')::numeric)) else 0 end as upto) u
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
      where rk.n <= least(3, greatest(0, trunc((t ->> 'rank')::numeric)))
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
      where (t ->> 'rank')::numeric % 1 = 0 and rk.n <= least(3, (t ->> 'rank')::numeric)
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

revoke execute on function public.permanent_bonus(jsonb) from public, anon;
revoke execute on function public.unmet_requirements(jsonb, jsonb, text[]) from public, anon;
revoke execute on function public.sheet_rule_problems(jsonb, integer) from public, anon;
grant execute on function public.permanent_bonus(jsonb) to authenticated;
grant execute on function public.unmet_requirements(jsonb, jsonb, text[]) to authenticated;
grant execute on function public.sheet_rule_problems(jsonb, integer) to authenticated;


-- =====================================================================
-- 3. guard_submit_rules: step 6 added (steps 1 to 5 as in 20261121110000_pilot_inventory.sql)
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
    select s.sheet, s.manna, s.level into proposed, received, pilot_level from public.character_sheets s where s.character_id = new.id;
    mechs := new.mechs;
  else
    proposed := new.proposed_sheet;
    mechs := new.proposed_public -> 'mechs';
    select s.sheet, s.manna, s.level into approved, received, pilot_level from public.character_sheets s where s.character_id = new.character_id;
  end if;
  proposed := coalesce(proposed, '{}');
  approved := coalesce(approved, '{}');
  received := coalesce(received, starting_manna);
  pilot_level := coalesce(pilot_level, 0);

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
    + coalesce((
      -- Nested cases, so the cast only ever sees a number.
      select sum(coalesce(case when jsonb_typeof(g.d -> 'manna_cost') = 'number' then
                   case when (g.d ->> 'manna_cost')::numeric >= 0 and (g.d ->> 'manna_cost')::numeric % 1 = 0
                        then (g.d ->> 'manna_cost')::numeric end end, default_gear_price))
      from jsonb_array_elements(public.settle_pilot_gear(proposed,
        case when tg_table_name = 'pending_changes' then approved end, tg_table_name = 'characters') -> 'owned_gear') e
      join (select i.id, coalesce(i.edited, i.data) as d from public.content_items i where i.kind = 'pilot_gear') g
        on g.id = e ->> 'id'
      where e -> 'free' is distinct from 'true'::jsonb
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
