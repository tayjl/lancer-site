// Pure helpers for the pilot ID card (PilotIdCard.vue). The PNG download lives in idCardExport.ts.

// Crockford's base 32: no I, L, O or U, so a serial read aloud or copied by eye isn't mistaken.
const DIGITS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// FNV-1a, 32 bits: a small, stable hash. The same text always gives the same number.
function fnv(text: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0
  return hash
}

const code = (hash: number) => Array.from({ length: 4 }, (_, i) => DIGITS[(hash >>> (i * 5)) & 31]).join('')

// "HOR-0042-7K3Q-9XZ2": the pilot's id, then two codes made from it. Deterministic, so the card always shows the same
// serial for the same pilot (it isn't a secret or a check, just a stamp).
export const pilotSerial = (id: number) => `HOR-${String(id).padStart(4, '0')}-${code(fnv(`HOR_OS:pilot:${id}`))}-${code(fnv(`HOR_OS:serial:${id}`))}`

// The longest start of "text" that fits in "max" (as "measure" counts it), with an ellipsis when it was cut.
export function fitText(text: string, max: number, measure: (text: string) => number) {
  if (measure(text) <= max) return text
  let end = text.length
  while (end > 0 && measure(`${text.slice(0, end).trimEnd()}…`) > max) end--
  return end > 0 ? `${text.slice(0, end).trimEnd()}…` : '…'
}

// The downloaded file's name: "<callsign>-id.png", with anything that isn't a letter or digit made safe.
export const cardFilename = (callsign: string) => `${callsign.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pilot'}-id.png`
