<script setup lang="ts">
import type { Data } from '../../contentEditor'
import Field from './Field.vue'
import { latest, useFields } from './useFields'

// The form for a faction, one of the organisations the GM-only reputation tracker lists: just a name.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
const name = useFields(model).text('name')
</script>

<template>
  <section class="panel">
    <Field label="Name" path="name">
      <input v-model="name" type="text" maxlength="80" autocomplete="off" />
    </Field>
  </section>
</template>
