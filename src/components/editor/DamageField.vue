<script setup lang="ts">
import { DAMAGE_TYPES, RANGE_TYPES } from '../../contentEditor'
import { flatDamage } from '../../damage'
import Icon from '../Icon.vue'
import FieldError from './FieldError.vue'
import { latest, useProblems } from './useFields'

// A weapon's range or damage: a type and a number. Damage may be written as dice (1d6+2, the way LANCER's data has
// it); the flat number players see is shown beside it, since this homebrew has no dice ("Players see 6 flat").
type Entry = { type: string; val: string | number }
const modelProp = defineModel<Entry[]>({ required: true })
const model = latest(modelProp)
// "path" is where the list sits in the item ("range", "profiles.0.damage"), so problems land on the right input.
const props = defineProps<{ kind: 'damage' | 'range'; path?: string; noun?: string }>()
const { invalid } = useProblems()
const where = (index: number, key: string) => `${props.path ?? props.kind}.${index}.${key}`

const types = props.kind === 'damage' ? DAMAGE_TYPES : RANGE_TYPES
const noun = props.noun ?? (props.kind === 'damage' ? 'Damage' : 'Range')
const change = (index: number, changes: Partial<Entry>) => (model.value = model.value.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)))
const setValue = (index: number, text: string) => change(index, { val: /^\d+$/.test(text.trim()) ? Number(text) : text })
const flat = (val: string | number) => {
  const result = flatDamage(val)
  return typeof result === 'number' ? result : null
}
const add = () => (model.value = [...model.value, { type: types[0], val: props.kind === 'damage' ? '1d6' : 5 }])
</script>

<template>
  <div class="rows-in">
    <ul v-if="model.length" class="rows">
      <li v-for="(entry, index) in model" :key="index" class="entry" :class="{ plain: kind === 'range' }">
        <select :value="entry.type" :aria-label="`${noun} ${index + 1} type`" :aria-invalid="invalid(where(index, 'type')) || undefined" @change="change(index, { type: ($event.target as HTMLSelectElement).value })">
          <option v-if="!types.includes(entry.type)" :value="entry.type">{{ entry.type || 'Choose…' }}</option>
          <option v-for="type in types" :key="type" :value="type">{{ type }}</option>
        </select>
        <input type="text" class="value" :value="entry.val" :aria-label="`${noun} ${index + 1} amount`" :aria-invalid="invalid(where(index, 'val')) || undefined" @input="setValue(index, ($event.target as HTMLInputElement).value)" />
        <span v-if="kind === 'damage'" class="flat dim">
          <template v-if="flat(entry.val) !== null">Players see <span class="num">{{ flat(entry.val) }}</span> flat</template>
          <template v-else>Needs a number or dice</template>
        </span>
        <button type="button" class="icon-btn remove" :aria-label="`Remove ${noun.toLowerCase()} ${index + 1}`" @click="model = model.filter((_, i) => i !== index)"><Icon name="close" /></button>
        <FieldError :path="`${path ?? kind}.${index}`" deep />
      </li>
    </ul>
    <p v-else class="hint dim">No {{ kind === 'range' ? 'ranges' : 'damage' }} yet.</p>
    <div><button type="button" class="small" @click="add"><Icon name="plus" />Add {{ kind }}</button></div>
  </div>
</template>

<style scoped>
.rows-in { display: grid; gap: var(--space-s); }
.rows { display: grid; gap: var(--space-s); margin: 0; padding: 0; list-style: none; }
.hint { margin: 0; font-size: var(--fs-s); }
.entry { display: grid; grid-template-columns: minmax(0, 10rem) minmax(0, 8rem) 1fr auto; gap: var(--space-s); align-items: center; }
.entry.plain { grid-template-columns: minmax(0, 10rem) minmax(0, 8rem) auto; }
.value { font-family: var(--mono); }
.flat { font-size: var(--fs-s); }
.flat .num { color: var(--text); font-weight: 700; }
@media (max-width: 40rem) {
  .entry, .entry.plain { grid-template-columns: minmax(0, 1fr) 7rem auto; }
  .entry .flat { grid-column: 1 / -1; grid-row: 2; }
}
</style>
