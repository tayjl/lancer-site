import { describe, expect, it } from 'vitest'
import { damageTotals, radarAxes, reach } from './mechOverview'

describe('mech overview', () => {
  const rifle = { range: [{ type: 'Range', val: 10 }], damage: [{ type: 'Kinetic', val: '1d6' }] }
  const sword = { range: [{ type: 'Threat', val: 1 }, { type: 'Range', val: 3 }], damage: [{ type: 'Kinetic', val: 2 }, { type: 'Energy', val: '1d3' }] }

  it('adds flat damage per type, biggest first', () => {
    expect(damageTotals([rifle, sword])).toEqual([{ type: 'kinetic', total: 6 }, { type: 'energy', total: 2 }])
  })

  it('leaves out damage that is not a plain number', () => {
    expect(damageTotals([{ range: [], damage: [{ type: 'Variable', val: 'X' }] }])).toEqual([])
  })

  it('gives each range type its shortest and longest', () => {
    expect(reach([rifle, sword])).toEqual([{ type: 'range', min: 3, max: 10 }, { type: 'threat', min: 1, max: 1 }])
  })

  it('places radar axes between the frames lowest and highest, clamped', () => {
    const ranges = new Map([['hp', { min: 4, max: 24 }], ['edef', { min: 4, max: 10 }], ['armour', { min: 0, max: 2 }]])
    const axes = radarAxes([{ id: 'hp', name: 'HP', value: 14 }, { id: 'edef', name: 'E-defence', value: 99 }, { id: 'armour', name: 'Armour', value: -1 }], ranges)
    expect(axes).toEqual([
      { id: 'hp', label: 'HP', value: '14', icon: undefined, at: 0.5 },
      { id: 'edef', label: 'E-defence', value: '99', icon: undefined, at: 1 },
      { id: 'armour', label: 'Armour', value: '-1', icon: undefined, at: 0 },
    ])
  })

  it('puts every stat that differs between frames on the radar, with its symbol', () => {
    const ranges = new Map([['speed', { min: 4, max: 4 }], ['repair', { min: 2, max: 6 }], ['structure', { min: 4, max: 4 }]])
    const axes = radarAxes([{ id: 'speed', name: 'Speed', value: 4 }, { id: 'repair', name: 'Repair cap', value: 4, icon: 'repair.svg' }, { id: 'structure', name: 'Structure', value: 4 }, { id: 'stress', name: 'Stress', value: 4 }], ranges)
    expect(axes).toEqual([{ id: 'repair', label: 'Repair cap', value: '4', icon: 'repair.svg', at: 0.5 }])
  })

  it('puts size on the radar, half size as ½', () => {
    const ranges = new Map([['size', { min: 0.5, max: 3 }]])
    expect(radarAxes([{ id: 'size', name: 'Size', value: 0.5 }], ranges)).toEqual([{ id: 'size', label: 'Size', value: '½', icon: undefined, at: 0 }])
    expect(radarAxes([{ id: 'size', name: 'Size', value: 3 }], ranges)[0]).toMatchObject({ value: '3', at: 1 })
  })
})
