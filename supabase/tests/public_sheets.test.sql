-- Tries to break the public sheets (migration 20261119200000_public_sheets.sql): another player can read a pilot's sheet
-- through pilot_sheet(), without the backstory, manna or the review note, for every status; anon can't call it; and a direct
-- select on character_sheets by another player still returns nothing.
-- Run with: supabase test db. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Ids are hard-coded below. Sequences aren't rolled back, so push the generated ids well past them, once and for good.
select setval('public.characters_id_seq', greatest((select last_value from public.characters_id_seq), 1000));

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'p1@test.local', '{"full_name": "Player One"}'),
  ('22222222-2222-2222-2222-222222222222', 'p2@test.local', '{"full_name": "Player Two"}');

insert into public.characters (id, player_id, status, pilot_name, callsign) overriding system value values
  (100, '11111111-1111-1111-1111-111111111111', 'approved', 'One', 'Uno'),
  (101, '11111111-1111-1111-1111-111111111111', 'dead', 'Dead', 'Gone'),
  (200, '22222222-2222-2222-2222-222222222222', 'pending', 'Two', 'Duo');
insert into public.character_sheets (character_id, sheet, level, manna, review_note)
values
  (100, '{"backstory": {"text": "secret"}, "pilot_stats": {"acuity": 3}}', 2, 900, 'GM note'),
  (101, '{"backstory": {"text": "secret"}, "licences": {"ips_n_drake": 2}}', 0, 0, null),
  (200, '{"backstory": {"text": "secret"}, "bionics": [1]}', 0, 1500, 'sent back');

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is((select count(*)::int from public.character_sheets where character_id = 100), 0, 'a direct select on another pilot''s sheet still returns nothing');
select is((select sheet -> 'pilot_stats' ->> 'acuity' from public.pilot_sheet(100)), '3', 'another player reads an approved pilot''s sheet through the function');
select is((select level from public.pilot_sheet(100)), 2, 'with its level');
select is((select count(*)::int from information_schema.columns where table_name = 'pilot_sheet' and column_name = 'manna'), 0, 'but no manna column');
select ok((select to_jsonb(p)::text not like '%900%' from public.pilot_sheet(100) p), 'and manna is nowhere in the result');
select ok((select not sheet ? 'backstory' from public.pilot_sheet(100)), 'the sheet has no backstory');
select is((select count(*)::int from information_schema.columns where table_name = 'pilot_sheet' and column_name = 'review_note'), 0, 'and no review note column');
select ok((select to_jsonb(p)::text not like '%GM note%' from public.pilot_sheet(100) p), 'the review note is nowhere in the result');
select is((select sheet -> 'licences' ->> 'ips_n_drake' from public.pilot_sheet(101)), '2', 'a dead pilot''s sheet is readable');
select is((select sheet -> 'bionics' ->> 0 from public.pilot_sheet(200)), '1', 'so is a pending pilot''s');
select ok((select not sheet ? 'backstory' from public.pilot_sheet(200)), 'with no backstory either');
select is((select count(*)::int from public.pilot_sheet(99999)), 0, 'an unknown pilot gives no row');

reset role;
set local role anon;
select throws_ok($$ select * from public.pilot_sheet(100) $$, '42501', null, 'logged-out visitors cannot call it');

select * from finish();
rollback;
