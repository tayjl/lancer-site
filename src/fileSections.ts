import { reactive } from 'vue'

// Which pilot-file and mech-file sections are folded, remembered per viewer in this browser (the page works without storage).
const KEY = 'pilot-file-folded:'
const folded = reactive<Record<string, boolean>>({})

export function isFolded(id: string) {
  if (!(id in folded)) {
    try {
      folded[id] = localStorage.getItem(KEY + id) === '1'
    } catch {
      folded[id] = false
    }
  }
  return folded[id]
}

export function setFolded(id: string, value: boolean) {
  folded[id] = value
  try {
    localStorage.setItem(KEY + id, value ? '1' : '0')
  } catch {
    /* no storage: the choice lasts until reload */
  }
}
