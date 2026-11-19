<script setup lang="ts">
import type { BonusType, Data } from '../../contentEditor'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import Field from './Field.vue'
import RichTextEditor from '../RichTextEditor.vue'
import { latest, useFields } from './useFields'

// The form for a core bonus: its manufacturer, its rules, what it changes (bonuses) and any actions it grants.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ manufacturers: { id: string; name: string }[]; bonusTypes: BonusType[]; locked: boolean }>()
const f = useFields(model)
const name = f.text('name')
const source = f.text('source')
const effect = f.text('effect')
const mounted = f.text('mounted_effect')
const description = f.text('description')
const bonuses = f.list<Data>('bonuses')
const actions = f.list<Data>('actions')
</script>

<template>
  <section class="panel" aria-labelledby="core-basics">
    <h3 id="core-basics" class="sheet-label">Basics</h3>
    <div class="grid">
      <Field class="span2" label="Name" path="name"><input v-model="name" type="text" autocomplete="off" /></Field>
      <Field class="span2" label="ID" path="id" :hint="locked ? 'Fixed once created.' : 'Made from the name.'">
        <input class="code" :value="String(model.id ?? '')" type="text" readonly />
      </Field>
      <Field class="span2" label="Manufacturer" path="source">
        <select v-model="source">
          <option value="" disabled>Choose…</option>
          <option v-if="source && !manufacturers.some((maker) => maker.id === source)" :value="source">{{ source }}</option>
          <option v-for="maker in manufacturers" :key="maker.id" :value="maker.id">{{ maker.id }}{{ maker.name !== maker.id ? ` · ${maker.name}` : '' }}</option>
        </select>
      </Field>
    </div>
  </section>

  <section class="panel" aria-labelledby="core-rules">
    <h3 id="core-rules" class="sheet-label">Rules</h3>
    <Field block label="Effect"><RichTextEditor label="Effect" html basic v-model="effect" /></Field>
    <Field block label="Mounted effect" hint="What it does on the mount it changes.">
      <RichTextEditor label="Mounted effect" html basic v-model="mounted" />
    </Field>
    <Field block label="Description" hint="Flavour text."><RichTextEditor label="Description" html basic v-model="description" /></Field>
  </section>

  <section class="panel" aria-labelledby="core-bonuses">
    <h3 id="core-bonuses" class="sheet-label">Bonuses</h3>
    <BonusListField v-model="bonuses" :types="bonusTypes" />
  </section>

  <section class="panel" aria-labelledby="core-actions">
    <h3 id="core-actions" class="sheet-label">Actions</h3>
    <ActionListField v-model="actions" />
  </section>
</template>
