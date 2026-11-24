<script setup lang="ts">
import { computed } from 'vue'
import type { Data } from '../../contentEditor'
import { FIXED_SECTIONS, hasValue, ruleSection } from '../../ruleList'
import { SECTIONS, numberKeyOf } from '../../rulesData'
import { capitalise } from '../../text'
import RichTextEditor from '../RichTextEditor.vue'
import Field from './Field.vue'
import FoldPanel from './FoldPanel.vue'
import NumberListField from './NumberListField.vue'
import { filled, latest, useFields } from './useFields'

// The form for a combat guide rule: where it sits (section and group), what it's called, the short value some tables show
// before the name, and its text. The numbers section edits a list of numbers.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ locked: boolean }>()
const f = useFields(model)
const name = f.text('name')
const group = f.text('group')
const value = f.text('value')
const short = f.text('short')
const gist = f.text('gist')
const text = f.text('text')
const icon = f.text('icon')
const order = f.number('order')
const hidden = f.flag('hidden')
const numbers = f.list<number | ''>('numbers')
const section = computed({
  get: () => String(model.value.section ?? ''),
  // A group from the old section means nothing in the new one.
  set: (next: string) => {
    const kept = ruleSection(next)?.groups?.some((g) => g.id === model.value.group)
    model.value = { ...model.value, section: next, ...('group' in model.value && !kept ? { group: '' } : {}) }
  },
})
const s = computed(() => ruleSection(section.value))
const ICONS = ['burst', 'blast', 'cone', 'line', 'kinetic', 'explosive', 'energy', 'burn', 'heat', 'structure', 'reactor', 'shield', 'warning', 'info', 'speed', 'range', 'threat', 'melee']
const sections = computed(() => SECTIONS.filter((x) => !FIXED_SECTIONS.includes(x.id) || x.id === section.value))
const wordy = computed(() => !!s.value && s.value.shape !== 'numbers')
</script>

<template>
  <FoldPanel title="Basics" open :summary="hidden ? 'Hidden from players' : 'Shown to players'" :paths="['name', 'id', 'section', 'group', 'order']">
    <div class="grid">
      <Field class="span2" label="Name" path="name" :hint="section === 'turn_steps' ? 'Fixed for turn steps.' : undefined">
        <input v-model="name" type="text" autocomplete="off" :readonly="section === 'turn_steps'" :class="{ code: section === 'turn_steps' }" />
      </Field>
      <Field class="span2" label="ID" path="id" :hint="locked ? 'Fixed once created.' : 'Made from the name.'">
        <input class="code" :value="String(model.id ?? '')" type="text" readonly />
      </Field>
      <Field label="Section" path="section" :hint="FIXED_SECTIONS.includes(section) ? 'Fixed for this section.' : undefined">
        <select v-model="section" :disabled="FIXED_SECTIONS.includes(section)">
          <option value="">Choose…</option>
          <option v-if="section && !s" :value="section">{{ section }}</option>
          <option v-for="x in sections" :key="x.id" :value="x.id">{{ x.label }}</option>
        </select>
      </Field>
      <Field v-if="s?.groups" label="Group" path="group">
        <select v-model="group">
          <option value="">Choose…</option>
          <option v-for="g in s.groups" :key="g.id" :value="g.id">{{ g.label }}</option>
        </select>
      </Field>
      <Field v-if="hasValue(section)" label="Value" path="value" hint="Shown before the name, as in &quot;6+&quot; or &quot;DC 12&quot;.">
        <input v-model="value" type="text" autocomplete="off" />
      </Field>
      <Field v-if="hasValue(section)" label="Short value" path="short" hint="For narrow lists, as in &quot;15+&quot;.">
        <input v-model="short" type="text" autocomplete="off" />
      </Field>
      <Field v-if="s?.shape === 'steps'" label="Frequency" path="value">
        <input v-model="value" type="text" autocomplete="off" />
      </Field>
      <Field label="Order" path="order" hint="Lower numbers come first.">
        <input v-model="order" type="number" min="0" step="1" inputmode="numeric" />
      </Field>
      <Field v-if="wordy" label="Icon" path="icon">
        <select v-model="icon">
          <option value="">None</option>
          <option v-if="icon && !ICONS.includes(icon)" :value="icon">{{ icon }}</option>
          <option v-for="i in ICONS" :key="i" :value="i">{{ capitalise(i) }}</option>
        </select>
      </Field>
    </div>
    <label v-if="s?.shape !== 'numbers'" class="check"><input v-model="hidden" type="checkbox" />Hidden from players</label>
  </FoldPanel>

  <FoldPanel v-if="wordy" title="What it says" :summary="filled([['Short line', gist], ['Rules text', text]])" :paths="['gist', 'text']">
    <Field v-if="section !== 'notes'" label="Short line" path="gist" hint="Shown under the name. Leave empty to use the first sentence.">
      <input v-model="gist" type="text" autocomplete="off" />
    </Field>
    <Field block label="Rules text" path="text" :hint="'Use {loadout_gear} for a number or {action:ID} for an action name.'">
      <RichTextEditor label="Rules text" html v-model="text" />
    </Field>
  </FoldPanel>

  <FoldPanel v-if="s?.shape === 'numbers'" title="Numbers" open :summary="numbers.join(', ')" :paths="['numbers', 'text']">
    <Field block label="Numbers" path="numbers" hint="One number per box, in order.">
      <NumberListField v-model="numbers" label="Numbers" :single="!!numberKeyOf(String(model.id ?? '')) || model.id === 'rule_numbers_repair_cost'" :max="numberKeyOf(String(model.id ?? ''))?.hi" />
    </Field>
    <Field block label="Description"><RichTextEditor label="Description" html v-model="text" /></Field>
  </FoldPanel>
</template>
