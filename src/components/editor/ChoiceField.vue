<script setup lang="ts" generic="V extends string | number">
import { useId } from 'vue'
import { latest } from './useFields'

// One choice out of a few short ones (licence rank, mount size), as a row of buttons that are real radio inputs, so
// arrow keys, labels and screen readers work as for any radio group. Wrap it in a Field (block) for the label.
const modelProp = defineModel<V>({ required: true })
const model = latest(modelProp)
defineProps<{ options: { value: V; label: string }[]; label: string }>()
const name = useId()
</script>

<template>
  <div class="kinds" role="radiogroup" :aria-label="label">
    <label v-for="option in options" :key="option.value" class="kind-opt" :class="{ on: model === option.value }">
      <input v-model="model" type="radio" :name="name" :value="option.value" />{{ option.label }}
    </label>
  </div>
</template>

<style scoped>
.kinds { display: flex; flex-wrap: wrap; align-content: flex-start; gap: var(--space-s); }
.kind-opt {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
  padding: 0 14px;
  border: 1px solid var(--edge);
  border-radius: var(--radius);
  color: var(--text);
  font: 700 13px / 1 var(--sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.kind-opt input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.kind-opt:hover { border-color: var(--lilac); }
.kind-opt.on { border-color: var(--lilac); background: color-mix(in srgb, var(--lilac) 14%, transparent); color: var(--lilac); }
.kind-opt:has(input:focus-visible) { outline: 2px solid var(--lilac); outline-offset: 2px; }
.kinds[aria-invalid='true'] .kind-opt { border-color: var(--danger); }
</style>
