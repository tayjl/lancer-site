import { blankItem, type Data } from './contentEditor'
import type { ListRow } from './editorStore'
import { SECTIONS } from './rulesData'

// The content editor's Rules tab: one list of the rules, a box per category (ContentEditorView.vue). Pure, so
// it's tested without the page (src/ruleList.test.ts). The sections themselves come from rulesData.ts SECTIONS.

// The category order (the combat page's flow).
const ORDER = ['turn_steps', 'sizes', 'statuses', 'checks', 'attacks', 'dice', 'movement', 'range', 'structure', 'foot', 'notes', 'numbers']
export const RULE_CATEGORIES = ORDER.map((key) => ({ key, label: ruleSection(key)!.label }))
export function ruleSection(key: string) { return SECTIONS.find((s) => s.id === key) }

// The code reads these entries by id, so they can't be added or moved to another section.
export const FIXED_SECTIONS = ['notes', 'turn_steps', 'numbers']
export const canAdd = (key: string) => !FIXED_SECTIONS.includes(key)

// The Preview's icon per section. Statuses use their card's icon instead.
const ICONS: Record<string, string> = { turn_steps: 'list', statuses: 'warning', checks: 'star', attacks: 'crosshair', movement: 'speed', range: 'range', structure: 'structure', foot: 'pilot', sizes: 'weapon', dice: 'variable', notes: 'info', numbers: 'variable' }
export const sectionIcon = (key: string) => ICONS[key] ?? 'info'
// Table rows (but not statuses) have a short value column.
export const hasValue = (key: string) => ruleSection(key)?.shape === 'table' && key !== 'statuses'

// The one-time redirect from an old ?cat=rules&sec=tags|actions link to the Tags or Actions tab.
export const oldLink = (query: Record<string, unknown>) => (query.cat === 'rules' && (query.sec === 'tags' || query.sec === 'actions') ? { cat: query.sec, sec: undefined } : null)

// A new rule in a section: last order + 10, and an empty group where the section asks for one.
export function newRule(id: string, section: string, rows: ListRow[]): Data {
  const orders = rows.filter((r) => r.kind === 'rules' && r.section === section).map((r) => r.order ?? 0).filter(Number.isFinite)
  return { ...blankItem('rules', id), section, order: orders.length ? Math.max(...orders) + 10 : 10, ...(ruleSection(section)?.groups ? { group: '' } : {}) }
}

export type RuleBox = { key: string; label: string; add: boolean; total: number; more: number; parts: { label?: string; rows: ListRow[] }[] }
const LIMIT = 40
const boxKey = (row: ListRow) => (ORDER.includes(row.section ?? '') ? row.section! : 'other')
const byName = (a: ListRow, b: ListRow) => a.name.localeCompare(b.name)

// The list's boxes: one per category in order (or just the chosen one, or the matches of a search), rules sorted by group,
// order, then name, with a sub-label per group. A rule with an unknown section goes in a last box, Other.
export function ruleBoxes(rows: ListRow[], { sec, query, expanded }: { sec?: string; query: string; expanded: Set<string> }): RuleBox[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const searching = words.length > 0
  const matches = (row: ListRow) => { const hay = `${row.name} ${row.key} ${row.facts}`.toLowerCase(); return words.every((w) => hay.includes(w)) }
  const cats = [...RULE_CATEGORIES, { key: 'other', label: 'Other' }]
  return cats.filter((c) => !sec || c.key === sec).flatMap((cat) => {
    const all = rows.filter((r) => boxKey(r) === cat.key)
    const found = all.filter(matches)
    if ((cat.key === 'other' && !all.length) || (searching && !found.length)) return []
    const groups = ruleSection(cat.key)?.groups ?? []
    const rank = (r: ListRow) => { const i = groups.findIndex((g) => g.id === r.group); return i < 0 ? groups.length : i }
    const sorted = [...found].sort((a, b) => rank(a) - rank(b) || (a.order ?? Infinity) - (b.order ?? Infinity) || byName(a, b))
    const limit = searching || expanded.has(cat.key) ? Infinity : LIMIT
    const shown = sorted.slice(0, limit)
    const parts = groups.length
      ? [...groups.map((g) => ({ label: g.label, rows: shown.filter((r) => r.group === g.id) })), { label: undefined, rows: shown.filter((r) => rank(r) === groups.length) }].filter((p) => p.rows.length)
      : [{ label: undefined, rows: shown }]
    return [{ key: cat.key, label: cat.label, add: cat.key === 'other' ? false : canAdd(cat.key), total: all.length, more: sorted.length - shown.length, parts: parts.filter((p) => p.rows.length) }]
  })
}

// How many each category has, for the select.
export const ruleCounts = (rows: ListRow[]) => rows.reduce<Record<string, number>>((n, r) => ({ ...n, [boxKey(r)]: (n[boxKey(r)] ?? 0) + 1 }), {})
