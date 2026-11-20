<script setup lang="ts">
import { errorsOf, validateFaction } from '../../contentEditor'
import { createFaction, deleteFaction, saveFaction, type Loaded } from '../../editorStore'
import ConflictNotice from '../ConflictNotice.vue'
import SaveStatus from '../SaveStatus.vue'
import { useSimpleEditor } from './useSimpleEditor'

// A faction's editor (owners only): just a name. Factions are the organisations the GM-only reputation tracker lists on
// every pilot's review page. "item" is null for a new one, "others" the names of the other factions.
const props = defineProps<{ item: Loaded | null; others: string[] }>()
const emit = defineEmits<{ created: [key: string]; changed: []; deleted: [] }>()

const { isNew, form, baseline, dirty, problems, status, conflict, busy, save, deleteError, remove } = useSimpleEditor(
  props.item,
  { name: String(props.item?.data.name ?? '') },
  (fields) => validateFaction(fields.name, props.others),
  {
    create: (fields) => createFaction(fields.name),
    save: (item, fields) => saveFaction(item, fields.name),
    remove: deleteFaction,
    confirm: (name) => ({ message: `Delete ${name}? Every pilot's reputation with it is removed. This can't be undone.`, label: 'Delete faction' }),
  },
  emit,
)
defineExpose({ dirty })
</script>

<template>
  <article class="simple-editor" :aria-label="`Editing ${baseline.name || 'new faction'}`">
    <section class="panel">
      <h2 class="sheet-label">{{ isNew ? 'New faction' : baseline.name }}<span class="private gm">GM only</span></h2>
      <ConflictNotice v-if="conflict" />
      <label class="field">
        <span>Name</span>
        <input v-model="form.name" type="text" maxlength="80" autocomplete="off" :aria-invalid="dirty && problems.length ? 'true' : undefined" @keydown.enter.prevent="save" />
      </label>
      <div class="row">
        <span v-if="errorsOf(problems).length" class="blocked">
          <button type="button" class="primary small" disabled aria-describedby="faction-why">{{ isNew ? 'Create' : 'Save changes' }}</button>
          <span id="faction-why" class="blocked-reason" role="alert"><b>Error:</b> {{ problems[0].text }}</span>
        </span>
        <button v-else type="button" class="primary small" :disabled="busy || conflict || (!isNew && !dirty)" @click="save">{{ isNew ? 'Create' : 'Save changes' }}</button>
        <button type="button" class="quiet small" :disabled="!dirty || busy" @click="form = { ...baseline }">Discard changes</button>
        <SaveStatus :saving="busy" :saved="status.saved.value && !dirty" :error="status.error.value" :can-retry="!conflict" @retry="save" />
      </div>
    </section>

    <section v-if="!isNew" class="panel danger-zone" aria-labelledby="faction-danger">
      <h3 id="faction-danger" class="sheet-label">Danger zone</h3>
      <div class="danger-body">
        <p class="dim">Deleting {{ baseline.name }} removes every pilot's reputation with it. This can't be undone.</p>
        <button type="button" class="danger" :disabled="busy" @click="remove">Delete faction</button>
      </div>
      <p v-if="deleteError" class="notice warn" role="alert">Not deleted: {{ deleteError }}</p>
    </section>
  </article>
</template>
