<script setup lang="ts">
import { computed } from 'vue'
import type { BonusType, Data } from '../../contentEditor'
import Icon from '../Icon.vue'
import FieldError from './FieldError.vue'
import { latest, useProblems } from './useFields'

// An item's bonuses: a type (only the ones the site's build maths counts, see BONUS_TYPES), a number or a formula
// ("{systems}/2"), and whether it sets the base instead of adding. A bonus with other fields (aimed at one weapon type,
// say) keeps them; one whose type isn't in the list stays and shows its id.
const modelProp = defineModel<Data[]>({ required: true })
const model = latest(modelProp)
const props = withDefaults(defineProps<{ types: BonusType[]; path?: string }>(), { path: 'bonuses' })
const { invalid } = useProblems()
const where = (index: number, key: string) => `${props.path}.${index}.${key}`

const groups = computed(() => [...new Set(props.types.map((type) => type.group))].map((group) => ({ group, types: props.types.filter((type) => type.group === group) })))
const known = (id: unknown) => props.types.some((type) => type.id === id)
const change = (index: number, changes: Data) => (model.value = model.value.map((bonus, i) => (i === index ? { ...bonus, ...changes } : bonus)))
// A plain number stays a number; anything else (a formula) stays text.
const setValue = (index: number, text: string) => change(index, { val: /^-?\d+(\.\d+)?$/.test(text.trim()) ? Number(text) : text })
const add = () => (model.value = [...model.value, { id: props.types[0]?.id ?? '', val: 1 }])
</script>

<template>
  <div class="rows-in">
    <ul v-if="model.length" class="rows">
      <li v-for="(bonus, index) in model" :key="index" class="entry">
        <select :value="bonus.id" :aria-label="`Bonus ${index + 1} type`" :aria-invalid="invalid(where(index, 'id')) || undefined" @change="change(index, { id: ($event.target as HTMLSelectElement).value })">
          <option v-if="!known(bonus.id)" :value="bonus.id">{{ bonus.id || 'Choose…' }} (not counted)</option>
          <optgroup v-for="group in groups" :key="group.group" :label="group.group">
            <option v-for="type in group.types" :key="type.id" :value="type.id">{{ type.label }}</option>
          </optgroup>
        </select>
        <input type="text" class="value" :value="bonus.val" :aria-label="`Bonus ${index + 1} amount`" placeholder="2 or {systems}/2" :aria-invalid="invalid(where(index, 'val')) || undefined" @input="setValue(index, ($event.target as HTMLInputElement).value)" />
        <label class="check"><input type="checkbox" :checked="bonus.replace === true" @change="change(index, { replace: ($event.target as HTMLInputElement).checked || undefined })" />Sets the base</label>
        <button type="button" class="icon-btn remove" :aria-label="`Remove bonus ${index + 1}`" @click="model = model.filter((_, i) => i !== index)"><Icon name="close" /></button>
        <FieldError :path="`${path}.${index}`" deep />
      </li>
    </ul>
    <p v-else class="hint dim">No bonuses yet.</p>
    <div><button type="button" class="small" @click="add"><Icon name="plus" />Add bonus</button></div>
  </div>
</template>

<style scoped>
.rows-in { display: grid; gap: var(--space-s); }
.rows { display: grid; gap: var(--space-s); margin: 0; padding: 0; list-style: none; }
.hint { margin: 0; font-size: var(--fs-s); }
.entry { display: grid; grid-template-columns: minmax(0, 14rem) minmax(0, 9rem) auto auto; gap: var(--space-s); align-items: center; }
.value { font-family: var(--mono); }
.check { display: inline-flex; align-items: center; gap: 6px; color: var(--text-dim); font-size: var(--fs-s); white-space: nowrap; }
@media (max-width: 40rem) {
  .entry { grid-template-columns: minmax(0, 1fr) 7rem auto; }
  .entry .check { grid-column: 1 / 3; grid-row: 2; }
  .entry .icon-btn { grid-row: 1; grid-column: 3; }
}
</style>
