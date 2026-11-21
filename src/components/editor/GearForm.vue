<script setup lang="ts">
import { computed } from 'vue'
import { GEAR_PRICE_DEFAULT } from '../../rules'
import { plural } from '../../text'
import { GEAR_TYPES, type BonusType, type Data } from '../../contentEditor'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import DamageField from './DamageField.vue'
import Field from './Field.vue'
import FoldPanel from './FoldPanel.vue'
import RequirementListField from './RequirementListField.vue'
import TagListField from './TagListField.vue'
import RichTextEditor from '../RichTextEditor.vue'
import { filled, latest, useFields } from './useFields'

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
const requires = f.list<{ kind: 'talent' | 'licence' | 'core_bonus' | 'item'; id: string; rank?: number }>('requires')
const tagList = f.list<{ id: string; val?: string | number }>('tags')
const actions = f.list<Data>('actions')
// Its price in manna. Emptying the box takes the key off, so the item costs the default (rules.ts GEAR_PRICE_DEFAULT).
const price = computed({
  get: () => String(model.value.manna_cost ?? ''),
  set: (value: string | number) =>
    (model.value = value === '' ? Object.fromEntries(Object.entries(model.value).filter(([key]) => key !== 'manna_cost')) : { ...model.value, manna_cost: Number(value) }),
})
</script>

<template>
  <FoldPanel title="Basics" open :summary="[type === 'Armor' ? 'Armour' : type, model.manna_cost !== undefined ? `${model.manna_cost} manna` : ''].filter(Boolean).join(' · ')" :paths="['name', 'id', 'type', 'manna_cost']">
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
      <Field class="span2" label="Manna cost" path="manna_cost">
        <input v-model="price" type="number" min="0" step="1" :placeholder="String(GEAR_PRICE_DEFAULT)" />
      </Field>
    </div>
  </FoldPanel>

  <FoldPanel title="Rules" :summary="filled([['Rules text', effect], ['Description', description]])" :paths="['effect', 'description']">
    <Field block label="Rules text"><RichTextEditor label="Rules text" html basic v-model="effect" /></Field>
    <Field block label="Description" hint="Shown as the rules when there are none.">
      <RichTextEditor label="Description" html basic v-model="description" />
    </Field>
  </FoldPanel>

  <FoldPanel v-if="type === 'Weapon'" title="Range and damage" open :summary="[...range, ...damage].map((entry) => `${entry.type} ${entry.val}`).join(', ') || 'Empty'" :paths="['range', 'damage']">
    <Field block label="Range"><DamageField v-model="range" kind="range" /></Field>
    <Field block label="Damage"><DamageField v-model="damage" kind="damage" /></Field>
  </FoldPanel>

  <FoldPanel title="Effects" :summary="bonuses.length ? plural(bonuses.length, 'effect') : 'Empty'" :paths="['bonuses']">
    <BonusListField v-model="bonuses" :types="bonusTypes" />
  </FoldPanel>

  <FoldPanel title="Tags" :summary="plural(tagList.length, 'tag')" :paths="['tags']">
    <TagListField v-model="tagList" :tags="tags" />
  </FoldPanel>

  <FoldPanel title="Actions" :summary="plural(actions.length, 'action')" :paths="['actions']">
    <ActionListField v-model="actions" />
  </FoldPanel>

  <FoldPanel title="Requirements" :summary="plural(requires.length, 'requirement')" :paths="['requires']">
    <RequirementListField v-model="requires" />
  </FoldPanel>
</template>
