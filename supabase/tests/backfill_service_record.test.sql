-- The one-off service-record backfill (migration 20261121100000_backfill_service_record.sql): pilots from before the
-- milestone triggers get their "auto" entries once, with the right titles and dates, and nothing is written twice.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('22222222-2222-2222-2222-222222222222', 'p2@test.local', '{"full_name": "Player Two"}'),
  ('33333333-3333-3333-3333-333333333333', 'gm@test.local', '{"full_name": "Game Master"}');

insert into public.characters (id, player_id, status, pilot_name, mechs, created_at, approved_at, died_at, updated_at) overriding system value values
  (300, '11111111-1111-1111-1111-111111111111', 'approved', 'Approved', '[{"id":"m1","name":"Lantern"},{"id":"m2","name":" "}]',
   '2026-01-01', '2026-01-05', null, '2026-06-01'),
  (400, '22222222-2222-2222-2222-222222222222', 'dead', 'Fallen', '[]', '2026-01-01', '2026-01-10', '2026-04-01', '2026-06-01'),
  (500, '33333333-3333-3333-3333-333333333333', 'dead', 'Lost', '[]', '2026-02-01', null, null, '2026-05-01'),
  (600, '22222222-2222-2222-2222-222222222222', 'pending', 'Waiting', '[{"id":"m1","name":"Ember"}]', '2026-01-01', null, null, '2026-06-01'),
  (700, '33333333-3333-3333-3333-333333333333', 'approved', 'Recent', '[{"id":"m1","name":"Spark"}]', '2026-01-01', '2026-11-20', null, '2026-11-20');
insert into public.character_sheets (character_id, level, sheet) values
  (300, 3, '{"licences":{"mf_backfill_frame":2,"zero_frame":0,"unknown_frame":1}}'),
  (400, 0, '{}'),
  (500, 1, '{"licences":"oops"}'),
  (600, 2, '{"licences":{"mf_backfill_frame":1}}'),
  (700, 1, '{"licences":{"mf_backfill_frame":1}}');
insert into public.content_packs (id, name, version, manifest) overriding system value values (9002, 'Backfill pack', '1', '{}');
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('mf_backfill_frame', 9002, 'frames', '{"id":"mf_backfill_frame","name":"Original"}', '{"id":"mf_backfill_frame","name":"Edited"}');
insert into public.commendations (id, name, icon) values ('c0000000-0000-4000-8000-000000000002', 'Iron will', 'star');
insert into public.pilot_commendations (character_id, commendation_id, reason, awarded_at) values
  (300, 'c0000000-0000-4000-8000-000000000002', ' Held the line ', '2026-02-01'),
  (300, 'c0000000-0000-4000-8000-000000000002', '', '2026-03-01');

-- As if they were from before the triggers, except two entries the triggers already wrote.
delete from public.pilot_timeline where character_id in (300, 400, 500, 600, 700);
insert into public.pilot_timeline (character_id, kind, title, occurred_on) values
  (300, 'auto', 'Reached level 3', '2026-06-01'),
  (700, 'auto', 'Approved for duty', '2026-11-20');

create function pg_temp.entries(pilot bigint) returns text[] language sql
as $$ select coalesce(array_agg(title || ' @ ' || occurred_on order by occurred_on, created_at), '{}') from public.pilot_timeline where character_id = pilot and kind = 'auto' $$;

select ok(private.backfill_service_record() > 0, 'the backfill writes entries');

select is(pg_temp.entries(300), array[
  'Approved for duty @ 2026-01-05',
  'Edited licence, rank II @ 2026-01-05',
  'unknown_frame licence, rank I @ 2026-01-05',
  'New mech: Lantern @ 2026-01-05',
  'New mech: Unnamed @ 2026-01-05',
  'Awarded Iron will @ 2026-02-01',
  'Awarded Iron will @ 2026-03-01',
  'Reached level 3 @ 2026-06-01'
], 'an approved pilot: approval, licences, mechs and awards in order, no rank 0 licence, the existing level line kept');
select is(
  (select body from public.pilot_timeline where character_id = 300 and title = 'Awarded Iron will' and occurred_on = '2026-02-01'),
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Held the line"}]}]}'::jsonb,
  'an award''s reason is its body');
select is((select body from public.pilot_timeline where character_id = 300 and title = 'Awarded Iron will' and occurred_on = '2026-03-01'), null, 'an award with no reason has no body');
select is((select count(*)::int from public.pilot_timeline where character_id = 300 and created_by is not null), 0, 'entries have no author');

select is(pg_temp.entries(400), array['Approved for duty @ 2026-01-10', 'Killed in action @ 2026-04-01'], 'a dead pilot at level 0: approval and death on died_at');
select is(pg_temp.entries(500), array['Killed in action @ 2026-05-01'],
  'died before approval (no approved_at): no start-of-career lines, and death dated updated_at when died_at is empty');
select is(pg_temp.entries(600), '{}'::text[], 'a pending pilot gets nothing');
select is(pg_temp.entries(700), array['Approved for duty @ 2026-11-20'], 'a pilot approved under the triggers gets no licence, level or mech lines');

select is(private.backfill_service_record(), 0, 'running it again adds nothing');
select is((select count(*)::int from public.pilot_timeline where character_id = 300 and title = 'Reached level 3'), 1, 'an existing entry is not duplicated');

set local role authenticated;
select throws_ok($$ select private.backfill_service_record() $$, '42501', null, 'players cannot run the backfill');
reset role;

select * from finish();
rollback;
