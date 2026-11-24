import { beforeEach, describe, expect, it, vi } from 'vitest'
import definitionsSql from '../supabase/migrations/20261124120000_game_definitions.sql?raw'
import { DEFAULT_DEFINITIONS, defColour, defData, defIcon, defIds, defLabel, defList, definitionRows, loadDefinitions, type DefKind } from './definitions'
import { mountHint, mountSlots } from './definitions'
import { allowedSizes, mountSize } from './mechData'
import { activationOf, symbolOf } from './itemDetails'
import { actionKey } from './combatEntries'

const fetched = vi.hoisted(() => ({ result: { rows: [] as unknown[], error: null as string | null } }))
vi.mock('./lib/supabaseClient', () => ({ supabase: { from: () => ({}) }, fetchAll: async () => fetched.result }))

// The seed's rows, as the migration writes them.
const seed = [...definitionsSql.matchAll(/^\s*\('(\w+)', '([^']*)', '([^']*)', '(\{.*?\})', (\d+)\)[,;]$/gm)]
  .map(([, kind, id, label, data, sort]) => ({ kind, id, label, data: JSON.parse(data), sort: Number(sort) }))
const row = (kind: string, id: string, extra: object = {}) => ({ kind, id, label: id, data: {}, sort: 0, hidden: false, ...extra })

describe('built-in definitions', () => {
  it('equal the migration seed', () => {
    expect(seed.length).toBeGreaterThan(60)
    for (const kind of Object.keys(DEFAULT_DEFINITIONS) as DefKind[]) {
      const rows = seed.filter((r) => r.kind === kind).sort((a, b) => a.sort - b.sort)
      expect(DEFAULT_DEFINITIONS[kind].map((d) => ({ id: d.id, label: d.label, data: d.data })), kind).toEqual(rows.map((r) => ({ id: r.id, label: r.label, data: r.data })))
    }
  })

  it('give the same look as before', () => {
    expect(defIds('damage_types')).toEqual(['Kinetic', 'Energy', 'Explosive', 'Burn', 'Heat', 'Variable'])
    expect(defIds('range_types')).toEqual(['Range', 'Threat', 'Line', 'Cone', 'Blast', 'Burst'])
    expect(defIds('uses')).toHaveLength(8)
    expect(defColour('damage_types', 'burn')).toBe('var(--dmg-burn)')
    expect(activationOf('Quick Tech')).toEqual({ colour: '--act-tech', icon: 'tech_quick' })
    expect(actionKey('Quick Tech')).toBe('tech')
    expect(symbolOf('thrown')).toBeTruthy()
    expect(symbolOf('Kinetic')).toBeTruthy()
  })
})

describe('mount types', () => {
  beforeEach(() => { definitionRows.value = null })

  it('give the same places and hints as before', () => {
    expect(mountSlots('Flex')).toEqual([['Main', 'Auxiliary'], ['Auxiliary']])
    expect(mountSize('Aux/Aux')).toBe(2)
    expect(mountSize('Unknown')).toBe(1)
    expect(allowedSizes('Flex', 0, [null, 'Auxiliary'])).toEqual(['Auxiliary'])
    expect(allowedSizes('Heavy', 0, [null])).toEqual(['Superheavy', 'Heavy', 'Main', 'Auxiliary'])
    expect(mountHint('Main')).toBe('Takes one Main or Auxiliary weapon.')
    expect(mountHint('Auxiliary')).toBeUndefined()
    expect(mountSlots('Nope')).toBeUndefined()
  })

  it('take the places of an owner-added mount from its row, and survive bad data', () => {
    definitionRows.value = [
      row('mount_types', 'Triple', { data: { slots: [['Main'], ['Auxiliary'], ['Auxiliary']], hint: 'Three.' } }),
      row('mount_types', 'Broken', { data: { slots: 'x' } }),
    ]
    expect(mountSize('Triple')).toBe(3)
    expect(allowedSizes('Triple', 2, [null, null, null])).toEqual(['Auxiliary'])
    expect(mountHint('Triple')).toBe('Three.')
    expect(mountSlots('Broken')).toBeUndefined()
    expect(mountSize('Broken')).toBe(1)
  })
})

describe('loaded definitions', () => {
  beforeEach(() => { definitionRows.value = null })

  it('use the defaults before the load and when it fails', async () => {
    fetched.result = { rows: [], error: 'offline' }
    await loadDefinitions()
    expect(defIds('damage_types')).toContain('Kinetic')
    expect(defLabel('damage_types', 'Nope')).toBe('Nope')
  })

  it('use the defaults for a kind with no rows', async () => {
    fetched.result = { rows: [row('uses', 'Day')], error: null }
    await loadDefinitions()
    expect(defIds('damage_types')).toContain('Kinetic')
    expect(defIds('uses')).toEqual(['Day'])
  })

  it('hide hidden rows unless asked, keep their label, and sort', () => {
    definitionRows.value = [row('damage_types', 'B', { sort: 2 }), row('damage_types', 'A', { sort: 1, label: 'Alpha' }), row('damage_types', 'H', { sort: 0, hidden: true })]
    expect(defIds('damage_types')).toEqual(['A', 'B'])
    expect(defIds('damage_types', true)).toEqual(['H', 'A', 'B'])
    expect(defList('damage_types').map((d) => d.label)).toEqual(['Alpha', 'B'])
    expect(defLabel('damage_types', 'H')).toBe('H')
  })

  it('show a new owner-added row with its icon and colour, and never throw on bad ones', () => {
    definitionRows.value = [
      row('damage_types', 'Plasma', { label: 'Plasma', data: { icon: 'burn', colour: '--dmg-burn' } }),
      row('damage_types', 'Odd', { data: { icon: 'nope', colour: '#ff0000' } }),
      row('activations', 'Stance', { data: { icon: 'nope', colour: 'red' } }),
    ]
    expect(defIcon('damage_types', 'plasma')).toBe('burn')
    expect(defColour('damage_types', 'Plasma')).toBe('var(--dmg-burn)')
    expect(defIcon('damage_types', 'Odd')).toBeUndefined()
    expect(defColour('damage_types', 'Odd')).toBeUndefined()
    expect(symbolOf('Plasma')).toBeTruthy()
    expect(activationOf('Stance')).toEqual({ colour: '--text-dim', icon: 'generic_item' })
    expect(actionKey('Stance')).toBe('free')
    expect(activationOf('Missing')).toBeNull()
    expect(defData('damage_types', 'Missing')).toEqual({})
  })
})
