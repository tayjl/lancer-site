import { describe, expect, it, vi } from 'vitest'
import { pilotMatches, type PublicPilot } from './pilots'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

const pilot = {
  callsign: 'WARDEN',
  pilot_name: 'Ada Vey',
  player: { display_name: 'tay' },
  mechs: [{ id: 'm', name: 'Lantern II', manufacturer_id: '', appearance: null, image: null }],
} as unknown as PublicPilot

describe('pilotMatches', () => {
  it('matches every word against callsign, name, player and mechs, ignoring case', () => {
    expect(pilotMatches(pilot, '')).toBe(true)
    expect(pilotMatches(pilot, 'warden')).toBe(true)
    expect(pilotMatches(pilot, 'vey  TAY lantern')).toBe(true)
    expect(pilotMatches(pilot, 'warden halfmoon')).toBe(false)
  })

  it('copes with no callsign or player', () => {
    expect(pilotMatches({ ...pilot, callsign: null, player: null }, 'ada')).toBe(true)
  })
})
