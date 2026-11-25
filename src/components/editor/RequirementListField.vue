<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { itemMakerId, useManufacturers } from '../../archive'
import { REQUIREMENT_LABELS } from '../../contentEditor'
import { loadList, type ListRow } from '../../editorStore'
import { REQUIREMENT_KINDS, useGameData, type Requirement } from '../../gameData'
import { licensedFrames, useMechData } from '../../mechData'
import { makerGroup, type PickOption } from '../../pickerRows'
import { rankName } from '../../rules'
import Icon from '../Icon.vue'
import ItemPicker from '../ItemPicker.vue'
import FieldError from './FieldError.vue'
import { latest, useProblems } from './useFields'

// What an item needs before it can be used (src/rules.ts unmetRequirements): a talent or licence rank, a core bonus or
// another item. Each row is a kind, a pick from a searchable list and, for talents and licences, a rank.
type Row = { kind: Requirement['kind']; id: string; rank?: number }
const modelProp = defineModel<Row[]>({ required: true })
const model = latest(modelProp)
const { invalid } = useProblems()
const { talents, coreBonuses, gear } = useGameData()
const { frames, weapons, systems, mods } = useMechData()
const makers = useManufacturers()
const picker = useTemplateRef('picker')
const picking = ref(0)
// Hidden commendations are listed too (flagged): a requirement may name a hidden award.
const commendations = shallowRef<ListRow[]>([])
onMounted(async () => { commendations.value = (await loadList('commendations')).rows })

const ARTICLE: Record<Row['kind'], string> = { talent: 'a talent', licence: 'a licence', core_bonus: 'a core bonus', item: 'an item', commendation: 'a commendation' }
const EMPTY: Record<Row['kind'], string> = { talent: 'No talents.', licence: 'No licences.', core_bonus: 'No core bonuses.', item: 'No items.', commendation: 'No commendations.' }
const options = computed<Record<Row['kind'], PickOption[]>>(() => ({
  talent: talents.value.map((talent) => ({ id: talent.id, name: talent.name })),
  licence: licensedFrames(frames.value).map((frame) => ({ id: frame.id, name: frame.name, group: makerGroup(frame.source, makers.value) })),
  core_bonus: coreBonuses.value.map((bonus) => ({ id: bonus.id, name: bonus.name, group: makerGroup(bonus.source, makers.value) })),
  commendation: commendations.value.map((award) => ({ id: award.key, name: award.name, meta: award.hidden ? 'Hidden' : '' })),
  item: [
    ...[...weapons.value, ...systems.value, ...mods.value].map((item) => ({ id: item.id, name: item.name, meta: [item.mount, item.type].filter(Boolean).join(' '), group: makerGroup(itemMakerId(item), makers.value) })),
    ...gear.value.map((item) => ({ id: item.id, name: item.name, meta: item.type })),
  ],
}))
const nameOf = (row: Row) => (row.id ? options.value[row.kind].find((option) => option.id === row.id)?.name ?? `Unknown item (${row.id})` : '')
const hasRank = (row: Row) => row.kind === 'talent' || row.kind === 'licence'

const change = (index: number, changes: Partial<Row>) => (model.value = model.value.map((row, i) => (i === index ? { ...row, ...changes } : row)))
const setKind = (index: number, kind: Row['kind']) => (model.value = model.value.map((row, i) => (i === index ? { kind, id: '', ...(kind === 'talent' || kind === 'licence' ? { rank: row.rank ?? 1 } : {}) } : row)))
const open = (index: number) => { picking.value = index; picker.value?.open() }
const add = () => { model.value = [...model.value, { kind: 'talent', id: '', rank: 1 }]; open(model.value.length - 1) }
const choose = (id: string) => { change(picking.value, { id }); picker.value?.close() }
</script>

<template>
  <div class="rows-in">
    <ul v-if="model.length" class="rows">
      <li v-for="(row, index) in model" :key="index" class="entry">
        <div class="line">
          <select :value="row.kind" :aria-label="`Requirement ${index + 1} kind`" @change="setKind(index, ($event.target as HTMLSelectElement).value as Row['kind'])">
            <option v-for="kind in REQUIREMENT_KINDS" :key="kind" :value="kind">{{ REQUIREMENT_LABELS[kind] }}</option>
          </select>
          <button type="button" class="pick" :aria-label="`Requirement ${index + 1}: ${nameOf(row) || 'none chosen'}`" :aria-invalid="invalid(`requires.${index}.id`) || undefined" @click="open(index)">
            <span>{{ nameOf(row) || 'Choose…' }}</span><Icon name="chevron-down" />
          </button>
          <select v-if="hasRank(row)" :value="row.rank ?? 1" :aria-label="`Requirement ${index + 1} rank`" :aria-invalid="invalid(`requires.${index}.rank`) || undefined" @change="change(index, { rank: Number(($event.target as HTMLSelectElement).value) })">
            <option v-for="rank in [1, 2, 3]" :key="rank" :value="rank">{{ rankName(rank) }}</option>
          </select>
          <span v-else></span>
          <button type="button" class="icon-btn remove" :aria-label="`Remove requirement ${index + 1}`" @click="model = model.filter((_, i) => i !== index)"><Icon name="close" /></button>
        </div>
        <FieldError :path="`requires.${index}`" deep />
      </li>
    </ul>
    <div><button type="button" class="small" @click="add"><Icon name="plus" />Add requirement</button></div>
    <ItemPicker ref="picker" :title="`Choose ${ARTICLE[model[picking]?.kind ?? 'talent']}`" :options="options[model[picking]?.kind ?? 'talent']" :current="model[picking]?.id" :empty="EMPTY[model[picking]?.kind ?? 'talent']" @choose="choose" />
  </div>
</template>

<style scoped>
.rows-in { display: grid; gap: var(--space-s); }
.rows { display: grid; gap: var(--space-s); margin: 0; padding: 0; list-style: none; }
.entry { display: grid; gap: var(--space-s); }
.line { display: grid; grid-template-columns: 9rem minmax(0, 1fr) 5rem auto; gap: var(--space-s); align-items: center; }
.pick { justify-content: space-between; min-width: 0; text-align: left; }
.pick span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick .icon { flex: none; width: 16px; height: 16px; color: var(--text-dim); }
@media (max-width: 40rem) {
  .line { grid-template-columns: minmax(0, 1fr) minmax(0, 5rem) auto; }
  .line > .pick { grid-column: 1 / 4; grid-row: 2; }
  .line > select:first-child { grid-column: 1; grid-row: 1; }
  .line > select:nth-of-type(2), .line > span { grid-column: 2; grid-row: 1; }
  .line .icon-btn { grid-column: 3; grid-row: 1; }
}
</style>
