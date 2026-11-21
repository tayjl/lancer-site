<script setup lang="ts">
import { computed } from 'vue'
import type { BonusType, Data } from '../../contentEditor'
import { plural } from '../../text'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import Field from './Field.vue'
import FoldPanel from './FoldPanel.vue'
import GrantFields from './GrantFields.vue'
import RequirementListField from './RequirementListField.vue'
import RichTextEditor from '../RichTextEditor.vue'
import { filled, latest, list, useFields } from './useFields'

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
const requires = f.list<{ kind: 'talent' | 'licence' | 'core_bonus' | 'item'; id: string; rank?: number }>('requires')
const grants = computed(() => list<string>(model.value.integrated).length + list<string>(model.value.special_equipment).length)
</script>

<template>
  <FoldPanel title="Basics" open :summary="source" :paths="['name', 'id', 'source']">
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
  </FoldPanel>

  <FoldPanel title="Rules" :summary="filled([['Effect', effect], ['Mounted effect', mounted], ['Description', description]])" :paths="['effect', 'mounted_effect', 'description']">
    <Field block label="Effect"><RichTextEditor label="Effect" html v-model="effect" /></Field>
    <Field block label="Mounted effect">
      <RichTextEditor label="Mounted effect" html v-model="mounted" />
    </Field>
    <Field block label="Description" hint="Flavour text."><RichTextEditor label="Description" html v-model="description" /></Field>
  </FoldPanel>

  <FoldPanel title="Effects" :summary="bonuses.length ? plural(bonuses.length, 'effect') : 'Empty'" :paths="['bonuses']">
    <BonusListField v-model="bonuses" :types="bonusTypes" />
  </FoldPanel>

  <FoldPanel title="Equipment" :summary="grants ? plural(grants, 'item') : 'Empty'" :paths="['integrated', 'special_equipment', 'replace_integrated']">
    <GrantFields :data="model" owner="Core bonus" @change="model = { ...model, ...$event }" />
  </FoldPanel>

  <FoldPanel title="Actions" :summary="plural(actions.length, 'action')" :paths="['actions']">
    <ActionListField v-model="actions" />
  </FoldPanel>

  <FoldPanel title="Requirements" :summary="plural(requires.length, 'requirement')" :paths="['requires']">
    <RequirementListField v-model="requires" />
  </FoldPanel>
</template>
