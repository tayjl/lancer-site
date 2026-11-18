<script setup lang="ts">
import { SYSTEM_TYPES, type BonusType, type Data } from '../../contentEditor'
import RichTextEditor from '../RichTextEditor.vue'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import DeployableListField from './DeployableListField.vue'
import Field from './Field.vue'
import ItemBasics from './ItemBasics.vue'
import TagListField from './TagListField.vue'
import { latest, useFields } from './useFields'

// The form for a mech system (a system, AI, shield, drone and so on): the basics, what it does, its actions, deployables,
// tags and bonuses. A system with no type in the game data is a plain "System"; the box shows that, and writes a type only when
// you change it.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ tags: { id: string; name: string }[]; bonusTypes: BonusType[]; locked: boolean; manufacturers: { id: string; name: string }[]; licences: { id: string; name: string; source: string }[] }>()
const f = useFields(model)
const effect = f.text('effect')
const description = f.text('description')
const tagList = f.list<{ id: string; val?: string | number }>('tags')
const bonuses = f.list<Data>('bonuses')
const actions = f.list<Data>('actions')
const deployables = f.list<Data>('deployables')
const type = f.text('type')
</script>

<template>
  <ItemBasics v-model="model" id-prefix="system" :locked="locked" :manufacturers="manufacturers" :licences="licences">
    <Field label="Kind of system" path="type">
      <select :value="type || 'System'" @change="type = ($event.target as HTMLSelectElement).value">
        <option v-if="type && !SYSTEM_TYPES.includes(type)" :value="type">{{ type }}</option>
        <option v-for="option in SYSTEM_TYPES" :key="option" :value="option">{{ option }}</option>
      </select>
    </Field>
  </ItemBasics>

  <section class="panel" aria-labelledby="system-text">
    <h3 id="system-text" class="sheet-label">Text</h3>
    <Field block label="Rules text"><RichTextEditor label="Rules text" html basic v-model="effect" /></Field>
    <Field label="Lore" hint="Optional flavour text, plain.">
      <textarea v-model="description" rows="3"></textarea>
    </Field>
  </section>

  <section class="panel" aria-labelledby="system-actions">
    <h3 id="system-actions" class="sheet-label">Actions</h3>
    <ActionListField v-model="actions" />
  </section>

  <section class="panel" aria-labelledby="system-deployables">
    <h3 id="system-deployables" class="sheet-label">Deployables</h3>
    <DeployableListField v-model="deployables" />
  </section>

  <section class="panel" aria-labelledby="system-tags">
    <h3 id="system-tags" class="sheet-label">Tags</h3>
    <TagListField v-model="tagList" :tags="tags" />
  </section>

  <section class="panel" aria-labelledby="system-bonuses">
    <h3 id="system-bonuses" class="sheet-label">Bonuses when equipped</h3>
    <BonusListField v-model="bonuses" :types="bonusTypes" />
  </section>
</template>
