<script setup lang="ts">
import { GEAR_TYPES, type BonusType, type Data } from '../../contentEditor'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import DamageField from './DamageField.vue'
import Field from './Field.vue'
import TagListField from './TagListField.vue'
import RichTextEditor from '../RichTextEditor.vue'
import { latest, useFields } from './useFields'

// The form for a piece of pilot gear (armour, a pilot weapon, or gear): what it is, its rules, a weapon's range and
// damage, its bonuses, tags and actions.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ tags: { id: string; name: string }[]; bonusTypes: BonusType[]; locked: boolean }>()
const f = useFields(model)
const name = f.text('name')
const type = f.text('type')
const effect = f.text('effect')
const description = f.text('description')
const range = f.list<{ type: string; val: string | number }>('range')
const damage = f.list<{ type: string; val: string | number }>('damage')
const bonuses = f.list<Data>('bonuses')
const tagList = f.list<{ id: string; val?: string | number }>('tags')
const actions = f.list<Data>('actions')
</script>

<template>
  <section class="panel" aria-labelledby="gear-basics">
    <h3 id="gear-basics" class="sheet-label">Basics</h3>
    <div class="grid">
      <Field class="span2" label="Name" path="name"><input v-model="name" type="text" autocomplete="off" /></Field>
      <Field class="span2" label="ID" path="id" :hint="locked ? 'Fixed once created.' : 'Made from the name.'">
        <input class="code" :value="String(model.id ?? '')" type="text" readonly />
      </Field>
      <Field class="span2" label="Kind of gear" path="type">
        <select v-model="type">
          <option value="" disabled>Choose…</option>
          <option v-for="gear in GEAR_TYPES" :key="gear" :value="gear">{{ gear === 'Armor' ? 'Armour' : gear }}</option>
        </select>
      </Field>
    </div>
  </section>

  <section class="panel" aria-labelledby="gear-rules">
    <h3 id="gear-rules" class="sheet-label">Rules</h3>
    <Field block label="Rules text"><RichTextEditor label="Rules text" html basic v-model="effect" /></Field>
    <Field block label="Description" hint="Shown as the rules when there are none.">
      <RichTextEditor label="Description" html basic v-model="description" />
    </Field>
  </section>

  <section v-if="type === 'Weapon'" class="panel" aria-labelledby="gear-weapon">
    <h3 id="gear-weapon" class="sheet-label">Range and damage</h3>
    <Field block label="Range"><DamageField v-model="range" kind="range" /></Field>
    <Field block label="Damage"><DamageField v-model="damage" kind="damage" /></Field>
  </section>

  <section class="panel" aria-labelledby="gear-bonuses">
    <h3 id="gear-bonuses" class="sheet-label">Bonuses</h3>
    <BonusListField v-model="bonuses" :types="bonusTypes" />
  </section>

  <section class="panel" aria-labelledby="gear-tags">
    <h3 id="gear-tags" class="sheet-label">Tags</h3>
    <TagListField v-model="tagList" :tags="tags" />
  </section>

  <section class="panel" aria-labelledby="gear-actions">
    <h3 id="gear-actions" class="sheet-label">Actions</h3>
    <ActionListField v-model="actions" />
  </section>
</template>
