-- New pilots start with 1500 manna (it was 0). Only the column's default changes: pilots that already have a sheet
-- keep what they have.
alter table public.character_sheets alter column manna set default 1500;

-- A player's first sheet insert (made when a pilot registers) takes the defaults, so the guard now accepts the default
-- manna (1500) and still refuses any other value. Level must still start at 0.
create or replace function public.guard_gm_only_sheet_fields() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_gm() then
    return new;
  end if;
  if tg_op = 'INSERT' and (new.level <> 0 or new.manna <> 1500) then
    raise exception 'Only GMs and owners can set level and manna.';
  end if;
  if tg_op = 'UPDATE' and (new.level is distinct from old.level or new.manna is distinct from old.manna) then
    raise exception 'Only GMs and owners can change level and manna.';
  end if;
  return new;
end;
$$;
