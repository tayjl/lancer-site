<script setup lang="ts">
import { computed, provide, ref, useTemplateRef, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { confirmAction } from '../confirm'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import ConflictNotice from '../components/ConflictNotice.vue'
import GmEditBar from '../components/GmEditBar.vue'
import ImageUpload from '../components/ImageUpload.vue'
import SaveStatus from '../components/SaveStatus.vue'
import SheetTabs from '../components/SheetTabs.vue'
import ItemPicker from '../components/ItemPicker.vue'
import MechOverview from '../components/MechOverview.vue'
import MechLoadout from '../components/MechLoadout.vue'
import MechImage from '../components/MechImage.vue'
import RuleCheck from '../components/RuleCheck.vue'
import InfoButton from '../components/InfoButton.vue'
import RulesText from '../components/RulesText.vue'
import Icon from '../components/Icon.vue'
import ActionChip from '../components/ActionChip.vue'
import InfoRule from '../components/InfoRule.vue'
import ItemCard from '../components/ItemCard.vue'
import { makerColour, makerLogo, useManufacturers } from '../archive'
import { frameArt, imageUrl } from '../images'
import { frameInfo } from '../info'
import { frameRanges, framePick } from '../pickerRows'
import SheetField from '../components/SheetField.vue'
import StatRow from '../components/StatRow.vue'
import type { Json } from '../lib/database.types'
import { useGameData } from '../gameData'
import { buildFrame, fittedMods, mechEffects, mechResources, mechStats, talentGrants, useMechData, type Reminder, type ReminderKind } from '../mechData'
import { mechProblem, useMyPilot, type MechPrivate } from '../myPilot'
import type { PublicMech } from '../pilots'
import { useSaveStatus } from '../saveStatus'
import { pilotList, sectionOverride } from '../router'
import { frameBlockedBy, isExotic, mechProblems, restrictionOf, useCatalogue } from '../rules'
import { GM_EDIT, useRestriction } from '../restriction'

// One of your mechs, opened from the hangar on my pilot, laid out like the pilot sheet: the registration plate (the
// maker's logo and a thin top border in its colour, the name, manufacturer id, frame and class, then pilot, size and
// system points), then a slim sticky row of section tabs (profile, stats, loadout), each a stack of panels. Everything is edited in place and saves itself. The name, manufacturer id,
// appearance and image are on the pilot's card; history, the frame, the stats and the loadout are in the sheet. All of
// it is public (the sheet's only secrets are the backstory and the GM's notes). The frame is chosen in the strip; its mounts and system points shape the loadout, and the stats are
// worked out from it. Quirks are off the page for now, like the pilot's traits (still in the sheet).
// Opened from someone else's record (route param "id"), it's the same page, read-only.

const route = useRoute()
const router = useRouter()
const pilotId = route.params.id ? Number(route.params.id) : undefined
const own = !pilotId
// ?edit=1 is a GM's edit mode on someone else's pilot (src/myPilot.ts): everything saves straight to the pilot.
const { character, sheet, loading, loadError, conflict, retry, editable, gmEditing, waiting, mechs, draft, updateCharacter, updateSheet } = useMyPilot(pilotId, {
  gmEdit: () => route.query.edit === '1',
})
provide(GM_EDIT, gmEditing) // so the loadout's and frame pickers know Exotic content may be chosen (rules.ts)

// The breadcrumb: my pilot's hangar, or the list the pilot is in, then their record's hangar.
const list = computed(() => pilotList(character.value?.status))
// The top bar marks that list too (src/router.ts).
if (route.name === 'record-mech') watchEffect(() => (sectionOverride.value = list.value.name))
const hangar = computed(() =>
  own
    ? { name: 'pilot', query: { tab: 'mechs' } }
    : { name: 'pilot-record', params: { id: pilotId }, query: { tab: 'mechs', edit: gmEditing.value ? '1' : undefined } },
)

// The sections, one at a time, remembered as ?tab= like the pilot sheet.
const tabs = ['profile', 'stats', 'loadout']
const tab = computed({
  get: () => (tabs.includes(String(route.query.tab)) ? String(route.query.tab) : 'profile'),
  set: (next: string) => router.replace({ query: { ...route.query, tab: next === 'profile' ? undefined : next } }),
})

const mechId = computed(() => String(route.params.mechId))
const mech = computed(() => mechs.value.find((m) => m.id === mechId.value))
const details = computed<MechPrivate>(() => sheet.value.mechs?.[mechId.value] ?? {})

const { frames, weapons, systems, mods, integrated } = useMechData()
const { talents } = useGameData()
const catalogue = useCatalogue()
const baseFrame = computed(() => frames.value.find((f) => f.id === details.value.frame) ?? null)
// The plate shows its manufacturer as the logo and a thin top border in its colour (nothing else), from the packs, so
// new manufacturers just work.
const manufacturers = useManufacturers()
const maker = computed(() => manufacturers.value.find((m) => m.id === baseFrame.value?.source))
const logo = computed(() => makerLogo(maker.value))
// With no image of its own the mech shows its frame's.
const fallbackArt = computed(() => (baseFrame.value ? frameArt(baseFrame.value, frames.value) : null))
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
    (details.value.systems ?? []).reduce((sum, id) => sum + (systemsById.get(id)?.sp ?? 0), 0) +
    fittedMods(details.value, frame.value).reduce((sum, [, id]) => sum + (mods.value.find((item) => item.id === id)?.sp ?? 0), 0)
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
  missing: { icon: 'warning', label: 'Missing' },
}

// "Other effects and conditions": the frame's traits as a card each (their actions and uncounted bonuses inside), the
// core system as one card (its lore, passive and power), then everything else as a plain list.
const traitCards = computed(() => {
  const cards = new Map<string, Reminder[]>()
  for (const entry of effects.value.reminders) {
    const name = entry.kind === 'trait' ? (entry.from ?? entry.name) : ''
    if (name) cards.set(name, [...(cards.get(name) ?? []), entry])
  }
  return [...cards].map(([name, entries]) => ({ name, entries }))
})
const coreEntries = computed(() => effects.value.reminders.filter((entry) => entry.kind === 'core' || entry.kind === 'core-power'))
const otherReminders = computed(() => effects.value.reminders.filter((entry) => !['trait', 'core', 'core-power'].includes(entry.kind)))
const coreSystem = computed(() => (baseFrame.value?.raw?.core_system ?? {}) as { name?: string; description?: string })
const coreLabel = (entry: Reminder) =>
  entry.kind === 'core-power' ? 'Core power' : entry.source === `${coreSystem.value.name ?? 'core system'} · passive` ? 'Passive' : undefined

// --- The save status shown on the plate, for the one-line fields ---
const { saving, saved, error: saveError, track } = useSaveStatus()

// Public changes replace this mech in the pilot's mech list.
const savePublic = (changes: Partial<PublicMech>) =>
  updateCharacter({ mechs: mechs.value.map((m) => (m.id === mechId.value ? { ...m, ...changes } : m)) })

// Private changes merge into this mech's entry in the sheet.
const savePrivate = (changes: MechPrivate) =>
  updateSheet({ mechs: { ...sheet.value.mechs, [mechId.value]: { ...details.value, ...changes } } })

const saveImage = (path: string | null) => track(savePublic({ image: path }))
const saveAppearance = (doc: Json | null) => track(savePublic({ appearance: doc }))
const saveHistory = (doc: Json | null) => track(savePrivate({ history: doc }))
const saveLoadout = (changes: Partial<MechPrivate>) => track(savePrivate(changes))

// --- The frame, picked at the top right. A new frame has different mounts, so its weapons come off. ---
// A licensed frame needs its rank in its licence, and, if the licence has alternate frames, to be the one the pilot chose for it; GMS frames need none. HORUS and NHC frames are GM-only, Exotic ones GM-edit-only.
const framePicker = useTemplateRef('framePicker')
const reasonFor = useRestriction()
const frameOptions = computed(() => {
  const ranges = frameRanges(frames.value)
  return frames.value.map((f) => ({
    id: f.id,
    name: f.name,
    ...framePick(f, ranges, manufacturers.value, true, frames.value),
    exotic: isExotic(f),
    blocked: reasonFor(restrictionOf(f)) || frameBlockedBy(f, frames.value, sheet.value),
    info: () => frameInfo(f, frames.value),
  }))
})

async function chooseFrame(id: string) {
  const armed = (details.value.mounts ?? []).flat().some(Boolean)
  if (armed && !(await confirmAction("Change the frame? This mech's weapons and mods come off.", { confirmLabel: 'Change frame', danger: true })))
    return
  await track(savePrivate({ frame: id, mounts: [], core_mounts: {}, weapon_options: {}, weapon_mods: {} }))
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
  if (!(await confirmAction(`Scrap ${mech.value!.name}? It leaves the hangar. This can't be undone.`, { confirmLabel: 'Scrap mech', danger: true }))) return
  const rest = { ...sheet.value.mechs }
  delete rest[mechId.value]
  scrapError.value =
    (await updateCharacter({ mechs: mechs.value.filter((m) => m.id !== mechId.value) })) ??
    (await updateSheet({ mechs: rest })) ??
    ''
  if (!scrapError.value) router.push(hangar.value)
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

    <p v-if="loading" class="dim">Loading…</p>
    <p v-else-if="loadError" class="notice warn" role="alert">{{ loadError }}</p>
    <p v-else-if="!mech" class="notice warn" role="alert">No mech with that ID.</p>

    <div v-else class="sheet">
      <!-- The registration plate. The manufacturer's colour is only the logo and the 3px top border (--mf). -->
      <header class="plate" :class="{ joined: (own && draft) || gmEditing }" :style="maker ? { '--mf': makerColour(maker) } : undefined">
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
            <span>
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
          <SaveStatus v-if="own && (saveError || saving || saved)" :saving="saving" :saved="saved" :error="saveError" :can-retry="!conflict" @retry="track(retry())" />
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

      <GmEditBar v-if="gmEditing" :name="character?.callsign ?? character?.pilot_name ?? ''" :waiting="waiting" :saving="saving" :saved="saved" :error="saveError" :can-retry="!conflict" @retry="track(retry())" @done="router.replace({ query: { ...route.query, edit: undefined } })" />

      <ConflictNotice v-if="conflict" />
      <CatalogueNotice />

      <!-- Mech edits go into the pilot's open change (src/myPilot.ts), which this page otherwise wouldn't show. -->
      <div v-if="own && draft" class="next">
        <span class="badge" :class="draft.submitted_at ? 'pending' : draft.review_reason ? 'rejected' : 'draft'">{{ draft.submitted_at ? 'Submitted' : draft.review_reason ? 'Sent back' : 'Draft' }}</span>
        <p v-if="!draft.submitted_at">Edits here go into your draft change. Submit it from <RouterLink :to="{ name: 'pilot' }">My pilot</RouterLink>.</p>
        <p v-else>Waiting on a GM. This mech is read-only.</p>
      </div>

      <RuleCheck :problems="problems" :fix="ruleFix" />

      <!-- One section at a time; v-show keeps every panel mounted, so switching never loses an open picker. Only this
           slim row sticks (under the top bar). -->
      <SheetTabs v-if="tabs.length > 1" v-model="tab" :tabs="tabs" label="Mech sections" class="sheet-tabs" />

      <div v-show="tab === 'profile'" class="tab-panel">
        <MechOverview
          v-if="frame && baseFrame"
          :frame="frame"
          :base-frame="baseFrame"
          :frames="frames"
          :maker="maker"
          :logo="logo"
          :image="mech.image"
          :name="mech.name"
          :stats="stats"
          :sheet="sheet"
          :details="details"
          :bonuses="effects.bonuses"
          :weapons="availableWeapons"
          :systems="availableSystems"
          :mods="mods"
          :integrated="integrated"
          :sp-used="spUsed"
          :sp-total="spTotal"
        />
        <!-- A mech with no frame has no overview, so its picture gets a minimal one. -->
        <section v-else class="panel">
          <h2 class="sheet-label">Overview</h2>
          <MechImage size="overview" :src="mech.image" :alt="`Image of ${mech.name}`" />
        </section>
        <div class="profile" :class="{ solo: !editable }">
          <div class="writing">
            <SheetField class="panel" title="Appearance" :doc="mech.appearance" :editable="editable" :save="saveAppearance" />
            <SheetField class="panel" title="History" :doc="details.history ?? null" :editable="editable" :save="saveHistory" />
          </div>
          <!-- Upload controls only (the picture itself is in the overview above); read-only viewers don't get it. -->
          <section v-if="editable" class="panel">
            <h2 class="sheet-label">Image</h2>
            <p class="dim frame-note">{{ imageUrl(mech.image) ? 'Showing your image.' : fallbackArt ? 'Showing the frame image. Upload your own to replace it.' : 'No image yet.' }}</p>
            <ImageUpload :path="mech.image" :save="saveImage" />
          </section>
        </div>
        <section v-if="editable" class="panel danger-zone">
          <h2 class="sheet-label">Danger zone</h2>
          <div class="danger-body">
            <p class="dim">Scrapping {{ mech.name }} removes it from the hangar. This can't be undone.</p>
            <button type="button" class="danger" @click="scrap">Scrap mech</button>
          </div>
          <p v-if="scrapError" class="notice warn" role="alert">{{ scrapError }}</p>
        </section>
      </div>

      <div v-show="tab === 'stats'" class="tab-panel">
        <StatRow class="panel mech-stats" title="Mech stats" :stats="stats" :editable="false" :min="0" :max="0" />
        <section v-if="frame" class="panel">
          <h2 class="sheet-label">Resources</h2>
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
          <h2 class="sheet-label">Other effects and conditions</h2>
          <p class="dim intro">These aren't counted in the stats.</p>
          <ul v-if="traitCards.length" class="trait-cards">
            <li v-for="card in traitCards" :key="card.name">
              <ItemCard type="frame" icon="trait" :name="card.name">
                <InfoRule
                  v-for="(entry, index) in card.entries"
                  :key="index"
                  :class="{ ruled: index > 0 }"
                  :heading="entry.name === card.name ? undefined : entry.name"
                  :activation="entry.activation"
                  :html="entry.text"
                >
                  <p v-if="entry.uncounted" class="dim uncounted">Not counted in the stats.</p>
                </InfoRule>
              </ItemCard>
            </li>
          </ul>
          <ItemCard v-if="coreEntries.length" type="core" icon="corebonus" :name="coreSystem.name ?? 'Core system'" class="core-card">
            <RulesText v-if="coreSystem.description" class="lore" :html="coreSystem.description" />
            <InfoRule
              v-for="(entry, index) in coreEntries"
              :key="index"
              :class="{ ruled: index > 0 || coreSystem.description }"
              :label="coreLabel(entry)"
              :heading="entry.name"
              :activation="entry.activation"
              :html="entry.text"
            >
              <p v-if="entry.uncounted" class="dim uncounted">Not counted in the stats.</p>
            </InfoRule>
          </ItemCard>
          <ul v-if="otherReminders.length" class="effects">
            <li v-for="(reminder, index) in otherReminders" :key="index">
              <Icon :name="EFFECT_KINDS[reminder.kind].icon" />
              <div class="effect">
                <p class="label">{{ EFFECT_KINDS[reminder.kind].label }}{{ reminder.from ? `: ${reminder.from}` : '' }}</p>
                <p class="effect-head">
                  <ActionChip :activation="reminder.activation" />
                  <b>{{ reminder.name }}</b>
                </p>
                <RulesText :html="reminder.text" />
                <p v-if="reminder.uncounted" class="dim uncounted">Not counted in the stats.</p>
              </div>
            </li>
          </ul>
        </section>
        <p v-if="!frame" class="empty">Choose a frame first.</p>
      </div>

      <div v-show="tab === 'loadout'" class="tab-panel">
        <MechLoadout
          :frame="frame"
          :frames="frames"
          :licences="licences"
          :integrated="integrated"
          :weapons="availableWeapons"
          :systems="availableSystems"
          :mods="mods"
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

/* Callsign and name: plain text with a faint underline that says they can be edited. */
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

.inline.maker-id {
  max-width: none;
}

.save-status {
  margin: 4px 0 0;
  font-size: var(--fs-xs);
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

.pilot {
  align-self: end;
  font-weight: 700;
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

.tab-panel * {
  scroll-margin-top: calc(var(--topbar-h) + var(--tabs-h) + var(--space-l));
}

.profile.solo {
  grid-template-columns: minmax(0, 1fr);
}

.frame-note {
  margin: 0 0 var(--space-s);
  font-size: var(--fs-s);
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

/* --- Other effects and conditions: the frame's traits as equal-height cards in a grid, then the core system's card,
   then the rest as the prototype's .effects rows (symbol, uppercase kind, bold name, plain rules). --- */
.trait-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--space-m);
  margin: 0 0 var(--space-m);
  padding: 0;
  list-style: none;
}

.trait-cards > li {
  display: grid;
}

.core-card {
  margin-bottom: var(--space-m);
}

.trait-cards:last-child,
.core-card:last-child {
  margin-bottom: 0;
}

/* Inside a card, each further rule or action under a thin rule on the card's own surface. */
.ruled {
  padding-top: var(--space-m);
  border-top: 1px solid var(--rule);
}

.lore {
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-style: italic;
}

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
  margin: 0;
  font-size: var(--fs-s);
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

  .next {
    padding: var(--space-s) var(--space-m);
  }
}
</style>
