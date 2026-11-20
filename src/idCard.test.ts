import { describe, expect, it } from 'vitest'
import { barcodeBars, cardFilename, cardFingerprint, fitText, pilotSerial } from './idCard'

describe('pilot serial', () => {
  it('is deterministic and shaped UNI-0042-XXXX-XXXX', () => {
    expect(pilotSerial(42)).toBe(pilotSerial(42))
    expect(pilotSerial(42)).toMatch(/^UNI-0042-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/)
  })
  it('differs between pilots and keeps long ids whole', () => {
    expect(pilotSerial(42)).not.toBe(pilotSerial(43))
    expect(pilotSerial(12345)).toMatch(/^UNI-12345-/)
  })
})

describe('barcodeBars', () => {
  const bars = barcodeBars('UNI-0042-7K3Q-9XZ2', 64)
  it('is deterministic and differs between serials', () => {
    expect(barcodeBars('UNI-0042-7K3Q-9XZ2', 64)).toEqual(bars)
    expect(barcodeBars('UNI-0043-AAAA-BBBB', 64)).not.toEqual(bars)
  })
  it('has guard bars at both ends and bars that stay inside and never touch', () => {
    expect(bars[0]).toEqual({ x: 0, w: 1 })
    expect(bars[bars.length - 1]).toEqual({ x: 63, w: 1 })
    bars.forEach((bar, i) => {
      expect(bar.x + bar.w).toBeLessThanOrEqual(64)
      if (i) expect(bar.x).toBeGreaterThan(bars[i - 1].x + bars[i - 1].w)
    })
  })
})

describe('fitText', () => {
  const measure = (text: string) => text.length * 10
  it('leaves text that fits', () => expect(fitText('WARDEN', 100, measure)).toBe('WARDEN'))
  it('cuts text that does not, with an ellipsis that still fits', () => {
    const out = fitText('Wardenclyffe Tower', 100, measure)
    expect(out.endsWith('…')).toBe(true)
    expect(measure(out)).toBeLessThanOrEqual(100)
  })
  it('gives only the ellipsis when nothing fits', () => expect(fitText('Wardenclyffe', 5, measure)).toBe('…'))
})

describe('cardFilename', () => {
  it('makes a safe png name', () => {
    expect(cardFilename('WARDEN')).toBe('warden-id.png')
    expect(cardFilename('Lady / Luck!')).toBe('lady-luck-id.png')
    expect(cardFilename('???')).toBe('pilot-id.png')
  })
})

describe('card fingerprint', () => {
  it('is stable and changes with what the card shows', () => {
    expect(cardFingerprint([1, 'A', 3])).toBe(cardFingerprint([1, 'A', 3]))
    expect(cardFingerprint([1, 'A', 3])).not.toBe(cardFingerprint([1, 'A', 4]))
  })
})
