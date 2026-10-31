import { describe, expect, it, vi } from 'vitest'
import { archiveEntries, archiveGroups, searchArchive, type ArchiveContent } from './archive'
import { coreContent } from './coreContent'
import { toItem, type CoreBonus, type Talent } from './gameData'
import type { Manufacturer } from './info'
import type { Frame } from './mechData'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))
const rows = (kind: string) => coreContent.items.filter(item => item.kind === kind)
const frames: Frame[] = rows('frames').map(({ id, data }) => {
  const raw = data as Record<string, unknown>
  return { id, name: String(raw.name), source: String(raw.source), licenceLevel: Number(raw.license_level ?? 0), integrated: [], mechtype: (raw.mechtype ?? []) as string[], mounts: (raw.mounts ?? []) as string[], stats: (raw.stats ?? {}) as Record<string, number>, description: String(raw.description ?? ''), raw }
})
const content: ArchiveContent = {
  manufacturers: rows('manufacturers').map(({ id, data }) => ({ id, ...(data as object), colour: (data as { dark: string }).dark }) as Manufacturer)
    .sort((a, b) => a.name.localeCompare(b.name)),
  frames,
  weapons: rows('weapons').map(({ id, data }) => toItem(id, data)),
  systems: rows('systems').map(({ id, data }) => toItem(id, data)),
  gear: rows('pilot_gear').map(({ id, data }) => toItem(id, data)),
  talents: rows('talents').map(({ data }) => data as unknown as Talent),
  coreBonuses: rows('core_bonuses').map(({ data }) => data as unknown as CoreBonus),
}
const entries = archiveEntries(content)

describe('archives', () => {
  it('lists every category, with a licence for each licensed frame only', () => {
    const count = (category: string) => entries.filter(entry => entry.category === category).length
    expect(count('manufacturers')).toBe(content.manufacturers.length)
    expect(count('frames')).toBe(frames.length)
    expect(count('licences')).toBe(frames.filter(frame => frame.licenceLevel > 0).length)
    expect(entries.find(entry => entry.id === 'mw_autopod')).toMatchObject({ category: 'mech weapons', meta: 'main launcher · horus goblin i' })
  })

  it('searches names, facts and rules text across every category, all words in any order', () => {
    expect(searchArchive(entries, '')).toEqual([])
    const autopod = searchArchive(entries, 'autopod').map(entry => `${entry.category}: ${entry.name}`)
    expect(autopod).toContain('mech weapons: Autopod')
    const byRules = searchArchive(entries, 'lock on reaction').map(entry => entry.name)
    expect(byRules).toContain('Autopod')
    expect(searchArchive(entries, 'zzz-not-a-thing')).toEqual([])
  })

  it('groups entries by manufacturer in order, with their colours, gear by type and talents ungrouped', () => {
    const frameGroups = archiveGroups(entries.filter(entry => entry.category === 'frames'), content.manufacturers)
    expect(frameGroups.map(group => group.title)).toEqual(['GMS', 'HA', 'HORUS', 'IPS-N', 'SSC'])
    expect(frameGroups[3]).toMatchObject({ title: 'IPS-N', colour: '#1c9ae8' })
    expect(frameGroups.every(group => group.logo)).toBe(true)
    const goblinWeapons = archiveGroups(entries.filter(entry => entry.category === 'mech weapons'), content.manufacturers).find(group => group.key === 'HORUS')!
    expect(goblinWeapons.entries.map(entry => entry.level)).toEqual([...goblinWeapons.entries.map(entry => entry.level)].sort())
    expect(frameGroups[3].entries.map(entry => entry.name)).toContain('Blackbeard')
    const gearGroups = archiveGroups(entries.filter(entry => entry.category === 'pilot gear'), content.manufacturers)
    expect(gearGroups.map(group => group.title)).toEqual(['pilot armour', 'pilot weapons', 'pilot gear'])
    const talentGroups = archiveGroups(entries.filter(entry => entry.category === 'talents'), content.manufacturers)
    expect(talentGroups).toHaveLength(1)
    expect(talentGroups[0]).toMatchObject({ title: '', colour: 'var(--lilac)' })
  })

  it('finds frames by their manufacturer', () => {
    expect(searchArchive(entries, 'horus goblin').map(entry => `${entry.category}: ${entry.name}`)).toEqual(expect.arrayContaining(['frames: Goblin', 'licences: Goblin']))
  })

  it('opens each entry’s full information', () => {
    for (const category of new Set(entries.map(entry => entry.category))) {
      const first = entries.find(entry => entry.category === category)!
      expect(first.info().name).toBeTruthy()
    }
  })
})
