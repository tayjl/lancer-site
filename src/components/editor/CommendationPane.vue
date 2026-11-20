<script setup lang="ts">
import { ICON_CHOICES } from '../../commendations'
import { COMMENDATION_DESCRIPTION_MAX, COMMENDATION_NAME_MAX, errorsOf, validateCommendation } from '../../contentEditor'
import { createCommendation, deleteCommendation, saveCommendation, type Loaded } from '../../editorStore'
import ConflictNotice from '../ConflictNotice.vue'
import Icon from '../Icon.vue'
import MedalBadge from '../MedalBadge.vue'
import SaveStatus from '../SaveStatus.vue'
import { useSimpleEditor } from './useSimpleEditor'

// A commendation's editor (owners only): name, description and an icon from the site's set. GMs award these to pilots
// from the pilot's review page. "item" is null for a new one, "others" the names of the other commendations.
const props = defineProps<{ item: Loaded | null; others: string[] }>()
const emit = defineEmits<{ created: [key: string]; changed: []; deleted: [] }>()

const { isNew, form, baseline, dirty, problems, status, conflict, busy, save, deleteError, remove } = useSimpleEditor(
  props.item,
  { name: String(props.item?.data.name ?? ''), description: String(props.item?.data.description ?? ''), icon: String(props.item?.data.icon ?? 'medal') },
  (fields) => validateCommendation(fields.name, fields.description, fields.icon, props.others, ICON_CHOICES),
  {
    create: createCommendation,
    save: saveCommendation,
    remove: deleteCommendation,
    confirm: (name) => ({ message: `Delete ${name}? Pilots who have it lose it. This can't be undone.`, label: 'Delete commendation' }),
  },
  emit,
)
const problemAt = (field: string) => (dirty.value ? problems.value.find((problem) => problem.field === field)?.text : undefined)
defineExpose({ dirty })
</script>

<template>
  <article class="simple-editor" :aria-label="`Editing ${baseline.name || 'new commendation'}`">
    <section class="panel">
      <h2 class="sheet-label">{{ isNew ? 'New commendation' : baseline.name }}<span class="private gm">GM only</span></h2>
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
      </div>
      <p v-if="deleteError" class="notice warn" role="alert">Not deleted: {{ deleteError }}</p>
    </section>
  </article>
</template>

<style scoped>
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
</style>
