import type { Json } from './lib/database.types'

// The public parts of a character (the characters table), which every logged-in user can see.
// The registry cards and the pilot record page both use this shape.
// Appearance and personality are formatted text from the editor (shown with RichText.vue); traits are a
// list of named entries (see src/entries.ts).

export type PublicMech = {
  id: string
  name: string
  manufacturer_id: string
  appearance: Json | null
  image: string | null
}

export type PublicPilot = {
  id: number
  callsign: string | null
  pilot_name: string
  pilot_image: string | null
  age: string | null
  gender: string | null
  sexuality: string | null
  height: string | null
  weight: string | null
  eye_colour: string | null
  hair_colour: string | null
  appearance: Json | null
  personality: Json | null
  traits: Json | null
  mechs: PublicMech[]
}

// One plain paragraph in the editor's format, for the example below.
const paragraph = (text: string): Json => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

// shortcut: a hard-coded example to settle the look. Replace it with approved pilots from the
// characters table once registration is built.
export const examplePilots: PublicPilot[] = [
  {
    id: 1,
    callsign: 'HALFMOON',
    pilot_name: 'Ines Varga',
    pilot_image: null,
    age: '29',
    gender: 'woman',
    sexuality: 'bisexual',
    height: '1.74 m',
    weight: '68 kg',
    eye_colour: 'grey',
    hair_colour: 'black, shaved at the sides',
    appearance: paragraph(
      'Wiry and sunburnt, with a crooked nose from a bad landing on Kos. Wears a patched flight jacket over everything, whatever the weather.',
    ),
    personality: paragraph(
      "Dry, quick and hard to rattle. Jokes when things go wrong, goes quiet when they go very wrong. Doesn't trust anyone who's never been hungry.",
    ),
    traits: [
      { id: 't1', name: 'steady hands', description: paragraph('Stays calm and precise under fire.') },
      { id: 't2', name: 'reads people', description: paragraph('Quick to tell when someone is lying.') },
      { id: 't3', name: 'restless', description: paragraph('Terrible at sitting still for long.') },
    ],
    mechs: [
      {
        id: 'm1',
        name: "Lantern's Due",
        manufacturer_id: '7GQ2-K41X-0B9D',
        appearance: paragraph('Matte grey plating with a hand-painted crescent moon on the left shoulder.'),
        image: null,
      },
    ],
  },
]
