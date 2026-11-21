-- Every pilot's ID card for the pilot lists (registry, pending, memorial) in one request. Level and licence level live in
-- character_sheets, which other players can't read directly. Logged-in users can already read every characters row,
-- every profile, and any pilot's level and licences through pilot_sheet(), so this shows nothing new: the same fields
-- as pilot_card() (same level, licence level and medals logic) plus the dates the lists sort by and the player's name.
-- Like fetchPilots() in src/pilots.ts: 'pending' lists only submitted pilots (drafts and sent-back pilots have no
-- submitted_at), oldest submission first; the other statuses oldest first. Nothing private: no manna, backstory, sheet,
-- review note, experience or reputation.
create function public.pilot_cards(target_status public.character_status)
returns table (
  id bigint,
  callsign text,
  pilot_name text,
  status public.character_status,
  approved_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz,
  level integer,
  licence_level integer,
  pilot_image text,
  colour text,
  medals text[],
  player_name text
)
language sql stable security definer set search_path = ''
as $$
  select
    c.id,
    c.callsign,
    c.pilot_name,
    c.status,
    c.approved_at,
    c.submitted_at,
    c.created_at,
    coalesce(s.level, 0),
    coalesce((
      select least(coalesce(sum(greatest(0, l.value::numeric)), 0), 2147483647) -- never overflows the integer cast
      from jsonb_each(case when jsonb_typeof(s.sheet -> 'licences') = 'object' then s.sheet -> 'licences' end) l
      where jsonb_typeof(l.value) = 'number'
    ), 0)::integer,
    c.pilot_image,
    p.colour,
    array(
      select m.icon
      from public.pilot_commendations a
      join public.commendations m on m.id = a.commendation_id
      where a.character_id = c.id
      order by a.awarded_at, a.id
    ),
    u.display_name
  from public.characters c
  left join public.character_sheets s on s.character_id = c.id
  left join public.pilot_profiles p on p.character_id = c.id
  left join public.profiles u on u.id = c.player_id
  where c.status = target_status
    and (target_status <> 'pending' or c.submitted_at is not null)
    and (select auth.uid()) is not null
  order by case when target_status = 'pending' then c.submitted_at else c.created_at end, c.id;
$$;

revoke execute on function public.pilot_cards(public.character_status) from public, anon;
grant execute on function public.pilot_cards(public.character_status) to authenticated;
