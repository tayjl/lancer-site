<script setup lang="ts">
import Icon from '../Icon.vue'
import { latest } from './useFields'

// Several of a short list (the weapon types a mod fits), as neutral chips that are pressed or not, with a tick on the
// pressed ones so colour is never the only signal. Like the archives' manufacturer filter. A value in the data that the
// list doesn't offer stays pressed, and can be switched off.
const modelProp = defineModel<string[]>({ required: true })
const model = latest(modelProp)
const props = defineProps<{ options: string[]; label: string }>()

const all = () => [...props.options, ...model.value.filter((value) => !props.options.includes(value))]
const toggle = (value: string) => (model.value = model.value.includes(value) ? model.value.filter((v) => v !== value) : [...model.value, value])
</script>

<template>
  <div class="chips-row" role="group" :aria-label="label">
    <button v-for="option in all()" :key="option" type="button" class="toggle" :aria-pressed="model.includes(option)" @click="toggle(option)">
      <Icon v-if="model.includes(option)" name="check" />{{ option }}
    </button>
  </div>
</template>

<style scoped>
.chips-row { display: flex; flex-wrap: wrap; gap: var(--space-s); }
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: var(--raised);
  color: var(--text-dim);
  font: 700 var(--fs-xs) / 1 var(--sans);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.toggle:hover:not(:disabled) { border-color: var(--edge); color: var(--text); }
.toggle[aria-pressed='true'] { border-color: var(--text); color: var(--text); }
.toggle .icon { width: 14px; height: 14px; }
@media (max-width: 40rem), (pointer: coarse) { .toggle { min-height: 44px; } }
</style>
