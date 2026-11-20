<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { confirmAction } from '../../confirm'
import { errorsOf, validateFaction } from '../../contentEditor'
import { createFaction, deleteFaction, saveFaction, type Loaded } from '../../editorStore'
import { CHANGED_ELSEWHERE } from '../../lib/supabaseClient'
import { useSaveStatus } from '../../saveStatus'
import ConflictNotice from '../ConflictNotice.vue'
import SaveStatus from '../SaveStatus.vue'

// A faction's editor (owners only): just a name. Factions are the organisations the GM-only reputation tracker lists on
// every pilot's review page. Saving is explicit, guarded by updated_at like the other site tables; "item" is null for a
// new one, "others" the names of the other factions.
const props = defineProps<{ item: Loaded | null; others: string[] }>()
const emit = defineEmits<{ created: [key: string]; changed: []; deleted: [] }>()

const isNew = props.item === null
const name = ref(String(props.item?.data.name ?? ''))
const baseline = ref(name.value)
const updatedAt = ref(props.item?.updatedAt ?? '')
const dirty = computed(() => name.value !== baseline.value)
// Once created, the list already holds this faction's own name until the page switches to it: don't check against it.
const created = ref(false)
const problems = computed(() => (created.value ? [] : validateFaction(name.value, props.others)))
const status = useSaveStatus()
const conflict = ref(false)
const busy = computed(() => status.saving.value)

async function save() {
  if (problems.value.length || busy.value || conflict.value) return
  const snapshot = name.value.trim()
  const failed = await status.track((async () => {
    const made = isNew ? await createFaction(snapshot) : null
    const result = made ?? await saveFaction({ ...props.item!, updatedAt: updatedAt.value }, snapshot)
    if (result.error !== undefined) return result.error
    baseline.value = snapshot
    name.value = snapshot
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
  if (!(await confirmAction(`Delete ${baseline.value}? Every pilot's reputation with it is removed. This can't be undone.`, { confirmLabel: 'Delete faction', danger: true }))) return
  deleteError.value = (await deleteFaction(props.item!.key)) ?? ''
  if (!deleteError.value) {
    baseline.value = name.value
    emit('deleted')
  }
}

const warnLeaving = (event: BeforeUnloadEvent) => { if (dirty.value) event.preventDefault() }
onMounted(() => window.addEventListener('beforeunload', warnLeaving))
onUnmounted(() => window.removeEventListener('beforeunload', warnLeaving))
defineExpose({ dirty })
</script>

<template>
  <article class="faction" :aria-label="`Editing ${baseline || 'new faction'}`">
    <section class="panel">
      <h2 class="sheet-label">{{ isNew ? 'New faction' : baseline }}<span class="private gm">GM only</span></h2>
      <ConflictNotice v-if="conflict" />
      <label class="field">
        <span>Name</span>
        <input v-model="name" type="text" maxlength="80" autocomplete="off" :aria-invalid="dirty && problems.length ? 'true' : undefined" @keydown.enter.prevent="save" />
      </label>
      <div class="row">
        <span v-if="errorsOf(problems).length" class="blocked">
          <button type="button" class="primary small" disabled aria-describedby="faction-why">{{ isNew ? 'Create' : 'Save changes' }}</button>
          <span id="faction-why" class="blocked-reason" role="alert"><b>Error:</b> {{ problems[0].text }}</span>
        </span>
        <button v-else type="button" class="primary small" :disabled="busy || conflict || (!isNew && !dirty)" @click="save">{{ isNew ? 'Create' : 'Save changes' }}</button>
        <button type="button" class="quiet small" :disabled="!dirty || busy" @click="name = baseline">Discard changes</button>
        <SaveStatus :saving="busy" :saved="status.saved.value && !dirty" :error="status.error.value" :can-retry="!conflict" @retry="save" />
      </div>
    </section>

    <section v-if="!isNew" class="panel danger-zone" aria-labelledby="faction-danger">
      <h3 id="faction-danger" class="sheet-label">Danger zone</h3>
      <div class="danger-body">
        <p class="dim">Deleting {{ baseline }} removes every pilot's reputation with it. This can't be undone.</p>
        <button type="button" class="danger" :disabled="busy" @click="remove">Delete faction</button>
      </div>
      <p v-if="deleteError" class="notice warn" role="alert">Not deleted: {{ deleteError }}</p>
    </section>
  </article>
</template>

<style scoped>
.faction {
  display: grid;
  gap: var(--space-m);
  min-width: 0;
}

.faction .panel {
  display: grid;
  gap: var(--space-m);
  align-content: start;
}

.faction h2,
.faction h3 {
  margin: 0;
}

.faction .notice,
.faction p {
  margin: 0;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
}
</style>
