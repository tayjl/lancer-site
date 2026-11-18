<script setup lang="ts">
import type { Data } from '../../contentEditor'
import Icon from '../Icon.vue'
import Field from './Field.vue'
import FieldError from './FieldError.vue'
import { latest, useFields, useProblems } from './useFields'

// The form for a bionic (a site table, not pack content): its description, the mod points it takes, and the personal
// stats it changes. Every bionic costs the same manna (src/rules.ts PRICES), so there's no price here. "Retired" takes it
// off the list pilots choose from; pilots who have it keep it.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
const props = defineProps<{ stats: { id: string; name: string }[] }>()
const f = useFields(model)
const { invalid } = useProblems()
const name = f.text('name')
const description = f.text('description')
const cost = f.number('mod_point_cost')
const retired = f.flag('retired')
const bonuses = f.list<{ stat_id: string; amount: number }>('bonuses')

const taken = (stat: string) => bonuses.value.some((bonus) => bonus.stat_id === stat)
const change = (index: number, changes: Partial<{ stat_id: string; amount: number }>) =>
  (bonuses.value = bonuses.value.map((bonus, i) => (i === index ? { ...bonus, ...changes } : bonus)))
const add = () => {
  const free = props.stats.find((stat) => !taken(stat.id))
  if (free) bonuses.value = [...bonuses.value, { stat_id: free.id, amount: 1 }]
}
</script>

<template>
  <section class="panel" aria-labelledby="bio-basics">
    <h3 id="bio-basics" class="sheet-label">Basics</h3>
    <div class="grid">
      <Field class="span2" label="Name" path="name"><input v-model="name" type="text" autocomplete="off" /></Field>
      <Field class="span2" label="Mod points" path="mod_point_cost"><input v-model="cost" type="number" min="0" step="1" /></Field>
    </div>
    <label class="field">
      <span>Description</span>
      <textarea v-model="description" rows="4"></textarea>
    </label>
    <label class="check"><input v-model="retired" type="checkbox" />Retired: no longer offered. Pilots who have it keep it.</label>
  </section>

  <section class="panel" aria-labelledby="bio-bonuses">
    <h3 id="bio-bonuses" class="sheet-label">Stat bonuses</h3>
    <ul v-if="bonuses.length" class="rows">
      <li v-for="(bonus, index) in bonuses" :key="index" class="entry">
        <select :value="bonus.stat_id" :aria-label="`Bonus ${index + 1} stat`" :aria-invalid="invalid(`bonuses.${index}.stat_id`) || undefined" @change="change(index, { stat_id: ($event.target as HTMLSelectElement).value })">
          <option v-if="!stats.some((stat) => stat.id === bonus.stat_id)" :value="bonus.stat_id">{{ bonus.stat_id }}</option>
          <option v-for="stat in stats" :key="stat.id" :value="stat.id" :disabled="stat.id !== bonus.stat_id && taken(stat.id)">{{ stat.name }}</option>
        </select>
        <input type="number" step="1" :value="bonus.amount" :aria-label="`Bonus ${index + 1} amount`" :aria-invalid="invalid(`bonuses.${index}.amount`) || undefined" @input="change(index, { amount: Number(($event.target as HTMLInputElement).value) })" />
        <button type="button" class="icon-btn remove" :aria-label="`Remove bonus ${index + 1}`" @click="bonuses = bonuses.filter((_, i) => i !== index)"><Icon name="close" /></button>
        <FieldError :path="`bonuses.${index}`" deep />
      </li>
    </ul>
    <p v-else class="hint">No bonuses. Use a negative number for a drawback.</p>
    <div><button type="button" class="small" :disabled="bonuses.length >= stats.length" @click="add"><Icon name="plus" />Add bonus</button></div>
  </section>
</template>

<style scoped>
.check { display: inline-flex; align-items: center; gap: 8px; color: var(--text-dim); font-size: var(--fs-s); }
.rows { display: grid; gap: var(--space-s); margin: 0; padding: 0; list-style: none; }
.entry { display: grid; grid-template-columns: minmax(0, 14rem) 7rem auto; gap: var(--space-s); align-items: center; }
.entry input { font-family: var(--mono); }
.hint { margin: 0; }
textarea { width: 100%; resize: vertical; }
</style>
