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

const esc = (value: string | number) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The link preview tags for a pilot's page. Only approved and dead pilots get any; names are typed by players, so every value is escaped.
// The card picture is the one the pilot's browser saved (versioned, so Discord fetches it again after a change); without one, no image tags.
export function previewTags(card: PilotCard, supabaseUrl: string) {
  if (card.status !== 'approved' && card.status !== 'dead') return ''
  const colour = displayColour(card.colour)
  const tag = (attr: 'property' | 'name', key: string, value: string | number) => `<meta ${attr}="${key}" content="${esc(value)}">`
  const image = card.card_image && card.card_version ? `${supabaseUrl}/storage/v1/object/public/character-images/${card.card_image}?v=${encodeURIComponent(card.card_version)}` : null
  return [
    tag('property', 'og:type', 'website'),
    tag('property', 'og:site_name', 'HOR_OS'),
    tag('property', 'og:title', card.callsign || card.pilot_name),
    tag('property', 'og:description', `Level ${card.level} pilot. Licence level ${card.licence_level}.`),
    image ? tag('property', 'og:image', image) : '',
    image ? tag('property', 'og:image:width', 856) : '',
    image ? tag('property', 'og:image:height', 540) : '',
    image ? tag('name', 'twitter:card', 'summary_large_image') : '',
    colour ? tag('name', 'theme-color', colour) : '',
  ].join('')
}
