<script setup lang="ts">
import { type Data } from '../../contentEditor'
import { defIds, defList } from '../../definitions'
import ActionChip from '../ActionChip.vue'
import RichTextEditor from '../RichTextEditor.vue'
import Field from './Field.vue'
import RepeatList from './RepeatList.vue'
import { input, latest } from './useFields'

// An item's actions: a name, how it's activated (the chip beside the choice is what players see), how often, what
// triggers it, and its rules text. Other fields on an action are kept as they are. "path" is where the list sits in the
// item ("actions", "profiles.0.actions"), so problems land on the right input.
const modelProp = defineModel<Data[]>({ required: true })
const model = latest(modelProp)
const props = withDefaults(defineProps<{ path?: string; label?: string }>(), { path: 'actions' })

const clean = (value: string) => value || undefined
const where = (index: number, key: string) => `${props.path}.${index}.${key}`
</script>

<template>
  <RepeatList v-model="model" noun="action" :path="path" :make="() => ({ name: '', activation: 'Quick', detail: '' })">
    <template #title="{ item, index }">Action {{ index + 1 }}<span v-if="item.name" class="dim"> · {{ item.name }}</span></template>
    <template #summary="{ item }">{{ [item.activation, item.frequency, item.trigger].filter(Boolean).join(' · ') }}</template>
    <template #default="{ item, index, change }">
      <div class="rep-grid">
        <Field label="Name" :path="where(index, 'name')">
          <input type="text" :value="item.name" autocomplete="off" @input="change({ name: input($event) })" />
        </Field>
        <Field label="Activation" :path="where(index, 'activation')">
          <span class="activation">
            <select :value="item.activation" @change="change({ activation: input($event) })">
              <option v-if="!defIds('activations').includes(String(item.activation))" :value="item.activation">{{ item.activation ?? 'Passive' }}</option>
              <option v-for="activation in defList('activations')" :key="activation.id" :value="activation.id">{{ activation.label }}</option>
            </select>
            <ActionChip :activation="String(item.activation ?? '')" />
          </span>
        </Field>
        <Field label="How often">
          <input type="text" :value="item.frequency ?? ''" placeholder="1/round" @input="change({ frequency: clean(input($event)) })" />
        </Field>
        <Field label="Trigger">
          <input type="text" :value="item.trigger ?? ''" placeholder="Reactions only" @input="change({ trigger: clean(input($event)) })" />
        </Field>
      </div>
      <Field block label="Rules">
        <RichTextEditor :label="`${label ?? 'Action'} ${index + 1} rules`" html :model-value="String(item.detail ?? '')" @update:model-value="change({ detail: $event })" />
      </Field>
    </template>
  </RepeatList>
</template>

<style scoped>
.rep-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: var(--space-m); }
.activation { display: flex; align-items: center; gap: var(--space-s); }
.activation select { flex: 1; min-width: 0; }
</style>
