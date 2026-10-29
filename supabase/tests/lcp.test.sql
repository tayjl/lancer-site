-- Import ownership, safe updates and conflict rollback. All fixtures are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('88888888-8888-4888-8888-888888888881', 'lcp-owner@test.local', '{"full_name":"LCP owner"}'),
  ('88888888-8888-4888-8888-888888888882', 'lcp-gm@test.local', '{"full_name":"LCP GM"}'),
  ('88888888-8888-4888-8888-888888888883', 'lcp-player@test.local', '{"full_name":"LCP player"}');
update public.profiles set role='owner' where id='88888888-8888-4888-8888-888888888881';
update public.profiles set role='gm' where id='88888888-8888-4888-8888-888888888882';
select ok(not has_function_privilege('anon','public.import_lcp(jsonb,jsonb,bigint,timestamptz)','EXECUTE'), 'anonymous imports are not executable');
set local role authenticated;
set local request.jwt.claim.sub='88888888-8888-4888-8888-888888888883';
select throws_ok($$select public.import_lcp('{}','[]')$$, 'P0001', 'Only owners can import content packs.', 'players cannot import');
set local request.jwt.claim.sub='88888888-8888-4888-8888-888888888882';
select throws_ok($$select public.import_lcp('{}','[]')$$, 'P0001', 'Only owners can import content packs.', 'GMs cannot import');
set local request.jwt.claim.sub='88888888-8888-4888-8888-888888888881';

select lives_ok($$select public.import_lcp(
  '{"name":"__LCP_TEST_A","author":"Test","version":"1.0.0","description":"Test"}',
  '[{"id":"__lcp_test_frame","kind":"frames","data":{"id":"__lcp_test_frame","name":"Original frame"}},
    {"id":"__lcp_test_weapon","kind":"weapons","data":{"id":"__lcp_test_weapon","name":"Retained weapon"}}]')$$,
  'owners can import a complete pack');
select is((select count(*)::int from public.content_items where id like '__lcp_test_%'), 2, 'both items saved');
select is((select imported_by from public.content_packs where name='__LCP_TEST_A'), '88888888-8888-4888-8888-888888888881'::uuid, 'import attributed to owner');
select set_config('test.lcp_stamp', (select imported_at::text from public.content_packs where name='__LCP_TEST_A'), true);

select lives_ok($$select public.import_lcp(
  '{"name":"__LCP_TEST_A","author":"Test","version":"2.0.0","description":"Updated"}',
  '[{"id":"__lcp_test_frame","kind":"frames","data":{"id":"__lcp_test_frame","name":"Updated frame"}},
    {"id":"__lcp_test_talent","kind":"talents","data":{"id":"__lcp_test_talent","name":"New talent"}}]',
  (select id from public.content_packs where name='__LCP_TEST_A'),
  (select imported_at from public.content_packs where name='__LCP_TEST_A'))$$,
  'owners can update and add items together');
select is((select data->>'name' from public.content_items where id='__lcp_test_frame'), 'Updated frame', 'existing item updated in place');
select is((select count(*)::int from public.content_items where id='__lcp_test_weapon'), 1, 'omitted item retained for pilot references');

select throws_ok($$select public.import_lcp(
  '{"name":"__LCP_TEST_A","author":"Test","version":"3.0.0","description":"Stale"}',
  '[{"id":"__lcp_test_frame","kind":"frames","data":{"id":"__lcp_test_frame","name":"Stale frame"}}]',
  (select id from public.content_packs where name='__LCP_TEST_A'), current_setting('test.lcp_stamp')::timestamptz)$$,
  'P0001', 'The installed pack changed after preview. Refresh the preview and try again.', 'stale previews are rejected');
select is((select version from public.content_packs where name='__LCP_TEST_A'), '2.0.0', 'stale import did not change version');

select throws_ok($$select public.import_lcp(
  '{"name":"__LCP_TEST_B","author":"Test","version":"1.0.0","description":"Conflict"}',
  '[{"id":"__lcp_test_frame","kind":"frames","data":{"id":"__lcp_test_frame","name":"Stolen frame"}},
    {"id":"__lcp_test_partial","kind":"systems","data":{"id":"__lcp_test_partial","name":"Must not save"}}]')$$,
  'P0001', 'An item ID belongs to another pack or would change type. No content was imported.', 'another pack cannot overwrite existing IDs');
select is((select count(*)::int from public.content_packs where name='__LCP_TEST_B'), 0, 'conflict leaves no partial pack');
select is((select count(*)::int from public.content_items where id='__lcp_test_partial'), 0, 'conflict leaves no partial items');
select is((select data->>'name' from public.content_items where id='__lcp_test_frame'), 'Updated frame', 'conflict preserves original content');

select throws_ok($$select public.import_lcp(
  '{"name":"__LCP_TEST_A","author":"Test","version":"3.0.0","description":"Wrong type"}',
  '[{"id":"__lcp_test_frame","kind":"weapons","data":{"id":"__lcp_test_frame","name":"Wrong type"}}]',
  (select id from public.content_packs where name='__LCP_TEST_A'),
  (select imported_at from public.content_packs where name='__LCP_TEST_A'))$$,
  'P0001', 'An item ID belongs to another pack or would change type. No content was imported.', 'existing IDs cannot change item type');
select throws_ok($$select public.import_lcp(
  '{"name":"__LCP_TEST_DUPLICATE","author":"Test","version":"1.0.0","description":"Duplicate"}',
  '[{"id":"__lcp_duplicate","kind":"frames","data":{"id":"__lcp_duplicate","name":"One"}},
    {"id":"__lcp_duplicate","kind":"frames","data":{"id":"__lcp_duplicate","name":"Two"}}]')$$,
  'P0001', 'Duplicate item IDs in this pack.', 'duplicate IDs refused by database as well as browser');

reset role;
select * from finish();
rollback;
