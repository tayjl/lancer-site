import { describe, expect, it } from 'vitest'
import { firstLine, paragraphs, parseRules, plainText } from './rulesText'

describe('rules text', () => {
  it('keeps lists, bold and line breaks as data', () => {
    expect(parseRules('While flying:<ul><li>+1 <strong>Accuracy</strong></li><li>fly 2</li></ul>Then<br>done')).toEqual([
      'While flying:',
      { tag: 'ul', children: [
        { tag: 'li', children: ['+1 ', { tag: 'b', children: ['Accuracy'] }] },
        { tag: 'li', children: ['fly 2'] },
      ] },
      'Then',
      { tag: 'br', children: [] },
      'done',
    ])
  })

  it('drops other tags, attributes and script contents, and decodes entities', () => {
    expect(parseRules('<a href="javascript:x" onclick="x"><b onmouseover="x">hit</b></a><script>alert(1)</script> &amp; 3 &lt; 4&#33;'))
      .toEqual([{ tag: 'b', children: ['hit'] }, ' & 3 < 4!'])
  })

  it('survives broken markup', () => {
    expect(parseRules('<ul><li>open</b> 1 < 2')).toEqual([{ tag: 'ul', children: [{ tag: 'li', children: ['open', ' 1 ', '<', ' 2'] }] }])
  })

  it('flattens to one line for pickers', () => {
    expect(plainText('A<ul><li>B &amp; C</li></ul>')).toBe('A B & C')
  })

  it('turns top-level line breaks into paragraphs, leaving lists and breaks inside them alone', () => {
    expect(paragraphs(parseRules('One.<br>Two <b>bold</b>.<ul><li>a<br>b</li></ul>'))).toEqual([
      { tag: 'p', children: ['One.'] },
      { tag: 'p', children: ['Two ', { tag: 'b', children: ['bold'] }, '.'] },
      { tag: 'ul', children: [{ tag: 'li', children: ['a', { tag: 'br', children: [] }, 'b'] }] },
    ])
    expect(paragraphs(parseRules('No breaks.'))).toEqual(['No breaks.'])
  })

  it('keeps only the first line, even when the break is inside italics', () => {
    expect(firstLine(parseRules('<i>One,<br>two.</i>'))).toEqual([{ tag: 'i', children: ['One,'] }])
    expect(firstLine(parseRules('One.<br>Two.'))).toEqual(['One.'])
    expect(firstLine(parseRules('<i>Just one.</i>'))).toEqual([{ tag: 'i', children: ['Just one.'] }])
  })
})
