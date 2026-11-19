-- A GM rejecting a change never loses the player's work (CLAUDE.md, "Pending approval workflow"). reject_change now
-- marks the change rejected (the history row, as before) and also gives the player their proposal back as a new
-- draft: the same card and sheet, based_on stamped with the pilot's last change right now (the GM has just reviewed the
-- change against the pilot as it is, so a GM edit made before sending back must not leave the draft stale forever; an
-- edit after it still blocks approval), and the GM's note in review_reason. The site shows a draft with a note as "Sent back".

-- As before, plus: submitting clears the GM's note (the history row keeps it), like submitting a sent-back pilot.
-- Players still can't set review_reason or based_on.
create or replace function private.guard_change_update() returns trigger
language plpgsql set search_path = ''
as $$
declare
  submitting boolean := old.submitted_at is null and new.submitted_at is not null;
begin
  if new.based_on is distinct from old.based_on then
    raise exception 'based_on is set when a change is created and never changes.';
  end if;
  if submitting then
    new.submitted_at := now();
  end if;
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;

  if (new.character_id, new.submitted_by, new.status, new.review_reason, new.reviewed_by, new.reviewed_at, new.created_at)
     is distinct from
     (old.character_id, old.submitted_by, old.status, old.review_reason, old.reviewed_by, old.reviewed_at, old.created_at) then
    raise exception 'Only GMs can change who a change belongs to or how it was reviewed.';
  end if;

  if old.submitted_at is not null and (
    new.submitted_at is not null
    or new.proposed_public is distinct from old.proposed_public
    or new.proposed_sheet is distinct from old.proposed_sheet
  ) then
    raise exception 'This change is waiting for review. Choose Edit change to change it.';
  end if;

  if submitting then
    new.review_reason := null;
  end if;
  return new;
end;
$$;

-- Sends a submitted change back: marks it rejected and gives the player a new draft copy, all-or-nothing. The note is
-- required. GMs and owners only.
create or replace function public.reject_change(change_id bigint, reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  change public.pending_changes;
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can reject changes.';
  end if;
  if nullif(btrim(reason), '') is null then
    raise exception 'Write a reason first, so the player knows what to fix.';
  end if;

  update public.pending_changes
  set status = 'rejected', review_reason = btrim(reason), reviewed_by = auth.uid(), reviewed_at = now()
  where id = change_id and status = 'pending' and submitted_at is not null
  returning * into change;

  if not found then
    raise exception 'Change % is not waiting for review.', change_id;
  end if;

  -- The one-open-change rule is free again now that the change is rejected. The insert trigger only lowers based_on,
  -- and this is the pilot's real last change, so it stays.
  insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, based_on, review_reason)
  values (change.character_id, change.submitted_by, change.proposed_public, change.proposed_sheet,
          private.pilot_last_changed(change.character_id), change.review_reason);
end;
$$;

-- Changes rejected before this migration: give their players a draft too, unless they already have an open change.
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, based_on, review_reason)
select r.character_id, r.submitted_by, r.proposed_public, r.proposed_sheet, private.pilot_last_changed(r.character_id), r.review_reason
from (
  select distinct on (character_id) *
  from public.pending_changes
  order by character_id, created_at desc, id desc
) r
join public.characters c on c.id = r.character_id and c.status = 'approved'
where r.status = 'rejected'
  and not exists (select 1 from public.pending_changes p where p.character_id = r.character_id and p.status = 'pending');
