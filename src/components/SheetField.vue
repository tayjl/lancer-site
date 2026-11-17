<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { Json } from '../lib/database.types'
import { CHANGED_ELSEWHERE } from '../lib/supabaseClient'
import RichText from './RichText.vue'
import RichTextEditor from './RichTextEditor.vue'

// One long piece of the pilot sheet (appearance, backstory...): a tag with its name, then a box you write
// straight into. It saves itself a moment after you stop typing. Read-only when the sheet can't be edited.
const props = defineProps<{
  title: string
  doc: Json | null
  editable: boolean
  tag?: string
  quiet?: boolean // no save status of its own (the page shows one)
  links?: { id: string; name: string; meta?: string; text?: string }[] // entries the writing may link to (lore only)
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
  status.value = 'Saving…'
  error.value = (await props.save(draft.value)) ?? ''
  status.value = error.value ? '' : 'Saved'
}

watch(draft, () => {
  clearTimeout(timer)
  status.value = 'Not saved yet'
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
      {{ title }}<span v-if="tag" class="private">{{ tag }}</span>
      <span v-if="!quiet" class="status" role="status">{{ status }}</span>
      <span v-if="error && !quiet" class="status error" role="alert">Not saved: {{ error }}</span>
      <button v-if="error && !quiet && error !== CHANGED_ELSEWHERE" type="button" class="small quiet" @click="flush">Retry</button>
    </h2>
    <RichTextEditor v-if="editable" v-model="draft" :label="title" :links="links" />
    <RichText v-else-if="doc" :doc="doc" class="readonly prose" />
    <p v-else class="empty">Nothing on file.</p>
  </section>
</template>

<style scoped>
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

.readonly {
  max-width: none;
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--rule);
}

/* Already inside a panel (the pilot sheet): no second box around read-only writing. */
.field.panel .readonly {
  padding: 0;
  border: 0;
}
</style>
