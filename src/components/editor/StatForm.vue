<script setup lang="ts">
import type { Data } from '../../contentEditor'
import Field from './Field.vue'
import { latest, useFields } from './useFields'

// The form for a personal stat (a site table): its name, and where it comes in the list. Its id is the short key that
// sheets and bonuses use (tech_fluency), so it never changes.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ locked: boolean }>()
const f = useFields(model)
const name = f.text('name')
const order = f.number('sort_order')
</script>

<template>
  <section class="panel" aria-labelledby="stat-basics">
    <h3 id="stat-basics" class="sheet-label">Basics</h3>
    <div class="grid">
      <Field class="span2" label="Name" path="name"><input v-model="name" type="text" autocomplete="off" /></Field>
      <Field class="span2" label="Key" path="id" :hint="locked ? 'Sheets and bonuses use this key, so it never changes. Rename the stat freely.' : 'Made from the name until you save it the first time.'">
        <input class="code" :value="String(model.id ?? '')" type="text" readonly />
      </Field>
      <Field class="span2" label="Order" path="sort_order"><input v-model="order" type="number" step="1" /></Field>
    </div>
    <p class="hint">A new personal stat appears on every pilot's stats tab, starting at 2 like the others.</p>
  </section>
</template>
