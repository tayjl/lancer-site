-- Tries to break migration 20261121130000_pilot_cards.sql: pilot_cards() gives logged-in users every pilot's ID card
-- for one status, in the pilot lists' order, never drafts or sent-back pilots, and nothing private. Anon can't call it.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Ids are hard-coded below. Sequences aren't rolled back, so push the generated ids well past them, once and for good.
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('22222222-2222-2222-2222-222222222222', 'p2@test.local', '{"full_name": "Player Two"}');

insert into public.characters (id, player_id, status, pilot_name, callsign, approved_at, submitted_at, created_at, pilot_image) overriding system value values
  (100, '11111111-1111-1111-1111-111111111111', 'approved', 'One', 'Uno', '2026-11-01', '2026-10-30', '2026-10-02', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp'),
  (102, '22222222-2222-2222-2222-222222222222', 'approved', 'Two', null, '2026-11-02', '2026-10-29', '2026-10-01', null),
  (101, '11111111-1111-1111-1111-111111111111', 'dead', 'Dead', 'Gone', '2026-10-01', '2026-09-30', '2026-09-01', null),
  (200, '22222222-2222-2222-2222-222222222222', 'pending', 'Draft', null, null, null, '2026-11-01', null),
  (201, '22222222-2222-2222-2222-222222222222', 'pending', 'Later', null, null, '2026-11-10', '2026-11-01', null),
  (202, '11111111-1111-1111-1111-111111111111', 'pending', 'Earlier', null, null, '2026-11-05', '2026-11-02', null);
insert into public.character_sheets (character_id, sheet, level, manna, review_note) values
  (100, '{"backstory": {"text": "secret"}, "licences": {"a": 2, "b": 1, "c": -4, "d": "x"}}', 3, 987, 'GM note'),
  (201, '{"licences": {"a": 1}}', 1, 1500, null);
insert into public.pilot_profiles (character_id, colour, motto) values (100, '#112233', 'private-ish motto');
insert into public.commendations (id, name, icon) values
  ('c0000000-0000-4000-8000-000000000001', 'First', 'star'),
  ('c0000000-0000-4000-8000-000000000002', 'Second', 'shield');
insert into public.pilot_commendations (character_id, commendation_id, awarded_at) values
  (100, 'c0000000-0000-4000-8000-000000000002', '2026-11-02'),
  (100, 'c0000000-0000-4000-8000-000000000001', '2026-11-03');
-- An open change on the approved pilot: the card must not show it.
insert into public.pending_changes (character_id, submitted_by, proposed_public, proposed_sheet, based_on)
values (100, '11111111-1111-1111-1111-111111111111', '{"pilot_name": "Changed"}', '{"licences": {"a": 3, "b": 3, "e": 3}}', now());

-- Logged out: no access.
select ok(not has_function_privilege('anon', 'public.pilot_cards(public.character_status)', 'EXECUTE'), 'anon may not call pilot_cards');
select ok(has_function_privilege('authenticated', 'public.pilot_cards(public.character_status)', 'EXECUTE'), 'logged-in users may');
set local role anon;
select throws_ok($$ select * from public.pilot_cards('approved') $$, '42501', null, 'anon calling it is refused');
reset role;

-- A player (not the owner of most of these pilots).
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select is(
  (select (id, callsign, pilot_name, status, approved_at::date, submitted_at::date, created_at::date, level, licence_level, pilot_image, colour, medals, player_name)::text
     from public.pilot_cards('approved') where id = 100),
  '(100,Uno,One,approved,2026-11-01,2026-10-30,2026-10-02,3,3,11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp,#112233,"{shield,star}","Player One")',
  'another player gets the approved pilot''s card (not the open change), medals in award order, the owner''s name'
);
select results_eq($$ select id from public.pilot_cards('approved') where id in (100, 102) $$, array[102::bigint, 100], 'approved pilots, oldest created first');
select is((select (pilot_name, level, licence_level, colour, medals, player_name)::text from public.pilot_cards('dead') where id = 101), '(Dead,0,0,,{},"Player One")', 'a dead pilot with no sheet or profile still has a card');
select results_eq($$ select id from public.pilot_cards('pending') where id between 200 and 202 $$, array[202::bigint, 201], 'submitted pilots only, oldest submission first: no draft');
select is((select (level, licence_level)::text from public.pilot_cards('pending') where id = 201), '(1,1)', 'a submitted pilot''s level and licence level');
select ok(
  (select bool_and(to_jsonb(c)::text !~ '(secret|987|1500|GM note|motto|backstory|manna|Changed|sheet)') from public.pilot_cards('approved') c where id in (100, 102)),
  'the cards hold no backstory, manna, notes, motto, sheet or open change'
);
select is(
  (select array_agg(parameter_name::text order by ordinal_position) from information_schema.parameters
    where specific_schema = 'public' and specific_name like 'pilot\_cards\_%' and parameter_mode = 'OUT'),
  array['id', 'callsign', 'pilot_name', 'status', 'approved_at', 'submitted_at', 'created_at', 'level', 'licence_level', 'pilot_image', 'colour', 'medals', 'player_name'],
  'no other columns'
);
reset role;

select * from finish();
rollback;
