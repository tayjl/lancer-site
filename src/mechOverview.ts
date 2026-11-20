import { flatDamage } from './damage'

// What the mech page's overview (MechOverview.vue) works out from the equipped weapons: the flat damage per type if every
// weapon fires once, and the shortest and longest reach for each kind of range. Weapons are as their cards show them
// (modifiers applied). Values that aren't plain numbers (a variable range) are left out, never guessed.
type Entry = { type?: unknown; val: string | number }
type Armed = { range: Entry[]; damage: Entry[] }

const number = (value: string | number) => (typeof value === 'number' ? value : /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : null)

export function damageTotals(weapons: Armed[]): { type: string; total: number }[] {
  const totals = new Map<string, number>()
  for (const weapon of weapons)
    for (const entry of weapon.damage) {
      const flat = number(flatDamage(entry.val))
      const type = String(entry.type ?? '').toLowerCase()
      if (flat !== null && type) totals.set(type, (totals.get(type) ?? 0) + flat)
    }
  return [...totals].map(([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total)
}

export function reach(weapons: Armed[]): { type: string; min: number; max: number }[] {
  const reaches = new Map<string, { min: number; max: number }>()
  for (const weapon of weapons)
    for (const entry of weapon.range) {
      const value = number(entry.val)
      const type = String(entry.type ?? '').toLowerCase()
      if (value === null || !type) continue
      const found = reaches.get(type)
      reaches.set(type, { min: Math.min(found?.min ?? value, value), max: Math.max(found?.max ?? value, value) })
    }
  return [...reaches].map(([type, { min, max }]) => ({ type, min, max }))
}

// The radar's axes, the one rule for both radars (the mech card's with this build's stats, the frame information's with
// the frame's own): every stat that differs between frames, size too, in the stat tiles' order, with the tiles' names
// and symbols, each placed between the lowest and highest any frame has ("ranges", from frameRanges); a build with Hull
// or bonuses above every frame just reaches the rim.
export type RadarAxis = { id: string; label: string; value: string; icon?: string | null; at: number }
export function radarAxes(stats: { id: string; name: string; value: number | null; icon?: string | null }[], ranges: Map<string, { min: number; max: number }>): RadarAxis[] {
  return stats.flatMap((stat) => {
    const range = ranges.get(stat.id)
    if (typeof stat.value !== 'number' || !range || range.max <= range.min) return []
    const at = (stat.value - range.min) / (range.max - range.min)
    return [{ id: stat.id, label: stat.name, value: stat.value === 0.5 ? '½' : String(stat.value), icon: stat.icon, at: Math.min(1, Math.max(0, at)) }]
  })
}
