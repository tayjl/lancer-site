<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { CONDITION_MAX, DAMAGE_TYPES, EFFECT_BONUS_TYPES, FRAME_MOUNTS, RANGE_TYPES, WEAPON_MOUNTS, WEAPON_TYPES, bonusCounted, type BonusFilter, type BonusType, type Data, type EffectBonusType } from '../../contentEditor'
import { hiddenTags, tagNames } from '../../gameData'
import Icon from '../Icon.vue'
import Field from './Field.vue'
import FieldError from './FieldError.vue'
import TagListField from './TagListField.vue'
import ToggleChips from './ToggleChips.vue'
import { latest, useProblems } from './useFields'

// An item's effects: a type (a stat the build maths counts, see BONUS_TYPES, or one of the effects in EFFECT_BONUS_TYPES), a
// value that fits the type, and under Options the weapons it aims at, a mount limit, when it applies and whether it sets the
// base. A row with other fields keeps them; one whose type isn't in the list stays and shows its id.
const modelProp = defineModel<Data[]>({ required: true })
const model = latest(modelProp)
const props = withDefaults(defineProps<{ types: BonusType[]; path?: string }>(), { path: 'bonuses' })
const { invalid, at } = useProblems()
const uid = useId()
const where = (index: number, key: string) => `${props.path}.${index}.${key}`

const effects = new Map(EFFECT_BONUS_TYPES.map((type) => [type.id, type]))
const effectOf = (bonus: Data): EffectBonusType | undefined => effects.get(String(bonus.id))
const STAT_GROUPS: Record<BonusType['group'], string> = { Mech: 'Mech stats', Pilot: 'Pilot stats', 'Personal stat': 'Personal stats' }
const EFFECT_GROUPS: [string, string[]][] = [
  ['Mounts', ['add_mount', 'replace_mount', 'superheavy_mounting']],
  ['Weapons', ['range', 'threat', 'damage', 'add_tags']],
  ['Resources', ['cheap_struct', 'overcharge']],
  ['Drones & deployables', EFFECT_BONUS_TYPES.filter((type) => /^(drone|deployable)_/.test(type.id)).map((type) => type.id)],
]
const groups = computed(() => [
  ...(Object.keys(STAT_GROUPS) as BonusType['group'][]).map((group) => ({ group: STAT_GROUPS[group], types: props.types.filter((type) => type.group === group) })),
  ...EFFECT_GROUPS.map(([group, ids]) => ({ group, types: ids.map((id) => effects.get(id)!) })),
].filter((entry) => entry.types.length))
const offered = computed(() => new Set(groups.value.flatMap((entry) => entry.types.map((type) => type.id))))
const tags = computed(() => [...tagNames.value].filter(([id]) => !hiddenTags.value.has(id)).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))

const FILTER_LABELS: Record<BonusFilter, { label: string; options: string[] }> = {
  weapon_types: { label: 'weapon types', options: WEAPON_TYPES },
  weapon_sizes: { label: 'weapon sizes', options: WEAPON_MOUNTS },
  range_types: { label: 'range types', options: RANGE_TYPES },
  damage_types: { label: 'damage types', options: DAMAGE_TYPES },
}
const filtersOf = (bonus: Data) => effectOf(bonus)?.filters ?? []
const isStat = (bonus: Data) => !effectOf(bonus)

const change = (index: number, changes: Data) => (model.value = model.value.map((bonus, i) => (i === index ? { ...bonus, ...changes } : bonus)))
// A plain number stays a number; anything else (a formula) stays text.
const setValue = (index: number, text: string) => change(index, { val: /^-?\d+(\.\d+)?$/.test(text.trim()) ? Number(text) : text })
const startValue = (type?: EffectBonusType) => (!type || type.value === 'number' || type.value === 'whole' ? 1 : type.value === 'steps' ? ['', '', '', ''] : type.value === 'tags' ? [] : undefined)
// A new type starts from its own value and keeps only the options it allows; the condition always stays.
function setType(index: number, id: string) {
  const old = model.value[index]
  const type = effects.get(id)
  const keep: Data = {}
  for (const key of type?.filters ?? []) if (old[key] !== undefined) keep[key] = old[key]
  if (type?.max && old.max !== undefined) keep.max = old.max
  if (type?.damageType && old.damage_type !== undefined) keep.damage_type = old.damage_type
  if (!type && old.replace) keep.replace = old.replace
  model.value = model.value.map((bonus, i) => (i === index ? { id, ...(startValue(type) === undefined ? {} : { val: startValue(type) }), ...keep, ...(old.condition !== undefined ? { condition: old.condition } : {}) } : bonus))
}
const add = () => (model.value = [...model.value, { id: groups.value[0]?.types[0]?.id ?? '', val: 1 }])

// Options: what's set in them. They start open when anything is set, and can't be folded over a problem.
const setCount = (bonus: Data) => {
  const effect = effectOf(bonus)
  const set = [...filtersOf(bonus).filter((key) => Array.isArray(bonus[key]) && (bonus[key] as unknown[]).length), ...(effect?.max && bonus.max ? ['max'] : []), ...(effect?.damageType && bonus.damage_type ? ['damage_type'] : []), ...(bonus.condition ? ['condition'] : []), ...(bonus.replace ? ['replace'] : [])]
  return set.length
}
const opened = ref(new Set(model.value.flatMap((bonus, index) => (setCount(bonus) ? [index] : []))))
const problem = (index: number) => at(`${props.path}.${index}`, true).some((entry) => entry.level === 'error' && !/\.(id|val)$/.test(entry.field ?? ''))
const isOpen = (index: number) => opened.value.has(index) || problem(index)
const toggle = (index: number) => {
  if (problem(index)) return
  const next = new Set(opened.value)
  if (!next.delete(index)) next.add(index)
  opened.value = next
}
// shortcut: a removed row leaves the open states as they are by position, fine for a short list.
const optionsId = (index: number) => `${uid}-opts-${index}`
const setList = (index: number, key: string, value: string[]) => change(index, { [key]: value.length ? value : undefined })
const text = (index: number, key: string, value: string) => change(index, { [key]: value === '' ? undefined : value })
const setSteps = (index: number, step: number, value: string) => change(index, { val: Array.from({ length: 4 }, (_, i) => (i === step ? (/^\d+$/.test(value.trim()) ? Number(value) : value) : (model.value[index].val as unknown[] | undefined)?.[i] ?? '')) })
</script>

<template>
  <div class="rows-in">
    <ul v-if="model.length" class="rows">
      <li v-for="(bonus, index) in model" :key="index" class="entry">
        <div class="line">
          <select :value="bonus.id" :aria-label="`Effect ${index + 1} type`" :aria-invalid="invalid(where(index, 'id')) || undefined" @change="setType(index, ($event.target as HTMLSelectElement).value)">
            <option v-if="!offered.has(String(bonus.id))" :value="bonus.id">{{ bonus.id ? (bonusCounted(bonus) ? bonus.id : `${bonus.id} (not counted)`) : 'Choose…' }}</option>
            <optgroup v-for="group in groups" :key="group.group" :label="group.group">
              <option v-for="type in group.types" :key="type.id" :value="type.id">{{ type.label }}</option>
            </optgroup>
          </select>
          <select v-if="effectOf(bonus)?.value === 'mount'" :value="bonus.val ?? ''" class="value" :aria-label="`Effect ${index + 1} mount`" :aria-invalid="invalid(where(index, 'val')) || undefined" @change="change(index, { val: ($event.target as HTMLSelectElement).value })">
            <option value="" disabled>Choose…</option>
            <option v-for="mount in FRAME_MOUNTS" :key="mount" :value="mount">{{ mount }}</option>
          </select>
          <span v-else-if="effectOf(bonus) && ['none', 'tags', 'steps'].includes(effectOf(bonus)!.value)" class="value-gap"></span>
          <input v-else type="text" class="value" :value="bonus.val" :aria-label="`Effect ${index + 1} amount`" :placeholder="isStat(bonus) ? '2 or {systems}/2' : '2'" :aria-invalid="invalid(where(index, 'val')) || undefined" @input="setValue(index, ($event.target as HTMLInputElement).value)" />
          <button type="button" class="small quiet opts" :aria-expanded="isOpen(index)" :aria-controls="optionsId(index)" @click="toggle(index)">
            Options{{ setCount(bonus) ? ` (${setCount(bonus)})` : '' }}<Icon name="chevron-down" class="chev" />
          </button>
          <button type="button" class="icon-btn remove" :aria-label="`Remove effect ${index + 1}`" @click="model = model.filter((_, i) => i !== index)"><Icon name="close" /></button>
        </div>
        <TagListField v-if="effectOf(bonus)?.value === 'tags'" class="wide" :model-value="Array.isArray(bonus.val) ? bonus.val : []" :tags="tags" :label="`Effect ${index + 1} tags`" :path="where(index, 'val')" @update:model-value="change(index, { val: $event })" />
        <div v-if="effectOf(bonus)?.value === 'steps'" class="steps wide" role="group" :aria-label="`Effect ${index + 1} overcharge steps`">
          <input v-for="(example, step) in ['1', '1d3', '1d6', '1d6+4']" :key="step" type="text" class="value" :value="(Array.isArray(bonus.val) ? bonus.val[step] : '') ?? ''" :aria-label="`Overcharge step ${step + 1}`" :placeholder="example" :aria-invalid="invalid(where(index, 'val')) || undefined" @input="setSteps(index, step, ($event.target as HTMLInputElement).value)" />
        </div>
        <div v-if="isOpen(index)" :id="optionsId(index)" class="opts-body wide">
          <p v-if="filtersOf(bonus).length" class="hint">Leave a list off to apply to all.</p>
          <Field v-for="key in filtersOf(bonus)" :key="key" block :label="`Only these ${FILTER_LABELS[key].label}`" :path="where(index, key)">
            <ToggleChips :model-value="(bonus[key] as string[] | undefined) ?? []" :options="FILTER_LABELS[key].options" :label="`Effect ${index + 1} ${FILTER_LABELS[key].label}`" @update:model-value="setList(index, key, $event)" />
          </Field>
          <Field v-if="effectOf(bonus)?.damageType" label="Damage type" :path="where(index, 'damage_type')">
            <select :value="bonus.damage_type ?? ''" @change="text(index, 'damage_type', ($event.target as HTMLSelectElement).value)">
              <option value="">Same as the weapon</option>
              <option v-for="type in DAMAGE_TYPES" :key="type" :value="type">{{ type }}</option>
            </select>
          </Field>
          <Field v-if="effectOf(bonus)?.max" label="Only if fewer mounts than" :path="where(index, 'max')">
            <input type="number" min="1" step="1" class="narrow" :value="bonus.max" @input="change(index, { max: ($event.target as HTMLInputElement).value === '' ? undefined : Number(($event.target as HTMLInputElement).value) })" />
          </Field>
          <Field label="Only when" :path="where(index, 'condition')">
            <input type="text" :maxlength="CONDITION_MAX" :value="bonus.condition ?? ''" @input="text(index, 'condition', ($event.target as HTMLInputElement).value)" />
          </Field>
          <label v-if="isStat(bonus)" class="check"><input type="checkbox" :checked="bonus.replace === true" @change="change(index, { replace: ($event.target as HTMLInputElement).checked || undefined })" />Sets the base</label>
        </div>
        <FieldError :path="`${path}.${index}`" deep />
      </li>
    </ul>
    <div><button type="button" class="small" @click="add"><Icon name="plus" />Add effect</button></div>
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
