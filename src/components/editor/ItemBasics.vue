<script setup lang="ts">
import { computed } from 'vue'
import type { Data } from '../../contentEditor'
import { plural } from '../../text'
import ChoiceField from './ChoiceField.vue'
import FoldPanel from './FoldPanel.vue'
import Field from './Field.vue'
import { latest, useFields } from './useFields'

// The first panel of a weapon, system or weapon mod: its name, id, manufacturer, licence and rank, system points, and
// (the slot) whatever the kind adds, such as a weapon's mount. No licence (GMS gear) is license_id "" at rank 0; a
// licence is a frame's, and its rank 1 to 3 says when it unlocks. The id never changes once saved: pilots keep it.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
const props = defineProps<{
  locked: boolean
  manufacturers: { id: string; name: string }[]
  licences: { id: string; name: string; source: string }[]
}>()
const f = useFields(model)
const name = f.text('name')
const source = f.text('source')
const points = f.number('sp')
const licenceId = computed(() => String(model.value.license_id ?? ''))
const rank = computed({ get: () => Number(model.value.license_level) || 1, set: (value: number) => (model.value = { ...model.value, license_level: value }) })
// Shown while folded.
const summary = computed(() => [source.value, licenceId.value ? `${model.value.license ?? licenceId.value} ${['', 'I', 'II', 'III'][rank.value] ?? ''}` : 'No licence', model.value.sp ? plural(Number(model.value.sp), 'system point') : ''].filter(Boolean).join(' · '))

// A licence brings its manufacturer with it (still changeable). "No licence" is how GMS gear is written in the game data.
function chooseLicence(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  const frame = props.licences.find((licence) => licence.id === id)
  model.value = frame
    ? { ...model.value, source: frame.source, license: frame.name, license_id: frame.id, license_level: Number(model.value.license_level) > 0 ? model.value.license_level : 1 }
    : { ...model.value, license: 'GMS', license_id: '', license_level: 0 }
}
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
      <Field class="span2" label="Manufacturer" path="source">
        <select v-model="source">
          <option value="" disabled>Choose…</option>
          <option v-if="source && !manufacturers.some((maker) => maker.id === source)" :value="source">{{ source }}</option>
          <option v-for="maker in manufacturers" :key="maker.id" :value="maker.id">{{ maker.id }}{{ maker.name !== maker.id ? ` · ${maker.name}` : '' }}</option>
        </select>
      </Field>
      <Field class="span2" label="Licence" path="license_id">
        <select :value="licenceId" @change="chooseLicence">
          <option value="">None</option>
          <option v-if="licenceId && !licences.some((licence) => licence.id === licenceId)" :value="licenceId">{{ licenceId }}</option>
          <option v-for="licence in licences" :key="licence.id" :value="licence.id">{{ licence.source }} {{ licence.name }}</option>
        </select>
      </Field>
      <Field v-if="licenceId" block label="Licence rank" path="license_level">
        <ChoiceField v-model="rank" label="Licence rank" :options="[{ value: 1, label: 'I' }, { value: 2, label: 'II' }, { value: 3, label: 'III' }]" />
      </Field>
      <Field label="System points" path="sp"><input v-model="points" type="number" min="0" step="1" /></Field>
      <slot />
    </div>
  </FoldPanel>
</template>
