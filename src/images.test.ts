import { describe, expect, it, vi } from 'vitest'
import { IMAGE_PATH, cardImages, imageUrl, scaledSize } from './images'

// images.ts reads the session from auth.ts, which needs a real browser window.
vi.mock('./auth', () => ({ session: { value: null } }))

const USER = '11111111-1111-4111-8111-111111111111'
const FILE = '22222222-2222-4222-8222-222222222222'
const GOOD = `${USER}/${FILE}.webp`

describe('IMAGE_PATH', () => {
  it('accepts an upload path in either format', () => {
    expect(IMAGE_PATH.test(GOOD)).toBe(true)
    expect(IMAGE_PATH.test(`${USER}/${FILE}.jpg`)).toBe(true)
  })
  it('refuses outside links and anything not shaped like an upload', () => {
    for (const bad of ['https://evil.example/x.png', `${USER}/${FILE}.png`, `${USER}/../${FILE}.webp`, `${GOOD}/x`, `x${GOOD}`, `${USER}.webp`, ''])
      expect(IMAGE_PATH.test(bad)).toBe(false)
  })
})

describe('scaledSize', () => {
  it('shrinks the long side to 1024', () => {
    expect(scaledSize(4000, 2000)).toEqual({ width: 1024, height: 512 })
    expect(scaledSize(1500, 3000)).toEqual({ width: 512, height: 1024 })
  })
  it('never scales up', () => {
    expect(scaledSize(300, 200)).toEqual({ width: 300, height: 200 })
  })
})

describe('imageUrl', () => {
  it('builds the public link for an upload path', () => {
    expect(imageUrl(GOOD)).toMatch(new RegExp(`/storage/v1/object/public/character-images/${GOOD}$`))
  })
  it('gives nothing for anything else', () => {
    expect(imageUrl('https://evil.example/x.png')).toBeNull()
    expect(imageUrl(null)).toBeNull()
  })
})

describe('cardImages', () => {
  it('collects the portrait and mech pictures, ignoring anything that is not an upload', () => {
    const mechs = [{ image: `${USER}/${FILE}.jpg` }, { image: 'https://evil.example/x.png' }, { image: null }, 'junk']
    expect(cardImages({ pilot_image: GOOD, mechs })).toEqual(new Set([GOOD, `${USER}/${FILE}.jpg`]))
    expect(cardImages({ pilot_image: null, mechs: null })).toEqual(new Set())
  })
})
