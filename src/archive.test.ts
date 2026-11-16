import { describe, expect, it, vi } from 'vitest'
import { archiveEntries, archiveGroups, filterByMakers, listFacts, makerColour, makerLogo, parseItem, parseMakers, searchArchive, type ArchiveContent } from './archive'
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
    expect(entries.find(entry => entry.id === 'mw_autopod')).toMatchObject({ category: 'mech weapons', group: 'HORUS', licence: 'Goblin', level: 1 })
    // Systems without effect text are summed up by their first action or deployable.
    for (const name of ['Grounding Charges', 'Repulser Field', 'Clamp Bombs']) expect(entries.find(entry => entry.name === name)?.summary).toBeTruthy()
  })

  it('searches names, facts and rules text across every category, all words in any order', () => {
    expect(searchArchive(entries, '')).toEqual([])
    const autopod = searchArchive(entries, 'autopod').map(entry => `${entry.category}: ${entry.name}`)
    expect(autopod).toContain('mech weapons: Autopod')
    const byRules = searchArchive(entries, 'lock on reaction').map(entry => entry.name)
    expect(byRules).toContain('Autopod')
    expect(searchArchive(entries, 'zzz-not-a-thing')).toEqual([])
  })

  it('ranks the exact name first, then names starting with the search, then names containing it, then other text', () => {
    const names = (query: string) => searchArchive(entries, query).map(entry => entry.name)
    expect(names('goblin')[0]).toBe('Goblin')
    const drone = names('drone')
    const firstOther = drone.findIndex(name => !name.toLowerCase().includes('drone'))
    expect(firstOther).toBeGreaterThan(0)
    expect(drone.slice(firstOther).every(name => !name.toLowerCase().includes('drone'))).toBe(true)
    const starts = drone.filter(name => name.toLowerCase().startsWith('drone'))
    expect(drone.slice(0, starts.length)).toEqual(starts)
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

  it('splits weapons and systems into a section per licence, unlicensed first, each by rank', () => {
    const groups = archiveGroups(entries.filter(entry => entry.category === 'mech weapons'), content.manufacturers)
    const gms = groups.find(group => group.key === 'GMS')!
    expect(gms.sections.map(section => section.licence)).toEqual([''])
    const horus = groups.find(group => group.key === 'HORUS')!
    const licences = horus.sections.map(section => section.licence)
    expect(licences).toContain('Goblin')
    expect(licences).toEqual([...licences].sort((a, b) => Number(Boolean(a)) - Number(Boolean(b)) || a.localeCompare(b)))
    for (const section of horus.sections) {
      expect(section.entries.every(entry => entry.licence === section.licence)).toBe(true)
      expect(section.entries.map(entry => entry.level)).toEqual(section.entries.map(entry => entry.level).sort())
    }
    // Frames, and search results across every category, have one section each.
    expect(archiveGroups(entries.filter(entry => entry.category === 'frames'), content.manufacturers).every(group => group.sections.length === 1)).toBe(true)
    const ranked = archiveGroups(searchArchive(entries.filter(entry => entry.category === 'mech systems'), 'drone'), content.manufacturers, true)
    expect(ranked.every(group => group.sections.length === 1)).toBe(true)
  })

  it('filters by known manufacturers only, leaving gear and talents alone', () => {
    expect(parseMakers('GMS,IPS-N,NOPE', content.manufacturers)).toEqual(['GMS', 'IPS-N'])
    expect(parseMakers(undefined, content.manufacturers)).toEqual([])
    expect(filterByMakers(entries, [])).toBe(entries)
    const filtered = filterByMakers(entries, ['SSC'])
    expect(filtered.filter(entry => entry.category === 'frames').every(entry => entry.group === 'SSC')).toBe(true)
    expect(filtered.filter(entry => entry.category === 'talents')).toHaveLength(content.talents.length)
  })

  it('reads a link to one entry', () => {
    expect(parseItem('licences:mf_goblin')).toEqual({ category: 'licences', id: 'mf_goblin' })
    expect(parseItem('mech weapons:a:b')).toEqual({ category: 'mech weapons', id: 'a:b' })
    expect(parseItem('nonsense:mf_goblin')).toBeNull()
    expect(parseItem('frames:')).toBeNull()
    expect(parseItem(undefined)).toBeNull()
  })

  it('handles LCP manufacturers with no logo, and refuses a colour that is not a plain hex value', () => {
    const homebrew: Manufacturer = { id: 'NEW', name: 'New Corp', quote: '', description: '', colour: '#123abc' }
    expect(makerColour(homebrew)).toBe('#123abc')
    expect(makerLogo(homebrew)).toBeNull()
    expect(makerLogo({ ...homebrew, logo: 'not-bundled' })).toBeNull()
    expect(makerColour({ ...homebrew, colour: 'red; background: url(x)' })).toBe('var(--lilac)')
    expect(makerColour(undefined)).toBe('var(--lilac)')
    const entry = { category: 'frames', id: 'x', name: 'X', group: 'NEW', level: 0, licence: '', summary: '', search: '', info: entries[0].info } as const
    expect(archiveGroups([entry], [homebrew])[0]).toMatchObject({ title: 'NEW', colour: '#123abc', logo: null })
  })

  it('gives each list row one or two key facts', () => {
    const facts = (category: string, name: string) => listFacts(entries.find(entry => entry.category === category && entry.name === name)!)
    expect(facts('mech weapons', 'Autopod')).toEqual(['Rank I', 'Main Launcher'])
    expect(facts('mech systems', 'Pattern-A Smoke Charges')).toEqual(['2 SP'])
    expect(facts('frames', 'Goblin')).toEqual(['Controller / Support'])
    expect(facts('licences', 'Goblin')).toEqual(['Controller / Support'])
    expect(listFacts(entries.find(entry => entry.category === 'manufacturers' && entry.id === 'IPS-N')!)).toEqual(['IPS-N'])
    expect(facts('talents', 'Ace')).toEqual([])
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
