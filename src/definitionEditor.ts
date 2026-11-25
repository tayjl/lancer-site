import type { Problem } from './contentEditor'
import type { DefData, DefKind, DefKindInfo, DefRow } from './definitions'
import { capitalise, plural } from './text'

// The rules of the Definitions screen (DefinitionPane.vue): rows being edited, their ids, problems and what a save sends.
// Pure, so it's tested without the page (src/definitionEditor.test.ts).

// A row on screen. "saved" rows are in the database: their id is fixed. "sort" and "updatedAt" are as loaded.
export type EditRow = { id: string; label: string; data: DefData; hidden: boolean; saved: boolean; sort: number; updatedAt: string; idTouched: boolean }

export const toEditRows = (rows: DefRow[]): EditRow[] => rows.map((row) => ({ ...row, saved: true, idTouched: true }))
export const blankRow = (): EditRow => ({ id: '', label: '', data: {}, hidden: false, saved: false, sort: 0, updatedAt: '', idTouched: false })

// A new row's id follows its label (trimmed, as typed) until the owner types in the id. Frame sizes are typed numbers.
export const idFromLabel = (kind: DefKind, label: string) => (kind === 'frame_sizes' ? '' : label.trim())

// The data with some keys changed. An empty value drops the key, so a row without an icon has no "icon" at all.
export function withData(data: DefData, changes: Record<string, unknown>): DefData {
  const next = { ...data, ...changes }
  for (const key of Object.keys(changes)) {
    const value = next[key]
    if (value === '' || value === undefined || (Array.isArray(value) && !value.length && key !== 'slots')) delete next[key]
  }
  return next
}

// No leading zeros: 0.5, 1, 2.
const NUMBER = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/
const labelOf = (info: DefKindInfo, row: EditRow, index: number) => row.label.trim() || `${capitalise(info.singular)} ${index + 1}`
const slotsOf = (row: EditRow): string[][] => (Array.isArray(row.data.slots) ? (row.data.slots as string[][]) : [])

// Everything wrong with the list. Errors block Save.
export function definitionProblems(info: DefKindInfo, rows: EditRow[]): Problem[] {
  const out: Problem[] = []
  const error = (text: string, field: string) => out.push({ level: 'error', text, field })
  rows.forEach((row, i) => {
    const name = labelOf(info, row, i)
    const id = row.id.trim()
    if (!row.label.trim()) error(`${name} needs a label.`, `rows.${i}.label`)
    if (!id) error(`${name} needs an ID.`, `rows.${i}.id`)
    else if (id.length > 60) error(`${name}: The ID can have at most 60 characters.`, `rows.${i}.id`)
    else if (info.key === 'frame_sizes' && !NUMBER.test(id)) error(`${name}: The ID must be a number, like 2 or 0.5.`, `rows.${i}.id`)
    else if (rows.some((other, j) => j < i && other.id.trim().toLowerCase() === id.toLowerCase())) error(`${name}: That ID is already used by another ${info.singular}.`, `rows.${i}.id`)
    if (info.mount) {
      const slots = slotsOf(row)
      if (!slots.length) error(`${name} needs at least one slot.`, `rows.${i}.slots`)
      slots.forEach((slot, n) => { if (!slot.length) error(`${name}: Slot ${n + 1} needs a weapon size.`, `rows.${i}.slots.${n}`) })
    }
  })
  return out
}

// A problem line for under its own field, without the row's name ("Burn: The ID ..." becomes "The ID ...").
export function withoutName(text: string, name: string) {
  if (text.startsWith(`${name}: `)) return text.slice(name.length + 2)
  return text.startsWith(`${name} `) ? capitalise(text.slice(name.length + 1)) : text
}

// What save_definitions gets: the rows that are new or changed, sort = the row's place in the list, updated_at (the raw string loaded, never rewritten) only for saved rows.
export function savePayload(rows: EditRow[], baseline: EditRow[]) {
  const was = new Map(baseline.map((row) => [row.id, row]))
  return rows.flatMap((row, sort) => {
    const old = was.get(row.id)
    const label = row.label.trim()
    const same = old && old.sort === sort && old.label === label && old.hidden === row.hidden && JSON.stringify(old.data) === JSON.stringify(row.data)
    if (same) return []
    return [{ id: row.id.trim(), label, data: row.data, sort, hidden: row.hidden, ...(row.saved ? { updated_at: row.updatedAt } : {}) }]
  })
}

// The list of lists' second line: "9 entries, 1 hidden".
export const factsText = (entries: number, hidden: number) => `${plural(entries, 'entry', 'entries')}${hidden ? `, ${hidden} hidden` : ''}`

// A refused delete, as a sentence ("Used by 3 items" gets the way out).
export function notDeleted(message: string) {
  const text = /^Used by /.test(message) ? `${message}. Hide it instead.` : message
  return `Not deleted: ${/[.!?]$/.test(text) ? text : `${text}.`}`
}

// "activation_quick" → "Activation quick".
export const iconLabel = (name: string) => capitalise(name.replaceAll('_', ' '))

// A mount's places in words, sizes in the order of "order" (the chips'): "Main or Auxiliary + Auxiliary".
export const slotsText = (slots: string[][], order: string[] = []) =>
  slots.map((slot) => [...slot].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(' or ')).join(' + ')
