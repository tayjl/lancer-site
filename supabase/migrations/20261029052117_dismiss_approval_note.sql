-- Approved sheets are protected from player edits. This narrowly clears only the
-- owner's approval note, and refuses a stale request if the GM has changed it.
create function public.dismiss_approval_note(target_character_id bigint, expected_note text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.character_sheets s
  set review_note = null
  from public.characters c
  where s.character_id = c.id
    and c.id = target_character_id
    and c.player_id = auth.uid()
    and c.status = 'approved'
    and s.review_note = expected_note;
  if not found then
    raise exception 'This approval note changed or is not yours to clear. Reload the pilot.';
  end if;
end;
$$;

revoke execute on function public.dismiss_approval_note(bigint, text) from public, anon;
grant execute on function public.dismiss_approval_note(bigint, text) to authenticated;
