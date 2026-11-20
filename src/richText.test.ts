import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/vue-3'
import { setBlockType } from '@tiptap/pm/commands'
import { wrapInList } from '@tiptap/pm/schema-list'
import { EditorState, TextSelection, type Command } from '@tiptap/pm/state'
import { editorExtensions, splitAroundSelection } from './richText'
import { docText, sanitiseDoc } from './richTextSafe'

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
    const schema = getSchema(editorExtensions())
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

describe('splitAroundSelection', () => {
  const schema = getSchema(editorExtensions())
  const para = (value: string) => ({ type: 'paragraph', content: [text(value)] })
  const heading = (value: string) => ({ type: 'heading', attrs: { level: 3 }, content: [text(value)] })
  // Selects the first occurrence of `from` (a word) through the end of `to` (the same word when left out), across blocks.
  const select = (document: unknown, from: string, to = from) => {
    const node = schema.nodeFromJSON(document)
    let start = 0
    let end = 0
    node.descendants((child, pos) => {
      if (!child.isText) return
      if (!start && child.text!.includes(from)) start = pos + child.text!.indexOf(from)
      if (!end && child.text!.includes(to) && pos + child.text!.indexOf(to) >= start) end = pos + child.text!.indexOf(to) + to.length
    })
    return EditorState.create({ doc: node, selection: start === end ? undefined : TextSelection.create(node, start, end) })
  }
  const split = (state: EditorState) => state.apply(splitAroundSelection(state.tr))
  const apply = (state: EditorState, command: Command) => {
    let result = state
    command(state, (tr) => (result = state.apply(tr)))
    return result
  }
  const toHeading = (state: EditorState) => apply(state, setBlockType(schema.nodes.heading, { level: 3 }))
  const toParagraph = (state: EditorState) => apply(state, setBlockType(schema.nodes.paragraph))
  const toList = (state: EditorState) => apply(state, wrapInList(schema.nodes.bulletList))
  // The blocks as "type:text".
  const blocks = (state: EditorState) => state.doc.content.content.map((block) => `${block.type.name}:${block.textContent}`)
  const selected = (state: EditorState) => state.doc.textBetween(state.selection.from, state.selection.to, '|')

  it('cuts a paragraph around the selected words, dropping the space at each cut', () => {
    const state = split(select(doc(para('alpha beta gamma')), 'beta'))
    expect(blocks(state)).toEqual(['paragraph:alpha', 'paragraph:beta', 'paragraph:gamma'])
    expect(selected(state)).toBe('beta')
    expect(blocks(toHeading(state))).toEqual(['paragraph:alpha', 'heading:beta', 'paragraph:gamma'])
    expect(blocks(toList(state))).toEqual(['paragraph:alpha', 'bulletList:beta', 'paragraph:gamma'])
  })

  it('leaves the space a double-click selects outside the cut', () => {
    const state = split(select(doc(para('alpha beta gamma')), 'beta '))
    expect(blocks(state)).toEqual(['paragraph:alpha', 'paragraph:beta', 'paragraph:gamma'])
    expect(selected(state)).toBe('beta')
  })

  it('cuts only the end when the selection starts at the paragraph start', () => {
    const state = split(select(doc(para('alpha beta gamma')), 'alpha', 'beta'))
    expect(blocks(state)).toEqual(['paragraph:alpha beta', 'paragraph:gamma'])
    expect(blocks(toHeading(state))).toEqual(['heading:alpha beta', 'paragraph:gamma'])
  })

  it('cuts only the start when the selection runs to the paragraph end', () => {
    const state = split(select(doc(para('alpha beta gamma')), 'beta', 'gamma'))
    expect(blocks(state)).toEqual(['paragraph:alpha', 'paragraph:beta gamma'])
    expect(blocks(toList(state))).toEqual(['paragraph:alpha', 'bulletList:beta gamma'])
  })

  it('leaves a whole paragraph alone, making no empty blocks', () => {
    const state = select(doc(para('alpha beta gamma')), 'alpha', 'gamma')
    const result = split(state)
    expect(result.doc.eq(state.doc)).toBe(true)
    expect(blocks(toHeading(result))).toEqual(['heading:alpha beta gamma'])
  })

  it('cuts only at the first and last block when the selection spans paragraphs', () => {
    const state = split(select(doc(para('one two three'), para('four'), para('five six seven')), 'two', 'six'))
    expect(blocks(state)).toEqual(['paragraph:one', 'paragraph:two three', 'paragraph:four', 'paragraph:five six', 'paragraph:seven'])
    expect(selected(state)).toBe('two three|four|five six')
    expect(blocks(toHeading(state))).toEqual(['paragraph:one', 'heading:two three', 'heading:four', 'heading:five six', 'paragraph:seven'])
  })

  it('does nothing for a cursor, so the buttons still change the whole block', () => {
    const state = select(doc(para('alpha beta gamma')), 'beta', 'beta')
    const cursor = EditorState.create({ doc: state.doc, selection: TextSelection.create(state.doc, 9) })
    const result = split(cursor)
    expect(result.doc.eq(cursor.doc)).toBe(true)
    expect(blocks(toHeading(result))).toEqual(['heading:alpha beta gamma'])
  })

  it('turns a heading off for just the selected part', () => {
    const state = split(select(doc(heading('alpha beta gamma')), 'beta'))
    expect(blocks(state)).toEqual(['heading:alpha', 'heading:beta', 'heading:gamma'])
    expect(blocks(toParagraph(state))).toEqual(['heading:alpha', 'paragraph:beta', 'heading:gamma'])
  })

  it('does not split list items', () => {
    const list = { type: 'bulletList', content: [{ type: 'listItem', content: [para('alpha beta gamma')] }] }
    const state = select(doc(list), 'beta')
    expect(split(state).doc.eq(state.doc)).toBe(true)
  })

  it('does not drop a space when that would leave an empty block', () => {
    const state = split(select(doc(para(' beta ')), 'beta'))
    expect(blocks(state)).toEqual(['paragraph: ', 'paragraph:beta', 'paragraph: '])
  })

  it('keeps marks on each side of the cut', () => {
    const bold = doc({ type: 'paragraph', content: [text('alpha beta gamma', [{ type: 'bold' }])] })
    const result = split(select(bold, 'beta'))
    expect(result.doc.content.content.every((block) => block.firstChild!.marks.some((mark) => mark.type.name === 'bold'))).toBe(true)
  })
})
