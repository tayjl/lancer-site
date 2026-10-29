async (page) => {
  await page.evaluate(async () => {
    const vueUrl = performance.getEntriesByType('resource').map(entry => entry.name).find(url => url.includes('/deps/vue.js'));
    const { createApp, h, reactive } = await import(vueUrl);
    const { default: Panel } = await import('/src/components/CoreBonusPanel.vue');
    const host = document.createElement('div');
    document.body.append(host);
    const state = reactive({ licences: { blackbeard: 2, drake: 1 }, taken: [], saved: 0 });
    window.bonusFixture = state;
    createApp({ render: () => h(Panel, {
      options: [
        { id: 'gms', name: 'GMS bonus', source: 'GMS', effect: 'test' },
        { id: 'ips', name: 'IPS-N bonus', source: 'IPS-N', effect: 'test' },
        { id: 'ha', name: 'HA bonus', source: 'HA', effect: 'test' },
      ],
      taken: state.taken, licences: state.licences, picks: 1, editable: true,
      frames: [{ id: 'blackbeard', source: 'IPS-N', licenceLevel: 2 }, { id: 'drake', source: 'IPS-N', licenceLevel: 2 }],
      save: async (ids) => { state.taken = ids; state.saved++; return null; },
    }) }).mount(host);
  });
  await page.locator('.core-bonuses').getByRole('button', { name: 'choose', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'choose a core bonus' });
  const ips = dialog.locator('li').filter({ has: page.getByText('IPS-N bonus', { exact: true }) }).getByRole('button');
  const ha = dialog.locator('li').filter({ has: page.getByText('HA bonus', { exact: true }) }).getByRole('button');
  if (await ips.isDisabled() || !(await ha.isDisabled())) throw new Error('Manufacturer eligibility incorrect');
  await page.evaluate(() => { window.bonusFixture.licences.drake = 0; });
  await page.waitForFunction(() => [...document.querySelectorAll('.picker[open] li')].find(row => row.textContent.includes('IPS-N bonus')).querySelector('button').disabled);
  if (!(await ips.isDisabled())) throw new Error('Licence reduction did not update picker');
  await page.evaluate(() => { window.bonusFixture.licences.drake = 1; });
  await ips.click();
  if ((await page.evaluate(() => window.bonusFixture.saved)) !== 1) throw new Error('Eligible bonus not saved');
  console.log('PASS: eligible choices, manufacturer lock, reactive licence reduction and saving');
}
