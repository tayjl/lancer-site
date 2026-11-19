<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import Icon from '../Icon.vue'
import ItemPicker from '../ItemPicker.vue'
import { latest } from './useFields'

// A list of existing items kept by id (what a talent rank grants): a chip for each, with Remove, and a picker to add
// more. An id whose item isn't loaded stays, by its id (the editor's checks flag it).
const modelProp = defineModel<string[]>({ required: true })
const model = latest(modelProp)
const props = defineProps<{ items: { id: string; name: string; meta: string }[]; label: string; add: string }>()

const picker = useTemplateRef('picker')
const nameOf = (id: string) => props.items.find((item) => item.id === id)?.name ?? id
const options = computed(() => props.items.filter((item) => !model.value.includes(item.id)))
const choose = (id: string) => {
  model.value = [...model.value, id]
  picker.value?.close()
}
</script>

<template>
  <div class="ids">
    <ul v-if="model.length" class="chips" :aria-label="label">
      <li v-for="id in model" :key="id" class="chip-x">
        {{ nameOf(id) }}
        <button type="button" class="icon-btn remove" :aria-label="`Remove ${nameOf(id)}`" @click="model = model.filter((other) => other !== id)"><Icon name="close" /></button>
      </li>
    </ul>
    <div><button type="button" class="small" @click="picker?.open()"><Icon name="plus" />{{ add }}</button></div>
    <ItemPicker ref="picker" :title="add" :options="options" empty="No weapons or systems." @choose="choose" />
  </div>
</template>

<style scoped>
.ids { display: grid; gap: var(--space-s); justify-items: start; }
.chips { display: flex; flex-wrap: wrap; gap: var(--space-s); margin: 0; padding: 0; list-style: none; }
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
</style>
