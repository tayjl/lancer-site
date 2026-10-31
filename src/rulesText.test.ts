import { describe, expect, it } from 'vitest'
import { parseRules, plainText } from './rulesText'

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
})
