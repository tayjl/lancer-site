<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { isGm, profile } from '../auth'
import Icon from '../components/Icon.vue'
import PageHeader from '../components/PageHeader.vue'
import ReviewQueue from '../components/ReviewQueue.vue'
import type { PublicPilot } from '../pilots'
import { supabase } from '../lib/supabaseClient'
import type { Sheet } from '../myPilot'
import { licenceLevel, mannaSpent } from '../rules'

// Waiting pilots are ordered by submission time. The searchable roster includes every pilot,
// including sent-back and dead records. GM edits save directly; database policies enforce the role.
type Pilot = PublicPilot & {
  sheet: { review_note: string | null; level: number; manna: number; sheet: unknown } | null
}

const items = shallowRef<Pilot[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const waiting = computed(() => items.value.filter((item) => item.status === 'pending' && !item.sheet?.review_note))
const queueCards = computed(() => waiting.value.map(pilot => ({
  id: pilot.id, callsign: pilot.callsign, name: pilot.pilot_name, image: pilot.pilot_image,
  player: pilot.player?.display_name ?? '-', submittedAt: pilot.created_at,
  to: { name: 'gm-review', params: { id: pilot.id } },
})))
const roster = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return items.value
    .filter((pilot) => [pilot.callsign, pilot.pilot_name, pilot.player?.display_name].some((name) => name?.toLocaleLowerCase().includes(query)))
    .sort((a, b) => (a.callsign || a.pilot_name).localeCompare(b.callsign || b.pilot_name))
})

async function load() {
  loading.value = true
  const { data, error: loadError } = await supabase
    .from('characters')
    .select('*, player:profiles(display_name), sheet:character_sheets(review_note, level, manna, sheet)')
    .order('created_at')
  items.value = (data ?? []).map((pilot) => ({ ...pilot, mechs: Array.isArray(pilot.mechs) ? pilot.mechs : [] })) as Pilot[]
  error.value = loadError?.message ?? ''
  loading.value = false
}

const saving = reactive<Record<number, boolean>>({})
const rowError = reactive<Record<number, string>>({})
const saved = reactive<Record<number, boolean>>({})
const spent = (pilot: Pilot) => mannaSpent((pilot.sheet?.sheet ?? {}) as Sheet)
const left = (pilot: Pilot) => (pilot.sheet?.manna ?? 0) - spent(pilot)
const amount = (n: number) => n.toLocaleString('en-GB')
const licenceRanks = (pilot: Pilot) => licenceLevel((pilot.sheet?.sheet ?? {}) as Sheet)

async function save(pilot: Pilot, changes: { level?: number; manna?: number }) {
  if (saving[pilot.id]) return
  saving[pilot.id] = true
  saved[pilot.id] = false
  const { data, error: saveError } = await supabase
    .from('character_sheets')
    .update(changes)
    .eq('character_id', pilot.id)
    .select('review_note, level, manna, sheet')
    .single()
  saving[pilot.id] = false
  rowError[pilot.id] = saveError?.message ?? ''
  if (data) {
    items.value = items.value.map((item) => item.id === pilot.id ? { ...item, sheet: data } : item)
    saved[pilot.id] = true
  }
}

async function saveNumber(pilot: Pilot, field: 'level' | 'manna', event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.valueAsNumber
  if (!Number.isSafeInteger(value) || value < 0) {
    rowError[pilot.id] = 'Level and manna must be whole numbers, 0 or more.'
    input.value = String(pilot.sheet?.[field] ?? 0)
    return
  }
  await save(pilot, { [field]: value })
  if (rowError[pilot.id]) input.value = String(pilot.sheet?.[field] ?? 0)
}

// The profile (and so the role) can arrive just after the page opens.
watch(isGm, (gm) => gm && load(), { immediate: true })
</script>

<template>
  <main class="page">
    <PageHeader title="GM pilots" summary="Review new pilots, and level up or pay any pilot." />
    <p v-if="!profile" class="dim">Loading…</p>
    <p v-else-if="!isGm" class="notice warn" role="alert">Access denied. This page is for GMs.</p>
    <p v-else-if="loading" class="dim">Loading pilot records…</p>
    <p v-else-if="error" class="notice warn" role="alert">{{ error }}</p>
    <template v-else>
      <ReviewQueue :items="queueCards" description="New pilots, oldest first. Open one to review their sheet." />

      <section class="panel" aria-labelledby="roster-title">
        <header class="panel-head">
          <h2 id="roster-title">Pilot records</h2>
          <p class="dim">Every pilot, including pending and dead. Level and manna save when you leave the field.</p>
        </header>
        <div class="search">
          <label class="field">
            <span>Search</span>
            <input v-model="search" type="search" placeholder="Callsign, name or player" />
          </label>
          <p class="dim" role="status"><span class="num">{{ roster.length }}</span> of <span class="num">{{ items.length }}</span> pilots</p>
        </div>
        <p v-if="!roster.length" class="empty">{{ items.length ? 'No pilots match that search.' : 'No pilots on file.' }}</p>
        <div v-else class="record-window" role="region" aria-label="Pilot records" tabindex="0">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Callsign</th>
                <th scope="col">Name</th>
                <th scope="col">Player</th>
                <th scope="col">Status</th>
                <th scope="col" class="number">Level</th>
                <th scope="col" class="number">Licence level</th>
                <th scope="col" class="number">Manna received</th>
                <th scope="col" class="number">Manna left</th>
                <th scope="col">Mechs</th>
                <th scope="col">Record</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pilot in roster" :key="pilot.id">
                <td class="callsign">{{ pilot.callsign || '–' }}</td>
                <td>{{ pilot.pilot_name }}</td>
                <td>{{ pilot.player?.display_name || 'Unknown player' }}</td>
                <td>
                  <span
                    class="badge"
                    :class="pilot.status === 'pending' && pilot.sheet?.review_note ? 'rejected' : pilot.status"
                    :title="pilot.status === 'pending' ? pilot.sheet?.review_note ?? '' : ''"
                  >
                    {{ pilot.status === 'pending' && pilot.sheet?.review_note ? 'Sent back' : pilot.status }}
                  </span>
                </td>
                <td class="number">
                  <input
                    class="level"
                    type="number" min="0" step="1"
                    :value="pilot.sheet?.level ?? 0"
                    :disabled="saving[pilot.id] || !pilot.sheet"
                    :aria-label="`Level for ${pilot.callsign || pilot.pilot_name}`"
                    @change="saveNumber(pilot, 'level', $event)"
                  />
                </td>
                <td class="number num">{{ licenceRanks(pilot) }}</td>
                <td class="number">
                  <input
                    type="number" min="0" step="1"
                    :value="pilot.sheet?.manna ?? 0"
                    :disabled="saving[pilot.id] || !pilot.sheet"
                    :aria-label="`Manna received for ${pilot.callsign || pilot.pilot_name}`"
                    @change="saveNumber(pilot, 'manna', $event)"
                  />
                </td>
                <td class="number" :title="`${spent(pilot)} spent`">
                  <span class="num balance" :class="{ over: left(pilot) < 0 }">{{ amount(left(pilot)) }}</span>
                  <span class="spent"><span class="num">{{ amount(spent(pilot)) }}</span> spent</span>
                </td>
                <td class="mech-names" :title="pilot.mechs.map((mech) => mech.name).join(', ')">
                  {{ pilot.mechs.map((mech) => mech.name).join(', ') || '–' }}
                </td>
                <td>
                  <RouterLink :to="{ name: 'gm-review', params: { id: pilot.id } }" class="link-button">Open sheet</RouterLink>
                  <span v-if="!pilot.sheet" class="save-message error">Private sheet missing</span>
                  <span v-if="rowError[pilot.id]" class="save-message error" role="alert">{{ rowError[pilot.id] }}</span>
                  <span v-else-if="saving[pilot.id]" class="save-message dim" role="status">Saving…</span>
                  <span v-else-if="saved[pilot.id]" class="save-message saved" role="status"><Icon name="check" />Saved</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
section + section { margin-top: var(--space-l); }
.search { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-s) var(--space-m); margin-bottom: var(--space-m); }
.search .field { flex: 0 1 28rem; }
.search p { margin: 0; padding-bottom: var(--space-s); }
/* Scrolls inside its box on narrow screens; the header row stays put while the rows scroll. */
.record-window { max-height: 70dvh; overflow: auto; border: 1px solid var(--rule); border-radius: var(--radius); }
.table th { position: sticky; top: 0; z-index: 1; background: var(--panel); }
.table th, .table td { white-space: nowrap; vertical-align: middle; }
.table .number { text-align: right; }
.table input { width: 8rem; text-align: right; }
.table input.level { width: 5rem; }
.callsign { font-weight: 700; }
.balance { font-weight: 700; }
.balance.over { color: var(--danger); }
.spent { display: block; color: var(--text-dim); font-size: var(--fs-xs); }
.mech-names { max-width: 15rem; overflow: hidden; text-overflow: ellipsis; }
.save-message { display: flex; align-items: center; gap: var(--space-xs); margin-top: var(--space-xs); font-size: var(--fs-xs); white-space: normal; }
.save-message.saved { color: var(--ok); }
.save-message.error { color: var(--danger); }
/* A link drawn like a small button. */
.link-button { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border: 1px solid var(--edge); border-radius: var(--radius); font: 700 var(--fs-xs) / 1 var(--sans); letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; }
.link-button:hover, .link-button:focus-visible { border-color: var(--lilac); color: var(--lilac); }
@media (pointer: coarse) { .link-button { min-height: var(--tap); } }
</style>
