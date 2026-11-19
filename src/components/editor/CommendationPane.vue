<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ICON_CHOICES } from '../../commendations'
import { confirmAction } from '../../confirm'
import { COMMENDATION_DESCRIPTION_MAX, COMMENDATION_NAME_MAX, errorsOf, validateCommendation } from '../../contentEditor'
import { createCommendation, deleteCommendation, saveCommendation, type Loaded } from '../../editorStore'
import { CHANGED_ELSEWHERE } from '../../lib/supabaseClient'
import { useSaveStatus } from '../../saveStatus'
import ConflictNotice from '../ConflictNotice.vue'
import Icon from '../Icon.vue'
import MedalBadge from '../MedalBadge.vue'
import SaveStatus from '../SaveStatus.vue'

// A commendation's editor (owners only): name, description and an icon from the site's set. GMs award these to pilots
// from the pilot's review page. Saving is explicit and guarded by updated_at like the other site tables; "item" is null
// for a new one, "others" the names of the other commendations.
const props = defineProps<{ item: Loaded | null; others: string[] }>()
const emit = defineEmits<{ created: [key: string]; changed: []; deleted: [] }>()

const isNew = props.item === null
const form = ref({ name: String(props.item?.data.name ?? ''), description: String(props.item?.data.description ?? ''), icon: String(props.item?.data.icon ?? 'medal') })
const baseline = ref({ ...form.value })
const updatedAt = ref(props.item?.updatedAt ?? '')
const dirty = computed(() => (Object.keys(form.value) as (keyof typeof form.value)[]).some((key) => form.value[key] !== baseline.value[key]))
// Once created, the list already holds this commendation's own name until the page switches to it: don't check against it.
const created = ref(false)
const problems = computed(() => created.value ? [] : validateCommendation(form.value.name, form.value.description, form.value.icon, props.others, ICON_CHOICES))
const problemAt = (field: string) => (dirty.value ? problems.value.find((problem) => problem.field === field)?.text : undefined)
const status = useSaveStatus()
const conflict = ref(false)
const busy = computed(() => status.saving.value)

async function save() {
  if (problems.value.length || busy.value || conflict.value) return
  const snapshot = { ...form.value, name: form.value.name.trim() }
  const failed = await status.track((async () => {
    const made = isNew ? await createCommendation(snapshot) : null
    const result = made ?? await saveCommendation({ ...props.item!, updatedAt: updatedAt.value }, snapshot)
    if (result.error !== undefined) return result.error
    baseline.value = { ...snapshot }
    form.value = { ...snapshot }
    if (made?.key) {
      created.value = true
      emit('created', made.key)
    }
    else {
      updatedAt.value = result.updatedAt
      emit('changed')
    }
    return null
  })())
  if (failed === CHANGED_ELSEWHERE) conflict.value = true
}

const deleteError = ref('')
async function remove() {
  if (!(await confirmAction(`Delete ${baseline.value.name}? Pilots who have it lose it. This can't be undone.`, { confirmLabel: 'Delete commendation', danger: true }))) return
  deleteError.value = (await deleteCommendation(props.item!.key)) ?? ''
  if (!deleteError.value) {
    baseline.value = { ...form.value }
    emit('deleted')
  }
}

const warnLeaving = (event: BeforeUnloadEvent) => { if (dirty.value) event.preventDefault() }
onMounted(() => window.addEventListener('beforeunload', warnLeaving))
onUnmounted(() => window.removeEventListener('beforeunload', warnLeaving))
defineExpose({ dirty })
</script>

<template>
  <article class="commendation" :aria-label="`Editing ${baseline.name || 'new commendation'}`">
    <section class="panel">
      <h2 class="sheet-label">{{ isNew ? 'New commendation' : baseline.name }}<span class="private">GM only</span></h2>
      <ConflictNotice v-if="conflict" />
      <label class="field">
        <span>Name</span>
        <input v-model="form.name" type="text" :maxlength="COMMENDATION_NAME_MAX" autocomplete="off" :aria-invalid="problemAt('name') ? 'true' : undefined" />
        <span v-if="problemAt('name')" class="field-error" role="alert"><b>Error:</b> {{ problemAt('name') }}</span>
      </label>
      <label class="field">
        <span>Description</span>
        <textarea v-model="form.description" rows="3" :maxlength="COMMENDATION_DESCRIPTION_MAX" :aria-invalid="problemAt('description') ? 'true' : undefined"></textarea>
        <span class="hint">Shown to everyone when they open the medal. {{ form.description.length }} of {{ COMMENDATION_DESCRIPTION_MAX }}.</span>
      </label>
      <fieldset class="icons">
        <legend class="label">Icon</legend>
        <div class="grid">
          <label v-for="name in ICON_CHOICES" :key="name" class="icon-option">
            <input v-model="form.icon" type="radio" name="commendation-icon" :value="name" />
            <span class="tile"><Icon :name="name" /></span>
            <span class="sr-only">{{ name }}</span>
          </label>
        </div>
      </fieldset>
      <div class="preview" aria-label="Preview">
        <span class="label">Preview</span>
        <MedalBadge :icon="form.icon" :name="form.name.trim() || 'Commendation'" />
      </div>
      <div class="row">
        <span v-if="errorsOf(problems).length" class="blocked">
          <button type="button" class="primary small" disabled aria-describedby="commendation-why">{{ isNew ? 'Create' : 'Save changes' }}</button>
          <span id="commendation-why" class="blocked-reason" role="alert"><b>Error:</b> {{ problems[0].text }}</span>
        </span>
        <button v-else type="button" class="primary small" :disabled="busy || conflict || (!isNew && !dirty)" @click="save">{{ isNew ? 'Create' : 'Save changes' }}</button>
        <button type="button" class="quiet small" :disabled="!dirty || busy" @click="form = { ...baseline }">Discard changes</button>
        <SaveStatus :saving="busy" :saved="status.saved.value && !dirty" :error="status.error.value" :can-retry="!conflict" @retry="save" />
      </div>
    </section>

    <section v-if="!isNew" class="panel danger-zone" aria-labelledby="commendation-danger">
      <h3 id="commendation-danger" class="sheet-label">Danger zone</h3>
      <div class="danger-body">
        <p class="dim">Deleting {{ baseline.name }} takes it from every pilot who has it. This can't be undone.</p>
        <button type="button" class="danger" :disabled="busy" @click="remove">Delete commendation</button>
        <p v-if="deleteError" class="notice warn" role="alert">Not deleted: {{ deleteError }}</p>
      </div>
    </section>
  </article>
</template>

<style scoped>
.commendation {
  display: grid;
  gap: var(--space-m);
  min-width: 0;
}

.commendation .panel {
  display: grid;
  gap: var(--space-m);
  align-content: start;
}

.commendation h2,
.commendation h3 {
  margin: 0;
}

.commendation .notice,
.commendation p {
  margin: 0;
}

textarea {
  width: 100%;
  resize: vertical;
}

.field-error {
  color: var(--danger);
  font-size: var(--fs-s);
}

.icons {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.icons legend {
  margin-bottom: var(--space-s);
  padding: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
  gap: var(--space-s);
}

/* A real radio input, hidden but focusable; its tile shows the choice (a thicker outline, never colour alone). */
.icon-option {
  position: relative;
  display: block;
}

.icon-option input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.tile {
  display: grid;
  place-items: center;
  min-height: var(--tap);
  aspect-ratio: 1;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--raised);
  color: var(--text-dim);
  font-size: 1.5rem;
}

.icon-option:hover .tile {
  border-color: var(--edge);
  color: var(--text);
}

.icon-option input:checked + .tile {
  border: 2px solid var(--lilac);
  color: var(--text);
}

.icon-option input:focus-visible + .tile {
  outline: 2px solid var(--lilac);
  outline-offset: 2px;
}

.preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-m);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
}
</style>
