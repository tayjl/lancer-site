import { displayColour } from '../src/pilotColour'

// The row pilot_card() returns (supabase/migrations/20261120110000_banner_position_and_public_card.sql). Public data only.
export type PilotCard = {
  id: number
  callsign: string | null
  pilot_name: string
  status: string
  approved_at: string | null
  level: number
  licence_level: number
  pilot_image: string | null
  colour: string | null
  medals: string[]
  card_image: string | null
  card_version: string | null
}

// The row mech_card() returns (supabase/migrations/20261121120000_mech_public_card.sql). Public data only.
export type MechCard = {
  character_id: number
  mech_id: string
  mech_name: string | null
  manufacturer_id: string | null
  mech_image: string | null // never used here: an unchecked player string
  frame_id: string | null
  frame_name: string | null
  frame_source: string | null
  callsign: string | null
  pilot_name: string
  status: string
  colour: string | null
  card_image: string | null
  card_version: string | null
}

const esc = (value: string | number) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const tag = (attr: 'property' | 'name', key: string, value: string | number) => `<meta ${attr}="${key}" content="${esc(value)}">`
const cardUrl = (supabaseUrl: string, path: string, version: string) =>
  `${supabaseUrl}/storage/v1/object/public/character-images/${path}?v=${encodeURIComponent(version)}`

// The tags every preview has: title, description, the card picture (856 x 540) when there is one, and a colour.
function tags(title: string, description: string, image: string | null, colour: string | null) {
  return [
    tag('property', 'og:type', 'website'),
    tag('property', 'og:site_name', 'HOR_OS'),
    tag('property', 'og:title', title),
    tag('property', 'og:description', description),
    image ? tag('property', 'og:image', image) : '',
    image ? tag('property', 'og:image:width', 856) : '',
    image ? tag('property', 'og:image:height', 540) : '',
    image ? tag('name', 'twitter:card', 'summary_large_image') : '',
    colour ? tag('name', 'theme-color', colour) : '',
  ].join('')
}

// The link preview tags for a pilot's page. Only approved and dead pilots get any; names are typed by players, so every value is escaped.
// The card picture is the one the pilot's browser saved (versioned, so Discord fetches it again after a change); without one, no image tags.
export function previewTags(card: PilotCard, supabaseUrl: string) {
  if (card.status !== 'approved' && card.status !== 'dead') return ''
  const image = card.card_image && card.card_version ? cardUrl(supabaseUrl, card.card_image, card.card_version) : null
  return tags(card.callsign || card.pilot_name, `Level ${card.level} pilot. Licence level ${card.licence_level}.`, image, displayColour(card.colour))
}

// A saved mech card picture's path, as mech_card() builds it: anything else is never put in a link.
const MECH_CARD_PATH = /^[0-9a-f-]{36}\/mech-card-[0-9]+-[0-9a-f-]{36}\.png$/

// The link preview tags for a mech's page ("IPS-N Blackbeard. Pilot: WARDEN."), like the pilot's. The maker's colour isn't
// known here (manufacturers are only readable when logged in), so there is no theme colour.
export function mechPreviewTags(card: MechCard, supabaseUrl: string) {
  if (card.status !== 'approved' && card.status !== 'dead') return ''
  const frame = [card.frame_source, card.frame_name].filter(Boolean).join(' ')
  const pilot = card.callsign || card.pilot_name
  const image = card.card_image && card.card_version && MECH_CARD_PATH.test(card.card_image) ? cardUrl(supabaseUrl, card.card_image, card.card_version) : null
  return tags(card.mech_name || 'Mech', `${frame ? `${frame}. ` : ''}Pilot: ${pilot}.`, image, null)
}
