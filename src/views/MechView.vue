<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EditableRichText from '../components/EditableRichText.vue'
import EntryList from '../components/EntryList.vue'
import GlitchText from '../components/GlitchText.vue'
import Panel from '../components/Panel.vue'
import Portrait from '../components/Portrait.vue'
import { parseEntries, type Entry } from '../entries'
import type { Json } from '../lib/database.types'
import { mechProblem, useMyPilot, type MechPrivate } from '../myPilot'
import type { PublicMech } from '../pilots'

// One of your mechs: its own page, opened from the hangar on pilot_management. The name, manufacturer id,
// appearance and image are public (on the pilot's card); history and quirks are private (in the sheet).
// Frames and loadouts arrive with the LANCER content packs.

const route = useRoute()
const router = useRouter()
const { character, sheet, loading, loadError, editable, mechs, updateCharacter, updateSheet } = useMyPilot()

const mechId = computed(() => String(route.params.mechId))
const mech = computed(() => mechs.value.find((m) => m.id === mechId.value))
const details = computed<MechPrivate>(() => sheet.value.mechs?.[mechId.value] ?? {})
const quirks = computed(() => parseEntries(details.value.quirks))

const OFFLINE_MODULES = ['frame', 'mounts and weapons', 'systems', 'mods']

// Public changes replace this mech in the pilot's mech list.
const savePublic = (changes: Partial<PublicMech>) =>
  updateCharacter({ mechs: mechs.value.map((m) => (m.id === mechId.value ? { ...m, ...changes } : m)) })

// Private changes merge into this mech's entry in the sheet.
const savePrivate = (changes: MechPrivate) =>
  updateSheet({ mechs: { ...sheet.value.mechs, [mechId.value]: { ...details.value, ...changes } } })

const saveAppearance = (doc: Json | null) => savePublic({ appearance: doc })
const saveHistory = (doc: Json | null) => savePrivate({ history: doc })
const saveQuirks = (list: Entry[]) => savePrivate({ quirks: list })

// --- Dossier: name and manufacturer id ---
const editingDossier = ref(false)
const draft = reactive({ name: '', manufacturerId: '' })
const dossierError = ref('')

function openDossier() {
  Object.assign(draft, { name: mech.value!.name, manufacturerId: mech.value!.manufacturer_id })
  dossierError.value = ''
  editingDossier.value = true
}

async function saveDossier() {
  const name = draft.name.trim()
  const manufacturerId = draft.manufacturerId.trim().toUpperCase()
  dossierError.value = mechProblem(name, manufacturerId) ?? (await savePublic({ name, manufacturer_id: manufacturerId })) ?? ''
  if (!dossierError.value) editingDossier.value = false
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
  <main class="page centered mech-page">
    <RouterLink :to="{ name: 'pilot' }" class="back">&lt; pilot_management</RouterLink>

    <p v-if="loading" class="dim">loading mech record...</p>
    <p v-else-if="loadError" class="rose" role="alert">{{ loadError }}</p>
    <p v-else-if="!mech" class="rose">no mech with that id in your hangar.</p>

    <template v-else>
      <h1><span class="prompt" aria-hidden="true">&gt; </span><GlitchText :text="mech.name" /></h1>

      <Panel title="mech dossier">
        <template #actions>
          <button v-if="editable && !editingDossier" type="button" @click="openDossier">edit</button>
        </template>

        <form v-if="editingDossier" class="edit-form" @submit.prevent="saveDossier">
          <div class="fields">
            <label>
              <span class="dim">mech name (required)</span>
              <input v-model="draft.name" type="text" required />
            </label>
            <label>
              <span class="dim">manufacturer id (XXXX-XXXX-XXXX)</span>
              <input v-model="draft.manufacturerId" type="text" required />
            </label>
          </div>
          <p v-if="dossierError" class="rose" role="alert">{{ dossierError }}</p>
          <div class="actions">
            <button type="submit">save</button>
            <button type="button" @click="editingDossier = false">cancel</button>
          </div>
        </form>

        <div v-else class="dossier">
          <Portrait :src="mech.image" :alt="`Image of ${mech.name}`" />
          <div class="dossier-info">
            <p class="mech-name">{{ mech.name }}</p>
            <dl class="facts">
              <div>
                <dt>manufacturer id</dt>
                <dd>{{ mech.manufacturer_id }}</dd>
              </div>
              <div>
                <dt>pilot</dt>
                <dd>{{ character?.callsign ?? character?.pilot_name }}</dd>
              </div>
              <div>
                <dt>frame</dt>
                <dd class="dim">not set (module offline)</dd>
              </div>
            </dl>
            <p class="dim small">image upload: module offline</p>
          </div>
        </div>
      </Panel>

      <div class="columns">
        <div class="column">
          <EditableRichText title="appearance" :doc="mech.appearance" :editable="editable" :save="saveAppearance" />
          <EditableRichText
            title="history"
            tag="private"
            :doc="details.history ?? null"
            :editable="editable"
            :save="saveHistory"
          />
        </div>

        <div class="column">
          <EntryList title="quirks" noun="quirk" tag="private" :entries="quirks" :editable="editable" :save="saveQuirks" />

          <Panel title="loadout">
            <ul class="modules">
              <li v-for="name in OFFLINE_MODULES" :key="name">
                <span>{{ name }}</span>
                <span class="dim">offline</span>
              </li>
            </ul>
            <p class="dim small">these open once the LANCER content packs are imported.</p>
          </Panel>

          <Panel v-if="editable" title="decommission">
            <p class="dim small">removes this mech from your hangar for good.</p>
            <p v-if="scrapError" class="rose" role="alert">{{ scrapError }}</p>
            <button type="button" class="scrap" @click="scrap">scrap mech</button>
          </Panel>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.mech-page {
  max-width: 64rem;
}

.mech-page :deep(.panel) {
  margin-bottom: 1.25rem;
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

.dossier {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.dossier-info p {
  margin: 0;
}

.dossier-info .mech-name {
  margin-bottom: 1rem;
  color: var(--lilac);
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 0.6rem 1.25rem;
  margin: 0 0 1rem;
}

.facts dt {
  color: var(--text-dim);
  font-size: 0.75rem;
}

.facts dd {
  margin: 0;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.edit-form p {
  margin: 0;
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 0.75rem 1rem;
}

.edit-form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
}

.actions {
  display: flex;
  gap: 1rem;
}

.actions button {
  padding-inline: 0;
  font-size: 0.875rem;
}

.columns {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 0 1.25rem;
  align-items: start;
}

.modules {
  margin: 0;
  padding: 0;
  list-style: none;
}

.modules li {
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0;
  font-size: 0.8125rem;
}

.modules + p {
  margin: 0.6rem 0 0;
}

.scrap {
  margin-top: 0.75rem;
  padding-inline: 0;
  color: var(--rose);
  font-size: 0.875rem;
}

@media (max-width: 64rem) {
  .columns {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 30rem) {
  .dossier {
    grid-template-columns: 6rem minmax(0, 1fr);
    gap: 1rem;
  }

  .dossier-info .mech-name {
    font-size: 1.375rem;
  }
}
</style>
