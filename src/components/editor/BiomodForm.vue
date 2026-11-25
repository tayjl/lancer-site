<script setup lang="ts">
import { computed, useId } from 'vue'
import { BIONIC_SLOTS, bonusTypesFor, type Data } from '../../contentEditor'
import { useGameData } from '../../gameData'
import { plural } from '../../text'
import RichTextEditor from '../RichTextEditor.vue'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import Field from './Field.vue'
import ManufacturerField from './ManufacturerField.vue'
import FoldPanel from './FoldPanel.vue'
import GrantFields from './GrantFields.vue'
import RequirementListField from './RequirementListField.vue'
import { filled, grantsSummary, latest, useFields } from './useFields'

// The form for a biomod (a site table, not pack content): its slot on the body, its own price in manna, the mod points it
// takes, and its description (flavour) and effect (rules). "Retired" takes it off the list
// pilots choose from; pilots who have it keep it.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
const props = defineProps<{ stats: { id: string; name: string }[]; manufacturers: { id: string; name: string }[] }>()
const f = useFields(model)
const name = f.text('name')
const description = f.text('description')
const slot = f.text('slot')
const source = f.text('source')
const price = f.number('manna_cost')
const effect = f.text('effect')
const cost = f.number('mod_point_cost')
// The usual slots, then any the campaign has made up.
const listId = useId()
const { bionics } = useGameData()
const slots = computed(() => [...new Set([...BIONIC_SLOTS, ...bionics.value.map((biomod) => biomod.slot).filter(Boolean)])])
const retired = f.flag('retired')
// The same effects every other kind has, plus the personal stats.
const effects = f.list<Data>('effect_bonuses')
const effectTypes = computed(() => bonusTypesFor('bionics', props.stats))
const actions = f.list<Data>('actions')
const requires = f.list<{ kind: 'talent' | 'licence' | 'core_bonus' | 'item'; id: string; rank?: number }>('requires')
</script>

<template>
  <FoldPanel title="Basics" open :summary="[slot, source, retired ? 'Hidden' : ''].filter(Boolean).join(' · ')" :paths="['name', 'slot', 'source', 'manna_cost', 'mod_point_cost']">
    <div class="grid">
      <Field class="span2" label="Name" path="name"><input v-model="name" type="text" autocomplete="off" /></Field>
      <Field class="span2" label="Slot" path="slot" hint="Pick one or type your own.">
        <input v-model="slot" type="text" autocomplete="off" :list="listId" />
        <datalist :id="listId"><option v-for="option in slots" :key="option" :value="option"></option></datalist>
      </Field>
      <ManufacturerField v-model="source" :manufacturers="manufacturers" optional hint="HORUS, NHC and Exotic biomods are GM-only." />
      <Field class="span2" label="Price (manna)" path="manna_cost"><input v-model="price" type="number" min="0" step="1" /></Field>
      <Field class="span2" label="Mod points" path="mod_point_cost"><input v-model="cost" type="number" min="0" step="1" /></Field>
    </div>
    <label class="check"><input v-model="retired" type="checkbox" />Hidden from players. Pilots who have it keep it.</label>
  </FoldPanel>

  <FoldPanel title="Effects" :summary="effects.length ? plural(effects.length, 'effect') : 'Empty'" :paths="['effect_bonuses']">
    <BonusListField v-model="effects" :types="effectTypes" path="effect_bonuses" />
  </FoldPanel>

  <FoldPanel title="Actions" :summary="actions.length ? plural(actions.length, 'action') : 'Empty'" :paths="['actions']">
    <ActionListField v-model="actions" path="actions" />
  </FoldPanel>

  <FoldPanel title="Equipment" :summary="grantsSummary(model)" :paths="['integrated', 'special_equipment', 'replace_integrated']">
    <GrantFields :data="model" owner="Biomod" @change="model = { ...model, ...$event }" />
  </FoldPanel>

  <FoldPanel title="Text" :summary="filled([['Description', description], ['Effect', effect]])" :paths="['description', 'effect']">
    <Field label="Description" hint="Flavour text.">
      <textarea v-model="description" rows="4"></textarea>
    </Field>
    <Field block label="Effect"><RichTextEditor label="Effect" html v-model="effect" /></Field>
  </FoldPanel>

  <FoldPanel title="Requirements" :summary="plural(requires.length, 'requirement')" :paths="['requires']">
    <RequirementListField v-model="requires" />
  </FoldPanel>
</template>

<style scoped>
textarea { width: 100%; resize: vertical; }
</style>
