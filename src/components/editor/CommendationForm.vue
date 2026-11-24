<script setup lang="ts">
import { ICON_CHOICES } from '../../commendations'
import { COMMENDATION_DESCRIPTION_MAX, COMMENDATION_NAME_MAX, type Data } from '../../contentEditor'
import Icon from '../Icon.vue'
import Field from './Field.vue'
import { latest, useFields } from './useFields'

// The form for a commendation, an award GMs give pilots: a name, a description and an icon from the site's set.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
const f = useFields(model)
const name = f.text('name')
const description = f.text('description')
const icon = f.text('icon')
</script>

<template>
  <section class="panel">
    <Field label="Name" path="name">
      <input v-model="name" type="text" :maxlength="COMMENDATION_NAME_MAX" autocomplete="off" />
    </Field>
    <Field label="Description" path="description" :hint="`${description.length} of ${COMMENDATION_DESCRIPTION_MAX}.`">
      <textarea v-model="description" rows="3" :maxlength="COMMENDATION_DESCRIPTION_MAX"></textarea>
    </Field>
    <Field block label="Icon" path="icon">
      <div class="icons" role="radiogroup" aria-label="Icon">
        <label v-for="option in ICON_CHOICES" :key="option" class="icon-option">
          <input v-model="icon" type="radio" name="commendation-icon" :value="option" />
          <span class="tile"><Icon :name="option" /></span>
          <span class="sr-only">{{ option }}</span>
        </label>
      </div>
    </Field>
  </section>
</template>

<style scoped>
textarea {
  width: 100%;
  resize: vertical;
}

.icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
  gap: var(--space-s);
}

/* A real radio input, hidden but focusable; its tile shows the choice (a thicker outline, never colour alone). */
.icon-option {
  position: relative;
  display: block;
}

.icon-option input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.tile {
  display: grid;
  place-items: center;
  min-height: var(--tap);
  aspect-ratio: 1;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--raised);
  color: var(--text-dim);
  font-size: 1.5rem;
}

.icon-option:hover .tile {
  border-color: var(--edge);
  color: var(--text);
}

.icon-option input:checked + .tile {
  border: 2px solid var(--lilac);
  color: var(--text);
}

.icon-option input:focus-visible + .tile {
  outline: 2px solid var(--lilac);
  outline-offset: 2px;
}
</style>
