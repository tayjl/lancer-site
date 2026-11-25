import { describe, expect, it } from 'vitest'
import { blankRow, definitionProblems, factsText, iconLabel, idFromLabel, notDeleted, savePayload, slotsText, toEditRows, withData, withoutName, type EditRow } from './definitionEditor'
import { defKindInfo } from './definitions'

const saved = (id: string, extra: Partial<EditRow> = {}): EditRow => ({ ...blankRow(), id, label: id, saved: true, idTouched: true, sort: 0, updatedAt: '2026-11-24T10:00:00.123456+00:00', ...extra })
const damage = defKindInfo('damage_types')!

describe('definition editor', () => {
  it('makes a new id from the label as typed, and leaves frame sizes to the owner', () => {
    expect(idFromLabel('damage_types', '  Plasma Burn ')).toBe('Plasma Burn')
    expect(idFromLabel('frame_sizes', '1.5')).toBe('')
  })

  it('drops empty data keys', () => {
    expect(withData({ icon: 'burn', colour: '--dmg-burn' }, { icon: '' })).toEqual({ colour: '--dmg-burn' })
    expect(withData({}, { slots: [] })).toEqual({ slots: [] })
  })

  it('finds problems with the field they belong to', () => {
    const found = definitionProblems(damage, [saved('Kinetic'), blankRow(), saved('kinetic', { label: 'Again' })])
    expect(found.map((p) => p.text)).toEqual(['Damage type 2 needs a label.', 'Damage type 2 needs an ID.', 'Again: That ID is already used by another damage type.'])
    expect(found[0].field).toBe('rows.1.label')
  })

  it('wants frame size ids to be plain numbers', () => {
    const sizes = defKindInfo('frame_sizes')!
    const bad = (id: string) => definitionProblems(sizes, [saved(id)]).length
    expect([bad('0.5'), bad('2'), bad('02'), bad('big')]).toEqual([0, 0, 1, 1])
  })

  it('reports a bad frame size id once', () => {
    const sizes = defKindInfo('frame_sizes')!
    expect(definitionProblems(sizes, [saved('01')]).map((p) => p.text)).toEqual(['01: The ID must be a number, like 2 or 0.5.'])
  })

  it('wants a mode on a status group and words as damage type text', () => {
    const groups = defKindInfo('status_groups')!
    expect(definitionProblems(groups, [saved('a', { data: { mode: 'mech' } }), saved('b', { data: { mode: 'pilot' } })])).toEqual([])
    expect(definitionProblems(groups, [saved('a'), saved('b', { data: { mode: 'x' } })]).map((p) => p.text)).toEqual(['a: Choose where it is shown.', 'b: Choose where it is shown.'])
    expect(definitionProblems(damage, [saved('a', { data: { text: 'Words.' } }), saved('b', { data: { text: 3 } })]).map((p) => p.text)).toEqual(['b: The text must be words.'])
  })

  it('wants every mount slot to take a size', () => {
    const mount = defKindInfo('mount_types')!
    expect(definitionProblems(mount, [saved('Odd')]).map((p) => p.text)).toEqual(['Odd needs at least one slot.'])
    expect(definitionProblems(mount, [saved('Odd', { data: { slots: [['Main'], []] } })].map((r) => r)).map((p) => p.text)).toEqual(['Odd: Slot 2 needs a weapon size.'])
  })

  it('sends only new or changed rows, sorted by place, with the raw updated_at for saved ones', () => {
    const base = toEditRows([{ id: 'A', label: 'A', data: {}, hidden: false, sort: 0, updatedAt: 'x1' }, { id: 'B', label: 'B', data: {}, hidden: false, sort: 1, updatedAt: 'x2' }])
    const rows = [base[1], base[0], { ...blankRow(), id: ' C ', label: ' C ' }]
    expect(savePayload(rows, base)).toEqual([
      { id: 'B', label: 'B', data: {}, sort: 0, hidden: false, updated_at: 'x2' },
      { id: 'A', label: 'A', data: {}, sort: 1, hidden: false, updated_at: 'x1' },
      { id: 'C', label: 'C', data: {}, sort: 2, hidden: false },
    ])
    expect(savePayload(base, base)).toEqual([])
  })

  it('words the list facts and a refused delete', () => {
    expect(factsText(9, 1)).toBe('9 entries, 1 hidden')
    expect(factsText(1, 0)).toBe('1 entry')
    expect(notDeleted('Used by 3 items')).toBe('Not deleted: Used by 3 items. Hide it instead.')
    expect(notDeleted('No such definition.')).toBe('Not deleted: No such definition.')
    expect(iconLabel('activation_quick')).toBe('Activation quick')
    expect(slotsText([['Main', 'Auxiliary'], ['Auxiliary']])).toBe('Main or Auxiliary + Auxiliary')
    expect(slotsText([['Superheavy', 'Main']], ['Main', 'Superheavy'])).toBe('Main or Superheavy')
    expect(withoutName('Burn: The ID is bad.', 'Burn')).toBe('The ID is bad.')
    expect(withoutName('Burn needs a label.', 'Burn')).toBe('Needs a label.')
  })
})
