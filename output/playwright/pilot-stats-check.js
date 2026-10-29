async (page) => {
  let privateAccess = true;
  let sheet = { pilot_gear: ['test_suit'] };
  const character = { id: 901, player_id: 'fixture-player', pilot_name: 'Stat Test', callsign: 'CHECK', status: 'pending', mechs: [], player: { display_name: 'Test Player' } };
  await page.route('**/rest/v1/**', async route => {
    const request = route.request();
    const table = new URL(request.url()).pathname.split('/').pop();
    let data = [];
    if (table === 'profiles') data = { display_name: 'Test Player', role: 'gm' };
    if (table === 'characters') data = character;
    if (table === 'character_sheets') {
      if (request.method() === 'POST') sheet = request.postDataJSON().sheet;
      data = privateAccess ? { sheet, level: 0, manna: 0, review_note: '', updated_at: '2026-10-29T00:00:00Z' } : null;
    }
    if (table === 'content_items') data = [{ id: 'test_suit', kind: 'pilot_gear', data: {
      name: 'Test suit', type: 'Armor', bonuses: [
        { id: 'pilot_hp', val: 3 }, { id: 'pilot_armor', val: 2 }, { id: 'pilot_speed', val: 3, replace: true },
      ],
    } }];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('http://127.0.0.1:5182/login');
  await page.evaluate(async () => {
    window.confirm = () => true;
    const auth = await import('/src/auth.ts');
    await auth.authReady;
    auth.session.value = { user: { id: 'fixture-player' } };
    auth.profile.value = { display_name: 'Test Player', role: 'gm' };
    await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/pilot');
  });
  const stats = page.locator('.stat-row').filter({ has: page.getByRole('heading', { name: 'pilot stats [private]', exact: true }) });
  await stats.waitFor();
  const check = async values => {
    const actual = await stats.locator('.value').allTextContents();
    if (actual.map(value => value.trim()).join(',') !== values) throw new Error(`Unexpected stats: ${actual}`);
    if ((await stats.innerText()).includes('evasion')) throw new Error('Pilot evasion displayed');
    if (await stats.getByRole('button').count()) throw new Error('Derived stats should be read-only');
  };
  await check('9,2,3');
  await page.getByRole('button', { name: 'remove', exact: true }).first().click();
  await check('6,0,4');
  await page.evaluate(async () => {
    await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/registry/901');
  });
  await stats.waitFor();
  await check('6,0,4');
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile overflow');
  await page.screenshot({ path: 'output/playwright/pilot-stats-mobile.png', fullPage: true });
  privateAccess = false;
  await page.evaluate(async () => {
    const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router;
    await router.push('/registry');
    await router.push('/registry/901');
  });
  await page.getByRole('heading', { name: 'CHECK', exact: false }).first().waitFor();
  if (await stats.count()) throw new Error('Private stats shown without sheet access');
  console.log('PASS: equipped totals, removal updates, read-only record, mobile width, private access');
}
