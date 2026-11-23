import { describe, expect, it } from 'vitest'
import type { Json } from './lib/database.types'
import { KIND_INFO, LORE_KINDS, fileName, fileSize, loreMatches, readMinutes, readTime } from './lore'

const para = (text: string): Json => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const doc = (...content: Json[]): Json => ({ type: 'doc', content })
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')

describe('reading time', () => {
  it('is at least a minute, and rounds up at 200 words a minute', () => {
    expect(readMinutes(doc())).toBe(1)
    expect(readMinutes(null)).toBe(1)
    expect(readMinutes(doc(para(words(200))))).toBe(1)
    expect(readMinutes(doc(para(words(201))))).toBe(2)
    expect(readTime(doc(para(words(450))))).toBe('3 min read')
  })

  it('counts words across paragraphs and breaks', () => {
    expect(readMinutes(doc(para(words(150)), para(words(100))))).toBe(2)
  })
})

describe('loreMatches', () => {
  const entry = { title: 'Halvard Station', summary: 'A refuelling hub', body: doc(para('The harbourmaster logs every arrival.')) }

  it('needs every word, in the title, summary or body', () => {
    expect(loreMatches(entry, 'halvard harbourmaster')).toBe(true)
    expect(loreMatches(entry, 'REFUELLING arrival')).toBe(true)
    expect(loreMatches(entry, 'halvard kraken')).toBe(false)
  })

  it('matches everything for an empty search', () => {
    expect(loreMatches(entry, '  ')).toBe(true)
  })
})

describe('kinds', () => {
  it('names every kind, singular and plural', () => {
    expect(LORE_KINDS.map((kind) => KIND_INFO[kind].plural)).toEqual(['Stories', 'Places', 'Factions', 'People', 'Events'])
    expect(KIND_INFO.person.name).toBe('Person')
  })
})

describe('file look', () => {
  it('turns a title into a file name', () => {
    expect(fileName('The Karrakin Ledger!')).toBe('the_karrakin_ledger.omnif')
    expect(fileName('  --A  b-- ')).toBe('a_b.omnif')
    expect(fileName('!!!')).toBe('untitled.omnif')
    expect(fileName('')).toBe('untitled.omnif')
  })

  it('shows the size in b under 1000 characters, else k', () => {
    expect(fileSize(null)).toBe('0b')
    expect(fileSize(doc(para('x'.repeat(812))))).toBe('812b')
    expect(fileSize(doc(para('x'.repeat(999))))).toBe('999b')
    expect(fileSize(doc(para('x'.repeat(2100))))).toBe('2.1k')
  })
})
