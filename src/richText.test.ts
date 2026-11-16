import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/vue-3'
import { EDITOR_EXTENSIONS, docText, editorExtensions, sanitiseDoc } from './richText'

const doc = (...content: unknown[]) => ({ type: 'doc', content })
const text = (value: string, marks: unknown[] = []) => ({ type: 'text', text: value, marks })

describe('sanitiseDoc', () => {
  it('keeps the formatting the editor offers', () => {
    const result = sanitiseDoc(
      doc(
        { type: 'heading', attrs: { level: 3 }, content: [text('Notes')] },
        {
          type: 'paragraph',
          content: [
            text('bold and big', [
              { type: 'bold' },
              { type: 'underline' },
              { type: 'textStyle', attrs: { fontSize: '1.25em' } },
            ]),
          ],
        },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('one')] }] }] },
      ),
    )
    expect(result).toEqual([
      { type: 'heading', content: [{ type: 'text', text: 'Notes' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'bold and big', bold: true, underline: true, size: '1.25em' },
        ],
      },
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }],
      },
    ])
  })

  it('keeps colour saved before the colour buttons were removed, but never draws it', () => {
    const coloured = doc({ type: 'paragraph', content: [text('purple', [{ type: 'textStyle', attrs: { color: 'var(--lilac)', fontSize: null } }])] })
    // The editor's schema keeps the colour, so saving the field again doesn't drop it...
    const schema = getSchema(EDITOR_EXTENSIONS)
    const loaded = schema.nodeFromJSON(coloured)
    expect(loaded.toJSON()).toEqual(coloured)
    // ...but draws the mark without it, in the editor and in the read-only view.
    const mark = loaded.firstChild!.firstChild!.marks[0]
    expect(JSON.stringify(mark.type.spec.toDOM!(mark, true))).not.toContain('color')
    expect(sanitiseDoc(coloured)).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: 'purple' }] }])
  })

  it('drops colours and sizes that are not on the list, including attempts to sneak in extra CSS', () => {
    const [paragraph] = sanitiseDoc(
      doc({
        type: 'paragraph',
        content: [text('x', [{ type: 'textStyle', attrs: { color: 'red; background: url(https://evil.example)', fontSize: '400px' } }])],
      }),
    )
    expect(paragraph).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'x' }] })
  })

  it('drops node types and marks the editor does not offer, like images, links and code', () => {
    const [paragraph] = sanitiseDoc(
      doc({
        type: 'paragraph',
        content: [
          { type: 'image', attrs: { src: 'https://evil.example/x.png' } },
          text('link', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
          { type: 'codeBlock', content: [text('code')] },
        ],
      }),
    )
    expect(paragraph).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'link' }] })
  })

  it('keeps HTML-looking text as plain text (Vue shows it as text, not markup)', () => {
    const [paragraph] = sanitiseDoc(doc({ type: 'paragraph', content: [text('<script>alert(1)</script>')] }))
    expect(paragraph).toEqual({ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] })
  })

  it('returns nothing for anything that is not a document', () => {
    for (const bad of [null, undefined, 'hello', 42, [], { type: 'paragraph' }, { type: 'doc', content: 'nope' }]) {
      expect(sanitiseDoc(bad)).toEqual([])
    }
  })

  it('stops at a sensible depth instead of following endlessly nested lists', () => {
    let node: unknown = { type: 'paragraph', content: [text('deep')] }
    for (let i = 0; i < 50; i++) node = { type: 'bulletList', content: [{ type: 'listItem', content: [node] }] }
    expect(() => sanitiseDoc(doc(node))).not.toThrow()
    expect(JSON.stringify(sanitiseDoc(doc(node)))).not.toContain('deep')
  })
})

describe('links to lore entries', () => {
  const ID = '123e4567-e89b-42d3-a456-426614174000'
  const linked = (href: unknown, extra: Record<string, unknown> = {}) =>
    doc({ type: 'paragraph', content: [text('the station', [{ type: 'link', attrs: { href, target: '_blank', rel: 'x', ...extra } }])] })

  it('keeps a link to exactly /lore/<uuid>, with no other attribute', () => {
    expect(sanitiseDoc(linked(`/lore/${ID}`))).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'the station', link: `/lore/${ID}` }] },
    ])
  })

  it.each([
    'javascript:alert(1)',
    'https://evil.example/lore/' + ID,
    '//evil.example/lore/' + ID,
    '/registry/1',
    '/lore/not-a-uuid',
    `/lore/${ID}x`,
    `/lore/${ID}/edit`,
    `/lore/${ID}?next=https://evil.example`,
    `/lore/${ID}
`,
    ` /lore/${ID}`,
    `lore/${ID}`,
    null,
    42,
  ])('drops the link but keeps the text for %s', (href) => {
    expect(sanitiseDoc(linked(href))).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: 'the station' }] }])
  })

  it('drops a link mark with no attributes at all', () => {
    expect(sanitiseDoc(doc({ type: 'paragraph', content: [text('x', [{ type: 'link' }])] }))).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
    ])
  })

  it('is only in the editor that asks for links', () => {
    const marks = (links: boolean) => Object.keys(getSchema(editorExtensions(links)).marks)
    expect(marks(false)).not.toContain('link')
    expect(marks(true)).toContain('link')
  })

  it('reads plain text for search', () => {
    expect(docText(linked(`/lore/${ID}`))).toBe('the station')
  })
})
