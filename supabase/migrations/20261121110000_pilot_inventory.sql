-- Pilot inventory (decided by the developer, 2026-11-20). Pilot gear (content kind 'pilot_gear': armour, weapons,
-- gear) is OWNED once bought, and an approved pilot equips and swaps what it owns without GM approval. Buying goes
-- through the normal change -> approval, because it spends manna.
--
-- Sheet shape (replaces sheet.pilot_gear and sheet.pilot_gear_notes, which this migration converts and removes):
--   owned_gear:    [{ key, id, notes?, free? }]  one entry per copy (duplicates allowed); key is a stable per-copy id
--   equipped_gear: [key, ...]                    owned keys currently equipped
-- Price: the item's manna_cost (coalesce(edited, data), like loadKind()), a whole number 0 or more, else 100.
-- "free" is decided here, never trusted from the page (public.settle_pilot_gear; players can't write it at all,
-- private.guard_sheet_free_flags):
--   - first approval (pending -> approved, however it happens): the first 1 Armor, 2 Weapon and 3 Gear in owned
--     order are free, the rest aren't;
--   - approving a change: an entry stays free only if the same key with the same id was free on the live sheet.
-- An approved pilot's live equipped_gear is the truth: a change can't alter it (approve_change keeps the live one),
-- and public.equip_pilot_gear() is how it changes.
--
-- Misc items (decided by the developer, 2026-11-20): sheet.misc_items: [{ key, name, notes? }], free text a GM gives a
-- pilot (no stats, never equipped, no manna). Only GMs and owners change them (private.guard_sheet_misc_items,
-- guard_submit_rules, approve_change keeps the live list).


-- =====================================================================
-- 1. Free flags and equipped list, decided by the server
-- =====================================================================

-- Returns "proposed" with every owned entry's free flag set as described above, and equipped_gear set to the
-- proposal's own list on first approval (trimmed to the slot limits, keys of other or unknown types dropped) or the
-- live list otherwise, keeping only keys that are still owned (each once, in order). A repeated key is free at most
-- once. Non-object entries are left as they are. First approval with a live sheet (a pilot approved before, moved back
-- to pending and approved again) keeps free only entries the live sheet had free, still within 1/2/3.
-- In public (not private) because guard_submit_rules runs as the player and players can't use the private schema.
-- It reads only its arguments and content_items (which every logged-in user can read), so calling it gains nothing.
create function public.settle_pilot_gear(proposed jsonb, live jsonb, first_approval boolean) returns jsonb
language sql stable set search_path = ''
as $$
  with owned as (
    select e.value as entry, e.ordinality as n, e.value ->> 'key' as key, e.value ->> 'id' as id,
      coalesce(i.edited, i.data) ->> 'type' as type
    from jsonb_array_elements(case when jsonb_typeof(proposed -> 'owned_gear') = 'array' then proposed -> 'owned_gear' else '[]' end)
      with ordinality e
    left join public.content_items i on i.kind = 'pilot_gear' and i.id = e.value ->> 'id'
  ), live_owned as (
    select e ->> 'key' as key, e ->> 'id' as id, e -> 'free' = 'true'::jsonb as free
    from jsonb_array_elements(case when jsonb_typeof(live -> 'owned_gear') = 'array' then live -> 'owned_gear' else '[]' end) e
  ), candidates as (
    -- On first approval with no live sheet everything can be free; otherwise only what the live sheet had free.
    select o.*, (first_approval and live is null)
      or exists (select 1 from live_owned l where l.key = o.key and l.id = o.id and l.free) as may_be_free
    from owned o
  ), settled as (
    select c.n, case when jsonb_typeof(c.entry) <> 'object' then c.entry else c.entry || jsonb_build_object('free',
      case when first_approval
        then c.may_be_free and coalesce(row_number() over (partition by c.type, c.may_be_free order by c.n)
                      <= case c.type when 'Armor' then 1 when 'Weapon' then 2 when 'Gear' then 3 end, false)
        else row_number() over (partition by c.key order by c.n) = 1 and c.may_be_free
      end) end as entry
    from candidates c
  ), equipped as (
    select q.k, min(q.n) as n,
      (select o.type from owned o where o.key = q.k order by o.n limit 1) as type
    from jsonb_array_elements_text(case
        when jsonb_typeof(case when first_approval then proposed else live end -> 'equipped_gear') = 'array'
        then (case when first_approval then proposed else live end) -> 'equipped_gear' else '[]' end
      ) with ordinality q(k, n)
    where exists (select 1 from owned o where o.key = q.k)
    group by q.k
  ), kept as (
    -- First approval also trims the player's list to 1 Armor, 2 Weapon and 3 Gear, in list order.
    select e.k, e.n from (select e.*, row_number() over (partition by e.type order by e.n) as r from equipped e) e
    where not first_approval or e.r <= case e.type when 'Armor' then 1 when 'Weapon' then 2 when 'Gear' then 3 end
  )
  select coalesce(proposed, '{}') || jsonb_build_object(
    'owned_gear', coalesce((select jsonb_agg(s.entry order by s.n) from settled s), '[]'),
    'equipped_gear', coalesce((select jsonb_agg(k.k order by k.n) from kept k), '[]'));
$$;

revoke execute on function public.settle_pilot_gear(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.settle_pilot_gear(jsonb, jsonb, boolean) to authenticated;

-- First approval marks the free starting loadout. A trigger, so every way a pilot becomes approved (approve_pilot or a
-- GM setting the status) does it. Security definer so the sheet write isn't limited by the caller's rights.
-- A pilot approved before (approved_at set; approve_pilot sets it in the same update, so "old" has the earlier value)
-- can't gain free items this way: only entries already free stay free, within the starting 1/2/3. Pilots approved before
-- approved_at existed are spotted by owned entries that already have a free flag (only approval and the backfill set
-- one; guard_sheet_free_flags stops players).
create function private.settle_gear_on_approval() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.character_sheets
  set sheet = public.settle_pilot_gear(sheet,
    case when old.approved_at is not null or jsonb_path_exists(sheet, '$.owned_gear[*].free') then sheet end, true)
  where character_id = new.id;
  return null;
end;
$$;

revoke execute on function private.settle_gear_on_approval() from public;

create trigger characters_settle_gear
  after update of status on public.characters
  for each row when (old.status = 'pending' and new.status = 'approved')
  execute function private.settle_gear_on_approval();

-- Players never set "free": on a new sheet it's removed, and on an edit each owned entry keeps the free flag the same
-- key with the same item had on the saved sheet (none if it's new). Gear owned at the last approval can't be dropped
-- while the pilot is pending again (no refunds, like a change). GMs, owners and database functions are left alone.
create function private.guard_sheet_free_flags() returns trigger
language plpgsql set search_path = ''
as $$
declare
  old_owned jsonb := case when tg_op = 'UPDATE' and jsonb_typeof(old.sheet -> 'owned_gear') = 'array' then old.sheet -> 'owned_gear' else '[]' end;
  removed_names text;
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;

  -- Entries with a free flag were owned when the pilot was last approved (only approval and the backfill set one).
  select string_agg(distinct coalesce(coalesce(i.edited, i.data) ->> 'name', l ->> 'id'), ', ')
  into removed_names
  from jsonb_array_elements(old_owned) l
  left join public.content_items i on i.kind = 'pilot_gear' and i.id = l ->> 'id'
  where l -> 'free' is not null
    and not coalesce(new.sheet -> 'owned_gear' @> jsonb_build_array(jsonb_build_object('key', l -> 'key', 'id', l -> 'id')), false);
  if removed_names is not null then
    raise exception '%', 'Owned pilot gear can''t be removed: ' || removed_names || '.';
  end if;

  if jsonb_typeof(new.sheet -> 'owned_gear') is distinct from 'array' then
    return new;
  end if;

  new.sheet := jsonb_set(new.sheet, '{owned_gear}', coalesce((
    select jsonb_agg(case when jsonb_typeof(e.value) <> 'object' then e.value else (e.value - 'free') || coalesce((
        select jsonb_build_object('free', o -> 'free') from jsonb_array_elements(old_owned) o
        where o -> 'key' = e.value -> 'key' and o -> 'id' = e.value -> 'id' and o -> 'free' is not null
        order by o -> 'free' = 'true'::jsonb desc limit 1), '{}') end order by e.ordinality)
    from jsonb_array_elements(new.sheet -> 'owned_gear') with ordinality e), '[]'));
  return new;
end;
$$;

revoke execute on function private.guard_sheet_free_flags() from public;

create trigger character_sheets_free_flags
  before insert or update on public.character_sheets
  for each row execute function private.guard_sheet_free_flags();

-- Misc items are the GM's. A player's sheet write keeps the saved list exactly (none on a new sheet). Anyone else's
-- write that changes the list is checked: a list of { key, name, notes? } with unique keys, name 1 to 60 characters
-- after trimming, notes 140 or fewer.
create function private.guard_sheet_misc_items() returns trigger
language plpgsql set search_path = ''
as $$
declare
  misc jsonb := new.sheet -> 'misc_items';
begin
  if current_user in ('authenticated', 'anon') and not public.is_gm() then
    new.sheet := (new.sheet - 'misc_items') || case when tg_op = 'UPDATE' and old.sheet ? 'misc_items'
      then jsonb_build_object('misc_items', old.sheet -> 'misc_items') else '{}' end;
    return new;
  end if;

  if misc is null or (tg_op = 'UPDATE' and misc is not distinct from old.sheet -> 'misc_items') then
    return new;
  end if;
  if jsonb_typeof(misc) <> 'array' then
    raise exception 'Misc items must be a list.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(misc) e
    having count(*) filter (where jsonb_typeof(e -> 'key') is distinct from 'string' or e ->> 'key' = '') > 0
      or count(*) <> count(distinct e ->> 'key')
  ) then
    raise exception 'Misc items have a missing or repeated key.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(misc) e
    where jsonb_typeof(e -> 'name') is distinct from 'string' or char_length(btrim(e ->> 'name')) not between 1 and 60
  ) then
    raise exception 'Misc item names must be 1 to 60 characters.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(misc) e
    where coalesce(jsonb_typeof(e -> 'notes'), 'null') not in ('string', 'null') or char_length(e ->> 'notes') > 140
  ) then
    raise exception 'Misc item notes must be 140 characters or fewer.';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_sheet_misc_items() from public;

create trigger character_sheets_misc_items
  before insert or update on public.character_sheets
  for each row execute function private.guard_sheet_misc_items();


-- =====================================================================
-- 2. Approving a change: free flags and the live equipped list
-- =====================================================================

-- Copied from 20261116225551_approval_hardening.sql; only the sheet written changes: it goes through
-- settle_pilot_gear against the live sheet (free flags from the live sheet, equipped list kept from the live sheet),
-- and misc_items is kept from the live sheet.
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


-- =====================================================================
-- 3. Equipping, for approved pilots, without a change
-- =====================================================================

-- Equipping doesn't count as the pilot changing: it mustn't make the player's own pending change stale (approve_change
-- keeps the live equipped list anyway). So the sheet's updated_at ignores equipped_gear. Replaces the trigger from
-- 20261029024308_pending_change_drafts.sql. Sheets are always objects (a check constraint).
drop trigger character_sheets_updated_at on public.character_sheets;
create trigger character_sheets_updated_at
  before update on public.character_sheets
  for each row when ((old.sheet - 'equipped_gear') is distinct from (new.sheet - 'equipped_gear'))
  execute procedure extensions.moddatetime (updated_at);

-- Sets an approved pilot's equipped gear: its player, or any GM or owner. Every key must be owned on the live sheet,
-- once, within 1 Armor, 2 Weapon and 3 Gear. An owned item whose content isn't loaded (or has another type) can't be
-- equipped. Writes only sheet.equipped_gear. Returns the sheet's updated_at, which
-- equipping doesn't move, so the page's optimistic-lock value stays valid.
create function public.equip_pilot_gear(target_character_id bigint, keys text[]) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  pilot public.characters;
  owned jsonb;
  full_type text;
  stamp timestamptz;
begin
  select * into pilot from public.characters where id = target_character_id for update;
  if not found or not (public.is_gm() or pilot.player_id = (select auth.uid())) then
    raise exception 'Not your pilot.';
  end if;
  if pilot.status <> 'approved' then
    raise exception 'Only an approved pilot can change equipped gear.';
  end if;
  keys := coalesce(keys, '{}');

  select s.sheet -> 'owned_gear' into owned from public.character_sheets s where s.character_id = target_character_id for update;
  owned := case when jsonb_typeof(owned) = 'array' then owned else '[]' end;

  if exists (
    select 1 from unnest(keys) k
    where k is null or not exists (select 1 from jsonb_array_elements(owned) e where e ->> 'key' = k)
  ) then
    raise exception 'Not owned.';
  end if;
  if cardinality(keys) <> (select count(distinct k) from unnest(keys) k) then
    raise exception 'Equipped twice.';
  end if;
  if exists (
    select 1 from unnest(keys) k
    cross join lateral (select e ->> 'id' as id from jsonb_array_elements(owned) e where e ->> 'key' = k limit 1) o
    left join public.content_items i on i.kind = 'pilot_gear' and i.id = o.id
    where coalesce(coalesce(i.edited, i.data) ->> 'type', '') not in ('Armor', 'Weapon', 'Gear')
  ) then
    raise exception 'Not pilot gear.';
  end if;

  select c.type into full_type
  from (
    select coalesce(i.edited, i.data) ->> 'type' as type, count(*) as n
    from unnest(keys) k
    cross join lateral (select e ->> 'id' as id from jsonb_array_elements(owned) e where e ->> 'key' = k limit 1) o
    join public.content_items i on i.kind = 'pilot_gear' and i.id = o.id
    group by 1
  ) c
  where c.n > case c.type when 'Armor' then 1 when 'Weapon' then 2 when 'Gear' then 3 end
  order by c.type
  limit 1;
  if full_type is not null then
    raise exception '%', case full_type
      when 'Armor' then 'Only 1 pilot armour fits.'
      when 'Weapon' then 'Only 2 pilot weapons fit.'
      else 'Only 3 pilot gear fit.' end;
  end if;

  update public.character_sheets
  set sheet = jsonb_set(sheet, '{equipped_gear}', to_jsonb(keys))
  where character_id = target_character_id
  returning updated_at into stamp;
  return stamp;
end;
$$;

revoke execute on function public.equip_pilot_gear(bigint, text[]) from public, anon;
grant execute on function public.equip_pilot_gear(bigint, text[]) to authenticated;


-- =====================================================================
-- 4. Submit check: bought gear costs manna, and bought gear can't be dropped for a refund
-- =====================================================================

-- Copied from 20261121090000_starting_manna_2000.sql (see 20261119170000_enforce_picker_rules.sql for what this
-- checks). Changes: owned pilot gear that isn't free (decided by settle_pilot_gear, never by the sheet) adds its price
-- to the spend, a change can't remove or swap an owned item of the approved sheet (no refunds), and owned entries need
-- unique keys and (when newly owned) a known pilot gear id. Restricted gear in
-- owned_gear is already caught by the id match in step 1. A change can't alter misc_items. Its two triggers already
-- point at it.
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

  if cardinality(problems) > 0 then
    raise exception '%', array_to_string(problems, ' ');
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_submit_rules() from public;


-- =====================================================================
-- 5. Converting existing sheets and changes
-- =====================================================================

-- Turns one sheet's pilot_gear (and pilot_gear_notes) into owned_gear and equipped_gear, and removes the old fields.
-- Each id becomes an owned entry, all equipped. A note moves to the entry in its slot ("Type:index", index within
-- the type, in pilot_gear order, as the page worked them out). An id that is owned in "live" (the pilot's converted
-- sheet) at the same occurrence reuses that key and its free flag, so a change doesn't look like it rebought
-- everything; any other id gets a new key and free = new_free (left out when null).
create function private.gear_to_owned(sheet jsonb, live jsonb, new_free boolean) returns jsonb
language sql set search_path = ''
as $$
  with gear as (
    select g.id, g.n, row_number() over (partition by g.id order by g.n) as occurrence,
      coalesce(i.edited, i.data) ->> 'type' as type
    from jsonb_array_elements_text(case when jsonb_typeof(sheet -> 'pilot_gear') = 'array' then sheet -> 'pilot_gear' else '[]' end)
      with ordinality g(id, n)
    left join public.content_items i on i.kind = 'pilot_gear' and i.id = g.id
  ), slotted as (
    select gear.*, gear.type || ':' || (row_number() over (partition by gear.type order by gear.n) - 1) as slot from gear
  ), live_owned as (
    select e.value ->> 'id' as id, e.value ->> 'key' as key, e.value -> 'free' as free,
      row_number() over (partition by e.value ->> 'id' order by e.ordinality) as occurrence
    from jsonb_array_elements(case when jsonb_typeof(live -> 'owned_gear') = 'array' then live -> 'owned_gear' else '[]' end)
      with ordinality e
  ), owned as materialized (
    select s.n, jsonb_strip_nulls(jsonb_build_object(
      'key', coalesce(l.key, gen_random_uuid()::text),
      'id', s.id,
      'notes', sheet -> 'pilot_gear_notes' ->> s.slot,
      'free', case when l.key is not null then l.free else to_jsonb(new_free) end)) as entry
    from slotted s
    left join live_owned l on l.id = s.id and l.occurrence = s.occurrence
  )
  select (sheet - 'pilot_gear' - 'pilot_gear_notes') || jsonb_build_object(
    'owned_gear', coalesce((select jsonb_agg(o.entry order by o.n) from owned o), '[]'),
    'equipped_gear', coalesce((select jsonb_agg(o.entry -> 'key' order by o.n) from owned o), '[]'));
$$;

-- Converts every sheet without owned_gear (approved and dead pilots own theirs free; a pending pilot's free flags are
-- left for its first approval), then every change (drafts, submitted and reviewed ones), sharing keys with the
-- pilot's sheet; extra ids in a change are new, not free. Running it again changes nothing. Returns rows changed.
create function private.backfill_owned_gear() returns integer
language plpgsql set search_path = ''
as $$
declare
  sheets integer;
  changes integer;
begin
  update public.character_sheets s
  set sheet = private.gear_to_owned(s.sheet, null, case when c.status = 'pending' then null else true end)
  from public.characters c
  where c.id = s.character_id and not s.sheet ? 'owned_gear';
  get diagnostics sheets = row_count;

  update public.pending_changes p
  set proposed_sheet = private.gear_to_owned(
    p.proposed_sheet, (select s.sheet from public.character_sheets s where s.character_id = p.character_id), false)
  where not p.proposed_sheet ? 'owned_gear';
  get diagnostics changes = row_count;

  return sheets + changes;
end;
$$;

revoke execute on function private.gear_to_owned(jsonb, jsonb, boolean), private.backfill_owned_gear() from public, anon, authenticated;

-- Converting isn't an edit: keep updated_at as it is, so open pages and pending changes don't see a conflict or go stale.
alter table public.character_sheets disable trigger character_sheets_updated_at;
alter table public.pending_changes disable trigger pending_changes_updated_at;
select private.backfill_owned_gear();
alter table public.character_sheets enable trigger character_sheets_updated_at;
alter table public.pending_changes enable trigger pending_changes_updated_at;
