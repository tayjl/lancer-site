import { shallowRef } from 'vue'
import { supabase } from './lib/supabaseClient'
import type { CoreBonus, Item, Talent } from './gameData'
import { averageDamageText } from './damage'
import { coreBonusInfo, frameInfo, itemInfo, licenceInfo, manufacturerInfo, talentInfo, type Info, type Manufacturer } from './info'
import { itemDetails } from './itemDetails'
import type { Frame } from './mechData'
import { licenceName, rankName } from './rules'
import { plainText } from './rulesText'

// The archives page (ArchivesView.vue): every manufacturer, licence, core bonus, frame, mech weapon, mech system,
// pilot gear and talent in the loaded packs, each opening its full information, with one search across all of them.
export const ARCHIVE_CATEGORIES = ['manufacturers', 'licences', 'core bonuses', 'frames', 'mech weapons', 'mech systems', 'pilot gear', 'talents'] as const
export type ArchiveCategory = (typeof ARCHIVE_CATEGORIES)[number]
// "search" is everything the search looks through: name, facts, group and rules text, lower case. "group" is what the
// entry is listed under: its manufacturer's id (or "other"), a pilot gear type, or "" for no grouping (talents).
// "level" is its licence level (0 for GMS and anything unlicensed), which orders it within its group, and "licence"
// the licence's name (a frame's, e.g. "Barbarossa"; "" when unlicensed) for weapons and systems.
// "item" (weapons, systems, gear) or "frame" (frames, licences) is what its row's facts come from (listFacts);
// "summary" (a one-line plain effect, terse or motto) is searched too.
export type ArchiveEntry = {
  category: ArchiveCategory
  id: string
  name: string
  group: string
  level: number
  licence: string
  item?: Item
  frame?: Frame
  summary: string
  search: string
  info: () => Info
}

export type ArchiveContent = {
  manufacturers: Manufacturer[]
  frames: Frame[]
  weapons: Item[]
  systems: Item[]
  gear: Item[]
  talents: Talent[]
  coreBonuses: CoreBonus[]
}

// "facts" and "text" are only searched (facts such as "main rifle" or "IPS-N Blackbeard"; text is rules HTML).
const entry = (
  fields: Pick<ArchiveEntry, 'category' | 'group' | 'id' | 'name' | 'info'> & Partial<ArchiveEntry>,
  facts: string[],
  text: string[],
): ArchiveEntry => ({
  level: 0,
  licence: '',
  summary: '',
  ...fields,
  search: [fields.name, ...facts, fields.group, fields.summary ?? '', ...text.map(plainText)].join(' ').toLowerCase(),
})
const sourceOf = (item: Item) => String(item.raw?.source ?? '') || 'other'
// An item's rules on one line (pilot gear without rules falls back to its description, as on its card). Many
// systems have no effect text, only actions or deployables: then the first action's, else deployable's, detail.
const firstDetail = (list: unknown) =>
  String((Array.isArray(list) ? (list as { detail?: unknown }[]).find((entry) => entry?.detail)?.detail : '') ?? '')
const summaryOf = (item: Item) =>
  plainText(itemDetails(item, new Map()).text) || plainText(averageDamageText(firstDetail(item.raw?.actions) || firstDetail(item.raw?.deployables)))

export function archiveEntries(content: ArchiveContent): ArchiveEntry[] {
  const { manufacturers, frames, weapons, systems, gear, talents, coreBonuses } = content
  const item = (category: ArchiveCategory, i: Item, group = sourceOf(i)) =>
    entry(
      {
        category, group, id: i.id, name: i.name, level: i.licenceLevel, item: i, summary: summaryOf(i), info: () => itemInfo(i),
        licence: i.licenceLevel > 0 ? frames.find((f) => f.id === i.licenceId)?.name ?? i.licenceId : '',
      },
      [`${i.mount} ${i.type}`, i.licenceLevel > 0 ? licenceName(frames, i.licenceId) : ''],
      [i.effect, i.description],
    )
  return [
    ...manufacturers.map((m) =>
      entry({ category: 'manufacturers', group: m.id, id: m.id, name: m.name, summary: plainText(m.quote), info: () => manufacturerInfo(m, frames) }, [], [m.description])),
    ...frames.filter((f) => f.licenceLevel > 0).map((f) =>
      entry(
        {
          category: 'licences', group: f.source || 'other', id: f.id, name: f.name, level: f.licenceLevel, frame: f, info: () => licenceInfo(f, weapons, systems),
        },
        f.mechtype,
        [],
      )),
    ...coreBonuses.map((b) =>
      entry({ category: 'core bonuses', group: b.source || 'other', id: b.id, name: b.name, summary: plainText(b.effect), info: () => coreBonusInfo(b) }, [], [b.effect])),
    ...frames.map((f) =>
      entry({ category: 'frames', group: f.source || 'other', id: f.id, name: f.name, level: f.licenceLevel, frame: f, info: () => frameInfo(f, frames) }, f.mechtype, [f.description])),
    ...weapons.map((w) => item('mech weapons', w)),
    ...systems.map((s) => item('mech systems', s)),
    ...gear.map((g) => item('pilot gear', g, g.type)),
    ...talents.map((t) =>
      entry({ category: 'talents', group: '', id: t.id, name: t.name, summary: t.terse, info: () => talentInfo(t) }, [], t.ranks.flatMap((r) => [r.name, r.description]))),
  ]
}

// The one or two key facts a row in the archives' list shows after the name (its full information is in the detail
// pane): a weapon's rank and mount and type, a system's rank and system points, a frame's or licence's role, a
// manufacturer's code. Nothing for the rest: their group (maker, gear type) already says enough.
export function listFacts(entry: ArchiveEntry): string[] {
  const { item, frame } = entry
  const rank = entry.level ? `Rank ${rankName(entry.level)}` : ''
  const facts =
    entry.category === 'mech weapons' && item ? [rank, `${item.mount} ${item.type}`.trim()]
    : entry.category === 'mech systems' && item ? [rank, item.sp ? `${item.sp} SP` : '']
    : frame ? [frame.mechtype.join(' / ')]
    : entry.category === 'manufacturers' && entry.id !== entry.name ? [entry.id]
    : []
  return facts.filter(Boolean)
}

// A manufacturer's accent colour, if it's a plain hex colour (it comes from imported packs); otherwise lilac.
export const makerColour = (maker?: Manufacturer) =>
  maker?.colour && /^#[0-9a-f]{3,8}$/i.test(maker.colour) ? maker.colour : 'var(--lilac)'

// Massif's manufacturer logos (from COMP/CON, GPL-3.0; cleaned down to their shapes), by the packs' "logo" name.
// Single-colour shapes, drawn in the manufacturer's colour with Icon.vue. Homebrew manufacturers have none.
const LOGOS = import.meta.glob('./assets/logos/*.svg', { eager: true, import: 'default' }) as Record<string, string>
export const makerLogo = (maker?: Manufacturer) => (maker?.logo ? LOGOS[`./assets/logos/${maker.logo}.svg`] : undefined) ?? null

// How a category's entries are listed: one group per manufacturer (in the manufacturers' order, then any unknown
// sources, then "other"), per pilot gear type, or a single untitled group (talents). Each with its accent colour.
// Within a group, entries go by licence level (unlicensed first, then I, II, III), keeping their order otherwise.
// Weapons and systems are split into a section per licence (unlicensed, "", first, then by name); everything else
// has one section. "ranked" (search results across every category) keeps the entries' order instead: groups go
// by their best match, with one section each.
export type ArchiveSection = { licence: string; entries: ArchiveEntry[] }
export type ArchiveGroup = { key: string; title: string; colour: string; logo: string | null; entries: ArchiveEntry[]; sections: ArchiveSection[] }
const GEAR_TYPES: Record<string, string> = { Armor: 'pilot armour', Weapon: 'pilot weapons', Gear: 'pilot gear' }
const BY_LICENCE: ArchiveCategory[] = ['mech weapons', 'mech systems']
const grouped = <T>(list: T[], keyOf: (item: T) => string) => {
  const groups = new Map<string, T[]>()
  for (const item of list) groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item])
  return [...groups]
}
export function archiveGroups(entries: ArchiveEntry[], manufacturers: Manufacturer[], ranked = false): ArchiveGroup[] {
  const makers = new Map(manufacturers.map((m) => [m.id, m]))
  const order = [...manufacturers.map((m) => m.id), ...Object.keys(GEAR_TYPES)]
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : key === 'other' ? order.length + 1 : order.length)
  const groups = grouped(ranked ? entries : [...entries].sort((a, b) => a.level - b.level), (entry) => entry.group)
  if (!ranked) groups.sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
  return groups.map(([key, list]) => {
    const maker = makers.get(key)
    const sections = grouped(list, (entry) => (!ranked && BY_LICENCE.includes(entry.category) ? entry.licence : ''))
      .sort(([a], [b]) => Number(Boolean(a)) - Number(Boolean(b)) || a.localeCompare(b))
      .map(([licence, entries]) => ({ licence, entries }))
    return { key, title: maker ? maker.id : GEAR_TYPES[key] ?? key, colour: makerColour(maker), logo: makerLogo(maker), entries: list, sections }
  })
}

// Every word must appear somewhere in the entry (name, facts or rules), in any order. Best matches first: the
// exact name, then names starting with the search, then names containing it (or every word), then the rest.
export function searchArchive(entries: ArchiveEntry[], query: string): ArchiveEntry[] {
  const search = query.trim().toLowerCase()
  const words = search.split(/\s+/).filter(Boolean)
  const score = (name: string) =>
    name === search ? 0 : name.startsWith(search) ? 1 : name.includes(search) || words.every((word) => name.includes(word)) ? 2 : 3
  return words.length
    ? entries
        .filter((e) => words.every((word) => e.search.includes(word)))
        .map((e) => ({ e, score: score(e.name.toLowerCase()) }))
        .sort((a, b) => a.score - b.score)
        .map(({ e }) => e)
    : []
}

// The manufacturer filter (?maker=GMS,IPS-N): known manufacturers' ids only, so a stale or made-up id does nothing.
// Pilot gear and talents have no manufacturer, so the filter leaves them alone.
export const MAKER_CATEGORIES: ArchiveCategory[] = ['manufacturers', 'licences', 'core bonuses', 'frames', 'mech weapons', 'mech systems']
export const parseMakers = (value: unknown, manufacturers: Manufacturer[]) =>
  String(value ?? '').split(',').filter((id) => manufacturers.some((m) => m.id === id))
export const filterByMakers = (entries: ArchiveEntry[], makers: string[]) =>
  makers.length ? entries.filter((e) => !MAKER_CATEGORIES.includes(e.category) || makers.includes(e.group)) : entries

// A link to one entry (?item=frames:mf_goblin). The category is needed: a licence and its frame share an id.
export function parseItem(value: unknown): { category: ArchiveCategory; id: string } | null {
  const [category, ...rest] = String(value ?? '').split(':')
  const known = ARCHIVE_CATEGORIES.find((cat) => cat === category)
  const id = rest.join(':')
  return known && id ? { category: known, id } : null
}

// The manufacturers in the loaded packs, for anything styled by corporation. Empty until they arrive (or if they
// can't load), which just leaves pages in their neutral lilac.
export function useManufacturers() {
  const manufacturers = shallowRef<Manufacturer[]>([])
  loadManufacturers().then((list) => (manufacturers.value = list))
  return manufacturers
}

export async function loadManufacturers(): Promise<Manufacturer[]> {
  const { data } = await supabase.from('content_items').select('id, data').eq('kind', 'manufacturers')
  return (data ?? [])
    .map(({ id, data }) => {
      const m = (data ?? {}) as Partial<Manufacturer>
      const extra = m as { dark?: unknown; logo?: unknown }
      return { id, name: String(m.name ?? id), quote: String(m.quote ?? ''), description: String(m.description ?? ''), colour: String(extra.dark ?? ''), logo: String(extra.logo ?? '') }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
