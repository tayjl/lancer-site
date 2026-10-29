import type { Item } from './gameData'
import { allowedSizes, mechStats, mountSize, type Frame } from './mechData'
import type { MechPrivate, Sheet } from './myPilot'

// LANCER's character rules with this campaign's homebrew, as plain functions the pages use to block choices
// and to list what's wrong. docs/lancer-rules.md lists every rule, what's enforced and what's left to GMs.
//
// Homebrew: a pilot's "level" is gained narratively (GMs set it) and gives HASE points and biomod capacity.
// Everything else is bought with manna: licence ranks, biomods (bionics) and talent ranks. Licence level is
// just the number of licence ranks bought. Gear is free to print once licensed (GMS gear always is), and
// every 3 licence ranks bought give one core bonus for free.

export const MAX_LICENCE_RANK = 3
export const MAX_TALENT_RANK = 3
export const MAX_SKILL = 6
export const PERSONAL_STAT_MIN = 2
export const PERSONAL_STAT_MAX = 4
export const PERSONAL_STAT_POINTS = 4

// Only increases above the base cost points; biomods are applied separately.
export const personalPoints = (values: Record<string, number> = {}) =>
  Object.values(values).reduce((total, value) => total + (Number.isFinite(value) ? Math.max(0, value - PERSONAL_STAT_MIN) : 0), 0)

export function personalStatProblems(values: Record<string, number> = {}): string[] {
  const problems: string[] = []
  for (const [id, value] of Object.entries(values))
    if (!Number.isInteger(value) || value < PERSONAL_STAT_MIN || value > PERSONAL_STAT_MAX)
      problems.push(`${id.replaceAll('_', '-')}: base personal stats must be whole numbers from ${PERSONAL_STAT_MIN} to ${PERSONAL_STAT_MAX}.`)
  const used = personalPoints(values)
  if (used > PERSONAL_STAT_POINTS) problems.push(`${used} personal stat points allocated, but only ${PERSONAL_STAT_POINTS} are available.`)
  return problems
}

// Manna prices.
export const PRICES = { licenceRank: 600, bionic: 500, talentRank: 300 }

export const sum = (values: Record<string, number> | undefined) => Object.values(values ?? {}).reduce((a, b) => a + b, 0)

// From level: HASE points (2 at level 0, one more per level) and the mod limit (6, one more per level).
export const skillPoints = (level: number) => 2 + level
export const modLimit = (level: number) => 6 + level

// Licence level: the licence ranks bought. Each 3 of them give a core bonus.
export const licenceLevel = (sheet: Sheet) => sum(sheet.licences)
export const coreBonusPicks = (sheet: Sheet) => Math.floor(licenceLevel(sheet) / 3)

// Manna spent on the sheet: licence ranks, biomods and talent ranks.
export const mannaSpent = (sheet: Sheet) =>
  licenceLevel(sheet) * PRICES.licenceRank + (sheet.bionics?.length ?? 0) * PRICES.bionic + sum(sheet.talents) * PRICES.talentRank

export const rankName = (rank: number) => ['0', 'I', 'II', 'III'][rank] ?? String(rank)

// Whether the pilot's licences cover something: free (licence level 0, e.g. GMS), or a high enough rank
// in the licence it belongs to.
export const isLicensed = (need: { licenceId: string; licenceLevel: number }, licences: Record<string, number> | undefined) =>
  need.licenceLevel <= 0 || (licences?.[need.licenceId] ?? 0) >= need.licenceLevel

// --- Superheavy weapons take a Heavy mount and one more, empty, mount ---

// Which mount holds a Superheavy weapon, or -1.
export const superheavyMount = (mounts: (string | null)[][], sizeOf: (id: string) => string | undefined) =>
  mounts.findIndex((places) => places.some((id) => id && sizeOf(id) === 'Superheavy'))

// The mount bracing it: the first other mount with nothing on it, or -1 if there's none.
export const bracingMount = (frameMounts: string[], mounts: (string | null)[][], superheavyAt: number) =>
  frameMounts.findIndex((_, k) => k !== superheavyAt && !(mounts[k] ?? []).some(Boolean))

// --- The rule check ---

export type Catalogue = {
  frames: Frame[]
  weapons: Map<string, Item>
  systems: Map<string, Item>
  // Built into frames: never picked, so never checked.
  integrated: Map<string, Item>
  // Each bionic's mod-point cost, by id (only the pilot check needs it).
  bionicCosts?: Map<number, number>
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
  const frame = catalogue.frames.find((f) => f.id === mech.frame)
  if (!frame) return ["its frame isn't in the loaded content packs."]

  const problems: string[] = []
  const licences = sheet.licences
  const needs = (item: { name: string; licenceId: string; licenceLevel: number }) =>
    `${item.name} needs ${licenceName(catalogue.frames, item.licenceId)} licence rank ${rankName(item.licenceLevel)}.`
  if (!isLicensed({ licenceId: frame.id, licenceLevel: frame.licenceLevel }, licences))
    problems.push(needs({ name: `the ${frame.name} frame`, licenceId: frame.id, licenceLevel: frame.licenceLevel }))

  // Weapons: licence, mount size, Superheavy bracing, Unique.
  const mounts = (mech.mounts ?? []).slice(0, frame.mounts.length)
  const lookup = (map: Map<string, Item>, id: string) => map.get(id) ?? catalogue.integrated.get(id)
  const fitted: Item[] = []
  mounts.forEach((places, m) => {
    const ids = places.slice(0, mountSize(frame.mounts[m]))
    const sizes = ids.map((id) => (id ? (catalogue.weapons.get(id)?.mount ?? null) : null))
    ids.forEach((id, i) => {
      if (!id) return
      const weapon = lookup(catalogue.weapons, id)
      if (!weapon) return problems.push(`a weapon (${id}) isn't in the loaded content packs.`)
      fitted.push(weapon)
      if (!isLicensed(weapon, licences)) problems.push(needs(weapon))
      // Checked against the places before it only, so a clash (e.g. Main + Auxiliary on Flex) is reported once.
      if (!allowedSizes(frame.mounts[m], i, sizes.map((size, k) => (k < i ? size : null))).includes(weapon.mount))
        problems.push(`${weapon.name} (${weapon.mount.toLowerCase()}) doesn't fit its ${frame.mounts[m].toLowerCase()} mount.`)
    })
  })
  const heavy = superheavyMount(mounts, (id) => catalogue.weapons.get(id)?.mount)
  if (heavy >= 0 && bracingMount(frame.mounts, mounts, heavy) < 0)
    problems.push('its superheavy weapon needs a second, empty mount.')

  // Systems: licence, Unique, one AI.
  const installed = (mech.systems ?? []).map((id) => lookup(catalogue.systems, id))
  installed.forEach((system, k) => {
    if (!system) problems.push(`a system (${mech.systems![k]}) isn't in the loaded content packs.`)
    else if (!isLicensed(system, licences)) problems.push(needs(system))
  })
  const known = [...fitted, ...installed.filter((item): item is Item => !!item)]
  for (const item of new Set(known.filter(isUnique)))
    if (known.filter((other) => other.id === item.id).length > 1) problems.push(`${item.name} is unique: one per mech.`)
  if (known.filter(isAi).length > 1) problems.push('only one AI per mech.')

  // System points.
  const total = mechStats(frame, sheet.mech_skills).find((stat) => stat.id === 'system_points')!.value ?? 0
  const used = known.reduce((spent, item) => spent + item.sp, 0)
  if (used > total) problems.push(`its system points are over: ${used}/${total}.`)

  return problems
}

// Everything wrong with a pilot's sheet: manna, level-based limits, licences, talents, core bonuses, then
// each mech by name.
export function pilotProblems(sheet: Sheet, gm: GmFields, catalogue: Catalogue, mechNames: Record<string, string>): string[] {
  const problems = personalStatProblems(sheet.pilot_stats)
  const spent = mannaSpent(sheet)
  if (spent > gm.manna) problems.push(`${spent} manna spent, but only ${gm.manna} received.`)

  const skills = sum(sheet.mech_skills)
  if (skills > skillPoints(gm.level)) problems.push(`${skills} hase points taken, but level ${gm.level} only gives ${skillPoints(gm.level)}.`)
  for (const [id, value] of Object.entries(sheet.mech_skills ?? {}))
    if (value > MAX_SKILL) problems.push(`${id} is above ${MAX_SKILL}.`)

  const mods = (sheet.bionics ?? []).reduce((total, id) => total + (catalogue.bionicCosts?.get(id) ?? 0), 0)
  if (mods > modLimit(gm.level)) problems.push(`bionics use ${mods} mod points, but level ${gm.level} only gives ${modLimit(gm.level)}.`)

  for (const [id, rank] of Object.entries(sheet.licences ?? {}))
    if (rank > MAX_LICENCE_RANK) problems.push(`${licenceName(catalogue.frames, id)} licence is above rank III.`)
  for (const [id, rank] of Object.entries(sheet.talents ?? {}))
    if (rank > MAX_TALENT_RANK) problems.push(`talent ${id} is above rank III.`)
  const picks = coreBonusPicks(sheet)
  if ((sheet.core_bonuses?.length ?? 0) > picks)
    problems.push(`core bonuses taken: ${sheet.core_bonuses!.length}, but ${licenceLevel(sheet)} licence ranks only give ${picks}.`)

  for (const [mechId, mech] of Object.entries(sheet.mechs ?? {}))
    for (const problem of mechProblems(mech, sheet, catalogue)) problems.push(`${mechNames[mechId] ?? 'a mech'}: ${problem}`)
  return problems
}
