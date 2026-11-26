<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { Json } from '../lib/database.types'
import { CHANGED_ELSEWHERE } from '../lib/supabaseClient'
import RichText from './RichText.vue'
// Loaded only when the sheet can be edited, so read-only pages don't download the editor.
const RichTextEditor = defineAsyncComponent(() => import('./RichTextEditor.vue'))

// One long piece of the pilot sheet (appearance, backstory...): a tag with its name, then a box you write
// straight into. It saves itself a moment after you stop typing. Read-only when the sheet can't be edited.
const props = defineProps<{
  title: string
  doc: Json | null
  editable: boolean
  quiet?: boolean // no save status of its own (the page shows one)
  links?: { id: string; name: string; meta?: string; text?: string }[] // entries the writing may link to (lore only)
  save?: (doc: Json | null) => Promise<string | null> // none when read-only
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
  status.value = 'Saving…'
  error.value = (await props.save?.(draft.value)) ?? ''
  status.value = error.value ? '' : 'Saved'
}

watch(draft, () => {
  clearTimeout(timer)
  status.value = 'Unsaved changes'
  timer = setTimeout(flush, DELAY)
})

// Leaving the page mid-sentence still saves it.
onBeforeUnmount(() => {
  if (timer) flush()
})
</script>

<template>
  <section class="field">
    <header class="sheet-head head">
      <h2 class="sheet-label">
        {{ title }}
        <span v-if="!quiet" class="status" role="status">{{ status }}</span>
        <span v-if="error && !quiet" class="status error" role="alert">Not saved: {{ error }}</span>
        <button v-if="error && !quiet && error !== CHANGED_ELSEWHERE" type="button" class="small quiet" @click="flush">Retry</button>
      </h2>
      <slot name="head" />
    </header>
    <RichTextEditor v-if="editable" v-model="draft" :label="title" :links="links" />
    <RichText v-else-if="doc" :doc="doc" class="readonly prose" />
    <p v-else class="empty">No text.</p>
  </section>
</template>

<style scoped>
/* Writing headings are plain sub-section headings: bigger than a log entry's label, with a thin rule under the row. */
.head {
  padding-bottom: var(--space-s);
  border-bottom: 1px solid var(--rule);
}

.head .sheet-label {
  font-size: 16px;
}

.status {
  margin-left: 0.5rem;
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

/* A taller writing area than the default, with the toolbar tucked above it. */
.field :deep(.toolbar) {
  margin: 0.5rem 0;
}

.field :deep(.ProseMirror) {
  min-height: 11rem;
}

.status.error {
  color: var(--danger);
}

/* Read-only writing sits on the page's own surface, with no box around it. */
.readonly {
  max-width: none;
  margin: 0;
}
</style>
