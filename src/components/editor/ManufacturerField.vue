<script setup lang="ts">
import Field from './Field.vue'

// The manufacturer select every kind with a manufacturer shares. A manufacturer no longer in the list stays choosable.
// `optional` swaps the required "Choose…" for "None" (biomods).
defineProps<{ manufacturers: { id: string; name: string }[]; optional?: boolean; hint?: string }>()
const source = defineModel<string>({ required: true })
</script>

<template>
  <Field class="span2" label="Manufacturer" path="source" :hint="hint">
    <select v-model="source">
      <option v-if="optional" value="">None</option>
      <option v-else value="" disabled>Choose…</option>
      <option v-if="source && !manufacturers.some((maker) => maker.id === source)" :value="source">{{ source }}</option>
      <option v-for="maker in manufacturers" :key="maker.id" :value="maker.id">{{ maker.id }}{{ maker.name !== maker.id ? ` · ${maker.name}` : '' }}</option>
    </select>
  </Field>
</template>
