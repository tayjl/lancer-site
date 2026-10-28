// The public parts of a character (the characters table), which every logged-in user can see.
// The registry cards and the pilot record page both use this shape.

export type PublicMech = {
  id: string
  name: string
  manufacturer_id: string
  appearance: string | null
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
  appearance: string | null
  personality: string | null
  traits: string | null
  mechs: PublicMech[]
}

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
    appearance:
      'Wiry and sunburnt, with a crooked nose from a bad landing on Kos. Wears a patched flight jacket over everything, whatever the weather.',
    personality:
      "Dry, quick and hard to rattle. Jokes when things go wrong, goes quiet when they go very wrong. Doesn't trust anyone who's never been hungry.",
    traits: 'steady hands under fire. reads people fast. terrible at sitting still.',
    mechs: [
      {
        id: 'm1',
        name: "Lantern's Due",
        manufacturer_id: '7GQ2-K41X-0B9D',
        appearance: 'Matte grey plating with a hand-painted crescent moon on the left shoulder.',
        image: null,
      },
    ],
  },
]
