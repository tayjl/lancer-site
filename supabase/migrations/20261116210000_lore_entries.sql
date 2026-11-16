-- Lore: short stories, places, factions, people and events written by GMs and owners.
-- Everyone logged in reads published entries. Drafts (published_at is null) are GM-only.

create table public.lore_entries (
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

-- For listing the newest published entries first.
create index lore_entries_published_at_idx on public.lore_entries (published_at desc);
-- Foreign keys need an index so deleting a profile stays fast.
create index lore_entries_created_by_idx on public.lore_entries (created_by);

create trigger lore_entries_updated_at
  before update on public.lore_entries
  for each row execute procedure extensions.moddatetime (updated_at);

-- created_by can't be forged: a new row always gets the logged-in user, and it never changes after.
create function public.lore_entries_keep_author() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create trigger lore_entries_keep_author
  before insert or update on public.lore_entries
  for each row execute procedure public.lore_entries_keep_author();

alter table public.lore_entries enable row level security;
revoke all on public.lore_entries from anon, authenticated;
grant select, insert, update, delete on public.lore_entries to authenticated;

-- is_gm() is true for GMs and owners.
create policy "Everyone sees published lore, GMs also see drafts"
  on public.lore_entries for select to authenticated
  using (published_at is not null or (select public.is_gm()));

create policy "GMs add lore" on public.lore_entries for insert to authenticated
  with check ((select public.is_gm()));
create policy "GMs edit lore" on public.lore_entries for update to authenticated
  using ((select public.is_gm())) with check ((select public.is_gm()));
create policy "GMs delete lore" on public.lore_entries for delete to authenticated
  using ((select public.is_gm()));
