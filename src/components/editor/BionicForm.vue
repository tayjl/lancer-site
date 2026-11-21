<script setup lang="ts">
import { computed, useId } from 'vue'
import { BIONIC_SLOTS, bonusTypesFor, type Data } from '../../contentEditor'
import { useGameData } from '../../gameData'
import { plural } from '../../text'
import Icon from '../Icon.vue'
import RichTextEditor from '../RichTextEditor.vue'
import BonusListField from './BonusListField.vue'
import Field from './Field.vue'
import FieldError from './FieldError.vue'
import FoldPanel from './FoldPanel.vue'
import GrantFields from './GrantFields.vue'
import RequirementListField from './RequirementListField.vue'
import { filled, latest, list, useFields, useProblems } from './useFields'

// The form for a biomod (a site table, not pack content): its slot on the body, its own price in manna, the mod points it
// takes, the personal stats it changes, and its description (flavour) and effect (rules). "Retired" takes it off the list
// pilots choose from; pilots who have it keep it.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
const props = defineProps<{ stats: { id: string; name: string }[]; manufacturers: { id: string; name: string }[] }>()
const f = useFields(model)
const { invalid } = useProblems()
const name = f.text('name')
const description = f.text('description')
const slot = f.text('slot')
const source = f.text('source')
const price = f.number('manna_cost')
const effect = f.text('effect')
const cost = f.number('mod_point_cost')
// The usual slots, then any the campaign has made up.
const listId = useId()
const { bionics } = useGameData()
const slots = computed(() => [...new Set([...BIONIC_SLOTS, ...bionics.value.map((bionic) => bionic.slot).filter(Boolean)])])
const retired = f.flag('retired')
const bonuses = f.list<{ stat_id: string; amount: number }>('bonuses')
// The same effects every other kind has (not the personal stats: the stat bonuses above are those).
const effects = f.list<Data>('effect_bonuses')
const effectTypes = bonusTypesFor('bionics', [])
const grants = computed(() => list<string>(model.value.integrated).length + list<string>(model.value.special_equipment).length)
const requires = f.list<{ kind: 'talent' | 'licence' | 'core_bonus' | 'item'; id: string; rank?: number }>('requires')

const taken = (stat: string) => bonuses.value.some((bonus) => bonus.stat_id === stat)
const change = (index: number, changes: Partial<{ stat_id: string; amount: number }>) =>
  (bonuses.value = bonuses.value.map((bonus, i) => (i === index ? { ...bonus, ...changes } : bonus)))
const add = () => {
  const free = props.stats.find((stat) => !taken(stat.id))
  if (free) bonuses.value = [...bonuses.value, { stat_id: free.id, amount: 1 }]
}
</script>

<template>
  <FoldPanel title="Basics" open :summary="[slot, source, retired ? 'Retired' : ''].filter(Boolean).join(' · ')" :paths="['name', 'slot', 'source', 'manna_cost', 'mod_point_cost']">
    <div class="grid">
      <Field class="span2" label="Name" path="name"><input v-model="name" type="text" autocomplete="off" /></Field>
      <Field class="span2" label="Slot" path="slot" hint="Pick one or type your own.">
        <input v-model="slot" type="text" autocomplete="off" :list="listId" />
        <datalist :id="listId"><option v-for="option in slots" :key="option" :value="option"></option></datalist>
      </Field>
      <Field class="span2" label="Manufacturer" path="source" hint="HORUS, NHC and Exotic biomods are GM-only.">
        <select v-model="source">
          <option value="">None</option>
          <option v-if="source && !manufacturers.some((maker) => maker.id === source)" :value="source">{{ source }}</option>
          <option v-for="maker in manufacturers" :key="maker.id" :value="maker.id">{{ maker.id }}{{ maker.name !== maker.id ? ` · ${maker.name}` : '' }}</option>
        </select>
      </Field>
      <Field class="span2" label="Price (manna)" path="manna_cost"><input v-model="price" type="number" min="0" step="1" /></Field>
      <Field class="span2" label="Mod points" path="mod_point_cost"><input v-model="cost" type="number" min="0" step="1" /></Field>
    </div>
    <label class="check"><input v-model="retired" type="checkbox" />Retired. Pilots who have it keep it.</label>
  </FoldPanel>

  <FoldPanel title="Stat bonuses" :summary="plural(bonuses.length, 'bonus', 'bonuses')" :paths="['bonuses']">
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
    <p v-else class="hint">Use a negative number for a drawback.</p>
    <div><button type="button" class="small" :disabled="bonuses.length >= stats.length" @click="add"><Icon name="plus" />Add bonus</button></div>
  </FoldPanel>

  <FoldPanel title="Effects" :summary="effects.length ? plural(effects.length, 'effect') : 'Empty'" :paths="['effect_bonuses']">
    <BonusListField v-model="effects" :types="effectTypes" path="effect_bonuses" />
  </FoldPanel>

  <FoldPanel title="Equipment" :summary="grants ? plural(grants, 'item') : 'Empty'" :paths="['integrated', 'special_equipment', 'replace_integrated']">
    <GrantFields :data="model" owner="Biomod" @change="model = { ...model, ...$event }" />
  </FoldPanel>

  <FoldPanel title="Text" :summary="filled([['Description', description], ['Effect', effect]])" :paths="['description', 'effect']">
    <Field label="Description" hint="Flavour text.">
      <textarea v-model="description" rows="4"></textarea>
    </Field>
    <Field block label="Effect"><RichTextEditor label="Effect" html v-model="effect" /></Field>
  </FoldPanel>

  <FoldPanel title="Requirements" :summary="plural(requires.length, 'requirement')" :paths="['requires']">
    <RequirementListField v-model="requires" />
  </FoldPanel>
</template>

<style scoped>
.rows { display: grid; gap: var(--space-s); margin: 0; padding: 0; list-style: none; }
.entry { display: grid; grid-template-columns: minmax(0, 14rem) 7rem auto; gap: var(--space-s); align-items: center; }
.entry input { font-family: var(--mono); }
.hint { margin: 0; }
textarea { width: 100%; resize: vertical; }
</style>
