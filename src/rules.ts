import { loadoutSlots, type CoreBonus, type Item, type Talent } from './gameData'
import { allowedSizes, buildFrame, mechEffects, mechResources, mechStats, mountSize, talentGrants, type Frame } from './mechData'
import { resolveBonuses } from './bonuses'
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

export const sum = (values: Record<string, number> | undefined) => Object.values(values ?? {}).reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0)

// From level: HASE points (2 at level 0, one more per level) and the mod limit (6, one more per level).
export const skillPoints = (level: number) => 2 + level
export const modLimit = (level: number) => 6 + level

// Licence level: the licence ranks bought. Each 3 of them give a core bonus.
export const licenceLevel = (sheet: Sheet) => sum(sheet.licences)
export const coreBonusPicks = (sheet: Sheet) => Math.floor(licenceLevel(sheet) / 3)

export function coreBonusProblems(sheet: Sheet, frames: Frame[], bonuses: CoreBonus[]): string[] {
  const problems: string[] = []
  const taken = sheet.core_bonuses ?? []
  const picks = coreBonusPicks(sheet)
  if (taken.length > picks)
    problems.push(`core bonuses taken: ${taken.length}, but ${licenceLevel(sheet)} licence ranks only give ${picks}.`)

  const manufacturers = new Map<string, number>()
  for (const id of new Set(taken)) {
    const bonus = bonuses.find((bonus) => bonus.id === id)
    if (!bonus) {
      problems.push(`core bonus ${id} isn't in the loaded content packs.`)
      continue
    }
    if (taken.filter((other) => other === id).length > 1) problems.push(`${bonus.name} can only be taken once.`)
    const source = bonus.source.trim().toUpperCase()
    if (!source) problems.push(`${bonus.name} has no manufacturer in the loaded content packs.`)
    else if (source !== 'GMS') manufacturers.set(source, (manufacturers.get(source) ?? 0) + 1)
  }
  for (const [source, count] of manufacturers) {
    const ranks = Object.entries(sheet.licences ?? {}).reduce((total, [id, rank]) => {
      const frame = frames.find((frame) => frame.id === id)
      return frame && frame.licenceLevel > 0 && frame.source.trim().toUpperCase() === source
        && Number.isInteger(rank) && rank > 0 && rank <= MAX_LICENCE_RANK ? total + rank : total
    }, 0)
    if (ranks < count * 3) problems.push(`${source} core bonuses need ${count * 3} ${source} licence ranks; you have ${ranks}.`)
  }
  return problems
}

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
  frameMounts.findIndex((mount, k) => mount !== 'Integrated Auxiliary' && k !== superheavyAt && !(mounts[k] ?? []).some(Boolean))

// --- The rule check ---

export type Catalogue = {
  frames: Frame[]
  weapons: Map<string, Item>
  systems: Map<string, Item>
  // Built into frames: never picked, so never checked.
  integrated: Map<string, Item>
  // Each bionic's mod-point cost, by id (only the pilot check needs it).
  bionicCosts?: Map<number, number>
  coreBonuses?: CoreBonus[]
  talents?: Talent[]
  gear?: Item[]
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
  if (!baseFrame) return ["its frame isn't in the loaded content packs."]
  const effects = mechEffects(mech, sheet, catalogue)
  const frame = buildFrame(baseFrame, mech, sheet, catalogue.talents ?? [], effects.bonuses)!

  const problems: string[] = []
  const licences = sheet.licences
  const grants = talentGrants(sheet, catalogue.talents ?? [])
  const unlocked = new Set([...frame.integrated, ...grants.optional])
  const allTalentEquipment = new Set((catalogue.talents ?? []).flatMap(talent => talent.ranks.flatMap(rank => [...(rank.integrated ?? []), ...(rank.special_equipment ?? [])])))
  for (const id of [...(mech.systems ?? []), ...(mech.mounts ?? []).flat().filter((id): id is string => !!id)]) {
    const item = catalogue.weapons.get(id) ?? catalogue.systems.get(id) ?? catalogue.integrated.get(id)
    if ((item?.raw?.talent_item || allTalentEquipment.has(id)) && !unlocked.has(id)) problems.push(`${item?.name ?? id} needs its talent rank; it is no longer granted.`)
    if (frame.integrated.includes(id)) problems.push(`${item?.name ?? id} is integrated and must not also occupy a normal slot.`)
  }
  if ((mech.mounts ?? []).slice(frame.mounts.length).some(places => places.some(Boolean))) problems.push('weapons remain on mounts this build no longer has; remove or refit them.')
  if ((mech.mounts ?? []).some((places, index) => index < frame.mounts.length && places.slice(mountSize(frame.mounts[index])).some(Boolean))) problems.push('weapons remain in extra slots this mount no longer has; remove or refit them.')
  for (const id of ['cb_mount_retrofitting', 'cb_auto_stabilizing_hardpoints']) {
    if (!sheet.core_bonuses?.includes(id)) continue
    const index = mech.core_mounts?.[id]
    if (!Number.isInteger(index) || index! < 0 || index! >= frame.mounts.length || frame.mounts[index!] === 'Integrated Auxiliary')
      problems.push(`${catalogue.coreBonuses?.find(bonus => bonus.id === id)?.name ?? id}: choose a normal mount.`)
  }
  if (sheet.core_bonuses?.includes('cb_overpower_caliber')) {
    const target = mech.core_mounts?.cb_overpower_caliber
    if (!Number.isInteger(target) || target! < 0 || !mech.mounts?.[Math.floor(target! / 2)]?.[target! % 2]) problems.push('Overpower Caliber: choose an equipped weapon.')
  }
  for (const [key, options] of Object.entries(mech.weapon_options ?? {})) {
    const [mount, position] = key.split(':').map(Number)
    const id = key.startsWith('integrated:') ? key.slice('integrated:'.length) : mech.mounts?.[mount]?.[position]
    if (!id) continue
    const item = catalogue.weapons.get(id) ?? catalogue.integrated.get(id)
    if (options.profile !== undefined && (!Number.isInteger(options.profile) || options.profile < 0 || options.profile >= (item?.profiles?.length ?? 0))) problems.push(`${item?.name ?? id}: selected weapon profile is unavailable.`)
    if (id.startsWith('mw_prototype_')) {
      if (options.type && !['Melee', 'CQB', 'Rifle', 'Cannon', 'Launcher', 'Nexus'].includes(options.type)) problems.push('Prototype weapon has an invalid weapon type.')
      if (options.damageType && !['Kinetic', 'Explosive', 'Energy'].includes(options.damageType)) problems.push('Prototype weapon has an invalid damage type.')
      if (Number(id.at(-1)) >= 2 && options.accuracy === false && options.smart === false) problems.push('Prototype weapon must choose two improvements.')
    }
  }
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
  if (heavy >= 0 && !mechResources(sheet, effects).superheavyMounting && bracingMount(frame.mounts, mounts, heavy) < 0)
    problems.push('its superheavy weapon needs a second, empty mount.')

  // Systems: licence, Unique, one AI.
  const installed = (mech.systems ?? []).map((id) => lookup(catalogue.systems, id))
  installed.forEach((system, k) => {
    if (!system) problems.push(`a system (${mech.systems![k]}) isn't in the loaded content packs.`)
    else if (!isLicensed(system, licences)) problems.push(needs(system))
  })
  const integratedItems = frame.integrated.map(id => catalogue.integrated.get(id)).filter((item): item is Item => !!item)
  const known = [...fitted, ...installed.filter((item): item is Item => !!item)]
  for (const item of new Set(known.filter(isUnique)))
    if (known.filter((other) => other.id === item.id).length > 1) problems.push(`${item.name} is unique: one per mech.`)
  const aiCap = Math.max(0, resolveBonuses(1, effects.modifiers.filter(entry => entry.stat === 'ai_cap')).value)
  if ([...known, ...integratedItems].filter(isAi).length > aiCap) problems.push(aiCap === 1 ? 'only one AI per mech.' : `only ${aiCap} AIs allowed on this mech.`)

  // System points.
  const total = mechStats(frame, sheet.mech_skills, effects.modifiers).find((stat) => stat.id === 'system_points')!.value ?? 0
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
    if (!Number.isInteger(value) || value < 0 || value > MAX_SKILL) problems.push(`${id} must be a whole number from 0 to ${MAX_SKILL}.`)

  const mods = (sheet.bionics ?? []).reduce((total, id) => total + (catalogue.bionicCosts?.get(id) ?? 0), 0)
  if (mods > modLimit(gm.level)) problems.push(`bionics use ${mods} mod points, but level ${gm.level} only gives ${modLimit(gm.level)}.`)

  for (const [id, rank] of Object.entries(sheet.licences ?? {}))
    if (!Number.isInteger(rank) || rank < 0 || rank > MAX_LICENCE_RANK) problems.push(`${licenceName(catalogue.frames, id)} licence must be a whole rank from 0 to III.`)
    else if (rank > 0 && !catalogue.frames.some(frame => frame.id === id && frame.licenceLevel > 0)) problems.push(`licence ${id} isn't in the loaded licensed frames.`)
  for (const [id, rank] of Object.entries(sheet.talents ?? {}))
    if (!Number.isInteger(rank) || rank < 0 || rank > MAX_TALENT_RANK) problems.push(`talent ${id} must be a whole rank from 0 to III.`)
    else if (rank > 0 && !catalogue.talents?.some(talent => talent.id === id)) problems.push(`talent ${id} isn't in the loaded content packs.`)
  if (catalogue.gear) {
    const layout = loadoutSlots(sheet.pilot_gear ?? [], id => catalogue.gear!.find(item => item.id === id)?.type)
    if (layout.overflow.length) problems.push('pilot gear exceeds its available armour, weapon or gear slots.')
    if (layout.unknown.length) problems.push('pilot gear includes items unavailable in the loaded content packs.')
  }
  if (catalogue.bionicCosts) for (const id of sheet.bionics ?? [])
    if (!catalogue.bionicCosts.has(id)) problems.push(`biomod ${id} isn't in the loaded catalogue.`)
  if (new Set(sheet.bionics ?? []).size !== (sheet.bionics?.length ?? 0)) problems.push('a biomod can only be installed once.')
  problems.push(...coreBonusProblems(sheet, catalogue.frames, catalogue.coreBonuses ?? []))

  for (const [mechId, mech] of Object.entries(sheet.mechs ?? {}))
    for (const problem of mechProblems(mech, sheet, catalogue)) problems.push(`${mechNames[mechId] ?? 'a mech'}: ${problem}`)
  return problems
}
