-- Writes the automatic service-record entries (20261120100000_timeline_milestones.sql) that pilots approved before those
-- triggers existed never got. Same titles and bodies as the triggers. Approved and dead pilots get "Approved for duty",
-- one line per licence at its current rank, one for their current level and one per mech, all dated the day they were
-- approved. Every award gets its line on the day it was given, and a dead pilot "Killed in action" on the day they died.
-- A pilot that already has "Approved for duty" was approved under the triggers, so only awards and death are checked.
-- An entry that already exists (same pilot and title, and for awards the same day) is skipped, so running it again adds nothing.

create or replace function private.backfill_service_record() returns integer
language sql set search_path = ''
as $$
  with pilots as (
    select
      c.id, c.status, c.mechs,
      -- Only a pilot that was really approved gets the start-of-career lines (not one that died before approval).
      c.status = 'approved' or c.approved_at is not null as served,
      coalesce(c.approved_at, c.created_at)::date as approved_on,
      coalesce(c.died_at, c.updated_at)::date as died_on,
      exists (
        select 1 from public.pilot_timeline t where t.character_id = c.id and t.kind = 'auto' and t.title = 'Approved for duty'
      ) as recorded
    from public.characters c
  ),
  -- step puts same-day entries in the order they happened: approval, licences, level, mechs, awards, death.
  entries (character_id, title, body, occurred_on, step, sub) as (
    select p.id, 'Approved for duty', null::jsonb, p.approved_on, 1, 0::bigint
    from pilots p where p.served and not p.recorded
    union all
    select p.id, left(coalesce(i.edited ->> 'name', i.data ->> 'name', l.key) || ' licence, rank ' || private.roman(r.rank), 100),
           null, p.approved_on, 2, row_number() over (partition by p.id order by l.key)
    from pilots p
    join public.character_sheets s on s.character_id = p.id
    cross join lateral jsonb_each(case when jsonb_typeof(s.sheet -> 'licences') = 'object' then s.sheet -> 'licences' else '{}' end) l
    cross join lateral (select case when jsonb_typeof(l.value) = 'number' and (l.value)::text::numeric between 1 and 99 then (l.value)::text::numeric::integer end as rank) r
    left join public.content_items i on i.id = l.key
    where p.served and not p.recorded and r.rank > 0
    union all
    select p.id, 'Reached level ' || s.level, null, p.approved_on, 3, 0
    from pilots p join public.character_sheets s on s.character_id = p.id
    where p.served and not p.recorded and s.level > 0
    union all
    select p.id, left('New mech: ' || coalesce(nullif(btrim(m.mech ->> 'name'), ''), 'Unnamed'), 100), null, p.approved_on, 4, m.n
    from pilots p cross join lateral jsonb_array_elements(p.mechs) with ordinality m(mech, n)
    where p.served and not p.recorded and jsonb_typeof(m.mech) = 'object' and m.mech ->> 'id' is not null
    union all
    -- Awards are written for any pilot, as the award trigger does.
    select pc.character_id, left('Awarded ' || coalesce(cm.name, 'a commendation'), 100),
           case when btrim(pc.reason) = '' then null else jsonb_build_object(
             'type', 'doc',
             'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', btrim(pc.reason)))))
           ) end,
           pc.awarded_at::date, 5, row_number() over (partition by pc.character_id order by pc.awarded_at, pc.id)
    from public.pilot_commendations pc left join public.commendations cm on cm.id = pc.commendation_id
    union all
    select p.id, 'Killed in action', null, p.died_on, 6, 0
    from pilots p where p.status = 'dead'
  ),
  inserted as (
    -- created_at climbs by a microsecond per row so same-day entries sort in step order (sortTimeline's tie-break).
    insert into public.pilot_timeline (character_id, kind, title, body, occurred_on, created_at)
    select e.character_id, 'auto', e.title, e.body, e.occurred_on, now() + row_number() over (order by e.step, e.sub) * interval '1 microsecond'
    from entries e
    where not exists (
      select 1 from public.pilot_timeline t
      where t.character_id = e.character_id and t.kind = 'auto' and t.title = e.title
        and (e.step <> 5 or t.occurred_on = e.occurred_on)
    )
    returning 1
  )
  select count(*)::integer from inserted;
$$;

revoke execute on function private.backfill_service_record() from public, anon, authenticated;

select private.backfill_service_record();
