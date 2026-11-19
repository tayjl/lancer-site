// A pilot's own colour decorates their sheet (borders, bars, outlines), never buttons, links, status or text. A colour too
// dark to see against the page is lightened when drawn, until it has at least 3:1 contrast with the panel behind it.

export const HEX = /^#[0-9a-fA-F]{6}$/

const PANEL = '#1c1c21' // --panel in style.css; --void is darker, so a colour that shows on the panel shows there too
const MIN_CONTRAST = 3

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (channels: number[]) => `#${channels.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

// WCAG relative luminance, 0 (black) to 1 (white).
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

// The colour to draw for a stored one: itself, or mixed with white a little at a time until it shows. Null for none or
// anything that isn't #rrggbb.
export function displayColour(colour: string | null | undefined) {
  if (!colour || !HEX.test(colour)) return null
  const base = rgb(colour)
  for (let mix = 0; mix <= 1; mix += 0.05) {
    const shown = toHex(base.map((c) => c + (255 - c) * mix))
    if (contrast(shown, PANEL) >= MIN_CONTRAST) return shown
  }
  return '#ffffff'
}
