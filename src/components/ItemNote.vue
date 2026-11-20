<script setup lang="ts">
import { ref } from 'vue'
import { NOTE_MAX } from '../itemNotes'

// An equipped item's description, written by its player ("salvaged railgun"): an italic line under the card's head,
// or a text field while "editable". "save" stores the trimmed text ("" removes it) and returns an error message, or null.
const props = defineProps<{ text?: string; editable: boolean; save: (text: string) => Promise<string | null> }>()
const saving = ref(false)
const error = ref('')

async function change(event: Event) {
  const input = event.target as HTMLInputElement
  const value = (input.value = input.value.trim())
  if (value === (props.text ?? '')) return
  error.value = ''
  saving.value = true
  error.value = (await props.save(value)) ?? ''
  saving.value = false
}
</script>

<template>
  <div v-if="editable" class="item-note">
    <label class="field">
      <span>Description</span>
      <input type="text" :maxlength="NOTE_MAX" autocomplete="off" :value="text" :readonly="saving" @change="change" />
    </label>
    <p v-if="error" class="notice warn" role="alert">Not saved: {{ error }}</p>
  </div>
  <p v-else-if="text" class="item-note text">{{ text }}</p>
</template>

<style scoped>
.text {
  margin: 0;
  color: var(--text);
  font-style: italic;
  overflow-wrap: anywhere;
}

input {
  width: 100%;
  min-width: 0;
}

.notice {
  margin: var(--space-xs) 0 0;
}
</style>
