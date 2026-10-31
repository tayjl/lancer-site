<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { CoreBonus } from '../gameData'
import type { Frame } from '../mechData'
import { coreBonusProblems } from '../rules'
import { plainText } from '../rulesText'
import { coreBonusInfo } from '../info'
import InfoButton from './InfoButton.vue'
import ItemPicker from './ItemPicker.vue'
import RulesText from './RulesText.vue'
import SlotCard from './SlotCard.vue'

// Core bonuses (homebrew; src/rules.ts): free, one for every 3 licence ranks bought ("picks"). A card per one
// taken, and a card to choose another while picks are left.
const props = defineProps<{
  options: CoreBonus[]
  taken: string[]
  picks: number
  licences: Record<string, number>
  frames: Frame[]
  editable: boolean
  save: (ids: string[]) => Promise<string | null>
}>()

const byId = computed(() => new Map(props.options.map((bonus) => [bonus.id, bonus])))
const left = computed(() => props.picks - props.taken.length)

const error = ref('')
const saving = ref(false)

async function store(ids: string[]) {
  saving.value = true
  error.value = (await props.save(ids)) ?? ''
  saving.value = false
  return !error.value
}

function remove(id: string) {
  if (window.confirm(`remove ${byId.value.get(id)?.name ?? id}?`)) store(props.taken.filter((other) => other !== id))
}

const picker = useTemplateRef('picker')
const blocked = (id: string) => coreBonusProblems(
  { licences: props.licences, core_bonuses: [...props.taken, id] }, props.frames, props.options,
)[0] ?? ''
const offered = computed(() =>
  props.options
    .filter((bonus) => !props.taken.includes(bonus.id))
    .map((bonus) => ({ id: bonus.id, name: bonus.name, meta: bonus.source.toLowerCase(), text: plainText(bonus.effect), blocked: blocked(bonus.id), info: () => coreBonusInfo(bonus) })),
)

function open() {
  error.value = ''
  picker.value?.open()
}

async function choose(id: string) {
  if (!props.editable || saving.value) return
  error.value = blocked(id)
  if (error.value) return
  if (await store([...props.taken, id])) picker.value?.close()
}
</script>

<template>
  <section class="core-bonuses">
    <header class="head sheet-head">
      <h2 class="sheet-label">core bonuses<span class="tag"> private</span></h2>
      <span class="dim" :class="{ rose: left < 0 }">{{ taken.length }}/{{ picks }} taken<template v-if="editable">, one free per 3 licence ranks</template></span>
    </header>
    <p v-if="editable" class="dim note">each non-GMS bonus needs another 3 licence ranks from its manufacturer.</p>

    <ul v-if="taken.length || (editable && left > 0)" class="slot-grid">
      <SlotCard v-for="id in taken" :key="id" :title="byId.get(id)?.source.toLowerCase() || 'core bonus'">
        <template v-if="editable" #tools>
          <button type="button" :disabled="saving" @click="remove(id)">remove</button>
        </template>
        <p class="name"><InfoButton v-if="byId.get(id)" :info="() => coreBonusInfo(byId.get(id)!)" :label="byId.get(id)!.name" /><template v-else>{{ id }}</template></p>
        <RulesText :html="byId.get(id)?.effect ?? ''" />
      </SlotCard>
      <SlotCard v-if="editable && left > 0" title="new core bonus" empty>
        <template #tools>
          <button type="button" :disabled="saving" @click="open">choose</button>
        </template>
      </SlotCard>
    </ul>
    <p v-else class="dim note">none{{ editable ? ' yet: every 3 licence ranks give one.' : '.' }}</p>

    <p v-if="error" class="rose note" role="alert">not saved: {{ error }}</p>

    <ItemPicker ref="picker" title="choose a core bonus" :options="offered" :saving="saving" :error="error" @choose="choose" />
  </section>
</template>

<style scoped>
.core-bonuses {
  container-type: inline-size;
}

.slot-grid {
  grid-template-columns: minmax(0, 1fr);
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 1.5rem;
  font-size: 0.8125rem;
}

.name {
  margin: 0;
  color: var(--lilac);
  font-weight: 700;
}

.note {
  margin: 0.6rem 0 0;
  font-size: 0.8125rem;
}
</style>
