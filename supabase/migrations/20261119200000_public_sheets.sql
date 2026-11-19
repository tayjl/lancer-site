-- Everything on a pilot's sheet is public to logged-in users, except the backstory (public only if its player toggles
-- it, see pilot_public_backstory), manna, and the GM's review note. RLS works on whole rows, so character_sheets stays
-- as it is (own player, GMs and owners): this function is how everyone else reads a sheet. It returns the sheet without
-- its backstory, plus level (public now). It never returns manna (private to the player and GMs), review_note,
-- experience, the reward log or reputation, and it never touches pending_changes, so draft and submitted changes stay
-- private. Works for every status (pending, approved, dead). No row (and no error) for an unknown pilot.

create function public.pilot_sheet(target_character_id bigint)
returns table (sheet jsonb, level integer)
language sql stable security definer set search_path = ''
as $$
  select s.sheet - 'backstory', s.level
  from public.character_sheets s
  where s.character_id = target_character_id
    and (select auth.uid()) is not null;
$$;

revoke execute on function public.pilot_sheet(bigint) from public, anon;
grant execute on function public.pilot_sheet(bigint) to authenticated;
