<script setup lang="ts">
import { computed } from 'vue'
import { WEAPON_MOUNTS, WEAPON_TYPES, lockedTags, type BonusType, type Data } from '../../contentEditor'
import { plural } from '../../text'
import RichTextEditor from '../RichTextEditor.vue'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import DamageField from './DamageField.vue'
import Field from './Field.vue'
import FoldPanel from './FoldPanel.vue'
import ItemBasics from './ItemBasics.vue'
import TagListField from './TagListField.vue'
import ToggleChips from './ToggleChips.vue'
import { filled, latest, useFields } from './useFields'

// The form for a weapon mod: the basics, which weapons it fits (src/equipment.ts modBlockedBy: a list left empty fits
// everything), what it adds to its weapon (range and tags count in the weapon's card; damage doesn't, as it's
// conditional), its rules, actions, tags and bonuses.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ tags: { id: string; name: string }[]; bonusTypes: BonusType[]; locked: boolean; manufacturers: { id: string; name: string }[]; licences: { id: string; name: string; source: string }[] }>()
type Entry = { type: string; val: string | number }
type TagEntry = { id: string; val?: string | number }
const f = useFields(model)
const effect = f.text('effect')
const description = f.text('description')
const tagList = f.list<TagEntry>('tags')
const bonuses = f.list<Data>('bonuses')
const actions = f.list<Data>('actions')
const allowedTypes = f.list<string>('allowed_types')
const allowedSizes = f.list<string>('allowed_sizes')
const restrictedTypes = f.list<string>('restricted_types')
const restrictedSizes = f.list<string>('restricted_sizes')
const addedTags = f.list<TagEntry>('added_tags')
const addedRange = f.list<Entry>('added_range')
const addedDamage = f.list<Entry>('added_damage')
// Shown while folded.
const fits = computed(() => [...allowedTypes.value, ...allowedSizes.value, ...[...restrictedTypes.value, ...restrictedSizes.value].map((never) => `not ${never}`)].join(', ') || 'Any weapon')
const adds = computed(() => [plural(addedRange.value.length, 'range'), plural(addedDamage.value.length, 'damage', 'damage'), plural(addedTags.value.length, 'tag')].join(' · '))
</script>

<template>
  <ItemBasics v-model="model" :locked="locked" :manufacturers="manufacturers" :licences="licences" />

  <FoldPanel title="Which weapons it fits" :summary="fits" :paths="['allowed_types', 'allowed_sizes', 'restricted_types', 'restricted_sizes']">
    <Field block label="Only these types" hint="Leave all off to fit any type.">
      <ToggleChips v-model="allowedTypes" :options="WEAPON_TYPES" label="Allowed weapon types" />
    </Field>
    <Field block label="Only these sizes" hint="Leave all off to fit any size.">
      <ToggleChips v-model="allowedSizes" :options="WEAPON_MOUNTS" label="Allowed weapon sizes" />
    </Field>
    <Field block label="Never these types">
      <ToggleChips v-model="restrictedTypes" :options="WEAPON_TYPES" label="Restricted weapon types" />
    </Field>
    <Field block label="Never these sizes">
      <ToggleChips v-model="restrictedSizes" :options="WEAPON_MOUNTS" label="Restricted weapon sizes" />
    </Field>
  </FoldPanel>

  <FoldPanel title="What it adds to the weapon" :summary="adds" :paths="['added_range', 'added_damage', 'added_tags']">
    <Field block label="Added range"><DamageField v-model="addedRange" kind="range" path="added_range" noun="Added range" /></Field>
    <Field block label="Added damage" hint="Say when it applies in the rules text.">
      <DamageField v-model="addedDamage" kind="damage" path="added_damage" noun="Added damage" />
    </Field>
    <Field block label="Added tags"><TagListField v-model="addedTags" :tags="tags" path="added_tags" label="Added tags" /></Field>
  </FoldPanel>

  <FoldPanel title="Text" :summary="filled([['Rules text', effect], ['Lore', description]])" :paths="['effect', 'description']">
    <Field block label="Rules text"><RichTextEditor label="Rules text" html basic v-model="effect" /></Field>
    <Field label="Lore" hint="Flavour text.">
      <textarea v-model="description" rows="3"></textarea>
    </Field>
  </FoldPanel>

  <FoldPanel title="Actions" :summary="plural(actions.length, 'action')" :paths="['actions']">
    <ActionListField v-model="actions" />
  </FoldPanel>

  <FoldPanel title="Tags" :summary="plural(tagList.length, 'tag')" :paths="['tags']">
    <TagListField v-model="tagList" :tags="tags" :locked="lockedTags(model)" />
  </FoldPanel>

  <FoldPanel title="Bonuses when equipped" :summary="plural(bonuses.length, 'bonus', 'bonuses')" :paths="['bonuses']">
    <BonusListField v-model="bonuses" :types="bonusTypes" />
  </FoldPanel>
</template>
