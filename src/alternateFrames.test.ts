import { describe, expect, it, vi } from 'vitest'
import { archiveEntries, type ArchiveContent } from './archive'
import { changeDiff, type Names } from './changeDiff'
import { blankItem, problemsFor, type Context } from './contentEditor'
import { licenceUnlocks } from './info'
import { alternateOf, chosenFrame, licensedFrames, toFrame, type Frame } from './mechData'
import { frameBlockedBy, pilotProblems, mechProblems, type Catalogue } from './rules'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

// Shaped like the packs' frames.json: an alternate has `variant` (the original's name) and usually `license_id` (the
// original's id) with its own license_level; Empakaai (ssmr-data) has no license_id, only the variant.
const stats = { size: 1, structure: 4, stress: 4, armor: 1, hp: 10, evasion: 8, edef: 8, heatcap: 5, repcap: 4, speed: 4, tech_attack: 0, sp: 5 }
const GENGHIS = 'mf_genghis'
const WORLDKILLER = 'mf_genghis_alt_worldkiller_genghis_mk_i'
const WK_NAME = '“Worldkiller” Genghis Mk I'
const data = (id: string, name: string, extra: Record<string, unknown>) => ({ id, name, source: 'HA', license_level: 2, mounts: ['Main'], mechtype: ['Striker'], stats, ...extra })
const frames: Frame[] = [
  toFrame(GENGHIS, data(GENGHIS, 'Genghis', { license_id: GENGHIS })),
  toFrame(WORLDKILLER, data(WORLDKILLER, WK_NAME, { license_id: GENGHIS, variant: 'Genghis' })),
  toFrame('mf_blackbeard', data('mf_blackbeard', 'Blackbeard', { source: 'IPS-N', license_id: 'mf_blackbeard' })),
  toFrame('mf_Empakaai_alt_blackbeard', data('mf_Empakaai_alt_blackbeard', 'Empakaai', { source: 'IPS-N', variant: 'Blackbeard' })),
  toFrame('mf_standard_pattern_i_everest', data('mf_standard_pattern_i_everest', 'Everest', { source: 'GMS', license_level: 0, license_id: 'mf_standard_pattern_i_everest' })),
  toFrame('mf_sagarmatha', data('mf_sagarmatha', 'Sagarmatha', { source: 'GMS', license_level: 0, license_id: 'mf_standard_pattern_i_everest', variant: 'Everest' })),
]
const [genghis, worldkiller, , empakaai, , sagarmatha] = frames

describe('alternate frames', () => {
  it('are found by license_id, else by the variant name; originals are not alternates', () => {
    expect(alternateOf(worldkiller, frames)?.id).toBe(GENGHIS)
    expect(alternateOf(empakaai, frames)?.name).toBe('Blackbeard')
    expect(alternateOf(genghis, frames)).toBeUndefined()
  })

  it('leave only originals as licences, in the licence list and the archives', () => {
    expect(licensedFrames(frames).map((f) => f.name)).toEqual(['Genghis', 'Blackbeard'])
    const content: ArchiveContent = { manufacturers: [], frames, weapons: [], systems: [], mods: [], gear: [], biomods: [], statNames: new Map(), talents: [], coreBonuses: [] }
    const entries = archiveEntries(content)
    expect(entries.filter((e) => e.category === 'licences').map((e) => e.name)).toEqual(['Genghis', 'Blackbeard'])
    expect(entries.filter((e) => e.category === 'frames')).toHaveLength(frames.length)
  })

  it('appear in the original licence ladder at their own rank', () => {
    const names = (level: number) => licenceUnlocks(genghis, [], [], [], level, frames).map((u) => u.name)
    expect(names(1)).toEqual([])
    expect(names(2)).toEqual(['Genghis', WK_NAME])
  })
})

describe('the frame a licence gives', () => {
  const sheet = (licences: Record<string, number>, frame_choices?: Record<string, string>) => ({ licences, frame_choices })
  it('defaults to the original, and a choice swaps which frame is unlocked', () => {
    expect(chosenFrame(genghis, frames, undefined).id).toBe(GENGHIS)
    expect(chosenFrame(genghis, frames, { [GENGHIS]: WORLDKILLER }).id).toBe(WORLDKILLER)
    expect(chosenFrame(genghis, frames, { [GENGHIS]: 'nonsense' }).id).toBe(GENGHIS)
    expect(frameBlockedBy(genghis, frames, sheet({ [GENGHIS]: 2 }))).toBe('')
    expect(frameBlockedBy(worldkiller, frames, sheet({ [GENGHIS]: 2 }))).toBe('Licence gives Genghis')
    expect(frameBlockedBy(genghis, frames, sheet({ [GENGHIS]: 2 }, { [GENGHIS]: WORLDKILLER }))).toBe(`Licence gives ${WK_NAME}`)
    expect(frameBlockedBy(worldkiller, frames, sheet({ [GENGHIS]: 2 }, { [GENGHIS]: WORLDKILLER }))).toBe('')
  })

  it('still needs the rank, and leaves GMS frames alone', () => {
    expect(frameBlockedBy(worldkiller, frames, sheet({ [GENGHIS]: 1 }, { [GENGHIS]: WORLDKILLER }))).toBe('Needs HA Genghis II')
    expect(frameBlockedBy(sagarmatha, frames, sheet({}))).toBe('')
  })
})

describe('rule check for alternate frames', () => {
  const catalogue: Catalogue = { frames, weapons: new Map(), systems: new Map(), integrated: new Map() }
  const mech = { frame: WORLDKILLER }

  it('flags a mech whose frame is not the one its licence gives', () => {
    const held = { licences: { [GENGHIS]: 2 }, mech_skills: {} }
    expect(mechProblems(mech, held, catalogue)).toEqual([`${WK_NAME} isn't the frame chosen for the Genghis licence.`])
    expect(mechProblems(mech, { ...held, frame_choices: { [GENGHIS]: WORLDKILLER } }, catalogue)).toEqual([])
    expect(mechProblems(mech, { licences: {}, mech_skills: {} }, catalogue)).toEqual([`The ${WK_NAME} frame needs HA Genghis licence rank II.`])
  })

  it('flags a licence held under an alternate frame', () => {
    const problems = pilotProblems({ licences: { [WORLDKILLER]: 1 } }, { level: 0, manna: 600 }, catalogue, {})
    expect(problems).toEqual([`${WK_NAME} is part of the Genghis licence. A GM should move its ranks there.`])
  })
})

describe('change review', () => {
  const names: Names = { stat: (id) => id, licence: (id) => `L:${id}`, talent: (id) => id, coreBonus: (id) => id, bionic: (id) => String(id), gear: (id) => id, gearType: () => undefined, frame: (id) => `F:${id}`, weapon: (id) => id, system: (id) => id, mod: (id) => id }
  it('shows a changed frame choice in the licences group', () => {
    const before = { card: {}, sheet: { licences: { a: 2 } } }
    expect(changeDiff(before, { card: {}, sheet: { licences: { a: 2 }, frame_choices: { a: 'alt' } } }, names))
      .toEqual([{ section: 'licences', text: 'L:a licence frame: F:a → F:alt', kind: 'updated' }])
    // Choosing the original again is no change from having no choice.
    expect(changeDiff({ card: {}, sheet: { frame_choices: { a: 'a' } } }, { card: {}, sheet: {} }, names)).toHaveLength(0)
  })
})

describe('the frame editor', () => {
  const ctx: Context = { id: 'hb_f_x', tags: new Map(), statIds: [], licences: new Set(frames.map((f) => f.id)), alternates: new Set([WORLDKILLER]) }
  const blank = blankItem('frames', 'hb_f_x')
  const frame = { ...blank, name: 'Test Alt', core_system: { ...(blank.core_system as object), name: 'Core' } }
  const errors = (extra: Record<string, unknown>) => problemsFor('frames', { ...frame, ...extra }, ctx).filter((p) => p.level === 'error').map((p) => p.text)

  it('accepts an alternate of an original frame', () => {
    expect(errors({ license_id: GENGHIS, variant: 'Genghis', license_level: 2 })).toEqual([])
    expect(errors({})).toEqual([])
  })
  it('refuses an alternate of itself or of another alternate', () => {
    expect(errors({ license_id: 'hb_f_x', variant: 'Genghis' })).toEqual(["A frame can't be an alternate of itself."])
    expect(errors({ license_id: WORLDKILLER, variant: WK_NAME })).toEqual(['Choose the original frame, not another alternate.'])
  })
})
