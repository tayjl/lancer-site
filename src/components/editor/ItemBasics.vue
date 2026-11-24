<script setup lang="ts">
import { computed } from 'vue'
import type { Data } from '../../contentEditor'
import { plural } from '../../text'
import FoldPanel from './FoldPanel.vue'
import Field from './Field.vue'
import LicenceField from './LicenceField.vue'
import ManufacturerField from './ManufacturerField.vue'
import { latest, useFields } from './useFields'

// The first panel of a weapon, system or weapon mod: its name, id, manufacturer, licence and rank, system points, and
// (the slot) whatever the kind adds, such as a weapon's mount. No licence (GMS gear) is license_id "" at rank 0; a
// licence is a frame's, and its rank 1 to 3 says when it unlocks. The id never changes once saved: pilots keep it.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{
  locked: boolean
  manufacturers: { id: string; name: string }[]
  licences: { id: string; name: string; source: string }[]
}>()
const f = useFields(model)
const name = f.text('name')
const source = f.text('source')
const points = f.number('sp')
const licenceId = computed(() => String(model.value.license_id ?? ''))
const rank = computed(() => Number(model.value.license_level) || 1)
// Shown while folded.
const summary = computed(() => [source.value, licenceId.value ? `${model.value.license ?? licenceId.value} ${['', 'I', 'II', 'III'][rank.value] ?? ''}` : 'No licence', model.value.sp ? plural(Number(model.value.sp), 'system point') : ''].filter(Boolean).join(' · '))
</script>

<template>
  <FoldPanel title="Basics" open :summary="summary" :paths="['name', 'id', 'source', 'license_id', 'license_level', 'sp', 'mount', 'type']">
    <div class="grid">
      <Field class="span2" label="Name" path="name"><input v-model="name" type="text" autocomplete="off" /></Field>
      <Field
        class="span2"
        label="ID"
        path="id"
        :hint="locked ? 'Fixed once created.' : 'Made from the name.'"
      >
        <input class="code" :value="String(model.id ?? '')" type="text" readonly />
      </Field>
      <ManufacturerField v-model="source" :manufacturers="manufacturers" />
      <LicenceField v-model="model" :licences="licences" />
      <Field label="System points" path="sp"><input v-model="points" type="number" min="0" step="1" /></Field>
      <slot />
    </div>
  </FoldPanel>
</template>
