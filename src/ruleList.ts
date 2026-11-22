import { blankItem, type Data, type EditorKind } from './contentEditor'
import type { ListRow } from './editorStore'
import { SECTIONS } from './rulesData'

// The content editor's Rules tab: one list for the rules, the base actions and the tags (ContentEditorView.vue). Pure, so
// it's tested without the page (src/ruleList.test.ts). The sections themselves come from rulesData.ts SECTIONS.

// The kinds listed under the Rules tab, and the category order (the combat page's flow). Actions and tags are categories too.
export const RULES_GROUP: EditorKind[] = ['rules', 'actions', 'tags']
const ORDER = ['turn_steps', 'actions', 'tags', 'tag_list', 'sizes', 'statuses', 'checks', 'attacks', 'dice', 'movement', 'range', 'structure', 'foot', 'notes', 'numbers']
export const RULE_CATEGORIES = ORDER.map((key) => ({ key, label: key === 'actions' ? 'Actions' : key === 'tags' ? 'Tags' : ruleSection(key)!.label }))
export function ruleSection(key: string) { return SECTIONS.find((s) => s.id === key) }

// The code reads these entries by id, so they can't be added or moved to another section.
export const FIXED_SECTIONS = ['notes', 'turn_steps', 'numbers']
export const canAdd = (key: string) => !FIXED_SECTIONS.includes(key)
export const noun = (key: string) => (key === 'actions' ? 'action' : key === 'tags' ? 'tag' : 'rule')

// The Preview's icon per section. Statuses use their card's icon instead.
const ICONS: Record<string, string> = { turn_steps: 'list', statuses: 'warning', checks: 'star', attacks: 'crosshair', movement: 'speed', range: 'range', structure: 'structure', foot: 'pilot', sizes: 'weapon', dice: 'variable', tag_list: 'generic_item', notes: 'info', numbers: 'variable' }
export const sectionIcon = (key: string) => ICONS[key] ?? 'info'
// Table rows (but not statuses) have a short value column.
export const hasValue = (key: string) => ruleSection(key)?.shape === 'table' && key !== 'statuses'

// Which tab a ?cat= shows (Tags and Actions now live under Rules), and the one-time redirect from an old link.
export const tabOf = (cat: unknown) => (cat === 'tags' || cat === 'actions' ? 'rules' : cat)
export const oldLink = (query: Record<string, unknown>) => (query.cat === 'tags' || query.cat === 'actions' ? { cat: 'rules', sec: query.cat } : null)
// What a New button in a category makes.
export const newKind = (sec: string | undefined): EditorKind => (sec === 'actions' || sec === 'tags' ? sec : 'rules')

// A new rule in a section: last order + 10, and an empty group where the section asks for one.
export function newRule(id: string, section: string, rows: ListRow[]): Data {
  const orders = rows.filter((r) => r.kind === 'rules' && r.section === section).map((r) => r.order ?? 0).filter(Number.isFinite)
  return { ...blankItem('rules', id), section, order: orders.length ? Math.max(...orders) + 10 : 10, ...(ruleSection(section)?.groups ? { group: '' } : {}) }
}

export type RuleBox = { key: string; label: string; add: boolean; total: number; more: number; parts: { label?: string; rows: ListRow[] }[] }
const LIMIT = 40
const boxKey = (row: ListRow) => (row.kind === 'actions' || row.kind === 'tags' ? row.kind : ORDER.includes(row.section ?? '') ? row.section! : 'other')
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
    const sorted = [...found].sort(cat.key === 'actions' || cat.key === 'tags' ? byName : (a, b) => rank(a) - rank(b) || (a.order ?? Infinity) - (b.order ?? Infinity) || byName(a, b))
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
