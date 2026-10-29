<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ItemPicker from '../components/ItemPicker.vue'
import MechLoadout from '../components/MechLoadout.vue'
import Portrait from '../components/Portrait.vue'
import RuleCheck from '../components/RuleCheck.vue'
import ReviewText from '../components/ReviewText.vue'
import { sameContent } from '../textDiff'
import SheetField from '../components/SheetField.vue'
import StatRow from '../components/StatRow.vue'
import type { Json } from '../lib/database.types'
import { mechStats, useMechData } from '../mechData'
import { mechProblem, useMyPilot, type MechPrivate, type PilotSnapshot } from '../myPilot'
import type { PublicMech } from '../pilots'
import { isLicensed, mechProblems } from '../rules'

// One of your mechs, opened from the hangar on my pilot, laid out like the pilot sheet: the name
// and manufacturer id across the top, writing on the left, the image on the right, then stats and loadout.
// Everything is edited in place and saves itself. The name, manufacturer id, appearance and image are
// public (on the pilot's card); history, the frame, the stats and the loadout are private. The frame is
// chosen at the top right; its mounts and system points shape the loadout, and the stats are worked out
// from it. Quirks are off the page for now, like the pilot's traits (still in the sheet).
// Opened from someone else's record (route param "id"), it's the same page read-only, with the private
// sections only for their player, GMs and owners.

const props = defineProps<{ snapshot?: PilotSnapshot; before?: PilotSnapshot; previewMechId?: string }>()
const route = useRoute()
const router = useRouter()
const pilotId = props.snapshot?.character.id ?? (route.params.id ? Number(route.params.id) : undefined)
const own = !props.snapshot && !pilotId
const { character, sheet, canSeePrivate, loading, loadError, editable, mechs, updateCharacter, updateSheet } = useMyPilot(pilotId, props.snapshot)
const back = own
  ? { to: { name: 'pilot' }, label: 'my pilot' }
  : { to: { name: 'pilot-record', params: { id: pilotId } }, label: 'pilot record' }

const mechId = computed(() => String(props.previewMechId ?? route.params.mechId))
const mech = computed(() => mechs.value.find((m) => m.id === mechId.value))
const details = computed<MechPrivate>(() => sheet.value.mechs?.[mechId.value] ?? {})

const beforeMech = computed(() => (props.before?.character.mechs as unknown as PublicMech[] | undefined)?.find(m => m.id === mechId.value))
const beforeDetails = computed(() => props.before?.sheet.mechs?.[mechId.value] ?? {})
const changed = (a: unknown, b: unknown) => !!props.before && !sameContent(a, b)

const { frames, weapons, systems, integrated } = useMechData()
const frame = computed(() => frames.value.find((f) => f.id === details.value.frame) ?? null)
const licences = computed(() => sheet.value.licences ?? {})
// This mech's rule check (src/rules.ts), once the catalogues have loaded.
const problems = computed(() =>
  frames.value.length
    ? mechProblems(details.value, sheet.value, {
        frames: frames.value,
        weapons: new Map(weapons.value.map((w) => [w.id, w])),
        systems: new Map(systems.value.map((s) => [s.id, s])),
        integrated: integrated.value,
      })
    : [],
)
const stats = computed(() => mechStats(frame.value, sheet.value.mech_skills))
const spTotal = computed(() => stats.value.find((stat) => stat.id === 'system_points')!.value)

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
const saveLoadout = (changes: Pick<MechPrivate, 'mounts' | 'systems'>) => savePrivate(changes)

// --- The frame, picked at the top right. A new frame has different mounts, so its weapons come off. ---
// A licensed frame needs rank II in its own licence; GMS frames need none.
const framePicker = useTemplateRef('framePicker')
const frameOptions = computed(() =>
  frames.value
    .map((f) => {
      const licensed = isLicensed({ licenceId: f.id, licenceLevel: f.licenceLevel }, licences.value)
      return {
        id: f.id,
        name: `${f.source} ${f.name}`,
        meta: [f.mechtype.join('/'), `mounts: ${f.mounts.join(', ')}`, f.licenceLevel ? 'licence rank II' : 'gms']
          .filter(Boolean)
          .join(', ')
          .toLowerCase(),
        blocked: licensed ? '' : 'needs licence II',
        licensed,
      }
    })
    .sort((a, b) => Number(b.licensed) - Number(a.licensed)),
)

async function chooseFrame(id: string) {
  const armed = (details.value.mounts ?? []).flat().some(Boolean)
  if (armed && !window.confirm("a new frame has different mounts, so this mech's weapons come off. go ahead?")) return
  await track(savePrivate({ frame: id, mounts: [] }))
  if (!saveError.value) framePicker.value?.close()
}

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
  <component :is="props.snapshot ? 'section' : 'main'" class="page mech-page" :class="{ preview: props.snapshot }">
    <RouterLink v-if="!props.snapshot" :to="back.to" class="back">&lt; {{ back.label }}</RouterLink>

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
          <h1 v-else class="mech-name"><ReviewText v-if="props.before" :before="beforeMech?.name" :after="mech.name" /><template v-else>{{ mech.name }}</template></h1>
          <input
            v-if="editable"
            class="inline maker-id"
            type="text"
            aria-label="manufacturer id (XXXX-XXXX-XXXX)"
            placeholder="XXXX-XXXX-XXXX"
            :value="mech.manufacturer_id"
            @change="saveText('manufacturer_id', $event)"
          />
          <p v-else class="maker-id"><ReviewText v-if="props.before" :before="beforeMech?.manufacturer_id" :after="mech.manufacturer_id" /><template v-else>{{ mech.manufacturer_id }}</template></p>
        </div>
        <div class="glance-side">
          <dl class="glance-facts">
            <div>
              <dt>pilot</dt>
              <dd>{{ character?.callsign ?? character?.pilot_name }}</dd>
            </div>
            <div v-if="canSeePrivate" :class="{ 'review-changed': changed(beforeDetails.frame, details.frame) }">
              <dt>frame</dt>
              <dd>
                <button v-if="editable" type="button" class="frame-button" @click="framePicker?.open()">
                  {{ frame ? `${frame.source} ${frame.name}` : 'choose frame' }}
                </button>
                <template v-else>{{ frame ? `${frame.source} ${frame.name}` : 'none' }}</template>
              </dd>
            </div>
          </dl>
          <p v-if="own" class="save-status" role="status">
            <span v-if="saveError" class="rose">not saved: {{ saveError }}</span>
            <span v-else class="dim">{{ status }}</span>
          </p>
        </div>
        <RuleCheck v-if="canSeePrivate" class="full" :problems="problems" />
      </header>

      <!-- Right on wide screens; between the top strip and appearance on phones. -->
      <aside class="side">
        <Portrait :class="{ 'review-changed': changed(beforeMech?.image, mech.image) }" :src="mech.image" :alt="`Image of ${mech.name}`" />
        <p v-if="own" class="dim small">image upload: module offline</p>
      </aside>

      <div class="writing">
        <SheetField :comparison="props.before ? { doc: beforeMech?.appearance } : undefined" title="appearance" :doc="mech.appearance" :editable="editable" :save="saveAppearance" />
        <SheetField v-if="canSeePrivate" title="history" :comparison="props.before ? { doc: beforeDetails.history } : undefined" tag="private" :doc="details.history ?? null" :editable="editable" :save="saveHistory" />
      </div>

      <div class="wide">
        <template v-if="canSeePrivate">
          <StatRow :class="{ 'review-changed': changed(props.before?.sheet.mech_skills, sheet.mech_skills) || changed(beforeDetails.frame, details.frame) }" title="mech stats" tag="private" :stats="stats" :editable="false" :min="0" :max="0" />
          <p class="dim small stats-note">
            {{
              frame
                ? 'worked out from the frame and piloting stats. talents and core bonuses are not counted yet.'
                : 'choose a frame (top right) to work these out.'
            }}
          </p>

          <MechLoadout
            :class="{ 'review-changed': changed(beforeDetails.mounts, details.mounts) || changed(beforeDetails.systems, details.systems) || changed(beforeDetails.frame, details.frame) }"
            :frame="frame"
            :frames="frames"
            :licences="licences"
            :integrated="integrated"
            :weapons="weapons"
            :systems="systems"
            :mounts="details.mounts ?? []"
            :installed="details.systems ?? []"
            :sp-total="spTotal"
            :editable="editable"
            :save="saveLoadout"
          />
        </template>

        <section v-if="editable" class="decommission">
          <h2 class="sheet-label">decommission</h2>
          <p class="dim small">removes this mech from your hangar for good.</p>
          <p v-if="scrapError" class="rose" role="alert">{{ scrapError }}</p>
          <button type="button" class="scrap" @click="scrap">scrap mech</button>
        </section>
      </div>

      <ItemPicker
        v-if="editable"
        ref="framePicker"
        title="choose a frame"
        :options="frameOptions"
        :current="details.frame"
        :error="saveError"
        @choose="chooseFrame"
      />
    </div>
  </component>
</template>

<style scoped>
/* Full width, like the pilot sheet. */
.preview { padding: 0; }

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

/* --- Layout: top strip across, writing left, image right, then full-width sections (as my pilot) --- */
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

/* The rule check takes the whole width of the top strip. */
.full {
  flex-basis: 100%;
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
  align-items: center;
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

/* Player and status (or pilot and frame) on the right, centred against the callsign and name. The save
   status hangs just below without taking up room, so it doesn't pull them off centre. */
.glance-side {
  position: relative;
}

.glance-facts {
  display: flex;
  gap: 2.5rem;
  margin: 0;
}

.glance-facts dt {
  color: var(--text-dim);
  font-size: 0.8125rem;
}

.glance-facts dd {
  margin: 0;
  font-size: 1.125rem;
}

.save-status {
  position: absolute;
  top: calc(100% + 0.2rem);
  right: 0;
  margin: 0;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.side p {
  margin: 0.35rem 0 0;
}

/* --- Stats, loadout, decommission --- */
.stats-note {
  margin: -1.25rem 0 0;
}

/* The frame at the top right: a button while editable, at the size of the other facts. */
.frame-button {
  padding: 0;
  font-size: 1rem;
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
  .glance-side {
    max-width: 100%;
  }

  .glance-facts {
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem 1.5rem;
  }

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
    position: static;
    min-height: 1.25rem;
    margin-top: 0.35rem;
    text-align: center;
    white-space: normal;
  }
}
</style>
