import { shallowRef } from 'vue'
import armourIcon from './assets/icons/armour.svg'
import evasionIcon from './assets/icons/evasion.svg'
import eDefIcon from './assets/icons/e_def.svg'
import heatIcon from './assets/icons/heat.svg'
import hpIcon from './assets/icons/hp.svg'
import stressIcon from './assets/icons/reactor.svg'
import repairIcon from './assets/icons/repair.svg'
import structureIcon from './assets/icons/structure.svg'
import systemPointIcon from './assets/icons/system_point.svg'
import speedIcon from './assets/icons/speed.svg'
import techAttackIcon from './assets/icons/tech_attack.svg'
import sizeHalfIcon from './assets/icons/size-half.svg'
import size1Icon from './assets/icons/size-1.svg'
import size2Icon from './assets/icons/size-2.svg'
import size3Icon from './assets/icons/size-3.svg'
import { equippedGear, loadoutSlots, loadSources, loadTagNames, toItem, toMod, type Bonus, type CoreBonus, type Item, type Talent } from './gameData'
import { loadKind } from './catalogue'
import type { MechPrivate, Sheet } from './myPilot'
import { bonusValue, permanentBonus, resolveBonuses, type NamedBonus } from './bonuses'
import { flatDamage, flatDamageText } from './damage'
import { selectWeaponProfile } from './equipment'
import { CORE_CHECK_BONUSES } from './coreRules'
import { capitalise, sameName } from './text'

// The mech page's catalogues (frames, mech weapons, systems, from the imported LANCER packs) and its rules:
// which weapons fit which mount, and the mech's stats. Mechs only store ids; everything else comes from here.

// A frame as lancer-data has it, cut down: its mounts (e.g. Flex, Main, Heavy), its base stats, the licence
// rank it needs in its own licence (2; 0 for GMS frames) and the weapons and systems built into it.
export type Frame = {
  id: string
  name: string
  source: string
  licenceLevel: number
  integrated: string[]
  mechtype: string[]
  mounts: string[]
  stats: Record<string, number>
  description: string
  raw?: Record<string, unknown>
}

// Which weapon sizes each place on a mount takes. Most mounts hold one weapon; Flex, Main/Aux and Aux/Aux hold two.
const MOUNT_SLOTS: Record<string, string[][]> = {
  Auxiliary: [['Auxiliary']],
  'Integrated Auxiliary': [['Auxiliary']],
  Main: [['Main', 'Auxiliary']],
  // A Superheavy weapon also needs a second, empty mount: see bracingMount() in src/rules.ts.
  Heavy: [['Superheavy', 'Heavy', 'Main', 'Auxiliary']],
  Flex: [['Main', 'Auxiliary'], ['Auxiliary']],
  'Main/Aux': [['Main', 'Auxiliary'], ['Auxiliary']],
  'Aux/Aux': [['Auxiliary'], ['Auxiliary']],
}

// What a mount takes, in words (the loadout's empty states, the frame form).
export const MOUNT_HINTS: Record<string, string> = {
  Main: 'Takes one Main or Auxiliary weapon.',
  Heavy: 'Takes one weapon of any size.',
  Flex: 'Takes one Main or two Auxiliary weapons.',
  'Main/Aux': 'Takes one Main and one Auxiliary weapon.',
  'Aux/Aux': 'Takes two Auxiliary weapons.',
}

// How many weapons a mount holds.
export const mountSize = (mount: string) => MOUNT_SLOTS[mount]?.length ?? 1

// The weapon sizes place "index" on a mount takes, given the sizes already on it (null where empty).
// A Flex mount holds one Main weapon or two Auxiliary ones, so a Main weapon closes its second place.
export function allowedSizes(mount: string, index: number, sizesOnMount: (string | null)[]) {
  const allowed = MOUNT_SLOTS[mount]?.[index] ?? []
  if (mount !== 'Flex') return allowed
  if (index === 0) return sizesOnMount[1] ? ['Auxiliary'] : allowed
  return sizesOnMount[0] === 'Main' ? [] : allowed
}

// LANCER's mech stats, in COMP/CON's order, with their symbols (src/assets/icons: COMP/CON's, plus Material
// Design's heart and shield, as COMP/CON uses for hp and armour). Worked out from the frame and the pilot's
// HASE (unset skills count as 0, like the pilot sheet), never stored. No grit (homebrew rule).
const MECH_STATS = [
  ['structure', 'Structure', structureIcon],
  ['stress', 'Stress', stressIcon],
  ['hp', 'HP', hpIcon],
  ['heat', 'Heat cap', heatIcon],
  ['armour', 'Armour', armourIcon],
  ['evasion', 'Evasion', evasionIcon],
  ['speed', 'Speed', speedIcon],
  ['edef', 'E-defence', eDefIcon],
  ['tech_attack', 'Tech attack', techAttackIcon],
  ['repair', 'Repair cap', repairIcon],
  ['system_points', 'System points', systemPointIcon],
  ['size', 'Size', undefined],
] as const
// Size's symbol shows the size itself.
const SIZE_ICONS: Record<string, string> = { 0.5: sizeHalfIcon, 1: size1Icon, 2: size2Icon, 3: size3Icon }

const BONUS_STATS: Record<string, string> = {
  structure: 'structure', stress: 'stress', hp: 'hp', heatcap: 'heat', heat_cap: 'heat',
  armor: 'armour', evasion: 'evasion', speed: 'speed', edef: 'edef',
  tech_attack: 'tech_attack', repcap: 'repair', sp: 'system_points',
  size: 'size', armor_max: 'armor_max', ai_cap: 'ai_cap', limited_bonus: 'limited_bonus',
}
// The weapon in a place on the mech ("mount:place", like weapon_options), or undefined when the frame has no such place
// or it's empty.
export function weaponAt(mech: MechPrivate, frame: Frame, key: string) {
  const [m, i] = key.split(':').map(Number)
  return frame.mounts[m] && i < mountSize(frame.mounts[m]) ? mech.mounts?.[m]?.[i] ?? undefined : undefined
}
// The mods on weapons that are there: [place, mod id]. A mod whose place holds no weapon is stray: it counts for nothing.
export const fittedMods = (mech: MechPrivate, frame: Frame | null) =>
  Object.entries(mech.weapon_mods ?? {}).filter(([key]) => frame && weaponAt(mech, frame, key))

export type StatModifier = { stat: string; source: string; value: number; replace: boolean; overwrite: boolean }
export type EffectCatalogue = {
  frames?: Frame[]
  weapons: Map<string, Item>
  systems: Map<string, Item>
  integrated: Map<string, Item>
  mods?: Map<string, Item>
  talents?: Talent[]
  coreBonuses?: CoreBonus[]
  gear?: Item[]
}

export function talentGrants(sheet: Sheet, talents: Talent[]) {
  const integrated = new Set<string>(), optional = new Set<string>()
  for (const talent of talents) {
    const rank = sheet.talents?.[talent.id] ?? 0
    const ranks = talent.ranks.slice(0, Number.isInteger(rank) ? Math.max(0, Math.min(3, rank)) : 0)
    const exclusive = ranks.reduce((last, entry, index) => entry.exclusive ? index : last, -1)
    ranks.forEach((entry, index) => {
      if (entry.exclusive && index !== exclusive) return
      for (const id of entry.integrated ?? []) integrated.add(id)
      for (const id of entry.special_equipment ?? []) optional.add(id)
    })
  }
  return { integrated: [...integrated], optional: [...optional] }
}

export function buildFrame(frame: Frame | null, mech: MechPrivate, sheet: Sheet, talents: Talent[], bonuses: NamedBonus[] = []): Frame | null {
  if (!frame) return null
  const mounts = [...frame.mounts]
  const taken = new Set(sheet.core_bonuses ?? [])
  if (taken.has('cb_improved_armament') && mounts.length < 3) mounts.push('Flex')
  if (taken.has('cb_mount_retrofitting')) {
    const index = mech.core_mounts?.cb_mount_retrofitting
    if (Number.isInteger(index) && index! >= 0 && index! < mounts.length) mounts[index!] = 'Main/Aux'
  }
  for (const { bonus } of bonuses) {
    if (bonus.id !== 'add_mount' || !permanentBonus(bonus)) continue
    const type = String(bonus.val)
    if (type in MOUNT_SLOTS && (!Number.isFinite(bonus.max) || mounts.length < Number(bonus.max)) && mounts.length < 20) mounts.push(type)
  }
  if (taken.has('cb_integrated_weapon')) mounts.push('Integrated Auxiliary')
  return { ...frame, mounts, integrated: [...new Set([...frame.integrated, ...talentGrants(sheet, talents).integrated])] }
}

export const buildVariables = (sheet: Sheet, frame?: Frame | null) => ({
  ll: Object.values(sheet.licences ?? {}).reduce((sum, rank) => sum + rank, 0),
  hull: sheet.mech_skills?.hull ?? 0, agility: sheet.mech_skills?.agility ?? 0,
  systems: sheet.mech_skills?.systems ?? 0, engineering: sheet.mech_skills?.engineering ?? 0,
  size: frame?.stats.size ?? 1,
})

// What a reminder is about, for the mech page's "other effects and conditions" list: its kind (a symbol and an
// uppercase label there), its own name, and where it comes from (the talent and rank, the core system).
export type ReminderKind = 'frame' | 'trait' | 'core' | 'core-power' | 'core-bonus' | 'talent' | 'item' | 'missing'
type Origin = { kind: ReminderKind; name: string; from?: string }
// "source" names it in one line, as the stat sources do. "uncounted": a bonus the stats leave out (a condition, an
// expression, an unsupported stat), which the page says isn't counted.
export type Reminder = Origin & { source: string; text: string; activation?: string; uncounted?: boolean }

// Names compared the way people read them: "Grapple cable" is "Grapple Cable".

const listOf = (value: unknown) => (Array.isArray(value) ? value : []) as Bonus[]
// coreRules.ts's supplement only adds what the structured data leaves out: a check modifier the data already carries
// (newer lancer-data gives Exposed Reactor its bonus) is not added a second time.
const missingFrom = (extra: Bonus[] | undefined, have: Bonus[]) =>
  (extra ?? []).filter(add => !have.some(bonus => bonus?.id === add.id && bonus.accuracy === add.accuracy && (add.accuracy !== undefined || JSON.stringify(bonus.val) === JSON.stringify(add.val))))

// Only equipped equipment and purchased talent ranks contribute. Actions, active core powers, conditional and
// unsupported bonuses remain explicit reminders: guessing whether a conditional effect is active would give
// misleading totals. Equipped items' rules aren't repeated: their own loadout cards already show them.
export function mechEffects(mech: MechPrivate, sheet: Sheet, catalogue: EffectCatalogue) {
  const sources: { name: string; bonuses: Bonus[]; origin: Origin }[] = []
  const reminders: Reminder[] = []
  const addItem = (id: string, items: Map<string, Item>, key = id) => {
    const item = items.get(id) ?? catalogue.integrated.get(id)
    if (item) {
      const selected = selectWeaponProfile(item, mech.weapon_options?.[key]?.profile ?? 0)
      addRaw(selected.name, '', { ...selected.raw, bonuses: selected.bonuses }, { kind: 'item', name: selected.name }, false)
    }
    else reminders.push({ kind: 'missing', name: id, source: id, text: "Missing item. Its bonuses aren't counted." })
  }
  // A Unique item duplicated on an invalid loadout must not grant its bonuses twice.
  const baseFrame = catalogue.frames?.find(frame => frame.id === mech.frame)
  const mountSources = [
    ...(catalogue.coreBonuses ?? []).filter(bonus => sheet.core_bonuses?.includes(bonus.id)),
    ...(catalogue.talents ?? []).flatMap(talent => talent.ranks.slice(0, Math.min(3, Math.max(0, sheet.talents?.[talent.id] ?? 0)))),
    ...(mech.systems ?? []).flatMap(id => { const item = catalogue.systems.get(id) ?? catalogue.integrated.get(id); return item ? [item] : [] }),
    ...(baseFrame?.raw ? [baseFrame.raw, ...(Array.isArray(baseFrame.raw.traits) ? baseFrame.raw.traits as Record<string, unknown>[] : [])] : []),
    ...(baseFrame?.raw?.core_system ? [{ bonuses: (baseFrame.raw.core_system as Record<string, unknown>).passive_bonuses }] : []),
  ]
  const mountBonuses = mountSources.flatMap(source => Array.isArray(source.bonuses) ? (source.bonuses as Bonus[]).filter(bonus => bonus?.id === 'add_mount').map(bonus => ({ source: '', bonus })) : [])
  const frame = buildFrame(baseFrame ?? null, mech, sheet, catalogue.talents ?? [], mountBonuses)
  const addRaw = (name: string, text: unknown, raw: Record<string, unknown>, origin: Origin, remind = true) => {
    sources.push({ name, bonuses: Array.isArray(raw.bonuses) ? raw.bonuses as Bonus[] : [], origin })
    if (!remind) return
    const actions: Reminder[] = []
    // Not "synergies": COMP/CON's hints that repeat the rules text already listed.
    for (const key of ['actions', 'active_actions', 'passive_actions', 'active_effects']) {
      if (!Array.isArray(raw[key])) continue
      for (const action of raw[key] as Record<string, unknown>[]) {
        if (!action || typeof action !== 'object' || !(action.detail || action.description)) continue
        // "Reactive Code · reaction" rather than "Reactive Code · Reactive Code".
        const label = action.name && name.endsWith(String(action.name)) ? String(action.activation ?? 'action').toLowerCase() : action.name ?? key.replaceAll('_', ' ')
        const trigger = action.trigger ? `<b>Trigger:</b> ${action.trigger}<br><b>Effect:</b> ` : ''
        actions.push({
          ...origin,
          name: String(action.name ?? origin.name),
          activation: action.activation ? String(action.activation) : undefined,
          source: `${name} · ${label}`,
          text: flatDamageText(`${trigger}${action.detail ?? action.description}`),
        })
      }
    }
    // An action named like its trait (or core system) repeats it: show it once, with the action's chip and text.
    const twins = actions.filter(action => sameName(action.name, origin.name))
    const twin = twins.find(action => action.activation) ?? twins.sort((a, b) => b.text.length - a.text.length)[0]
    if (twin) reminders.push({ ...origin, activation: twin.activation, source: name, text: twin.text })
    else if (text) reminders.push({ ...origin, source: name, text: flatDamageText(String(text)) })
    reminders.push(...actions.filter(action => !twins.includes(action)))
  }
  if (baseFrame?.raw) {
    // The frame's description is lore, not rules.
    addRaw(baseFrame.name, '', baseFrame.raw, { kind: 'frame', name: baseFrame.name })
    for (const trait of (Array.isArray(baseFrame.raw.traits) ? baseFrame.raw.traits : []) as Record<string, unknown>[])
      // "from" keeps the trait's name on its actions and bonuses too, so the mech page groups them on the trait's card.
      addRaw(`${baseFrame.name} · ${trait.name ?? 'trait'}`, trait.description, trait, { kind: 'trait', name: String(trait.name ?? 'Trait'), from: String(trait.name ?? 'Trait') })
    const core = baseFrame.raw.core_system as Record<string, unknown> | undefined
    if (core) {
      addRaw(`${core.name ?? 'core system'} · passive`, core.passive_effect, { ...core, bonuses: core.passive_bonuses ?? [] }, { kind: 'core', name: String(core.passive_name ?? core.name ?? 'Core system'), from: core.name ? String(core.name) : undefined })
      if (core.active_effect) {
        // The core power's own action (same name) is listed once, as the power, with the action's chip and text.
        const power = String(core.active_name ?? core.name)
        const twin = reminders.findIndex(entry => entry.kind === 'core' && sameName(entry.name, power))
        const [action] = twin >= 0 ? reminders.splice(twin, 1) : []
        reminders.push({
          kind: 'core-power',
          name: power,
          from: core.name ? String(core.name) : undefined,
          activation: action?.activation,
          source: `${power} · active core power`,
          text: action?.text ?? flatDamageText(String(core.active_effect)),
        })
      }
    }
  }
  if (baseFrame?.raw) {
    const core = baseFrame.raw.core_system as Record<string, unknown> | undefined
    const have = [...listOf(baseFrame.raw.bonuses), ...(listOf(baseFrame.raw.traits) as Record<string, unknown>[]).flatMap(trait => listOf(trait?.bonuses)), ...listOf(core?.passive_bonuses)]
    const extra = missingFrom(CORE_CHECK_BONUSES[baseFrame.id], have)
    if (extra.length) sources.push({ name: baseFrame.name, bonuses: extra, origin: { kind: 'frame', name: baseFrame.name } })
  }
  // Pilot gear only counts for any mech bonuses it has (homebrew); its rules and pilot_* bonuses stay on the pilot.
  if (catalogue.gear) {
    const byId = new Map(catalogue.gear.map(item => [item.id, item]))
    const layout = loadoutSlots(equippedGear(sheet).map(owned => owned.id), id => byId.get(id)?.type)
    for (const slot of layout.slots) {
      const item = slot.id ? byId.get(slot.id) : undefined
      if (item) sources.push({ name: item.name, bonuses: item.bonuses.filter(bonus => !bonus.id.startsWith('pilot_')), origin: { kind: 'item', name: item.name } })
    }
  }
  const mounts = frame ? (mech.mounts ?? []).slice(0, frame.mounts.length).map((places, index) => places.slice(0, mountSize(frame.mounts[index]))) : mech.mounts ?? []
  const builtIn = new Set(frame?.integrated ?? [])
  for (const id of builtIn) addItem(id, catalogue.integrated, `integrated:${id}`)
  const equipped = [...(mech.systems ?? []).map(id => ({ id, items: catalogue.systems })),
    ...mounts.flatMap((places, m) => places.flatMap((id, i) => id ? [{ id, items: catalogue.weapons, key: `${m}:${i}` }] : []))].filter(entry => !builtIn.has(entry.id))
    // A mod counts like any other equipped item (its bonuses, and Unique once).
    .concat(fittedMods(mech, frame).map(([, id]) => ({ id, items: catalogue.mods ?? new Map(), key: id })))
  const unique = new Set<string>()
  for (const entry of equipped) {
    const { id, items } = entry
    const item = items.get(id) ?? catalogue.integrated.get(id)
    if (item?.tags.some(tag => tag.id === 'tg_unique')) {
      if (unique.has(id)) continue
      unique.add(id)
    }
    addItem(id, items, 'key' in entry ? String(entry.key) : id)
  }
  for (const id of new Set(sheet.core_bonuses ?? [])) {
    const bonus = catalogue.coreBonuses?.find(bonus => bonus.id === id)
    if (bonus) {
      addRaw(bonus.name, bonus.effect, bonus, { kind: 'core-bonus', name: bonus.name })
      const extra = missingFrom(CORE_CHECK_BONUSES[id], listOf(bonus.bonuses))
      if (extra.length) sources.push({ name: bonus.name, bonuses: extra, origin: { kind: 'core-bonus', name: bonus.name } })
    }
    else reminders.push({ kind: 'missing', name: id, source: id, text: "Missing core bonus. Its bonuses aren't counted." })
  }
  for (const [id, rank] of Object.entries(sheet.talents ?? {})) {
    if (!Number.isInteger(rank) || rank <= 0) continue
    const talent = catalogue.talents?.find(talent => talent.id === id)
    if (!talent) reminders.push({ kind: 'missing', name: id, source: id, text: "Missing talent. Its bonuses aren't counted." })
    talent?.ranks.slice(0, Math.min(rank, 3)).forEach((entry, index) => {
      addRaw(`${talent.name} ${index + 1}: ${entry.name}`, entry.description, entry, { kind: 'talent', name: entry.name, from: `${talent.name} ${['I', 'II', 'III'][index]}` })
    })
  }
  const modifiers: StatModifier[] = []
  const bonuses: NamedBonus[] = []
  const variables = buildVariables(sheet, frame)
  for (const source of sources) {
    for (const bonus of source.bonuses) {
      if (!bonus || typeof bonus !== 'object') continue
      if (bonus.id === 'pilot_evasion') continue
      bonuses.push({ source: source.name, bonus })
      const stat = BONUS_STATS[bonus.id]
      const calculated = bonusValue(bonus.val, variables)
      const numeric = calculated !== null
      const value = calculated ?? NaN
      // Filters, expressions and conditions require game state that this character manager doesn't track.
      const unsupported = !permanentBonus(bonus) || Object.keys(bonus).some(key => !['id', 'val', 'replace', 'overwrite', 'condition', 'detail', 'damage_types', 'range_types', 'weapon_types', 'weapon_sizes'].includes(key))
      if (stat && Number.isFinite(value) && !unsupported
        && (bonus.replace === undefined || typeof bonus.replace === 'boolean')
        && (bonus.overwrite === undefined || typeof bonus.overwrite === 'boolean'))
        modifiers.push({ stat, source: source.name, value, replace: !!bonus.replace, overwrite: !!bonus.overwrite })
      else if (bonus.condition || bonus.detail || (!['range', 'damage', 'attack', 'threat', 'add_mount', 'overcharge', 'cheap_struct', 'superheavy_mounting', 'drone_hp', 'deployable_hp'].includes(bonus.id) && bonus.accuracy === undefined)) reminders.push({ ...source.origin, source: source.name, text: bonusReminder(bonus, numeric ? value : null), uncounted: true })
    }
  }
  return { modifiers, bonuses, reminders }
}

// "+10 hp, only when exposed." Bonus ids and {braces} are data, not wording.
function bonusReminder(bonus: Bonus, value: number | null) {
  const what = `${value === null ? '' : `${value >= 0 ? '+' : ''}${value} `}${String(bonus.id ?? 'unknown bonus').replaceAll('_', ' ')}`
  const when = bonus.condition ? `, only when ${String(bonus.condition).replace(/[{}]/g, '')}` : ''
  return `${what}${when}.${bonus.detail ? ` ${bonus.detail}` : ''}`
}

export function mechResources(sheet: Sheet, effects: ReturnType<typeof mechEffects>) {
  const count = (id: string, base = 0) => resolveBonuses(base, effects.modifiers.filter(entry => entry.stat === id)).value
  const overcharge = effects.bonuses.find(entry => entry.bonus.id === 'overcharge' && permanentBonus(entry.bonus) && Array.isArray(entry.bonus.val))
  const checks = effects.bonuses.filter(entry => !entry.bonus.condition && !entry.bonus.detail && typeof entry.bonus.accuracy === 'number' && !['attack', 'melee'].includes(entry.bonus.id))
    .map(entry => ({ source: entry.source, text: `${Number(entry.bonus.accuracy) >= 0 ? '+' : ''}${entry.bonus.accuracy} accuracy on ${entry.bonus.id.replaceAll('_', ' ')} checks` }))
  return {
    aiCap: Math.max(0, count('ai_cap', 1)),
    limited: Math.floor((sheet.mech_skills?.engineering ?? 0) / 2) + count('limited_bonus'),
    overcharge: (overcharge ? (overcharge.bonus.val as unknown as string[]) : ['1', '1d3', '1d6', '1d6+4']).map(step => flatDamage(step)).join(' → '),
    structureRepairs: effects.bonuses.some(entry => entry.bonus.id === 'cheap_struct' && permanentBonus(entry.bonus) && bonusValue(entry.bonus.val) === 1) ? 1 : 2,
    superheavyMounting: effects.bonuses.some(entry => entry.bonus.id === 'superheavy_mounting' && permanentBonus(entry.bonus) && entry.bonus.val !== 0 && entry.bonus.val !== '0'),
    checks,
  }
}

export function mechStats(frame: Frame | null, skills: Record<string, number> | undefined, modifiers: StatModifier[] = []) {
  const skill = (id: string) => skills?.[id] ?? 0
  const s = frame?.stats ?? {}
  const values: Record<string, number> = {
    structure: s.structure,
    stress: s.stress,
    hp: s.hp + 2 * skill('hull'),
    heat: s.heatcap + skill('engineering'),
    armour: s.armor,
    evasion: s.evasion + skill('agility'),
    speed: s.speed + Math.floor(skill('agility') / 2),
    edef: s.edef + skill('systems'),
    tech_attack: s.tech_attack + skill('systems'),
    repair: s.repcap + Math.floor(skill('hull') / 2),
    system_points: s.sp + Math.floor(skill('systems') / 2),
    size: s.size ?? 1,
  }
  const hase: Record<string, [string, number]> = {
    hp: ['hull', 2 * skill('hull')], heat: ['engineering', skill('engineering')],
    evasion: ['agility', skill('agility')], speed: ['agility', Math.floor(skill('agility') / 2)],
    edef: ['systems', skill('systems')], tech_attack: ['systems', skill('systems')],
    repair: ['hull', Math.floor(skill('hull') / 2)], system_points: ['systems', Math.floor(skill('systems') / 2)],
  }
  return MECH_STATS.map(([id, name, icon]) => {
    const matching = modifiers.filter(modifier => modifier.stat === id)
    const resolved = resolveBonuses(values[id], matching)
    let value = resolved.value
    const contributors = !resolved.usesBase ? [] : [
      `Base: ${values[id] - (hase[id]?.[1] ?? 0)}`,
      ...(hase[id]?.[1] ? [`${capitalise(hase[id][0])}: +${hase[id][1]}`] : []),
    ]
    for (const entry of resolved.used) contributors.push(`${entry.source}: ${entry.replace ? 'sets to ' : entry.value >= 0 ? '+' : ''}${entry.value}${entry.overwrite && !entry.replace ? ' (highest wins)' : ''}`)
    if (id === 'armour') {
      const armourMax = resolveBonuses(4, modifiers.filter(entry => entry.stat === 'armor_max')).value
      if (value > armourMax) { value = armourMax; contributors.push(`Armour maximum: ${armourMax}`) }
    }
    if (id === 'size' && matching.length) {
      const steps = [0.5, 1, 2, 3]
      value = resolved.usesBase ? steps[Math.min(3, Math.max(0, steps.indexOf(s.size ?? 1) + Math.trunc(value - (s.size ?? 1))))] : Math.min(3, Math.max(0.5, value))
    }
    return { id, name, icon: id === 'size' ? SIZE_ICONS[value] ?? size1Icon : icon, value: frame ? value : null, contributors: frame ? contributors : [] }
  })
}

// Every "integrated" list inside a frame (core systems and traits): weapons and systems built into it.
function integratedIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(integratedIds)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, inner]) =>
    key === 'integrated' && Array.isArray(inner) ? inner.map(String) : integratedIds(inner),
  )
}

// An alternate frame (Worldkiller, an alternate Genghis) shares its original's licence. The packs mark one with
// `variant` (the original's name) and usually `license_id` (the original's id); some leave `license_id` out, so the name
// is the fallback. A frame that is its own licence (license_id = its id, no variant) is an original.
export function alternateOf(frame: Frame, frames: Frame[]): Frame | undefined {
  const id = String(frame.raw?.license_id ?? '')
  const variant = String(frame.raw?.variant ?? '')
  return frames.find((f) => f.id !== frame.id && f.id === id) ?? (variant ? frames.find((f) => f.id !== frame.id && f.name === variant && !f.raw?.variant) : undefined)
}

// The licences a pilot can buy: one per original licensed frame, never an alternate.
export const licensedFrames = (frames: Frame[]) => frames.filter((f) => f.licenceLevel > 0 && !alternateOf(f, frames))

// The frames one licence can give: the original, then its licensed alternates.
export const licenceFrames = (original: Frame, frames: Frame[]) => [original, ...frames.filter((f) => f.licenceLevel > 0 && alternateOf(f, frames)?.id === original.id)]

// The frame a pilot's licence gives: their choice (sheet.frame_choices) if it is one of the licence's frames, else the original.
export const chosenFrame = (original: Frame, frames: Frame[], choices: Record<string, string> | undefined) =>
  licenceFrames(original, frames).find((f) => f.id === choices?.[original.id]) ?? original

// Licence names by licence (frame) id, e.g. "IPS-N Drake", shared by every page once the frames have loaded.
export const licenceNames = shallowRef(new Map<string, string>())

// A frame from its pack data (also the content editor's preview).
export function toFrame(id: string, data: unknown): Frame {
  const frame = (data ?? {}) as Record<string, unknown>
  return {
    id,
    name: String(frame.name ?? id),
    source: String(frame.source ?? ''),
    licenceLevel: Number(frame.license_level ?? 0) || 0,
    integrated: integratedIds(frame),
    mechtype: Array.isArray(frame.mechtype) ? frame.mechtype.map(String) : [],
    mounts: Array.isArray(frame.mounts) ? frame.mounts.map(String) : [],
    stats: (frame.stats ?? {}) as Record<string, number>,
    description: String(frame.description ?? ''),
    raw: frame,
  }
}

export function useMechData() {
  const frames = shallowRef<Frame[]>([])
  const weapons = shallowRef<Item[]>([])
  const systems = shallowRef<Item[]>([])
  const mods = shallowRef<Item[]>([])
  // Weapons and systems built into frames, by id: shown on the mech, never picked.
  const integrated = shallowRef(new Map<string, Item>())

  async function load() {
    loadTagNames()
    loadSources()
    const rows = (await Promise.all(['frames', 'weapons', 'systems', 'mods', 'talents'].map(loadKind))).flatMap((result) => result.rows)
    const frameRows = rows.filter((row) => row.kind === 'frames')
    // Built-in and talent-only items can't be picked: they come with a frame or a talent.
    const talentEquipment = rows.filter(row => row.kind === 'talents').flatMap(row => {
      const ranks = (row.data as unknown as Talent)?.ranks ?? []
      return ranks.flatMap(rank => [...(rank.integrated ?? []), ...(rank.special_equipment ?? [])])
    })
    const builtIn = new Set([...frameRows.flatMap((row) => integratedIds(row.data)), ...talentEquipment])
    const pickable = (kind: string) =>
      rows
        .filter((row) => row.kind === kind && !builtIn.has(row.id) && !(row.data as { talent_item?: boolean } | null)?.talent_item)
        .map((row) => relicensed(toItem(row.id, row.data)))

    frames.value = frameRows
      .map(({ id, data }) => toFrame(id, data))
      .sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name))
    // Gear naming an alternate frame's licence counts under the original's.
    const original = new Map(frames.value.flatMap((f) => { const o = alternateOf(f, frames.value); return o ? [[f.id, o.id] as const] : [] }))
    const relicensed = (item: Item): Item => (original.has(item.licenceId) ? { ...item, licenceId: original.get(item.licenceId)! } : item)
    integrated.value = new Map(
      rows.filter((row) => row.kind !== 'frames' && (builtIn.has(row.id) || (row.data as { talent_item?: boolean })?.talent_item)).map((row) => [row.id, relicensed(toItem(row.id, row.data))]),
    )
    licenceNames.value = new Map(frames.value.map((f) => [f.id, `${f.source} ${f.name}`]))
    weapons.value = pickable('weapons').sort((a, b) => a.name.localeCompare(b.name))
    systems.value = pickable('systems').sort((a, b) => a.name.localeCompare(b.name))
    mods.value = rows.filter(row => row.kind === 'mods').map(row => relicensed(toMod(row.id, row.data))).sort((a, b) => a.name.localeCompare(b.name))
  }

  load()

  return { frames, weapons, systems, mods, integrated }
}
