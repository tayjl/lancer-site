<script setup lang="ts">
import { computed, ref, useTemplateRef, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { confirmAction } from '../confirm'
import SheetTabs from '../components/SheetTabs.vue'
import ItemPicker from '../components/ItemPicker.vue'
import MechLoadout from '../components/MechLoadout.vue'
import Portrait from '../components/Portrait.vue'
import RuleCheck from '../components/RuleCheck.vue'
import InfoButton from '../components/InfoButton.vue'
import RulesText from '../components/RulesText.vue'
import Icon from '../components/Icon.vue'
import ActionChip from '../components/ActionChip.vue'
import { makerColour, makerLogo, useManufacturers } from '../archive'
import { frameInfo } from '../info'
import SheetField from '../components/SheetField.vue'
import StatRow from '../components/StatRow.vue'
import type { Json } from '../lib/database.types'
import { useGameData } from '../gameData'
import { buildFrame, mechEffects, mechResources, mechStats, talentGrants, useMechData, type ReminderKind } from '../mechData'
import { mechProblem, useMyPilot, type MechPrivate } from '../myPilot'
import type { PublicMech } from '../pilots'
import { sectionOverride } from '../router'
import { isLicensed, mechProblems } from '../rules'

// One of your mechs, opened from the hangar on my pilot, laid out like the pilot sheet: the registration plate (the
// maker's logo and a thin top border in its colour, the name, manufacturer id, frame and class, then pilot, size and
// system points), then a slim sticky row of section tabs (profile, stats, loadout), each a stack of panels. Everything is edited in place and saves itself. The name, manufacturer id,
// appearance and image are public (on the pilot's card); history, the frame, the stats and the loadout are
// private. The frame is chosen in the strip; its mounts and system points shape the loadout, and the stats are
// worked out from it. Quirks are off the page for now, like the pilot's traits (still in the sheet).
// Opened from someone else's record (route param "id"), it's the same page read-only, with the private
// sections only for their player, GMs and owners.

const route = useRoute()
const router = useRouter()
const pilotId = route.params.id ? Number(route.params.id) : undefined
const own = !pilotId
const { character, sheet, canSeePrivate, loading, loadError, editable, mechs, draft, updateCharacter, updateSheet } = useMyPilot(pilotId)

// The breadcrumb: my pilot's hangar, or the list the pilot is in, then their record's hangar.
const list = computed(() =>
  character.value?.status === 'pending'
    ? { name: 'pending', label: 'pending' }
    : character.value?.status === 'dead'
      ? { name: 'memorial', label: 'memorial' }
      : { name: 'registry', label: 'registry' },
)
// The top bar marks that list too (src/router.ts).
if (route.name === 'record-mech') watchEffect(() => (sectionOverride.value = list.value.name))
const hangar = own ? { name: 'pilot', query: { tab: 'mechs' } } : { name: 'pilot-record', params: { id: pilotId }, query: { tab: 'mechs' } }

// The sections, one at a time, remembered as ?tab= like the pilot sheet. Without the private sheet there's only
// the public profile, and no tab row.
const tabs = computed(() => (canSeePrivate.value ? ['profile', 'stats', 'loadout'] : ['profile']))
const tab = computed({
  get: () => (tabs.value.includes(String(route.query.tab)) ? String(route.query.tab) : 'profile'),
  set: (next: string) => router.replace({ query: { ...route.query, tab: next === 'profile' ? undefined : next } }),
})

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
// The plate shows its manufacturer as the logo and a thin top border in its colour (nothing else), from the packs, so
// new manufacturers just work. A frame is private: other players get no sheet, so no frame, and the neutral plate
// gives nothing away.
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
const size = computed(() => stats.value.find((stat) => stat.id === 'size')!.value)
// System points used, for the plate (counted as MechLoadout counts them).
const spUsed = computed(() => {
  const weaponsById = new Map(availableWeapons.value.map((item) => [item.id, item]))
  const systemsById = new Map(availableSystems.value.map((item) => [item.id, item]))
  return (
    (details.value.mounts ?? []).flat().reduce((sum, id) => sum + (id ? (weaponsById.get(id)?.sp ?? 0) : 0), 0) +
    (details.value.systems ?? []).reduce((sum, id) => sum + (systemsById.get(id)?.sp ?? 0), 0)
  )
})
// The rule check speaks to whoever can fix it: you, on your own editable mech.
const ruleFix = computed(() => (own && editable.value ? (draft.value ? 'draft' : 'own') : undefined))
// Each kind of "other effect": its symbol and its uppercase label.
const EFFECT_KINDS: Record<ReminderKind, { icon: string; label: string }> = {
  frame: { icon: 'frame', label: 'Frame' },
  trait: { icon: 'trait', label: 'Frame trait' },
  core: { icon: 'corebonus', label: 'Core system' },
  'core-power': { icon: 'corebonus', label: 'Core power' },
  'core-bonus': { icon: 'corebonus', label: 'Core bonus' },
  talent: { icon: 'talent', label: 'Talent' },
  item: { icon: 'system', label: 'Equipment' },
  missing: { icon: 'warning', label: 'Unavailable' },
}

// --- The save status shown on the plate, for the one-line fields ---
const status = ref('')
const saveError = ref('')

async function track(save: Promise<string | null>) {
  status.value = 'Saving…'
  saveError.value = (await save) ?? ''
  status.value = saveError.value ? '' : 'Saved'
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
        meta: [f.mechtype.join('/'), `Mounts: ${f.mounts.join(', ')}`, f.licenceLevel ? 'Licence rank II' : 'GMS'].filter(Boolean),
        blocked: licensed ? '' : 'Needs licence II',
        info: () => frameInfo(f, frames.value),
        licensed,
      }
    })
    .sort((a, b) => Number(b.licensed) - Number(a.licensed)),
)

async function chooseFrame(id: string) {
  const armed = (details.value.mounts ?? []).flat().some(Boolean)
  if (armed && !(await confirmAction("A new frame has different mounts, so this mech's weapons come off. Go ahead?", { confirmLabel: 'Change frame', danger: true })))
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
  if (!(await confirmAction(`Scrap ${mech.value!.name}? This can't be undone.`, { confirmLabel: 'Scrap mech', danger: true }))) return
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
    <nav v-if="character" aria-label="Breadcrumb" class="crumbs">
      <ol>
        <li v-if="own"><RouterLink :to="hangar">My pilot</RouterLink></li>
        <template v-else>
          <li><RouterLink :to="{ name: list.name }">{{ list.label }}</RouterLink></li>
          <li><RouterLink :to="hangar">{{ character.callsign ?? character.pilot_name }}</RouterLink></li>
        </template>
        <li v-if="mech" aria-current="page">{{ mech.name }}</li>
      </ol>
    </nav>

    <p v-if="loading" class="dim">Loading mech record…</p>
    <p v-else-if="loadError" class="notice warn" role="alert">{{ loadError }}</p>
    <p v-else-if="!mech" class="notice warn" role="alert">No mech with that id in {{ own ? 'your' : 'this' }} hangar.</p>

    <div v-else class="sheet">
      <!-- The registration plate. The manufacturer's colour is only the logo and the 3px top border (--mf). -->
      <header class="plate" :class="{ joined: own && draft }" :style="maker ? { '--mf': makerColour(maker) } : undefined">
        <Icon v-if="logo" :src="logo" class="plate-logo" />
        <span v-else-if="baseFrame?.source" class="plate-code code">{{ baseFrame.source }}</span>
        <Icon v-else name="frame" class="plate-logo neutral" />
        <div class="who">
          <!-- While editable the name is a field, so the page's heading is for screen readers only. -->
          <h1 v-if="editable" class="sr-only">{{ mech.name || 'Mech' }}</h1>
          <input
            v-if="editable"
            class="inline mech-name"
            type="text"
            aria-label="Mech name"
            placeholder="Mech name"
            :value="mech.name"
            @change="saveText('name', $event)"
          />
          <h1 v-else class="mech-name">{{ mech.name }}</h1>
          <div class="subline sep">
            <span>
              <input
                v-if="editable"
                class="inline maker-id code"
                type="text"
                aria-label="Manufacturer ID (XXXX-XXXX-XXXX)"
                placeholder="XXXX-XXXX-XXXX"
                :value="mech.manufacturer_id"
                @change="saveText('manufacturer_id', $event)"
              />
              <span v-else class="maker-id code">{{ mech.manufacturer_id }}</span>
            </span>
            <span v-if="canSeePrivate">
              <button v-if="editable" type="button" class="small" @click="framePicker?.open()">
                {{ baseFrame ? `${baseFrame.source} ${baseFrame.name}` : 'Choose frame' }}
              </button>
              <InfoButton v-else-if="baseFrame" :info="() => frameInfo(baseFrame!, frames)" :label="`${baseFrame.source} ${baseFrame.name}`" />
              <template v-else>No frame</template>
            </span>
            <span v-if="editable && baseFrame">
              <InfoButton class="frame-info" :info="() => frameInfo(baseFrame!, frames)" :label="`${baseFrame.source} ${baseFrame.name}`">Frame details</InfoButton>
            </span>
            <span v-if="baseFrame?.mechtype.length">{{ baseFrame.mechtype.join(' / ') }}</span>
          </div>
          <p v-if="own && (saveError || status)" class="save-status" role="status">
            <span v-if="saveError" class="error">Not saved: {{ saveError }}</span>
            <span v-else class="dim">{{ status }}</span>
          </p>
        </div>
        <dl class="facts">
          <div class="fact">
            <dt class="label">Pilot</dt>
            <dd class="pilot">{{ character?.callsign ?? character?.pilot_name }}</dd>
          </div>
          <template v-if="frame">
            <div class="fact">
              <dt class="label">Size</dt>
              <dd class="fact-value num">{{ size === 0.5 ? '½' : size }}</dd>
            </div>
            <div class="fact">
              <dt class="label">System points</dt>
              <dd class="fact-value num" :class="{ over: spUsed > (spTotal ?? 0) }">{{ spUsed }} / {{ spTotal }}</dd>
            </div>
          </template>
        </dl>
      </header>

      <!-- Mech edits go into the pilot's open change (src/myPilot.ts), which this page otherwise wouldn't show. -->
      <div v-if="own && draft" class="next">
        <span class="badge" :class="draft.submitted_at ? 'pending' : 'draft'">{{ draft.submitted_at ? 'Change submitted' : 'Draft change' }}</span>
        <p v-if="!draft.submitted_at">Edits to this mech go into your draft change. Submit it from <RouterLink :to="{ name: 'pilot' }">My pilot</RouterLink>.</p>
        <p v-else>Change submitted, waiting on a GM, so this mech is read-only. To edit it, choose Edit change on <RouterLink :to="{ name: 'pilot' }">My pilot</RouterLink>.</p>
      </div>

      <RuleCheck v-if="canSeePrivate" :problems="problems" :fix="ruleFix" />

      <!-- One section at a time; v-show keeps every panel mounted, so switching never loses an open picker. Only this
           slim row sticks (under the top bar). -->
      <SheetTabs v-if="tabs.length > 1" v-model="tab" :tabs="tabs" label="Mech sections" class="sheet-tabs" />

      <div v-show="tab === 'profile'" class="tab-panel">
        <div class="profile">
          <div class="writing">
            <SheetField class="panel" title="Appearance" :doc="mech.appearance" :editable="editable" :save="saveAppearance" />
            <SheetField v-if="canSeePrivate" class="panel" title="History" tag="Private" :doc="details.history ?? null" :editable="editable" :save="saveHistory" />
          </div>
          <section class="panel">
            <h2 class="sheet-label">Image</h2>
            <Portrait class="mech-portrait" :src="mech.image" :alt="`Image of ${mech.name}`" />
            <p v-if="own" class="dim upload">Image upload isn't available yet.</p>
          </section>
        </div>
        <section v-if="editable" class="panel danger-zone">
          <h2 class="sheet-label">Danger zone</h2>
          <div class="danger-body">
            <p class="dim">Scrapping {{ mech.name }} removes it and its loadout from your hangar for good.</p>
            <button type="button" class="danger" @click="scrap">Scrap mech</button>
          </div>
          <p v-if="scrapError" class="notice warn" role="alert">{{ scrapError }}</p>
        </section>
      </div>

      <template v-if="canSeePrivate">
        <div v-show="tab === 'stats'" class="tab-panel">
          <StatRow class="panel mech-stats" title="Mech stats" tag="Private" :stats="stats" :editable="false" :min="0" :max="0" />
          <section v-if="frame" class="panel">
            <h2 class="sheet-label">Resources<span class="private">Private</span></h2>
            <ul class="resources">
              <li><span class="value num">{{ resources.aiCap }}</span><span class="name">AI capacity</span></li>
              <li v-if="resources.limited">
                <span class="value num">{{ resources.limited > 0 ? '+' : '' }}{{ resources.limited }}</span><span class="name">Limited uses</span>
              </li>
              <li><span class="value num">{{ resources.structureRepairs }}</span><span class="name">Structure repair cost</span></li>
              <li><span class="value num long">{{ resources.overcharge }}</span><span class="name">Overcharge heat</span></li>
            </ul>
            <p v-for="(check, index) in resources.checks" :key="index" class="check"><b>{{ check.source }}:</b> {{ check.text }}</p>
          </section>
          <section v-if="frame && effects.reminders.length" class="panel">
            <h2 class="sheet-label">Other effects and conditions<span class="private">Private</span></h2>
            <p class="dim intro">Only the modifiers listed under the stats' sources are counted. These need you or the GM to apply them.</p>
            <ul class="effects">
              <li v-for="(reminder, index) in effects.reminders" :key="index">
                <Icon :name="EFFECT_KINDS[reminder.kind].icon" />
                <div class="effect">
                  <p class="label">{{ EFFECT_KINDS[reminder.kind].label }}{{ reminder.from ? `: ${reminder.from}` : '' }}</p>
                  <p class="effect-head">
                    <ActionChip :activation="reminder.activation" />
                    <b>{{ reminder.name }}</b>
                  </p>
                  <RulesText :html="reminder.text" />
                  <p v-if="reminder.uncounted" class="dim uncounted">Not counted in the stats above.</p>
                </div>
              </li>
            </ul>
          </section>
          <p v-if="!frame" class="empty">Choose a frame to work out this mech's stats.</p>
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
        title="Choose a frame"
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

/* --- The registration plate (the prototype's .plate): no tint, the maker only as the logo and the top border --- */
.plate {
  --mf: var(--rule);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-l);
  padding: var(--space-l);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--mf);
  border-radius: var(--radius);
  background: var(--panel);
  overflow-wrap: anywhere; /* a long unbroken name wraps instead of widening the page */
}

/* With the draft bar under it, the two read as one block. */
.plate.joined {
  border-radius: var(--radius) var(--radius) 0 0;
}

.plate-logo {
  width: 56px;
  height: 56px;
  color: var(--mf);
}

.plate-logo.neutral {
  color: var(--text-dim);
}

/* A maker with no bundled logo: its code as a stamp, in the text colour (the colour stays on the border). */
.plate-code {
  padding: 6px 8px;
  border: 2px solid var(--edge);
  border-radius: var(--radius);
  font-size: var(--fs-l);
  font-weight: 700;
}

.who {
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* don't stretch the fields: they size to their text */
  min-width: 0;
}

.mech-name {
  margin: 0;
  color: var(--text);
  font: 800 var(--fs-xl) / 1.1 var(--sans);
  letter-spacing: 0.02em;
}

.subline {
  align-self: stretch;
  margin-top: 4px;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.maker-id {
  color: var(--text-dim);
  font-size: var(--fs-s);
  letter-spacing: 0.08em;
}

/* The frame button sits in the line at text height. */
.subline button {
  min-height: 26px;
}

.frame-info {
  color: var(--lilac);
}

/* Name and manufacturer id: plain text with a faint underline that says they can be edited (as my pilot). */
.inline {
  min-height: 0;
  margin-left: -6px;
  padding: 1px 6px;
  border-color: transparent;
  border-bottom-color: var(--rule);
  background: none;
  /* Hug the text. shortcut: Firefox has no field-sizing and keeps its default ~20ch width; fine until Firefox ships it. */
  width: auto;
  min-width: 8ch;
  max-width: 100%;
  field-sizing: content;
}

.inline:hover {
  border-color: var(--rule);
}

/* The id's item in the dot-separated line keeps the field's full width; no percentage cap, which would clip it. */
.subline > :first-child {
  flex-shrink: 0;
  max-width: 100%;
}

.inline.maker-id {
  max-width: none;
}

.save-status {
  margin: 4px 0 0;
  font-size: var(--fs-xs);
}

.save-status .error {
  color: var(--danger);
}

.facts {
  display: grid;
  grid-template-rows: auto auto;
  grid-auto-flow: column;
  gap: 2px var(--space-xl);
  margin: 0;
}

.fact {
  display: grid;
  grid-row: span 2;
  grid-template-rows: subgrid;
  align-content: start;
}

.fact dd {
  margin: 0;
}

.pilot {
  align-self: end;
  font-weight: 700;
}

.fact-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
}

/* Red only when over: the maker's red never means that. */
.fact-value.over {
  color: var(--danger);
}

/* --- The draft bar, joined to the plate's foot (as my pilot's next-step bar) --- */
.next {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
  margin-top: calc(-1 * var(--space-m)); /* joined to the plate: cancels the sheet's gap */
  padding: var(--space-s) var(--space-l);
  border: 1px solid var(--rule);
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
  background: var(--void);
  font-size: var(--fs-s);
}

.next p {
  max-width: none;
  margin: 0;
}

/* --- Tabs: the only thing that sticks, under the top bar --- */
.sheet-tabs {
  position: sticky;
  top: var(--topbar-h);
  z-index: 2;
  background: var(--void);
}

.tab-panel * {
  scroll-margin-top: calc(var(--topbar-h) + var(--tabs-h) + var(--space-l));
}

/* --- Profile: writing on the left, the image on the right; one column on phones (below) --- */
.profile {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
  align-items: start;
  gap: var(--space-m);
}

.mech-portrait {
  width: 100%;
  max-width: 160px;
  border-radius: var(--radius);
}

.upload {
  margin: var(--space-s) 0 0;
  font-size: var(--fs-s);
}

.danger-zone {
  border-color: color-mix(in srgb, var(--danger) 40%, transparent);
}

.danger-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-l);
}

.danger-body p {
  flex: 1 1 14rem;
  max-width: none;
  margin: 0;
  font-size: var(--fs-s);
}

.danger-zone [role='alert'] {
  margin-top: var(--space-s);
}

/* The twelve mech stats as two even rows; below this width StatRow's own narrow layout takes over. */
@media (min-width: 56rem) {
  .mech-stats :deep(.stats) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

/* --- Resources: the numbers that aren't stats, as tiles like the stat tiles above them --- */
.resources {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.resources li {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: var(--space-s) 6px var(--space-m);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--void);
  text-align: center;
}

.resources .value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.15;
}

/* The overcharge ladder is a sequence ("1 → 1d3 → 1d6 → 1d6+4"), not one number. */
.resources .value.long {
  font-size: var(--fs-m);
  line-height: 1.5;
}

.resources .name {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.check {
  max-width: none;
  margin: var(--space-s) 0 0;
  font-size: var(--fs-s);
}

/* --- Other effects and conditions (the prototype's .effects): symbol, uppercase kind, bold name, plain rules --- */
.intro {
  max-width: none;
  margin: 0 0 var(--space-s);
  font-size: var(--fs-s);
}

.effects {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.effects li {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: var(--space-s);
  padding: var(--space-m) 0;
  border-top: 1px solid var(--rule);
}

.effects li:last-child {
  padding-bottom: 0;
}

.effects li > .icon {
  width: 22px;
  height: 22px;
  color: var(--text-dim);
}

.effect {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.effect p {
  max-width: none;
  margin: 0;
}

.effect-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s);
}

.uncounted {
  font-size: var(--fs-s);
}

@media (max-width: 56rem) {
  .profile {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* --- Phones: the compact plate (smaller logo, the figures on a row under a rule) --- */
@media (max-width: 48rem) {
  .plate {
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-s) var(--space-m);
    padding: var(--space-m);
  }

  .plate-logo {
    width: 40px;
    height: 40px;
  }

  .mech-name {
    font-size: 22px;
  }

  .facts {
    grid-column: 1 / -1;
    justify-content: start;
    gap: 0 var(--space-l);
    padding-top: var(--space-s);
    border-top: 1px solid var(--rule);
  }

  .facts .label {
    letter-spacing: 0.04em;
  }

  .fact-value {
    font-size: 18px;
  }

  .next {
    padding: var(--space-s) var(--space-m);
  }
}
</style>
