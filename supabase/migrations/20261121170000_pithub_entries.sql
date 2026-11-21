-- Pithub: a hidden second lore section for in-fiction "sensitive" entries.
-- Not actually secret: same rules as lore_entries. Everyone logged in reads published
-- entries, drafts (published_at is null) are GM-only.

create table public.pithub_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  kind text not null check (kind in ('story', 'place', 'faction', 'person', 'event')),
  summary text not null default '' check (char_length(summary) <= 300),
  -- Formatted text in the same JSON format as characters.appearance (TipTap's).
  body jsonb not null default '{"type":"doc","content":[]}',
  -- Related entries picked by a GM. No foreign key: the app ignores ids that no longer exist.
  related uuid[] not null default '{}',
  -- Null means a draft.
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pithub_entries_published_at_idx on public.pithub_entries (published_at desc);
create index pithub_entries_created_by_idx on public.pithub_entries (created_by);

create trigger pithub_entries_updated_at
  before update on public.pithub_entries
  for each row execute procedure extensions.moddatetime (updated_at);

-- lore_entries_keep_author() only touches new/old.created_by, so it works for any table.
create trigger pithub_entries_keep_author
  before insert or update on public.pithub_entries
  for each row execute procedure public.lore_entries_keep_author();

alter table public.pithub_entries enable row level security;
revoke all on public.pithub_entries from anon, authenticated;
grant select, insert, update, delete on public.pithub_entries to authenticated;

-- is_gm() is true for GMs and owners.
create policy "Everyone sees published pithub entries, GMs also see drafts"
  on public.pithub_entries for select to authenticated
  using (published_at is not null or (select public.is_gm()));

create policy "GMs add pithub entries" on public.pithub_entries for insert to authenticated
  with check ((select public.is_gm()));
create policy "GMs edit pithub entries" on public.pithub_entries for update to authenticated
  using ((select public.is_gm())) with check ((select public.is_gm()));
create policy "GMs delete pithub entries" on public.pithub_entries for delete to authenticated
  using ((select public.is_gm()));
