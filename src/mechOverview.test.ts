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
    const ranges = new Map([['hp', { min: 4, max: 24 }], ['edef', { min: 4, max: 10 }], ['speed', { min: 4, max: 4 }]])
    const axes = radarAxes([{ id: 'hp', name: 'HP', value: 14 }, { id: 'edef', name: 'E-defence', value: 99 }, { id: 'speed', name: 'Speed', value: 4 }, { id: 'size', name: 'Size', value: 1 }], ranges)
    expect(axes).toEqual([{ id: 'hp', label: 'HP', value: '14', at: 0.5 }, { id: 'edef', label: 'E-defence', value: '99', at: 1 }, { id: 'speed', label: 'Speed', value: '4', at: 0.5 }])
  })
})
