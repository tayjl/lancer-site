import { describe, expect, it } from 'vitest'
import { previewTags, type PilotCard } from './meta'

const card: PilotCard = { id: 42, callsign: 'WARDEN', pilot_name: 'Ada Voss', status: 'approved', approved_at: null, level: 3, licence_level: 2, pilot_image: null, colour: '#ff8800', medals: [], card_image: 'p/card-42.png', card_version: 'a b' }
const url = 'https://x.supabase.co'

describe('previewTags', () => {
  it('has the title, description, versioned image and colour for an approved pilot', () => {
    const tags = previewTags(card, url)
    expect(tags).toContain('property="og:title" content="WARDEN"')
    expect(tags).toContain('content="Level 3 pilot. Licence level 2."')
    expect(tags).toContain('content="https://x.supabase.co/storage/v1/object/public/character-images/p/card-42.png?v=a%20b"')
    expect(tags).toContain('og:image:width" content="856"')
    expect(tags).toContain('name="twitter:card" content="summary_large_image"')
    expect(tags).toContain('name="theme-color" content="#ff8800"')
  })
  it('has no image tags until a card picture is saved', () => {
    const tags = previewTags({ ...card, card_image: null, card_version: null }, url)
    expect(tags).toContain('og:title')
    expect(tags).not.toContain('og:image')
    expect(tags).not.toContain('twitter:card')
  })
  it('uses the name when there is no callsign, and covers dead pilots', () => {
    expect(previewTags({ ...card, callsign: null, status: 'dead' }, url)).toContain('content="Ada Voss"')
  })
  it('gives nothing for pilots that are not approved or dead', () => {
    for (const status of ['pending', 'draft', 'rejected']) expect(previewTags({ ...card, status }, url)).toBe('')
  })
  it('escapes names', () => {
    const tags = previewTags({ ...card, callsign: '"><script>' }, url)
    expect(tags).not.toContain('<script>')
    expect(tags).toContain('content="&quot;&gt;&lt;script&gt;"')
  })
})
