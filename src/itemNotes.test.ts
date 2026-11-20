import { describe, expect, it } from 'vitest'
import { withNote, withoutNote } from './itemNotes'

describe('item descriptions', () => {
  it('sets a trimmed note, and removes it when empty', () => {
    expect(withNote({ 'Gear:0': 'old' }, 'Weapon:1', '  salvaged railgun ')).toEqual({ 'Gear:0': 'old', 'Weapon:1': 'salvaged railgun' })
    expect(withNote({ 'Gear:0': 'old', 'Weapon:1': 'x' }, 'Weapon:1', '  ')).toEqual({ 'Gear:0': 'old' })
    expect(withNote(undefined, '0', 'a'.repeat(200))['0']).toHaveLength(140)
  })

  it('drops the note of a swapped item and keeps the rest', () => {
    expect(withoutNote({ 0: 'a', 1: 'b', other: 'c' }, 0, false)).toEqual({ 1: 'b', other: 'c' })
  })

  it('moves later notes down when a removed item closes up its list', () => {
    expect(withoutNote({ 0: 'a', 1: 'b', 3: 'd' }, 0, true)).toEqual({ 0: 'b', 2: 'd' })
  })
})
