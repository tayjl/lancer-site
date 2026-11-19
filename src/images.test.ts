import { describe, expect, it, vi } from 'vitest'
import { IMAGE_PATH, cardImages, frameArt, frameArtUrl, imageUrl, scaledSize } from './images'
import { toFrame } from './mechData'

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

describe('frameArt', () => {
  const frame = (id: string, extra: Record<string, unknown> = {}) => toFrame(id, { name: id, ...extra })
  const frames = [frame('mf_blackbeard'), frame('mf_sagarmatha', { variant: 'Everest', license_id: 'mf_everest' }), frame('mf_everest', { name: 'Everest' }), frame('hb_mine')]
  it('uses the bundled art for an official frame', () => {
    expect(frameArt(frames[0], frames)).toEqual({ bundled: 'mf_blackbeard' })
  })
  it('lets an owner upload win over the bundled art', () => {
    expect(frameArt(frame('mf_blackbeard', { image: GOOD }), frames)).toEqual({ path: GOOD })
  })
  it('ignores an image that is not an upload path', () => {
    expect(frameArt(frame('mf_blackbeard', { image: 'https://evil.example/x.png' }), frames)).toEqual({ bundled: 'mf_blackbeard' })
    expect(frameArt(frame('hb_mine', { image: 'https://evil.example/x.png' }), frames)).toBeNull()
  })
  it("gives an alternate with no art of its own its original's, and a homebrew frame nothing", () => {
    const blackbeard = frame('mf_blackbeard', { name: 'Blackbeard' })
    const alt = frame('mf_test_alt', { variant: 'Blackbeard', license_id: blackbeard.id })
    expect(frameArt(alt, [blackbeard, alt])).toEqual({ bundled: blackbeard.id })
    // Everest's only art is Massif's "NO IMAGE DATA" placeholder, which isn't bundled: Sagarmatha gets the symbol too.
    const everest = frame('mf_standard_pattern_i_everest', { name: 'Everest' })
    const sagarmatha = frame('mf_sagarmatha', { variant: 'Everest', license_id: everest.id })
    expect(frameArt(sagarmatha, [everest, sagarmatha])).toBeNull()
    expect(frameArt(frames[3], frames)).toBeNull()
  })
  it('builds the link for an upload without loading anything, and none for no art', async () => {
    expect(await frameArtUrl({ path: GOOD })).toBe(imageUrl(GOOD))
    expect(await frameArtUrl(null)).toBeNull()
  })
})
