import { computed } from 'vue'
import { equippedGear, loadoutSlots, pilotBonuses, requirementsOf, useGameData, type Bionic, type CoreBonus, type Item, type Talent } from './gameData'
import { allowedSizes, alternateOf, chosenFrame, fittedMods, grantingSources, idList, mechEffects, mechStats, mountReplacements, mountSize, talentGrants, useMechData, weaponAt, type Frame } from './mechData'
import { DAMAGE_CHOICES, modBlockedBy, variableDamage } from './equipment'
import { bonusValue, resolveBonuses } from './bonuses'
import type { MechPrivate, OwnedGear, Sheet } from './myPilot'
import { capitalise } from './text'
import { rule } from './rulesData'

// LANCER's character rules with this campaign's homebrew, as plain functions the pages use to block choices
// and to list what's wrong. docs/lancer-rules.md lists every rule, what's enforced and what's left to GMs.
//
// Homebrew: a pilot's "level" is gained narratively (GMs set it) and gives HASE points and biomod capacity.
// Everything else is bought with manna: licence ranks, biomods (bionics) and talent ranks. Licence level is
// just the number of licence ranks bought. Gear is free to print once licensed (GMS gear always is), and
// every 3 licence ranks bought give one core bonus for free.

// Balance numbers owners can edit (rulesData.ts NUMBER_KEYS), so these are functions: read them where they are used.
export const maxLicenceRank = () => rule('max_licence_rank')
export const maxTalentRank = () => rule('max_talent_rank')
export const MAX_SKILL = 6
export const personalStatMin = () => rule('personal_stat_min')
export const personalStatMax = () => rule('personal_stat_max')
export const personalStatPoints = () => rule('personal_stat_points')

// Only increases above the base cost points; biomods are applied separately.
export const personalPoints = (values: Record<string, number> = {}) =>
  Object.values(values).reduce((total, value) => total + (Number.isFinite(value) ? Math.max(0, value - personalStatMin()) : 0), 0)

export function personalStatProblems(values: Record<string, number> = {}): string[] {
  const problems: string[] = []
  for (const [id, value] of Object.entries(values))
    if (!Number.isInteger(value) || value < personalStatMin() || value > personalStatMax())
      problems.push(`${capitalise(id.replaceAll('_', '-'))} must be a whole number from ${personalStatMin()} to ${personalStatMax()}.`)
  const used = personalPoints(values)
  if (used > personalStatPoints()) problems.push(`Personal stats use ${used} points, but only ${personalStatPoints()} are available.`)
  return problems
}

// Manna and other big numbers with thousands separators ("2,900").
export const formatAmount = (n: number) => n.toLocaleString('en-GB')

// Manna prices. A pilot's first mech is free; each one after it costs "extraMech".
// The database reads the same editable numbers (public.rule_number, migration 20261122120000) when it refuses an overspend.
export const PRICES = {
  get licenceRank() { return rule('licence_rank_price') },
  get talentRank() { return rule('talent_rank_price') },
  get extraMech() { return rule('extra_mech_price') },
}
// New pilots start with this much manna received (the column's default).
export const startingManna = () => rule('starting_manna')
// What the next mech costs, given how many the pilot has.
export const nextMechPrice = (mechs: number) => (mechs > 0 ? PRICES.extraMech : 0)

// Content only GMs and owners hand out (docs/lancer-rules.md). Two kinds:
// - HORUS and NHC: blocked for players in every picker, free for GMs and owners anywhere ("GM only"). Matched by name,
//   ignoring case, because NHC content comes from packs imported on the live site, not from this repo.
// - Exotic (isExotic): selectable only in a GM's edit mode, even for GMs and owners on their own pilots ("GM edit only").
export const GM_ONLY_NAMES = ['HORUS', 'NHC']
export const GM_ONLY_REASON = 'GM only'
export const EXOTIC_REASON = 'GM edit only'
// The Exotic pseudo-manufacturer (a code constant, not a content row) and the tag every Exotic item carries.
export const EXOTIC = 'EXOTIC'
export const EXOTIC_TAG = 'tg_exotic'
type Restrictable = { source?: unknown; type?: unknown; licenceId?: string; tags?: unknown; raw?: Record<string, unknown>; [key: string]: unknown }
const named = (label: unknown) => (typeof label === 'string' ? label.trim().toUpperCase() : '')
// Whether a frame, weapon, system, mod, gear item or core bonus is HORUS or NHC: its own source, type or licence name, or
// the manufacturer or name of the frame whose licence it needs.
export function gmOnly(thing: Restrictable, frames: Frame[] = []): boolean {
  const licence = frames.find((frame) => frame.id === thing.licenceId)
  const labels = [thing.source, thing.type, thing.raw?.source, thing.raw?.license, thing.raw?.category, licence?.source, licence?.name]
  return labels.some((label) => GM_ONLY_NAMES.includes(named(label)))
}
// Whether anything is Exotic: its source is EXOTIC (an owner-made item with no manufacturer), or it carries the Exotic
// Gear tag (a one-of-a-kind prototype that may have a real manufacturer). Pack data comes as an Item (its pack's fields
// in raw) or as the raw record (core bonuses, talents, frames); tags are objects or plain ids. Biomods have a source only.
export function isExotic(thing: Restrictable): boolean {
  return [thing, thing.raw ?? {}].some((record: Record<string, unknown>) => {
    const tags = Array.isArray(record.tags) ? record.tags : []
    return named(record.source) === EXOTIC || tags.some((tag) => named(typeof tag === 'string' ? tag : (tag as { id?: unknown } | null)?.id) === EXOTIC_TAG.toUpperCase())
  })
}
export type Restriction = { gmOnly: boolean; exotic: boolean }
export const restrictionOf = (thing: Restrictable, frames: Frame[] = []): Restriction => ({ gmOnly: gmOnly(thing, frames), exotic: isExotic(thing) })
// Why a picker refuses it, or '' when this viewer may pick it: "gm" is a GM or owner, "gmEdit" is a GM's edit mode.
export const restrictionReason = (r: Partial<Restriction>, viewer: { gm: boolean; gmEdit: boolean }) =>
  r.exotic ? (viewer.gmEdit ? '' : EXOTIC_REASON) : r.gmOnly && !viewer.gm ? GM_ONLY_REASON : ''

export const sum = (values: Record<string, number> | undefined) => Object.values(values ?? {}).reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0)

// From level: HASE points and the mod limit (a base number, one more per level).
export const skillPoints = (level: number) => rule('skill_points_base') + level
export const modLimit = (level: number) => rule('mod_points_base') + level
// The mod limit with every "mod_points" bonus the pilot's talents, core bonuses and equipped gear give.
export const modPointLimit = (level: number, sheet: Sheet, gear: Item[], talents: Talent[], coreBonuses: CoreBonus[], bionics: Bionic[] = []) =>
  Math.max(0, modLimit(level) + pilotBonuses(sheet, gear, talents, coreBonuses, bionics).reduce((sum, { bonus }) => sum + (bonus.id === 'mod_points' && !bonus.condition ? bonusValue(bonus.val) ?? 0 : 0), 0))

// What a requirement names that the pilot (or mech) hasn't got: "Brawler II", "IPS-N Drake II", a core bonus, an item. "owned":
// the item ids that count (on this mech, or owned as pilot gear). Names the lists don't have fall back to the id.
export type RequirementNames = { frames?: Frame[]; talents?: Talent[]; coreBonuses?: CoreBonus[]; itemName?: (id: string) => string | undefined }
export function unmetRequirements(data: unknown, sheet: Pick<Sheet, 'talents' | 'licences' | 'core_bonuses'>, owned: Iterable<string>, names: RequirementNames = {}): string[] {
  const have = new Set(owned)
  return requirementsOf(data).flatMap(need => {
    if (need.kind === 'core_bonus') return sheet.core_bonuses?.includes(need.id) ? [] : [names.coreBonuses?.find(bonus => bonus.id === need.id)?.name ?? need.id]
    if (need.kind === 'item') return have.has(need.id) ? [] : [names.itemName?.(need.id) ?? need.id]
    const rank = Number((need as { rank?: unknown }).rank) || 1
    if (((need.kind === 'talent' ? sheet.talents : sheet.licences)?.[need.id] ?? 0) >= rank) return []
    return [`${need.kind === 'talent' ? names.talents?.find(talent => talent.id === need.id)?.name ?? need.id : licenceName(names.frames ?? [], need.id)} ${rankName(rank)}`]
  })
}
// "Needs Brawler II" for a picker, or '' when nothing is missing.
export const requirementReason = (unmet: string[]) => (unmet.length ? `Needs ${unmet.join(', ')}` : '')

// Licence level: the licence ranks bought. Each 3 of them give a core bonus.
export const licenceLevel = (sheet: Sheet) => sum(sheet.licences)
export const coreBonusPicks = (sheet: Sheet) => Math.floor(licenceLevel(sheet) / 3)

export function coreBonusProblems(sheet: Sheet, frames: Frame[], bonuses: CoreBonus[], talents: Talent[] = []): string[] {
  const problems: string[] = []
  const taken = sheet.core_bonuses ?? []
  const picks = coreBonusPicks(sheet)
  if (taken.length > picks)
    problems.push(`Too many core bonuses: ${taken.length} taken, ${picks} available.`)

  const manufacturers = new Map<string, number>()
  for (const id of new Set(taken)) {
    const bonus = bonuses.find((bonus) => bonus.id === id)
    if (!bonus) {
      problems.push(`Core bonus ${id} isn't in any loaded pack.`)
      continue
    }
    if (taken.filter((other) => other === id).length > 1) problems.push(`${bonus.name} can only be taken once.`)
    for (const thing of unmetRequirements(bonus, sheet, [], { frames, talents, coreBonuses: bonuses })) problems.push(`${bonus.name} needs ${thing}.`)
    const source = bonus.source.trim().toUpperCase()
    if (!source) problems.push(`${bonus.name} has no manufacturer.`)
    else if (source !== 'GMS') manufacturers.set(source, (manufacturers.get(source) ?? 0) + 1)
  }
  for (const [source, count] of manufacturers) {
    const ranks = Object.entries(sheet.licences ?? {}).reduce((total, [id, rank]) => {
      const frame = frames.find((frame) => frame.id === id)
      return frame && frame.licenceLevel > 0 && frame.source.trim().toUpperCase() === source
        && Number.isInteger(rank) && rank > 0 && rank <= maxLicenceRank() ? total + rank : total
    }, 0)
    if (ranks < count * 3) problems.push(`${source} core bonuses need ${count * 3} ${source} licence ranks, but the pilot has ${ranks}.`)
  }
  return problems
}

// A pilot gear item's price when its manna_cost isn't set (or isn't a whole number, 0 or more).
export const gearPriceDefault = () => rule('default_gear_price')
export const gearPrice = (item: Item) => {
  const cost = item.raw?.manna_cost
  return typeof cost === 'number' && Number.isInteger(cost) && cost >= 0 ? cost : gearPriceDefault()
}

// Which owned items cost nothing (one boolean per entry), worked out like the database's settle_pilot_gear (the sheet's own
// "free" flags are never trusted). Without a live sheet (a pilot's first approval) the loadout's slots (1 Armor, 2 Weapon
// and 3 Gear unless the numbers say otherwise) are free. Against the live sheet an item is free only if it was there with the same key and id and free, once per key.
export function freeGear(owned: OwnedGear[], typeOf: (id: string) => string | undefined, live: Sheet | null): boolean[] {
  const room: Record<string, number> = { Armor: rule('loadout_armour'), Weapon: rule('loadout_weapons'), Gear: rule('loadout_gear') }
  const seen = new Set<string>()
  return owned.map(({ key, id }) => {
    if (!live) {
      const type = typeOf(id) ?? ''
      return (room[type] ?? 0) > 0 && room[type]-- > 0
    }
    const first = !seen.has(key)
    seen.add(key)
    return first && !!live.owned_gear?.some(was => was.key === key && was.id === id && was.free === true)
  })
}

// What a GM or owner gave a pilot free in edit mode (character_sheets.gm_grants, GM-only to change, never in the sheet or a
// change): how many ranks of each licence and talent, copies of each biomod and gear item, and extra mechs.
export type Grants = { licences?: Record<string, number>; talents?: Record<string, number>; bionics?: Record<string, number>; gear?: Record<string, number>; mechs?: number }
const GRANT_KINDS = ['licences', 'talents', 'bionics', 'gear'] as const
const tally = (ids: Iterable<string | number>) => {
  const counts: Record<string, number> = {}
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1
  return counts
}
// What the grants cover, per id: the smaller of what was given and what the sheet still holds.
const covered = (given: Record<string, number> | undefined, held: Record<string, number>, price: (id: string) => number) =>
  Object.entries(given ?? {}).reduce((total, [id, n]) => {
    const count = Math.min(n, Math.max(0, held[id] ?? 0))
    return count > 0 ? total + count * price(id) : total
  }, 0)
// Grants after a GM edit: every rank or item added counts as given, every one taken away lowers the grant first (never below 0).
export function adjustGrants(grants: Grants, before: Sheet, after: Sheet, mechsBefore: number, mechsAfter: number): Grants {
  const held = (sheet: Sheet) => ({ licences: sheet.licences ?? {}, talents: sheet.talents ?? {}, bionics: tally(sheet.bionics ?? []), gear: tally((sheet.owned_gear ?? []).map(owned => owned.id)) })
  const [was, now] = [held(before), held(after)]
  const next: Grants = { ...grants }
  for (const kind of GRANT_KINDS) {
    const list = { ...grants[kind] }
    for (const id of new Set([...Object.keys(was[kind]), ...Object.keys(now[kind])])) {
      const given = Math.max(0, (list[id] ?? 0) + (now[kind][id] ?? 0) - (was[kind][id] ?? 0))
      if (given) list[id] = given
      else delete list[id]
    }
    if (Object.keys(list).length) next[kind] = list
    else delete next[kind]
  }
  const mechs = Math.max(0, (grants.mechs ?? 0) + mechsAfter - mechsBefore)
  if (mechs) next.mechs = mechs
  else delete next.mechs
  return next
}

// Manna spent: licence ranks, biomods (each at its own price; an id missing from the catalogue costs 0, like any unknown
// item), talent ranks, every mech after the first, and every owned pilot gear item that isn't free. "mechs" is how many
// mechs are on the card (characters.mechs), which isn't part of the sheet. "live" is the pilot's approved sheet, or null
// for a pilot who has never been approved (see freeGear). "grants" (a GM's free gifts) are taken off each kind, never
// more than the sheet holds.
export const mannaSpent = (sheet: Sheet, bionicPrices: Map<number, number>, mechs: number, gear: Item[], live: Sheet | null, grants: Grants = {}) => {
  const byId = new Map(gear.map(item => [item.id, item]))
  const owned = sheet.owned_gear ?? []
  const free = freeGear(owned, id => byId.get(id)?.type, live)
  const paid = owned.filter((_, n) => !free[n] && byId.has(owned[n].id))
  const extraMechs = Math.max(0, mechs - 1)
  return licenceLevel(sheet) * PRICES.licenceRank + (sheet.bionics ?? []).reduce((total, id) => total + (bionicPrices.get(id) ?? 0), 0) + sum(sheet.talents) * PRICES.talentRank
    + extraMechs * PRICES.extraMech
    + paid.reduce((total, { id }) => total + gearPrice(byId.get(id)!), 0)
    - covered(grants.licences, sheet.licences ?? {}, () => PRICES.licenceRank)
    - covered(grants.talents, sheet.talents ?? {}, () => PRICES.talentRank)
    - covered(grants.bionics, tally(sheet.bionics ?? []), id => bionicPrices.get(Number(id)) ?? 0)
    - covered(grants.gear, tally(paid.map(entry => entry.id)), id => gearPrice(byId.get(id)!))
    - Math.min(Math.max(0, grants.mechs ?? 0), extraMechs) * PRICES.extraMech
}
// How many mechs a card's mechs column holds.
export const mechCount = (mechs: unknown) => (Array.isArray(mechs) ? mechs.length : 0)

export const rankName = (rank: number) => ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'][rank] ?? String(rank)

// Whether the pilot's licences cover something: free (licence level 0, e.g. GMS), or a high enough rank
// in the licence it belongs to.
export const isLicensed = (need: { licenceId: string; licenceLevel: number }, licences: Record<string, number> | undefined) =>
  need.licenceLevel <= 0 || (licences?.[need.licenceId] ?? 0) >= need.licenceLevel

// Why a pilot can't use this frame yet, or '' if they can: its licence at its rank, and, when the licence has alternate
// frames, only the one the pilot chose for it (sheet.frame_choices). GMS frames have no licence.
export function frameBlockedBy(frame: Frame, frames: Frame[], sheet: Pick<Sheet, 'licences' | 'frame_choices'>): string {
  if (frame.licenceLevel <= 0) return ''
  const original = alternateOf(frame, frames) ?? frame
  if (!isLicensed({ licenceId: original.id, licenceLevel: frame.licenceLevel }, sheet.licences)) return `Needs ${licenceName(frames, original.id)} ${rankName(frame.licenceLevel)}`
  const chosen = chosenFrame(original, frames, sheet.frame_choices)
  return chosen.id === frame.id ? '' : `Licence gives ${chosen.name}`
}

// --- Superheavy weapons take a Heavy mount and one more, empty, mount ---

// Which mount holds a Superheavy weapon, or -1.
export const superheavyMount = (mounts: (string | null)[][], sizeOf: (id: string) => string | undefined) =>
  mounts.findIndex((places) => places.some((id) => id && sizeOf(id) === 'Superheavy'))

// The mount bracing it, or -1 if there's none. A Superheavy mount must brace on the frame's Heavy mount when it has one;
// any other Superheavy weapon takes the first other mount with nothing on it.
export const bracingMount = (frameMounts: string[], mounts: (string | null)[][], superheavyAt: number) => {
  const mustBeHeavy = frameMounts[superheavyAt] === 'Superheavy' && frameMounts.includes('Heavy')
  return frameMounts.findIndex((mount, k) => mount !== 'Integrated Auxiliary' && k !== superheavyAt && (!mustBeHeavy || mount === 'Heavy') && !(mounts[k] ?? []).some(Boolean))
}

// --- The rule check ---

export type Catalogue = {
  frames: Frame[]
  weapons: Map<string, Item>
  systems: Map<string, Item>
  // Built into frames: never picked, so never checked.
  integrated: Map<string, Item>
  mods?: Map<string, Item>
  // Each bionic's mod-point cost, by id (only the pilot check needs it).
  bionicCosts?: Map<number, number>
  // Each bionic's price in manna, by id (what mannaSpent reads).
  bionicPrices?: Map<number, number>
  coreBonuses?: CoreBonus[]
  talents?: Talent[]
  gear?: Item[]
  bionics?: Bionic[]
}

// The loaded game content, in the shape the rule checks (and mechEffects) read. Empty until the catalogues arrive.
export function useCatalogue() {
  const { frames, weapons, systems, mods, integrated } = useMechData()
  const { bionics, bionicPrices, coreBonuses, talents, gear } = useGameData()
  return computed<Catalogue>(() => ({
    frames: frames.value,
    weapons: new Map(weapons.value.map((item) => [item.id, item])),
    systems: new Map(systems.value.map((item) => [item.id, item])),
    integrated: integrated.value,
    mods: new Map(mods.value.map((item) => [item.id, item])),
    bionicCosts: new Map(bionics.value.map((bionic) => [bionic.id, bionic.mod_point_cost])),
    bionicPrices: bionicPrices.value,
    coreBonuses: coreBonuses.value,
    talents: talents.value,
    gear: gear.value,
    bionics: bionics.value,
  }))
}

// The GM-set parts of a pilot (character_sheets columns, not the sheet itself).
export type GmFields = { level: number; manna: number }

// "IPS-N Blackbeard" for a licence id (a frame id).
export function licenceName(frames: Frame[], licenceId: string) {
  const frame = frames.find((f) => f.id === licenceId)
  return frame ? `${frame.source} ${frame.name}` : licenceId
}

const isUnique = (item: Item) => item.tags.some((tag) => tag.id === 'tg_unique')
const isAi = (item: Item) => item.tags.some((tag) => tag.id === 'tg_ai')

// Everything wrong with one mech, as short sentences. Empty when it's legal (or has no frame yet).
export function mechProblems(mech: MechPrivate, sheet: Sheet, catalogue: Catalogue): string[] {
  if (!mech.frame) return []
  const baseFrame = catalogue.frames.find((f) => f.id === mech.frame)
  if (!baseFrame) return ["Frame isn't in any loaded pack."]
  const effects = mechEffects(mech, sheet, catalogue)
  const frame = effects.frame!

  const problems: string[] = []
  const licences = sheet.licences
  const grants = talentGrants(sheet, catalogue.talents ?? [], catalogue.coreBonuses, grantingSources(mech, sheet, catalogue))
  const unlocked = new Set([...frame.integrated, ...grants.optional])
  // What can grant each item (a core bonus, a talent rank, another weapon or system), by id: named when it's missing.
  const grantedBy = new Map<string, string[]>()
  const grantsFrom = (name: string, source: unknown) => {
    const data = (source ?? {}) as Record<string, unknown>
    for (const id of [...idList(data.integrated), ...idList(data.special_equipment)]) grantedBy.set(id, [...(grantedBy.get(id) ?? []), name])
  }
  for (const bonus of catalogue.coreBonuses ?? []) grantsFrom(bonus.name, bonus)
  for (const talent of catalogue.talents ?? []) talent.ranks.forEach((rank, index) => grantsFrom(`${talent.name} ${rankName(index + 1)}`, rank))
  for (const item of [...catalogue.weapons.values(), ...catalogue.systems.values()]) grantsFrom(item.name, item.raw)
  for (const bionic of catalogue.bionics ?? []) grantsFrom(bionic.name, bionic)
  for (const id of [...(mech.systems ?? []), ...(mech.mounts ?? []).flat().filter((id): id is string => !!id)]) {
    const item = catalogue.weapons.get(id) ?? catalogue.systems.get(id) ?? catalogue.integrated.get(id)
    const source = grantedBy.get(id)
    if ((source || item?.raw?.talent_item) && !unlocked.has(id)) problems.push(`${item?.name ?? id} needs ${source ? [...new Set(source)].join(' or ') : 'its talent rank'}.`)
    if (frame.integrated.includes(id)) problems.push(`${item?.name ?? id} is integrated and can't also take a normal slot.`)
  }
  if ((mech.mounts ?? []).slice(frame.mounts.length).some(places => places.some(Boolean))) problems.push("Some weapons are on mounts the frame doesn't have.")
  if ((mech.mounts ?? []).some((places, index) => index < frame.mounts.length && places.slice(mountSize(frame.mounts[index])).some(Boolean))) problems.push("Some weapons are in slots the mount doesn't have.")
  const choices = [...['cb_mount_retrofitting', 'cb_auto_stabilizing_hardpoints'].filter(id => sheet.core_bonuses?.includes(id)).map(id => ({ key: id, name: catalogue.coreBonuses?.find(bonus => bonus.id === id)?.name ?? id })), ...mountReplacements(effects.bonuses)]
  for (const { key, name } of choices) {
    const index = mech.core_mounts?.[key]
    if (!Number.isInteger(index) || index! < 0 || index! >= frame.mounts.length || frame.mounts[index!] === 'Integrated Auxiliary') problems.push(`${name} needs a normal mount.`)
  }
  if (sheet.core_bonuses?.includes('cb_overpower_caliber')) {
    const target = mech.core_mounts?.cb_overpower_caliber
    if (!Number.isInteger(target) || target! < 0 || !mech.mounts?.[Math.floor(target! / 2)]?.[target! % 2]) problems.push('Overpower Caliber needs an equipped weapon.')
  }
  for (const [key, options] of Object.entries(mech.weapon_options ?? {})) {
    const [mount, position] = key.split(':').map(Number)
    const id = key.startsWith('integrated:') ? key.slice('integrated:'.length) : mech.mounts?.[mount]?.[position]
    if (!id) continue
    const item = catalogue.weapons.get(id) ?? catalogue.integrated.get(id)
    if (options.profile !== undefined && (!Number.isInteger(options.profile) || options.profile < 0 || options.profile >= (item?.profiles?.length ?? 0))) problems.push(`${item?.name ?? id} has a profile that no longer exists.`)
    if (id.startsWith('mw_prototype_')) {
      if (options.type && !['Melee', 'CQB', 'Rifle', 'Cannon', 'Launcher', 'Nexus'].includes(options.type)) problems.push('Prototype weapon has an invalid weapon type.')
      if (options.damageType && !DAMAGE_CHOICES.includes(options.damageType)) problems.push('Prototype weapon has an invalid damage type.')
      if (Number(id.at(-1)) >= 2 && options.accuracy === false && options.smart === false) problems.push('Prototype weapon must choose two improvements.')
    }
  }
  const needs = (item: { name: string; licenceId: string; licenceLevel: number }) =>
    `${item.name} needs ${licenceName(catalogue.frames, item.licenceId)} licence rank ${rankName(item.licenceLevel)}.`
  const licenceFrame = alternateOf(baseFrame, catalogue.frames) ?? baseFrame
  if (!isLicensed({ licenceId: licenceFrame.id, licenceLevel: frame.licenceLevel }, licences))
    problems.push(needs({ name: `The ${frame.name} frame`, licenceId: licenceFrame.id, licenceLevel: frame.licenceLevel }))
  else if (frameBlockedBy(baseFrame, catalogue.frames, sheet))
    problems.push(`${frame.name} isn't the frame chosen for the ${licenceFrame.name} licence.`)

  // Weapons: licence, mount size, Superheavy bracing, Unique, a chosen damage type for a Variable weapon.
  const needsDamageType = (weapon: Item, key: string) => {
    if (variableDamage(weapon) && !DAMAGE_CHOICES.includes(mech.weapon_options?.[key]?.damageType ?? '')) problems.push(`${weapon.name} needs a damage type.`)
  }
  const mounts = (mech.mounts ?? []).slice(0, frame.mounts.length)
  const lookup = (map: Map<string, Item>, id: string) => map.get(id) ?? catalogue.integrated.get(id)
  const fitted: Item[] = []
  mounts.forEach((places, m) => {
    const ids = places.slice(0, mountSize(frame.mounts[m]))
    const sizes = ids.map((id) => (id ? (catalogue.weapons.get(id)?.mount ?? null) : null))
    ids.forEach((id, i) => {
      if (!id) return
      const weapon = lookup(catalogue.weapons, id)
      if (!weapon) return problems.push(`Weapon ${id} isn't in any loaded pack.`)
      fitted.push(weapon)
      if (!isLicensed(weapon, licences)) problems.push(needs(weapon))
      needsDamageType(weapon, `${m}:${i}`)
      // Checked against the places before it only, so a clash (e.g. Main + Auxiliary on Flex) is reported once.
      if (!allowedSizes(frame.mounts[m], i, sizes.map((size, k) => (k < i ? size : null))).includes(weapon.mount))
        problems.push(`${weapon.name} (${weapon.mount.toLowerCase()}) doesn't fit its ${frame.mounts[m].toLowerCase()} mount.`)
    })
  })
  const heavy = superheavyMount(mounts, (id) => catalogue.weapons.get(id)?.mount)
  if (heavy >= 0 && bracingMount(frame.mounts, mounts, heavy) < 0)
    problems.push('Superheavy weapon needs a second empty mount.')

  // Mods: on a weapon that's there and takes this mod, with the licence.
  for (const [key, id] of Object.entries(mech.weapon_mods ?? {})) {
    const mod = catalogue.mods?.get(id)
    const weaponId = weaponAt(mech, frame, key)
    const weapon = weaponId ? lookup(catalogue.weapons, weaponId) : undefined
    if (!weapon) problems.push(`${mod?.name ?? id} has no weapon to sit on.`)
    else if (!mod) problems.push(`Mod ${id} isn't in any loaded pack.`)
    else {
      if (!isLicensed(mod, licences)) problems.push(needs(mod))
      const why = modBlockedBy(mod, weapon, frame.mounts[Number(key.split(':')[0])], mech.weapon_options?.[key])
      if (why) problems.push(`${mod.name} can't go on ${weapon.name}. ${why}.`)
    }
  }

  // Systems: licence, Unique, one AI.
  const installed = (mech.systems ?? []).map((id) => lookup(catalogue.systems, id))
  installed.forEach((system, k) => {
    if (!system) problems.push(`System ${mech.systems![k]} isn't in any loaded pack.`)
    else if (!isLicensed(system, licences)) problems.push(needs(system))
  })
  const integratedItems = frame.integrated.map(id => catalogue.integrated.get(id)).filter((item): item is Item => !!item)
  for (const item of integratedItems) if (item.mount) needsDamageType(item, `integrated:${item.id}`)
  const mods = fittedMods(mech, frame).flatMap(([, id]) => catalogue.mods?.get(id) ?? [])
  const known = [...fitted, ...installed.filter((item): item is Item => !!item), ...mods]
  // Requirements: the frame and every item on the mech, met by what's equipped on it.
  const onMech = new Set([...frame.integrated, ...(mech.systems ?? []), ...(mech.mounts ?? []).flat().filter((id): id is string => !!id), ...Object.values(mech.weapon_mods ?? {})])
  const names = { frames: catalogue.frames, talents: catalogue.talents, coreBonuses: catalogue.coreBonuses, itemName: (id: string) => lookup(catalogue.weapons, id)?.name ?? lookup(catalogue.systems, id)?.name ?? catalogue.mods?.get(id)?.name }
  for (const [name, data] of [[`The ${frame.name} frame`, baseFrame.raw], ...known.map(item => [item.name, item.raw] as const)] as const)
    for (const thing of unmetRequirements(data, sheet, onMech, names)) problems.push(`${name} needs ${thing}.`)
  for (const item of new Set(known.filter(isUnique)))
    if (known.filter((other) => other.id === item.id).length > 1) problems.push(`${item.name} is Unique. Only one allowed per mech.`)
  const aiCap = Math.max(0, resolveBonuses(1, effects.modifiers.filter(entry => entry.stat === 'ai_cap')).value)
  if ([...known, ...integratedItems].filter(isAi).length > aiCap) problems.push(aiCap === 1 ? 'Only one AI allowed.' : `Only ${aiCap} AIs allowed.`)

  // System points.
  const total = mechStats(frame, sheet.mech_skills, effects.modifiers).find((stat) => stat.id === 'system_points')!.value ?? 0
  const used = known.reduce((spent, item) => spent + item.sp, 0)
  if (used > total) problems.push(`Uses ${used} system points, but only ${total} are available.`)

  return problems
}

// Everything wrong with a pilot's sheet: manna, level-based limits, licences, talents, core bonuses, then
// each mech by name.
// "live" is the pilot's approved sheet (null for a never-approved pilot), for the gear that's free.
export function pilotProblems(sheet: Sheet, gm: GmFields, catalogue: Catalogue, mechNames: Record<string, string>, live: Sheet | null, grants: Grants = {}): string[] {
  const problems = personalStatProblems(sheet.pilot_stats)
  const names: RequirementNames = { frames: catalogue.frames, talents: catalogue.talents, coreBonuses: catalogue.coreBonuses, itemName: id => catalogue.gear?.find(gear => gear.id === id)?.name }
  const spent = mannaSpent(sheet, catalogue.bionicPrices ?? new Map(), Object.keys(mechNames).length, catalogue.gear ?? [], live, grants)
  if (spent > gm.manna) problems.push(`${spent} manna spent, but only ${gm.manna} received.`)

  const skills = sum(sheet.mech_skills)
  if (skills > skillPoints(gm.level)) problems.push(`${skills} HASE points taken, but level ${gm.level} only gives ${skillPoints(gm.level)}.`)
  for (const [id, value] of Object.entries(sheet.mech_skills ?? {}))
    if (!Number.isInteger(value) || value < 0 || value > MAX_SKILL) problems.push(`${capitalise(id)} must be a whole number from 0 to ${MAX_SKILL}.`)

  const mods = (sheet.bionics ?? []).reduce((total, id) => total + (catalogue.bionicCosts?.get(id) ?? 0), 0)
  const limit = modPointLimit(gm.level, sheet, catalogue.gear ?? [], catalogue.talents ?? [], catalogue.coreBonuses ?? [], catalogue.bionics ?? [])
  if (mods > limit) problems.push(limit === modLimit(gm.level) ? `Biomods use ${mods} mod points, but level ${gm.level} only gives ${limit}.` : `Biomods use ${mods} mod points, but only ${limit} are available.`)

  for (const [id, rank] of Object.entries(sheet.licences ?? {}))
    if (!Number.isInteger(rank) || rank < 0 || rank > maxLicenceRank()) problems.push(`${licenceName(catalogue.frames, id)} licence must be a whole rank from 0 to ${rankName(maxLicenceRank())}.`)
    else if (rank > 0) {
      const frame = catalogue.frames.find(frame => frame.id === id && frame.licenceLevel > 0)
      const original = frame && alternateOf(frame, catalogue.frames)
      if (!frame) problems.push(`Licence ${id} isn't in any loaded pack.`)
      else if (original) problems.push(`${frame.name} is part of the ${original.name} licence. A GM should move its ranks there.`)
    }
  for (const [id, rank] of Object.entries(sheet.talents ?? {}))
    if (!Number.isInteger(rank) || rank < 0 || rank > maxTalentRank()) problems.push(`Talent ${id} must be a whole rank from 0 to ${rankName(maxTalentRank())}.`)
    else if (rank > 0) {
      const talent = catalogue.talents?.find(talent => talent.id === id)
      if (!talent) problems.push(`Talent ${id} isn't in any loaded pack.`)
      else for (const thing of unmetRequirements(talent, sheet, [], names)) problems.push(`${talent.name} needs ${thing}.`)
    }
  if (catalogue.gear) {
    const gearIds = (sheet.owned_gear ?? []).map(owned => owned.id)
    for (const id of new Set(gearIds)) {
      const item = catalogue.gear.find(gear => gear.id === id)
      for (const thing of unmetRequirements(item?.raw, sheet, gearIds, names)) problems.push(`${item!.name} needs ${thing}.`)
    }
    const layout = loadoutSlots(equippedGear(sheet).map(owned => owned.id), id => catalogue.gear!.find(item => item.id === id)?.type)
    if (layout.overflow.length) problems.push("Pilot gear doesn't fit the available slots.")
    if (layout.unknown.length) problems.push("Some pilot gear isn't in any loaded pack.")
    for (const owned of sheet.owned_gear ?? []) {
      const item = catalogue.gear.find(gear => gear.id === owned.id)
      if (item?.type === 'Weapon' && variableDamage(item) && !DAMAGE_CHOICES.includes(owned.damageType ?? '')) problems.push(`${item.name} needs a damage type.`)
    }
  }
  if (catalogue.bionicCosts) for (const id of sheet.bionics ?? [])
    if (!catalogue.bionicCosts.has(id)) problems.push(`Unknown biomod (${id}).`)
  for (const bionic of catalogue.bionics ?? [])
    if (sheet.bionics?.includes(bionic.id)) for (const thing of unmetRequirements(bionic, sheet, [], names)) problems.push(`${bionic.name} needs ${thing}.`)
  if (new Set(sheet.bionics ?? []).size !== (sheet.bionics?.length ?? 0)) problems.push('A biomod can only be installed once.')
  problems.push(...coreBonusProblems(sheet, catalogue.frames, catalogue.coreBonuses ?? [], catalogue.talents ?? []))

  for (const [mechId, mech] of Object.entries(sheet.mechs ?? {}))
    for (const problem of mechProblems(mech, sheet, catalogue)) problems.push(`${mechNames[mechId] ?? 'A mech'}: ${problem}`)
  return problems
}
