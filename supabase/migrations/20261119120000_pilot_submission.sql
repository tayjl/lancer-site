-- New pilots get the same draft -> submit flow as changes (CLAUDE.md, "Pending approval workflow"): a pilot is a
-- draft until its player submits it, and only submitted pilots reach the GM queue and the public Pending tab.
-- characters.submitted_at is null while it's a draft. Sending a pilot back makes it a draft again, with the GM's note.

alter table public.characters add column submitted_at timestamptz;

-- Pilots that were already waiting count as submitted when they last changed. Sent-back ones (pending with a note)
-- stay drafts. The other statuses never use it, so it just gets a sensible time.
update public.characters c
set submitted_at = case
  when c.status = 'pending' then
    case when exists (select 1 from public.character_sheets s where s.character_id = c.id and s.review_note is not null)
         then null else c.updated_at end
  when c.status = 'approved' then coalesce(c.approved_at, c.created_at)
  else coalesce(c.died_at, c.created_at)
end;


-- =====================================================================
-- Who can set submitted_at, and what is locked while it's set
-- =====================================================================

-- Players: a new pilot is always a draft. The only moves are null -> now() (submit; the database stamps the time,
-- ignoring the sent value) and not null -> null (take it back to edit), and only while the pilot is pending. While
-- it's submitted nothing else on the card can change. Submitting also clears the GM's sent-back note.
-- Only the site's own roles are checked, like the other guards; GMs and owners are unaffected.
create function private.guard_pilot_submission() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') and not public.is_gm() then
      new.submitted_at := null;
    end if;
    return new;
  end if;

  if old.submitted_at is null and new.submitted_at is not null then
    new.submitted_at := now();
    -- Runs before the row changes, so the sheet lock below doesn't see it as submitted yet.
    update public.character_sheets set review_note = null where character_id = new.id and review_note is not null;
  end if;
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;

  if new.submitted_at is distinct from old.submitted_at and (old.status <> 'pending' or new.status <> 'pending') then
    raise exception 'Only a pending pilot can be submitted.';
  end if;
  if old.submitted_at is not null and (
    new.submitted_at is not null
    or (to_jsonb(new) - 'submitted_at' - 'updated_at') is distinct from (to_jsonb(old) - 'submitted_at' - 'updated_at')
  ) then
    raise exception 'This pilot is waiting for review. Choose Edit pilot to change it.';
  end if;
  return new;
end;
$$;

create trigger characters_guard_submission
  before insert or update on public.characters
  for each row execute function private.guard_pilot_submission();

-- The sheet is locked the same way while its pilot is submitted.
create function private.guard_submitted_sheet() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;
  if exists (
    select 1 from public.characters c
    where c.id = new.character_id and c.status = 'pending' and c.submitted_at is not null
  ) then
    raise exception 'This pilot is waiting for review. Choose Edit pilot to change it.';
  end if;
  return new;
end;
$$;

create trigger character_sheets_guard_submitted
  before insert or update on public.character_sheets
  for each row execute function private.guard_submitted_sheet();


-- =====================================================================
-- Approving and sending back
-- =====================================================================

-- As before, but a pilot that hasn't been submitted can't be approved.
create or replace function public.approve_pilot(target_character_id bigint, expected_updated_at timestamptz, note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  current_status public.character_status;
  submitted timestamptz;
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can approve pilots.';
  end if;

  -- Lock the character while it's checked and updated.
  select status, submitted_at into current_status, submitted from public.characters where id = target_character_id for update;
  if current_status is distinct from 'pending' or submitted is null then
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

-- Sends a submitted pilot back to its player: saves the GM's note and makes the pilot a draft again, all-or-nothing.
-- The note is required. GMs and owners only.
create function public.send_back_pilot(target_character_id bigint, note text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can send pilots back.';
  end if;
  if nullif(btrim(note), '') is null then
    raise exception 'Write a note first, so the player knows what to fix.';
  end if;

  update public.characters set submitted_at = null
  where id = target_character_id and status = 'pending' and submitted_at is not null;
  if not found then
    raise exception 'Character % is not waiting for approval.', target_character_id;
  end if;

  insert into public.character_sheets (character_id, review_note)
  values (target_character_id, btrim(note))
  on conflict (character_id) do update set review_note = excluded.review_note;
end;
$$;

revoke execute on function public.send_back_pilot(bigint, text) from public, anon;
grant execute on function public.send_back_pilot(bigint, text) to authenticated;
