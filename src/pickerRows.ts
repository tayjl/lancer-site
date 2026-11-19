import { makerColour, makerLogo } from './archive'
import type { Bonus, Item } from './gameData'
import type { Info, Manufacturer } from './info'
import { itemCard, itemDetails, tagLabel, visibleTags, type CardType, type ItemStat } from './itemDetails'
import { rankName } from './rules'
import { mechStats, type Frame } from './mechData'
import { plainText } from './rulesText'

// What a picker row shows (ItemPicker.vue, PickList.vue): the name, then a strip of symbols with mono numbers and a few
// chips specific to the kind, and a button. The long text lives in the full information (the name opens it); it's only
// searched ("search"). Items with a manufacturer are listed in a box per manufacturer, like the archives.
export type PickChip = { label: string; icon?: string }
export type PickGroup = { key: string; title: string; name?: string; colour: string; logo: string | null; order: number }
export type PickOption = {
  id: string | number
  name: string
  // A dim line (clipped to one line) and extra search text; the lore pickers use these.
  meta?: string | string[]
  text?: string
  search?: string
  blocked?: string
  picked?: boolean
  info?: () => Info
  // The symbol before the name, on its --type-* colour.
  look?: { type: CardType; icon: string }
  stats?: ItemStat[]
  chips?: PickChip[]
  // A tiny radar of a frame's stats, in place of the symbol.
  radar?: { label: string; value: string; at: number }[]
  group?: PickGroup
}

// Everything a kind adds to an option besides its id and name.
export type PickExtras = Partial<Omit<PickOption, 'id' | 'name'>>

// A manufacturer's box: its id as the title, its name beside it, its colour and logo (only the logo and the border use it).
// Unknown ids are listed after the known ones, "other" last.
export function makerGroup(id: string | null | undefined, manufacturers: Manufacturer[]): PickGroup {
  const key = id?.trim() || 'other'
  const index = manufacturers.findIndex((m) => m.id === key)
  const maker = manufacturers[index]
  return {
    key,
    title: maker ? maker.id : key === 'other' ? 'Other' : key,
    name: maker && maker.name !== maker.id ? maker.name : undefined,
    // Lilac means "you can click this", so a box with no colour of its own gets the neutral rule colour.
    colour: maker && makerColour(maker) !== 'var(--lilac)' ? makerColour(maker) : 'var(--rule)',
    logo: makerLogo(maker),
    order: index >= 0 ? index : key === 'other' ? manufacturers.length + 1 : manufacturers.length,
  }
}

// The options in boxes: ungrouped ones first, then a box per manufacturer. Inside a box the ones that can be chosen come
// first (the current one counts as choosable); a box with nothing choosable (HORUS, NHC and Exotic for a player) goes
// after the boxes that have something, otherwise manufacturers keep their order.
export function groupPicks(options: PickOption[], current?: string | number | null) {
  const boxes = new Map<string, { group?: PickGroup; options: PickOption[] }>()
  for (const option of options) {
    const key = option.group?.key ?? ''
    if (!boxes.has(key)) boxes.set(key, { group: option.group, options: [] })
    boxes.get(key)!.options.push(option)
  }
  const blocked = (option: PickOption) => !!option.blocked && option.id !== current
  const list = [...boxes.values()]
  for (const box of list) box.options.sort((a, b) => Number(blocked(a)) - Number(blocked(b)))
  const dead = (box: { options: PickOption[] }) => box.options.every(blocked)
  return list.sort((a, b) => Number(!!a.group) - Number(!!b.group) || Number(dead(a)) - Number(dead(b)) || (a.group?.order ?? 0) - (b.group?.order ?? 0))
}

// The tags worth a chip on a row, in this order, at most "limit" of them.
const KEY_TAGS = ['tg_unique', 'tg_ai', 'tg_limited', 'tg_loading', 'tg_ap', 'tg_ordnance', 'tg_overkill', 'tg_reliable', 'tg_seeking', 'tg_smart', 'tg_accurate', 'tg_inaccurate', 'tg_heat_self', 'tg_danger_zone', 'tg_knockback']
export function keyTags(item: Item, tagNames: Map<string, string>, limit = 3): PickChip[] {
  const rank = (id: string) => (KEY_TAGS.includes(id) ? KEY_TAGS.indexOf(id) : KEY_TAGS.length)
  return [...visibleTags(item)]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .slice(0, limit)
    .map((tag) => ({ label: tagLabel(tag, tagNames) }))
}

const sourceOf = (item: Item) => String(item.raw?.source ?? '') || 'other'

// A weapon, system, mod or piece of pilot gear. Weapons: mount and type, range and damage, SP, key tags. Systems: type,
// SP, key tags. Mods: what they fit, SP. Pilot armour: its bonuses; pilot gear: its tags. Pilot gear sits in no box.
export function itemPick(item: Item, tagNames: Map<string, string>, manufacturers: Manufacturer[]): PickExtras {
  const details = itemDetails(item, tagNames)
  const look = itemCard(item)
  const pilot = look.type === 'pilot' || (item.type === 'Weapon' && !item.mount)
  const types = Array.isArray(item.raw?.allowed_types) ? (item.raw.allowed_types as string[]) : []
  const chips: PickChip[] =
    item.type === 'Mod' ? [...types.slice(0, 3).map((label) => ({ label })), ...(types.length > 3 ? [{ label: `+${types.length - 3}` }] : []), ...(types.length ? [] : [{ label: 'Any weapon' }])]
    : item.mount ? [{ label: `${item.mount} ${item.type}`.trim() }]
    : !pilot && item.type && item.type !== 'System' ? [{ label: item.type }]
    : []
  return {
    look,
    // Pilot armour's bonuses are its numbers; a mech item's bonuses are conditional and live in its rules.
    stats: details.stats.filter((stat) => pilot || stat.kind !== 'bonus'),
    chips: [...(item.licenceLevel > 0 ? [{ label: `Rank ${rankName(item.licenceLevel)}`, icon: 'license' }] : []), ...chips, ...keyTags(item, tagNames, item.mount ? 2 : 3)],
    group: pilot ? undefined : makerGroup(sourceOf(item), manufacturers),
    search: [...details.tags, plainText(details.text), item.type, item.mount, item.licenceLevel ? item.licenceId : '', sourceOf(item)].join(' '),
  }
}

// --- Frames and licences ---
// A frame's key stats in a row, and the radar axes (each between the lowest and highest any frame has, as in its
// full information).
const STRIP = ['size', 'hp', 'evasion', 'edef', 'speed', 'armour', 'heat', 'system_points']
const AXES = ['hp', 'evasion', 'edef', 'speed', 'heat', 'system_points']
const half = (value: number | null) => (value === 0.5 ? '½' : String(value ?? '-'))

export function frameRanges(frames: Frame[]) {
  const ranges = new Map<string, { min: number; max: number }>()
  for (const frame of frames)
    for (const stat of mechStats(frame, undefined, []))
      if (typeof stat.value === 'number') {
        const range = ranges.get(stat.id)
        ranges.set(stat.id, { min: Math.min(range?.min ?? stat.value, stat.value), max: Math.max(range?.max ?? stat.value, stat.value) })
      }
  return ranges
}

// "rank": whether to show the licence rank that unlocks the frame (the frame picker does; a licence is bought at rank I).
export function framePick(frame: Frame, ranges: Map<string, { min: number; max: number }>, manufacturers: Manufacturer[], rank = true): PickExtras {
  const stats = mechStats(frame, undefined, [])
  const stat = (id: string) => stats.find((entry) => entry.id === id)!
  const at = (id: string) => {
    const range = ranges.get(id)
    return range && range.max > range.min ? (Number(stat(id).value) - range.min) / (range.max - range.min) : 0.5
  }
  return {
    look: { type: 'frame', icon: 'frame' },
    stats: STRIP.map((id) => ({ kind: 'frame', label: stat(id).name, icon: stat(id).icon, value: half(stat(id).value) })),
    chips: [...(rank && frame.licenceLevel > 0 ? [{ label: `Rank ${rankName(frame.licenceLevel)}`, icon: 'license' }] : []), ...frame.mechtype.map((label) => ({ label })), ...frame.mounts.map((label) => ({ label, icon: 'weapon' }))],
    radar: AXES.map((id) => ({ label: stat(id).name, value: half(stat(id).value), at: at(id) })),
    group: makerGroup(frame.source, manufacturers),
    search: [frame.source, ...frame.mechtype, ...frame.mounts, frame.description].join(' '),
  }
}

// --- Core bonuses ---
// Permanent numbers a core bonus adds, by the stat's own symbol (conditional or non-numeric ones stay in its rules).
const BONUS_STATS: Record<string, string> = { hp: 'hp', armor: 'armour', edef: 'edef', evasion: 'evasion', speed: 'speed', heatcap: 'heat', sp: 'system_points', tech_attack: 'tech_attack', repcap: 'repair', structure: 'structure', stress: 'stress' }
export function bonusStats(bonuses: Bonus[] = []): ItemStat[] {
  const stats = mechStats(null, undefined, [])
  return bonuses.flatMap((bonus) => {
    const stat = stats.find((entry) => entry.id === BONUS_STATS[bonus.id])
    const value = Number(bonus.val)
    return stat && typeof bonus.val !== 'object' && Number.isFinite(value) && value !== 0 && !bonus.condition && !bonus.detail && !bonus.replace
      ? [{ kind: 'bonus', label: stat.name, icon: stat.icon, value: `${value > 0 ? '+' : ''}${value}` }]
      : []
  })
}
