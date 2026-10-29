import { describe, expect, it, vi } from 'vitest'
import { coreContent } from './coreContent'
import { toItem, pilotVitals, type CoreBonus, type Talent } from './gameData'
import { buildFrame, mechEffects, mechResources, mechStats, talentGrants, type Frame, type EffectCatalogue } from './mechData'
import { equipmentDetails, selectWeaponProfile } from './equipment'
import type { Sheet } from './myPilot'
import type { NamedBonus } from './bonuses'
import { mechProblems } from './rules'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))
const data = (id: string) => coreContent.items.find(item => item.id === id)!.data as Record<string, unknown>
const items = (kind: string) => new Map(coreContent.items.filter(item => item.kind === kind).map(item => [item.id, toItem(item.id, item.data)]))
const weapons = items('weapons'), systems = items('systems')
const talents = coreContent.items.filter(item => item.kind === 'talents').map(item => item.data as unknown as Talent)
const coreBonuses = coreContent.items.filter(item => item.kind === 'core_bonuses').map(item => item.data as unknown as CoreBonus)
const frame = (id = 'mf_standard_pattern_i_everest'): Frame => {
  const raw = data(id)
  return { id, name: String(raw.name), source: String(raw.source), licenceLevel: Number(raw.license_level), integrated: [], mechtype: [], mounts: raw.mounts as string[], stats: raw.stats as Record<string, number>, description: String(raw.description), raw }
}
const catalogue: EffectCatalogue & { frames: Frame[] } = { frames: [frame(), frame('mf_hydra'), frame('mf_deaths_head')], weapons, systems, integrated: new Map([...weapons, ...systems]), talents, coreBonuses }
const named = (id: string, val: unknown, filters: Record<string, unknown> = {}): NamedBonus => ({ source: 'Test bonus', bonus: { id, val: val as number, ...filters } })

describe('complete core character builds', () => {
  it('upgrades exclusive talent equipment and keeps cumulative nonexclusive grants', () => {
    expect(talentGrants({ talents: { t_engineer: 3, t_nuclear_cavalier: 3, t_technophile: 2, t_walking_armory: 3 } }, talents)).toEqual({
      integrated: ['mw_prototype_3', 'mw_fuel_rod_gun', 'ms_walking_armory_3'], optional: ['ms_technophile_2'],
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
    expect(resources).toMatchObject({ aiCap: 2, limited: 3, structureRepairs: 1, overcharge: '1 → 1d3 → 1d6 → 1d6', superheavyMounting: false })
    const death = mechEffects({ frame: 'mf_deaths_head' }, {}, catalogue)
    expect(equipmentDetails(weapons.get('mw_assault_rifle')!, {}, death.bonuses).sources).toContain('attack roll bonus: +1')
    expect(death.reminders.some(entry => entry.text.includes('first ranged attack'))).toBe(true)
  })
  it('increases drone HP from Hydra and Drone Commander without increasing the mech HP', () => {
    const sheet: Sheet = { talents: { t_drone_commander: 1 } }
    const effects = mechEffects({ frame: 'mf_hydra', systems: ['ms_turret_drones'] }, sheet, catalogue)
    const item = equipmentDetails(systems.get('ms_turret_drones')!, sheet, effects.bonuses)
    const drone = (item.raw!.deployables as Record<string, unknown>[])[0]
    expect(drone.hp).toBe(20)
    expect(mechStats(frame('mf_hydra'), {}, effects.modifiers).find(stat => stat.id === 'hp')!.value).toBe(frame('mf_hydra').stats.hp)
  })
  it('applies filtered range bonuses, Hunter thrown range and damage averaged once', () => {
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
    expect(result.sources.some(source => source.includes('attack accuracy: +1'))).toBe(true)
  })
  it('checks lost mounts, talent-only equipment, core targets and AI capacity', () => {
    const ai = ['ms_sekhmet_class_nhp', 'ms_tlaloc_class_nhp']
    const mech = { frame: frame().id, systems: ai, mounts: [[], [], [], ['mw_assault_rifle']] }
    expect(mechProblems(mech, {}, catalogue).some(problem => problem.includes('only one AI'))).toBe(true)
    expect(mechProblems(mech, { core_bonuses: ['cb_the_lesson_of_shaping'] }, catalogue).some(problem => problem.includes('only one AI'))).toBe(false)
    expect(mechProblems(mech, {}, catalogue).some(problem => problem.includes('mounts this build no longer has'))).toBe(true)
    expect(mechProblems({ frame: frame().id, mounts: [[], [], ['mw_assault_rifle', 'mw_tactical_knife']] }, {}, catalogue).some(problem => problem.includes('extra slots'))).toBe(true)
    expect(mechProblems({ frame: frame().id, systems: ['ms_technophile_2'] }, {}, catalogue).some(problem => problem.includes('no longer granted'))).toBe(true)
    expect(mechProblems({ frame: frame().id }, { core_bonuses: ['cb_mount_retrofitting'] }, catalogue).some(problem => problem.includes('choose a normal mount'))).toBe(true)
  })
  it('keeps pilot e-defence, excludes pilot evasion and includes permanent talent bonuses', () => {
    const armour = toItem('suit', { type: 'Armor', name: 'Suit', bonuses: [{ id: 'pilot_evasion', val: 6, replace: true }, { id: 'pilot_edef', val: 2 }] })
    const custom: Talent[] = [{ id: 'test', name: 'Test', terse: '', ranks: [{ name: 'I', description: '', bonuses: [{ id: 'pilot_hp', val: 2 }] }] }]
    const stats = pilotVitals({ pilot_gear: ['suit'], talents: { test: 1 } }, [armour], custom)
    expect(stats.map(stat => stat.value)).toEqual([8, 0, 4, 12])
    expect(stats[0].contributors).toContain('Test 1: +2')
  })
})
