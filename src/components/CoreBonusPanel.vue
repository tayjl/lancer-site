<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { confirmAction } from '../confirm'
import { sourceOf, type CoreBonus } from '../gameData'
import type { Frame } from '../mechData'
import { coreBonusProblems, isExotic, restrictionOf } from '../rules'
import { useGmOverride, useRestriction } from '../restriction'
import { plainText } from '../rulesText'
import { bonusStats, makerGroup } from '../pickerRows'
import { useManufacturers } from '../archive'
import { plural } from '../text'
import { coreBonusInfo } from '../info'
import ItemCard from './ItemCard.vue'
import ItemPicker from './ItemPicker.vue'
import RulesText from './RulesText.vue'

// Core bonuses (homebrew; src/rules.ts): free, one for every 3 licence ranks bought ("picks"). A card per one
// taken (lime, dark text), the picks used in the heading, and the empty state for the next pick: a button while picks
// are left, otherwise how many licence ranks give the next one (every 3: coreBonusPicks in rules.ts).
const props = defineProps<{
  options: CoreBonus[]
  taken: string[]
  picks: number
  licences: Record<string, number>
  talents?: Record<string, number>
  // What a bonus still needs ("Needs Brawler II"), or ''.
  needs?: (bonus: CoreBonus) => string
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
  try {
    error.value = (await props.save(ids)) ?? ''
  } finally {
    saving.value = false
  }
  return !error.value
}

async function remove(id: string) {
  if (await confirmAction(`Remove ${byId.value.get(id)?.name ?? id}? It frees a core bonus pick.`, { confirmLabel: 'Remove core bonus', danger: true }))
    store(props.taken.filter((other) => other !== id))
}

const picker = useTemplateRef('picker')
// HORUS and NHC bonuses are GM-only (blocked for players), Exotic ones GM-edit-only; both listed last.
const reasonFor = useRestriction()
const gmOverride = useGmOverride()
const blocked = (id: string) =>
  reasonFor(restrictionOf(byId.value.get(id) ?? {})) ||
  (gmOverride.value
    ? ''
    : (byId.value.get(id) && props.needs?.(byId.value.get(id)!)) ||
      (coreBonusProblems({ licences: props.licences, talents: props.talents, core_bonuses: [...props.taken, id] }, props.frames, props.options)[0] ?? '').replace(/\.$/, ''))
// Listed by manufacturer, each with the permanent numbers it adds; what it needs is the blocked reason beside the button.
const manufacturers = useManufacturers()
const offered = computed(() =>
  props.options
    .filter((bonus) => !props.taken.includes(bonus.id) && !bonus.hidden)
    .map((bonus) => {
      return {
        id: bonus.id,
        name: bonus.name,
        look: { type: 'core' as const, icon: 'corebonus' },
        stats: bonusStats(bonus.bonuses),
        group: makerGroup(bonus.source, manufacturers.value),
        search: plainText(bonus.effect),
        blocked: blocked(bonus.id),
        exotic: isExotic(bonus),
        info: () => coreBonusInfo(bonus),
      }
    }),
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
      <h2 class="sheet-label">Core bonuses</h2>
      <span class="meter-inline" :class="{ over: left < 0 }"><span class="num">{{ taken.length }}</span> of <span class="num">{{ picks }}</span> picks used</span>
    </header>
    <p v-if="editable" class="dim note">One pick per 3 licence ranks. Non-GMS bonuses also need 3 ranks with their manufacturer.</p>

    <ul v-if="taken.length || editable" class="slot-grid">
      <li v-for="id in taken" :key="id">
        <ItemCard type="core" icon="corebonus" :name="byId.get(id)?.name ?? id" :info="byId.get(id) ? () => coreBonusInfo(byId.get(id)!) : undefined" :meta="byId.get(id)?.source" :source="sourceOf(id)">
          <RulesText :html="byId.get(id)?.effect ?? ''" />
          <template v-if="editable" #foot>
            <button type="button" class="small quiet" :disabled="saving" @click="remove(id)">Remove</button>
          </template>
        </ItemCard>
      </li>
      <li v-if="editable" class="empty">
        <template v-if="left > 0 || gmOverride">
          <p v-if="left > 0">{{ plural(left, 'pick') }} left.</p>
          <button type="button" class="small" :disabled="saving" @click="open">Add core bonus</button>
        </template>
        <p v-else>Next pick at <span class="num">{{ (picks + 1) * 3 }}</span> licence ranks.</p>
      </li>
    </ul>
    <p v-else class="empty">No core bonuses.</p>

    <p v-if="error" class="notice warn note" role="alert">Not saved: {{ error }}</p>

    <ItemPicker ref="picker" title="Choose a core bonus" :options="offered" :saving="saving" :error="error" @choose="choose" />
  </section>
</template>

<style scoped>
.note {
  margin: 0 0 var(--space-m);
  font-size: var(--fs-s);
}

.empty p {
  margin: 0;
}
</style>
