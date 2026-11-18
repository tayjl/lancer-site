<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../Icon.vue'
import FieldError from './FieldError.vue'
import { latest, useProblems } from './useFields'

// A list of tags with their values ("Limited 3"): chips, each with a number box when its tag takes one ({VAL} in its
// name), and a picker to add more. A tag the list doesn't know (its pack isn't loaded) stays, by its id.
type TagEntry = { id: string; val?: string | number }
const modelProp = defineModel<TagEntry[]>({ required: true })
const model = latest(modelProp)
const props = withDefaults(defineProps<{ tags: { id: string; name: string }[]; label?: string; path?: string }>(), { path: 'tags' })
const { invalid } = useProblems()

const nameOf = (id: string) => props.tags.find((tag) => tag.id === id)?.name ?? id
const shown = (id: string) => nameOf(id).replace('{VAL}', '').trim()
const takesValue = (id: string) => nameOf(id).includes('{VAL}')
const available = computed(() => props.tags.filter((tag) => !model.value.some((entry) => entry.id === tag.id)))

const add = (event: Event) => {
  const select = event.target as HTMLSelectElement
  if (select.value) model.value = [...model.value, { id: select.value, ...(takesValue(select.value) ? { val: 1 } : {}) }]
  select.value = ''
}
const setValue = (index: number, text: string) =>
  (model.value = model.value.map((entry, i) => (i === index ? { ...entry, val: text.trim() === '' ? '' : Number(text) } : entry)))
</script>

<template>
  <div class="tags">
    <ul v-if="model.length" class="chips" :aria-label="label ?? 'Tags'">
      <li v-for="(entry, index) in model" :key="entry.id" class="chip-x">
        {{ shown(entry.id) }}
        <input
          v-if="takesValue(entry.id)"
          type="number"
          :value="entry.val"
          :aria-label="`${shown(entry.id)} value`"
          :aria-invalid="invalid(`${path}.${index}.val`) || undefined"
          @input="setValue(index, ($event.target as HTMLInputElement).value)"
        />
        <button type="button" class="icon-btn remove" :aria-label="`Remove ${shown(entry.id)}`" @click="model = model.filter((_, i) => i !== index)"><Icon name="close" /></button>
      </li>
    </ul>
    <select class="add" aria-label="Add a tag" @change="add">
      <option value="">Add a tag…</option>
      <option v-for="tag in available" :key="tag.id" :value="tag.id">{{ tag.name.replace('{VAL}', '').trim() }}</option>
    </select>
    <FieldError v-for="(entry, index) in model" :key="entry.id" :path="`${path}.${index}`" deep />
  </div>
</template>

<style scoped>
.tags {
  display: grid;
  justify-items: start;
  gap: var(--space-s);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip-x {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 2px 0 10px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: var(--raised);
  font: 700 var(--fs-xs) / 1 var(--sans);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.chip-x input {
  width: 4rem;
  min-height: 24px;
  height: 24px;
  padding: 0 6px;
  text-align: center;
  font-size: var(--fs-s);
  font-weight: 700;
}

.chip-x input[aria-invalid='true'] {
  border-color: var(--danger);
}

.add {
  max-width: 100%;
}
</style>
