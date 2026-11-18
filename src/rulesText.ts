// LANCER rules text is small HTML (lists, bold, line breaks). Imported packs come from anywhere, so it's never
// put on the page as HTML: parseRules keeps an allowlist of formatting tags as data (RulesText.vue draws it with
// Vue), drops every other tag and all attributes, and keeps the text.

export type RulesTag = 'p' | 'b' | 'i' | 'u' | 'ul' | 'ol' | 'li' | 'br'
export type RulesNode = string | { tag: RulesTag; children: RulesNode[] }

const TAGS: Record<string, RulesTag> = { p: 'p', div: 'p', b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u', ul: 'ul', ol: 'ol', li: 'li', br: 'br' }
// Their contents aren't text a reader should see.
const DROPPED = new Set(['script', 'style', 'template', 'iframe', 'object'])
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' }

const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    const code = name[0] === '#' ? (name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))) : NaN
    if (Number.isFinite(code)) return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    return ENTITIES[name.toLowerCase()] ?? entity
  })

export function parseRules(html: string): RulesNode[] {
  const root: RulesNode[] = []
  const stack: { tag: string; children: RulesNode[] }[] = [{ tag: '', children: root }]
  let dropping = ''
  for (const [token, close, name] of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>|<!--[\s\S]*?-->|[^<]+|</gi)) {
    const tag = name?.toLowerCase()
    if (dropping) {
      if (close && tag === dropping) dropping = ''
      continue
    }
    if (!tag) {
      if (!token.startsWith('<!--')) stack[stack.length - 1].children.push(decode(token))
    }
    else if (DROPPED.has(tag)) {
      if (!close && !token.endsWith('/>')) dropping = tag
    }
    else if (TAGS[tag] === 'br') {
      if (!close) stack[stack.length - 1].children.push({ tag: 'br', children: [] })
    }
    else if (TAGS[tag] && !close) {
      const node = { tag: TAGS[tag], children: [] as RulesNode[] }
      stack[stack.length - 1].children.push(node)
      stack.push(node)
    }
    else if (TAGS[tag]) {
      // Closes the nearest matching open tag (and anything left open inside it); a stray close is ignored.
      const index = stack.map((open) => open.tag).lastIndexOf(TAGS[tag])
      if (index > 0) stack.length = index
    }
  }
  return root
}

// One line of text without the formatting, for pickers and summaries.
export const plainText = (html: string) =>
  decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

// Packs often separate paragraphs with a line break at the top level ("…paint'.<br>This system can only…"). Those
// become real paragraphs, so they get paragraph spacing; lists and paragraphs stay as they are, and a line break
// inside a list item or a paragraph stays a line break.
const BLOCKS = new Set<RulesTag>(['p', 'ul', 'ol'])
export function paragraphs(nodes: RulesNode[]): RulesNode[] {
  if (!nodes.some((node) => typeof node !== 'string' && node.tag === 'br')) return nodes
  const result: RulesNode[] = []
  let run: RulesNode[] = []
  const flush = () => {
    if (run.some((node) => typeof node !== 'string' || node.trim())) result.push({ tag: 'p', children: run })
    run = []
  }
  for (const node of nodes) {
    if (typeof node !== 'string' && node.tag === 'br') flush()
    else if (typeof node !== 'string' && BLOCKS.has(node.tag)) { flush(); result.push(node) }
    else run.push(node)
  }
  flush()
  return result
}

// Only the first line: everything up to the first line break (even inside <i>) or the first paragraph or list.
export function firstLine(nodes: RulesNode[]): RulesNode[] {
  const kept: RulesNode[] = []
  for (const node of nodes) {
    if (typeof node === 'string') { kept.push(node); continue }
    if (node.tag === 'br') break
    const children = firstLine(node.children)
    kept.push({ tag: node.tag, children })
    if (BLOCKS.has(node.tag) || children.length < node.children.length) break
  }
  return kept
}
