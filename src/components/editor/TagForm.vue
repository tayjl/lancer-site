<script setup lang="ts">
import type { Data } from '../../contentEditor'
import RichTextEditor from '../RichTextEditor.vue'
import Field from './Field.vue'
import FoldPanel from './FoldPanel.vue'
import { filled, latest, useFields } from './useFields'

// The form for a tag (like "Limited {VAL}"): its name, what it means and whether it's hidden. A "{VAL}" in the name
// is where an item's number goes, and makes the tag ask for one.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ locked: boolean }>()
const f = useFields(model)
const name = f.text('name')
const description = f.text('description')
const hidden = f.flag('hidden')
</script>

<template>
  <FoldPanel title="Basics" open :summary="hidden ? 'Hidden from players' : 'Shown to players'" :paths="['name', 'id']">
    <div class="grid">
      <Field class="span2" label="Name" path="name" hint="Use {VAL} for the number, as in &quot;Limited {VAL}&quot;.">
        <input v-model="name" type="text" autocomplete="off" />
      </Field>
      <Field class="span2" label="ID" path="id" :hint="locked ? 'Fixed once created.' : 'Made from the name.'">
        <input class="code" :value="String(model.id ?? '')" type="text" readonly />
      </Field>
    </div>
    <label class="check"><input v-model="hidden" type="checkbox" />Hidden from players</label>
  </FoldPanel>

  <FoldPanel title="What it means" :summary="filled([['Rules text', description]])" :paths="['description']">
    <RichTextEditor label="What the tag means" html basic v-model="description" />
  </FoldPanel>
</template>
