// Formatted text from the rich-text editor is stored as TipTap's JSON document format.
// Text written by other players comes out of the database, where anyone could have stored anything
// through the API (not just through our editor), so it's never shown as it is. sanitiseDoc() rebuilds
// it from an allowlist of block types, formatting and sizes, and drops everything else.
// RichText.vue then draws the result with ordinary Vue elements, never raw HTML.
import { Extension, type Extensions } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { FontSize, TextStyle } from '@tiptap/extension-text-style'

// The values the editor stores for sizes. Only these are ever shown.
export const SIZES = { small: '0.875em', large: '1.25em' } as const

// Text colour is no longer offered: each colour has one meaning site-wide. Colour saved before then stays in the
// document (the attribute is kept, so the editor doesn't drop it on the next save) but is drawn as normal text.
const SavedColour = Extension.create({
  name: 'savedColour',
  addGlobalAttributes: () => [
    { types: ['textStyle'], attributes: { color: { default: null, parseHTML: () => null, renderHTML: () => ({}) } } },
  ],
})

// The editor's extensions (RichTextEditor.vue): bold, italic, underline, three sizes, bullet lists and small
// headings. Everything else StarterKit offers is off, so the editor can only produce what RichText.vue shows.
// The lore editor adds links to other lore entries (and nothing else). The mark never opens, auto-detects or
// auto-converts anything: a link only exists when a GM picks an entry for the selected text.
export const editorExtensions = (links = false): Extensions => [
  StarterKit.configure({
    heading: { levels: [3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    link: links ? { openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { target: null, rel: null } } : false,
    orderedList: false,
    strike: false,
  }),
  TextStyle,
  FontSize,
  SavedColour,
]
export const EDITOR_EXTENSIONS = editorExtensions()

// The only link text may have: to one lore entry, written exactly /lore/<uuid>.
const LORE_HREF = /^\/lore\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const loreHref = (id: string) => `/lore/${id}`

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
  link?: string
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
    // Any other link (outside sites, javascript:, other paths) is dropped and its text kept.
    if (mark.type === 'link' && isObject(mark.attrs) && typeof mark.attrs.href === 'string' && LORE_HREF.test(mark.attrs.href)) safe.link = mark.attrs.href
    if (mark.type === 'textStyle' && isObject(mark.attrs)) {
      const { fontSize } = mark.attrs
      if (SIZE_VALUES.includes(fontSize as string)) safe.size = fontSize as string
    }
  }
  return safe
}

// The plain words of a document, blocks and breaks parted by spaces (for search and reading time).
export function docText(doc: unknown): string {
  const words = (nodes: SafeNode[]): string =>
    nodes.map((node) => (node.type === 'text' ? node.text : node.type === 'hardBreak' ? ' ' : ` ${words(node.content)} `)).join('')
  return words(sanitiseDoc(doc)).replace(/\s+/g, ' ').trim()
}
