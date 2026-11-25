<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { confirmAction } from '../../confirm'
import type { Problem } from '../../contentEditor'
import { blankRow, definitionProblems, iconLabel, idFromLabel, notDeleted, savePayload, slotsText, toEditRows, withData, withoutName, type EditRow } from '../../definitionEditor'
import { defIds, defKindInfo, loadDefinitionRows, loadDefinitions, type DefKind } from '../../definitions'
import { deleteDefinition, loadListSaveLine, saveDefinitions } from '../../editorStore'
import { invalidateCatalogues } from '../../gameData'
import { iconNames, iconUrl } from '../../icons'
import { CHANGED_ELSEWHERE } from '../../lib/supabaseClient'
import { useSaveStatus } from '../../saveStatus'
import { capitalise, plural } from '../../text'
import ConflictNotice from '../ConflictNotice.vue'
import Icon from '../Icon.vue'
import SaveStatus from '../SaveStatus.vue'
import Field from './Field.vue'
import FieldError from './FieldError.vue'
import RepeatList from './RepeatList.vue'
import ToggleChips from './ToggleChips.vue'
import { provideProblems } from './useFields'

// One list of the small game lists (damage types, mount types ...) edited as a whole: order, labels, icons, colours, mount
// slots and hidden, with one Save. The view keys it by list, so it starts afresh for each. An id is fixed once saved; a saved
// row is hidden or deleted, never removed from the list.
const props = defineProps<{ kind: DefKind }>()
const emit = defineEmits<{ changed: [] }>()
const info = defKindInfo(props.kind)!
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

const rows = shallowRef<EditRow[]>([])
const baseline = shallowRef<EditRow[]>([])
const loading = ref(true)
const loadError = ref('')
const resetKey = ref(0)
const dirty = computed(() => JSON.stringify(rows.value) !== JSON.stringify(baseline.value))

const savedLine = ref('')
async function load() {
  const result = await loadDefinitionRows(props.kind)
  loading.value = false
  loadError.value = result.error ?? ''
  if (result.error) return
  rows.value = toEditRows(result.rows)
  baseline.value = clone(rows.value)
  savedLine.value = await loadListSaveLine(props.kind)
}
onMounted(load)

const sizes = computed(() => defIds('weapon_sizes', true))
const iconOptions = computed(() => ({ suggested: (info.icons ?? []).filter((name) => iconUrl(name)), all: iconNames }))
const colourLabel = (name: unknown) => info.colours?.find((c) => c.name === name)?.label ?? String(name ?? '')
const known = (name: unknown) => typeof name === 'string' && /^--[\w-]+$/.test(name)
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const slotsOf = (row: EditRow): string[][] => (Array.isArray(row.data.slots) ? (row.data.slots as string[][]) : [])
const nameOf = (row: EditRow, index: number) => row.label.trim() || `${capitalise(info.singular)} ${index + 1}`
const summaryOf = (row: EditRow) => [
  row.id.trim() && row.id.trim() !== row.label.trim() ? `ID ${row.id.trim()}` : '',
  row.data.colour ? colourLabel(row.data.colour) : '',
  info.mount && slotsOf(row).length ? slotsText(slotsOf(row), sizes.value) : '',
].filter(Boolean).join(' · ')

// Problems: a new row nobody has typed in yet shows none (Save stays blocked meanwhile).
const problems = computed<Problem[]>(() => definitionProblems(info, rows.value))
const errorCount = computed(() => problems.value.length)
const pristine = (index: number) => JSON.stringify(rows.value[index]) === JSON.stringify(blankRow())
const shown = computed(() => problems.value.filter((problem) => !pristine(Number(/^rows\.(\d+)\./.exec(problem.field ?? '')?.[1]))))
// Under a field the row's name is left off, it's the row you're in.
const inline = computed(() => shown.value.map((problem) => {
  const index = Number(/^rows\.(\d+)\./.exec(problem.field ?? '')?.[1])
  return { ...problem, text: withoutName(problem.text, nameOf(rows.value[index], index)) }
}))
provideProblems(inline)

const status = useSaveStatus()
const conflict = ref(false)
const busy = computed(() => status.saving.value)
const deleteErrors = ref<Record<string, string>>({})

async function save() {
  if (errorCount.value || busy.value || conflict.value || !dirty.value) return
  const failed = await status.track(saveDefinitions(props.kind, savePayload(rows.value, baseline.value)))
  if (failed === CHANGED_ELSEWHERE) return void (conflict.value = true)
  if (failed) return
  invalidateCatalogues()
  loadDefinitions()
  await load()
  emit('changed')
}

const discard = () => {
  rows.value = clone(baseline.value)
  resetKey.value++
}

async function remove(row: EditRow) {
  if (busy.value || !(await confirmAction(`Delete ${row.label}? It's removed from every list. This can't be undone.`, { confirmLabel: `Delete ${info.singular}`, danger: true }))) return
  const failed = await deleteDefinition(props.kind, row.id)
  if (failed) return void (deleteErrors.value = { ...deleteErrors.value, [row.id]: notDeleted(failed) })
  const gone = (list: EditRow[]) => list.filter((other) => other.id !== row.id)
  rows.value = gone(rows.value)
  baseline.value = gone(baseline.value)
  invalidateCatalogues()
  loadDefinitions()
  emit('changed')
}

type Change = (changes: Partial<EditRow>) => void
const setData = (item: EditRow, change: Change, changes: Record<string, unknown>) => change({ data: withData(item.data, changes) })
const setLabel = (item: EditRow, change: Change, label: string) => change({ label, ...(!item.saved && !item.idTouched ? { id: idFromLabel(props.kind, label) } : {}) })
const setSlot = (item: EditRow, change: Change, n: number, slot: string[]) => setData(item, change, { slots: slotsOf(item).map((s, i) => (i === n ? slot : s)) })

// A conflict's Reload throws the edits away on purpose, so it doesn't ask.
const reloading = ref(false)
const warnLeaving = (event: BeforeUnloadEvent) => { if (dirty.value && !reloading.value) event.preventDefault() }
onMounted(() => window.addEventListener('beforeunload', warnLeaving))
onUnmounted(() => window.removeEventListener('beforeunload', warnLeaving))
defineExpose({ dirty })
</script>

<template>
  <article class="editor-pane def-pane" :aria-label="`Editing ${info.label.toLowerCase()}`">
    <p v-if="loading" class="dim" role="status">Loading…</p>
    <p v-else-if="loadError" class="notice warn" role="alert">The list didn't load: {{ loadError }}</p>
    <template v-else>
      <div class="bar">
        <Icon name="list" class="kind-ico" />
        <h2>{{ info.label }}</h2>
        <span v-if="dirty && !busy" class="dim status">Unsaved changes</span>
        <SaveStatus :saving="busy" :saved="status.saved.value && !dirty" :error="conflict ? '' : status.error.value" :can-retry="!conflict" @retry="save" />
        <div class="btn-row">
          <button type="button" class="quiet small" :disabled="!dirty || busy" @click="discard">Discard changes</button>
          <span v-if="errorCount" class="blocked">
            <button type="button" class="primary small" disabled aria-describedby="save-why">Save changes</button>
            <span id="save-why" class="blocked-reason">Fix {{ plural(errorCount, 'problem') }} first</span>
          </span>
          <button v-else type="button" class="primary small" :disabled="busy || conflict || !dirty" @click="save">Save changes</button>
        </div>
      </div>

      <ConflictNotice v-if="conflict" @reload="reloading = true" />
      <div v-if="shown.length" class="notice warn" role="alert">
        <p class="notice-title">Fix {{ plural(shown.length, 'problem') }} before saving</p>
        <ul class="problems">
          <li v-for="(problem, index) in shown" :key="index"><b>Error:</b> {{ problem.text }}</li>
        </ul>
      </div>
      <p v-if="savedLine" class="dim hint">{{ savedLine }}</p>
      <p class="dim hint">The order here is the order in every list.</p>
      <p v-if="!rows.length" class="empty">No {{ info.label.toLowerCase() }} yet.</p>

      <RepeatList :key="resetKey" v-model="rows" :noun="info.singular" :make="blankRow" path="rows" :add-label="`New ${info.singular}`" :name-of="nameOf" :removable="(row) => !row.saved">
        <template #title="{ item, index }">
          <span class="def-title">
            <span v-if="known(item.data.colour)" class="swatch" :style="{ background: `var(${item.data.colour})` }" aria-hidden="true"></span>
            <Icon v-if="text(item.data.icon) && iconUrl(text(item.data.icon))" :name="text(item.data.icon)" class="def-icon" />
            {{ nameOf(item, index) }}
            <span v-if="item.hidden" class="badge">Hidden</span>
          </span>
        </template>
        <template #summary="{ item }">{{ summaryOf(item) }}</template>
        <template #default="{ item, index, change }">
          <div class="ed-form">
            <Field label="Label" :path="`rows.${index}.label`">
              <input type="text" autocomplete="off" :value="item.label" @input="setLabel(item, change, ($event.target as HTMLInputElement).value)" />
            </Field>
            <Field label="ID" :path="`rows.${index}.id`" :hint="!item.saved && kind === 'frame_sizes' ? 'A number, like 2 or 0.5.' : 'Fixed once created.'">
              <input class="code" type="text" autocomplete="off" :value="item.id" :readonly="item.saved" @input="change({ id: ($event.target as HTMLInputElement).value, idTouched: true })" />
            </Field>
            <Field v-if="info.icons" label="Icon">
              <span class="pick">
                <select :value="text(item.data.icon)" @change="setData(item, change, { icon: ($event.target as HTMLSelectElement).value })">
                  <option value="">None</option>
                  <option v-if="text(item.data.icon) && !iconNames.includes(text(item.data.icon))" :value="item.data.icon">{{ item.data.icon }}</option>
                  <optgroup v-if="iconOptions.suggested.length" label="Suggested">
                    <option v-for="name in iconOptions.suggested" :key="name" :value="name">{{ iconLabel(name) }}</option>
                  </optgroup>
                  <optgroup label="All icons">
                    <option v-for="name in iconOptions.all" :key="name" :value="name">{{ iconLabel(name) }}</option>
                  </optgroup>
                </select>
                <span class="box" aria-hidden="true"><Icon v-if="text(item.data.icon)" :name="text(item.data.icon)" /></span>
              </span>
            </Field>
            <Field v-if="info.colours" label="Colour">
              <span class="pick">
                <select :value="text(item.data.colour)" @change="setData(item, change, { colour: ($event.target as HTMLSelectElement).value })">
                  <option value="">None</option>
                  <option v-if="text(item.data.colour) && !info.colours.some((c) => c.name === item.data.colour)" :value="item.data.colour">{{ item.data.colour }}</option>
                  <option v-for="c in info.colours" :key="c.name" :value="c.name">{{ c.label }}</option>
                </select>
                <span class="box" :class="{ none: !known(item.data.colour) }" :style="known(item.data.colour) ? { background: `var(${item.data.colour})` } : undefined" aria-hidden="true"></span>
              </span>
            </Field>
            <template v-if="info.mount">
              <Field block label="Slots" :path="`rows.${index}.slots`">
                <ol v-if="slotsOf(item).length" class="slots">
                  <li v-for="(slot, n) in slotsOf(item)" :key="n">
                    <div class="slot-head">
                      <span class="label">Slot {{ n + 1 }}</span>
                      <button type="button" class="icon-btn" :aria-label="`Remove slot ${n + 1}`" @click="setData(item, change, { slots: slotsOf(item).filter((_, i) => i !== n) })"><Icon name="close" /></button>
                    </div>
                    <ToggleChips :model-value="slot" :options="sizes" :label="`Slot ${n + 1} takes`" @update:model-value="setSlot(item, change, n, $event)" />
                    <FieldError :path="`rows.${index}.slots.${n}`" />
                  </li>
                </ol>
                <div><button type="button" class="small" @click="setData(item, change, { slots: [...slotsOf(item), []] })"><Icon name="plus" />Add slot</button></div>
              </Field>
              <Field label="Hint" hint="Shown on an empty mount.">
                <input type="text" autocomplete="off" :value="text(item.data.hint)" @input="setData(item, change, { hint: ($event.target as HTMLInputElement).value })" />
              </Field>
            </template>
            <div class="hide">
              <label class="check hide-check"><input type="checkbox" :checked="item.hidden" @change="change({ hidden: ($event.target as HTMLInputElement).checked })" />Hidden from players</label>
              <span class="hint">Not offered for new items. Items that use it keep it.</span>
            </div>
            <div v-if="item.saved" class="delete">
              <span v-if="dirty" class="blocked">
                <button type="button" class="danger small" disabled aria-describedby="delete-why">Delete {{ info.singular }}</button>
                <span id="delete-why" class="blocked-reason">Save your changes first</span>
              </span>
              <button v-else type="button" class="danger small" :disabled="busy" @click="remove(item)">Delete {{ info.singular }}</button>
              <p v-if="deleteErrors[item.id]" class="notice warn" role="alert">{{ deleteErrors[item.id] }}</p>
            </div>
          </div>
        </template>
      </RepeatList>
    </template>
  </article>
</template>

<style scoped>
.def-pane {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-m);
  min-width: 0;
  max-width: 48rem;
}

.problems {
  margin: 0;
  padding-left: 1.2em;
}

.hint {
  margin: 0;
  font-size: var(--fs-s);
}

.def-title {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
}

.swatch {
  flex: none;
  width: 14px;
  height: 14px;
  border: 1px solid var(--edge);
}

.def-icon {
  width: 18px;
  height: 18px;
  color: var(--text-dim);
}

/* A select with what it picks drawn beside it. */
.pick {
  display: flex;
  gap: var(--space-s);
}

.pick select {
  flex: 1;
  min-width: 0;
}

.box {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border: 1px solid var(--edge);
  color: var(--text);
  font-size: 1.4rem;
}

.box.none {
  border-style: dashed;
  background: var(--void);
}

.slots {
  display: grid;
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.slots li {
  display: grid;
  gap: var(--space-xs);
}

.slots li + li {
  padding-top: var(--space-s);
  border-top: 1px solid var(--rule);
}

.slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hide-check {
  min-height: 44px;
}

.hide {
  display: grid;
  gap: var(--space-xs);
}

.delete {
  display: grid;
  justify-items: start;
  gap: var(--space-s);
  padding-top: var(--space-m);
  border-top: 1px solid var(--rule);
}
</style>
