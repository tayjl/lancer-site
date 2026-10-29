<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { isGm, profile } from '../auth'
import PageHeader from '../components/PageHeader.vue'
import Portrait from '../components/Portrait.vue'
import type { PublicPilot } from '../pilots'
import { supabase } from '../lib/supabaseClient'
import type { Sheet } from '../myPilot'
import { licenceLevel, mannaSpent } from '../rules'
import { since } from '../time'

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
const amounts = reactive<Record<number, number | ''>>({})
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

function saveNumber(pilot: Pilot, field: 'level' | 'manna', event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.valueAsNumber
  if (!Number.isSafeInteger(value) || value < 0) {
    rowError[pilot.id] = 'level and manna must be whole numbers, 0 or more.'
    input.value = String(pilot.sheet?.[field] ?? 0)
    return
  }
  save(pilot, { [field]: value })
}

async function saveIdentity(pilot: Pilot, field: 'callsign' | 'pilot_name', event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.trim()
  if (field === 'pilot_name' && !value) {
    rowError[pilot.id] = 'a pilot needs a name.'
    input.value = pilot.pilot_name
    return
  }
  if (saving[pilot.id]) return
  saving[pilot.id] = true
  saved[pilot.id] = false
  const { data, error: saveError } = await supabase.from('characters')
    .update(field === 'pilot_name' ? { pilot_name: value } : { callsign: value || null })
    .eq('id', pilot.id).select('callsign, pilot_name').single()
  saving[pilot.id] = false
  rowError[pilot.id] = saveError?.message ?? ''
  if (data) {
    items.value = items.value.map((item) => item.id === pilot.id ? { ...item, ...data } : item)
    saved[pilot.id] = true
  } else input.value = pilot[field] ?? ''
}

async function give(pilot: Pilot, sign: 1 | -1) {
  const amount = amounts[pilot.id]
  const total = (pilot.sheet?.manna ?? 0) + sign * Number(amount)
  if (!amount || !Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(total)) {
    rowError[pilot.id] = 'type a positive whole number of manna first.'
    return
  }
  await save(pilot, { manna: Math.max(0, total) })
  if (!rowError[pilot.id]) amounts[pilot.id] = ''
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
      <section aria-labelledby="queue-title">
        <header class="section-head">
          <div>
            <h2 id="queue-title">waiting for review</h2>
            <p class="dim">oldest first. open a pilot to review their sheet.</p>
          </div>
          <span class="dim">{{ waiting.length }} waiting</span>
        </header>
        <p v-if="!waiting.length" class="empty dim">nothing waiting on a gm.</p>
        <ol v-else class="queue">
          <li v-for="pilot in waiting" :key="pilot.id">
            <RouterLink :to="{ name: 'gm-review', params: { id: pilot.id } }" class="queue-card">
              <Portrait :src="pilot.pilot_image" :alt="`Portrait of ${pilot.callsign || pilot.pilot_name}`" />
              <div>
                <h3>{{ pilot.callsign || pilot.pilot_name }}</h3>
                <p>{{ pilot.pilot_name }}</p>
                <p class="dim">{{ pilot.player?.display_name }}</p>
                <p class="age">waiting {{ since(pilot.created_at) }}</p>
              </div>
            </RouterLink>
          </li>
        </ol>
      </section>

      <section aria-labelledby="roster-title">
        <header class="section-head">
          <div>
            <h2 id="roster-title">pilot records</h2>
            <p class="dim">all pilots, including pending and dead. edits save when you leave a field.</p>
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
                <th scope="col">callsign &amp; name</th>
                <th scope="col">player &amp; status</th>
                <th scope="col">level</th>
                <th scope="col">manna</th>
                <th scope="col">give / take</th>
                <th scope="col">record</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pilot in roster" :key="pilot.id">
                <td>
                  <label><span>callsign</span><input type="text" :value="pilot.callsign ?? ''" :disabled="saving[pilot.id]" :aria-label="`callsign for ${pilot.pilot_name}`" @change="saveIdentity(pilot, 'callsign', $event)" /></label>
                  <label><span>name</span><input type="text" :value="pilot.pilot_name" :disabled="saving[pilot.id]" :aria-label="`name for ${pilot.callsign || pilot.pilot_name}`" @change="saveIdentity(pilot, 'pilot_name', $event)" /></label>
                </td>
                <td>
                  <p>{{ pilot.player?.display_name || 'unknown player' }}</p>
                  <p class="status" :class="pilot.status">{{ pilot.status }}</p>
                  <p v-if="pilot.sheet?.review_note && pilot.status === 'pending'" class="review-note">sent back: {{ pilot.sheet.review_note }}</p>
                </td>
                <td>
                  <label><span>pilot level</span><input type="number" min="0" step="1" :value="pilot.sheet?.level ?? 0" :disabled="saving[pilot.id] || !pilot.sheet" :aria-label="`level for ${pilot.callsign || pilot.pilot_name}`" @change="saveNumber(pilot, 'level', $event)" /></label>
                  <p class="dim">licence level {{ licenceRanks(pilot) }}</p>
                </td>
                <td>
                  <p class="balance" :class="{ rose: left(pilot) < 0 }">{{ left(pilot) }} <span>left</span></p>
                  <label><span>total received</span><input type="number" min="0" step="1" :value="pilot.sheet?.manna ?? 0" :disabled="saving[pilot.id] || !pilot.sheet" :aria-label="`manna received for ${pilot.callsign || pilot.pilot_name}`" @change="saveNumber(pilot, 'manna', $event)" /></label>
                  <p class="dim">{{ spent(pilot) }} spent</p>
                </td>
                <td>
                  <label><span>amount</span><input v-model.number="amounts[pilot.id]" type="number" min="1" step="1" :disabled="saving[pilot.id] || !pilot.sheet" :aria-label="`manna amount for ${pilot.callsign || pilot.pilot_name}`" /></label>
                  <div class="actions">
                    <button type="button" :disabled="saving[pilot.id] || !pilot.sheet" @click="give(pilot, 1)">give</button>
                    <button type="button" :disabled="saving[pilot.id] || !pilot.sheet" @click="give(pilot, -1)">take</button>
                  </div>
                </td>
                <td>
                  <RouterLink :to="{ name: 'gm-review', params: { id: pilot.id } }">open sheet</RouterLink>
                  <p v-if="pilot.mechs.length" class="dim">{{ pilot.mechs.map((mech) => mech.name).join(', ') }}</p>
                  <p v-else class="dim">no mechs</p>
                  <p v-if="!pilot.sheet" class="rose">private sheet missing</p>
                  <p v-if="rowError[pilot.id]" class="rose" role="alert">{{ rowError[pilot.id] }}</p>
                  <p v-else-if="saving[pilot.id]" class="dim" role="status">saving...</p>
                  <p v-else-if="saved[pilot.id]" class="dim" role="status">saved</p>
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
.gm-pilots { max-width: none; }
section + section { margin-top: 3rem; }
.section-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
h2 { margin: 0; font-size: clamp(1.5rem, 2.5vw, 2rem); }
.section-head p { margin: 0.5rem 0 0; }
.empty { max-width: none; margin: 0; padding: 2.5rem 1.5rem; border: 1px dashed var(--rule); text-align: center; }
.queue { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); gap: 1rem; margin: 0; padding: 0; list-style: none; }
.queue-card { display: flex; align-items: center; gap: 1.25rem; height: 100%; padding: 1.25rem; border: 1px solid var(--rule); color: var(--text); text-decoration: none; }
.queue-card:hover { border-color: var(--lilac); background: var(--panel); }
.queue-card :deep(.portrait) { flex: 0 0 5rem; }
.queue-card > div { min-width: 0; overflow-wrap: anywhere; }
.queue-card h3 { margin: 0 0 0.5rem; font-size: 1.25rem; }
.queue-card p { margin: 0.2rem 0; }
.age { color: var(--sky); }
.search { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; }
input[type='search'], input[type='number'] { padding: 0.55rem 0.65rem; border: 1px solid var(--rule); background: var(--void); color: var(--text); font: inherit; }
input[type='search'] { width: 100%; }
input[type='number'] { width: 8rem; max-width: 100%; }
.record-window { max-height: 70dvh; overflow: auto; border: 1px solid var(--rule); }
.roster { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 1rem; }
th { position: sticky; top: 0; z-index: 1; padding: 1rem; border-bottom: 1px solid var(--rule); background: var(--panel); color: var(--text); font-weight: 600; text-align: left; white-space: nowrap; }
td { padding: 1.25rem 1rem; vertical-align: top; }
tr + tr td { border-top: 1px solid var(--rule); }
td:first-child { min-width: 15rem; }
td:last-child { min-width: 12rem; }
td p { margin: 0.4rem 0; overflow-wrap: anywhere; }
td label { display: flex; flex-direction: column; gap: 0.25rem; }
td label + label { margin-top: 0.75rem; }
td label > span { color: var(--text-dim); }
.status { color: var(--sky); }
.status.pending, .review-note { color: var(--rose); }
.status.dead { color: var(--text-dim); }
.balance { color: var(--lilac); font-size: 1.5rem; font-weight: 600; }
.balance.rose { color: var(--rose); }
.balance span { color: var(--text-dim); font-size: 1rem; font-weight: 400; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.4rem; }
.actions button { padding-inline: 0; }
button:disabled, input:disabled { opacity: 0.5; cursor: default; }
@media (max-width: 48rem) {
  .roster, tbody, tr, td { display: block; }
  thead { display: none; }
  tr { padding: 1rem; }
  td { padding: 0.5rem 0; }
  tr + tr { border-top: 1px solid var(--rule); }
  tr + tr td { border-top: 0; }
  td:first-child, td:last-child { min-width: 0; }
}
</style>
