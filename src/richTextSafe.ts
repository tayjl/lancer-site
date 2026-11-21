// Formatted text from the rich-text editor is stored as TipTap's JSON document format.
// Text written by other players comes out of the database, where anyone could have stored anything
// through the API (not just through our editor), so it's never shown as it is. sanitiseDoc() rebuilds
// it from an allowlist of block types, formatting and sizes, and drops everything else.
// RichText.vue then draws the result with ordinary Vue elements, never raw HTML.
// This file has no TipTap in it, so pages that only read text (lore, change review) don't download the editor.

// The values the editor stores for sizes. Only these are ever shown.
export const SIZES = { xsmall: '0.75em', small: '0.875em', large: '1.25em' } as const

// The only link text may have: to one lore entry, written exactly /lore/<uuid>.
const LORE_HREF = /^\/lore\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const loreHref = (id: string) => `/lore/${id}`

// Text colour: only a plain #rrggbb ever passes, so no stored value can carry extra CSS.
const COLOUR = /^#[0-9a-f]{6}$/i

// The LANCER symbols text may hold (file names in src/assets/icons), for the editor's picker and the sanitiser.
export const GAME_ICONS = [
  ['kinetic', 'Kinetic'], ['explosive', 'Explosive'], ['energy', 'Energy'], ['burn', 'Burn'], ['heat', 'Heat'], ['variable', 'Variable'],
  ['range', 'Range'], ['threat', 'Threat'], ['thrown', 'Thrown'], ['line', 'Line'], ['cone', 'Cone'], ['blast', 'Blast'], ['burst', 'Burst'],
  ['melee', 'Melee'], ['accuracy', 'Accuracy'], ['hp', 'HP'], ['armour', 'Armour'], ['structure', 'Structure'], ['reactor', 'Reactor stress'],
  ['repair', 'Repair'], ['evasion', 'Evasion'], ['e_def', 'E-defence'], ['speed', 'Speed'], ['tech_attack', 'Tech attack'],
  ['activation_quick', 'Quick action'], ['activation_full', 'Full action'], ['free_action', 'Free action'], ['reaction', 'Reaction'],
  ['overcharge', 'Overcharge'], ['protocol', 'Protocol'], ['deployable', 'Deployable'], ['drone', 'Drone'], ['mine', 'Mine'],
  ['grenade', 'Grenade'], ['system_point', 'System points'], ['size-half', 'Size 1/2'], ['size-1', 'Size 1'], ['size-2', 'Size 2'], ['size-3', 'Size 3'],
].map(([name, label]) => ({ name, label }))

const SIZE_VALUES: readonly string[] = Object.values(SIZES)
const BLOCKS = ['paragraph', 'heading', 'bulletList', 'listItem'] as const
const MAX_DEPTH = 10

export type SafeText = {
  type: 'text'
  text: string
  bold?: true
  italic?: true
  underline?: true
  size?: string
  color?: string
  glitch?: true
  link?: string
}
type SafeBlock = { type: (typeof BLOCKS)[number]; content: SafeNode[] }
export type SafeNode = SafeText | SafeBlock | { type: 'hardBreak' } | { type: 'gameIcon'; name: string }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function sanitiseDoc(doc: unknown): SafeNode[] {
  return isObject(doc) && doc.type === 'doc' ? sanitiseChildren(doc.content, 0) : []
}

function sanitiseChildren(content: unknown, depth: number): SafeNode[] {
  if (!Array.isArray(content) || depth > MAX_DEPTH) return []
  return content.flatMap((node) => sanitiseNode(node, depth))
}

function sanitiseNode(node: unknown, depth: number): SafeNode[] {
  if (!isObject(node)) return []
  if (node.type === 'text' && typeof node.text === 'string') return [sanitiseText(node.text, node.marks)]
  if (node.type === 'hardBreak') return [{ type: 'hardBreak' }]
  if (node.type === 'gameIcon') {
    const name = isObject(node.attrs) ? node.attrs.name : null
    return GAME_ICONS.some((icon) => icon.name === name) ? [{ type: 'gameIcon', name: name as string }] : []
  }
  const block = BLOCKS.find((type) => type === node.type)
  return block ? [{ type: block, content: sanitiseChildren(node.content, depth + 1) }] : []
}

function sanitiseText(text: string, marks: unknown): SafeText {
  const safe: SafeText = { type: 'text', text }
  for (const mark of Array.isArray(marks) ? marks : []) {
    if (!isObject(mark)) continue
    if (mark.type === 'bold') safe.bold = true
    if (mark.type === 'italic') safe.italic = true
    if (mark.type === 'underline') safe.underline = true
    // Any other link (outside sites, javascript:, other paths) is dropped and its text kept.
    if (mark.type === 'link' && isObject(mark.attrs) && typeof mark.attrs.href === 'string' && LORE_HREF.test(mark.attrs.href)) safe.link = mark.attrs.href
    if (mark.type === 'glitch') safe.glitch = true
    if (mark.type === 'textStyle' && isObject(mark.attrs)) {
      const { fontSize, color } = mark.attrs
      if (typeof color === 'string' && COLOUR.test(color)) safe.color = color
      if (SIZE_VALUES.includes(fontSize as string)) safe.size = fontSize as string
    }
  }
  return safe
}

// The plain words of a document, blocks and breaks parted by spaces (for search and reading time).
export function docText(doc: unknown): string {
  const words = (nodes: SafeNode[]): string =>
    nodes.map((node) => (node.type === 'text' ? node.text : node.type === 'hardBreak' || node.type === 'gameIcon' ? ' ' : ` ${words(node.content)} `)).join('')
  return words(sanitiseDoc(doc)).replace(/\s+/g, ' ').trim()
}

export const wordCount = (doc: unknown) => docText(doc).split(' ').filter(Boolean).length
