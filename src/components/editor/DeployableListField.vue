<script setup lang="ts">
import { type Data } from '../../contentEditor'
import { defIds, defLabel, defList } from '../../definitions'
import ActionChip from '../ActionChip.vue'
import RichTextEditor from '../RichTextEditor.vue'
import DamageField from './DamageField.vue'
import ActionListField from './ActionListField.vue'
import Field from './Field.vue'
import RepeatList from './RepeatList.vue'
import { clean, input, latest, list, type Entry } from './useFields'

// The drones, mines and turrets an item places: a name, a kind, its numbers (size, HP, evasion, e-defence, armour; an
// empty box leaves the number out), its activation, range, rules and its own actions. Other fields on a deployable are kept as they are.
const modelProp = defineModel<Data[]>({ required: true })
const model = latest(modelProp)
withDefaults(defineProps<{ path?: string }>(), { path: 'deployables' })

const NUMBERS = [['size', 'Size', '0.5'], ['hp', 'HP', '1'], ['evasion', 'Evasion', '1'], ['edef', 'E-defence', '1'], ['armor', 'Armour', '1']] as const
const number = (text: string) => (text.trim() === '' ? undefined : Number(text))
</script>

<template>
  <RepeatList v-model="model" noun="deployable" :path="path" :make="() => ({ name: '', type: 'Deployable', detail: '' })">
    <template #title="{ item, index }">Deployable {{ index + 1 }}<span v-if="item.name" class="dim"> · {{ item.name }}</span></template>
    <template #summary="{ item }">{{ [item.type, item.hp !== undefined ? `${item.hp} HP` : ''].filter(Boolean).join(' · ') }}</template>
    <template #default="{ item, index, change }">
      <div class="grid2">
        <Field label="Name" :path="`${path}.${index}.name`">
          <input type="text" :value="item.name" autocomplete="off" @input="change({ name: input($event) })" />
        </Field>
        <Field label="Kind">
          <select :value="item.type" @change="change({ type: input($event) })">
            <option v-if="item.type && !defIds('deployable_types').includes(String(item.type))" :value="item.type">{{ item.type }}</option>
            <option v-for="type in defList('deployable_types')" :key="type.id" :value="type.id">{{ type.label }}</option>
          </select>
        </Field>
      </div>
      <div class="nums">
        <Field v-for="[key, label, step] in NUMBERS" :key="key" :label="label" :path="`${path}.${index}.${key}`">
          <input type="number" min="0" :step="step" :value="item[key] ?? ''" @input="change({ [key]: number(input($event)) })" />
        </Field>
      </div>
      <Field label="Activation" :path="`${path}.${index}.activation`">
        <span class="activation">
          <select :value="item.activation ?? ''" @change="change({ activation: input($event) || undefined })">
            <option value="">None</option>
            <option v-if="item.activation && !defIds('activations').includes(String(item.activation))" :value="item.activation">{{ defLabel('activations', String(item.activation)) }}</option>
            <option v-for="activation in defList('activations')" :key="activation.id" :value="activation.id">{{ activation.label }}</option>
          </select>
          <ActionChip :activation="String(item.activation ?? '')" />
        </span>
      </Field>
      <Field block label="Range">
        <DamageField :model-value="list<Entry>(item.range)" kind="range" :path="`${path}.${index}.range`" noun="Deployable range" @update:model-value="change({ range: clean($event) })" />
      </Field>
      <Field block label="Rules">
        <RichTextEditor :label="`Deployable ${index + 1} rules`" html :model-value="String(item.detail ?? '')" @update:model-value="change({ detail: $event })" />
      </Field>
      <Field block label="Deployable actions">
        <ActionListField :model-value="Array.isArray(item.actions) ? (item.actions as Data[]) : []" :path="`${path}.${index}.actions`" label="Deployable action" @update:model-value="change({ actions: $event.length ? $event : undefined })" />
      </Field>
    </template>
  </RepeatList>
</template>

<style scoped>
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: var(--space-m); }
.nums { display: grid; grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr)); gap: var(--space-m); }
.activation { display: flex; align-items: center; gap: var(--space-s); }
.activation select { flex: 1; min-width: 0; }
.nums input { font-family: var(--mono); }
</style>
