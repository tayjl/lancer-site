<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { Json } from '../lib/database.types'
import AddBox from './AddBox.vue'
import Panel from './Panel.vue'
import RichText from './RichText.vue'
import RichTextEditor from './RichTextEditor.vue'

// A panel holding one piece of formatted text (e.g. appearance), with view, edit and add built in.
// "save" stores the new text and returns an error message, or null if it worked.
const props = defineProps<{
  title: string
  doc: Json | null
  editable: boolean
  tag?: string
  save: (doc: Json | null) => Promise<string | null>
}>()

const editing = ref(false)
const saving = ref(false)
const error = ref('')
const draft = shallowRef<Json | null>(null)

function open() {
  draft.value = props.doc
  error.value = ''
  editing.value = true
}

async function submit() {
  saving.value = true
  error.value = (await props.save(draft.value)) ?? ''
  saving.value = false
  if (!error.value) editing.value = false
}
</script>

<template>
  <Panel :title="title" :tag="tag">
    <template #actions>
      <button v-if="editable && doc && !editing" type="button" @click="open">edit</button>
    </template>

    <form v-if="editing" class="edit-form" @submit.prevent="submit">
      <RichTextEditor v-model="draft" :label="title" />
      <p v-if="error" class="rose" role="alert">{{ error }}</p>
      <div class="actions">
        <button type="submit" :disabled="saving">save</button>
        <button type="button" @click="editing = false">cancel</button>
      </div>
    </form>
    <RichText v-else-if="doc" :doc="doc" />
    <AddBox v-else-if="editable" :label="`write ${title}`" @click="open" />
    <p v-else class="dim empty">nothing on file.</p>
  </Panel>
</template>

<style scoped>
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.edit-form p,
.empty {
  margin: 0;
}

.actions {
  display: flex;
  gap: 1rem;
}

.actions button {
  padding-inline: 0;
  font-size: 0.875rem;
}
</style>
