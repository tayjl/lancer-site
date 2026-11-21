<script setup lang="ts">
import type { Data } from '../../contentEditor'
import Field from './Field.vue'
import ItemIdListField from './ItemIdListField.vue'
import { clean, list, useEquipmentOptions } from './useFields'

// The equipment something grants (a core bonus, system, biomod, frame trait or core system): built in, optional, and whether
// it replaces the frame's own built-in weapons. Writes only the fields it changes ("change").
defineProps<{ data: Data; owner: string; path?: string }>()
defineEmits<{ change: [changes: Data] }>()
const equipment = useEquipmentOptions()
</script>

<template>
  <Field block label="Built in" :path="path ? `${path}.integrated` : 'integrated'">
    <ItemIdListField :model-value="list<string>(data.integrated)" :items="equipment" :label="`${owner} built-in equipment`" add="Add built-in equipment" @update:model-value="$emit('change', { integrated: clean($event) })" />
  </Field>
  <Field block label="Optional equipment" :path="path ? `${path}.special_equipment` : 'special_equipment'">
    <ItemIdListField :model-value="list<string>(data.special_equipment)" :items="equipment" :label="`${owner} optional equipment`" add="Add optional equipment" @update:model-value="$emit('change', { special_equipment: clean($event) })" />
  </Field>
  <label class="check">
    <input type="checkbox" :checked="data.replace_integrated === true" @change="$emit('change', { replace_integrated: ($event.target as HTMLInputElement).checked || undefined })" />
    Replaces the frame's built-in weapons
  </label>
</template>
