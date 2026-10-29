<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Portrait from '../components/Portrait.vue'
import SheetField from '../components/SheetField.vue'
import StatRow from '../components/StatRow.vue'
import { mechStats } from '../gameData'
import type { Json } from '../lib/database.types'
import { mechProblem, useMyPilot, type MechPrivate } from '../myPilot'
import type { PublicMech } from '../pilots'

// One of your mechs, opened from the hangar on pilot_management, laid out like the pilot sheet: the name
// and manufacturer id across the top, writing on the left, the image on the right, then stats and loadout.
// Everything is edited in place and saves itself. The name, manufacturer id, appearance and image are
// public (on the pilot's card); history and the stats are private. Frames and loadouts arrive with the
// LANCER content packs. Quirks are off the page for now, like the pilot's traits (still in the sheet).
// Opened from someone else's record (route param "id"), it's the same page read-only, with the private
// sections only for their player, GMs and owners.

const route = useRoute()
const router = useRouter()
const pilotId = route.params.id ? Number(route.params.id) : undefined
const own = !pilotId
const { character, sheet, canSeePrivate, loading, loadError, editable, mechs, updateCharacter, updateSheet } = useMyPilot(pilotId)
const back = own
  ? { to: { name: 'pilot' }, label: 'pilot_management' }
  : { to: { name: 'pilot-record', params: { id: pilotId } }, label: 'pilot_record' }

const mechId = computed(() => String(route.params.mechId))
const mech = computed(() => mechs.value.find((m) => m.id === mechId.value))
const details = computed<MechPrivate>(() => sheet.value.mechs?.[mechId.value] ?? {})
const stats = mechStats()

const OFFLINE_MODULES = ['frame', 'mounts and weapons', 'systems', 'mods']

// --- The save status shown in the top strip, for the one-line fields ---
const status = ref('')
const saveError = ref('')

async function track(save: Promise<string | null>) {
  status.value = 'saving...'
  saveError.value = (await save) ?? ''
  status.value = saveError.value ? '' : 'saved'
}

// Public changes replace this mech in the pilot's mech list.
const savePublic = (changes: Partial<PublicMech>) =>
  updateCharacter({ mechs: mechs.value.map((m) => (m.id === mechId.value ? { ...m, ...changes } : m)) })

// Private changes merge into this mech's entry in the sheet.
const savePrivate = (changes: MechPrivate) =>
  updateSheet({ mechs: { ...sheet.value.mechs, [mechId.value]: { ...details.value, ...changes } } })

const saveAppearance = (doc: Json | null) => savePublic({ appearance: doc })
const saveHistory = (doc: Json | null) => savePrivate({ history: doc })

// The name and manufacturer id save when you leave them (or press enter). A bad one is put back.
function saveText(field: 'name' | 'manufacturer_id', event: Event) {
  const input = event.target as HTMLInputElement
  const value = field === 'name' ? input.value.trim() : input.value.trim().toUpperCase()
  const next = { name: mech.value!.name, manufacturer_id: mech.value!.manufacturer_id, [field]: value }
  const problem = mechProblem(next.name, next.manufacturer_id)
  if (problem) {
    saveError.value = problem
    input.value = mech.value![field]
    return
  }
  input.value = value
  track(savePublic({ [field]: value }))
}

// --- Scrapping: removes the mech from the pilot and its private details from the sheet ---
const scrapError = ref('')

async function scrap() {
  if (!window.confirm(`scrap ${mech.value!.name}? this can't be undone.`)) return
  const rest = { ...sheet.value.mechs }
  delete rest[mechId.value]
  scrapError.value =
    (await updateCharacter({ mechs: mechs.value.filter((m) => m.id !== mechId.value) })) ??
    (await updateSheet({ mechs: rest })) ??
    ''
  if (!scrapError.value) router.push({ name: 'pilot' })
}
</script>

<template>
  <main class="page mech-page">
    <RouterLink :to="back.to" class="back">&lt; {{ back.label }}</RouterLink>

    <p v-if="loading" class="dim">loading mech record...</p>
    <p v-else-if="loadError" class="rose" role="alert">{{ loadError }}</p>
    <p v-else-if="!mech" class="rose">no mech with that id in {{ own ? 'your' : 'this' }} hangar.</p>

    <div v-else class="sheet">
      <!-- At a glance: name, manufacturer id, pilot, frame. -->
      <header class="glance">
        <div class="names">
          <input
            v-if="editable"
            class="inline mech-name"
            type="text"
            aria-label="mech name"
            placeholder="mech name"
            :value="mech.name"
            @change="saveText('name', $event)"
          />
          <h1 v-else class="mech-name">{{ mech.name }}</h1>
          <input
            v-if="editable"
            class="inline maker-id"
            type="text"
            aria-label="manufacturer id (XXXX-XXXX-XXXX)"
            placeholder="XXXX-XXXX-XXXX"
            :value="mech.manufacturer_id"
            @change="saveText('manufacturer_id', $event)"
          />
          <p v-else class="maker-id">{{ mech.manufacturer_id }}</p>
        </div>
        <dl class="glance-facts">
          <div>
            <dt>pilot</dt>
            <dd>{{ character?.callsign ?? character?.pilot_name }}</dd>
          </div>
          <div>
            <dt>frame</dt>
            <dd class="dim">module offline</dd>
          </div>
        </dl>
        <p class="save-status" role="status">
          <span v-if="saveError" class="rose">not saved: {{ saveError }}</span>
          <span v-else class="dim">{{ status }}</span>
        </p>
        <p v-if="own && !editable" class="dim note">this pilot is approved. changes go through pending paperwork (module offline).</p>
      </header>

      <!-- Right on wide screens; between the top strip and appearance on phones. -->
      <aside class="side">
        <Portrait :src="mech.image" :alt="`Image of ${mech.name}`" />
        <p v-if="own" class="dim small">image upload: module offline</p>
      </aside>

      <div class="writing">
        <SheetField title="appearance" :doc="mech.appearance" :editable="editable" :save="saveAppearance" />
        <SheetField v-if="canSeePrivate" title="history" tag="private" :doc="details.history ?? null" :editable="editable" :save="saveHistory" />
      </div>

      <div class="wide">
        <template v-if="canSeePrivate">
          <StatRow title="mech stats" tag="private" :stats="stats" :editable="false" :min="0" :max="0" />
          <p class="dim small stats-note">worked out from the frame and piloting stats once the LANCER content packs are imported.</p>

          <section>
            <h2 class="sheet-label">loadout<span class="tag"> [private]</span></h2>
            <ul class="modules">
              <li v-for="name in OFFLINE_MODULES" :key="name">
                <span>{{ name }}</span>
                <span class="dim">module offline</span>
              </li>
            </ul>
          </section>
        </template>

        <section v-if="editable" class="decommission">
          <h2 class="sheet-label">decommission</h2>
          <p class="dim small">removes this mech from your hangar for good.</p>
          <p v-if="scrapError" class="rose" role="alert">{{ scrapError }}</p>
          <button type="button" class="scrap" @click="scrap">scrap mech</button>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Full width, like the pilot sheet. */
.mech-page {
  max-width: none;
}

.back {
  display: inline-block;
  margin-bottom: 1rem;
  color: var(--text-dim);
  font-size: 0.875rem;
  text-decoration: none;
}

.back:hover {
  color: var(--lilac);
}

.small {
  font-size: 0.75rem;
}

/* --- Layout: top strip across, writing left, image right, then full-width sections (as pilot_management) --- */
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

.mech-name {
  margin: 0;
  color: var(--lilac);
  font: 700 2.5rem/1.1 var(--mono);
}

.maker-id {
  margin: 0;
  color: var(--text-dim);
  font-size: 1.125rem;
  letter-spacing: 0.05em;
}

input.mech-name,
input.maker-id {
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

.save-status {
  min-width: 8rem;
  margin: 0;
  font-size: 0.8125rem;
  text-align: right;
}

.note {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.8125rem;
}

.side p {
  margin: 0.35rem 0 0;
}

/* --- Stats, loadout, decommission --- */
.stats-note {
  margin: -1.25rem 0 0;
}

.modules {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--rule);
  list-style: none;
}

.modules li {
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0;
  font-size: 0.8125rem;
}

.decommission p {
  margin: 0.5rem 0 0;
}

.scrap {
  margin-top: 0.5rem;
  padding-inline: 0;
  color: var(--rose);
  font-size: 0.875rem;
}

/* --- Narrow screens: one column, with the image between the top strip and appearance --- */
@media (max-width: 56rem) {
  .sheet {
    grid-template-areas: 'glance' 'side' 'writing' 'wide';
    grid-template-columns: minmax(0, 1fr);
  }

  .side :deep(.portrait) {
    width: min(100%, 14rem);
    margin-inline: auto;
  }

  .side p {
    text-align: center;
  }

  .mech-name {
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

  .save-status {
    min-width: 0;
    text-align: center;
  }
}
</style>
