<script setup lang="ts">
import { WEAPON_MOUNTS, WEAPON_TYPES, type BonusType, type Data } from '../../contentEditor'
import RichTextEditor from '../RichTextEditor.vue'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import DamageField from './DamageField.vue'
import Field from './Field.vue'
import ItemBasics from './ItemBasics.vue'
import TagListField from './TagListField.vue'
import ToggleChips from './ToggleChips.vue'
import { latest, useFields } from './useFields'

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
</script>

<template>
  <ItemBasics v-model="model" id-prefix="mod" :locked="locked" :manufacturers="manufacturers" :licences="licences" />

  <section class="panel" aria-labelledby="mod-fits">
    <h3 id="mod-fits" class="sheet-label">Which weapons it fits</h3>
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
  </section>

  <section class="panel" aria-labelledby="mod-adds">
    <h3 id="mod-adds" class="sheet-label">What it adds to the weapon</h3>
    <Field block label="Added range"><DamageField v-model="addedRange" kind="range" path="added_range" noun="Added range" /></Field>
    <Field block label="Added damage" hint="Added damage isn't counted in the weapon's numbers; it's conditional, so say when in the effect.">
      <DamageField v-model="addedDamage" kind="damage" path="added_damage" noun="Added damage" />
    </Field>
    <Field block label="Added tags"><TagListField v-model="addedTags" :tags="tags" path="added_tags" label="Added tags" /></Field>
  </section>

  <section class="panel" aria-labelledby="mod-text">
    <h3 id="mod-text" class="sheet-label">Text</h3>
    <Field block label="Rules text"><RichTextEditor label="Rules text" html basic v-model="effect" /></Field>
    <Field label="Lore" hint="Optional flavour text, plain.">
      <textarea v-model="description" rows="3"></textarea>
    </Field>
  </section>

  <section class="panel" aria-labelledby="mod-actions">
    <h3 id="mod-actions" class="sheet-label">Actions</h3>
    <ActionListField v-model="actions" />
  </section>

  <section class="panel" aria-labelledby="mod-tags">
    <h3 id="mod-tags" class="sheet-label">Tags</h3>
    <TagListField v-model="tagList" :tags="tags" />
  </section>

  <section class="panel" aria-labelledby="mod-bonuses">
    <h3 id="mod-bonuses" class="sheet-label">Bonuses when equipped</h3>
    <BonusListField v-model="bonuses" :types="bonusTypes" />
  </section>
</template>
