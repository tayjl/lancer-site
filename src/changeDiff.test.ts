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
      'bionics', 'loadout', 'licences', 'core bonuses', 'talents',
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
    expect(changeDiff(before, after, names).map((line) => `${line.section} | ${line.text}`)).toEqual([
      'identity | callsign: Deuce → Deuce Prime',
      'identity | age: - → 31',
      'piloting stats | hull 1 → 2',
      'piloting stats | agility 0 → 1',
      'bionics | added B:2',
      'loadout | added G:drone',
      'mech: Lantern II / identity | renamed from Lantern',
      'mech: Lantern II / frame | frame: F:everest → F:blackbeard',
      'mech: Lantern II / weapon mounts | added W:axe',
      'mech: Lantern II / weapon mounts | removed W:rifle',
      'licences | L:blackbeard licence: rank II → III',
      'licences | L:drake licence: new at rank I',
      'talents | T:t_ace: new at rank I',
    ])
  })

  it('separates additions from removals and edits, showing only the new rank in addition cards', () => {
    const lines = changeDiff(
      { card: { callsign: 'Old' }, sheet: { licences: { frame: 1 }, talents: { old: 1 }, pilot_gear: ['knife'] } },
      { card: { callsign: 'New' }, sheet: { licences: { frame: 2 }, talents: { fresh: 1 }, pilot_gear: [] } },
      names,
    )
    expect(lines.filter(line => line.kind === 'addition').map(line => line.display ?? line.text)).toEqual([
      'L:frame licence: rank II', 'T:fresh: rank I',
    ])
    expect(lines.filter(line => line.kind === 'addition').map(line => line.increase)).toEqual([1, 1])
    expect(lines.filter(line => line.kind === 'removal').map(line => line.text)).toEqual(['removed G:knife', 'T:old: dropped'])
    expect(lines.find(line => line.section === 'identity')?.kind).toBe('edit')
  })

  it('includes new writing without repeating unchanged writing', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New backstory.' }] }] }
    const lines = changeDiff(
      { card: { personality: doc }, sheet: {} },
      { card: { personality: doc }, sheet: { backstory: doc } },
      names,
    )
    expect(lines).toEqual([{ section: 'backstory', text: 'backstory updated', kind: 'addition', doc }])
  })

  it('flags mount rearrangements even when no weapons were bought or removed', () => {
    const mech = { id: 'm1', name: 'Mech', manufacturer_id: 'AAAA-AAAA-AAAA', appearance: null, image: null }
    const lines = changeDiff(
      { card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts: [['rifle'], ['knife']] } } } },
      { card: { mechs: [mech] }, sheet: { mechs: { m1: { mounts: [['knife'], ['rifle']] } } } },
      names,
    )
    expect(lines).toEqual([{ section: 'mech: Mech / weapon mounts', text: 'weapon mounts rearranged', kind: 'edit' }])
  })
})
