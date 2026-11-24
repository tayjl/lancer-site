-- One home for the balance numbers' fallback and range (they were repeated in every rule_number() call). A stored
-- 'rule_num_<key>' row still wins when it is a whole number inside the range. Only the database owner changes this table.
create table public.rule_number_limits (
  key text primary key,
  def numeric not null,
  lo numeric not null,
  hi numeric not null,
  check (lo <= def and def <= hi)
);
alter table public.rule_number_limits enable row level security;
create policy "Logged-in users read rule number limits" on public.rule_number_limits for select to authenticated using (true);
revoke all on public.rule_number_limits from public, anon, authenticated;
grant select on public.rule_number_limits to authenticated;

-- Keep in step with NUMBER_KEYS in src/rulesData.ts (rules.test.ts reads these values).
insert into public.rule_number_limits (key, def, lo, hi) values
  ('starting_manna', 2000, 0, 100000),
  ('licence_rank_price', 600, 0, 10000),
  ('talent_rank_price', 300, 0, 10000),
  ('extra_mech_price', 500, 0, 10000),
  ('default_gear_price', 100, 0, 10000),
  ('max_licence_rank', 3, 1, 6),
  ('max_talent_rank', 3, 1, 6),
  ('mod_points_base', 6, 0, 50);

-- Invoker rights, like the old version: it reads only content_items and the limits, which every logged-in user can read.
create function public.rule_number(rule_key text) returns numeric
language plpgsql stable set search_path = ''
as $
declare
  l public.rule_number_limits;
  n numeric;
begin
  select * into l from public.rule_number_limits where key = rule_key;
  -- No NULL for a missing limit: the guards compare against this, and a NULL would let a check pass.
  if not found then raise exception 'Unknown rule number %', rule_key; end if;
  select case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric end into n
  from (select coalesce(i.edited, i.data) -> 'numbers' -> 0 as v
        from public.content_items i where i.id = 'rule_num_' || rule_key and i.kind = 'rules' and not i.draft) x;
  return case when n % 1 = 0 and n between l.lo and l.hi then n else l.def end;
end;
$;
revoke execute on function public.rule_number(text) from public, anon;
grant execute on function public.rule_number(text) to authenticated;

alter table public.character_sheets alter column manna set default public.rule_number('starting_manna');

-- The three functions that called rule_number(key, def, lo, hi) now call rule_number(key). Rewritten from their live
-- definitions so the long bodies aren't copied again; create or replace keeps their grants.
do $$
declare
  fn regprocedure;
  def text;
begin
  foreach fn in array array[
    'public.guard_gm_only_sheet_fields()'::regprocedure,
    'private.guard_submit_rules()'::regprocedure,
    'public.sheet_rule_problems(jsonb, integer)'::regprocedure
  ] loop
    def := pg_get_functiondef(fn);
    def := regexp_replace(def, 'public\.rule_number\(''(\w+)'', \d+, \d+, \d+\)', 'public.rule_number(''\1'')', 'g');
    if def ~ 'rule_number\(''\w+'', \d' or def !~ 'rule_number\(''\w+''\)' then
      raise exception 'Could not rewrite %', fn;
    end if;
    execute def;
  end loop;
end;
$$;

drop function public.rule_number(text, numeric, numeric, numeric);
