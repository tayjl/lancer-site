import { supabase } from './lib/supabaseClient'
import type { CoreBonus, Item, Talent } from './gameData'
import { coreBonusInfo, frameInfo, itemInfo, licenceInfo, manufacturerInfo, talentInfo, type Info, type Manufacturer } from './info'
import type { Frame } from './mechData'
import { licenceName, rankName } from './rules'
import { plainText } from './rulesText'

// The archives page (ArchivesView.vue): every manufacturer, licence, core bonus, frame, mech weapon, mech system,
// pilot gear and talent in the loaded packs, each opening its full information, with one search across all of them.
export const ARCHIVE_CATEGORIES = ['manufacturers', 'licences', 'core bonuses', 'frames', 'mech weapons', 'mech systems', 'pilot gear', 'talents'] as const
export type ArchiveCategory = (typeof ARCHIVE_CATEGORIES)[number]
// "search" is everything the search looks through: name, facts, group and rules text, lower case. "group" is what the
// entry is listed under: its manufacturer's id (or "other"), a pilot gear type, or "" for no grouping (talents).
// "level" is its licence level (0 for GMS and anything unlicensed), which orders it within its group.
export type ArchiveEntry = { category: ArchiveCategory; id: string; name: string; meta: string; group: string; level: number; search: string; info: () => Info }

export type ArchiveContent = {
  manufacturers: Manufacturer[]
  frames: Frame[]
  weapons: Item[]
  systems: Item[]
  gear: Item[]
  talents: Talent[]
  coreBonuses: CoreBonus[]
}

const entry = (category: ArchiveCategory, group: string, id: string, name: string, meta: string, text: string[], info: () => Info, level = 0): ArchiveEntry => ({
  category,
  id,
  name,
  meta,
  group,
  level,
  search: [name, meta, group, ...text.map(plainText)].join(' ').toLowerCase(),
  info,
})
const sourceOf = (item: Item) => String(item.raw?.source ?? '') || 'other'

export function archiveEntries(content: ArchiveContent): ArchiveEntry[] {
  const { manufacturers, frames, weapons, systems, gear, talents, coreBonuses } = content
  const licence = (item: { licenceId: string; licenceLevel: number }) =>
    item.licenceLevel > 0 ? `${licenceName(frames, item.licenceId)} ${rankName(item.licenceLevel)}` : 'gms'
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ').toLowerCase()
  return [
    ...manufacturers.map((m) => entry('manufacturers', m.id, m.id, m.name, m.id !== m.name ? m.id : '', [m.description, m.quote], () => manufacturerInfo(m, frames))),
    ...frames.filter((f) => f.licenceLevel > 0).map((f) =>
      entry('licences', f.source || 'other', f.id, f.name, join(f.mechtype.join(' / ')), [], () => licenceInfo(f, weapons, systems), f.licenceLevel)),
    ...coreBonuses.map((b) => entry('core bonuses', b.source || 'other', b.id, b.name, '', [b.effect], () => coreBonusInfo(b))),
    ...frames.map((f) =>
      entry('frames', f.source || 'other', f.id, f.name, join(f.mechtype.join(' / '), f.licenceLevel ? `licence ${rankName(f.licenceLevel)}` : 'gms'), [f.description], () => frameInfo(f, frames), f.licenceLevel)),
    ...weapons.map((w) => entry('mech weapons', sourceOf(w), w.id, w.name, join(`${w.mount} ${w.type}`, licence(w)), [w.effect, w.description], () => itemInfo(w), w.licenceLevel)),
    ...systems.map((s) => entry('mech systems', sourceOf(s), s.id, s.name, join(s.type || 'system', s.sp ? `${s.sp} sp` : '', licence(s)), [s.effect, s.description], () => itemInfo(s), s.licenceLevel)),
    ...gear.map((g) => entry('pilot gear', g.type, g.id, g.name, '', [g.effect, g.description], () => itemInfo(g))),
    ...talents.map((t) => entry('talents', '', t.id, t.name, t.terse, t.ranks.flatMap((r) => [r.name, r.description]), () => talentInfo(t))),
  ]
}

// A manufacturer's accent colour, if it's a plain hex colour (it comes from imported packs); otherwise lilac.
export const makerColour = (maker?: Manufacturer) =>
  maker?.colour && /^#[0-9a-f]{3,8}$/i.test(maker.colour) ? maker.colour : 'var(--lilac)'

// Massif's manufacturer logos (from COMP/CON, GPL-3.0; cleaned down to their shapes), by the packs' "logo" name.
// Single-colour shapes, drawn in the manufacturer's colour with StatIcon.vue. Homebrew manufacturers have none.
const LOGOS = import.meta.glob('./assets/logos/*.svg', { eager: true, import: 'default' }) as Record<string, string>
export const makerLogo = (maker?: Manufacturer) => (maker?.logo ? LOGOS[`./assets/logos/${maker.logo}.svg`] : undefined) ?? null

// How a category's entries are listed: one group per manufacturer (in the manufacturers' order, then any unknown
// sources, then "other"), per pilot gear type, or a single untitled group (talents). Each with its accent colour.
// Within a group, entries go by licence level (unlicensed first, then I, II, III), keeping their order otherwise.
export type ArchiveGroup = { key: string; title: string; colour: string; logo: string | null; entries: ArchiveEntry[] }
const GEAR_TYPES: Record<string, string> = { Armor: 'pilot armour', Weapon: 'pilot weapons', Gear: 'pilot gear' }
export function archiveGroups(entries: ArchiveEntry[], manufacturers: Manufacturer[]): ArchiveGroup[] {
  const makers = new Map(manufacturers.map((m) => [m.id, m]))
  const order = [...manufacturers.map((m) => m.id), ...Object.keys(GEAR_TYPES)]
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : key === 'other' ? order.length + 1 : order.length)
  const groups = new Map<string, ArchiveEntry[]>()
  for (const entry of [...entries].sort((a, b) => a.level - b.level)) groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry])
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([key, list]) => {
      const maker = makers.get(key)
      return { key, title: maker ? maker.id : GEAR_TYPES[key] ?? key, colour: makerColour(maker), logo: makerLogo(maker), entries: list }
    })
}

// Every word must appear somewhere in the entry (name, facts or rules), in any order.
export function searchArchive(entries: ArchiveEntry[], query: string): ArchiveEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return words.length ? entries.filter((e) => words.every((word) => e.search.includes(word))) : []
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
