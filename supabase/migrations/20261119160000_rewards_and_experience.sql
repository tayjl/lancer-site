-- Rewards and experience (GM only).
-- - Experience (0 to 1000) is a GM-only number per pilot. At 1000 a pilot is ready to level, but a GM raises the
--   level by hand (nothing is automatic).
-- - Every change to a pilot's level, manna received or experience is logged: who, when, old -> new and an optional reason.
-- Both live in their own tables, not in character_sheets, because players can read their own sheet and these must
-- stay secret (RLS works on whole rows). Nobody writes them directly: the functions and triggers below do.

create table public.pilot_progress (
  character_id bigint primary key references public.characters (id) on delete cascade,
  experience integer not null default 0 check (experience between 0 and 1000),
  updated_at timestamptz not null default now()
);

create trigger pilot_progress_updated_at
  before update on public.pilot_progress
  for each row execute procedure extensions.moddatetime (updated_at);

create table public.pilot_reward_log (
  id bigint generated always as identity primary key,
  character_id bigint not null references public.characters (id) on delete cascade,
  field text not null check (field in ('level', 'manna', 'experience')),
  old_value integer not null,
  new_value integer not null,
  reason text,
  changed_by uuid default auth.uid() references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index pilot_reward_log_character on public.pilot_reward_log (character_id, changed_at desc);

alter table public.pilot_progress enable row level security;
alter table public.pilot_reward_log enable row level security;
revoke all on public.pilot_progress, public.pilot_reward_log from anon, authenticated;
grant select on public.pilot_progress, public.pilot_reward_log to authenticated;

create policy "GMs and owners can read experience"
  on public.pilot_progress for select to authenticated
  using ((select public.is_gm()));

create policy "GMs and owners can read the reward log"
  on public.pilot_reward_log for select to authenticated
  using ((select public.is_gm()));

-- ---------------------------------------------------------------------
-- Logging by trigger, so a change made anywhere (the dashboard included) is recorded.
-- The reason comes from a transaction-local setting that award() and level_up() set; it's null otherwise.
-- ---------------------------------------------------------------------
create function private.log_sheet_rewards() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  why text := nullif(trim(current_setting('app.reward_reason', true)), '');
begin
  if new.level is distinct from old.level then
    insert into public.pilot_reward_log (character_id, field, old_value, new_value, reason)
    values (new.character_id, 'level', old.level, new.level, why);
  end if;
  if new.manna is distinct from old.manna then
    insert into public.pilot_reward_log (character_id, field, old_value, new_value, reason)
    values (new.character_id, 'manna', old.manna, new.manna, why);
  end if;
  return null;
end;
$$;

create trigger character_sheets_log_rewards
  after update of level, manna on public.character_sheets
  for each row execute function private.log_sheet_rewards();

create function private.log_experience() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  was integer := case when tg_op = 'UPDATE' then old.experience else 0 end;
begin
  if new.experience is distinct from was then
    insert into public.pilot_reward_log (character_id, field, old_value, new_value, reason)
    values (new.character_id, 'experience', was, new.experience, nullif(trim(current_setting('app.reward_reason', true)), ''));
  end if;
  return null;
end;
$$;

create trigger pilot_progress_log_experience
  after insert or update of experience on public.pilot_progress
  for each row execute function private.log_experience();

-- ---------------------------------------------------------------------
-- award: a GM or owner sets level, manna received and/or experience in one go. A null leaves that field alone.
-- It runs as the database owner (nobody can write pilot_progress directly), so it checks the caller itself.
-- ---------------------------------------------------------------------
create function public.award(
  target_character_id bigint,
  new_level integer default null,
  new_manna integer default null,
  new_experience integer default null,
  reason text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can set rewards.';
  end if;
  if new_level < 0 or new_manna < 0 or new_experience < 0 then
    raise exception 'Level, manna and experience must be whole numbers, 0 or more.';
  end if;
  if new_experience > 1000 then
    raise exception 'Experience is at most 1000.';
  end if;

  perform set_config('app.reward_reason', coalesce(reason, ''), true);

  update public.character_sheets
  set level = coalesce(new_level, level), manna = coalesce(new_manna, manna)
  where character_id = target_character_id;
  if not found then
    raise exception 'Character % has no sheet.', target_character_id;
  end if;

  if new_experience is not null then
    insert into public.pilot_progress (character_id, experience)
    values (target_character_id, new_experience)
    on conflict (character_id) do update set experience = excluded.experience;
  end if;

  perform set_config('app.reward_reason', '', true);
end;
$$;

-- level_up: a GM or owner spends 1000 experience on a level. Nothing is automatic; this is the button.
create function public.level_up(target_character_id bigint, reason text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  xp integer;
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can level pilots up.';
  end if;

  select experience into xp from public.pilot_progress where character_id = target_character_id for update;
  if coalesce(xp, 0) < 1000 then
    raise exception 'A pilot needs 1000 experience to level up.';
  end if;

  perform set_config('app.reward_reason', coalesce(nullif(trim(reason), ''), 'Level up'), true);
  update public.character_sheets set level = level + 1 where character_id = target_character_id;
  if not found then
    raise exception 'Character % has no sheet.', target_character_id;
  end if;
  update public.pilot_progress set experience = experience - 1000 where character_id = target_character_id;
  perform set_config('app.reward_reason', '', true);
end;
$$;

revoke execute on function public.award(bigint, integer, integer, integer, text), public.level_up(bigint, text) from public, anon;
grant execute on function public.award(bigint, integer, integer, integer, text), public.level_up(bigint, text) to authenticated;
