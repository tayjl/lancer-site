<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'
import Icon from '../Icon.vue'
import { latest, useProblems, useRowKeys } from './useFields'

// A list of whole numbers, one per box, in order (how much heat each Overcharge use adds). An empty box is kept as ""
// so the editor's checks can flag it.
const modelProp = defineModel<(number | '')[]>({ required: true })
const model = latest(modelProp)
const props = defineProps<{ label: string; max?: number }>()
const { invalid } = useProblems()
// Only the bad boxes are flagged, and only once the field has an error.
const bad = (n: number | '') => invalid('numbers') && (n === '' || !Number.isInteger(n) || n < 0 || (props.max !== undefined && n > props.max))
const { keyOf, removed } = useRowKeys()
const boxes = useTemplateRef<HTMLElement>('boxes')

const set = (i: number, event: Event) => {
  const value = (event.target as HTMLInputElement).value
  model.value = model.value.map((n, at) => (at === i ? (value === '' ? '' : Number(value)) : n))
}
const remove = (i: number) => { removed(i); model.value = model.value.filter((_, at) => at !== i) }
async function add() {
  model.value = [...model.value, '']
  await nextTick()
  boxes.value?.querySelector<HTMLInputElement>('li:last-child input')?.focus()
}
</script>

<template>
  <div class="nums">
    <ol ref="boxes" class="boxes" :aria-label="label">
      <li v-for="(n, i) in model" :key="keyOf(i)" class="box" :data-invalid="bad(n) || undefined">
        <span class="pos num dim" aria-hidden="true">{{ i + 1 }}</span>
        <input type="number" min="0" step="1" inputmode="numeric" :value="n" :aria-label="`Number ${i + 1}`" :aria-invalid="bad(n) || undefined" @input="set(i, $event)" />
        <button type="button" class="icon-btn remove" :aria-label="`Remove number ${i + 1}`" @click="remove(i)"><Icon name="close" /></button>
      </li>
    </ol>
    <div><button type="button" class="small" @click="add"><Icon name="plus" />Add number</button></div>
  </div>
</template>

<style scoped>
.nums { display: grid; gap: var(--space-s); justify-items: start; }
.boxes { display: flex; flex-wrap: wrap; gap: var(--space-s); margin: 0; padding: 0; list-style: none; }
.box {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 2px 2px var(--space-s);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--raised);
}
.box[data-invalid] { border-color: var(--danger); }
.box input { width: 5rem; font-family: var(--mono); text-align: center; }
.pos { min-width: 1ch; font-size: var(--fs-xs); }
</style>
