<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { confirmAction } from '../confirm'
import SheetTabs from '../components/SheetTabs.vue'
import ItemPicker from '../components/ItemPicker.vue'
import MechLoadout from '../components/MechLoadout.vue'
import Portrait from '../components/Portrait.vue'
import RuleCheck from '../components/RuleCheck.vue'
import InfoButton from '../components/InfoButton.vue'
import RulesText from '../components/RulesText.vue'
import StatIcon from '../components/StatIcon.vue'
import { makerColour, makerLogo, useManufacturers } from '../archive'
import { frameInfo } from '../info'
import SheetField from '../components/SheetField.vue'
import StatRow from '../components/StatRow.vue'
import type { Json } from '../lib/database.types'
import { useGameData } from '../gameData'
import { buildFrame, mechEffects, mechResources, mechStats, talentGrants, useMechData } from '../mechData'
import { mechProblem, useMyPilot, type MechPrivate } from '../myPilot'
import type { PublicMech } from '../pilots'
import { isLicensed, mechProblems } from '../rules'

// One of your mechs, opened from the hangar on my pilot, laid out like the pilot sheet: a summary strip (the
// manufacturer's registration plate: name, manufacturer id, pilot, frame), then section tabs (profile, stats,
// loadout), each a stack of panels. Everything is edited in place and saves itself. The name, manufacturer id,
// appearance and image are public (on the pilot's card); history, the frame, the stats and the loadout are
// private. The frame is chosen in the strip; its mounts and system points shape the loadout, and the stats are
// worked out from it. Quirks are off the page for now, like the pilot's traits (still in the sheet).
// Opened from someone else's record (route param "id"), it's the same page read-only, with the private
// sections only for their player, GMs and owners.

const route = useRoute()
const router = useRouter()
const pilotId = route.params.id ? Number(route.params.id) : undefined
const own = !pilotId
const { character, sheet, canSeePrivate, loading, loadError, editable, mechs, updateCharacter, updateSheet } = useMyPilot(pilotId)

// The breadcrumb: my pilot's hangar, or the list the pilot is in, then their record's hangar.
const list = computed(() =>
  character.value?.status === 'pending'
    ? { name: 'pending', label: 'pending' }
    : character.value?.status === 'dead'
      ? { name: 'memorial', label: 'memorial' }
      : { name: 'registry', label: 'registry' },
)
const hangar = own ? { name: 'pilot', query: { tab: 'mechs' } } : { name: 'pilot-record', params: { id: pilotId }, query: { tab: 'mechs' } }

// The sections, one at a time, remembered as ?tab= like the pilot sheet. Without the private sheet there's only
// the public profile, and no tab row.
const tabs = computed(() => (canSeePrivate.value ? ['profile', 'stats', 'loadout'] : ['profile']))
const tab = computed({
  get: () => (tabs.value.includes(String(route.query.tab)) ? String(route.query.tab) : 'profile'),
  set: (next: string) => router.replace({ query: { ...route.query, tab: next === 'profile' ? undefined : next } }),
})

// The tabs stick just under the summary strip, so they need its height.
const glance = useTemplateRef<HTMLElement>('glance')
const glanceHeight = ref(0)
const glanceObserver = new ResizeObserver(([entry]) => (glanceHeight.value = entry.borderBoxSize[0].blockSize))
watch(glance, (el, old) => {
  if (old) glanceObserver.unobserve(old)
  if (el) glanceObserver.observe(el)
})
onBeforeUnmount(() => glanceObserver.disconnect())

const mechId = computed(() => String(route.params.mechId))
const mech = computed(() => mechs.value.find((m) => m.id === mechId.value))
const details = computed<MechPrivate>(() => sheet.value.mechs?.[mechId.value] ?? {})

const { frames, weapons, systems, integrated } = useMechData()
const { gear, talents, coreBonuses } = useGameData()
const catalogue = computed(() => ({
  frames: frames.value,
  weapons: new Map(weapons.value.map(item => [item.id, item])),
  systems: new Map(systems.value.map(item => [item.id, item])),
  integrated: integrated.value,
  talents: talents.value,
  coreBonuses: coreBonuses.value,
  gear: gear.value,
}))
const baseFrame = computed(() => frames.value.find((f) => f.id === details.value.frame) ?? null)
// The page takes its manufacturer's colour and logo, from the packs, so new manufacturers just work. A frame is
// private: other players get no sheet, so no frame, and the neutral look gives nothing away.
const manufacturers = useManufacturers()
const maker = computed(() => manufacturers.value.find((m) => m.id === baseFrame.value?.source))
const logo = computed(() => makerLogo(maker.value))
const grants = computed(() => talentGrants(sheet.value, talents.value))
const optional = computed(() => grants.value.optional.map(id => integrated.value.get(id)).filter(item => !!item))
const availableWeapons = computed(() => [...weapons.value, ...optional.value.filter(item => !!item.mount)])
const availableSystems = computed(() => [...systems.value, ...optional.value.filter(item => !item.mount)])
const licences = computed(() => sheet.value.licences ?? {})
// This mech's rule check (src/rules.ts), once the catalogues have loaded.
const problems = computed(() =>
  frames.value.length
    ? mechProblems(details.value, sheet.value, catalogue.value)
    : [],
)
const effects = computed(() => mechEffects(details.value, sheet.value, catalogue.value))
const frame = computed(() => buildFrame(baseFrame.value, details.value, sheet.value, talents.value, effects.value.bonuses))
const stats = computed(() => mechStats(frame.value, sheet.value.mech_skills, effects.value.modifiers))
const resources = computed(() => mechResources(sheet.value, effects.value))
function capacityFor(changes: Partial<MechPrivate>) {
  const proposed = { ...details.value, ...changes }
  const bonuses = mechEffects(proposed, sheet.value, catalogue.value)
  const stats = mechStats(baseFrame.value, sheet.value.mech_skills, bonuses.modifiers)
  return { sp: stats.find(stat => stat.id === 'system_points')?.value ?? 0, ai: mechResources(sheet.value, bonuses).aiCap }
}
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
const saveLoadout = (changes: Partial<MechPrivate>) => savePrivate(changes)

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
        info: () => frameInfo(f, frames.value),
        licensed,
      }
    })
    .sort((a, b) => Number(b.licensed) - Number(a.licensed)),
)

async function chooseFrame(id: string) {
  const armed = (details.value.mounts ?? []).flat().some(Boolean)
  if (armed && !(await confirmAction("a new frame has different mounts, so this mech's weapons come off. go ahead?", { confirmLabel: 'change frame', danger: true })))
    return
  await track(savePrivate({ frame: id, mounts: [], core_mounts: {}, weapon_options: {} }))
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
  if (!(await confirmAction(`scrap ${mech.value!.name}? this can't be undone.`, { confirmLabel: 'scrap mech', danger: true }))) return
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
  <main class="page mech-page" :style="{ '--maker': makerColour(maker) }">
    <nav v-if="character" aria-label="Breadcrumb" class="crumbs">
      <ol>
        <li v-if="own"><RouterLink :to="hangar">my pilot</RouterLink></li>
        <template v-else>
          <li><RouterLink :to="{ name: list.name }">{{ list.label }}</RouterLink></li>
          <li><RouterLink :to="hangar">{{ character.callsign ?? character.pilot_name }}</RouterLink></li>
        </template>
        <li v-if="mech" aria-current="page">{{ mech.name }}</li>
      </ol>
    </nav>

    <p v-if="loading" class="dim">loading mech record...</p>
    <p v-else-if="loadError" class="rose" role="alert">{{ loadError }}</p>
    <p v-else-if="!mech" class="rose">no mech with that id in {{ own ? 'your' : 'this' }} hangar.</p>

    <div v-else class="sheet" :style="{ '--glance-h': `${glanceHeight}px` }">
      <!-- The summary strip: a registration plate in the manufacturer's colour. Sticks under the top bar on wide screens. -->
      <header ref="glance" class="glance">
        <StatIcon v-if="logo" :src="logo" class="plate-logo" />
        <span v-else-if="baseFrame?.source" class="plate-code">{{ baseFrame.source }}</span>
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
          <p v-if="own" class="save-status" role="status">
            <span v-if="saveError" class="rose">not saved: {{ saveError }}</span>
            <span v-else-if="status" class="dim">{{ status }}</span>
          </p>
        </div>
        <dl class="glance-facts">
          <div>
            <dt>pilot</dt>
            <dd>{{ character?.callsign ?? character?.pilot_name }}</dd>
          </div>
          <div v-if="baseFrame?.mechtype.length">
            <dt>class</dt>
            <dd class="class-name">{{ baseFrame.mechtype.join(' / ').toLowerCase() }}</dd>
          </div>
          <div v-if="canSeePrivate">
            <dt>frame</dt>
            <dd>
              <button v-if="editable" type="button" class="small" @click="framePicker?.open()">
                {{ frame ? `${frame.source} ${frame.name}` : 'choose frame' }}
              </button>
              <InfoButton v-else-if="baseFrame" :info="() => frameInfo(baseFrame!, frames)" :label="`${baseFrame.source} ${baseFrame.name}`" />
              <template v-else>none</template>
              <InfoButton v-if="editable && baseFrame" class="frame-info" :info="() => frameInfo(baseFrame!, frames)" :label="`${baseFrame.source} ${baseFrame.name}`">frame details</InfoButton>
            </dd>
          </div>
        </dl>
      </header>

      <RuleCheck v-if="canSeePrivate" :problems="problems" />

      <!-- One section at a time; v-show keeps every panel mounted, so switching never loses an open picker. -->
      <SheetTabs v-if="tabs.length > 1" v-model="tab" :tabs="tabs" label="mech sections" class="tabs" />

      <div v-show="tab === 'profile'" class="tab-panel profile">
        <!-- Right on wide screens; first on phones. -->
        <aside class="side panel">
          <Portrait :src="mech.image" :alt="`Image of ${mech.name}`">
            <StatIcon v-if="logo" :src="logo" class="portrait-logo" />
          </Portrait>
          <p v-if="own" class="dim note">image upload: module offline</p>
        </aside>

        <div class="writing">
          <SheetField class="panel" title="appearance" :doc="mech.appearance" :editable="editable" :save="saveAppearance" />
          <SheetField v-if="canSeePrivate" class="panel" title="history" tag="private" :doc="details.history ?? null" :editable="editable" :save="saveHistory" />
          <section v-if="editable" class="panel danger-zone">
            <h2 class="sheet-label">danger zone</h2>
            <div class="danger-body">
              <p class="dim">removes this mech from your hangar for good.</p>
              <button type="button" class="danger" @click="scrap">scrap mech</button>
            </div>
            <p v-if="scrapError" class="rose" role="alert">{{ scrapError }}</p>
          </section>
        </div>
      </div>

      <template v-if="canSeePrivate">
        <div v-show="tab === 'stats'" class="tab-panel">
          <StatRow class="panel" title="mech stats" tag="private" :stats="stats" :editable="false" :min="0" :max="0" />
          <section v-if="frame" class="panel readout">
            <h2 class="sheet-label">resources<span class="tag"> private</span></h2>
            <dl>
              <div><dt>ai capacity</dt><dd>{{ resources.aiCap }}</dd></div>
              <div v-if="resources.limited"><dt>limited items</dt><dd>{{ resources.limited > 0 ? '+' : '' }}{{ resources.limited }} uses</dd></div>
              <div><dt>repairing structure</dt><dd>{{ resources.structureRepairs }} repairs</dd></div>
              <div><dt>overcharge heat</dt><dd>{{ resources.overcharge }}</dd></div>
            </dl>
            <p v-for="(check, index) in resources.checks" :key="index"><strong>{{ check.source }}:</strong> {{ check.text }}</p>
          </section>
          <section v-if="frame && effects.reminders.length" class="panel effect-reminders">
            <h2 class="sheet-label">other effects and conditions<span class="tag"> private</span></h2>
            <p class="dim note">Only modifiers listed under stat sources are included automatically. Conditional effects, unsupported bonuses and other rules below need player or GM interpretation.</p>
            <ul>
              <li v-for="(reminder, index) in effects.reminders" :key="index">
                <strong>{{ reminder.source }}</strong>
                <RulesText :html="reminder.text" />
              </li>
            </ul>
          </section>
          <p v-if="!frame" class="empty">choose a frame to work out this mech's stats.</p>
        </div>

        <div v-show="tab === 'loadout'" class="tab-panel">
          <MechLoadout
            :frame="frame"
            :frames="frames"
            :licences="licences"
            :integrated="integrated"
            :weapons="availableWeapons"
            :systems="availableSystems"
            :sheet="sheet"
            :details="details"
            :bonuses="effects.bonuses"
            :superheavy-mounting="resources.superheavyMounting"
            :capacity-for="capacityFor"
            :mounts="details.mounts ?? []"
            :installed="details.systems ?? []"
            :sp-total="spTotal"
            :editable="editable"
            :save="saveLoadout"
          />
        </div>
      </template>

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
  </main>
</template>

<style scoped>
.sheet,
.tab-panel,
.writing {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
}

.note {
  font-size: 0.8125rem;
}

/* --- The manufacturer's look: --maker (set on the page) colours the labels and cards below. Tinted, not filled,
   so it stays calm; the content's own colours (tags, combat rules) keep their meaning. --- */
.sheet :deep(.sheet-label) {
  color: var(--maker);
}

.sheet :deep(.stat-row ul),
.sheet :deep(.slot) {
  border-color: color-mix(in srgb, var(--maker) 35%, var(--rule));
}

.sheet :deep(.slot) {
  border-top: 3px solid var(--maker);
}

.sheet :deep(.slot-head) {
  border-left: 0;
  background: color-mix(in srgb, var(--maker) 14%, var(--panel));
}

.sheet :deep(.slot-head h3) {
  color: var(--maker);
}

.side :deep(.portrait) {
  border-color: color-mix(in srgb, var(--maker) 45%, var(--rule));
}

.portrait-logo {
  display: block;
  margin: 0 auto 0.75rem;
  color: var(--maker);
  font-size: 5rem;
  opacity: 0.45;
}

/* --- Summary strip: a registration plate in the manufacturer's colour, with its logo, or its code as a stamp if
   the pack has no logo for it. --- */
.glance {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 2.5rem;
  padding: 0.9rem 1.25rem;
  border: 1px solid color-mix(in srgb, var(--maker) 45%, var(--rule));
  border-top: 4px solid var(--maker);
  background: color-mix(in srgb, var(--maker) 10%, var(--panel));
}

.plate-logo {
  color: var(--maker);
  font-size: 3.5rem;
}

.plate-code {
  padding: 0.35rem 0.6rem;
  border: 2px solid var(--maker);
  color: var(--maker);
  font-size: 1.25rem;
  font-weight: 700;
}

.class-name {
  color: var(--rose);
}

.names {
  display: flex;
  flex: 1 1 18rem;
  flex-direction: column;
  min-width: 0;
}

.mech-name {
  margin: 0;
  color: var(--maker);
  font: 700 2rem/1.15 var(--mono);
}

.maker-id {
  margin: 0;
  color: var(--text-dim);
  font-size: 1rem;
  letter-spacing: 0.05em;
}

/* Name and manufacturer id: plain text with a faint underline that says they can be edited (as my pilot). */
.inline {
  min-height: 0;
  margin-left: -0.35rem;
  padding: 0.1rem 0.35rem;
  border-color: transparent;
  border-bottom-color: var(--rule);
  background: none;
}

.inline:hover {
  border-color: var(--rule);
}

.glance-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2rem;
  margin: 0;
}

.glance-facts dt {
  color: var(--text-dim);
  font-size: 0.8125rem;
}

.glance-facts dd {
  margin: 0;
  font-size: 1.0625rem;
}

.frame-info {
  display: block;
  color: var(--text-dim);
  font-size: 0.8125rem;
}

.save-status {
  min-height: 1.25rem;
  margin: 0;
  font-size: 0.8125rem;
}

.tabs {
  padding-top: 0.6rem;
}

/* Sticky only where there's room: wide and tall screens. The tabs stick just under the strip. */
@media (min-width: 48rem) and (min-height: 40rem) {
  .glance {
    position: sticky;
    top: var(--topbar-h);
    z-index: 2;
  }

  .tabs {
    position: sticky;
    top: calc(var(--topbar-h) + var(--glance-h));
    z-index: 2;
    background: var(--void);
  }
}

/* --- Profile: writing on the left, the image on the right --- */
.profile {
  display: grid;
  grid-template-areas: 'writing side';
  grid-template-columns: minmax(0, 1fr) clamp(16rem, 24vw, 22rem);
  align-items: start;
}

.writing {
  grid-area: writing;
}

.side {
  grid-area: side;
}

.side p {
  margin: 0.35rem 0 0;
}

.danger-zone {
  border-color: var(--rose);
}

.sheet .danger-zone :deep(.sheet-label) {
  color: var(--rose);
}

.danger-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
}

.danger-zone p {
  margin: 0;
}

.danger-zone [role='alert'] {
  margin-top: 0.5rem;
}

/* --- Stats: the numbers that aren't stats, as tiles to match the stats above them; then the reminders --- */
.readout dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.6rem;
  margin: 0;
}

.readout dl div {
  padding: 0.5rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--maker) 35%, var(--rule));
  background: color-mix(in srgb, var(--maker) 6%, transparent);
  text-align: center;
}

.readout dt {
  color: var(--text-dim);
  font-size: 0.8125rem;
}

.readout dd {
  margin: 0;
  color: var(--maker);
  font-weight: 700;
}

.readout p {
  max-width: none;
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  text-align: center;
}

.readout p strong {
  color: var(--sky);
  font-weight: 400;
}

.effect-reminders {
  font-size: 0.875rem;
}

.effect-reminders > p {
  max-width: none;
}

.effect-reminders ul { margin: 0; padding: 0; list-style: none; }
.effect-reminders li { padding: 0.75rem 0; border-top: 1px solid var(--rule); }
.effect-reminders strong { color: var(--maker); }
.effect-reminders li .rules-text { margin-top: 0.25rem; }

/* The twelve mech stats as two even rows; below this width StatRow's own narrow layout takes over. */
@media (min-width: 56rem) {
  .sheet :deep(.stat-row ul) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

/* --- Narrow screens: one column, with the image first --- */
@media (max-width: 56rem) {
  .profile {
    grid-template-areas: 'side' 'writing';
    grid-template-columns: minmax(0, 1fr);
  }

  .side :deep(.portrait) {
    width: min(100%, 14rem);
    margin-inline: auto;
  }

  .side p {
    text-align: center;
  }
}

/* --- Phones: the strip stacked and centred --- */
@media (max-width: 48rem) {
  .crumbs ol {
    justify-content: center;
  }

  .glance {
    flex-direction: column;
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

  .mech-name {
    font-size: 1.75rem;
  }

  .glance-facts {
    justify-content: center;
  }
}
</style>
