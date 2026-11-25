<script setup lang="ts">
import { type BonusType, type Data } from '../../contentEditor'
import { defIds, defLabel, defList } from '../../definitions'
import ActionChip from '../ActionChip.vue'
import RichTextEditor from '../RichTextEditor.vue'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import DeployableListField from './DeployableListField.vue'
import Field from './Field.vue'
import GrantFields from './GrantFields.vue'
import { clean, input, latest } from './useFields'

// A frame's core system: its name and lore; the passive that's always on (counted in the mech's numbers when it has
// bonuses); the core power the pilot switches on (its activation, how long it lasts, rules, actions, bonuses that only
// apply while it's on, which the stats leave out); equipment it builds in; and deployables. Fields with no input
// (active_synergies) stay as they are. Paths are inside core_system, so problems land on the right input.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ bonusTypes: BonusType[] }>()

const set = (changes: Data) => (model.value = { ...model.value, ...changes })
const list = <T,>(key: string) => (Array.isArray(model.value[key]) ? (model.value[key] as T[]) : [])
const val = (key: string) => String(model.value[key] ?? '')
const optional = (value: unknown) => (value as string) || undefined
</script>

<template>
  <Field label="Name" path="core_system.name"><input type="text" autocomplete="off" :value="val('name')" @input="set({ name: input($event) })" /></Field>
  <Field block label="Lore" hint="Flavour text.">
    <RichTextEditor label="Core system lore" html :model-value="val('description')" @update:model-value="set({ description: optional($event) })" />
  </Field>

  <h4 class="label sub">Passive</h4>
  <Field label="Passive name"><input type="text" autocomplete="off" :value="val('passive_name')" @input="set({ passive_name: optional(input($event)) })" /></Field>
  <Field block label="Passive rules">
    <RichTextEditor label="Core passive rules" html :model-value="val('passive_effect')" @update:model-value="set({ passive_effect: optional($event) })" />
  </Field>
  <Field block label="Passive actions">
    <ActionListField :model-value="list<Data>('passive_actions')" path="core_system.passive_actions" label="Passive action" @update:model-value="set({ passive_actions: clean($event) })" />
  </Field>
  <Field block label="Passive effects">
    <BonusListField :model-value="list<Data>('passive_bonuses')" :types="bonusTypes" path="core_system.passive_bonuses" @update:model-value="set({ passive_bonuses: clean($event) })" />
  </Field>

  <h4 class="label sub">Core power</h4>
  <div class="trio">
    <Field label="Power name"><input type="text" autocomplete="off" :value="val('active_name')" @input="set({ active_name: input($event) })" /></Field>
    <Field label="Activation" path="core_system.activation">
      <span class="activation">
        <select :value="val('activation')" @change="set({ activation: input($event) })">
          <option v-if="val('activation') && !defIds('activations').includes(val('activation'))" :value="val('activation')">{{ defLabel('activations', val('activation')) }}</option>
          <option v-for="activation in defList('activations')" :key="activation.id" :value="activation.id">{{ activation.label }}</option>
        </select>
        <ActionChip :activation="val('activation')" />
      </span>
    </Field>
    <Field label="Lasts for">
      <select :value="val('use')" @change="set({ use: optional(input($event)) })">
        <option value="">None</option>
        <option v-if="val('use') && !defIds('uses').includes(val('use'))" :value="val('use')">{{ defLabel('uses', val('use')) }}</option>
        <option v-for="use in defList('uses')" :key="use.id" :value="use.id">{{ use.label }}</option>
      </select>
    </Field>
    <Field label="Switch off with">
      <select :value="val('deactivation')" @change="set({ deactivation: optional(input($event)) })">
        <option value="">None</option>
        <option v-if="val('deactivation') && !defIds('activations').includes(val('deactivation'))" :value="val('deactivation')">{{ defLabel('activations', val('deactivation')) }}</option>
        <option v-for="activation in defList('activations')" :key="activation.id" :value="activation.id">{{ activation.label }}</option>
      </select>
    </Field>
  </div>
  <Field block label="Power rules">
    <RichTextEditor label="Core power rules" html :model-value="val('active_effect')" @update:model-value="set({ active_effect: $event })" />
  </Field>
  <Field block label="Power actions">
    <ActionListField :model-value="list<Data>('active_actions')" path="core_system.active_actions" label="Power action" @update:model-value="set({ active_actions: clean($event) })" />
  </Field>
  <Field block label="Power effects" hint="Say when they apply in the power rules.">
    <BonusListField :model-value="list<Data>('active_bonuses')" :types="bonusTypes" path="core_system.active_bonuses" @update:model-value="set({ active_bonuses: clean($event) })" />
  </Field>

  <h4 class="label sub">Equipment and deployables</h4>
  <GrantFields :data="model" owner="Core system" path="core_system" @change="set($event)" />
  <Field block label="Deployables">
    <DeployableListField :model-value="list<Data>('deployables')" path="core_system.deployables" @update:model-value="set({ deployables: clean($event) })" />
  </Field>
</template>

<style scoped>
.sub { margin: var(--space-s) 0 0; padding-top: var(--space-m); border-top: 1px solid var(--rule); }
.trio { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: var(--space-m); }
.activation { display: flex; align-items: center; gap: var(--space-s); }
.activation select { flex: 1; min-width: 0; }
</style>
