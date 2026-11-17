-- When a change last changed, so the site can tell a player's draft was saved somewhere else (another tab, or a
-- device) and refuse to overwrite it. Same as the other tables' updated_at.
alter table public.pending_changes add column updated_at timestamptz not null default now();

create trigger pending_changes_updated_at
  before update on public.pending_changes
  for each row execute procedure extensions.moddatetime (updated_at);
