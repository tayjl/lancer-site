<script setup lang="ts">
import type { Data } from '../../contentEditor'
import RichTextEditor from '../RichTextEditor.vue'
import Field from './Field.vue'
import { latest, useFields } from './useFields'

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
  <section class="panel" aria-labelledby="tag-basics">
    <h3 id="tag-basics" class="sheet-label">Basics</h3>
    <div class="grid">
      <Field class="span2" label="Name" path="name" hint="Write {VAL} where the item's number goes, as in &quot;Limited {VAL}&quot;.">
        <input v-model="name" type="text" autocomplete="off" />
      </Field>
      <Field class="span2" label="ID" path="id" :hint="locked ? 'Made when the item was created. It never changes, so pilots keep it if you rename it.' : 'Made from the name until you save it the first time.'">
        <input class="code" :value="String(model.id ?? '')" type="text" readonly />
      </Field>
    </div>
    <label class="check"><input v-model="hidden" type="checkbox" />Hidden: a note for the site, not shown to players</label>
  </section>

  <section class="panel" aria-labelledby="tag-rules">
    <h3 id="tag-rules" class="sheet-label">What it means</h3>
    <RichTextEditor label="What the tag means" html basic v-model="description" />
  </section>
</template>

<style scoped>
.check { display: inline-flex; align-items: center; gap: 8px; color: var(--text-dim); font-size: var(--fs-s); }
</style>
