import { describe, expect, it } from 'vitest'
import { sanitiseDoc } from './richText'

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
            text('bold, purple and big', [
              { type: 'bold' },
              { type: 'underline' },
              { type: 'textStyle', attrs: { color: 'var(--lilac)', fontSize: '1.25em' } },
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
          { type: 'text', text: 'bold, purple and big', bold: true, underline: true, colour: 'var(--lilac)', size: '1.25em' },
        ],
      },
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }],
      },
    ])
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
