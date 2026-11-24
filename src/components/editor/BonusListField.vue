<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { BONUS_GROUPS, bonusDef, bonusSummary, type BonusDef, type BonusFilter } from '../../bonuses'
import { bonusCounted, type BonusType, type Data } from '../../contentEditor'
import { defIds, defList } from '../../definitions'
import { hiddenTags, tagNames } from '../../gameData'
import Icon from '../Icon.vue'
import Field from './Field.vue'
import FieldError from './FieldError.vue'
import TagListField from './TagListField.vue'
import ToggleChips from './ToggleChips.vue'
import { latest, useProblems, useRowKeys } from './useFields'

// An item's effects: a type (one declared in BONUS_REGISTRY, src/bonuses.ts, plus the personal stats), a
// value that fits the type, and under Options the weapons it aims at, a mount limit and whether it sets the base. Only what
// lasts out of combat and shows on the sheet is edited here (the rest is rules text). A row with other fields (a condition,
// weapon sizes, a damage type; nothing official or local uses them) keeps them; one whose type isn't in the list stays and shows its id.
const modelProp = defineModel<Data[]>({ required: true })
const model = latest(modelProp)
const props = withDefaults(defineProps<{ types: BonusType[]; path?: string }>(), { path: 'bonuses' })
const { invalid, at } = useProblems()
const { keyOf, removed } = useRowKeys()
const uid = useId()
const where = (index: number, key: string) => `${props.path}.${index}.${key}`

// Stats take a number or formula; the other types have their own value.
const effectOf = (bonus: Data): BonusDef | undefined => { const def = bonusDef(String(bonus.id)); return def && def.value !== 'formula' ? def : undefined }
const groups = computed(() => BONUS_GROUPS.map((group) => ({ group, types: props.types.filter((type) => type.group === group) })).filter((entry) => entry.types.length))
const offered = computed(() => new Set(groups.value.flatMap((entry) => entry.types.map((type) => type.id))))
// Typing in the search narrows the types every row offers (a row keeps its own).
const find = ref('')
const words = computed(() => find.value.toLowerCase().split(/\s+/).filter(Boolean))
const fits = (type: BonusType) => words.value.every((word) => `${type.label} ${type.group} ${type.id}`.toLowerCase().includes(word))
const groupsFor = (current: unknown) => groups.value.map((entry) => ({ group: entry.group, types: entry.types.filter((type) => type.id === current || fits(type)) })).filter((entry) => entry.types.length)
const matching = computed(() => groups.value.reduce((n, entry) => n + entry.types.filter(fits).length, 0))
const total = computed(() => offered.value.size)
const tags = computed(() => [...tagNames.value].filter(([id]) => !hiddenTags.value.has(id)).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))

const FILTER_LABELS = computed<Record<BonusFilter, { label: string; options: string[] }>>(() => ({
  weapon_types: { label: 'weapon types', options: defIds('weapon_types') },
  weapon_sizes: { label: 'weapon sizes', options: defIds('weapon_sizes') },
  range_types: { label: 'range types', options: defIds('range_types') },
  damage_types: { label: 'damage types', options: defIds('damage_types') },
}))
const filtersOf = (bonus: Data) => (effectOf(bonus)?.filters ?? []).filter((key) => key !== 'weapon_sizes')
const isStat = (bonus: Data) => !effectOf(bonus)

const change = (index: number, changes: Data) => (model.value = model.value.map((bonus, i) => (i === index ? { ...bonus, ...changes } : bonus)))
// A plain number stays a number; anything else (a formula) stays text.
const setValue = (index: number, text: string) => change(index, { val: /^-?\d+(\.\d+)?$/.test(text.trim()) ? Number(text) : text })
const startValue = (type?: BonusDef) => (!type || type.value === 'number' || type.value === 'whole' ? 1 : type.value === 'steps' ? ['', '', '', ''] : type.value === 'tags' ? [] : undefined)
// A new type starts from its own value and keeps only the options it allows; a condition stays.
function setType(index: number, id: string) {
  const old = model.value[index]
  const type = bonusDef(id)?.value === 'formula' ? undefined : bonusDef(id)
  const keep: Data = {}
  for (const key of type?.filters ?? []) if (old[key] !== undefined) keep[key] = old[key]
  if (type?.max && old.max !== undefined) keep.max = old.max
  if (type?.damageType && old.damage_type !== undefined) keep.damage_type = old.damage_type
  if (!type && old.replace) keep.replace = old.replace
  model.value = model.value.map((bonus, i) => (i === index ? { id, ...(startValue(type) === undefined ? {} : { val: startValue(type) }), ...keep, ...(old.condition !== undefined ? { condition: old.condition } : {}) } : bonus))
}
// Add starts from the first type the search leaves.
const add = () => (model.value = [...model.value, { id: groupsFor(undefined)[0]?.types[0]?.id ?? '', val: 1 }])

// Options: what's set in them. They start open when anything is set, and can't be folded over a problem.
const setCount = (bonus: Data) => {
  const effect = effectOf(bonus)
  const set = [...filtersOf(bonus).filter((key) => Array.isArray(bonus[key]) && (bonus[key] as unknown[]).length), ...(effect?.max && bonus.max ? ['max'] : []), ...(bonus.replace ? ['replace'] : [])]
  return set.length
}
const opened = ref(new Set(model.value.flatMap((bonus, index) => (setCount(bonus) ? [keyOf(index)] : []))))
const problem = (index: number) => at(`${props.path}.${index}`, true).some((entry) => entry.level === 'error' && !/\.(id|val)$/.test(entry.field ?? ''))
const isOpen = (index: number) => opened.value.has(keyOf(index)) || problem(index)
const toggle = (index: number) => {
  if (problem(index)) return
  const next = new Set(opened.value)
  if (!next.delete(keyOf(index))) next.add(keyOf(index))
  opened.value = next
}
const remove = (index: number) => {
  removed(index)
  model.value = model.value.filter((_, i) => i !== index)
}
const optionsId = (index: number) => `${uid}-opts-${index}`
const setList = (index: number, key: string, value: string[]) => change(index, { [key]: value.length ? value : undefined })
const setSteps = (index: number, step: number, value: string) => change(index, { val: Array.from({ length: 4 }, (_, i) => (i === step ? (/^\d+$/.test(value.trim()) ? Number(value) : value) : (model.value[index].val as unknown[] | undefined)?.[i] ?? '')) })
</script>

<template>
  <div class="rows-in">
    <ul v-if="model.length" class="rows">
      <li v-for="(bonus, index) in model" :key="keyOf(index)" class="entry">
        <div class="line">
          <select :value="bonus.id" :aria-label="`Effect ${index + 1} type`" :title="bonus.id ? bonusSummary(bonus) : undefined" :aria-invalid="invalid(where(index, 'id')) || undefined" @change="setType(index, ($event.target as HTMLSelectElement).value)">
            <option v-if="!offered.has(String(bonus.id))" :value="bonus.id">{{ bonus.id ? (bonusCounted(bonus) ? bonus.id : `${bonus.id} (not counted)`) : 'Choose…' }}</option>
            <optgroup v-for="group in groupsFor(bonus.id)" :key="group.group" :label="group.group">
              <option v-for="type in group.types" :key="type.id" :value="type.id">{{ type.label }}</option>
            </optgroup>
          </select>
          <select v-if="effectOf(bonus)?.value === 'mount'" :value="bonus.val ?? ''" class="value" :aria-label="`Effect ${index + 1} mount`" :aria-invalid="invalid(where(index, 'val')) || undefined" @change="change(index, { val: ($event.target as HTMLSelectElement).value })">
            <option value="" disabled>Choose…</option>
            <option v-for="mount in defList('mount_types')" :key="mount.id" :value="mount.id">{{ mount.label }}</option>
          </select>
          <span v-else-if="effectOf(bonus) && ['none', 'tags', 'steps'].includes(effectOf(bonus)!.value)" class="value-gap"></span>
          <input v-else type="text" class="value" :value="bonus.val" :aria-label="`Effect ${index + 1} amount`" :placeholder="isStat(bonus) ? '2 or {systems}/2' : '2'" :aria-invalid="invalid(where(index, 'val')) || undefined" @input="setValue(index, ($event.target as HTMLInputElement).value)" />
          <button type="button" class="small quiet opts" :aria-expanded="isOpen(index)" :aria-controls="optionsId(index)" @click="toggle(index)">
            Options{{ setCount(bonus) ? ` (${setCount(bonus)})` : '' }}<Icon name="chevron-down" class="chev" />
          </button>
          <button type="button" class="icon-btn remove" :aria-label="`Remove effect ${index + 1}`" @click="remove(index)"><Icon name="close" /></button>
        </div>
        <p v-if="bonus.id" class="hint summary wide">{{ bonusSummary(bonus) }}</p>
        <TagListField v-if="effectOf(bonus)?.value === 'tags'" class="wide" :model-value="Array.isArray(bonus.val) ? bonus.val : []" :tags="tags" :label="`Effect ${index + 1} tags`" :path="where(index, 'val')" @update:model-value="change(index, { val: $event })" />
        <div v-if="effectOf(bonus)?.value === 'steps'" class="steps wide" role="group" :aria-label="`Effect ${index + 1} overcharge steps`">
          <input v-for="(example, step) in ['1', '1d3', '1d6', '1d6+4']" :key="step" type="text" class="value" :value="(Array.isArray(bonus.val) ? bonus.val[step] : '') ?? ''" :aria-label="`Overcharge step ${step + 1}`" :placeholder="example" :aria-invalid="invalid(where(index, 'val')) || undefined" @input="setSteps(index, step, ($event.target as HTMLInputElement).value)" />
        </div>
        <div v-if="isOpen(index)" :id="optionsId(index)" class="opts-body wide">
          <p v-if="filtersOf(bonus).length" class="hint">Leave a list off to apply to all.</p>
          <Field v-for="key in filtersOf(bonus)" :key="key" block :label="`Only these ${FILTER_LABELS[key].label}`" :path="where(index, key)">
            <ToggleChips :model-value="(bonus[key] as string[] | undefined) ?? []" :options="FILTER_LABELS[key].options" :label="`Effect ${index + 1} ${FILTER_LABELS[key].label}`" @update:model-value="setList(index, key, $event)" />
          </Field>
          <Field v-if="effectOf(bonus)?.max" label="Only if fewer mounts than" :path="where(index, 'max')">
            <input type="number" min="1" step="1" class="narrow" :value="bonus.max" @input="change(index, { max: ($event.target as HTMLInputElement).value === '' ? undefined : Number(($event.target as HTMLInputElement).value) })" />
          </Field>
          <label v-if="isStat(bonus)" class="check"><input type="checkbox" :checked="bonus.replace === true" @change="change(index, { replace: ($event.target as HTMLInputElement).checked || undefined })" />Sets the base</label>
        </div>
        <FieldError :path="`${path}.${index}`" deep />
      </li>
    </ul>
    <div class="add-row">
      <input v-if="model.length || find" v-model="find" type="search" class="find" aria-label="Search effect types" placeholder="Search effect types" autocomplete="off" />
      <span v-if="find" class="dim count" role="status">{{ matching }} of {{ total }}</span>
      <button type="button" class="small" @click="add"><Icon name="plus" />Add effect</button>
    </div>
  </div>
</template>

<style scoped>
.rows-in { display: grid; gap: var(--space-s); }
.rows { display: grid; gap: var(--space-m); margin: 0; padding: 0; list-style: none; }
.entry { display: grid; gap: var(--space-s); }
.line { display: grid; grid-template-columns: minmax(0, 17rem) minmax(0, 9rem) auto auto; gap: var(--space-s); align-items: center; }
.value { font-family: var(--mono); }
.check { display: inline-flex; align-items: center; gap: 6px; color: var(--text-dim); font-size: var(--fs-s); }
.opts { justify-self: start; min-height: var(--tap); }
.summary { margin: 0; }
.add-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-s); }
.find { flex: 1 1 12rem; min-width: 0; min-height: var(--tap); }
.opts .chev { width: 14px; height: 14px; margin-left: 4px; transition: transform 0.15s; }
.opts[aria-expanded='true'] .chev { transform: rotate(180deg); }
.steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-s); }
.opts-body { display: grid; gap: var(--space-m); margin-left: var(--space-s); padding: var(--space-s) 0 var(--space-s) var(--space-m); border-left: 1px solid var(--rule); }
.opts-body .hint { margin: 0; }
.narrow { width: 6rem; }
@media (max-width: 40rem) {
  .line { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; }
  .line > :first-child { grid-column: 1 / 3; grid-row: 1; }
  .line .icon-btn { grid-column: 3; grid-row: 1; }
  .line .value, .line .value-gap { grid-column: 1; grid-row: 2; }
  .line .opts { grid-column: 2 / 4; grid-row: 2; }
  .steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) { .opts .chev { transition: none; } }
</style>
