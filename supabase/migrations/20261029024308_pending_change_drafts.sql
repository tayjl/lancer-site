-- Pending changes for approved pilots (CLAUDE.md, "Pending approval workflow").
-- A change starts as a draft the player edits (submitted_at is null); submitting puts it in the GM queue,
-- oldest submission first. Players can take it back to a draft or withdraw it until a GM reviews it.
alter table public.pending_changes add column submitted_at timestamptz;

-- The "changed since" check in approve_change compares against the sheet's updated_at. Only an edit to the
-- sheet itself counts: a GM setting level or manna, or a review note, mustn't block approving a change.
drop trigger character_sheets_updated_at on public.character_sheets;
create trigger character_sheets_updated_at
  before update on public.character_sheets
  for each row when (old.sheet is distinct from new.sheet)
  execute procedure extensions.moddatetime (updated_at);

-- As before, but only a submitted change can be approved: a draft is still being written.
create or replace function public.approve_change(change_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  change public.pending_changes;
  last_changed timestamptz;
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can approve changes.';
  end if;

  select * into change from public.pending_changes where id = change_id for update;
  if not found or change.status <> 'pending' or change.submitted_at is null then
    raise exception 'Change % is not waiting for review.', change_id;
  end if;

  -- Lock the character while it's checked and updated.
  select greatest(c.updated_at, s.updated_at) into last_changed
  from public.characters c
  left join public.character_sheets s on s.character_id = c.id
  where c.id = change.character_id
  for update of c;

  if last_changed > change.based_on then
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

  insert into public.character_sheets (character_id, sheet)
  values (change.character_id, change.proposed_sheet)
  on conflict (character_id) do update set sheet = excluded.sheet;

  update public.pending_changes
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = change_id;
end;
$$;
