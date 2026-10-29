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
    <p v-else-if="!isGm" class="rose">access denied. gm clearance required.</p>
    <p v-else-if="loading" class="empty dim">loading pilot records...</p>
    <p v-else-if="error" class="empty rose" role="alert">{{ error }}</p>
    <template v-else>
      <ReviewQueue :items="queueCards" description="oldest first. open a pilot to review their sheet." />

      <section aria-labelledby="roster-title">
        <header class="section-head">
          <div>
            <h2 id="roster-title">pilot records</h2>
            <p class="dim">all pilots, including pending and dead. level and manna save when you leave the field.</p>
          </div>
          <span class="dim" role="status">{{ roster.length }} of {{ items.length }} pilots</span>
        </header>
        <label class="search">
          <span>find a pilot</span>
          <input v-model="search" type="search" placeholder="search callsign, pilot name or player" />
        </label>
        <p v-if="!roster.length" class="empty dim">{{ items.length ? 'no pilots match your search.' : 'no pilots on file.' }}</p>
        <div v-else class="record-window" role="region" aria-label="Pilot records" tabindex="0">
          <table class="roster">
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
                  <span class="status" :class="pilot.status" :title="pilot.status === 'pending' ? pilot.sheet?.review_note ?? '' : ''">
                    {{ pilot.status === 'pending' && pilot.sheet?.review_note ? 'sent back' : pilot.status }}
                  </span>
                </td>
                <td>
                  <input
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
                <td class="balance" :class="{ rose: left(pilot) < 0 }" :title="`${spent(pilot)} spent`">{{ left(pilot) }}</td>
                <td class="mech-names" :title="pilot.mechs.map((mech) => mech.name).join(', ')">
                  {{ pilot.mechs.map((mech) => mech.name).join(', ') || '-' }}
                </td>
                <td class="record-link">
                  <RouterLink :to="{ name: 'gm-review', params: { id: pilot.id } }">open sheet</RouterLink>
                  <span v-if="!pilot.sheet" class="rose">private sheet missing</span>
                  <span v-if="rowError[pilot.id]" class="rose save-message" role="alert">{{ rowError[pilot.id] }}</span>
                  <span v-else-if="saving[pilot.id]" class="dim save-message" role="status">saving...</span>
                  <span v-else-if="saved[pilot.id]" class="dim save-message" role="status">saved</span>
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
.gm-pilots { min-width: 0; max-width: none; }
section + section { margin-top: 3rem; }
.section-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
h2 { margin: 0; font-size: clamp(1.5rem, 2.5vw, 2rem); }
.section-head p { margin: 0.5rem 0 0; }
.empty { max-width: none; margin: 0; padding: 2.5rem 1.5rem; border: 1px dashed var(--rule); text-align: center; }
.search { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; }
input[type='search'], input[type='number'] { padding: 0.55rem 0.65rem; border: 1px solid var(--rule); background: var(--void); color: var(--text); font: inherit; }
input[type='search'] { width: 100%; }
input[type='number'] { width: 7rem; max-width: 100%; }
.roster td:nth-child(5) input { width: 5rem; }
.record-window { max-height: 70dvh; overflow: auto; border: 1px solid var(--rule); }
.roster { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 1rem; }
th { position: sticky; top: 0; z-index: 1; padding: 1rem; border-bottom: 1px solid var(--rule); background: var(--panel); color: var(--text); font-weight: 600; text-align: left; white-space: nowrap; }
td {
  padding: 0.75rem 1rem;
  vertical-align: middle;
  white-space: nowrap;
}

tr + tr td {
  border-top: 1px solid var(--rule);
}

.callsign, .balance {
  color: var(--lilac);
  font-weight: 600;
}

.balance.rose, .status.pending {
  color: var(--rose);
}

.status {
  color: var(--sky);
}

.status.dead {
  color: var(--text-dim);
}

.mech-names {
  max-width: 15rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.record-link {
  position: relative;
}

.save-message {
  display: block;
  font-size: 0.8125rem;
  white-space: normal;
  min-width: 9rem;
}

input:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
