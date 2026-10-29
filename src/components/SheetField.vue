<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { Json } from '../lib/database.types'
import RichText from './RichText.vue'
import RichTextEditor from './RichTextEditor.vue'

// One long piece of the pilot sheet (appearance, backstory...): a tag with its name, then a box you write
// straight into. It saves itself a moment after you stop typing. Read-only when the sheet can't be edited.
const props = defineProps<{
  title: string
  doc: Json | null
  editable: boolean
  tag?: string
  save: (doc: Json | null) => Promise<string | null>
}>()

// Only taken from "doc" once: the box keeps what you typed, even when the page reloads the pilot.
const draft = shallowRef<Json | null>(props.doc)
const status = ref('')
const error = ref('')
const DELAY = 800
let timer: ReturnType<typeof setTimeout> | undefined

async function flush() {
  clearTimeout(timer)
  timer = undefined
  status.value = 'saving...'
  error.value = (await props.save(draft.value)) ?? ''
  status.value = error.value ? '' : 'saved'
}

watch(draft, () => {
  clearTimeout(timer)
  status.value = 'unsaved'
  timer = setTimeout(flush, DELAY)
})

// Leaving the page mid-sentence still saves it.
onBeforeUnmount(() => {
  if (timer) flush()
})
</script>

<template>
  <section class="field">
    <h2 class="sheet-label">
      {{ title }}<span v-if="tag" class="tag"> [{{ tag }}]</span>
      <span class="status" role="status">{{ status }}</span>
      <span v-if="error" class="status rose" role="alert">not saved: {{ error }}</span>
    </h2>
    <RichTextEditor v-if="editable" v-model="draft" :label="title" />
    <RichText v-else-if="doc" :doc="doc" class="readonly" />
    <p v-else class="dim readonly">nothing on file.</p>
  </section>
</template>

<style scoped>
.sheet-label {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.status {
  color: var(--text-dim);
  font-size: 0.75rem;
  font-weight: 400;
}

/* A taller writing area than the default, with the toolbar tucked above it. */
.field :deep(.toolbar) {
  margin: 0.5rem 0;
}

.field :deep(.ProseMirror) {
  min-height: 11rem;
}

.readonly {
  max-width: none;
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--rule);
}
</style>
