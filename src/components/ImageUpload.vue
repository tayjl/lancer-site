<script setup lang="ts">
import { readError } from '../lib/supabaseClient'
import { ref, useTemplateRef } from 'vue'
import { uploadImage } from '../images'

// Under a portrait while the page is editable: pick a picture (shrunk and uploaded by src/images.ts), then "save"
// stores its path on the card, the same way every other field saves. "path" is the stored path now, if any. The default
// slot adds more buttons after Replace and Remove.
const props = withDefaults(defineProps<{ path: string | null; save: (path: string | null) => Promise<string | null>; noun?: string; side?: number }>(), { noun: 'image' })

const input = useTemplateRef('input')
const busy = ref('') // what's happening, while something is
const error = ref('')

async function change(doing: string, next: () => Promise<string | null>) {
  busy.value = doing
  error.value = ''
  try {
    error.value = (await next()) ?? ''
  } catch (e) {
    error.value = readError((e as Error).message)
  }
  busy.value = ''
}

function pick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = '' // so picking the same file again still counts
  if (file) change('Uploading…', async () => props.save(await uploadImage(file, props.side)))
}
</script>

<template>
  <div class="image-upload">
    <input ref="input" type="file" accept="image/*" class="sr-only" tabindex="-1" :aria-label="`${path ? 'Replace' : 'Upload'} ${noun}`" @change="pick" />
    <div class="buttons">
      <button type="button" class="small" :disabled="!!busy" @click="input?.click()">{{ path ? 'Replace' : 'Upload' }} {{ noun }}</button>
      <button v-if="path" type="button" class="quiet small" :disabled="!!busy" @click="change('Saving…', () => save(null))">Remove {{ noun }}</button>
      <slot />
    </div>
    <p v-if="busy" class="dim status" role="status">{{ busy }}</p>
    <p v-else-if="error" class="error status" role="alert">Not saved: {{ error }}</p>
  </div>
</template>

<style scoped>
.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
  margin-top: var(--space-s);
}

.status {
  margin: var(--space-s) 0 0;
  font-size: var(--fs-s);
}

.error {
  color: var(--danger);
}
</style>
