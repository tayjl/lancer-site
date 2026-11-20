<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fetchAll, supabase } from '../lib/supabaseClient'
import { describeReward } from '../rewards'
import { formatDate } from '../time'
import Icon from './Icon.vue'

// GM only (the database refuses everyone else): a pilot's reward log, newest first. Every change to level, manna received
// or experience is logged by the database, with who made it and an optional reason. "refresh" changes after a save here.
const props = defineProps<{ characterId: number; refresh: number }>()
const SHOWN = 20

type Row = {
  id: number
  field: string
  old_value: number
  new_value: number
  reason: string | null
  changed_at: string
  gm: { display_name: string } | null
}
const rows = ref<Row[]>([])
const loading = ref(true)
const error = ref('')
const all = ref(false)
const shown = computed(() => (all.value ? rows.value : rows.value.slice(0, SHOWN)))

async function load() {
  // Newest first; the identity id is unique, so the pages never repeat or skip a row.
  const result = await fetchAll<Row>((from, to) => supabase
    .from('pilot_reward_log')
    .select('id, field, old_value, new_value, reason, changed_at, gm:profiles(display_name)')
    .eq('character_id', props.characterId)
    .order('id', { ascending: false })
    .range(from, to))
  rows.value = result.rows
  error.value = result.error ?? ''
  loading.value = false
}

watch(() => [props.characterId, props.refresh], load, { immediate: true })
</script>

<template>
  <section aria-labelledby="reward-history-title">
    <h3 id="reward-history-title" class="sheet-label">Reward history<span class="private gm">GM only</span></h3>
    <p v-if="loading" class="dim">Loading…</p>
    <p v-else-if="error" class="notice warn" role="alert">Couldn't load the reward history: {{ error }}</p>
    <p v-else-if="!rows.length" class="empty">No rewards logged yet.</p>
    <template v-else>
      <ul>
        <li v-for="row in shown" :key="row.id">
          <span class="when dim"><span class="num">{{ formatDate(row.changed_at) }}</span> · {{ row.gm?.display_name ?? 'Unknown GM' }}</span>
          <span class="change" :class="describeReward(row).up ? 'up' : 'down'">
            <Icon :name="describeReward(row).up ? 'plus' : 'minus'" />
            <span class="sr-only">{{ describeReward(row).up ? 'Raised' : 'Lowered' }}:</span>
            <span class="num">{{ describeReward(row).text }}</span>
          </span>
          <span v-if="row.reason" class="dim">{{ row.reason }}</span>
        </li>
      </ul>
      <button v-if="!all && rows.length > SHOWN" type="button" class="small quiet" @click="all = true">Show all <span class="num">{{ rows.length }}</span></button>
    </template>
  </section>
</template>

<style scoped>
ul { margin: 0 0 var(--space-s); padding: 0; list-style: none; }
li { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-xs) var(--space-m); padding: var(--space-s) 0; border-top: 1px solid var(--rule); }
li:first-child { border-top: 0; }
.when { flex: 0 0 15rem; font-size: var(--fs-s); }
.change { display: inline-flex; align-items: center; gap: var(--space-xs); font-weight: 700; }
.change.up { color: var(--ok); }
.change.down { color: var(--danger); }
.dim { font-size: var(--fs-s); }
@media (max-width: 35rem) { .when { flex-basis: 100%; } }
</style>
