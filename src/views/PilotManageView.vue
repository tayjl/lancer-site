<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm } from '../auth'
import AddBox from '../components/AddBox.vue'
import GmReview from '../components/GmReview.vue'
import LoadoutBox from '../components/LoadoutBox.vue'
import PilotLoadout from '../components/PilotLoadout.vue'
import Portrait from '../components/Portrait.vue'
import SheetField from '../components/SheetField.vue'
import StatRow from '../components/StatRow.vue'
import { bionicItems, sheetStats, useGameData } from '../gameData'
import type { Json } from '../lib/database.types'
import { mechProblem, useMyPilot, type Sheet } from '../myPilot'
import type { PublicMech } from '../pilots'

// pilot_management: your pilot as one sheet, laid out like COMP/CON. The important bits across the top,
// long writing on the left, the portrait and identity table on the right (above the writing on phones),
// then stats, bionics, gear and the mech hangar. Everything is edited in place and saves itself.
// While a pilot is pending you can edit it directly; once it's approved, changes go through pending
// paperwork (not built yet), so the sheet turns read-only.
// The same page, read-only, is every pilot's record (opened from a card, route param "id"), so a record looks
// just like your own sheet. Private sections show only when the database hands over the sheet (the pilot's
// player, GMs and owners). On the gm-review route (from gm_view's queue) GMs also get the decision.

const route = useRoute()
const router = useRouter()
const pilotId = route.params.id ? Number(route.params.id) : undefined
const own = !pilotId
const reviewing = route.name === 'gm-review'
const {
  character,
  sheet,
  modPoints,
  reviewNote,
  playerName,
  canSeePrivate,
  loading,
  loadError,
  editable,
  mechs,
  load,
  create,
  updateCharacter,
  updateSheet,
  resubmit,
} = useMyPilot(pilotId)

// Records lead back to the queue, or to the list the pilot is in.
const back = computed(() =>
  reviewing
    ? { name: 'gm', label: 'gm_view' }
    : character.value?.status === 'pending'
      ? { name: 'pending', label: 'pending_paperwork' }
      : { name: 'registry', label: 'pilot_registry' },
)
// Your own mechs open for editing; anyone else's open read-only under their record.
const mechLink = (mechId: string) =>
  own ? { name: 'mech', params: { mechId } } : { name: 'record-mech', params: { id: pilotId, mechId } }
const { gear, bionics, pilotStats } = useGameData()

// The identity table under the portrait. [column, label]
const IDENTITY = [
  ['age', 'age'],
  ['gender', 'gender'],
  ['sexuality', 'sexuality'],
  ['height', 'height'],
  ['weight', 'weight'],
  ['eye_colour', 'eyes'],
  ['hair_colour', 'hair'],
] as const
type TextColumn = (typeof IDENTITY)[number][0] | 'callsign' | 'pilot_name'

// Stats start at 1. shortcut: 0 to 6 for every stat (LANCER's range for mech skills); revisit once the
// custom pilot stats' rules are decided.
const STAT_MIN = 0
const STAT_MAX = 6

// --- The save status shown in the top strip, for the one-line fields, stats and loadouts ---
const status = ref('')
const saveError = ref('')

async function track(save: Promise<string | null>) {
  status.value = 'saving...'
  saveError.value = (await save) ?? ''
  status.value = saveError.value ? '' : 'saved'
  return saveError.value || null
}

// One-line fields save when you leave them (or press enter). A pilot can't lose its name.
function saveText(column: TextColumn, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.trim() || null
  if (column === 'pilot_name' && !value) {
    saveError.value = 'a pilot needs a name.'
    input.value = character.value!.pilot_name
    return
  }
  track(updateCharacter({ [column]: value }))
}

// --- Registering: just a name (and optionally a callsign), then the full sheet opens ---
const newPilot = reactive({ callsign: '', name: '' })
const registerError = ref('')

async function register() {
  const name = newPilot.name.trim()
  if (!name) {
    registerError.value = 'a pilot needs a name.'
    return
  }
  registerError.value = (await create({ pilot_name: name, callsign: newPilot.callsign.trim() || null })) ?? ''
}

// --- Long writing ---
const saveColumn = (column: 'appearance' | 'personality') => (doc: Json | null) => updateCharacter({ [column]: doc })
const saveBackstory = (doc: Json | null) => updateSheet({ backstory: doc })

// --- Stats: personal stats come from the pilot_stats table, piloting stats are LANCER's HASE ---
const stats = computed(() => sheetStats(sheet.value, pilotStats.value, bionics.value))

// Saves every stat in the row, so the sheet records the defaults too, not just the one that changed.
function setStat(key: 'pilot_stats' | 'mech_skills', stats: { id: string; value: number }[], id: string, value: number) {
  const values: Sheet['pilot_stats'] = Object.fromEntries(stats.map((stat) => [stat.id, stat.value]))
  track(updateSheet({ [key]: { ...values, [id]: value } }))
}

// --- Bionics and the loadout (1 armour, 2 weapons, 3 gear): picked from the catalogues, stored as ids ---
const saveBionics = (ids: (string | number)[]) => updateSheet({ bionics: ids as number[] })
const saveGear = (ids: string[]) => updateSheet({ pilot_gear: ids })

// --- Hangar: a new mech starts with just a name and manufacturer id, then opens its own page ---
const addingMech = ref(false)
const newMech = reactive({ name: '', manufacturerId: '' })
const mechError = ref('')

function openNewMech() {
  Object.assign(newMech, { name: '', manufacturerId: '' })
  mechError.value = ''
  addingMech.value = true
}

async function createMech() {
  const name = newMech.name.trim()
  const manufacturerId = newMech.manufacturerId.trim().toUpperCase()
  mechError.value = mechProblem(name, manufacturerId) ?? ''
  if (mechError.value) return
  // shortcut: duplicate manufacturer ids aren't checked yet. Warn about them once the registry reads real pilots.
  const mech: PublicMech = { id: crypto.randomUUID(), name, manufacturer_id: manufacturerId, appearance: null, image: null }
  mechError.value = (await updateCharacter({ mechs: [...mechs.value, mech] })) ?? ''
  if (!mechError.value) router.push({ name: 'mech', params: { mechId: mech.id } })
}
</script>

<template>
  <main class="page manage">
    <nav v-if="!own" class="links">
      <RouterLink :to="{ name: back.name }">&lt; {{ back.label }}</RouterLink>
      <RouterLink v-if="isGm && !reviewing && character?.status === 'pending'" :to="{ name: 'gm-review', params: { id: pilotId } }">
        review in gm_view
      </RouterLink>
    </nav>

    <p v-if="loading" class="dim">loading pilot record...</p>
    <p v-else-if="loadError" class="rose" role="alert">{{ loadError }}</p>
    <p v-else-if="!character && !own" class="rose">no pilot record with that id.</p>

    <!-- No pilot yet: a name registers one, then the full sheet opens. -->
    <section v-else-if="!character" class="register">
      <h1 class="sheet-label">register a pilot</h1>
      <form class="register-form" @submit.prevent="register">
        <p>no pilot on file. a name is all that's needed to start; everything else is filled in on the sheet.</p>
        <label>
          <span class="dim">callsign</span>
          <input v-model="newPilot.callsign" type="text" />
        </label>
        <label>
          <span class="dim">name (required)</span>
          <input v-model="newPilot.name" type="text" required />
        </label>
        <p v-if="registerError" class="rose" role="alert">{{ registerError }}</p>
        <button type="submit">register pilot</button>
      </form>
    </section>

    <div v-else class="sheet">
      <!-- At a glance: callsign, name, player, status. -->
      <header class="glance">
        <div class="names">
          <input
            v-if="editable"
            class="inline callsign"
            type="text"
            aria-label="callsign"
            placeholder="callsign"
            :value="character.callsign ?? ''"
            @change="saveText('callsign', $event)"
          />
          <h1 v-else class="callsign">{{ character.callsign ?? character.pilot_name }}</h1>
          <input
            v-if="editable"
            class="inline name"
            type="text"
            aria-label="name"
            placeholder="name"
            :value="character.pilot_name"
            @change="saveText('pilot_name', $event)"
          />
          <p v-else class="name">{{ character.pilot_name }}</p>
        </div>
        <dl class="glance-facts">
          <div>
            <dt>player</dt>
            <dd>{{ playerName || '-' }}</dd>
          </div>
          <div>
            <dt>status</dt>
            <dd class="badge" :class="character.status">{{ character.status }}</dd>
          </div>
        </dl>
        <p class="save-status" role="status">
          <span v-if="saveError" class="rose">not saved: {{ saveError }}</span>
          <span v-else class="dim">{{ status }}</span>
        </p>
        <p v-if="own && !editable" class="dim note">this pilot is approved. changes go through pending paperwork (module offline).</p>
        <div v-else-if="own && reviewNote" class="gm-note" role="note">
          <p class="rose">sent back by a gm. change what they asked, then resubmit to rejoin the review queue.</p>
          <p>{{ reviewNote }}</p>
          <button type="button" @click="track(resubmit())">resubmit for review</button>
        </div>
      </header>

      <!-- Right on wide screens; between the top strip and appearance on phones. -->
      <aside class="side">
        <Portrait :src="character.pilot_image" :alt="`Portrait of ${character.callsign ?? character.pilot_name}`" />
        <p v-if="own" class="dim small">image upload: module offline</p>
        <table class="identity">
          <tbody>
            <tr v-for="[column, label] in IDENTITY" :key="column">
              <th scope="row">{{ label }}</th>
              <td>
                <input
                  v-if="editable"
                  class="inline"
                  type="text"
                  :aria-label="label"
                  :value="character[column] ?? ''"
                  @change="saveText(column, $event)"
                />
                <template v-else>{{ character[column] ?? '-' }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </aside>

      <div class="writing">
        <SheetField title="appearance" :doc="character.appearance" :editable="editable" :save="saveColumn('appearance')" />
        <SheetField title="personality" :doc="character.personality" :editable="editable" :save="saveColumn('personality')" />
        <SheetField
          v-if="canSeePrivate"
          title="backstory"
          tag="private"
          :doc="sheet.backstory ?? null"
          :editable="editable"
          :save="saveBackstory"
        />
      </div>

      <div class="wide">
        <template v-if="canSeePrivate">
          <StatRow
            title="personal stats"
            tag="private"
            :stats="stats.personal"
            :editable="editable"
            :min="STAT_MIN"
            :max="STAT_MAX"
            @set="(id, value) => setStat('pilot_stats', stats.personal, id, value)"
          />
          <StatRow
            title="piloting stats"
            tag="private"
            :stats="stats.piloting"
            :editable="editable"
            :min="STAT_MIN"
            :max="STAT_MAX"
            @set="(id, value) => setStat('mech_skills', stats.piloting, id, value)"
          />
          <LoadoutBox
            title="bionics"
            tag="private"
            :items="bionicItems(bionics)"
            :chosen="sheet.bionics ?? []"
            :editable="editable"
            :limit="{ label: 'mod limit', unit: 'mod points', max: modPoints }"
            :save="saveBionics"
          />
          <PilotLoadout :items="gear" :chosen="sheet.pilot_gear ?? []" :editable="editable" :save="saveGear" />
        </template>

        <section class="hangar">
          <header class="hangar-head">
            <h2 class="sheet-label">mech hangar</h2>
            <button v-if="editable && mechs.length && !addingMech" type="button" @click="openNewMech">new mech</button>
          </header>
          <div class="hangar-body">
            <ul v-if="mechs.length" class="mechs">
              <li v-for="mech in mechs" :key="mech.id">
                <RouterLink :to="mechLink(mech.id)" class="mech-card">
                  <Portrait :src="mech.image" :alt="`Image of ${mech.name}`" />
                  <span class="mech-name">{{ mech.name }}</span>
                  <span class="dim">{{ mech.manufacturer_id }}</span>
                </RouterLink>
              </li>
            </ul>

            <form v-if="addingMech" class="new-mech" @submit.prevent="createMech">
              <label>
                <span class="dim">mech name (required)</span>
                <input v-model="newMech.name" type="text" required />
              </label>
              <label>
                <span class="dim">manufacturer id (XXXX-XXXX-XXXX)</span>
                <input v-model="newMech.manufacturerId" type="text" required />
              </label>
              <p v-if="mechError" class="rose" role="alert">{{ mechError }}</p>
              <div class="actions">
                <button type="submit">create mech</button>
                <button type="button" @click="addingMech = false">cancel</button>
              </div>
            </form>
            <AddBox v-else-if="editable && !mechs.length" label="new mech" class="add-mech" @click="openNewMech" />
            <p v-else-if="!mechs.length" class="dim">no mechs on file.</p>
          </div>
        </section>

        <!-- :key resets the decision box after a decision, so it shows the new status. -->
        <GmReview v-if="reviewing && isGm" :key="character.status" :pilot="character" @reviewed="load" />
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Full width: the sheet uses the whole content area, not a centred column. */
.manage {
  max-width: none;
}

/* On a record: back to the list, and (for GMs, on a pending pilot) on to the review. */
.links {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  margin-bottom: 1rem;
}

.links a {
  color: var(--text-dim);
  font-size: 0.875rem;
  text-decoration: none;
}

.links a:hover {
  color: var(--lilac);
}

.small {
  font-size: 0.75rem;
}

/* --- Layout: top strip across, writing left, portrait right, then full-width sections --- */
.sheet {
  display: grid;
  grid-template-areas:
    'glance glance'
    'writing side'
    'wide wide';
  grid-template-columns: minmax(0, 1fr) clamp(16rem, 24vw, 22rem);
  gap: 1.5rem 2rem;
  align-items: start;
}

.glance {
  grid-area: glance;
}

.gm-note {
  flex-basis: 100%;
  padding: 0.6rem 0.9rem;
  border-left: 3px solid var(--rose);
  background: var(--panel);
  font-size: 0.875rem;
  text-align: left;
}

.gm-note p {
  margin: 0;
  white-space: pre-wrap;
}

.gm-note button {
  margin-top: 0.5rem;
  padding-inline: 0;
  font-size: 0.8125rem;
}

.note {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.8125rem;
}

.writing {
  grid-area: writing;
}

.side {
  grid-area: side;
}

.wide {
  grid-area: wide;
}

.writing,
.wide {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* --- One-line fields: plain text until you point at them --- */
.inline {
  padding: 0.15rem 0.35rem;
  border-color: transparent;
}

.inline:hover {
  border-color: var(--rule);
}

/* --- Top strip --- */
.glance {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem 2.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--rule);
}

.names {
  display: flex;
  flex: 1 1 22rem;
  flex-direction: column;
  min-width: 0;
}

.callsign {
  margin: 0;
  color: var(--lilac);
  font: 700 2.5rem/1.1 var(--mono);
}

.name {
  margin: 0;
  color: var(--text-dim);
  font-size: 1.125rem;
}

input.callsign,
input.name {
  margin-left: -0.35rem;
}

.glance-facts {
  display: flex;
  gap: 2rem;
  margin: 0;
}

.glance-facts dt {
  color: var(--text-dim);
  font-size: 0.75rem;
}

.glance-facts dd {
  margin: 0;
}

/* The status as a small outlined badge: rose while pending, sky once approved. */
.badge {
  width: fit-content;
  padding: 0 0.4rem;
  border: 1px solid currentColor;
}

.badge.pending {
  color: var(--rose);
}

.badge.approved {
  color: var(--sky);
}

.save-status {
  min-width: 8rem;
  margin: 0;
  font-size: 0.8125rem;
  text-align: right;
}

/* --- Portrait and identity table --- */
.side p {
  margin: 0.35rem 0 0;
}

.identity {
  width: 100%;
  margin-top: 1rem;
  border-collapse: collapse;
}

.identity th,
.identity td {
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--rule);
  text-align: left;
  vertical-align: middle;
}

.identity th {
  width: 6.5rem;
  color: var(--text-dim);
  font-size: 0.8125rem;
  font-weight: 400;
}

/* --- Registering --- */
.register {
  max-width: 32rem;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--rule);
}

.register-form p {
  margin: 0;
}

.register-form label,
.new-mech label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
}

.register-form button {
  align-self: flex-start;
  padding-inline: 0;
}

/* --- Hangar: mechs centred, so a single mech sits in the middle --- */
.hangar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hangar-head button {
  padding: 0;
  font-size: 0.8125rem;
}

.hangar-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--rule);
}

.mechs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mech-card {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  width: 11rem;
  padding: 0.6rem;
  border: 1px solid var(--rule);
  color: var(--text);
  font-size: 0.75rem;
  text-decoration: none;
}

.mech-card:hover,
.mech-card:focus-visible {
  border-color: var(--lilac);
}

.mech-name {
  margin-top: 0.35rem;
  color: var(--lilac);
  font-size: 0.9375rem;
  font-weight: 600;
}

.add-mech {
  max-width: 16rem;
}

.new-mech {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(100%, 24rem);
}

.new-mech p,
.hangar-body > p {
  margin: 0;
}

.actions {
  display: flex;
  gap: 1rem;
}

.actions button {
  padding-inline: 0;
  font-size: 0.875rem;
}

/* --- Narrow screens: one column, with the portrait between the top strip and appearance --- */
@media (max-width: 56rem) {
  .sheet {
    grid-template-areas: 'glance' 'side' 'writing' 'wide';
    grid-template-columns: minmax(0, 1fr);
  }

  /* A smaller portrait, so the writing isn't pushed a whole screen down. */
  .side :deep(.portrait) {
    width: min(100%, 14rem);
    margin-inline: auto;
  }

  .side p {
    text-align: center;
  }

  .callsign {
    font-size: 1.875rem;
  }

  /* The top strip, centred. */
  .glance {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .names {
    flex: none;
    align-items: center;
    width: 100%;
  }

  .names input {
    margin-left: 0;
    text-align: center;
  }

  .glance-facts dd {
    margin-inline: auto;
  }

  .save-status {
    min-width: 0;
    text-align: center;
  }
}
</style>
