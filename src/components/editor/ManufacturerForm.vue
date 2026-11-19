<script setup lang="ts">
import { LOGO_NAMES } from '../../archive'
import type { Data } from '../../contentEditor'
import RichTextEditor from '../RichTextEditor.vue'
import ColourField from './ColourField.vue'
import Field from './Field.vue'
import { latest, useFields } from './useFields'

// The form for a manufacturer: its name, its short code (the id items use to say who made them, typed when you make
// it and fixed after), its two colours (plain hex; "main" is the one the site draws), a logo from the bundled ones
// (homebrew has none of its own), its motto and its description. The preview beside it is the full information.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ locked: boolean }>()
const f = useFields(model)
const name = f.text('name')
const id = f.text('id')
const dark = f.text('dark')
const light = f.text('light')
const logo = f.text('logo')
const quote = f.text('quote')
const description = f.text('description')
</script>

<template>
  <section class="panel" aria-labelledby="maker-basics">
    <h3 id="maker-basics" class="sheet-label">Basics</h3>
    <div class="grid">
      <Field class="span2" label="Name" path="name"><input v-model="name" type="text" autocomplete="off" placeholder="Corvid Heavy Industries" /></Field>
      <Field
        class="span2"
        label="ID"
        path="id"
        :hint="locked ? 'Fixed once created.' : 'A short code, like CHI. Fixed once created.'"
      >
        <input v-if="locked" class="code" :value="id" type="text" readonly />
        <input v-else v-model="id" class="code" type="text" autocomplete="off" spellcheck="false" placeholder="CHI" />
      </Field>
      <Field class="span2" label="Logo" >
        <select v-model="logo">
          <option value="">None</option>
          <option v-if="logo && !LOGO_NAMES.includes(logo)" :value="logo">{{ logo }}</option>
          <option v-for="option in LOGO_NAMES" :key="option" :value="option">{{ option }}</option>
        </select>
      </Field>
    </div>
  </section>

  <section class="panel" aria-labelledby="maker-colours">
    <h3 id="maker-colours" class="sheet-label">Colours</h3>
    <div class="grid">
      <Field class="span2" label="Main colour" path="dark" hint="Used for the logo and card border.">
        <ColourField v-model="dark" label="Main colour" />
      </Field>
      <Field class="span2" label="Darker colour" path="light" hint="Optional.">
        <ColourField v-model="light" label="Darker colour" />
      </Field>
    </div>
  </section>

  <section class="panel" aria-labelledby="maker-text">
    <h3 id="maker-text" class="sheet-label">Text</h3>
    <Field block label="Motto"><RichTextEditor label="Motto" html basic v-model="quote" /></Field>
    <Field block label="Description"><RichTextEditor label="Description" html basic v-model="description" /></Field>
  </section>
</template>
