import { describe, expect, it, vi } from 'vitest'
import { coreContent } from './coreContent'
import { toItem, toMod, pilotVitals, type CoreBonus, type Talent } from './gameData'
import { buildFrame, mechEffects, mechResources, mechStats, mountBonusesOf, talentGrants, type Frame, type EffectCatalogue } from './mechData'
import { equipmentDetails, modBlockedBy, modsRefused, selectWeaponProfile } from './equipment'
import type { Sheet } from './myPilot'
import type { NamedBonus } from './bonuses'
import { mechProblems } from './rules'
import { RULES_SEED, ruleItems } from './rulesData'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))
const data = (id: string) => coreContent.items.find(item => item.id === id)!.data as Record<string, unknown>
const items = (kind: string) => new Map(coreContent.items.filter(item => item.kind === kind).map(item => [item.id, toItem(item.id, item.data)]))
const weapons = items('weapons'), systems = items('systems')
const mods = new Map(coreContent.items.filter(item => item.kind === 'mods').map(item => [item.id, toMod(item.id, item.data)]))
const talents = coreContent.items.filter(item => item.kind === 'talents').map(item => item.data as unknown as Talent)
const coreBonuses = coreContent.items.filter(item => item.kind === 'core_bonuses').map(item => item.data as unknown as CoreBonus)
const frame = (id = 'mf_standard_pattern_i_everest'): Frame => {
  const raw = data(id)
  return { id, name: String(raw.name), source: String(raw.source), licenceLevel: Number(raw.license_level), integrated: [], mechtype: [], mounts: raw.mounts as string[], stats: raw.stats as Record<string, number>, description: String(raw.description), raw }
}
const catalogue: EffectCatalogue & { frames: Frame[] } = { frames: [frame(), frame('mf_hydra'), frame('mf_deaths_head')], weapons, systems, integrated: new Map([...weapons, ...systems]), mods, talents, coreBonuses }
const named = (id: string, val: unknown, filters: Record<string, unknown> = {}): NamedBonus => ({ source: 'Test bonus', bonus: { id, val: val as number, ...filters } })

describe('complete core character builds', () => {
  it('upgrades exclusive talent equipment and keeps cumulative nonexclusive grants', () => {
    expect(talentGrants({ talents: { t_engineer: 3, t_nuclear_cavalier: 3, t_technophile: 2, t_walking_armory: 3 } }, talents)).toEqual({
      integrated: ['mw_prototype_3', 'mw_fuel_rod_gun', 'ms_walking_armory_3'], optional: ['ms_technophile_2'], replace: [],
    })
    expect(talentGrants({ talents: { t_engineer: 1 } }, talents).integrated).toEqual(['mw_prototype_1'])
    expect(talentGrants({ talents: { t_engineer: -1 } }, talents).integrated).toEqual([])
  })
  it('adds, retrofits and integrates mounts without changing the saved frame', () => {
    const base = { ...frame(), mounts: ['Heavy', 'Main'] }
    const sheet = { core_bonuses: ['cb_improved_armament', 'cb_integrated_weapon', 'cb_mount_retrofitting'], talents: { t_engineer: 1 } }
    const built = buildFrame(base, { core_mounts: { cb_mount_retrofitting: 0 } }, sheet, talents)!
    expect(built.mounts).toEqual(['Main/Aux', 'Main', 'Flex', 'Integrated Auxiliary'])
    expect(built.integrated).toContain('mw_prototype_1')
    expect(base.mounts).toEqual(['Heavy', 'Main'])
    expect(buildFrame(frame(), {}, { core_bonuses: ['cb_improved_armament'] }, talents)!.mounts).toHaveLength(3)
    expect(buildFrame(null, {}, sheet, talents)).toBeNull()
  })
  it('gives Improved Armament exactly one Flex mount whether or not the data has an add_mount bonus', () => {
    const base = { ...frame(), mounts: ['Main'] }
    const sheet = { core_bonuses: ['cb_improved_armament'] }
    const withBonus = coreBonuses.map(bonus => (bonus.id === 'cb_improved_armament' ? { ...bonus, bonuses: [{ id: 'add_mount', val: 'flex', max: 3 }] } : bonus))
    const without = coreBonuses.map(bonus => (bonus.id === 'cb_improved_armament' ? { ...bonus, bonuses: [] } : bonus))
    for (const cores of [withBonus, without]) {
      const extra = mountBonusesOf({ frame: base.id }, sheet, { ...catalogue, frames: [base], coreBonuses: cores })
      expect(extra).toEqual([])
      expect(buildFrame(base, {}, sheet, talents, extra)!.mounts).toEqual(['Main', 'Flex'])
    }
  })
  it('includes weapons on structured extra mounts and checks an item against its resulting SP capacity', () => {
    const extra = toItem('extra', { name: 'Extra mount', bonuses: [{ id: 'add_mount', val: 'Main', max: 4 }] })
    const booster = toItem('booster', { name: 'Capacity booster', sp: 20, bonuses: [{ id: 'sp', val: 20 }] })
    const gun = toItem('gun', { name: 'Gun', mount: 'Main', bonuses: [{ id: 'hp', val: 2 }] })
    const custom = { ...catalogue, systems: new Map([...systems, ['extra', extra], ['booster', booster]]), weapons: new Map([...weapons, ['gun', gun]]) }
    const mech = { frame: frame().id, systems: ['extra', 'booster'], mounts: [[], [], [], ['gun']] }
    const effects = mechEffects(mech, {}, custom)
    expect(effects.modifiers.some(entry => entry.stat === 'hp' && entry.value === 2)).toBe(true)
    expect(mechProblems(mech, {}, custom)).toEqual([])
  })
  it('uses passive frame effects, permanent check modifiers and resource capacities', () => {
    const sheet: Sheet = { mech_skills: { engineering: 3 }, core_bonuses: ['cb_integrated_ammo_feeds', 'cb_the_lesson_of_shaping', 'cb_heatfall_coolant_system'] }
    const effects = mechEffects({ frame: frame().id }, sheet, catalogue)
    const resources = mechResources(sheet, effects)
    expect(resources).toMatchObject({ aiCap: 2, limited: 3, structureRepairs: 1, overcharge: '1 → 2 → 4 → 4' })
    const death = mechEffects({ frame: 'mf_deaths_head' }, {}, catalogue)
    expect(equipmentDetails(weapons.get('mw_assault_rifle')!, {}, death.bonuses).sources).toContain('Attack: +1')
    expect(death.reminders.some(entry => entry.text.includes('first ranged attack'))).toBe(true)
  })
  it('adds the check supplement only when the frame’s data lacks it', () => {
    const blackbeard = frame('mf_blackbeard')
    const traits = blackbeard.raw!.traits as Record<string, unknown>[]
    const structured = { ...blackbeard, raw: { ...blackbeard.raw, traits: traits.map(trait => trait.name === 'Exposed Reactor' ? { ...trait, bonuses: [{ id: 'engineering', accuracy: -1 }] } : trait) } }
    for (const built of [blackbeard, structured]) {
      const effects = mechEffects({ frame: built.id }, {}, { ...catalogue, frames: [built] })
      expect(mechResources({}, effects).checks.filter(check => check.text.includes('engineering'))).toHaveLength(1)
    }
  })
  it('lists a trait or core power and its same-named action once, with the action’s chip and text', () => {
    const base = frame('mf_blackbeard')
    const custom = { ...base, raw: { ...base.raw,
      traits: [{ name: 'Lock/Kill', description: 'Short.', active_effects: [{ name: 'Lock/Kill', detail: 'The longer, fuller text.' }] }],
      core_system: { name: 'Assault Grapples', active_name: 'Omni-harpoon', active_effect: 'Fires harpoons.', active_actions: [{ name: 'Omni-harpoon', activation: 'Quick', trigger: 'You fire.', detail: 'Hull save.' }] },
    } }
    const { reminders } = mechEffects({ frame: custom.id }, {}, { ...catalogue, frames: [custom] })
    expect(reminders.filter(entry => entry.name === 'Lock/Kill')).toEqual([expect.objectContaining({ kind: 'trait', text: 'Short.' })])
    expect(reminders.filter(entry => entry.name === 'Omni-harpoon')).toEqual([expect.objectContaining({ kind: 'core-power', activation: 'Quick', text: '<b>Trigger:</b> You fire.<br><b>Effect:</b> Hull save.' })])
  })
  it('increases drone HP from Hydra and Drone Commander without increasing the mech HP', () => {
    const sheet: Sheet = { talents: { t_drone_commander: 1 } }
    const effects = mechEffects({ frame: 'mf_hydra', systems: ['ms_turret_drones'] }, sheet, catalogue)
    const item = equipmentDetails(systems.get('ms_turret_drones')!, sheet, effects.bonuses)
    const drone = (item.raw!.deployables as Record<string, unknown>[])[0]
    expect(drone.hp).toBe(20)
    expect(mechStats(frame('mf_hydra'), {}, effects.modifiers).find(stat => stat.id === 'hp')!.value).toBe(frame('mf_hydra').stats.hp)
  })
  it('applies filtered range bonuses, Hunter thrown range and damage converted once', () => {
    const melee = toItem('blade', { type: 'Melee', mount: 'Auxiliary', range: [{ type: 'Threat', val: 1 }], damage: [{ type: 'Energy', val: '1d6' }] })
    const result = equipmentDetails(melee, { talents: { t_hunter: 2 } }, [named('range', 1, { weapon_types: ['melee'], range_types: ['Threat'] }), named('range', 5, { range_types: ['Range'] }), named('damage', '1d6', { damage_types: ['Energy'] }), named('damage', 100, { condition: '{exposed}' })])
    expect(result.range).toEqual([{ type: 'Threat', val: 2 }, { type: 'Thrown', val: 5 }])
    expect(result.damage[0].val).toBe(7)
    expect(equipmentDetails({ ...melee, range: [{ type: 'Thrown', val: 8 }] }, { talents: { t_hunter: 2 } }, []).range[0].val).toBe(8)
  })
  it('supports weapon profiles and prototype choices per equipped instance', () => {
    const cannon = weapons.get('mw_assault_cannon')!
    expect(selectWeaponProfile(cannon, 0).name).not.toBe(selectWeaponProfile(cannon, 1).name)
    expect(selectWeaponProfile(cannon, 500)).toBe(cannon)
    const prototype = equipmentDetails(weapons.get('mw_prototype_3')!, {}, [], { type: 'Melee', damageType: 'Explosive', accuracy: true, smart: false })
    expect(prototype.type).toBe('Melee')
    expect(prototype.range).toEqual([{ type: 'Threat', val: 1 }])
    expect(prototype.damage).toEqual([{ type: 'Explosive', val: 8 }])
    expect(prototype.sources.some(source => source.includes('Tweaked Optics'))).toBe(true)
    expect(prototype.tags.some(tag => tag.id === 'tg_smart')).toBe(false)
  })
  it('applies Limited engineering bonuses without pretending to track expended charges', () => {
    const result = equipmentDetails(weapons.get('mw_fuel_rod_gun')!, { mech_skills: { engineering: 3 } }, [named('limited_bonus', 2)])
    expect(result.tags.find(tag => tag.id === 'tg_limited')!.val).toBe(6)
    const prototype = equipmentDetails(weapons.get('mw_prototype_1')!, { mech_skills: { engineering: 2 } }, [])
    expect(prototype.tags.find(tag => tag.id === 'tg_limited')!.val).toBe('1d6+2+1')
  })
  it('keeps once-per-round damage out of base weapon damage and shows mount accuracy', () => {
    const item = toItem('rifle', { type: 'Rifle', mount: 'Main', damage: [{ type: 'Kinetic', val: '1d6' }] })
    const result = equipmentDetails(item, { core_bonuses: ['cb_auto_stabilizing_hardpoints', 'cb_overpower_caliber'] }, [], {}, { mount: 1, position: 0 }, { cb_auto_stabilizing_hardpoints: 1, cb_overpower_caliber: 2 })
    expect(result.damage[0].val).toBe(4)
    expect(result.sources.some(source => source.includes('once per round'))).toBe(true)
    expect(result.sources.some(source => source.includes('Accuracy: +1'))).toBe(true)
  })
  it('checks lost mounts, talent-only equipment, core targets and AI capacity', () => {
    const ai = ['ms_sekhmet_class_nhp', 'ms_tlaloc_class_nhp']
    const mech = { frame: frame().id, systems: ai, mounts: [[], [], [], ['mw_assault_rifle']] }
    expect(mechProblems(mech, {}, catalogue).some(problem => problem.includes('Only one AI'))).toBe(true)
    expect(mechProblems(mech, { core_bonuses: ['cb_the_lesson_of_shaping'] }, catalogue).some(problem => problem.includes('Only one AI'))).toBe(false)
    expect(mechProblems(mech, {}, catalogue).some(problem => problem.includes('mounts the frame'))).toBe(true)
    expect(mechProblems({ frame: frame().id, mounts: [[], [], ['mw_assault_rifle', 'mw_tactical_knife']] }, {}, catalogue).some(problem => problem.includes('slots the mount'))).toBe(true)
    expect(mechProblems({ frame: frame().id, systems: ['ms_technophile_2'] }, {}, catalogue).some(problem => problem.includes('ms_technophile_2 needs') || problem.includes('needs Technophile'))).toBe(true)
    expect(mechProblems({ frame: frame().id }, { core_bonuses: ['cb_mount_retrofitting'] }, catalogue).some(problem => problem.includes('needs a normal mount'))).toBe(true)
  })
  it('keeps pilot e-defence, excludes pilot evasion and includes permanent talent bonuses', () => {
    const armour = toItem('suit', { type: 'Armor', name: 'Suit', bonuses: [{ id: 'pilot_evasion', val: 6, replace: true }, { id: 'pilot_edef', val: 2 }] })
    const custom: Talent[] = [{ id: 'test', name: 'Test', terse: '', ranks: [{ name: 'I', description: '', bonuses: [{ id: 'pilot_hp', val: 2 }] }] }]
    const stats = pilotVitals({ owned_gear: [{ key: 'k', id: 'suit' }], equipped_gear: ['k'], talents: { test: 1 } }, [armour], custom)
    expect(stats.map(stat => stat.value)).toEqual([8, 0, 4, 12])
    expect(stats[0].contributors).toContain('Test 1: +2')
  })
})

describe('weapon mods', () => {
  const mod = (id: string) => mods.get(id)!
  const weapon = (id: string) => weapons.get(id)!

  it('fits a mod to a weapon by type and size, and refuses weapons and mounts that take none', () => {
    const rifle = weapon('mw_assault_rifle')
    expect(modBlockedBy(mod('wm_nanocomposite_adaptation'), rifle, 'Main')).toBe('')
    expect(modBlockedBy(mod('wm_stabilizer_mod'), rifle, 'Main')).toBe('Fits Launcher, Cannon only')
    expect(modBlockedBy(mod('wm_stabilizer_mod'), weapon('mw_assault_cannon'), 'Main')).toBe('')
    expect(modBlockedBy(mod('wm_uncle_class_comp_con'), weapon('mw_siege_cannon'), 'Heavy')).toBe("Can't go on Superheavy weapons")
    expect(modBlockedBy(mod('wm_nanocomposite_adaptation'), weapon('mw_mimic_gun'), 'Heavy')).toBe("Mimic Gun can't take mods")
    expect(modsRefused(rifle, 'Integrated Auxiliary')).toBe("An integrated mount can't be modified")
    // A Prototype weapon counts as the type its player chose.
    expect(modBlockedBy(mod('wm_stabilizer_mod'), weapon('mw_prototype_1'), 'Main')).not.toBe('')
    expect(modBlockedBy(mod('wm_stabilizer_mod'), weapon('mw_prototype_1'), 'Main', { type: 'Cannon' })).toBe('')
  })

  it('adds the mod’s range and tags to its weapon, names the mod as the source, and leaves conditional damage out', () => {
    const cannon = toItem('cannon', { name: 'Cannon', mount: 'Main', type: 'Cannon', range: [{ type: 'Range', val: 10 }], damage: [{ type: 'Kinetic', val: '1d6' }] })
    const modded = equipmentDetails(cannon, {}, [], undefined, undefined, {}, mod('wm_stabilizer_mod'))
    expect(modded.range).toEqual([{ type: 'Range', val: 15 }])
    expect(modded.tags.map(tag => tag.id)).toEqual(['tg_ordnance', 'tg_modded'])
    expect(modded.sources).toContain('Stabilizer Mod: +5 range')
    const blade = equipmentDetails(weapon('mw_charged_blade'), {}, [], undefined, undefined, {}, mod('wm_thermal_charge'))
    expect(blade.damage).toEqual([{ type: 'Energy', val: 5 }])
    // Without a mod nothing changes.
    expect(equipmentDetails(cannon, {}, []).tags).toEqual([])
  })

  it('counts a mod’s system points and bonuses, needs its licence, and flags a mod that cannot be there', () => {
    const bonusMod = toMod('wm_test_hp', { name: 'Test mod', sp: 1, allowed_types: ['Rifle'], bonuses: [{ id: 'hp', val: 3 }] })
    const custom = { ...catalogue, mods: new Map([...mods, ['wm_test_hp', bonusMod]]) }
    const mech = { frame: frame().id, mounts: [['mw_assault_rifle'], [], []], weapon_mods: { '0:0': 'wm_test_hp' } }
    expect(mechEffects(mech, {}, custom).modifiers.some(entry => entry.stat === 'hp' && entry.value === 3)).toBe(true)
    expect(mechProblems(mech, {}, custom)).toEqual([])
    // Licensed like a system, and fitted to its weapon's type.
    const licensed = { ...mech, weapon_mods: { '0:0': 'wm_nanocomposite_adaptation' } }
    expect(mechProblems(licensed, {}, custom)).toEqual(['Nanocomposite Adaptation needs mf_balor licence rank II.'])
    expect(mechProblems(licensed, { licences: { mf_balor: 2 } }, custom)).toEqual([])
    expect(mechProblems({ ...mech, weapon_mods: { '0:0': 'wm_stabilizer_mod' } }, { licences: { mf_monarch: 2 } }, custom))
      .toEqual(["Stabilizer Mod can't go on Assault Rifle. Fits Launcher, Cannon only."])
    // Its system points are spent too: a 2 SP mod and a 5 SP system on a 6 SP frame.
    const big = toItem('big', { name: 'Big system', sp: 5 })
    const full = { ...custom, systems: new Map([...systems, ['big', big]]) }
    expect(mechProblems({ ...licensed, systems: ['big'] }, { licences: { mf_balor: 2 } }, full)).toEqual(['Uses 7 system points, but only 6 are available.'])
    expect(mechProblems({ ...mech, systems: ['big'] }, {}, full)).toEqual([])
    // A mod whose place holds no weapon, or that isn't in the packs, is flagged and costs nothing.
    expect(mechProblems({ ...mech, weapon_mods: { '2:0': 'wm_test_hp' } }, {}, custom)).toEqual(['Test mod has no weapon to sit on.'])
    expect(mechProblems({ ...mech, weapon_mods: { '0:0': 'wm_gone' } }, {}, custom)).toEqual(["Mod wm_gone isn't in any loaded pack."])
    // Integrated mounts take none, and a Unique mod only once.
    const integratedMount = { frame: frame().id, mounts: [[], [], [], ['mw_assault_rifle']], weapon_mods: { '3:0': 'wm_test_hp' } }
    expect(mechProblems(integratedMount, { core_bonuses: ['cb_integrated_weapon'] }, custom)).toContain("Test mod can't go on Assault Rifle. An integrated mount can't be modified.")
  })
})

describe('superheavy mounting, core equipment and mount counting', () => {
  const base = { ...frame(), mounts: ['Main', 'Main'] }
  const sheetWith = (...ids: string[]): Sheet => ({ core_bonuses: ids })
  const shm = { id: 'cb_sh', name: 'Superheavy Mounting', source: 'GMS', effect: '', bonuses: [{ id: 'superheavy_mounting' }] } as CoreBonus
  const gun = toItem('gl', { name: 'GL', mount: 'Main' }), oldGun = toItem('old', { name: 'Old', mount: 'Main' }), sys = toItem('sys', { name: 'Sys' })
  const bigGun = { id: 'cb_big', name: 'Big', source: 'GMS', effect: '', integrated: ['gl'], special_equipment: ['sys'], replace_integrated: true } as CoreBonus
  const integrated = new Map([['gl', gun], ['old', oldGun], ['sys', sys]])
  it('adds a Superheavy mount only below three non-integrated mounts', () => {
    const named = [{ source: 's', bonus: { id: 'superheavy_mounting', val: 0 } }]
    expect(buildFrame(base, {}, {}, [], named)!.mounts).toEqual(['Main', 'Main', 'Superheavy'])
    expect(buildFrame({ ...base, mounts: ['Main', 'Main', 'Main'] }, {}, {}, [], named)!.mounts).toHaveLength(3)
    // An integrated mount isn't counted, so the Superheavy mount still comes.
    expect(buildFrame(base, {}, sheetWith('cb_integrated_weapon'), [], named)!.mounts).toEqual(['Main', 'Main', 'Superheavy', 'Integrated Auxiliary'])
    const effects = mechEffects({ frame: base.id }, sheetWith('cb_sh'), { ...catalogue, frames: [base], coreBonuses: [shm] })
    expect(buildFrame(base, {}, sheetWith('cb_sh'), [], effects.bonuses)!.mounts).toContain('Superheavy')
  })
  it('add_mount max ignores integrated mounts and takes any mount type', () => {
    const add = (val: string, max?: number) => [{ source: 's', bonus: { id: 'add_mount', val, max } }]
    expect(buildFrame({ ...base, mounts: ['Main', 'Main', 'Integrated Auxiliary'] }, {}, {}, [], add('Superheavy', 3))!.mounts).toHaveLength(4)
    expect(buildFrame(base, {}, {}, [], add('Integrated Auxiliary'))!.mounts).toEqual(['Main', 'Main', 'Integrated Auxiliary'])
    expect(buildFrame(base, {}, {}, [], add('toString'))!.mounts).toHaveLength(2)
  })
  it('adds a core bonus’s integrated items, and replaces the frame’s integrated weapons only on request', () => {
    const own = { ...base, integrated: ['old', 'sys'] }
    const built = (bonus: CoreBonus) => buildFrame(own, {}, sheetWith(bonus.id), [], [], { coreBonuses: [bonus], integrated })!.integrated
    expect(built({ ...bigGun, replace_integrated: undefined })).toEqual(['old', 'sys', 'gl'])
    expect(built(bigGun)).toEqual(['sys', 'gl'])
    expect(talentGrants(sheetWith('cb_big'), [], [bigGun])).toEqual({ integrated: ['gl'], optional: ['sys'], replace: ['gl'] })
    expect(buildFrame(own, {}, {}, [], [], { coreBonuses: [bigGun], integrated })!.integrated).toEqual(['old', 'sys'])
  })
})

describe('free talent ranks on the mech', () => {
  const arm = (talent: string, val: number) => ({ id: 1, name: 'Arm', effect: '', effect_bonuses: [{ id: 'talent_rank', talent, val }] }) as never
  const ranked = (sheet: Sheet, ...bionics: unknown[]) => ({ sheet: { ...sheet, bionics: [1] }, cat: { ...catalogue, bionics } as EffectCatalogue & { frames: Frame[] } })

  it("unlocks a talent's equipment from a free rank, and stops counting at the highest rank", () => {
    const free = ranked({}, arm('t_engineer', 1))
    expect(mechEffects({ frame: frame().id }, free.sheet, free.cat).frame!.integrated).toContain('mw_prototype_1')
    const over = ranked({ talents: { t_engineer: 3 } }, arm('t_engineer', 1))
    const integrated = mechEffects({ frame: frame().id }, over.sheet, over.cat).frame!.integrated
    expect(integrated).toContain('mw_prototype_3')
    expect(integrated).not.toContain('mw_prototype_4')
  })
  it("doesn't change the sheet it is given", () => {
    const free = ranked({ talents: { t_engineer: 1 } }, arm('t_engineer', 1))
    mechEffects({ frame: frame().id }, free.sheet, free.cat)
    mechProblems({ frame: frame().id }, free.sheet, free.cat)
    expect(free.sheet.talents).toEqual({ t_engineer: 1 })
  })
  it('counts rank 4 when the highest rank is raised', () => {
    const four = { id: 't_four', name: 'Four', terse: '', ranks: [1, 2, 3, 4].map(n => ({ name: `R${n}`, description: '', bonuses: [{ id: 'hp', val: n }] })) } as Talent
    const cat = { ...catalogue, talents: [four], bionics: [arm('t_four', 1)] } as EffectCatalogue & { frames: Frame[] }
    const hp = () => mechEffects({ frame: frame().id }, { talents: { t_four: 3 }, bionics: [1] }, cat).modifiers.filter(entry => entry.stat === 'hp').length
    expect(hp()).toBe(3)
    ruleItems.value = [{ id: 'rule_num_max_talent_rank', name: 'x', section: 'numbers', text: '', order: 1, numbers: [4] }]
    expect(hp()).toBe(4)
    ruleItems.value = RULES_SEED
  })
})
