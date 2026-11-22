import { OVERCHARGE_HEAT } from './combatRules'
import { equippedGear, LOADOUT, type Item } from './gameData'
import { cardRules, itemDetails, type ItemRule, type ItemStat } from './itemDetails'
import { EFFECT_KINDS, fittedMods, mechEffects, mechResources, mechStats, mountSize, type EffectCatalogue, type Frame, type ReminderKind } from './mechData'
import type { MechPrivate, Sheet } from './myPilot'
import { equipmentDetails } from './equipment'
import { bracingMount } from './rules'
import { capitalise } from './text'

// What a pilot can use in a fight, for the combat guide's "Your loadout": the chosen mech's weapons and systems, the
// frame, talents and core bonuses that act or remind, and the pilot's gear. Everything is read through the same pure
// functions as the mech page. "sizes" and "tagIds" say which weapon sizes and tags the guide still needs to explain.
export type LoadoutBlock = 'weapons' | 'systems' | 'frame' | 'talents' | 'core-bonuses' | 'gear'
export type LoadoutRow = {
  block: LoadoutBlock
  label?: string
  kind?: ReminderKind // reminder rows only: lets the Frame card group by kind
  name: string
  activation?: string
  stats: ItemStat[]
  tags: string[]
  html: string
  rules: ItemRule[]
  mods: { name: string; html: string; tags: string[]; item: Item }[]
  item?: Item
  mount?: { index: number | null; type: string } // weapons rows only: null index means built in
  slot?: 'Armor' | 'Weapon' | 'Gear' // gear rows only: the item's type
}

const BLOCK_OF: Partial<Record<string, LoadoutBlock>> = { frame: 'frame', trait: 'frame', core: 'frame', 'core-power': 'frame', talent: 'talents', 'core-bonus': 'core-bonuses' }

export function combatLoadout(details: MechPrivate, sheet: Sheet, catalogue: EffectCatalogue, tagNames: Map<string, string>) {
  const effects = mechEffects(details, sheet, catalogue)
  const frame: Frame | null = effects.frame
  const resources = mechResources(sheet, effects)
  const rows: LoadoutRow[] = []
  const tagIds = new Set<string>()
  const sizes = new Set<string>()
  const needs = (activation?: string) => {
    const word = activation?.toLowerCase()
    if (word === 'protocol' || word === 'reaction') tagIds.add(`tg_${word}`)
  }
  const keep = (stats: ItemStat[], kinds: string[]) => stats.filter(stat => stat.kind && kinds.includes(stat.kind))
  const itemRow = (block: LoadoutBlock, item: Item, label: string | undefined, kinds: string[]): LoadoutRow => {
    const { stats, tags, text } = itemDetails(item, tagNames)
    const rules = cardRules(item)
    // Gear shows only in Pilot mode, where the Tags card is hidden, so it must not drive the tag list.
    if (block !== 'gear') {
      item.tags.forEach(tag => tagIds.add(tag.id))
      rules.forEach(rule => needs(rule.activation))
    }
    return { block, label, name: item.name, stats: keep(stats, kinds), tags, html: text, rules, mods: [], item }
  }

  if (frame) {
    const mods = new Map(fittedMods(details, frame))
    const weapon = (id: string, key: string, builtIn = false) => {
      const m = builtIn ? null : Number(key.split(':')[0])
      const base = catalogueItem(catalogue.weapons, catalogue, id)
      if (!base) return
      // Applies the chosen profile, Variable damage type and Prototype choices. No bonuses: this page shows base values.
      const item: Item = equipmentDetails(base, sheet, [], details.weapon_options?.[key] ?? { profile: 0 })
      // A built-in item can be a system too (no mount size).
      const row = item.mount ? itemRow('weapons', item, `${builtIn ? 'Integrated · ' : ''}${item.mount} ${item.type}`, ['range', 'damage']) : itemRow('systems', item, builtIn ? 'Integrated' : undefined, ['range', 'damage'])
      const mod = mods.get(key) && catalogue.mods?.get(mods.get(key)!)
      if (mod) {
        const { tags, text } = itemDetails(mod, tagNames)
        mod.tags.forEach(tag => tagIds.add(tag.id))
        tagIds.add('tg_mod')
        row.mods.push({ name: mod.name, html: text, tags, item: mod })
      }
      if (item.mount) {
        sizes.add(item.mount)
        row.mount = { index: m, type: m === null ? '' : frame.mounts[m] ?? '' }
      }
      rows.push(row)
    }
    for (const id of frame.integrated) weapon(id, `integrated:${id}`, true)
    // Cut to what the frame has, like mechEffects does.
    ;(details.mounts ?? []).slice(0, frame.mounts.length).forEach((places, m) =>
      places.slice(0, mountSize(frame.mounts[m])).forEach((id, i) => id && !frame.integrated.includes(id) && weapon(id, `${m}:${i}`)))
  }
  for (const id of details.systems ?? []) {
    const item = catalogueItem(catalogue.systems, catalogue, id)
    if (item) rows.push(itemRow('systems', item, undefined, ['range', 'damage']))
  }
  const missing: string[] = []
  for (const reminder of effects.reminders) {
    if (reminder.kind === 'missing') missing.push(reminder.name)
    const block = BLOCK_OF[reminder.kind]
    if (!block) continue
    needs(reminder.activation)
    const label = EFFECT_KINDS[reminder.kind].label + (reminder.from && reminder.from !== reminder.name ? `: ${reminder.from}` : '')
    rows.push({ block, label, kind: reminder.kind, name: reminder.name, activation: reminder.activation, stats: [], tags: [], html: reminder.text, rules: [], mods: [] })
  }
  // A frame or talent can change the steps. The general ones are in the guide already.
  if (frame && resources.overcharge !== OVERCHARGE_HEAT.join(' → ')) {
    rows.push({ block: 'frame', kind: 'frame', label: 'Overcharge', name: 'Overcharge Heat', stats: [], tags: [], html: `${resources.overcharge} Heat`, rules: [], mods: [] })
  }
  const gear = new Map((catalogue.gear ?? []).map(item => [item.id, item]))
  for (const owned of equippedGear(sheet)) {
    const item = gear.get(owned.id)
    // "Pilot gear" is the block's own title, so a plain gear item gets no label.
    const slot = item && LOADOUT.find(slot => slot.type === item.type)?.label
    if (item) rows.push({ ...itemRow('gear', owned.damageType ? equipmentDetails(item, sheet, [], { damageType: owned.damageType }) : item, slot && slot.toLowerCase() !== 'pilot gear' ? capitalise(slot) : undefined, ['range', 'damage', 'bonus']), slot: item.type as LoadoutRow['slot'] })
  }
  return { rows, missing, tagIds, sizes, structureRepairs: resources.structureRepairs, frame, overcharge: resources.overcharge, stats: mechStats(frame, sheet.mech_skills, effects.modifiers) }
}

const catalogueItem = (own: Map<string, Item>, catalogue: EffectCatalogue, id: string) => own.get(id) ?? catalogue.integrated.get(id)

// The Frame card's rows in labelled groups, in this order. A group with no rows is left out.
const FRAME_GROUPS = [['trait', 'Traits'], ['core', 'Core system'], ['core-power', 'Core power'], ['frame', 'Overcharge']] as const
export const frameGroups = <T extends { kind?: string }>(rows: T[]) =>
  FRAME_GROUPS.map(([kind, title]) => ({ title, rows: rows.filter(row => row.kind === kind) })).filter(group => group.rows.length)

// The Pilot gear card's rows in labelled groups, in equipped order. Empty groups are left out, an odd slot goes last.
const GEAR_GROUPS = [['Armor', 'Armour'], ['Weapon', 'Weapons'], ['Gear', 'Gear']] as const
export function gearGroups(rows: LoadoutRow[]) {
  const gear = rows.filter(row => row.block === 'gear')
  const known: string[] = GEAR_GROUPS.map(([slot]) => slot)
  return [
    ...GEAR_GROUPS.map(([slot, title]) => ({ title, rows: gear.filter(row => row.slot === slot) })),
    { title: 'Other', rows: gear.filter(row => !row.slot || !known.includes(row.slot)) },
  ].filter(group => group.rows.length)
}

// The Weapons card's rows, one group per mount that holds a weapon, then the built-in ones. A Superheavy weapon's title
// names the empty mount that braces it.
export function weaponGroups(rows: LoadoutRow[], frame: Frame | null) {
  const groups: { title: string; sub?: string; rows: LoadoutRow[] }[] = []
  if (!frame) return groups
  const weapons = rows.filter(row => row.block === 'weapons' && row.mount)
  const held = frame.mounts.map((_, k) => (weapons.some(row => row.mount!.index === k) ? ['x'] : []))
  frame.mounts.forEach((type, k) => {
    const here = weapons.filter(row => row.mount!.index === k)
    if (!here.length) return
    const brace = here.some(row => row.item?.mount === 'Superheavy') ? bracingMount(frame.mounts, held.map((h, j) => (j === k ? h : [])), k) : -1
    groups.push({ title: brace < 0 ? `Mount ${k + 1}` : `Mounts ${Math.min(k, brace) + 1} and ${Math.max(k, brace) + 1}`, sub: type || undefined, rows: here })
  })
  const built = weapons.filter(row => row.mount!.index === null)
  if (built.length) groups.push({ title: 'Integrated', rows: built })
  return groups
}
