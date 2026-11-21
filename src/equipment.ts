import { bonusValue, resolveBonuses, uncountedLine, type NamedBonus } from './bonuses'
import { flatDamage } from './damage'
import { tagNames, toItem, type Item } from './gameData'
import type { MechPrivate, Sheet } from './myPilot'

export function selectWeaponProfile(item: Item, index = 0): Item {
  const profile = item.profiles?.[index]
  if (!profile) return item
  const selected = toItem(item.id, { ...item.raw, ...profile, name: `${item.name} · ${profile.name ?? `Profile ${index + 1}`}`, profiles: [] })
  return { ...selected, profiles: item.profiles, raw: item.raw, bonuses: [...item.bonuses, ...(Array.isArray(profile.bonuses) ? profile.bonuses : [])] }
}

type WeaponOptions = NonNullable<MechPrivate['weapon_options']>[string]

// The damage types a player can choose for a Prototype weapon (default Kinetic) or a Variable one (no default).
export const DAMAGE_CHOICES = ['Kinetic', 'Explosive', 'Energy']
export const variableDamage = (item: Item) => !item.id.startsWith('mw_prototype_') && item.damage.some(damage => damage.type.toLowerCase() === 'variable')

// Weapon mods (lancer-data's mods.json, docs/lancer-rules.md): one per weapon, never on a weapon that refuses mods or sits
// in an integrated mount. Why a weapon takes no mod at all ("" when it does).
export const modsRefused = (weapon: Item, mount: string) =>
  mount === 'Integrated Auxiliary' ? "An integrated mount can't be modified" : weapon.raw?.no_mods ? `${weapon.name} can't take mods` : ''

// Why this mod can't go on this weapon ("" when it can): the weapon refuses mods, or its type or size isn't one the mod
// allows (a list left empty allows everything). A Prototype weapon counts as the type its player chose.
export function modBlockedBy(mod: Item, weapon: Item, mount: string, options?: WeaponOptions) {
  const refused = modsRefused(weapon, mount)
  if (refused) return refused
  const list = (key: string) => (Array.isArray(mod.raw?.[key]) ? mod.raw[key].map(String) : [])
  const type = weapon.id.startsWith('mw_prototype_') ? options?.type ?? 'Rifle' : weapon.type
  const [types, sizes] = [list('allowed_types'), list('allowed_sizes')]
  if (types.length && !types.includes(type)) return `Fits ${types.join(', ')} only`
  if (sizes.length && !sizes.includes(weapon.mount)) return `Fits ${sizes.join(', ')} only`
  if (list('restricted_types').includes(type)) return `Can't go on ${type} weapons`
  if (list('restricted_sizes').includes(weapon.mount)) return `Can't go on ${weapon.mount} weapons`
  return ''
}

// A conditional bonus never counts; "anyCondition" asks whether it would, were the condition met (for the sources line).
function matches(entry: NamedBonus, item: Item, rangeType?: string, damageType?: string, anyCondition = false) {
  const b = entry.bonus
  if ((b.condition && !anyCondition) || b.detail) return false
  for (const [key, values] of Object.entries({ weapon_types: [item.type], weapon_sizes: [item.mount], range_types: rangeType ? [rangeType] : item.range.map(range => range.type), damage_types: damageType ? [damageType] : item.damage.map(damage => damage.type) })) {
    const filter = b[key]
    if (Array.isArray(filter) && filter.length && !values.some(value => filter.some(allowed => String(allowed).toLowerCase() === value.toLowerCase()))) return false
  }
  return true
}

export function equipmentDetails(item: Item, sheet: Sheet, bonuses: NamedBonus[], options?: NonNullable<MechPrivate['weapon_options']>[string], location?: { mount: number; position: number; integrated?: boolean }, coreMounts: Record<string, number> = {}, mod?: Item) {
  const proto = item.id.startsWith('mw_prototype_')
  const upgraded = proto && Number(item.id.at(-1)) >= 2
  let selected = selectWeaponProfile(item, options?.profile)
  if (proto) {
    const type = options?.type ?? 'Rifle', damageType = options?.damageType ?? 'Kinetic'
    selected = { ...selected, type, damage: selected.damage.map(damage => ({ ...damage, type: damageType })), range: selected.range.filter(range => range.type === (type === 'Melee' ? 'Threat' : 'Range')) }
  }
  else if (options?.damageType && variableDamage(item))
    selected = { ...selected, damage: selected.damage.map(damage => (damage.type.toLowerCase() === 'variable' ? { ...damage, type: options.damageType! } : damage)) }
  const variables = { ll: Object.values(sheet.licences ?? {}).reduce((sum, value) => sum + value, 0), ...sheet.mech_skills }
  const sources: string[] = []
  const applicable = (ids: string[], range?: string, damage?: string) => bonuses.filter(entry => ids.includes(entry.bonus.id) && matches(entry, selected, range, damage)).flatMap(entry => {
    const value = bonusValue(entry.bonus.val, variables)
    return value === null ? [] : [{ source: entry.source, value, replace: !!entry.bonus.replace, overwrite: !!entry.bonus.overwrite }]
  })
  const range = selected.range.map(range => {
    const entries = applicable(['range', ...(range.type === 'Threat' ? ['threat'] : [])], range.type)
    const base = bonusValue(range.val, variables)
    if (base === null) return range
    const result = resolveBonuses(base, entries.map(entry => ({ ...entry, overwrite: false })))
    for (const entry of result.used) sources.push(`${entry.source}: ${entry.value >= 0 ? '+' : ''}${entry.value} ${range.type.toLowerCase()}`)
    return { ...range, val: Math.max(0, result.value) }
  })
  if ((sheet.talents?.t_hunter ?? 0) >= 2 && selected.type === 'Melee' && selected.mount === 'Auxiliary') {
    const thrown = range.find(entry => entry.type === 'Thrown')
    if (thrown) thrown.val = Math.max(5, Number(thrown.val) || 0)
    else range.push({ type: 'Thrown', val: 5 })
    sources.push('Hunter II: Thrown 5. Thrown weapons return at end of turn.')
  }
  const damage = selected.damage.map(damage => {
    const entries = bonuses.filter(entry => entry.bonus.id === 'damage' && !entry.bonus.damage_type && matches(entry, selected, undefined, damage.type)).flatMap(entry => {
      const numeric = bonusValue(entry.bonus.val, variables)
      const expression = numeric === null ? String(entry.bonus.val) : String(numeric)
      return typeof flatDamage(expression) === 'number' ? [{ source: entry.source, expression }] : []
    })
    for (const entry of entries) sources.push(`${entry.source}: ${entry.expression.startsWith('-') ? '' : '+'}${entry.expression} ${damage.type.toLowerCase()} damage`)
    // Round once after summing the complete dice expression and its modifiers.
    return { ...damage, val: flatDamage(`${damage.val}${entries.map(entry => `${entry.expression.startsWith('-') ? '' : '+'}${entry.expression}`).join('')}`) }
  })
  // A damage bonus with a damage_type adds that much of it: to the weapon's entry of that type, or as a new one.
  for (const entry of bonuses.filter(entry => entry.bonus.id === 'damage' && typeof entry.bonus.damage_type === 'string' && matches(entry, selected))) {
    const type = String(entry.bonus.damage_type), extra = bonusValue(entry.bonus.val, variables)
    if (extra === null) continue
    const at = damage.findIndex(have => have.type.toLowerCase() === type.toLowerCase())
    if (at >= 0) damage[at] = { ...damage[at], val: flatDamage(`${damage[at].val}${extra >= 0 ? '+' : ''}${extra}`) }
    else damage.push({ type, val: extra })
    sources.push(`${entry.source}: ${extra >= 0 ? '+' : ''}${extra} ${type.toLowerCase()} damage`)
  }
  // The mod's added range joins the weapon's range of that type (or is a new one) and its tags join the weapon's. A
  // weapon with a mod is "Modded". Added damage isn't counted: it's conditional (Thermal Charge needs a hit and a
  // charge), so it stays in the mod's own rules text, like every conditional effect.
  const added = (key: string) => (Array.isArray(mod?.raw?.[key]) ? mod!.raw![key] as { type: string; id: string; val: number | string }[] : [])
  for (const entry of added('added_range')) {
    const extra = bonusValue(entry.val, variables)
    const at = range.findIndex(item => item.type === entry.type)
    const base = at >= 0 ? bonusValue(range[at].val, variables) : 0
    if (extra === null || base === null) continue
    range[at >= 0 ? at : range.length] = { type: entry.type, val: base + extra }
    sources.push(`${mod!.name}: +${extra} ${entry.type.toLowerCase()}`)
  }
  const already = selected.range.find(range => range.type === 'Thrown')
  if (already) {
    const added = range.find(range => range.type === 'Thrown')
    if (added) added.val = Math.max(Number(already.val) || 0, Number(added.val) || 0)
  }
  const limited = (sheet.mech_skills?.engineering ?? 0) / 2
  const tags = selected.tags.map(tag => {
    if (tag.id !== 'tg_limited') return tag
    const entries = applicable(['limited_bonus'])
    const extra = Math.floor(limited) + entries.reduce((sum, entry) => sum + entry.value, 0)
    if (Math.floor(limited)) sources.push(`Engineering: +${Math.floor(limited)} limited uses`)
    for (const entry of entries) sources.push(`${entry.source}: +${entry.value} limited uses`)
    const base = bonusValue(tag.val, variables)
    return { ...tag, val: base === null ? `${tag.val}${extra ? `+${extra}` : ''}` : base + extra }
  })
  const accuracy = bonuses.filter(entry => ['attack', 'melee'].includes(entry.bonus.id) && matches(entry, selected)).reduce((sum, entry) => sum + (entry.bonus.id !== 'melee' || selected.type === 'Melee' ? bonusValue(entry.bonus.accuracy, variables) ?? 0 : 0), 0)
  const attack = applicable(['attack']).reduce((sum, entry) => sum + entry.value, 0)
  if (attack) sources.push(`Attack roll: ${attack >= 0 ? '+' : ''}${attack}`)
  const auto = location && !location.integrated && sheet.core_bonuses?.includes('cb_auto_stabilizing_hardpoints') && coreMounts.cb_auto_stabilizing_hardpoints === location.mount ? 1 : 0
  const optics = upgraded && options?.accuracy !== false ? 1 : 0
  if (accuracy + (auto || 0) + optics) sources.push(`Accuracy: +${accuracy + (auto || 0) + optics}${auto ? ' (Auto-Stabilizing Hardpoints)' : ''}${optics ? ' (Tweaked Optics)' : ''}`)
  if (options?.smart !== false && upgraded) tags.push({ id: 'tg_smart' })
  // Tags other bonuses add (add_tags: a list of { id, val? }).
  for (const entry of bonuses.filter(entry => entry.bonus.id === 'add_tags' && matches(entry, selected)))
    for (const tag of (Array.isArray(entry.bonus.val) ? entry.bonus.val : []) as { id?: unknown; val?: number | string }[])
      if (typeof tag?.id === 'string' && !tags.some(have => have.id === tag.id)) {
        tags.push(tag.val === undefined ? { id: tag.id } : { id: tag.id, val: tag.val })
        sources.push(`${entry.source}: adds ${tagNames.value.get(tag.id) ?? tag.id}`)
      }
  // Conditional modifiers are named but never counted.
  for (const entry of bonuses) if (['range', 'threat', 'damage', 'add_tags'].includes(entry.bonus.id) && entry.bonus.condition && matches(entry, selected, undefined, undefined, true)) sources.push(uncountedLine(entry.source, entry.bonus, variables))
  if (mod) for (const tag of [...added('added_tags'), { id: 'tg_modded' }]) if (!tags.some(have => have.id === tag.id)) tags.push(tag)
  if (upgraded && (options?.accuracy === false || options?.smart === false)) sources.push('Stripped reactor shielding: Spend 2 Heat to use the alternate area pattern.')
  if (location && sheet.core_bonuses?.includes('cb_overpower_caliber') && coreMounts.cb_overpower_caliber === location.mount * 2 + location.position)
    sources.push('Overpower Caliber: +4 damage on hit, once per round. Not in the damage above.')
  const deployables = Array.isArray(selected.raw?.deployables) ? selected.raw.deployables.map((raw: Record<string, unknown>) => {
    const result = { ...raw }
    for (const key of ['hp', 'evasion', 'edef', 'armor', 'speed', 'heatcap', 'size']) {
      if (typeof raw[key] !== 'number') continue
      const entries = bonuses.filter(entry => [
        `deployable_${key}`, ...(String(raw.type).toLowerCase() === 'drone' ? [`drone_${key}`] : []),
      ].includes(entry.bonus.id) && !entry.bonus.condition && !entry.bonus.detail).flatMap(entry => {
        const value = bonusValue(entry.bonus.val, variables)
        return value === null ? [] : [{ source: entry.source, value, replace: entry.bonus.replace, overwrite: entry.bonus.overwrite }]
      })
      result[key] = resolveBonuses(Number(raw[key]), entries).value
      for (const entry of entries) sources.push(`${entry.source}: ${entry.value >= 0 ? '+' : ''}${entry.value} ${raw.name ?? 'deployable'} ${key}`)
    }
    return result
  }) : []
  return { ...selected, range, damage, tags, sources, raw: { ...selected.raw, deployables } }
}
