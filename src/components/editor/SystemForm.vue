<script setup lang="ts">
import { SYSTEM_TYPES, lockedTags, type BonusType, type Data } from '../../contentEditor'
import { plural } from '../../text'
import RichTextEditor from '../RichTextEditor.vue'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import DeployableListField from './DeployableListField.vue'
import Field from './Field.vue'
import FoldPanel from './FoldPanel.vue'
import RequirementListField from './RequirementListField.vue'
import GrantFields from './GrantFields.vue'
import ItemBasics from './ItemBasics.vue'
import TagListField from './TagListField.vue'
import { computed } from 'vue'
import { filled, latest, list, useFields } from './useFields'

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
const requires = f.list<{ kind: 'talent' | 'licence' | 'core_bonus' | 'item'; id: string; rank?: number }>('requires')
const grants = computed(() => list<string>(model.value.integrated).length + list<string>(model.value.special_equipment).length)
const actions = f.list<Data>('actions')
const deployables = f.list<Data>('deployables')
const type = f.text('type')
</script>

<template>
  <ItemBasics v-model="model" :locked="locked" :manufacturers="manufacturers" :licences="licences">
    <Field label="Kind of system" path="type">
      <select :value="type || 'System'" @change="type = ($event.target as HTMLSelectElement).value">
        <option v-if="type && !SYSTEM_TYPES.includes(type)" :value="type">{{ type }}</option>
        <option v-for="option in SYSTEM_TYPES" :key="option" :value="option">{{ option === 'Armor' ? 'Armour' : option }}</option>
      </select>
    </Field>
  </ItemBasics>

  <FoldPanel title="Text" :summary="filled([['Rules text', effect], ['Lore', description]])" :paths="['effect', 'description']">
    <Field block label="Rules text"><RichTextEditor label="Rules text" html v-model="effect" /></Field>
    <Field label="Lore" hint="Flavour text.">
      <textarea v-model="description" rows="3"></textarea>
    </Field>
  </FoldPanel>

  <FoldPanel title="Actions" :summary="plural(actions.length, 'action')" :paths="['actions']">
    <ActionListField v-model="actions" />
  </FoldPanel>

  <FoldPanel title="Deployables" :summary="plural(deployables.length, 'deployable')" :paths="['deployables']">
    <DeployableListField v-model="deployables" />
  </FoldPanel>

  <FoldPanel title="Tags" :summary="plural(tagList.length, 'tag')" :paths="['tags']">
    <TagListField v-model="tagList" :tags="tags" :locked="lockedTags(model)" />
  </FoldPanel>

  <FoldPanel title="Effects when equipped" :summary="bonuses.length ? plural(bonuses.length, 'effect') : 'Empty'" :paths="['bonuses']">
    <BonusListField v-model="bonuses" :types="bonusTypes" />
  </FoldPanel>

  <FoldPanel title="Equipment" :summary="grants ? plural(grants, 'item') : 'Empty'" :paths="['integrated', 'special_equipment', 'replace_integrated']">
    <GrantFields :data="model" owner="System" @change="model = { ...model, ...$event }" />
  </FoldPanel>

  <FoldPanel title="Requirements" :summary="plural(requires.length, 'requirement')" :paths="['requires']">
    <RequirementListField v-model="requires" />
  </FoldPanel>
</template>
