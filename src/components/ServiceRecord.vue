<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue'
import { confirmAction } from '../confirm'
import type { Json } from '../lib/database.types'
import { useSaveStatus } from '../saveStatus'
import { KIND_MARK, SHOWN, TITLE_MAX, entryProblem, formatDay, shownEntries, sortTimeline, today, useServiceRecord, type TimelineEntry } from '../serviceRecord'
import Icon from './Icon.vue'
import RichText from './RichText.vue'
import RichTextEditor from './RichTextEditor.vue'
import SaveStatus from './SaveStatus.vue'

// The pilot's service record: a vertical timeline, newest first. Everyone reads it. "canLog": this is your own living
// pilot, so you add, edit and delete your own log entries. "canGm": a GM in edit mode adds GM entries
// and edits or deletes any entry (Log, GM and Record). The database enforces it all.
const props = defineProps<{ record: ReturnType<typeof useServiceRecord>; canLog: boolean; canGm: boolean }>()

const sorted = computed(() => sortTimeline(props.record.entries.value))
const showAll = ref(false)
const shown = computed(() => shownEntries(sorted.value, showAll.value))

const canEdit = (entry: TimelineEntry) => props.canGm || (entry.kind === 'player' && props.canLog)
const canDelete = (entry: TimelineEntry) => canEdit(entry) || props.canGm

// The one open form: a new entry (id null) or an edit of one.
const status = useSaveStatus()
const form = reactive<{ open: boolean; kind: 'player' | 'gm'; id: string | null; title: string; occurred_on: string; error: string }>({
  open: false, kind: 'player', id: null, title: '', occurred_on: today(), error: '',
})
const body = shallowRef<Json | null>(null) // outside the reactive form: rich text is deeply nested JSON
const formKey = ref(0) // remounts the editor so it starts from the entry being edited

function openForm(kind: 'player' | 'gm', entry?: TimelineEntry) {
  Object.assign(form, { open: true, kind, id: entry?.id ?? null, title: entry?.title ?? '', occurred_on: entry?.occurred_on ?? today(), error: '' })
  body.value = entry?.body ?? null
  formKey.value++
}

async function save() {
  form.error = entryProblem(form.title, form.occurred_on) ?? ''
  if (form.error) return
  const fields = { title: form.title.trim(), occurred_on: form.occurred_on, body: body.value }
  const entry = form.id ? props.record.entries.value.find((e) => e.id === form.id) : undefined
  const failed = await status.track(entry ? props.record.edit(entry, fields) : props.record.add(form.kind, fields))
  if (failed) form.error = failed
  else form.open = false
}

async function remove(entry: TimelineEntry) {
  if (!(await confirmAction(`Delete "${entry.title}" from the service record? This can't be undone.`, { confirmLabel: 'Delete entry', danger: true }))) return
  await status.track(props.record.remove(entry))
}
</script>

<template>
  <div class="service-record">
    <!-- The buttons sit in the section's head (FileSection.vue). -->
    <Teleport defer to="#service-record-extra">
      <button v-if="canLog" type="button" class="small" :disabled="form.open" @click="openForm('player')"><Icon name="plus" />Add log entry</button>
      <button v-if="canGm" type="button" class="small" :disabled="form.open" @click="openForm('gm')"><Icon name="plus" />Add GM entry</button>
    </Teleport>

    <form v-if="form.open" class="entry-form" @submit.prevent="save">
      <h3 class="label">{{ form.id ? 'Edit' : 'New' }} {{ form.kind === 'gm' ? 'GM entry' : 'entry' }}</h3>
      <div class="row">
        <label class="field date"><span>Date</span><input v-model="form.occurred_on" type="date" required /></label>
        <label class="field grow"><span>Title</span><input v-model="form.title" type="text" :maxlength="TITLE_MAX" autocomplete="off" required /></label>
      </div>
      <div class="details">
        <span class="label">Details (optional)</span>
        <RichTextEditor :key="formKey" v-model="body" label="Details" />
      </div>
      <p v-if="form.error" class="error" role="alert">Not saved: {{ form.error }}</p>
      <div class="row buttons">
        <button type="submit" class="primary small" :disabled="status.saving.value">{{ form.id ? 'Save changes' : 'Add to record' }}</button>
        <button type="button" class="quiet small" :disabled="status.saving.value" @click="form.open = false">Cancel</button>
      </div>
    </form>
    <SaveStatus v-if="!form.open" :saving="status.saving.value" :saved="status.saved.value" :error="status.error.value" :can-retry="false" />

    <p v-if="record.loadError.value" class="notice warn" role="alert">The service record didn't load: {{ record.loadError.value }}</p>
    <p v-else-if="!record.loaded.value" class="dim" role="status">Loading…</p>
    <p v-else-if="!sorted.length" class="empty">No entries yet.</p>
    <ol v-else class="timeline">
      <li v-for="entry in shown" :key="entry.id" class="entry" :class="entry.kind">
        <span class="marker" aria-hidden="true"><Icon :name="KIND_MARK[entry.kind].icon" /></span>
        <div class="entry-body">
          <p class="meta">
            <time :datetime="entry.occurred_on" class="dim">{{ formatDay(entry.occurred_on) }}</time>
            <span class="label kind">{{ KIND_MARK[entry.kind].label }}</span>
          </p>
          <h3 class="title">{{ entry.title }}</h3>
          <RichText v-if="entry.body" :doc="entry.body" class="body" />
          <p v-if="canEdit(entry) || canDelete(entry)" class="row-actions">
            <button v-if="canEdit(entry)" type="button" class="quiet small" :disabled="form.open" @click="openForm(entry.kind === 'gm' ? 'gm' : 'player', entry)">Edit</button>
            <button v-if="canDelete(entry)" type="button" class="quiet small" @click="remove(entry)">Delete</button>
          </p>
        </div>
      </li>
    </ol>
    <div v-if="sorted.length > SHOWN" class="more">
      <button type="button" class="quiet small" @click="showAll = !showAll">{{ showAll ? 'Show fewer' : `Show all ${sorted.length}` }}</button>
    </div>
  </div>
</template>

<style scoped>
.entry-form {
  display: grid;
  gap: var(--space-m);
  margin-bottom: var(--space-l);
  padding: var(--space-m);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--void);
}

.entry-form h3 {
  margin: 0;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-m);
}

.grow {
  flex: 1 1 14rem;
}

.details {
  display: grid;
  gap: var(--space-xs);
}

.details > .label {
  color: var(--text-dim);
}

.date input {
  width: 11rem;
}

.grow input {
  width: 100%;
}

.error {
  margin: 0;
  color: var(--danger);
  font-size: var(--fs-s);
}

/* The line and its markers are the pilot's colour (decoration only), or a neutral one before they pick any. */
.timeline {
  --line: var(--pilot, var(--edge));
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  position: relative;
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: var(--space-m);
  padding-bottom: var(--space-l);
}

/* The vertical line runs through every marker and stops at the last. */
.entry::before {
  content: '';
  position: absolute;
  top: 2rem;
  bottom: 0;
  left: calc(1rem - 1px);
  width: 2px;
  background: var(--line);
  opacity: 0.6;
}

.entry:last-child {
  padding-bottom: 0;
}

.entry:last-child::before {
  display: none;
}

.marker {
  z-index: 1;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--line);
  border-radius: 50%;
  background: var(--panel);
  color: var(--text);
  font-size: 1rem;
}

.entry.auto .marker {
  border-style: dashed;
  color: var(--text-dim);
}

.entry-body {
  min-width: 0;
  overflow-wrap: anywhere;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-s) var(--space-m);
  margin: 0;
  font-size: var(--fs-s);
}

.kind {
  color: var(--text-dim);
  font-size: var(--fs-xs);
}

.title {
  margin: 2px 0 0;
  font-size: var(--fs-m);
  font-weight: 700;
}

.body {
  margin-top: var(--space-xs);
  font-size: var(--fs-s);
}

.row-actions {
  display: flex;
  gap: var(--space-s);
  margin: var(--space-xs) 0 0;
}

.more {
  margin-top: var(--space-m);
}
</style>
