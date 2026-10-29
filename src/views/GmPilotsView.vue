<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { isGm, profile } from '../auth'
import PageHeader from '../components/PageHeader.vue'
import { supabase } from '../lib/supabaseClient'
import type { Sheet } from '../myPilot'
import { mannaSpent } from '../rules'
import { since } from '../time'

// gm: pilots (the first GM tab). The review queue: every pending pilot, oldest first, so whoever has waited
// longest is reviewed first. Ones a GM sent back are waiting on their player, so they sit in their own list
// until the player resubmits. Changes to approved pilots have their own tab (gm: changes).
// Then the roster: every living pilot, with quick controls for level (gained narratively) and manna
// (received in total; what's left is received minus what the sheet spends, src/rules.ts). They save at once.
// The database only lets GMs and owners read everyone's sheets and set level and manna; the page just hides
// this from players.

type Pilot = {
  id: number
  status: string
  callsign: string | null
  pilot_name: string
  created_at: string
  player: { display_name: string } | null
  sheet: { review_note: string | null; level: number; manna: number; sheet: unknown } | null
}

const items = shallowRef<Pilot[]>([])
const loading = ref(true)
const error = ref('')

const pending = computed(() => items.value.filter((item) => item.status === 'pending'))
const waiting = computed(() => pending.value.filter((item) => !item.sheet?.review_note))
const sentBack = computed(() => pending.value.filter((item) => item.sheet?.review_note))
// Approved pilots first, by name; pending ones after (they may need starting manna).
const roster = computed(() =>
  [...items.value].sort((a, b) => a.status.localeCompare(b.status) || (a.callsign ?? a.pilot_name).localeCompare(b.callsign ?? b.pilot_name)),
)

async function load() {
  const { data, error: loadError } = await supabase
    .from('characters')
    .select('id, status, callsign, pilot_name, created_at, player:profiles(display_name), sheet:character_sheets(review_note, level, manna, sheet)')
    .in('status', ['pending', 'approved'])
    .order('created_at')
  items.value = (data ?? []) as Pilot[]
  error.value = loadError?.message ?? ''
  loading.value = false
}

// --- Roster: level and manna ---
const amounts = reactive<Record<number, number | ''>>({})
const saving = ref<number | null>(null)
const rowError = reactive<Record<number, string>>({})

const left = (pilot: Pilot) => (pilot.sheet?.manna ?? 0) - mannaSpent((pilot.sheet?.sheet ?? {}) as Sheet)

async function save(pilot: Pilot, changes: { level?: number; manna?: number }) {
  saving.value = pilot.id
  const { data, error: saveError } = await supabase
    .from('character_sheets')
    .update(changes)
    .eq('character_id', pilot.id)
    .select('review_note, level, manna, sheet')
    .single()
  saving.value = null
  rowError[pilot.id] = saveError?.message ?? ''
  if (data) items.value = items.value.map((item) => (item.id === pilot.id ? { ...item, sheet: data } : item))
}

const setLevel = (pilot: Pilot, level: number) => save(pilot, { level: Math.max(0, level) })

// Give (or take, with a negative sign) the amount typed in the pilot's row. Manna received can't go below 0.
function give(pilot: Pilot, sign: 1 | -1) {
  const amount = amounts[pilot.id]
  if (!amount || !Number.isInteger(amount) || amount <= 0) {
    rowError[pilot.id] = 'type a whole number of manna first.'
    return
  }
  save(pilot, { manna: Math.max(0, (pilot.sheet?.manna ?? 0) + sign * amount) }).then(() => {
    if (!rowError[pilot.id]) amounts[pilot.id] = ''
  })
}

// The profile (and so the role) can arrive just after the page opens.
watch(isGm, (gm) => gm && load(), { immediate: true })
</script>

<template>
  <main class="page">
    <PageHeader title="gm: pilots" summary="review new pilots, and level up or pay any pilot." />

    <p v-if="!profile" class="dim">loading...</p>
    <p v-else-if="!isGm" class="rose">access denied. gm clearance required.</p>
    <template v-else>
      <section>
        <h2 class="sheet-label">review queue</h2>
        <p class="dim small">waiting on a gm, oldest first. take the top one.</p>

        <p v-if="loading" class="dim">loading queue...</p>
        <p v-else-if="error" class="rose" role="alert">{{ error }}</p>
        <p v-else-if="!waiting.length" class="dim">nothing waiting on a gm.</p>
        <ol v-else class="queue">
          <li v-for="item in waiting" :key="item.id">
            <RouterLink :to="{ name: 'gm-review', params: { id: item.id } }" class="row">
              <span class="who">
                <span class="callsign">{{ item.callsign ?? item.pilot_name }}</span>
                <span class="dim">{{ item.callsign ? item.pilot_name : '' }}</span>
              </span>
              <span class="dim">{{ item.player?.display_name }}</span>
              <span class="dim">new pilot</span>
              <span class="age">waiting {{ since(item.created_at) }}</span>
            </RouterLink>
          </li>
        </ol>
      </section>

      <section v-if="sentBack.length">
        <h2 class="sheet-label">sent back</h2>
        <p class="dim small">waiting on the player. they rejoin the queue when the player resubmits.</p>
        <ul class="queue">
          <li v-for="item in sentBack" :key="item.id">
            <RouterLink :to="{ name: 'gm-review', params: { id: item.id } }" class="row">
              <span class="who">
                <span class="callsign">{{ item.callsign ?? item.pilot_name }}</span>
                <span class="dim">{{ item.callsign ? item.pilot_name : '' }}</span>
              </span>
              <span class="dim">{{ item.player?.display_name }}</span>
              <span class="dim note">{{ item.sheet?.review_note }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section>
        <h2 class="sheet-label">level and manna</h2>
        <p class="dim small">every living pilot. levels are gained narratively; manna buys licences, biomods and talents.</p>
        <p v-if="!loading && !roster.length" class="dim">no pilots yet.</p>
        <table v-else-if="!loading" class="roster">
          <thead>
            <tr>
              <th scope="col">pilot</th>
              <th scope="col">player</th>
              <th scope="col">level</th>
              <th scope="col">manna left</th>
              <th scope="col">give or take manna</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pilot in roster" :key="pilot.id">
              <td>
                <RouterLink :to="{ name: 'gm-review', params: { id: pilot.id } }" class="callsign">{{ pilot.callsign ?? pilot.pilot_name }}</RouterLink>
                <span v-if="pilot.status === 'pending'" class="badge">pending</span>
              </td>
              <td class="dim" data-label="player">{{ pilot.player?.display_name }}</td>
              <td data-label="level">
                <span class="steps">
                  <button
                    type="button"
                    :aria-label="`lower ${pilot.callsign ?? pilot.pilot_name}'s level`"
                    :disabled="saving === pilot.id || (pilot.sheet?.level ?? 0) <= 0"
                    @click="setLevel(pilot, (pilot.sheet?.level ?? 0) - 1)"
                  >
                    -
                  </button>
                  <strong>{{ pilot.sheet?.level ?? 0 }}</strong>
                  <button
                    type="button"
                    :aria-label="`raise ${pilot.callsign ?? pilot.pilot_name}'s level`"
                    :disabled="saving === pilot.id"
                    @click="setLevel(pilot, (pilot.sheet?.level ?? 0) + 1)"
                  >
                    +
                  </button>
                </span>
              </td>
              <td :title="`${pilot.sheet?.manna ?? 0} received`" data-label="manna left">
                <strong :class="{ rose: left(pilot) < 0 }">{{ left(pilot) }}</strong>
              </td>
              <td>
                <span class="give">
                  <input
                    v-model.number="amounts[pilot.id]"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="amount"
                    :aria-label="`manna for ${pilot.callsign ?? pilot.pilot_name}`"
                  />
                  <button type="button" :disabled="saving === pilot.id" @click="give(pilot, 1)">give</button>
                  <button type="button" :disabled="saving === pilot.id" @click="give(pilot, -1)">take</button>
                </span>
                <span v-if="rowError[pilot.id]" class="rose row-error" role="alert">{{ rowError[pilot.id] }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </main>
</template>

<style scoped>
section {
  margin-bottom: 2rem;
}

.small {
  margin: 0.5rem 0 0.75rem;
  font-size: 0.8125rem;
}

.queue {
  margin: 0;
  padding: 0;
  border: 1px solid var(--rule);
  list-style: none;
}

.queue li + li {
  border-top: 1px solid var(--rule);
}

/* One line per pilot on wide screens; it wraps on phones. */
.row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 0.25rem 1.5rem;
  align-items: baseline;
  padding: 0.6rem 0.9rem;
  color: var(--text);
  font-size: 0.875rem;
  text-decoration: none;
}

.row:hover,
.row:focus-visible {
  background: var(--panel);
}

.row:hover .callsign {
  color: var(--rose);
}

.who {
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.75rem;
  min-width: 0;
}

.callsign {
  color: var(--lilac);
  font-weight: 700;
}

.age {
  color: var(--sky);
  white-space: nowrap;
}

/* The GM's note, cut to one line; the full note is on the review page. */
.note {
  grid-column: span 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Roster --- */
.roster {
  width: 100%;
  border: 1px solid var(--rule);
  border-collapse: collapse;
  font-size: 0.875rem;
}

.roster th {
  padding: 0.4rem 0.9rem;
  border-bottom: 1px solid var(--rule);
  background: var(--panel);
  color: var(--text-dim);
  font-weight: 400;
  text-align: left;
}

.roster td {
  padding: 0.5rem 0.9rem;
  vertical-align: middle;
}

.roster tr + tr td {
  border-top: 1px solid var(--rule);
}

.roster a {
  text-decoration: none;
}

.roster strong {
  color: var(--lilac);
  font-size: 1.0625rem;
}

.badge {
  margin-left: 0.6rem;
  padding: 0 0.4rem;
  border: 1px solid currentColor;
  color: var(--rose);
  font-size: 0.75rem;
}

/* Small square steppers, as in the stat rows. */
.steps {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.steps button {
  width: 1.75rem;
  padding: 0;
  border: 1px solid var(--rule);
  color: var(--text-dim);
  font-weight: 400;
  line-height: 1.4;
}

.steps button::before,
.steps button::after {
  content: none;
}

.steps button:hover:not(:disabled),
.steps button:focus-visible {
  border-color: var(--lilac);
  color: var(--lilac);
}

.steps button:disabled {
  opacity: 0.35;
  cursor: default;
}

.give {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}

.give input {
  width: 7rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--rule);
  background: none;
  color: var(--text);
  font: 400 0.875rem/1.4 var(--mono);
}

.give input:focus {
  border-color: var(--lilac);
  outline: none;
}

.give button {
  padding: 0;
  font-size: 0.8125rem;
}

.row-error {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
}

@media (max-width: 40rem) {
  .row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  /* The roster as stacked cards: one pilot per block, each value on its own line with its label. */
  .roster thead {
    display: none;
  }

  .roster tr,
  .roster td {
    display: block;
  }

  .roster tr + tr {
    border-top: 1px solid var(--rule);
  }

  .roster tr + tr td {
    border-top: 0;
  }

  .roster td {
    padding: 0.3rem 0.9rem;
  }

  .roster td[data-label]::before {
    content: attr(data-label) ': ';
    color: var(--text-dim);
  }

  .note {
    grid-column: 1 / -1;
  }
}
</style>
