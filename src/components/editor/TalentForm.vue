<script setup lang="ts">
import { RANK_NAMES, type BonusType, type Data } from '../../contentEditor'
import RichTextEditor from '../RichTextEditor.vue'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import Field from './Field.vue'
import FieldError from './FieldError.vue'
import ItemIdListField from './ItemIdListField.vue'
import RepeatList from './RepeatList.vue'
import { latest, useEquipmentOptions, useFields } from './useFields'

// The form for a talent: its name and summary, and exactly three ranks (I, II, III). A rank has a name, its rules, any
// actions and bonuses, and the weapons or systems it grants: "built in" ones appear on the pilot's mech by themselves
// (and "replaces the lower rank's" makes the highest owned rank's the only one), "may take" ones the pilot can choose
// to equip (src/mechData.ts). A rank's synergies are kept as they are.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ bonusTypes: BonusType[]; locked: boolean }>()
const f = useFields(model)
const name = f.text('name')
const terse = f.text('terse')
const description = f.text('description')
const ranks = f.list<Data>('ranks')

const equipment = useEquipmentOptions()

const list = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : [])
const input = (event: Event) => (event.target as HTMLInputElement).value
const clean = <T,>(value: T[]) => (value.length ? value : undefined)
const roman = (index: number) => RANK_NAMES[index] ?? String(index + 1)
// A talent with more or fewer than three ranks can't be edited rank by rank: this puts it right.
const fixRanks = () => (ranks.value = RANK_NAMES.map((_, index) => ranks.value[index] ?? { name: '', description: '' }))
</script>

<template>
  <section class="panel" aria-labelledby="talent-basics">
    <h3 id="talent-basics" class="sheet-label">Basics</h3>
    <div class="grid">
      <Field class="span2" label="Name" path="name"><input v-model="name" type="text" autocomplete="off" /></Field>
      <Field
        class="span2"
        label="ID"
        path="id"
        :hint="locked ? 'Made when the item was created. It never changes, so pilots keep it if you rename it.' : 'Made from the name until you save it the first time.'"
      >
        <input class="code" :value="String(model.id ?? '')" type="text" readonly />
      </Field>
    </div>
    <Field label="Summary" hint="One line, shown in lists: what the talent is for.">
      <input v-model="terse" type="text" autocomplete="off" />
    </Field>
    <Field block label="Description" hint="Flavour text.">
      <RichTextEditor label="Description" html basic v-model="description" />
    </Field>
  </section>

  <section class="panel" aria-labelledby="talent-ranks">
    <h3 id="talent-ranks" class="sheet-label">Ranks</h3>
    <div v-if="ranks.length !== RANK_NAMES.length" class="notice warn" role="alert">
      <div class="notice-head">
        <p class="notice-title">This talent has {{ ranks.length }} {{ ranks.length === 1 ? 'rank' : 'ranks' }}, not three.</p>
        <button type="button" class="small" @click="fixRanks">Make it three ranks</button>
      </div>
    </div>
    <FieldError path="ranks" />
    <RepeatList v-model="ranks" noun="rank" path="ranks" fixed :make="() => ({ name: '', description: '' })">
      <template #title="{ item, index }">Rank {{ roman(index) }}<span v-if="item.name" class="dim"> · {{ item.name }}</span></template>
      <template #summary="{ item }">{{ [list(item.actions).length ? `${list(item.actions).length} action(s)` : '', list(item.integrated).length || list(item.special_equipment).length ? 'Grants equipment' : ''].filter(Boolean).join(' · ') }}</template>
      <template #default="{ item, index, change }">
        <Field label="Rank name" :path="`ranks.${index}.name`">
          <input type="text" :value="item.name" autocomplete="off" @input="change({ name: input($event) })" />
        </Field>
        <Field block label="Rules text">
          <RichTextEditor :label="`Rank ${roman(index)} rules text`" html basic :model-value="String(item.description ?? '')" @update:model-value="change({ description: $event })" />
        </Field>
        <Field block label="Actions">
          <ActionListField :model-value="list<Data>(item.actions)" :path="`ranks.${index}.actions`" @update:model-value="change({ actions: clean($event) })" />
        </Field>
        <Field block label="Bonuses">
          <BonusListField :model-value="list<Data>(item.bonuses)" :types="bonusTypes" :path="`ranks.${index}.bonuses`" @update:model-value="change({ bonuses: clean($event) })" />
        </Field>
        <Field block label="Built in" :path="`ranks.${index}.integrated`" hint="Equipment the pilot's mech gets for free with this rank, with no mount needed.">
          <ItemIdListField :model-value="list<string>(item.integrated)" :items="equipment" :label="`Rank ${roman(index)} built-in equipment`" add="Add built-in equipment" @update:model-value="change({ integrated: clean($event) })" />
        </Field>
        <Field block label="May take" :path="`ranks.${index}.special_equipment`" hint="Special equipment the pilot may choose to add once they have this rank.">
          <ItemIdListField :model-value="list<string>(item.special_equipment)" :items="equipment" :label="`Rank ${roman(index)} optional equipment`" add="Add optional equipment" @update:model-value="change({ special_equipment: clean($event) })" />
        </Field>
        <label class="check">
          <input type="checkbox" :checked="item.exclusive === true" @change="change({ exclusive: ($event.target as HTMLInputElement).checked || undefined })" />
          Replaces the lower ranks' built-in equipment: only the highest rank the pilot has applies
        </label>
      </template>
    </RepeatList>
  </section>
</template>

<style scoped>
.check { display: inline-flex; align-items: center; gap: 8px; color: var(--text-dim); font-size: var(--fs-s); }
</style>
