// The rich-text editor's TipTap setup. What it saves is cleaned and read back by src/richTextSafe.ts (re-exported here).
import { Extension, type Extensions } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { FontSize, TextStyle } from '@tiptap/extension-text-style'
import { TextSelection, type Transaction } from '@tiptap/pm/state'
import type { ResolvedPos } from '@tiptap/pm/model'

// Re-exported so the editor's tests can reach them from one place.
export { sanitiseDoc, docText } from './richTextSafe'

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

// The heading and list buttons change whole blocks, so with part of a paragraph selected this first cuts the block(s)
// at the selection's edges (dropping the one space left at each cut), and the buttons then change only the selected
// part. A cursor, a cut at a block's very start or end, and list items are left alone. Edits `tr` and returns it.
export function splitAroundSelection(tr: Transaction): Transaction {
  const { selection } = tr
  if (!(selection instanceof TextSelection) || selection.empty) return tr
  let { from, to } = selection
  // A double-click on Windows selects the word and the space after it: cut around the word, not the space.
  while (to > from && tr.doc.textBetween(to - 1, to) === ' ') to--
  while (from < to && tr.doc.textBetween(from, from + 1) === ' ') from++
  if (from === to) return tr
  const first = tr.steps.length
  const canCut = ($pos: ResolvedPos) => {
    if (!$pos.parent.isTextblock || $pos.parentOffset === 0 || $pos.parentOffset === $pos.parent.content.size) return false
    for (let depth = $pos.depth; depth > 0; depth--) if ($pos.node(depth).type.name === 'listItem') return false
    return true
  }
  // The later edge first, so the earlier position is still where it was.
  const $to = tr.doc.resolve(to)
  if (canCut($to)) {
    tr.split(to)
    if ($to.parent.content.size - $to.parentOffset > 1 && tr.doc.textBetween(to + 2, to + 3) === ' ') tr.delete(to + 2, to + 3)
  }
  const $from = tr.doc.resolve(from)
  if (canCut($from)) {
    const space = $from.parentOffset > 1 && tr.doc.textBetween(from - 1, from) === ' ' ? 1 : 0
    if (space) tr.delete(from - 1, from)
    tr.split(from - space)
  }
  if (tr.steps.length === first) return tr
  const map = tr.mapping.slice(first)
  return tr.setSelection(TextSelection.create(tr.doc, map.map(from, 1), map.map(to, -1)))
}
