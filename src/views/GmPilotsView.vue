<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { isGm, profile } from '../auth'
import PageHeader from '../components/PageHeader.vue'
import ReviewQueue from '../components/ReviewQueue.vue'
import type { Json } from '../lib/database.types'
import { PILOT_FIELDS, type PublicPilot } from '../pilots'
import { confirmAction } from '../confirm'
import { supabase } from '../lib/supabaseClient'
import { EXPERIENCE_MAX, award, levelUp, rewardsProblem, type Rewards } from '../rewards'
import type { Sheet } from '../myPilot'
import { useGameData } from '../gameData'
import { formatAmount, licenceLevel, mannaSpent, type Grants } from '../rules'
import { capitalise } from '../text'

// Waiting pilots are ordered by submission time. The searchable roster includes every pilot,
// including sent-back and dead records. GM edits save directly; database policies enforce the role.
// The sheet is read only for what the roster's numbers use: the licences, talents, bionics and owned gear that manna is spent on.
const SHEET_FIELDS = 'review_note, level, manna, gm_grants, licences:sheet->licences, talents:sheet->talents, bionics:sheet->bionics, owned_gear:sheet->owned_gear'
// Experience is GM-only and lives in its own table (pilot_progress); a pilot with no row has 0.
const PROGRESS_FIELDS = 'progress:pilot_progress(experience)'
type Pilot = PublicPilot & {
  sheet: { review_note: string | null; level: number; manna: number; gm_grants: Json; licences: Json; talents: Json; bionics: Json; owned_gear: Json } | null
  progress: { experience: number } | null
}

const items = shallowRef<Pilot[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const waiting = computed(() => items.value.filter((item) => item.status === 'pending' && item.submitted_at)
  .sort((a, b) => Date.parse(a.submitted_at!) - Date.parse(b.submitted_at!)))
const queueCards = computed(() => waiting.value.map(pilot => ({
  id: pilot.id, callsign: pilot.callsign, name: pilot.pilot_name, image: pilot.pilot_image,
  player: pilot.player?.display_name ?? '-', submittedAt: pilot.submitted_at!,
  to: { name: 'gm-review', params: { id: pilot.id } },
})))
// A pending pilot opens for review; a living one in GM edit mode; a dead one read-only.
const sheetLink = (pilot: Pilot) =>
  pilot.status === 'pending' ? { name: 'gm-review', params: { id: pilot.id } } : { name: 'pilot-record', params: { id: pilot.id }, query: pilot.status === 'dead' ? undefined : { edit: '1' } }
// A pilot nobody has submitted is a Draft, or Sent back when a GM's note is waiting for its player.
const sentBack = (pilot: Pilot) => pilot.status === 'pending' && !pilot.submitted_at && !!pilot.sheet?.review_note
const statusClass = (pilot: Pilot) => (sentBack(pilot) ? 'rejected' : pilot.status === 'pending' && !pilot.submitted_at ? 'draft' : pilot.status)
const statusLabel = (pilot: Pilot) => (sentBack(pilot) ? 'Sent back' : pilot.status === 'pending' && !pilot.submitted_at ? 'Draft' : capitalise(pilot.status))
const roster = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return items.value
    .filter((pilot) => [pilot.callsign, pilot.pilot_name, pilot.player?.display_name].some((name) => name?.toLocaleLowerCase().includes(query)))
    .sort((a, b) => (a.callsign || a.pilot_name).localeCompare(b.callsign || b.pilot_name))
})

const pilotQuery = () => supabase.from('characters').select(`${PILOT_FIELDS}, sheet:character_sheets(${SHEET_FIELDS}), ${PROGRESS_FIELDS}`)
const withMechs = (pilot: { mechs: unknown }) => ({ ...pilot, mechs: Array.isArray(pilot.mechs) ? pilot.mechs : [] }) as Pilot

async function load() {
  loading.value = true
  const { data, error: loadError } = await pilotQuery().order('created_at')
  items.value = (data ?? []).map(withMechs)
  error.value = loadError?.message ?? ''
  loading.value = false
}

const saving = reactive<Record<number, boolean>>({})
const rowError = reactive<Record<number, string>>({})
const saved = reactive<Record<number, boolean>>({})
// Numbers typed but not saved yet (a failed save keeps them on screen for Retry), by pilot.
const typed = reactive<Record<number, Rewards>>({})
type Field = keyof Rewards
const shown = (pilot: Pilot, field: Field) => typed[pilot.id]?.[field] ?? (field === 'experience' ? pilot.progress?.experience : pilot.sheet?.[field]) ?? 0
const ready = (pilot: Pilot) => (pilot.progress?.experience ?? 0) >= EXPERIENCE_MAX
const { gear, bionicPrices } = useGameData()
// A pending pilot has never been approved: its first full loadout is free (rules.ts freeGear). Otherwise the sheet is the live one.
const spent = (pilot: Pilot) => {
  const sheet = (pilot.sheet ?? {}) as Sheet
  return mannaSpent(sheet, bionicPrices.value, pilot.mechs.length, gear.value, pilot.status === 'pending' ? null : sheet, (pilot.sheet?.gm_grants ?? {}) as Grants)
}
const left = (pilot: Pilot) => (pilot.sheet?.manna ?? 0) - spent(pilot)
const licenceRanks = (pilot: Pilot) => licenceLevel((pilot.sheet ?? {}) as Sheet)

// Runs one reward write through the database (award or level_up: both log the change), then re-reads the pilot so the
// row shows what the database now holds. A failed write keeps the typed numbers on screen for Retry.
async function run(pilot: Pilot, write: () => Promise<string | null>) {
  if (saving[pilot.id]) return
  saving[pilot.id] = true
  saved[pilot.id] = false
  let failure = await write()
  if (!failure) {
    const { data, error: loadError } = await pilotQuery().eq('id', pilot.id).maybeSingle()
    if (data) items.value = items.value.map((item) => item.id === pilot.id ? withMechs(data) : item)
    failure = loadError?.message ? `Saved, but couldn't refresh the row: ${loadError.message}` : null
    delete typed[pilot.id]
  }
  saving[pilot.id] = false
  rowError[pilot.id] = failure ?? ''
  saved[pilot.id] = !failure
}

function save(pilot: Pilot, changes: Rewards) {
  typed[pilot.id] = { ...typed[pilot.id], ...changes }
  return run(pilot, () => award(pilot.id, typed[pilot.id]))
}

async function saveNumber(pilot: Pilot, field: Field, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.valueAsNumber
  const problem = rewardsProblem({ [field]: value })
  if (problem) {
    rowError[pilot.id] = problem
    input.value = String(shown(pilot, field))
    return
  }
  await save(pilot, { [field]: value })
}

async function levelUpPilot(pilot: Pilot) {
  const name = pilot.callsign || pilot.pilot_name
  if (!(await confirmAction(`Level ${name} up to level ${(pilot.sheet?.level ?? 0) + 1}? This spends ${EXPERIENCE_MAX} experience.`, { confirmLabel: 'Level up' }))) return
  await run(pilot, () => levelUp(pilot.id))
}

// The profile (and so the role) can arrive just after the page opens.
watch(isGm, (gm) => gm && load(), { immediate: true })
</script>

<template>
  <main class="page">
    <PageHeader title="GM pilots" summary="Review new pilots. Set levels and manna." />
    <p v-if="!profile" class="dim">Loading…</p>
    <p v-else-if="!isGm" class="notice warn" role="alert">Only GMs can see this page.</p>
    <p v-else-if="loading" class="dim">Loading…</p>
    <p v-else-if="error" class="notice warn" role="alert">{{ error }}</p>
    <template v-else>
      <ReviewQueue :items="queueCards" description="New pilots, oldest first." />

      <section class="panel" aria-labelledby="roster-title">
        <header class="panel-head">
          <h2 id="roster-title">Pilot records</h2>
          <p class="dim">Level, experience and manna save when you leave the field. Each change is logged on the pilot's review page.</p>
        </header>
        <div class="search">
          <label class="field">
            <span>Search</span>
            <input v-model="search" type="search" placeholder="Callsign, name or player" />
          </label>
          <p class="dim" role="status"><span class="num">{{ roster.length }}</span> of <span class="num">{{ items.length }}</span> pilots</p>
        </div>
        <p v-if="!roster.length" class="empty">{{ items.length ? 'Nothing matches that search.' : 'No pilots yet.' }}</p>
        <div v-else class="record-window" role="region" aria-label="Pilot records" tabindex="0">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Callsign</th>
                <th scope="col">Name</th>
                <th scope="col">Player</th>
                <th scope="col">Status</th>
                <th scope="col" class="number">Level</th>
                <th scope="col" class="number">Experience</th>
                <th scope="col" class="number">Licence level</th>
                <th scope="col" class="number">Manna received</th>
                <th scope="col" class="number">Manna left</th>
                <th scope="col">Mechs</th>
                <th scope="col">Record</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pilot in roster" :key="pilot.id">
                <td data-label="Callsign" class="callsign">{{ pilot.callsign || '–' }}</td>
                <td data-label="Name">{{ pilot.pilot_name }}</td>
                <td data-label="Player">{{ pilot.player?.display_name || 'Unknown player' }}</td>
                <td data-label="Status">
                  <span
                    class="badge"
                    :class="statusClass(pilot)"
                    :title="pilot.status === 'pending' ? pilot.sheet?.review_note ?? '' : ''"
                  >
                    {{ statusLabel(pilot) }}
                  </span>
                </td>
                <td data-label="Level" class="number">
                  <input
                    class="level"
                    type="number" min="0" step="1"
                    :value="shown(pilot, 'level')"
                    :disabled="saving[pilot.id] || !pilot.sheet"
                    :aria-label="`Level for ${pilot.callsign || pilot.pilot_name}`"
                    @change="saveNumber(pilot, 'level', $event)"
                  />
                </td>
                <td data-label="Experience" class="xp">
                  <input
                    type="number" min="0" :max="EXPERIENCE_MAX" step="1"
                    :value="shown(pilot, 'experience')"
                    :disabled="saving[pilot.id] || !pilot.sheet"
                    :aria-label="`Experience for ${pilot.callsign || pilot.pilot_name}, out of ${EXPERIENCE_MAX}`"
                    @change="saveNumber(pilot, 'experience', $event)"
                  />
                  <span v-if="ready(pilot)" class="ready">
                    <span class="badge">Ready to level</span>
                    <button type="button" class="small" :disabled="saving[pilot.id]" @click="levelUpPilot(pilot)">Level up</button>
                  </span>
                </td>
                <td data-label="Licence level" class="number num">{{ licenceRanks(pilot) }}</td>
                <td data-label="Manna received" class="number">
                  <input
                    type="number" min="0" step="1"
                    :value="shown(pilot, 'manna')"
                    :disabled="saving[pilot.id] || !pilot.sheet"
                    :aria-label="`Manna received for ${pilot.callsign || pilot.pilot_name}`"
                    @change="saveNumber(pilot, 'manna', $event)"
                  />
                </td>
                <td data-label="Manna left" class="number" :title="`${spent(pilot)} spent`">
                  <span class="num balance" :class="{ over: left(pilot) < 0 }">{{ formatAmount(left(pilot)) }}</span>
                  <span class="spent"><span class="num">{{ formatAmount(spent(pilot)) }}</span> spent</span>
                </td>
                <td data-label="Mechs" class="mech-names" :title="pilot.mechs.map((mech) => mech.name).join(', ')">
                  {{ pilot.mechs.map((mech) => mech.name).join(', ') || '–' }}
                </td>
                <td data-label="Record">
                  <RouterLink :to="sheetLink(pilot)" class="link-button">Open sheet</RouterLink>
                  <span v-if="!pilot.sheet" class="save-message error">Sheet missing</span>
                  <span v-if="rowError[pilot.id]" class="save-message error" role="alert">
                    Not saved: {{ rowError[pilot.id] }}
                    <button v-if="typed[pilot.id]" type="button" class="small quiet" @click="save(pilot, {})">Retry</button>
                  </span>
                  <span v-else-if="saving[pilot.id]" class="save-message dim" role="status">Saving…</span>
                  <span v-else-if="saved[pilot.id]" class="save-message dim" role="status">Saved</span>
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
.table input { width: 8rem; text-align: right; }
.table input.level { width: 5rem; }
.xp { width: 9rem; text-align: right; }
.xp input { width: 6rem; }
.ready { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: var(--space-xs); margin-top: var(--space-xs); }
.callsign { font-weight: 700; }
.balance { font-weight: 700; }
.balance.over { color: var(--danger); }
.spent { display: block; color: var(--text-dim); font-size: var(--fs-xs); }
.mech-names { max-width: 15rem; overflow: hidden; text-overflow: ellipsis; }
.save-message { display: flex; align-items: center; gap: var(--space-xs); margin-top: var(--space-xs); font-size: var(--fs-xs); white-space: normal; }
.save-message.error { color: var(--danger); }
/* A link drawn like a small button. */
.link-button { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border: 1px solid var(--edge); border-radius: var(--radius); font: 700 var(--fs-xs) / 1 var(--sans); letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; }
.link-button:hover, .link-button:focus-visible { border-color: var(--lilac); color: var(--lilac); }
@media (pointer: coarse), (max-width: 40rem) { .link-button { min-height: var(--tap); } }
@media (max-width: 40rem) {
  /* Each pilot becomes a card with a label beside every value, so no column (Status) is cut off. */
  .record-window { max-height: none; overflow: visible; border: 0; }
  .table, .table tbody, .table tr, .table td { display: block; }
  .table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .table tr { margin-bottom: var(--space-m); border: 1px solid var(--rule); border-radius: var(--radius); background: var(--panel); }
  .table td { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-xs) var(--space-m); width: auto; max-width: none; text-align: right; white-space: normal; }
  .table td::before { content: attr(data-label); color: var(--text-dim); font-size: var(--fs-xs); letter-spacing: 0.08em; text-align: left; text-transform: uppercase; }
}
</style>
