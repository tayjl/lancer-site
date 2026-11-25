import { describe, expect, it } from 'vitest'
import { BONUS_GROUPS, BONUS_REGISTRY, bonusDef, bonusReminder, bonusSummary, isPilotBonus, personalDef, personalStatIds, talentNames, bonusValue, resolveBonuses } from './bonuses'

describe('permanent bonus arithmetic', () => {
  it('calculates only supported arithmetic and explicit build variables', () => {
    expect(bonusValue('floor({ll}/2) + max(2, {hull})', { ll: 5, hull: 3 })).toBe(5)
    expect(bonusValue('-(2+3)*2 + ceil(1.5)')).toBe(-8)
    expect(bonusValue('2%2')).toBe(0)
    for (const value of ['globalThis.alert(1)', '1/0', '{exposed}', '{grit}', '1d6', '', 'min(1);2', 'floor(1,2)', null, true, Infinity, '('.repeat(300)]) expect(bonusValue(value)).toBeNull()
  })
  it('handles stat replacements and highest overrides in the documented order', () => {
    const entries = [{ source: 'addition', value: 4 }, { source: 'replacement', value: 3, replace: true }, { source: 'overwrite', value: 5, overwrite: true }]
    expect(resolveBonuses(10, entries).value).toBe(8)
    const fixed = resolveBonuses(10, [...entries, { source: 'fixed', value: 2, replace: true, overwrite: true }])
    expect(fixed.value).toBe(2)
    expect(fixed.used.map(entry => entry.source)).toEqual(['fixed'])
    expect(fixed.usesBase).toBe(false)
  })
})

describe('the effect registry', () => {
  it('declares every type once with a label, a group and a summary', () => {
    const ids = BONUS_REGISTRY.map((def) => def.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const def of BONUS_REGISTRY) {
      expect(def.label).not.toBe('')
      expect(BONUS_GROUPS).toContain(def.group)
      expect(bonusSummary({ id: def.id, val: 2 }).length).toBeGreaterThan(0)
      expect(def.counted === 'stat' ? !!def.stat : true).toBe(true)
    }
  })
  it('says what a bonus does in one line', () => {
    expect(bonusSummary({ id: 'speed', val: 2 })).toBe('Adds 2 to Speed')
    expect(bonusSummary({ id: 'speed', val: -1 })).toBe('Takes 1 from Speed')
    expect(bonusSummary({ id: 'speed', val: 6, replace: true })).toBe('Sets Speed to 6')
    expect(bonusSummary({ id: 'add_mount', val: 'Main' })).toBe('Adds a mount: Main')
    expect(bonusSummary({ id: 'superheavy_mounting' })).toBe('Superheavy mount')
  })
  it('words a free talent rank with the talent name, or its id when unknown', () => {
    expect(bonusSummary({ id: 'talent_rank', talent: 'brawler', val: 1 })).toBe('Gives 1 rank of brawler')
    talentNames.value = new Map([['brawler', 'Brawler']])
    expect(bonusSummary({ id: 'talent_rank', talent: 'brawler', val: 1 })).toBe('Gives 1 rank of Brawler')
    expect(bonusSummary({ id: 'talent_rank', talent: 'brawler', val: 2 })).toBe('Gives 2 ranks of Brawler')
    talentNames.value = new Map()
    expect(isPilotBonus('talent_rank')).toBe(true)
  })
  it('counts stats, pilot stats and effects differently', () => {
    expect(bonusDef('armor')).toMatchObject({ counted: 'stat', stat: 'armour', scope: 'mech' })
    expect(bonusDef('pilot_hp')).toMatchObject({ counted: 'pilot', scope: 'pilot' })
    expect(bonusDef('overcharge')?.counted).toBe('effect')
  })
  it('keeps an unknown id as a named reminder, never dropped', () => {
    expect(bonusDef('mystery')).toBeUndefined()
    expect(bonusSummary({ id: 'mystery_thing', val: 3 })).toBe('Adds 3 to mystery thing')
    expect(bonusReminder({ id: 'mystery_thing', val: 3 }, 3)).toBe('+3 mystery thing.')
  })
  it('words a minimum or a set value as what it means, not as a plus', () => {
    expect(bonusReminder({ id: 'min_range', val: 3, range_types: ['Threat'] }, 3)).toBe('Threat range is at least 3.')
    expect(bonusReminder({ id: 'min_range', val: 2, range_types: ['Threat', 'Range'] }, 2)).toBe('Threat and Range are at least 2.')
    expect(bonusReminder({ id: 'min_range', val: 2, range_types: ['Threat', 'Blast'] }, 2)).toBe('Threat and Blast ranges are at least 2.')
    expect(bonusReminder({ id: 'min_range', val: 3, range_types: ['Range'] }, 3)).toBe('Range is at least 3.')
    expect(bonusReminder({ id: 'min_range', val: 3 }, 3)).toBe('Range is at least 3.')
    expect(bonusReminder({ id: 'min_range', val: 3, condition: '{overcharged}' }, 3)).toBe('Range is at least 3, only when overcharged.')
    expect(bonusReminder({ id: 'speed', val: 4, replace: true }, 4)).toBe('Sets speed to 4.')
    expect(bonusReminder({ id: 'speed', val: 4 }, 4)).toBe('+4 speed.')
  })
  it('counts a stat the owner adds on the pilot, with no code', () => {
    expect(personalDef({ id: 'grit', name: 'Grit' })).toMatchObject({ label: 'Grit', group: 'Personal stats', scope: 'pilot', value: 'formula' })
    expect(isPilotBonus('grit')).toBe(false)
    personalStatIds.value = new Set(['grit'])
    expect(isPilotBonus('grit')).toBe(true)
    personalStatIds.value = new Set()
  })
})
