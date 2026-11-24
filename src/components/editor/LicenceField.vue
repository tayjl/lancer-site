<script setup lang="ts">
import { computed } from 'vue'
import type { Data } from '../../contentEditor'
import ChoiceField from './ChoiceField.vue'
import Field from './Field.vue'
import { latest } from './useFields'

// Licence and rank, written the same way for every kind. Gear passes `licences` and picks one (No licence, GMS gear, is
// license_id "" at rank 0; a licence brings its manufacturer along, still changeable) with a rank of I to III. A frame
// passes none: its licence is its own id (or its original's) and the rank, I to III or None, says when it unlocks.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
const props = defineProps<{ licences?: { id: string; name: string; source: string }[] }>()
const licenceId = computed(() => String(model.value.license_id ?? ''))
const rank = computed({
  get: () => Number(model.value.license_level) || (props.licences ? 1 : 0),
  set: (value: number) => (model.value = { ...model.value, license_level: value }),
})
const roman = (level: number) => ['None', 'I', 'II', 'III'][level] ?? String(level)

function chooseLicence(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  const frame = props.licences?.find((licence) => licence.id === id)
  model.value = frame
    ? { ...model.value, source: frame.source, license: frame.name, license_id: frame.id, license_level: Number(model.value.license_level) > 0 ? model.value.license_level : 1 }
    : { ...model.value, license: 'GMS', license_id: '', license_level: 0 }
}
</script>

<template>
  <Field class="span2" label="Licence" path="license_id">
    <select v-if="licences" :value="licenceId" @change="chooseLicence">
      <option value="">None</option>
      <option v-if="licenceId && !licences.some((licence) => licence.id === licenceId)" :value="licenceId">{{ licenceId }}</option>
      <option v-for="licence in licences" :key="licence.id" :value="licence.id">{{ licence.source }} {{ licence.name }}</option>
    </select>
    <input v-else class="code" :value="licenceId" type="text" readonly />
  </Field>
  <Field v-if="!licences || licenceId" block :label="licences ? 'Licence rank' : 'Unlocked at licence rank'" path="license_level">
    <ChoiceField v-model="rank" :label="licences ? 'Licence rank' : 'Unlocked at licence rank'" :options="(licences ? [1, 2, 3] : [0, 1, 2, 3]).map((value) => ({ value, label: roman(value) }))" />
  </Field>
</template>
