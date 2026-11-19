import { ref } from 'vue'

// A submit that failed starts its error with this, and the status line shows it as written (not as "Not saved: …").
export const NOT_SUBMITTED = 'Not submitted: '

// The save status the pilot sheet and mech pages show ("Saving…", "Saved" or "Not saved: …", see SaveStatus.vue).
// track() runs a save (one that resolves to an error message, or null) and updates the status; it returns the error.
export function useSaveStatus() {
  const saving = ref(false)
  const saved = ref(false)
  const error = ref('')

  async function track(save: Promise<string | null>) {
    saving.value = true
    error.value = (await save) ?? ''
    saving.value = false
    saved.value = !error.value
    return error.value || null
  }

  return { saving, saved, error, track }
}
