// Formatted text from the rich-text editor is stored as TipTap's JSON document format.
// Text written by other players comes out of the database, where anyone could have stored anything
// through the API (not just through our editor), so it's never shown as it is. sanitiseDoc() rebuilds
// it from an allowlist of block types, formatting, colours and sizes, and drops everything else.
// RichText.vue then draws the result with ordinary Vue elements, never raw HTML.

// The values the editor stores for colours and sizes. Only these are ever shown.
export const COLOURS = ['var(--lilac)', 'var(--rose)', 'var(--sky)'] as const
export const SIZES = { small: '0.875em', large: '1.25em' } as const

const SIZE_VALUES: readonly string[] = Object.values(SIZES)
const BLOCKS = ['paragraph', 'heading', 'bulletList', 'listItem'] as const
const MAX_DEPTH = 10

export type SafeText = {
  type: 'text'
  text: string
  bold?: true
  italic?: true
  underline?: true
  colour?: string
  size?: string
}
export type SafeBlock = { type: (typeof BLOCKS)[number]; content: SafeNode[] }
export type SafeNode = SafeText | SafeBlock | { type: 'hardBreak' }

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
    if (mark.type === 'textStyle' && isObject(mark.attrs)) {
      const { color, fontSize } = mark.attrs
      if (COLOURS.some((allowed) => allowed === color)) safe.colour = color as string
      if (SIZE_VALUES.includes(fontSize as string)) safe.size = fontSize as string
    }
  }
  return safe
}
