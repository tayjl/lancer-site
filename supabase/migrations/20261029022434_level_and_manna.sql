-- Homebrew levelling and gear (docs/lancer-rules.md):
-- - "level" is gained narratively, so only GMs and owners set it. It gives 2 + level HASE points and a mod
--   limit (biomod capacity) of 6 + level, which replaces the hand-set mod limit (mod_points).
-- - "manna" is how much manna the pilot has received. Only GMs and owners set it. What's spent (licence
--   ranks, biomods, talent ranks) is worked out from the sheet by the site, so the balance can't be faked.
alter table public.character_sheets
  add column level integer not null default 0 check (level >= 0),
  add column manna integer not null default 0 check (manna >= 0),
  drop column mod_points;

-- Players can write their sheet row while their pilot is pending, so the database has to stop them
-- touching these two columns themselves. A new row (made when a pilot registers) must start at 0.
-- Only the site's own roles are checked: the dashboard and database functions (e.g. approve_change) run
-- as other roles and are left alone.
create function public.guard_gm_only_sheet_fields() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;
  if tg_op = 'INSERT' and (new.level <> 0 or new.manna <> 0) then
    raise exception 'Only GMs and owners can set level and manna.';
  end if;
  if tg_op = 'UPDATE' and (new.level is distinct from old.level or new.manna is distinct from old.manna) then
    raise exception 'Only GMs and owners can change level and manna.';
  end if;
  return new;
end;
$$;

create trigger character_sheets_gm_only_fields
  before insert or update on public.character_sheets
  for each row execute function public.guard_gm_only_sheet_fields();
