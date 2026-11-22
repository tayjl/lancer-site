<script setup lang="ts">
import { ACTIVATIONS, type Data } from '../../contentEditor'
import RichTextEditor from '../RichTextEditor.vue'
import Field from './Field.vue'
import FoldPanel from './FoldPanel.vue'
import { filled, latest, useFields } from './useFields'

// The form for a base action (Skirmish, Boost...): its wording, when it's taken and which turns list it.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ locked: boolean }>()
const f = useFields(model)
const name = f.text('name')
const activation = f.text('activation')
const frequency = f.text('frequency')
const terse = f.text('terse')
const detail = f.text('detail')
const group = f.text('group')
const mech = f.flag('mech')
const pilot = f.flag('pilot')
const hidden = f.flag('hidden')
const GROUPS = [['attack', 'Attack'], ['tech', 'Tech'], ['other', 'Other'], ['move', 'Movement']]
</script>

<template>
  <FoldPanel title="Basics" open :summary="hidden ? 'Hidden from players' : 'Shown to players'" :paths="['name', 'id']">
    <div class="grid">
      <Field class="span2" label="Name" path="name">
        <input v-model="name" type="text" autocomplete="off" />
      </Field>
      <Field class="span2" label="ID" path="id" :hint="locked ? 'Fixed once created.' : 'Made from the name.'">
        <input class="code" :value="String(model.id ?? '')" type="text" readonly />
      </Field>
      <Field label="Activation" path="activation">
        <select v-model="activation">
          <option value="">None</option>
          <option v-if="activation && !ACTIVATIONS.includes(activation)" :value="activation">{{ activation }}</option>
          <option v-for="word in ACTIVATIONS" :key="word" :value="word">{{ word }}</option>
        </select>
      </Field>
      <Field label="Frequency" path="frequency">
        <input v-model="frequency" type="text" autocomplete="off" />
      </Field>
      <Field label="Group" path="group">
        <select v-model="group">
          <option value="">None</option>
          <option v-for="[value, label] in GROUPS" :key="value" :value="value">{{ label }}</option>
        </select>
      </Field>
    </div>
    <label class="check"><input v-model="mech" type="checkbox" />Shown on mech turns</label>
    <label class="check"><input v-model="pilot" type="checkbox" />Shown on pilot turns</label>
    <label class="check"><input v-model="hidden" type="checkbox" />Hidden from players</label>
  </FoldPanel>

  <FoldPanel title="What it does" :summary="filled([['Short line', terse], ['Rules text', detail]])" :paths="['terse', 'detail']">
    <Field label="Short line" path="terse">
      <input v-model="terse" type="text" autocomplete="off" />
    </Field>
    <Field block label="Rules text"><RichTextEditor label="Rules text" html v-model="detail" /></Field>
  </FoldPanel>
</template>
