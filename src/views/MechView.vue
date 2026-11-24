<script setup lang="ts">
import { computed, provide, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { confirmAction } from '../confirm'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import ConflictNotice from '../components/ConflictNotice.vue'
import GmEditBar from '../components/GmEditBar.vue'
import ImageUpload from '../components/ImageUpload.vue'
import SaveStatus from '../components/SaveStatus.vue'
import FileIndex from '../components/FileIndex.vue'
import FileSection from '../components/FileSection.vue'
import ItemPicker from '../components/ItemPicker.vue'
import MechOverview from '../components/MechOverview.vue'
import MechLoadout from '../components/MechLoadout.vue'
import MechIdCard from '../components/MechIdCard.vue'
import MechImage from '../components/MechImage.vue'
import RuleCheck from '../components/RuleCheck.vue'
import InfoButton from '../components/InfoButton.vue'
import RulesText from '../components/RulesText.vue'
import Icon from '../components/Icon.vue'
import ActionChip from '../components/ActionChip.vue'
import InfoRule from '../components/InfoRule.vue'
import ItemCard from '../components/ItemCard.vue'
import { makerColour, makerLogo, useManufacturers } from '../archive'
import { isGm } from '../auth'
import { frameArt, imageUrl } from '../images'
import { frameInfo } from '../info'
import { framePick } from '../pickerRows'
import SheetField from '../components/SheetField.vue'
import StatRow from '../components/StatRow.vue'
import type { Json } from '../lib/database.types'
import { offered } from '../catalogue'
import { useGameData } from '../gameData'
import { EFFECT_KINDS, fittedMods, grantingSources, frameRanges, mechEffects, mechResources, mechStats, talentGrants, useMechData, type Reminder } from '../mechData'
import { mechProblem, useMyPilot, type MechPrivate } from '../myPilot'
import type { PublicMech } from '../pilots'
import { useSaveStatus } from '../saveStatus'
import { useCopyLink } from '../copyLink'
import { usePilotProfile } from '../pilotProfile'
import { radarAxes } from '../mechOverview'
import { pilotList } from '../router'
import { frameBlockedBy, isExotic, mechProblems, requirementReason, restrictionOf, unmetRequirements, useCatalogue } from '../rules'
import { GM_EDIT, useRestriction } from '../restriction'

// One of your mechs, opened from the hangar on my pilot, as one scrolling file like the pilot's: a spec sheet at the
// top (the registration plate: the maker's logo and a thin top border in its colour, the name, manufacturer id, frame and
// class, then pilot, size and system points; joined to the mech at a glance, MechOverview.vue), the open change's bar
// under it, the rule check, then numbered sections (stats, loadout, traits, profile) with an index that
// follows you (the url's #hash names the section). Everything is edited in place and saves itself. The name, manufacturer id,
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

// The breadcrumb: my pilot's hangar, or the list the pilot is in, then their record's hangar (a section of the pilot file).
const list = computed(() => pilotList(character.value?.status))
// The top bar marks that list too (src/router.ts).
const hangar = computed(() =>
  own
    ? { name: 'pilot', hash: '#hangar' }
    : { name: 'pilot-record', params: { id: pilotId }, query: { edit: gmEditing.value ? '1' : undefined }, hash: '#hangar' },
)

const mechId = computed(() => String(route.params.mechId))
const mech = computed(() => mechs.value.find((m) => m.id === mechId.value))
const details = computed<MechPrivate>(() => sheet.value.mechs?.[mechId.value] ?? {})

const { frames, weapons, systems, mods, integrated } = useMechData()
const { talents, coreBonuses } = useGameData()
const catalogue = useCatalogue()
const baseFrame = computed(() => frames.value.find((f) => f.id === details.value.frame) ?? null)
// The manufacturer's colour (--mf, from the packs, so new manufacturers just work) is decoration only, as much as the
// pilot colour gets on the pilot page: the plate (logo, top border, faint band), the section dashes and the stat tiles' top strip. A maker with no colour
// of its own gets none (the neutral fallbacks), never lilac.
const manufacturers = useManufacturers()
const maker = computed(() => manufacturers.value.find((m) => m.id === baseFrame.value?.source))
const logo = computed(() => makerLogo(maker.value))
const makerStyle = computed(() => {
  const colour = makerColour(maker.value)
  return colour.startsWith('#') ? { '--mf': colour, '--page-accent': colour } : undefined
})
// With no image of its own the mech shows its frame's.
const fallbackArt = computed(() => (baseFrame.value ? frameArt(baseFrame.value, frames.value) : null))
const grants = computed(() => talentGrants(sheet.value, talents.value, coreBonuses.value, grantingSources(details.value, sheet.value, catalogue.value)))
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
const frame = computed(() => effects.value.frame)
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
// Talents aren't shown here: the pilot page shows them (their bonuses still count in the stats).
const otherReminders = computed(() => effects.value.reminders.filter((entry) => !['trait', 'core', 'core-power', 'talent'].includes(entry.kind)))
const coreSystem = computed(() => (baseFrame.value?.raw?.core_system ?? {}) as { name?: string; description?: string })
const coreLabel = (entry: Reminder) =>
  entry.kind === 'core-power' ? 'Core power' : entry.source === `${coreSystem.value.name ?? 'core system'} · passive` ? 'Passive' : undefined

// The file's sections, in order (the numbers are part of the design); the overview is the spec sheet above them. Traits
// and effects show only with a frame and something in them. The ids are the url's #hash and the fold state's key, so
// they're prefixed apart from the pilot's.
const SEC = {
  stats: { id: 'mech-stats', title: 'Stats' },
  loadout: { id: 'mech-loadout', title: 'Loadout' },
  effects: { id: 'mech-effects', title: 'Traits' },
  profile: { id: 'mech-profile', title: 'Profile' },
  card: { id: 'mech-card', title: 'Registration card' }, // folded until first opened
}
const showEffects = computed(() => !!frame.value && traitCards.value.length + coreEntries.value.length + otherReminders.value.length > 0)
// Numbered by position among the shown sections, so a hidden one leaves no gap.
const sections = computed(() =>
  Object.values(SEC)
    .filter((s) => s !== SEC.effects || showEffects.value)
    .map((s, i) => ({ ...s, no: String(i + 1).padStart(2, '0') })),
)
const sec = (s: { id: string; title: string }) => sections.value.find((x) => x.id === s.id) ?? { ...s, no: '' }

// --- The registration card (MechIdCard.vue). Its picture for link previews is saved by the browser like the pilot ID
// card's: by the pilot's player while the pilot lives, or a GM; only once the packs have loaded, and never from an open
// change. Its fingerprint goes into the pilot's profile by mech id, beside the other mechs'. ---
const profile = usePilotProfile(() => character.value?.id)
const cardSavePath = computed(() =>
  profile.ready.value && frames.value.length && manufacturers.value.length && character.value && (isGm.value || (own && character.value.status !== 'dead'))
    ? `${character.value.player_id}/mech-card-${character.value.id}-${mechId.value}.png`
    : null,
)
async function saveCardVersion(version: string) {
  const error = await profile.update({ mech_card_versions: { ...profile.fields.value.mech_card_versions, [mechId.value]: version } })
  if (error) console.warn('Card version not saved', error)
}

const { copied, copyLink } = useCopyLink()

// --- The save status shown on the plate, for the one-line fields ---
const { saving, saved, error: saveError, track } = useSaveStatus()

// Public changes replace this mech in the pilot's mech list.
const savePublic = (changes: Partial<PublicMech>) =>
  updateCharacter({ mechs: mechs.value.map((m) => (m.id === mechId.value ? { ...m, ...changes } : m)) })

// Private changes merge into this mech's entry in the sheet.
const savePrivate = (changes: MechPrivate) =>
  updateSheet({ mechs: { ...sheet.value.mechs, [mechId.value]: { ...details.value, ...changes } } })

const saveImage = (path: string | null) => track(savePublic({ image: path }))
const imageCaption = computed(() => (imageUrl(mech.value?.image) ? 'Showing your image.' : fallbackArt.value ? 'Showing the frame image. Upload your own to replace it.' : 'No image yet.'))
const saveAppearance = (doc: Json | null) => track(savePublic({ appearance: doc }))
const saveHistory = (doc: Json | null) => track(savePrivate({ history: doc }))
const saveLoadout = (changes: Partial<MechPrivate>) => track(savePrivate(changes))

// --- The frame, picked at the top right. A new frame has different mounts, so its weapons come off. ---
// A licensed frame needs its rank in its licence, and, if the licence has alternate frames, to be the one the pilot chose for it; GMS frames need none. HORUS and NHC frames are GM-only, Exotic ones GM-edit-only.
const framePicker = useTemplateRef('framePicker')
const reasonFor = useRestriction()
// What's on this mech now, for a frame's item requirements.
const onMech = computed(() => new Set([...(details.value.systems ?? []), ...(details.value.mounts ?? []).flat().filter((id): id is string => !!id), ...Object.values(details.value.weapon_mods ?? {})]))
const frameOptions = computed(() => {
  const ranges = frameRanges(frames.value)
  return offered(frames.value, (f) => f.id === details.value.frame).map((f) => ({
    id: f.id,
    name: f.name,
    ...framePick(f, ranges, manufacturers.value, frames.value),
    exotic: isExotic(f),
    blocked: reasonFor(restrictionOf(f)) || (gmEditing.value ? '' : frameBlockedBy(f, frames.value, sheet.value) || requirementReason(unmetRequirements(f.raw, sheet.value, onMech.value, { frames: frames.value, talents: talents.value, coreBonuses: coreBonuses.value, itemName: (id) => catalogue.value.weapons.get(id)?.name ?? catalogue.value.systems.get(id)?.name ?? catalogue.value.mods?.get(id)?.name }))),
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
          <li><RouterLink :to="list.to">{{ list.label }}</RouterLink></li>
          <li><RouterLink :to="hangar">{{ character.callsign ?? character.pilot_name }}</RouterLink></li>
        </template>
        <li v-if="mech" aria-current="page">{{ mech.name }}</li>
      </ol>
    </nav>

    <p v-if="loading" class="dim">Loading…</p>
    <p v-else-if="loadError" class="notice warn" role="alert">{{ loadError }}</p>
    <p v-else-if="!mech" class="notice warn" role="alert">No mech with that ID.</p>

    <div v-else class="sheet" :style="makerStyle">
      <!-- The registration plate. The manufacturer's colour (--mf) is decoration only. -->
      <header class="plate">
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
          <!-- The registry address with the Discord preview, as on the registration card: approved or dead pilots only. -->
          <span v-if="character?.status === 'approved' || character?.status === 'dead'" class="copy-link" aria-live="polite">
            <button type="button" class="quiet small" @click="copyLink({ name: 'record-mech', params: { id: character.id, mechId: mech.id } })"><Icon name="link" />{{ copied || 'Copy link' }}</button>
          </span>
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

      <!-- The plate's body: the mech at a glance (with no frame, just its picture). With the plate it reads as one spec
           sheet; the GM edit bar or the draft bar joins under it. -->
      <MechOverview
        v-if="frame && baseFrame"
        class="spec-body"
        :class="{ joined: (own && draft) || gmEditing }"
        :frame="frame"
        :base-frame="baseFrame"
        :frames="frames"
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
      >
        <!-- While editable, the upload sits under the picture it changes. -->
        <div v-if="editable" class="image-tools">
          <p class="dim frame-note">{{ imageCaption }}</p>
          <ImageUpload :path="mech.image" :save="saveImage" />
        </div>
      </MechOverview>
      <section v-else class="panel spec-body" :class="{ joined: (own && draft) || gmEditing }">
        <h2 class="sheet-label">Overview</h2>
        <MechImage size="overview" :src="mech.image" :alt="`Image of ${mech.name}`" />
        <div v-if="editable" class="image-tools">
          <p class="dim frame-note">{{ imageCaption }}</p>
          <ImageUpload :path="mech.image" :save="saveImage" />
        </div>
      </section>

      <GmEditBar v-if="gmEditing" :name="character?.callsign ?? character?.pilot_name ?? ''" :waiting="waiting" :saving="saving" :saved="saved" :error="saveError" :can-retry="!conflict" @retry="track(retry())" @done="router.replace({ query: { ...route.query, edit: undefined } })" />

      <!-- Mech edits go into the pilot's open change (src/myPilot.ts), which this page otherwise wouldn't show. -->
      <div v-if="own && draft" class="next">
        <span class="badge" :class="draft.submitted_at ? 'pending' : draft.review_reason ? 'rejected' : 'draft'">{{ draft.submitted_at ? 'Submitted' : draft.review_reason ? 'Sent back' : 'Draft' }}</span>
        <p v-if="!draft.submitted_at">Edits here go into your draft change. Submit it from <RouterLink :to="{ name: 'pilot' }">My pilot</RouterLink>.</p>
        <p v-else>Waiting on a GM. This mech is read-only.</p>
      </div>

      <ConflictNotice v-if="conflict" />
      <CatalogueNotice />

      <RuleCheck :problems="problems" :fix="ruleFix" />

      <!-- The file: an index (it follows you), then the sections on the page itself, not in boxes. -->
      <div class="dossier">
        <FileIndex :sections="sections" />
        <div class="file">
          <FileSection v-bind="sec(SEC.stats)">
            <StatRow class="mech-stats" title="Mech stats" :stats="stats" :editable="false" :min="0" :max="0" />
            <div v-if="frame" class="resources-block">
              <h3 class="sheet-label">Resources</h3>
              <ul class="resources">
                <li><span class="value num">{{ resources.aiCap }}</span><span class="name">AI capacity</span></li>
                <li v-if="resources.limited">
                  <span class="value num">{{ resources.limited > 0 ? '+' : '' }}{{ resources.limited }}</span><span class="name">Limited uses</span>
                </li>
                <li><span class="value num">{{ resources.structureRepairs }}</span><span class="name">Structure repair cost</span></li>
                <li><span class="value num long">{{ resources.overcharge }}</span><span class="name">Overcharge heat</span></li>
              </ul>
              <p v-for="(check, index) in resources.checks" :key="index" class="check"><b>{{ check.source }}:</b> {{ check.text }}</p>
            </div>
          </FileSection>

          <FileSection v-bind="sec(SEC.loadout)">
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
              :capacity-for="capacityFor"
              :mounts="details.mounts ?? []"
              :installed="details.systems ?? []"
              :sp-total="spTotal"
              :editable="editable"
              :save="saveLoadout"
            />
          </FileSection>

          <FileSection v-if="showEffects" v-bind="sec(SEC.effects)">
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
          </FileSection>

          <FileSection v-bind="sec(SEC.profile)">
            <div class="notes">
              <SheetField title="Appearance" :doc="mech.appearance" :editable="editable" :save="saveAppearance" />
              <SheetField title="History" :doc="details.history ?? null" :editable="editable" :save="saveHistory" />
            </div>
          </FileSection>

          <FileSection v-bind="sec(SEC.card)" folded>
            <MechIdCard
              class="id-card"
              :id="character!.id"
              :mech-id="mech.id"
              :name="mech.name"
              :manufacturer-id="mech.manufacturer_id"
              :frame="baseFrame ? `${baseFrame.source} ${baseFrame.name}` : null"
              :logo="logo"
              :colour="makerStyle ? makerColour(maker) : null"
              :image="mech.image"
              :art="fallbackArt"
              :callsign="character!.callsign ?? character!.pilot_name"
              :size="frame ? size : null"
              :sp-used="spUsed"
              :sp-total="frame ? spTotal : null"
              :axes="frame ? radarAxes(stats, frameRanges(frames)) : []"
              :status="character!.status"
              :draft-open="own && !!draft"
              :card-version="profile.fields.value.mech_card_versions[mech.id]"
              :save-path="cardSavePath"
              @card-saved="saveCardVersion"
            />
          </FileSection>

          <section v-if="editable" class="panel danger-zone">
            <h2 class="sheet-label">Danger zone</h2>
            <div class="danger-body">
              <p class="dim">Scrapping {{ mech.name }} removes it from the hangar. This can't be undone.</p>
              <button type="button" class="danger" @click="scrap">Scrap mech</button>
            </div>
            <p v-if="scrapError" class="notice warn" role="alert">Not removed: {{ scrapError }}</p>
          </section>
        </div>
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
/* --- The spec sheet: the registration plate (the prototype's .plate) as a raised head band with a faint wash of the
   maker's colour at its left (18% at most: every text on it stays 4.5:1 or more), joined to the overview's body --- */
.plate {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-l);
  padding: var(--space-l);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--mf, var(--rule));
  border-radius: var(--radius) var(--radius) 0 0;
  background: linear-gradient(100deg, color-mix(in srgb, var(--mf, var(--raised)) 18%, var(--raised)), var(--raised) 70%);
  overflow-wrap: anywhere; /* a long unbroken name wraps instead of widening the page */
}

.spec-body {
  margin-top: calc(-1 * var(--space-m)); /* joined to the plate: cancels the sheet's gap */
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
}

/* With the GM's bar or the draft bar under it, all of them read as one block. */
.spec-body.joined {
  border-radius: 0;
}

.plate-logo {
  width: 56px;
  height: 56px;
  color: var(--mf, var(--text-dim));
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

.copy-link {
  margin-top: var(--space-s);
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

/* --- The draft bar, joined to the spec sheet's foot (as my pilot's next-step bar) --- */
.next {
  margin-top: calc(-1 * var(--space-m)); /* joined to the spec sheet: cancels the sheet's gap */
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
}

/* The upload under the picture: the caption, then its small buttons, centred like the picture. */
.image-tools {
  display: grid;
  justify-items: center;
  gap: var(--space-s);
  text-align: center;
}

.image-tools :deep(.buttons) {
  justify-content: center;
  margin-top: 0;
}

.frame-note {
  margin: 0;
  font-size: var(--fs-s);
}

/* The twelve mech stats as two even rows; below this width StatRow's own narrow layout takes over. */
@media (min-width: 56rem) {
  .mech-stats :deep(.stats) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

/* --- Resources: the numbers that aren't stats, as tiles like the stat tiles above them --- */
.resources-block {
  margin-top: var(--space-xl);
}

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
  padding: var(--space-m) 6px;
  border-radius: var(--radius);
  background: var(--panel);
  box-shadow: inset 0 3px var(--page-accent, var(--pilot, var(--edge)));
  text-align: center;
}

.resources .value {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
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

/* --- Traits: the frame's traits as equal-height cards in a grid, then the core system's card,
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

/* --- Registration card: the card on show, centred, like the pilot's 02 Pilot ID --- */
.id-card {
  max-width: 36rem;
  margin-inline: auto;
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

/* Phones: the plate's fields and buttons tap-sized. */
@media (max-width: 40rem) {
  .inline,
  .subline button,
  .copy-link button {
    min-height: var(--tap);
  }
}
</style>
