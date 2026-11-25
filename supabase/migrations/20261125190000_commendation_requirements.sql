-- Commendation requirements: a requires entry {"kind": "commendation", "id": "<commendations.id>"} is met when the pilot has
-- that award (public.pilot_commendations, hidden commendations count too).
--
-- 1. public.unmet_requirements: copied from 20261121140000_homebrew_rules.sql. Only the 'commendation' kind is new: it
--    reads pilot -> 'commendations' (an array of award ids) and takes the name from public.commendations.
--    public.sheet_rule_problems is unchanged: it already passes the whole sheet as "pilot".
-- 2. private.guard_submit_rules: copied from the live definition (20261122120000_editable_rule_numbers.sql, after the
--    rule_number rewrite in 20261124100000). Only the awards are new: a server-side "commendations" array merged onto
--    both the proposed and the approved sheet before sheet_rule_problems, so a lost award isn't a new problem.
--    The database value is on the right of ||, so a "commendations" key in a player's sheet counts for nothing.

create or replace function public.unmet_requirements(needs jsonb, pilot jsonb, owned text[]) returns setof text
language sql stable set search_path = ''
as $$
  select case q.kind
      when 'talent' then coalesce(c.d ->> 'name', q.id) || ' ' || q.rank_name
      when 'licence' then case when c.id is null then q.id else coalesce(c.d ->> 'source', '') || ' ' || coalesce(c.d ->> 'name', c.id) end
        || ' ' || q.rank_name
      when 'commendation' then coalesce(m.name, q.id)
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
  left join lateral (
    -- Commendation ids are uuids: an id that isn't one has no name (and isn't awarded either).
    select cm.name from public.commendations cm
    where q.kind = 'commendation' and cm.id::text = q.id
  ) m on true
  where jsonb_typeof(r.need) = 'object' and q.kind in ('talent', 'licence', 'core_bonus', 'item', 'commendation') and jsonb_typeof(r.need -> 'id') = 'string'
    and case q.kind
      when 'core_bonus' then not coalesce(pilot -> 'core_bonuses' @> to_jsonb(q.id), false)
      when 'commendation' then not coalesce(pilot -> 'commendations' @> to_jsonb(q.id), false)
      when 'item' then not coalesce(q.id = any(owned), false)
      else coalesce(case when jsonb_typeof(pilot -> (q.kind || 's') -> q.id) = 'number' then (pilot -> (q.kind || 's') ->> q.id)::numeric end, 0) < q.rank
    end
  order by r.n;
$$;

CREATE OR REPLACE FUNCTION private.guard_submit_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  -- Manna prices and the starting manna: content items 'rule_num_<key>' (kind 'rules'), editable by owners. The numbers
  -- here are the fallbacks (and the ranges a stored value must sit in), the same as RULE_NUMBERS in src/rulesData.ts.
  licence_rank_price numeric := public.rule_number('licence_rank_price');
  talent_rank_price numeric := public.rule_number('talent_rank_price');
  extra_mech_price numeric := public.rule_number('extra_mech_price');
  -- A pilot gear item's price when its manna_cost isn't set (or isn't a whole number, 0 or more).
  default_gear_price numeric := public.rule_number('default_gear_price');
  -- character_sheets.manna's default, for a pilot with no sheet row yet.
  starting_manna numeric := public.rule_number('starting_manna');

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
  awards jsonb;
  pilot_id bigint;
  problems text[] := '{}';
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;

  if tg_table_name = 'characters' then
    pilot_id := new.id;
    select s.sheet, s.manna, s.level, s.gm_grants into proposed, received, pilot_level, grants from public.character_sheets s where s.character_id = new.id;
    mechs := new.mechs;
  else
    pilot_id := new.character_id;
    proposed := new.proposed_sheet;
    mechs := new.proposed_public -> 'mechs';
    select s.sheet, s.manna, s.level, s.gm_grants into approved, received, pilot_level, grants from public.character_sheets s where s.character_id = new.character_id;
  end if;
  proposed := coalesce(proposed, '{}');
  approved := coalesce(approved, '{}');
  received := coalesce(received, starting_manna);
  pilot_level := coalesce(pilot_level, 0);
  grants := coalesce(grants, '{}');
  -- The pilot's awarded commendations, from the database only. Merged on the right of || below, so a "commendations" key
  -- a player writes into the sheet is overwritten.
  select jsonb_build_object('commendations', coalesce(jsonb_agg(pc.commendation_id::text), '[]'))
  into awards
  from public.pilot_commendations pc
  where pc.character_id = pilot_id;

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

  -- 6. Homebrew rules (public.sheet_rule_problems): requirements (commendations come from awards), granted equipment, replace-mount choices and biomod mod
  -- points. Only problems the approved sheet doesn't already have (a new pilot has none), so what a GM approved can stay.
  -- A mech's problems start with its name from the public card, like the page's rule check.
  problems := problems || array(
    select case when p.at_mech is null then p.problem else coalesce((
        select nullif(btrim(e ->> 'name'), '') from jsonb_array_elements(case when jsonb_typeof(mechs) = 'array' then mechs else '[]' end) e
        where e ->> 'id' = p.at_mech limit 1), 'A mech') || ': ' || p.problem end
    from (
      select * from public.sheet_rule_problems(public.settle_pilot_gear(proposed,
        case when tg_table_name = 'pending_changes' then approved end, tg_table_name = 'characters') || awards, pilot_level)
      except
      select * from public.sheet_rule_problems(approved || awards, pilot_level)
    ) p
    order by p.at_mech nulls first, p.problem
  );

  if cardinality(problems) > 0 then
    raise exception '%', array_to_string(problems, ' ');
  end if;
  return new;
end;
$function$;
