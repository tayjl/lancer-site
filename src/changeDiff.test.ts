import { describe, expect, it } from 'vitest'
import { changeDiff, listDiff, type Names } from './changeDiff'

const names: Names = {
  stat: (id) => id,
  licence: (id) => `L:${id}`,
  talent: (id) => `T:${id}`,
  coreBonus: (id) => `CB:${id}`,
  bionic: (id) => `B:${id}`,
  gear: (id) => `G:${id}`,
  frame: (id) => `F:${id}`,
  weapon: (id) => `W:${id}`,
  system: (id) => `S:${id}`,
  mod: (id) => `M:${id}`,
}

describe('listDiff', () => {
  it('counts repeats', () => {
    expect(listDiff(['drone', 'drone', 'knife'], ['drone', 'rifle'])).toEqual({ added: ['rifle'], removed: ['drone', 'knife'] })
  })
})

describe('changeDiff', () => {
  it('uses separate character-sheet categories in sheet order', () => {
    const doc = { type: 'doc', content: [] }
    const lines = changeDiff(
      { card: {}, sheet: {} },
      { card: { appearance: doc, personality: doc }, sheet: {
        backstory: doc, pilot_stats: { physicality: 3 }, mech_skills: { hull: 1 },
        bionics: [1], pilot_gear: ['knife'], licences: { frame: 1 }, core_bonuses: ['bonus'], talents: { ace: 1 },
      } },
      names,
    )
    expect([...new Set(lines.map(line => line.section))]).toEqual([
      'appearance', 'personality', 'backstory', 'personal stats', 'piloting stats',
      'biomods', 'loadout', 'licences', 'core bonuses', 'talents',
    ])
  })

  it('says nothing when nothing changed', () => {
    const side = { card: { callsign: 'Deuce', mechs: [] }, sheet: { mech_skills: { hull: 1 } } }
    expect(changeDiff(side, side, names)).toEqual([])
  })

  it('lists identity, stats, purchases and mech changes in plain words', () => {
    const mech = { id: 'm1', name: 'Lantern', manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null }
    const before = {
      card: { callsign: 'Deuce', age: null, mechs: [mech] },
      sheet: {
        mech_skills: { hull: 1 },
        licences: { blackbeard: 2 },
        bionics: [1],
        pilot_gear: ['drone'],
        mechs: { m1: { frame: 'everest', mounts: [['rifle']], systems: ['paint'] } },
      },
    }
    const after = {
      card: { callsign: 'Deuce Prime', age: '31', mechs: [{ ...mech, name: 'Lantern II' }] },
      sheet: {
        mech_skills: { hull: 2, agility: 1 },
        licences: { blackbeard: 3, drake: 1 },
        talents: { t_ace: 1 },
        bionics: [1, 2],
        pilot_gear: ['drone', 'drone'],
        mechs: { m1: { frame: 'blackbeard', mounts: [['axe']], systems: ['paint'] } },
      },
    }
    expect(changeDiff(before, after, names).map((line) => `${line.section} | ${line.kind} | ${line.text}`)).toEqual([
      'identity | updated | Callsign: Deuce → Deuce Prime',
      'identity | added | Age: - → 31',
      'piloting stats | raised | Hull 1 → 2',
      'piloting stats | raised | Agility 0 → 1',
      'biomods | added | B:2',
      'loadout | added | G:drone',
      'mech: Lantern II / identity | updated | Name: Lantern → Lantern II',
      'mech: Lantern II / frame | updated | Frame: F:everest → F:blackbeard',
      'mech: Lantern II / weapon mounts | added | W:axe',
      'mech: Lantern II / weapon mounts | removed | W:rifle',
      'licences | raised | L:blackbeard licence, rank II → III',
      'licences | added | L:drake licence, rank I',
      'talents | added | T:t_ace, rank I',
    ])
  })

  it('gives each line one of five kinds: added, raised, removed, lowered or updated', () => {
    const lines = changeDiff(
      { card: { callsign: 'Old', age: '30' }, sheet: { pilot_stats: { acuity: 3 }, licences: { frame: 1, other: 2 }, talents: { old: 1 }, pilot_gear: ['knife'] } },
      { card: { callsign: 'New', age: null }, sheet: { pilot_stats: { acuity: 2 }, licences: { frame: 2, other: 1 }, talents: { fresh: 1 }, pilot_gear: [] } },
      names,
    )
    expect(lines.map((line) => `${line.kind} | ${line.text}`)).toEqual([
      'updated | Callsign: Old → New',
      'removed | Age: 30 → -',
      'lowered | Acuity 3 → 2',
      'removed | G:knife',
      'raised | L:frame licence, rank I → II',
      'lowered | L:other licence, rank II → I',
      'removed | T:old, rank I',
      'added | T:fresh, rank I',
    ])
  })

  it('says which weapon a mod is on, whether it is added, removed or swapped', () => {
    const mech = { id: 'm1', name: 'Lantern', manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null }
    const side = (mounts: (string | null)[][], weapon_mods: Record<string, string>) => ({ card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts, weapon_mods } } } })
    const text = (before: ReturnType<typeof side>, after: ReturnType<typeof side>) => changeDiff(before, after, names).map((line) => `${line.kind} | ${line.text}`)
    const rifle = [['rifle'], ['cannon']]
    expect(text(side(rifle, {}), side(rifle, { '0:0': 'wm_a' }))).toEqual(['added | Mod on W:rifle: M:wm_a'])
    expect(text(side(rifle, { '1:0': 'wm_a' }), side(rifle, {}))).toEqual(['removed | Mod on W:cannon: M:wm_a'])
    expect(text(side(rifle, { '0:0': 'wm_a' }), side(rifle, { '0:0': 'wm_b' }))).toEqual(['updated | Mod on W:rifle: M:wm_a → M:wm_b'])
    // The mod leaves with its weapon: it is named for the weapon it was on.
    expect(text(side(rifle, { '0:0': 'wm_a' }), side([['pistol'], ['cannon']], {}))).toEqual([
      'added | W:pistol', 'removed | W:rifle', 'removed | Mod on W:rifle: M:wm_a',
    ])
  })

  it('includes new writing without repeating unchanged writing', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New backstory.' }] }] }
    const lines = changeDiff(
      { card: { personality: doc }, sheet: {} },
      { card: { personality: doc }, sheet: { backstory: doc } },
      names,
    )
    expect(lines).toEqual([{ section: 'backstory', text: 'Backstory', kind: 'added', doc }])
  })

  it('flags mount rearrangements even when no weapons were bought or removed', () => {
    const mech = { id: 'm1', name: 'Mech', manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null }
    const lines = changeDiff(
      { card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts: [['rifle'], ['knife']] } } } },
      { card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts: [['knife'], ['rifle']] } } } },
      names,
    )
    expect(lines).toEqual([{ section: 'mech: Mech / weapon mounts', text: 'Weapon mounts rearranged', kind: 'updated' }])
  })

  it('shows core target and per-weapon configuration changes in readable terms', () => {
    const mech = { id: 'm1', name: 'Mech', manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null }
    const lines = changeDiff(
      { card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts: [['rifle']] } } } },
      { card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts: [['rifle']], core_mounts: { cb_overpower_caliber: 0 }, weapon_options: { '0:0': { profile: 1, type: 'Melee' } } } } } }, names,
    )
    expect(lines.map(line => line.text)).toEqual([
      'CB:cb_overpower_caliber target: unassigned → mount 1, W:rifle',
      'Mount 1, weapon 1 configuration: defaults → profile 2, Melee',
    ])
  })
})
