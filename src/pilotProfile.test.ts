import { describe, expect, it, vi } from 'vitest'
import { CAPTION_MAX, GALLERY_MAX, addPicture, readGallery, removePicture, replacePicture, setCaption } from './pilotProfile'

// images.ts reads the session from auth.ts, which needs a real browser window.
vi.mock('./auth', () => ({ session: { value: null } }))

const path = (n: number) => `11111111-1111-4111-8111-111111111111/2222222${n}-2222-4222-8222-222222222222.webp`

describe('gallery', () => {
  it('adds pictures up to the limit, then changes nothing', () => {
    let gallery = [] as ReturnType<typeof readGallery>
    for (let i = 0; i < GALLERY_MAX + 2; i++) gallery = addPicture(gallery, path(i))
    expect(gallery).toHaveLength(GALLERY_MAX)
    expect(gallery[0]).toEqual({ path: path(0), caption: '' })
    expect(addPicture(gallery, path(9))).toBe(gallery)
  })
  it('replaces, removes and captions one picture without touching the others', () => {
    const gallery = [path(1), path(2), path(3)].map((p) => ({ path: p, caption: '' }))
    expect(replacePicture(gallery, 1, path(9)).map((g) => g.path)).toEqual([path(1), path(9), path(3)])
    expect(removePicture(gallery, 0).map((g) => g.path)).toEqual([path(2), path(3)])
    expect(setCaption(gallery, 2, 'Hello').map((g) => g.caption)).toEqual(['', '', 'Hello'])
    expect(setCaption(gallery, 0, 'x'.repeat(CAPTION_MAX + 20))[0].caption).toHaveLength(CAPTION_MAX)
  })
  it('reads stored JSON, dropping anything that is not an upload', () => {
    expect(readGallery([{ path: path(1), caption: 'A' }, { path: 'https://evil.example/x.png', caption: '' }, 'x', null, { path: path(2) }])).toEqual([
      { path: path(1), caption: 'A' },
      { path: path(2), caption: '' },
    ])
    expect(readGallery({})).toEqual([])
    expect(readGallery(undefined)).toEqual([])
  })
})
