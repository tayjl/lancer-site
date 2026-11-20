// A player's description of an item ("salvaged railgun"). A mech's system_notes are kept by the system's index ("2");
// owned pilot gear keeps its own on the owned entry (sheet.owned_gear[].notes).
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

// The notes after the item at "index" leaves its place: its note goes. With "shift" the list closes up behind it, so the
// notes after it move down one place and stay with their items. Other keys are kept.
export function withoutNote(notes: Notes = {}, index: number, shift: boolean): Notes {
  const result: Notes = {}
  for (const [key, text] of Object.entries(notes)) {
    const at = /^\d+$/.test(key) ? Number(key) : -1
    if (at === index) continue
    result[shift && at > index ? String(at - 1) : key] = text
  }
  return result
}
