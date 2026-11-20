import { reactive } from 'vue'

// Which pilot-file and mech-file sections are folded, remembered per viewer in this browser (the page works without storage).
// The content editor's folds use it too, with ids starting "editor:" (FoldPanel.vue); "fallback" is the fold's own default.
const KEY = 'pilot-file-folded:'
const folded = reactive<Record<string, boolean>>({})

export function isFolded(id: string, fallback = false) {
  if (!(id in folded)) {
    try {
      const stored = localStorage.getItem(KEY + id)
      folded[id] = stored === null ? fallback : stored === '1'
    } catch {
      folded[id] = fallback
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
