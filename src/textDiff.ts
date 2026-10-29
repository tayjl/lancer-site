import { sanitiseDoc, type SafeNode } from './richText'

export function sameContent(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == b
  if (typeof a !== 'object' || typeof b !== 'object') return a === b
  if (Array.isArray(a) || Array.isArray(b))
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => sameContent(value, b[i]))
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.hasOwn(right, key) && sameContent(left[key], right[key]))
}

export function documentText(doc: unknown): string {
  const text = (node: SafeNode): string => {
    if (node.type === 'text') return node.text
    if (node.type === 'hardBreak') return '\n'
    return node.content.map(text).join('') + (node.type === 'paragraph' || node.type === 'heading' ? '\n' : '')
  }
  return sanitiseDoc(doc).map(text).join('').trimEnd()
}

type Part = { kind: 'same' | 'added' | 'removed'; text: string }

// Compare words, keeping whitespace and punctuation as text; nothing is interpreted as HTML.
export function textDiff(before: string, after: string): Part[] {
  const a = before.match(/\s+|\S+/g) ?? []
  const b = after.match(/\s+|\S+/g) ?? []
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++
  let suffix = 0
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++
  const left = a.slice(prefix, a.length - suffix)
  const right = b.slice(prefix, b.length - suffix)
  const parts: Part[] = []
  const add = (kind: Part['kind'], text: string) => {
    if (!text) return
    const last = parts.at(-1)
    if (last?.kind === kind) last.text += text
    else parts.push({ kind, text })
  }
  add('same', a.slice(0, prefix).join(''))
  // Bound the comparison's memory and time for very long backstories.
  if ((left.length + 1) * (right.length + 1) > 250_000) {
    add('removed', left.join(''))
    add('added', right.join(''))
  } else {
    const width = right.length + 1
    const lengths = new Uint32Array((left.length + 1) * width)
    for (let i = left.length - 1; i >= 0; i--)
      for (let j = right.length - 1; j >= 0; j--)
        lengths[i * width + j] = left[i] === right[j]
          ? 1 + lengths[(i + 1) * width + j + 1]!
          : Math.max(lengths[(i + 1) * width + j]!, lengths[i * width + j + 1]!)
    let i = 0
    let j = 0
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && left[i] === right[j]) {
        add('same', left[i++]!)
        j++
      } else if (i < left.length && (j === right.length || lengths[(i + 1) * width + j]! >= lengths[i * width + j + 1]!)) {
        add('removed', left[i++]!)
      } else add('added', right[j++]!)
    }
  }
  add('same', suffix ? a.slice(-suffix).join('') : '')
  return parts
}
