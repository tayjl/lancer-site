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
}

describe('listDiff', () => {
  it('counts repeats', () => {
    expect(listDiff(['drone', 'drone', 'knife'], ['drone', 'rifle'])).toEqual({ added: ['rifle'], removed: ['drone', 'knife'] })
  })
})

describe('changeDiff', () => {
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
    expect(changeDiff(before, after, names).map((line) => `${line.section} | ${line.text}`)).toEqual([
      'identity | callsign: Deuce → Deuce Prime',
      'identity | age: - → 31',
      'stats | hull 1 → 2',
      'stats | agility 0 → 1',
      'licences | L:blackbeard licence: rank II → III',
      'licences | L:drake licence: new at rank I',
      'talents | T:t_ace: new at rank I',
      'bionics | added B:2',
      'pilot loadout | added G:drone',
      'mech: Lantern II | renamed from Lantern',
      'mech: Lantern II | frame: F:everest → F:blackbeard',
      'mech: Lantern II | added W:axe',
      'mech: Lantern II | removed W:rifle',
    ])
  })
})
