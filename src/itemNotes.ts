// A player's description of an equipped item ("salvaged railgun"), kept on the sheet by the item's place:
// pilot_gear_notes by loadout slot ("Weapon:1"), a mech's system_notes by the system's index ("2").
export const NOTE_MAX = 140

export type Notes = Record<string, string>

// The notes with one set to "text" (trimmed), or removed when it's empty.
export function withNote(notes: Notes = {}, key: string, text: string): Notes {
  const result = { ...notes }
  const trimmed = text.trim().slice(0, NOTE_MAX)
  if (trimmed) result[key] = trimmed
  else delete result[key]
  return result
}

// The notes after the item at "index" (key prefix + index) leaves its place: its note goes. With "shift" the list closes
// up behind it, so the notes after it move down one place and stay with their items. Other keys are kept.
export function withoutNote(notes: Notes = {}, index: number, shift: boolean, prefix = ''): Notes {
  const result: Notes = {}
  for (const [key, text] of Object.entries(notes)) {
    const place = key.slice(prefix.length)
    const at = key.startsWith(prefix) && /^\d+$/.test(place) ? Number(place) : -1
    if (at === index) continue
    result[shift && at > index ? `${prefix}${at - 1}` : key] = text
  }
  return result
}
