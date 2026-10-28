<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import type { Entry } from '../entries'
import type { Json } from '../lib/database.types'
import AddBox from './AddBox.vue'
import Panel from './Panel.vue'
import RichText from './RichText.vue'
import RichTextEditor from './RichTextEditor.vue'

// A panel holding a modular list of named entries, like a pilot's traits or a mech's quirks.
// Each entry has a name and a formatted description, and can be added, edited or removed on its own.
// "save" stores the whole new list and returns an error message, or null if it worked.
const props = defineProps<{
  title: string
  noun: string
  entries: Entry[]
  editable: boolean
  tag?: string
  save: (entries: Entry[]) => Promise<string | null>
}>()

const NEW = 'new'
// The entry being edited, NEW for one being added, or null.
const editingId = ref<string | null>(null)
const name = ref('')
const description = shallowRef<Json | null>(null)
const saving = ref(false)
const error = ref('')

// The list as shown: while adding, a blank row at the end holds the form.
const rows = computed(() =>
  editingId.value === NEW ? [...props.entries, { id: NEW, name: '', description: null }] : props.entries,
)

function open(entry?: Entry) {
  editingId.value = entry?.id ?? NEW
  name.value = entry?.name ?? ''
  description.value = entry?.description ?? null
  error.value = ''
}

async function store(list: Entry[]) {
  saving.value = true
  error.value = (await props.save(list)) ?? ''
  saving.value = false
  if (!error.value) editingId.value = null
}

function submit() {
  if (!name.value.trim()) {
    error.value = `a ${props.noun} needs a name.`
    return
  }
  const entry: Entry = {
    id: editingId.value === NEW ? crypto.randomUUID() : editingId.value!,
    name: name.value.trim(),
    description: description.value,
  }
  store(editingId.value === NEW ? [...props.entries, entry] : props.entries.map((e) => (e.id === entry.id ? entry : e)))
}

function remove(entry: Entry) {
  if (window.confirm(`remove the ${props.noun} "${entry.name}"?`)) store(props.entries.filter((e) => e.id !== entry.id))
}
</script>

<template>
  <Panel :title="title" :tag="tag">
    <ul v-if="rows.length" class="entries">
      <li v-for="row in rows" :key="row.id">
        <form v-if="row.id === editingId" class="edit-form" @submit.prevent="submit">
          <label>
            <span class="dim">{{ noun }} name (required)</span>
            <input v-model="name" type="text" required />
          </label>
          <span class="dim label">description</span>
          <RichTextEditor v-model="description" :label="`${noun} description`" />
          <p v-if="error" class="rose" role="alert">{{ error }}</p>
          <div class="actions">
            <button type="submit" :disabled="saving">{{ row.id === NEW ? `add ${noun}` : 'save' }}</button>
            <button type="button" @click="editingId = null">cancel</button>
          </div>
        </form>

        <template v-else>
          <div class="entry-head">
            <p class="entry-name">{{ row.name }}</p>
            <div v-if="editable && !editingId" class="actions">
              <button type="button" @click="open(row)">edit</button>
              <button type="button" @click="remove(row)">remove</button>
            </div>
          </div>
          <RichText v-if="row.description" :doc="row.description" />
        </template>
      </li>
    </ul>

    <p v-if="!editable && !entries.length" class="dim empty">nothing on file.</p>
    <AddBox v-if="editable && !editingId" :label="`add ${noun}`" class="add" @click="open()" />
  </Panel>
</template>

<style scoped>
.entries {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entries li + li {
  padding-top: 1rem;
  border-top: 1px dashed var(--rule);
}

.entry-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

.entry-name {
  margin: 0;
  color: var(--lilac);
  font-weight: 600;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.edit-form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
}

.label {
  font-size: 0.8125rem;
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
  padding: 0;
  font-size: 0.8125rem;
}

.entries + .add {
  margin-top: 1rem;
}
</style>
