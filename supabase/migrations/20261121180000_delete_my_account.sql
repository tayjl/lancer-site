-- Account deletion: delete_my_account() removes the caller's pilots (and everything hanging off them by cascade) and
-- their login, so they can sign up fresh later. Things they wrote about other pilots or for everyone (lore, pithub,
-- service record entries, commendations, reward log lines, reputation, reviews, packs) stay with the author cleared.
-- Their uploaded pictures live in storage under "<user id>/"; the site removes those through the storage API first,
-- because SQL can't delete storage files.

-- A change normally belongs to the pilot's own player (and goes with the pilot), but a GM can hand a pilot to someone
-- else, leaving changes submitted by the old player. Keep those and clear the submitter rather than block the delete.
alter table public.pending_changes alter column submitted_by drop not null;
alter table public.pending_changes drop constraint pending_changes_submitted_by_fkey,
  add constraint pending_changes_submitted_by_fkey
    foreign key (submitted_by) references public.profiles (id) on delete set null;

create index pilot_reward_log_changed_by_idx on public.pilot_reward_log (changed_by);

-- These triggers pin the author on every update, which also undid "on delete set null" and left a dangling id.
-- Clearing the author is now allowed only once their profile is gone.
create or replace function public.lore_entries_keep_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif new.created_by is null and not exists (select 1 from public.profiles where id = old.created_by) then
    null; -- the author's account was deleted
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create or replace function private.keep_timeline_origin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.character_id := old.character_id;
    new.kind := old.kind;
    new.created_at := old.created_at;
    if not (new.created_by is null and not exists (select 1 from public.profiles where id = old.created_by)) then
      new.created_by := old.created_by; -- cleared only when the author's account was deleted
    end if;
  end if;
  return new;
end;
$$;

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Log in first.' using errcode = '42501';
  end if;

  -- Lock the owner rows so two owners can't both leave at the same moment.
  perform 1 from public.profiles where role = 'owner' for update;
  if exists (select 1 from public.profiles where id = me and role = 'owner')
     and not exists (select 1 from public.profiles where role = 'owner' and id <> me) then
    raise exception 'You are the last owner. Make someone else an owner first.';
  end if;

  -- characters.player_id deliberately doesn't cascade (a dashboard user delete must not drop pilots), so they go here.
  delete from public.characters where player_id = me;
  -- Cascades to profiles, then clears this user as author everywhere else.
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon, service_role;
grant execute on function public.delete_my_account() to authenticated;
