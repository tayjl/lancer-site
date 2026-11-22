<script setup lang="ts">
import { computed } from 'vue'
import { catalogueError } from '../catalogue'
import { frameInfo } from '../info'
import { half } from '../itemDetails'
import type { Frame } from '../mechData'
import type { PublicMech } from '../pilots'
import Icon from './Icon.vue'
import InfoButton from './InfoButton.vue'

// The combat guide's summary: your mech with its key numbers (in Pilot mode, your pilot with theirs), full width above the turn strip. The numbers sit four to a row at every width, so a
// count that is a multiple of 4 (12 in Mech mode) fills the grid evenly.
type Vital = { id: string; name: string; icon?: string; value: number | null }
const props = defineProps<{
  loading: boolean
  loadError: string | null
  mode: 'mech' | 'pilot'
  pilotName?: string
  hasPilot: boolean
  mechList: PublicMech[]
  mech?: PublicMech
  ready: boolean // the game content has loaded
  frame: Frame | null
  frames: Frame[]
  vitals: Vital[]
}>()
const emit = defineEmits<{ chooseMech: [id: string]; retry: [] }>()
const shown = computed(() => props.vitals.filter((vital) => vital.value !== null))
</script>

<template>
  <aside class="turn" :aria-label="mode === 'pilot' ? 'Your pilot' : 'Your mech'">
    <h2 class="sr-only">{{ mode === 'pilot' ? 'Your pilot' : 'Your mech' }}</h2>
    <div class="turn-mech">
      <p v-if="loading" class="dim" role="status">Loading…</p>
      <template v-else-if="loadError">
        <p class="notice warn" role="alert">Your pilot didn't load: {{ loadError }}</p>
        <button type="button" class="small" @click="emit('retry')">Retry</button>
      </template>
      <p v-else-if="!hasPilot" class="empty">No pilot yet.</p>
      <p v-else-if="mode === 'mech' && !mech" class="empty">No mechs yet.</p>
      <template v-else>
        <div class="mech-pick">
          <p v-if="mode === 'pilot'" class="mech-name">{{ pilotName }}</p>
          <label v-else-if="mech && mechList.length > 1" class="field">
            <span>Mech</span>
            <select :value="mech.id" @change="emit('chooseMech', ($event.target as HTMLSelectElement).value)">
              <option v-for="m in mechList" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </label>
          <p v-else class="mech-name">{{ mech?.name }}</p>
          <template v-if="mode === 'mech'">
            <p v-if="!ready" class="dim frame" role="status">Loading…</p>
            <p v-else-if="frame" class="dim frame">Frame: <InfoButton :info="() => frameInfo(frame!, frames)" :label="`${frame.source} ${frame.name}`" /></p>
            <p v-else-if="!catalogueError" class="dim frame">Choose a frame first.</p>
          </template>
        </div>
        <ul v-if="shown.length" class="vitals" :aria-label="`${mode === 'pilot' ? pilotName : mech?.name}'s stats`">
          <li v-for="vital in shown" :key="vital.id" class="vital">
            <span class="vital-top"><Icon :src="vital.icon" /><span class="num">{{ half(vital.value) }}</span></span>
            <span class="vital-name">{{ vital.name }}</span>
          </li>
        </ul>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.turn,
.turn-mech {
  display: grid;
  align-content: start;
  gap: var(--space-m);
  min-width: 0;
}

.mech-pick {
  display: grid;
  gap: var(--space-xs);
}

.mech-name {
  margin: 0;
  font-size: var(--fs-l);
  font-weight: 700;
}

.frame {
  margin: 0;
  font-size: var(--fs-s);
}

.frame :deep(.info-link) {
  color: var(--text);
}

@media (pointer: coarse) {
  .frame :deep(.info-link) {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
}

/* The key numbers: four to a row at every width. */
.vitals {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-rows: 1fr; /* a label that wraps on a narrow phone makes every row the same height */
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A lone tile on the last row (Pilot mode's Grit) sits centred, one tile wide. */
.vital:last-child:nth-child(4n + 1) {
  grid-column: 1 / -1;
  justify-self: center;
  width: calc(25% - 4.5px);
}

.vital {
  display: grid;
  align-content: start;
  justify-items: center;
  gap: 2px;
  padding: var(--space-s) 2px;
  border-radius: var(--radius);
  background: var(--panel);
  box-shadow: inset 0 3px var(--edge);
  text-align: center;
}

.vital-top {
  display: flex;
  align-items: center;
  gap: 4px;
}

.vital-top .icon {
  width: 16px;
  height: 16px;
  color: var(--text-dim);
}

.vital .num {
  font-size: var(--fs-l);
  font-weight: 700;
  line-height: 1.2;
}

.vital-name {
  color: var(--text-dim);
  font: 700 var(--fs-xs) / 1.2 var(--sans);
  text-transform: uppercase;
}
</style>
