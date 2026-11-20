import { describe, expect, it } from 'vitest'
import { mechPreviewTags, previewTags, type MechCard, type PilotCard } from './meta'

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

const PLAYER = 'aaaaaaaa-0000-4000-8000-000000000001'
const MECH = '85aded57-6bf9-4fac-b850-619b3d8b9df3'
const mech: MechCard = {
  character_id: 42,
  mech_id: MECH,
  mech_name: 'Lodestar',
  manufacturer_id: 'ABCD-1234-EF56',
  mech_image: 'javascript:alert(1)',
  frame_id: 'mf_blackbeard',
  frame_name: 'Blackbeard',
  frame_source: 'IPS-N',
  callsign: 'WARDEN',
  pilot_name: 'Ada Voss',
  status: 'approved',
  colour: '#ff8800',
  card_image: `${PLAYER}/mech-card-42-${MECH}.png`,
  card_version: 'a b',
}

describe('mechPreviewTags', () => {
  it('has the mech name, frame and pilot, and the versioned card picture', () => {
    const tags = mechPreviewTags(mech, url)
    expect(tags).toContain('property="og:title" content="Lodestar"')
    expect(tags).toContain('property="og:description" content="IPS-N Blackbeard. Pilot: WARDEN."')
    expect(tags).toContain(`content="https://x.supabase.co/storage/v1/object/public/character-images/${PLAYER}/mech-card-42-${MECH}.png?v=a%20b"`)
    expect(tags).toContain('name="twitter:card" content="summary_large_image"')
  })
  it('never uses the mech image or the pilot colour', () => {
    const tags = mechPreviewTags(mech, url)
    expect(tags).not.toContain('javascript')
    expect(tags).not.toContain('theme-color')
  })
  it('uses the name with no callsign, and leaves the frame out with none', () => {
    expect(mechPreviewTags({ ...mech, callsign: null, frame_name: null, frame_source: null }, url)).toContain('content="Pilot: Ada Voss."')
  })
  it('has no image tags without a saved picture, or with a path it did not build', () => {
    for (const card_image of [null, 'https://evil.example/x.png', `${PLAYER}/card-42.png`, `../${PLAYER}/mech-card-42-${MECH}.png`, `${PLAYER}/mech-card-42-${MECH}.png?x`]) {
      const tags = mechPreviewTags({ ...mech, card_image }, url)
      expect(tags).toContain('og:title')
      expect(tags).not.toContain('og:image')
    }
  })
  it('gives nothing for pilots that are not approved or dead', () => {
    expect(mechPreviewTags({ ...mech, status: 'dead' }, url)).toContain('og:title')
    for (const status of ['pending', 'draft', 'rejected']) expect(mechPreviewTags({ ...mech, status }, url)).toBe('')
  })
  it('escapes every player-typed value', () => {
    const tags = mechPreviewTags({ ...mech, mech_name: '"><script>', callsign: '<b>&', frame_name: '"x"' }, url)
    expect(tags).not.toContain('<script>')
    expect(tags).not.toContain('<b>')
    expect(tags).toContain('content="&quot;&gt;&lt;script&gt;"')
    expect(tags).toContain('content="IPS-N &quot;x&quot;. Pilot: &lt;b&gt;&amp;."')
  })
})
