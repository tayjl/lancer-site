<script setup lang="ts">
import { DEPLOYABLE_TYPES, type Data } from '../../contentEditor'
import RichTextEditor from '../RichTextEditor.vue'
import ActionListField from './ActionListField.vue'
import Field from './Field.vue'
import RepeatList from './RepeatList.vue'
import { input, latest } from './useFields'

// The drones, mines and turrets an item places: a name, a kind, its numbers (size, HP, evasion, e-defence, armour; an
// empty box leaves the number out), its rules and its own actions. Other fields on a deployable are kept as they are.
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
            <option v-if="item.type && !DEPLOYABLE_TYPES.includes(String(item.type))" :value="item.type">{{ item.type }}</option>
            <option v-for="type in DEPLOYABLE_TYPES" :key="type" :value="type">{{ type }}</option>
          </select>
        </Field>
      </div>
      <div class="nums">
        <Field v-for="[key, label, step] in NUMBERS" :key="key" :label="label" :path="`${path}.${index}.${key}`">
          <input type="number" min="0" :step="step" :value="item[key] ?? ''" @input="change({ [key]: number(input($event)) })" />
        </Field>
      </div>
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
.nums input { font-family: var(--mono); }
</style>
