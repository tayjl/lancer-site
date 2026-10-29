async (page) => {
  const sheet = { mech_skills: { hull: 2 }, core_bonuses: ['reinforced'], talents: { test: 2 }, mechs: { mech: { frame: 'frame', systems: ['personal', 'capacity', 'conditional'] } } };
  const content = [
    { id: 'frame', kind: 'frames', data: { name: 'Test frame', source: 'GMS', license_level: 0, mounts: ['Main'], stats: { hp: 10, armor: 1, structure: 4, stress: 4, heatcap: 6, evasion: 8, speed: 4, edef: 8, tech_attack: 0, repcap: 4, sp: 5 } } },
    { id: 'personal', kind: 'systems', data: { name: 'Personalizations', sp: 1, bonuses: [{ id: 'hp', val: 2 }] } },
    { id: 'capacity', kind: 'systems', data: { name: 'Capacity', sp: 5, bonuses: [{ id: 'sp', val: 2 }] } },
    { id: 'conditional', kind: 'systems', data: { name: 'Conditional', effect: 'While exposed, gain 10 HP.', bonuses: [{ id: 'hp', val: 10, condition: '{exposed}' }] } },
    { id: 'reinforced', kind: 'core_bonuses', data: { name: 'Reinforced Frame', source: 'GMS', effect: 'Gain 5 HP.', bonuses: [{ id: 'hp', val: 5 }] } },
    { id: 'test', kind: 'talents', data: { name: 'Test talent', ranks: [
      { name: 'First', description: 'Gain 1 repair.', bonuses: [{ id: 'repcap', val: 1 }] },
      { name: 'Second', description: 'Gain 3 HP.', bonuses: [{ id: 'hp', val: 3 }] },
      { name: 'Third', description: 'Gain 9 speed.', bonuses: [{ id: 'speed', val: 9 }] },
    ] } },
  ];
  await page.route('**/rest/v1/**', async route => {
    const table = new URL(route.request().url()).pathname.split('/').pop();
    const data = table === 'characters' ? { id: 901, player_id: 'fixture', pilot_name: 'Test pilot', callsign: 'CHECK', status: 'pending', mechs: [{ id: 'mech', name: 'Test mech', manufacturer_id: 'TEST-TEST-TEST' }], player: { display_name: 'Test player' } }
      : table === 'character_sheets' ? { sheet, level: 0, manna: 9999 }
      : table === 'profiles' ? { display_name: 'Test player', role: 'player' }
      : table === 'content_items' ? content : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.evaluate(async () => {
    const auth = await import('/src/auth.ts');
    await auth.authReady;
    auth.session.value = { user: { id: 'fixture' } };
    auth.profile.value = { display_name: 'Test player', role: 'player' };
    await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/pilot/mechs/mech');
  });
  const stats = page.locator('.stat-row');
  await stats.waitFor();
  const stat = name => stats.locator('li').filter({ has: page.locator('.name').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }) });
  await page.waitForFunction(() => [...document.querySelectorAll('.stat-row li')].find(row => row.querySelector('.name').textContent.trim() === 'hp')?.querySelector('.value').textContent.trim() === '24');
  if ((await stat('system points').locator('.value').innerText()).trim() !== '7') throw new Error('SP bonus missing');
  if ((await stat('speed').locator('.value').innerText()).trim() !== '4') throw new Error('Unowned talent rank counted');
  await stat('hp').getByText('sources', { exact: false }).click();
  if (!(await stat('hp').innerText()).includes('Reinforced Frame: +5')) throw new Error('Source missing');
  await page.locator('.effect-reminders summary').click();
  if (!(await page.locator('.effect-reminders').innerText()).includes('Not included in totals: hp +10; condition: {exposed}')) throw new Error('Conditional reminder missing');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow at ${width}`);
    await page.screenshot({ path: `output/playwright/mech-effects-${width}.png`, fullPage: true });
  }
  console.log('PASS: catalogue loading, cumulative talent ranks, stacked HP, SP capacity, source disclosure, conditional reminders and mobile width');
}
