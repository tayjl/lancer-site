<script setup lang="ts">
import { HEX } from '../../contentEditor'
import { latest } from './useFields'

// A plain hex colour (#1c9ae8): the text, which is what's stored, and a colour picker beside it. The site only draws
// manufacturer colours that are plain hex (makerColour in src/archive.ts). Wrap it in a Field for the label.
const modelProp = defineModel<string>({ required: true })
const model = latest(modelProp)
defineProps<{ label: string }>()
</script>

<template>
  <span class="colour">
    <input v-model="model" class="code" type="text" spellcheck="false" autocomplete="off" placeholder="#1c9ae8" />
    <input type="color" :value="HEX.test(model) ? model : '#000000'" :aria-label="`${label}: pick a colour`" @input="model = ($event.target as HTMLInputElement).value" />
  </span>
</template>

<style scoped>
.colour { display: flex; align-items: center; gap: var(--space-s); }
.colour input[type='text'] { flex: 1; min-width: 0; }
.colour input[type='color'] { flex: none; width: var(--tap); min-height: var(--tap); height: var(--tap); padding: 2px; cursor: pointer; }
</style>
