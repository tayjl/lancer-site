-- Hardens the approval workflow (docs/approval-and-security.md, "Pending approval workflow"): the database, not the page,
-- now decides who can change what once a change is submitted, how a pilot or change is approved or
-- rejected, and who can delete characters.


-- =====================================================================
-- 1. "Last changed" and based_on
-- =====================================================================

-- When a pilot last changed: its card or its sheet (a GM setting level, manna or a note doesn't count, see
-- 20261029024308_pending_change_drafts.sql). approve_change, approve_pilot and the based_on trigger all use this.
create function private.pilot_last_changed(target_character_id bigint) returns timestamptz
language sql stable set search_path = ''
as $$
  select greatest(c.updated_at, s.updated_at)
  from public.characters c
  left join public.character_sheets s on s.character_id = c.id
  where c.id = target_character_id;
$$;

revoke execute on function private.pilot_last_changed(bigint) from public;

-- based_on is when the pilot last changed, as the player saw it when they started the change. The page sends
-- that, and the trigger below clamps it to no later than the pilot's real last change, so a player can't fake
-- a late value to get past approve_change's "changed since" check. The default only applies if nothing is sent.
alter table public.pending_changes alter column based_on set default now();

create function private.set_change_based_on() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- An honest earlier value is kept: the player may have loaded the pilot before a GM edited it.
  new.based_on := least(new.based_on, coalesce(private.pilot_last_changed(new.character_id), now()));
  return new;
end;
$$;

create trigger pending_changes_set_based_on
  before insert on public.pending_changes
  for each row execute function private.set_change_based_on();


-- =====================================================================
-- 2. Submitted changes are locked
-- =====================================================================

-- Players can edit their own change while it's pending. Once it's submitted, the GM is reading it, so the
-- only thing they can do is take it back to a draft ("Edit change": submitted_at back to null). Withdrawing
-- (delete) is still allowed. Whenever a change is submitted, the database stamps the time itself, so a GM who
-- opened it earlier can tell it was edited and resubmitted (approve_change below). Nobody changes based_on after the insert. Only the site's own roles are checked,
-- like guard_gm_only_sheet_fields: the dashboard and database functions (approve_change) are left alone.
create function private.guard_change_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.based_on is distinct from old.based_on then
    raise exception 'based_on is set when a change is created and never changes.';
  end if;
  if old.submitted_at is null and new.submitted_at is not null then
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
  return new;
end;
$$;

create trigger pending_changes_guard_update
  before update on public.pending_changes
  for each row execute function private.guard_change_update();


-- =====================================================================
-- 3. Approving and rejecting changes
-- =====================================================================

-- review_reason holds the GM's note for either outcome: the reason for a rejection (required), or an
-- optional note with an approval.
comment on column public.pending_changes.review_reason is
  'The GM''s note to the player. Required when rejected, optional when approved.';

drop function public.approve_change(bigint);

-- As before, plus the GM's optional note, stored in review_reason. expected_submitted_at is the submitted_at the
-- GM loaded: if the player took the change back, edited it and resubmitted since, it differs and the GM hasn't seen
-- what they'd approve, so it refuses. Compared to the millisecond, because the page reads these times as
-- JavaScript dates, which drop the microseconds (the same goes for the "changed since" check below).
create function public.approve_change(change_id bigint, expected_submitted_at timestamptz, note text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  change public.pending_changes;
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

  insert into public.character_sheets (character_id, sheet)
  values (change.character_id, change.proposed_sheet)
  on conflict (character_id) do update set sheet = excluded.sheet;

  update public.pending_changes
  set status = 'approved', review_reason = nullif(btrim(note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = change_id;
end;
$$;

-- Rejects a submitted change, in one statement, with a reason the player sees. GMs and owners only.
create function public.reject_change(change_id bigint, reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can reject changes.';
  end if;
  if nullif(btrim(reason), '') is null then
    raise exception 'Write a reason first, so the player knows what to fix.';
  end if;

  update public.pending_changes
  set status = 'rejected', review_reason = btrim(reason), reviewed_by = auth.uid(), reviewed_at = now()
  where id = change_id and status = 'pending' and submitted_at is not null;

  if not found then
    raise exception 'Change % is not waiting for review.', change_id;
  end if;
end;
$$;


-- =====================================================================
-- 4. Approving a new pilot
-- =====================================================================

-- Approves a pending pilot and saves the GM's optional note, all-or-nothing (the page used to do these as two
-- separate requests). GMs and owners only. expected_updated_at is when the pilot last changed as the GM saw
-- it: the later of characters.updated_at and character_sheets.updated_at, the same value approve_change
-- compares. If the pilot changed since, the GM hasn't seen the latest version, so it refuses. Compared to the
-- millisecond, because the page reads these times as JavaScript dates, which drop the microseconds.
create function public.approve_pilot(target_character_id bigint, expected_updated_at timestamptz, note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  current_status public.character_status;
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can approve pilots.';
  end if;

  -- Lock the character while it's checked and updated.
  select status into current_status from public.characters where id = target_character_id for update;
  if current_status is distinct from 'pending' then
    raise exception 'Character % is not waiting for approval.', target_character_id;
  end if;

  if expected_updated_at is null
     or date_trunc('milliseconds', private.pilot_last_changed(target_character_id))
        > date_trunc('milliseconds', expected_updated_at) then
    raise exception 'The player changed this pilot after you opened it. Reload to see the latest.';
  end if;

  update public.character_sheets
  set review_note = nullif(btrim(note), '')
  where character_id = target_character_id;

  update public.characters
  set status = 'approved', approved_at = now()
  where id = target_character_id;
end;
$$;

revoke execute on function
  public.approve_change(bigint, timestamptz, text), public.reject_change(bigint, text), public.approve_pilot(bigint, timestamptz, text)
  from public, anon;
grant execute on function
  public.approve_change(bigint, timestamptz, text), public.reject_change(bigint, text), public.approve_pilot(bigint, timestamptz, text)
  to authenticated;


-- =====================================================================
-- 5. Characters: one living pilot, dead is final, who can delete
-- =====================================================================

-- The insert policy already checks that a player has no living pilot, but two requests at the same moment
-- could both pass it. This takes a lock per player, so the second waits for the first and then sees its pilot.
-- It runs before the policy, so a request for someone else's pilot gets here too; the policy refuses it.
create function private.one_living_pilot() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;
  if new.player_id is distinct from auth.uid() then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.player_id::text, 0));
  if exists (
    select 1 from public.characters
    where player_id = new.player_id and status in ('pending', 'approved')
  ) then
    raise exception 'You already have a living pilot.';
  end if;
  return new;
end;
$$;

create trigger characters_one_living_pilot
  before insert on public.characters
  for each row execute function private.one_living_pilot();

-- Dead is final for everyone, including GMs and owners (mark_dead only goes the other way).
create function private.dead_is_final() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status = 'dead' and new.status <> 'dead' then
    raise exception 'A dead pilot cannot come back.';
  end if;
  return new;
end;
$$;

create trigger characters_dead_is_final
  before update on public.characters
  for each row execute function private.dead_is_final();

-- Deleting a character also deletes its sheet, changes and reputation (their foreign keys cascade), so only
-- owners can delete any character. Players can still withdraw their own pending pilot.
drop policy "Players can withdraw their own pending character; GMs can delete any" on public.characters;

create policy "Players can withdraw their own pending character; owners can delete any"
  on public.characters for delete to authenticated
  using (
    (select public.is_owner())
    or (player_id = (select auth.uid()) and status = 'pending')
  );
