-- A player could insert a change already submitted (or with review fields set), which skipped guard_submit_rules because it
-- only fires on update. Players now insert drafts only; submitting is the later update, as the site already does it.
-- GMs, owners and the database owner (reject_change makes the sent-back draft with a note) are left alone.
create function private.guard_change_insert() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_gm()
     and (new.submitted_at is not null or new.review_reason is not null or new.reviewed_at is not null) then
    raise exception 'A new change starts as a draft. Save it, then submit it.';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_change_insert() from public;

create trigger pending_changes_guard_insert
  before insert on public.pending_changes
  for each row execute function private.guard_change_insert();
