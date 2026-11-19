-- A pilot's backstory is private (it lives in the private sheet) unless its player makes it public. RLS works on whole
-- rows, so the public copy lives in its own table that every logged-in user can read. A row exists only while the
-- backstory is public. Nobody writes to the table directly: set_backstory_public() does, and a trigger on the sheet
-- keeps the copy equal to the pilot's real sheet (never an unapproved draft change).

create table public.pilot_public_backstory (
  character_id bigint primary key references public.characters (id) on delete cascade,
  backstory jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pilot_public_backstory enable row level security;
revoke all on public.pilot_public_backstory from anon, authenticated;
grant select on public.pilot_public_backstory to authenticated;
create policy "Everyone logged in can read public backstories" on public.pilot_public_backstory
  for select to authenticated using (true);

-- Makes the backstory public (copying the sheet's current one) or private again. The character's own player, GMs and
-- owners, any status. It doesn't touch characters or character_sheets, so their updated_at (and the "changed since"
-- approval check) doesn't move.
create function public.set_backstory_public(target_character_id bigint, make_public boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.characters c
    where c.id = target_character_id and (c.player_id = (select auth.uid()) or public.is_gm())
  ) then
    raise exception 'You can''t change the backstory of character %.', target_character_id;
  end if;

  if make_public then
    insert into public.pilot_public_backstory (character_id, backstory)
    select target_character_id, (select s.sheet -> 'backstory' from public.character_sheets s where s.character_id = target_character_id)
    on conflict (character_id) do update set backstory = excluded.backstory, updated_at = now();
  else
    delete from public.pilot_public_backstory where character_id = target_character_id;
  end if;
end;
$$;

revoke execute on function public.set_backstory_public(bigint, boolean) from public, anon;
grant execute on function public.set_backstory_public(bigint, boolean) to authenticated;

-- While a backstory is public, the copy follows the real sheet (a pending pilot's live edits, or an approved pilot's
-- backstory after a change is approved).
create function private.sync_public_backstory() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.pilot_public_backstory
  set backstory = new.sheet -> 'backstory', updated_at = now()
  where character_id = new.character_id and backstory is distinct from new.sheet -> 'backstory';
  return null;
end;
$$;

create trigger character_sheets_public_backstory
  after insert or update of sheet on public.character_sheets
  for each row execute procedure private.sync_public_backstory();
