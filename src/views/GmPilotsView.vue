<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { isGm, profile } from '../auth'
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
    rowError[pilot.id] = 'level and manna must be whole numbers, 0 or more.'
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
  <main class="page gm-pilots">
    <PageHeader title="gm: pilots" summary="review waiting pilots and manage every pilot record." />
    <p v-if="!profile" class="dim">loading...</p>
    <p v-else-if="!isGm" class="notice warn" role="alert">access denied. gm clearance required.</p>
    <p v-else-if="loading" class="empty">loading pilot records...</p>
    <p v-else-if="error" class="notice warn" role="alert">{{ error }}</p>
    <template v-else>
      <ReviewQueue :items="queueCards" description="oldest first. open a pilot to review their sheet." />

      <section class="panel" aria-labelledby="roster-title">
        <header class="panel-head">
          <h2 id="roster-title">pilot records</h2>
          <p class="dim">all pilots, including pending and dead. level and manna save when you leave the field.</p>
        </header>
        <div class="search">
          <label class="field">
            <span>find a pilot</span>
            <input v-model="search" type="search" placeholder="search callsign, pilot name or player" />
          </label>
          <p class="count" role="status">{{ roster.length }} of {{ items.length }} pilots</p>
        </div>
        <p v-if="!roster.length" class="empty">{{ items.length ? 'no pilots match your search.' : 'no pilots on file.' }}</p>
        <div v-else class="record-window" role="region" aria-label="Pilot records" tabindex="0">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">callsign</th>
                <th scope="col">name</th>
                <th scope="col">player</th>
                <th scope="col">status</th>
                <th scope="col">level</th>
                <th scope="col">licence level</th>
                <th scope="col">manna received</th>
                <th scope="col">manna left</th>
                <th scope="col">mechs</th>
                <th scope="col">record</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pilot in roster" :key="pilot.id">
                <td class="callsign">{{ pilot.callsign || '-' }}</td>
                <td>{{ pilot.pilot_name }}</td>
                <td>{{ pilot.player?.display_name || 'unknown player' }}</td>
                <td>
                  <span class="badge" :class="pilot.status" :title="pilot.status === 'pending' ? pilot.sheet?.review_note ?? '' : ''">
                    {{ pilot.status === 'pending' && pilot.sheet?.review_note ? 'sent back' : pilot.status }}
                  </span>
                </td>
                <td>
                  <input
                    class="level"
                    type="number" min="0" step="1"
                    :value="pilot.sheet?.level ?? 0"
                    :disabled="saving[pilot.id] || !pilot.sheet"
                    :aria-label="`level for ${pilot.callsign || pilot.pilot_name}`"
                    @change="saveNumber(pilot, 'level', $event)"
                  />
                </td>
                <td>{{ licenceRanks(pilot) }}</td>
                <td>
                  <input
                    type="number" min="0" step="1"
                    :value="pilot.sheet?.manna ?? 0"
                    :disabled="saving[pilot.id] || !pilot.sheet"
                    :aria-label="`manna received for ${pilot.callsign || pilot.pilot_name}`"
                    @change="saveNumber(pilot, 'manna', $event)"
                  />
                </td>
                <td class="balance" :class="{ rose: left(pilot) < 0 }" :title="`${spent(pilot)} spent`">
                  {{ left(pilot) }}<span class="spent">{{ spent(pilot) }} spent</span>
                </td>
                <td class="mech-names" :title="pilot.mechs.map((mech) => mech.name).join(', ')">
                  {{ pilot.mechs.map((mech) => mech.name).join(', ') || '-' }}
                </td>
                <td class="record-link">
                  <RouterLink :to="{ name: 'gm-review', params: { id: pilot.id } }" class="link-button">open sheet</RouterLink>
                  <span v-if="!pilot.sheet" class="rose save-message">private sheet missing</span>
                  <span v-if="rowError[pilot.id]" class="rose save-message" role="alert">{{ rowError[pilot.id] }}</span>
                  <span v-else-if="saving[pilot.id]" class="dim save-message" role="status">saving...</span>
                  <span v-else-if="saved[pilot.id]" class="mint save-message" role="status">saved</span>
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
.search { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: center; gap: var(--space-s) var(--space-m); margin-bottom: var(--space-m); }
.search .field { flex: 0 1 28rem; }
.search input { width: 100%; }
.count { margin: 0; padding-bottom: var(--space-s); color: var(--sky); }
/* Scrolls inside its box on narrow screens; the header row stays put while the rows scroll. */
.record-window { max-height: 70dvh; overflow: auto; border: 1px solid var(--rule); }
.table th { position: sticky; top: 0; z-index: 1; background: var(--panel); }
.table th, .table td { white-space: nowrap; vertical-align: middle; }
.table input { width: 8.5rem; }
.table input.level { width: 5.5rem; }
.callsign, .balance { color: var(--lilac); font-weight: 600; }
.balance.rose { color: var(--rose); }
.spent { display: block; color: var(--text-dim); font-size: 0.8125rem; font-weight: 400; }
.mech-names { max-width: 15rem; overflow: hidden; text-overflow: ellipsis; }
.save-message { display: block; margin-top: 0.25rem; font-size: 0.8125rem; white-space: normal; }
.mint { color: var(--mint); }
/* A link drawn like a small button. */
.link-button { display: inline-block; padding: 0.3rem 0.65rem; border: 1px solid var(--rule); font: 600 0.875rem/1.5 var(--mono); text-decoration: none; }
.link-button:hover, .link-button:focus-visible { border-color: var(--lilac); color: var(--lilac); }
</style>
