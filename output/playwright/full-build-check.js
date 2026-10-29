async (page) => {
  await page.unroute('**/rest/v1/**');
  const content = await page.evaluate(async () => {
    const result = [];
    for (const kind of ['frames', 'weapons', 'systems', 'talents', 'core_bonuses', 'pilot_gear', 'tags']) {
      const records = await (await fetch(`/node_modules/@massif/lancer-data/lib/${kind}.json`)).json();
      result.push(...records.map(data => ({ id: data.id, kind, data })));
    }
    return result;
  });
  let sheet = {
    licences: { mf_drake: 3, mf_blackbeard: 3, mf_monarch: 3, mf_goblin: 3 },
    talents: { t_engineer: 2, t_nuclear_cavalier: 3, t_technophile: 2, t_walking_armory: 3, t_drone_commander: 1 },
    mech_skills: { hull: 2, engineering: 2 }, pilot_gear: ['pg_light_hardsuit'],
    core_bonuses: ['cb_improved_armament', 'cb_integrated_weapon', 'cb_mount_retrofitting', 'cb_auto_stabilizing_hardpoints', 'cb_overpower_caliber', 'cb_neurolink_targeting', 'cb_the_lesson_of_shaping', 'cb_integrated_ammo_feeds'],
    mechs: { mech: { frame: 'mf_goblin', mounts: [['mw_assault_cannon', 'mw_tactical_knife'], [], []], systems: ['ms_technophile_2', 'ms_sekhmet_class_nhp', 'ms_turret_drones'], core_mounts: { cb_mount_retrofitting: 0, cb_auto_stabilizing_hardpoints: 0, cb_overpower_caliber: 0 } } },
  };
  content.push({ id: 'capacity_fixture', kind: 'systems', data: { name: 'Capacity fixture', sp: 20, license_level: 0, bonuses: [{ id: 'sp', val: 20 }] } });
  const pilot = { id: 902, player_id: 'fixture-build', pilot_name: 'Test pilot', callsign: 'BUILD', status: 'pending', mechs: [{ id: 'mech', name: 'Build test', manufacturer_id: 'TEST-TEST-TEST', image: null, appearance: null }], player: { display_name: 'Test player' }, appearance: null, personality: null, pilot_image: null };
  await page.route('**/rest/v1/**', async route => {
    const request = route.request(), table = new URL(request.url()).pathname.split('/').pop();
    if (table === 'character_sheets' && request.method() === 'POST') sheet = request.postDataJSON().sheet;
    const data = table === 'characters' ? pilot : table === 'character_sheets' ? { sheet, level: 10, manna: 30000 }
      : table === 'profiles' ? { display_name: 'Test player', role: 'player' }
      : table === 'content_items' ? content : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('http://127.0.0.1:5182/login');
  await page.evaluate(async () => {
    window.confirm = () => true;
    const auth = await import('/src/auth.ts'); await auth.authReady;
    auth.session.value = { user: { id: 'fixture-build' } };
    auth.profile.value = { display_name: 'Test player', role: 'player' };
    await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/pilot/mechs/mech');
  });
  await page.locator('.item-name').filter({ hasText: /^Prototype Weapon II$/ }).waitFor();
  if (await page.getByText('Prototype Weapon I', { exact: true }).count()) throw Error('Obsolete exclusive weapon displayed');
  if (!(await page.locator('main').innerText()).includes('Ammo Case III')) throw Error('Talent system missing');
  const choose = async (locator, value) => {
    const before = JSON.stringify(sheet);
    await locator.selectOption(value);
    for (let attempt = 0; attempt < 40 && JSON.stringify(sheet) === before; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
    if (JSON.stringify(sheet) === before) throw Error(`No saved change for ${value}`);
  };
  await choose(page.getByLabel('Auto-Stabilizing Hardpoints', { exact: true }), '1');
  if (sheet.mechs.mech.core_mounts.cb_auto_stabilizing_hardpoints !== 1) throw Error('Core assignment not persisted');
  const cannon = page.locator('.build-item').filter({ has: page.locator('.item-name').filter({ hasText: /^Assault Cannon · Standard$/ }) });
  await choose(cannon.getByLabel('profile', { exact: true }), '1');
  await page.locator('.item-name').filter({ hasText: /^Assault Cannon · Spin-Up Mode$/ }).waitFor();
  if (sheet.mechs.mech.weapon_options['0:0'].profile !== 1) throw Error('Profile not persisted per instance');
  const prototype = page.locator('.build-item').filter({ has: page.locator('.item-name').filter({ hasText: /^Prototype Weapon II$/ }) });
  await choose(prototype.getByLabel('weapon type', { exact: true }), 'Melee');
  await choose(prototype.getByLabel('damage type', { exact: true }), 'Explosive');
  await choose(prototype.getByLabel('prototype improvements'), 'accuracy-reactor');
  if (sheet.mechs.mech.weapon_options['integrated:mw_prototype_2'].damageType !== 'Explosive') throw Error('Prototype choices not persisted');
  await page.getByRole('button', { name: 'install', exact: true }).click();
  const picker = page.getByRole('dialog');
  await picker.getByRole('textbox').fill('TLALOC');
  const blocked = picker.getByRole('button', { name: 'ai capacity 2', exact: true });
  if (!(await blocked.isDisabled())) throw Error('Third AI not blocked');
  await picker.getByRole('button', { name: 'cancel', exact: true }).click();
  await page.getByRole('button', { name: 'install', exact: true }).click();
  await picker.getByRole('textbox').fill('Capacity fixture');
  await picker.getByRole('button', { name: 'choose', exact: true }).click();
  for (let attempt = 0; attempt < 40 && !sheet.mechs.mech.systems.includes('capacity_fixture'); attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  if (!sheet.mechs.mech.systems.includes('capacity_fixture')) throw Error('Picker did not account for prospective capacity');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`Overflow at ${width}`);
    await page.screenshot({ path: `output/playwright/full-build-${width}.png`, fullPage: true });
  }
  await page.evaluate(async () => {
    const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router;
    await router.push('/pilot'); await router.push('/pilot/mechs/mech');
  });
  await page.locator('.item-name').filter({ hasText: /^Assault Cannon · Spin-Up Mode$/ }).waitFor();
  if ((await page.getByLabel('Auto-Stabilizing Hardpoints', { exact: true }).inputValue()) !== '1') throw Error('Assignment lost on reload');
  console.log('PASS: official core loading, talent grants, core assignments, weapon profiles, prototype choices, AI picker capacity, persistence, desktop and mobile');
}
