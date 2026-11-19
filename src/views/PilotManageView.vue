<script setup lang="ts">
import { computed, provide, reactive, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm, session } from '../auth'
import { useBackstoryVisibility } from '../backstory'
import BackstoryVisibility from '../components/BackstoryVisibility.vue'
import { confirmAction } from '../confirm'
import CoreBonusPanel from '../components/CoreBonusPanel.vue'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import ConflictNotice from '../components/ConflictNotice.vue'
import GmEditBar from '../components/GmEditBar.vue'
import CommendationBadges from '../components/CommendationBadges.vue'
import GmReview from '../components/GmReview.vue'
import PilotIdCard from '../components/PilotIdCard.vue'
import ServiceRecord from '../components/ServiceRecord.vue'
import ImageUpload from '../components/ImageUpload.vue'
import PilotColourField from '../components/PilotColourField.vue'
import PilotGallery from '../components/PilotGallery.vue'
import MechHangar from '../components/MechHangar.vue'
import LoadoutBox from '../components/LoadoutBox.vue'
import PilotLoadout from '../components/PilotLoadout.vue'
import Portrait from '../components/Portrait.vue'
import gritIcon from '../assets/icons/skill.svg'
import RankPanel, { type RankStep } from '../components/RankPanel.vue'
import SaveStatus from '../components/SaveStatus.vue'
import SheetTabs from '../components/SheetTabs.vue'
import RuleCheck from '../components/RuleCheck.vue'
import SheetField from '../components/SheetField.vue'
import Icon from '../components/Icon.vue'
import StatRow from '../components/StatRow.vue'
import { BANNER_SIDE, imageUrl } from '../images'
import { usePilotAwards } from '../commendations'
import { displayColour } from '../pilotColour'
import { useServiceRecord } from '../serviceRecord'
import { MOTTO_MAX, usePilotProfile, type ProfileFields } from '../pilotProfile'
import { bionicItems, pilotBonuses, pilotVitals, sheetStats, useGameData } from '../gameData'
import type { Json } from '../lib/database.types'
import { chosenFrame, licenceFrames, licensedFrames, useMechData, type Frame } from '../mechData'
import { bionicInfo, frameInfo, licenceUnlocks, talentInfo } from '../info'
import { useMyPilot, type Sheet } from '../myPilot'
import { GM_EDIT } from '../restriction'
import { useSaveStatus } from '../saveStatus'
import type { PublicMech } from '../pilots'
import { pilotList, sectionOverride } from '../router'
import { coreBonusPicks, restrictionOf, licenceLevel, licenceName, mannaSpent, modLimit, pilotProblems, personalStatProblems, PERSONAL_STAT_MIN, PERSONAL_STAT_MAX, PERSONAL_STAT_POINTS, PRICES, skillPoints, formatAmount, useCatalogue } from '../rules'
import { capitalise } from '../text'

// my pilot: your pilot as one sheet. A compact header (portrait, callsign, name, player, status, then level, licence
// level and manna), the "what happens next" bar under it, any notes and the rule check, then a slim sticky row of
// section tabs (profile, stats, equipment, licences, talents, mechs), each a stack of panels. Everything is edited
// in place and saves itself. While a pilot is pending you can edit it directly; once it's approved, changes are
// proposed as a draft that a GM approves (src/myPilot.ts).
// The same page, read-only, is every pilot's record (opened from a card, route param "id"), so a record looks
// just like your own sheet. Everything on it is public except the backstory (shown only to the pilot's player and
// GMs, or as a public copy when its player toggles it; src/backstory.ts). On the gm-review route (from the gm: pilots tab) GMs also get their controls: level,
// manna and, while pending, the decision.
// Homebrew (src/rules.ts): level (set by GMs) gives HASE points and the mod limit; manna (received from GMs)
// buys licence ranks, biomods and talent ranks; every 3 licence ranks give a free core bonus.

const route = useRoute()
const router = useRouter()
const pilotId = route.params.id ? Number(route.params.id) : undefined
const own = !pilotId
const reviewing = route.name === 'gm-review'
const {
  character,
  sheet,
  gm,
  reviewNote,
  sheetUpdatedAt,
  playerName,
  canSeeBackstory,
  canSeeManna,
  loading,
  loadError,
  conflict,
  retry,
  editable,
  gmEditing,
  waiting,
  approved,
  mechs,
  load,
  create,
  updateCharacter,
  updateSheet,
  submitPilot,
  reopenPilot,
  dismissApprovalNote,
  change,
  draft,
  proposeChange,
  submitChange,
  reopenChange,
  withdrawChange,
  markDead,
} = useMyPilot(pilotId, { gmEdit: () => route.query.edit === '1' })
// Exotic content can be picked only in a GM's edit mode (rules.ts): every picker below asks (src/restriction.ts).
provide(GM_EDIT, gmEditing)

// A pilot that isn't submitted yet (a new one, or one a GM sent back): only its player and GMs see it in lists.
const isDraft = computed(() => character.value?.status === 'pending' && !character.value.submitted_at)

// Your approved pilot: changes are proposed, then a GM approves them (src/myPilot.ts).
const approvedOwn = computed(() => own && character.value?.status === 'approved')

// A change a GM sent back comes back as a draft with their note (the database makes it, see reject_change).
const sentBack = computed(() => (draft.value && !draft.value.submitted_at ? draft.value.review_reason : null))

// A GM's note on your last approved change. "Clear note" only hides it on this device (the note stays in the
// change's history), so it's remembered in localStorage, which can be missing or blocked: every access is guarded.
const noteKey = (id: number) => `change-note-cleared:${id}`
const clearedNote = ref<number | null>(null)
const changeNote = computed(() => {
  const c = change.value
  if (!approvedOwn.value || draft.value || c?.status !== 'approved' || !c.review_reason || clearedNote.value === c.id) return null
  try {
    return localStorage.getItem(noteKey(c.id)) ? null : c.review_reason
  } catch {
    return c.review_reason
  }
})
function clearChangeNote() {
  clearedNote.value = change.value!.id
  try {
    localStorage.setItem(noteKey(change.value!.id), '1')
  } catch {
    // Hidden for this visit only.
  }
}
async function confirmDeath() {
  const name = character.value!.callsign ?? character.value!.pilot_name
  if (await confirmAction(`Mark ${name} dead? They move to the memorial. This can't be undone.`, { confirmLabel: 'Mark dead', danger: true }))
    track(markDead())
}

async function withdraw() {
  if (await confirmAction("Withdraw this change? Your approved pilot won't change. This can't be undone.", { confirmLabel: 'Withdraw change', danger: true }))
    track(withdrawChange())
}

// Records' breadcrumb leads back to the queue, or to the list the pilot is in.
const back = computed(() => (reviewing ? { name: 'gm-pilots', label: 'GM pilots' } : pilotList(character.value?.status)))
// The top bar marks that list too (src/router.ts).
if (route.name === 'pilot-record') watchEffect(() => (sectionOverride.value = back.value.name))
// Your own mechs open for editing; anyone else's open read-only under their record (editable in a GM's edit mode, kept in the url).
const mechLink = (mechId: string) =>
  own ? { name: 'mech', params: { mechId } } : { name: 'record-mech', params: { id: pilotId, mechId }, query: gmEditing.value ? { edit: '1' } : undefined }
// A GM's edit mode (?edit=1) on a living pilot's record or review page; Done leaves it. On your own approved pilot (a GM or
// owner's) the button is on My pilot too: it opens your own record in edit mode (a pending pilot is already yours to edit).
// The profile (colour, motto, banner, gallery) is cosmetic: it saves live with no approval, even on an approved pilot, so it
// has its own editable flag (your own living pilot, or a GM in edit mode) and its own saves (src/pilotProfile.ts).
const profile = usePilotProfile(() => character.value?.id)
const profileEditable = computed(() => profile.ready.value && !!character.value && character.value.status !== 'dead' && (own || gmEditing.value))
// The pilot's colour as drawn: the picker's live value while you drag it, else the saved one (lightened if too dark).
const previewColour = ref<string | undefined>()
const pilotColour = computed(() => (previewColour.value ? displayColour(previewColour.value) : profile.colour.value))
const pilotStyle = computed(() => (pilotColour.value ? { '--pilot': pilotColour.value } : undefined))
const bannerUrl = computed(() => imageUrl(profile.fields.value.banner_image))
const saveProfile = (changes: Partial<ProfileFields>) => track(profile.update(changes))
const saveMotto = (event: Event) => saveProfile({ motto: (event.target as HTMLTextAreaElement).value.trim().slice(0, MOTTO_MAX) || null })
const saveColour = (colour: string | null) => {
  previewColour.value = undefined
  return saveProfile({ colour })
}
// Retry sends whatever is unsaved, on the sheet and the profile.
const retryAll = async () => (await Promise.all([retry(), profile.retry()])).find(Boolean) ?? null
const anyConflict = computed(() => conflict.value || profile.conflict.value)
// The service record and commendations: public to every logged-in user, saved live with no approval. Your own living
// pilot's player writes "log" entries; a GM, editing or reviewing, writes GM entries and can delete any (the database
// decides, these only show the buttons).
const record = useServiceRecord(() => character.value?.id)
const awards = usePilotAwards(() => character.value?.id)
const canLog = computed(() => own && !!character.value && character.value.status !== 'dead')
const canGmRecord = computed(() => isGm.value && (gmEditing.value || reviewing))
// Backstory privacy: the pilot's own player or a GM editing can change it; other viewers see only a public copy.
const backstory = useBackstoryVisibility(() => character.value?.id)
const canToggleBackstory = computed(() => gmEditing.value || (!!character.value && character.value.player_id === session.value?.user.id))
const gmCanEdit = computed(() => isGm.value && character.value?.status !== 'dead' && (!own || character.value?.status === 'approved'))
const setEdit = (on: boolean) =>
  own && on
    ? router.push({ name: 'pilot-record', params: { id: character.value!.id }, query: { edit: '1' } })
    : router.replace({ query: { ...route.query, edit: on ? '1' : undefined } })
const { gear, bionics, bionicPrices, pilotStats, talents, coreBonuses } = useGameData()

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

// HASE keeps its own 0–6 range; personal stats use the separate base range and budget in rules.ts.
const STAT_MIN = 0
const STAT_MAX = 6

// --- The save status shown in the next-step bar, for the one-line fields, stats and loadouts ---
const { saving, saved, error: saveError, track } = useSaveStatus()

// One-line fields save when you leave them (or press enter). A pilot can't lose its name.
function saveText(column: TextColumn, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.trim() || null
  if (column === 'pilot_name' && !value) {
    saveError.value = 'A pilot needs a name.'
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
    registerError.value = 'A pilot needs a name.'
    return
  }
  registerError.value = (await create({ pilot_name: name, callsign: newPilot.callsign.trim() || null })) ?? ''
}

// --- Long writing ---
const saveColumn = (column: 'appearance' | 'personality') => (doc: Json | null) => track(updateCharacter({ [column]: doc }))
const saveImage = (path: string | null) => track(updateCharacter({ pilot_image: path }))
const saveBackstory = (doc: Json | null) => track(updateSheet({ backstory: doc }))

// --- Stats: personal stats come from the pilot_stats table, piloting stats are LANCER's HASE ---
// Bionics for their box, each opening its full information.
const bionicOptions = computed(() => {
  const statNames = new Map(pilotStats.value.map((stat) => [stat.id, stat.name]))
  // HORUS and NHC biomods are as strict as Exotic ones (the developer, 2026-11-19): GM edit mode only, for everyone.
  return bionicItems(bionics.value).map((item, i) => {
    const r = restrictionOf(bionics.value[i])
    return { ...item, gmOnly: false, exotic: r.exotic || r.gmOnly, info: () => bionicInfo(bionics.value[i], statNames) }
  })
})
const stats = computed(() => sheetStats(sheet.value, pilotStats.value, bionics.value, pilotBonuses(sheet.value, gear.value, talents.value, coreBonuses.value)))
// Grit is LANCER's: half the level, rounded up. Shown only; the mech maths doesn't use it.
const vitals = computed(() => [
  ...pilotVitals(sheet.value, gear.value, talents.value, coreBonuses.value),
  { id: 'grit', name: 'Grit', value: Math.ceil(gm.value.level / 2), icon: gritIcon, contributors: [`Half of level ${gm.value.level}, rounded up`] },
])

// --- Level and manna (set by GMs), what manna buys, and the rule check (src/rules.ts; docs/lancer-rules.md) ---
const { frames, weapons, systems, mods } = useMechData()
const catalogue = useCatalogue()
// Manna is private to the pilot's player and GMs: other viewers get no figure, and nothing to check it against.
const balance = computed(() => (!canSeeManna.value ? Infinity : gm.value.manna) - mannaSpent(sheet.value, bionicPrices.value, mechs.value.length))

// Licences: one per original licensed frame (alternate frames share it). Each rank unlocks the frames and gear of that
// licence level. A licence held under an alternate's own id (bought before alternates shared one) still shows, "stale", so it
// can be lowered or removed; the rule check says why.
const licenceOptions = computed(() => {
  const option = (frame: Frame, stale = false) => ({ id: frame.id, name: licenceName(frames.value, frame.id), meta: frame.mechtype.join('/'), info: () => frameInfo(frame, frames.value), ...restrictionOf(frame), stale })
  const originals = licensedFrames(frames.value)
  return [...originals.map((frame) => option(frame)), ...frames.value.filter((f) => f.licenceLevel > 0 && !originals.includes(f) && sheet.value.licences?.[f.id]).map((frame) => option(frame, true))]
})
const licenceDetails = (id: string): RankStep[] => {
  const frame = frames.value.find((f) => f.id === id)
  const options = frame ? licenceFrames(frame, frames.value) : []
  const first = Math.min(...options.map((f) => f.licenceLevel))
  return [1, 2, 3].map((level) => ({
    unlocks: frame ? licenceUnlocks(frame, weapons.value, systems.value, mods.value, level, frames.value) : [],
    // Once the rank that unlocks the frames is held, the pilot picks which one the licence gives.
    choice: options.length > 1 && level === first && (sheet.value.licences?.[id] ?? 0) >= level
      ? { value: chosenFrame(frame!, frames.value, sheet.value.frame_choices).id, options: options.map((f) => ({ value: f.id, name: f.name, info: () => frameInfo(f, frames.value) })) }
      : undefined,
  }))
}
const saveFrameChoice = (licence: string, frameId: string) => track(updateSheet({ frame_choices: { ...sheet.value.frame_choices, [licence]: frameId } }))
// The hangar: a mech's frame comes from the sheet, and a new mech joins the card's list.
const frameId = (mechId: string) => sheet.value.mechs?.[mechId]?.frame
const saveMechs = (list: PublicMech[]) => updateCharacter({ mechs: list })
const saveLicences = (licences: Record<string, number>) => track(updateSheet({ licences }))

// Talents: each rank's name and rules.
const talentOptions = computed(() => talents.value.map((t) => ({ id: t.id, name: t.name, meta: t.terse, info: () => talentInfo(t), ...restrictionOf(t) })))
const talentDetails = (id: string): RankStep[] =>
  (talents.value.find((t) => t.id === id)?.ranks ?? []).map((r) => ({ name: r.name, html: r.description }))
const saveTalents = (talentRanks: Record<string, number>) => track(updateSheet({ talents: talentRanks }))

const saveCoreBonuses = (ids: string[]) => track(updateSheet({ core_bonuses: ids }))

// The rule check speaks to whoever can fix it: you, on your own editable sheet (a draft: before you submit it).
const ruleFix = computed(() => (!own || !editable.value ? undefined : draft.value || isDraft.value ? 'draft' : 'own'))
// Your own sheet (and any dead pilot's) has the next-step bar under the header; GMs on a record get a link to review.
const hasNext = computed(() => own || character.value?.status === 'dead')
const gmLink = computed(() => isGm.value && !own && !reviewing)

// The sections, one shown at a time (SheetTabs.vue), remembered in the url as ?tab= so a mech page can link back to
// the hangar; anything unknown falls back to profile.
const tabs = ['profile', 'stats', 'equipment', 'licences', 'talents', 'mechs']
const tab = computed({
  get: () => (tabs.includes(String(route.query.tab)) ? String(route.query.tab) : 'profile'),
  set: (next: string) => router.replace({ query: { ...route.query, tab: next === 'profile' ? undefined : next } }),
})

// Waits for the catalogues, so mechs don't flash up as "not in the loaded content packs".
const problems = computed(() =>
  frames.value.length
    ? pilotProblems(sheet.value, canSeeManna.value ? gm.value : { ...gm.value, manna: Infinity }, catalogue.value, Object.fromEntries(mechs.value.map((m) => [m.id, m.name])))
    : personalStatProblems(sheet.value.pilot_stats),
)

// Saves every stat in the row, so the sheet records the defaults too, not just the one that changed.
function setStat(key: 'pilot_stats' | 'mech_skills', stats: { id: string; value: number }[], id: string, value: number) {
  const values: Sheet['pilot_stats'] = Object.fromEntries(stats.map((stat) => [stat.id, stat.value]))
  track(updateSheet({ [key]: { ...values, [id]: value } }))
}

// --- Bionics and the loadout (1 armour, 2 weapons, 3 gear): picked from the catalogues, stored as ids ---
const saveBionics = (ids: (string | number)[]) => track(updateSheet({ bionics: ids as number[] }))
const saveGear = (ids: string[]) => track(updateSheet({ pilot_gear: ids }))
</script>

<template>
  <main class="page manage">
    <nav v-if="!own && character" aria-label="Breadcrumb" class="crumbs">
      <ol>
        <li><RouterLink :to="{ name: back.name }">{{ back.label }}</RouterLink></li>
        <li aria-current="page">{{ character.callsign ?? character.pilot_name }}</li>
      </ol>
    </nav>

    <p v-if="loading" class="dim">Loading…</p>
    <p v-else-if="loadError" class="notice warn" role="alert">{{ loadError }}</p>
    <p v-else-if="!character && !own" class="notice warn" role="alert">No pilot with that ID.</p>

    <!-- No pilot yet: a name registers one, then the full sheet opens. -->
    <section v-else-if="!character" class="register panel">
      <h1 class="sheet-label">New pilot</h1>
      <form class="register-form" @submit.prevent="register">
        <p>Start with a name. Fill in the rest on the sheet.</p>
        <label class="field">
          <span>Callsign</span>
          <input v-model="newPilot.callsign" type="text" />
        </label>
        <label class="field">
          <span>Name</span>
          <input v-model="newPilot.name" type="text" required />
        </label>
        <p v-if="registerError" class="notice warn" role="alert">{{ registerError }}</p>
        <button type="submit" class="primary">Create pilot</button>
      </form>
    </section>

    <div v-else class="sheet" :class="{ 'has-pilot': !!pilotColour }" :style="pilotStyle">
      <!-- The header: who this is and the figures that matter (the prototype's compact header). -->
      <header class="header" :class="{ joined: hasNext || gmEditing }">
        <div v-if="bannerUrl" class="banner"><img :src="bannerUrl" alt="" /></div>
        <ImageUpload
          v-if="profileEditable"
          class="banner-upload"
          noun="banner"
          :side="BANNER_SIDE"
          :path="profile.fields.value.banner_image"
          :save="(path: string | null) => saveProfile({ banner_image: path })"
        />
        <div class="thumb">
          <img v-if="imageUrl(character.pilot_image)" :src="imageUrl(character.pilot_image)!" :alt="`Portrait of ${character.callsign ?? character.pilot_name}`" />
          <Icon v-else name="pilot" />
        </div>
        <div class="who">
          <!-- While editable the callsign is a field, so the page's heading is for screen readers only. -->
          <h1 v-if="editable" class="sr-only">{{ character.callsign || character.pilot_name || 'My pilot' }}</h1>
          <input
            v-if="editable"
            class="inline callsign"
            type="text"
            aria-label="Callsign"
            placeholder="Callsign"
            :value="character.callsign ?? ''"
            @change="saveText('callsign', $event)"
          />
          <h1 v-else class="callsign">{{ character.callsign ?? character.pilot_name }}</h1>
          <div v-if="profileEditable || profile.fields.value.motto" class="motto">
            <textarea
              v-if="profileEditable"
              class="inline motto-input"
              rows="1"
              aria-label="Motto"
              placeholder="Motto"
              :maxlength="MOTTO_MAX"
              :value="profile.fields.value.motto ?? ''"
              @keydown.enter.prevent="($event.target as HTMLTextAreaElement).blur()"
              @change="saveMotto"
            ></textarea>
            <template v-else>{{ profile.fields.value.motto }}</template>
          </div>
          <div class="subline sep">
            <span>
              <input
                v-if="editable"
                class="inline name"
                type="text"
                aria-label="Name"
                placeholder="Name"
                :value="character.pilot_name"
                @change="saveText('pilot_name', $event)"
              />
              <template v-else>{{ character.pilot_name }}</template>
            </span>
            <span>Player: {{ playerName || 'Unknown player' }}</span>
            <span>
              <span v-if="isDraft && reviewNote" class="badge rejected">Sent back</span>
              <span v-else-if="isDraft" class="badge draft">Draft</span>
              <span v-else class="badge" :class="character.status">{{ capitalise(character.status) }}</span>
            </span>
          </div>
        </div>
        <div class="header-side">
          <dl class="facts">
            <div class="fact">
              <dt class="label">Level</dt>
              <dd class="fact-value num">{{ gm.level }}</dd>
            </div>
            <div class="fact">
              <dt class="label">Licence level</dt>
              <dd class="fact-value num">{{ licenceLevel(sheet) }}</dd>
            </div>
            <div v-if="canSeeManna" class="fact">
              <dt class="label">Manna left</dt>
              <dd class="fact-value num" :class="{ over: balance < 0 }">{{ formatAmount(balance) }}</dd>
              <dd class="fact-sub"><span class="num">{{ formatAmount(mannaSpent(sheet, bionicPrices, mechs.length)) }}</span> of <span class="num">{{ formatAmount(gm.manna) }}</span> spent</dd>
            </div>
          </dl>
          <div v-if="gmLink || (gmCanEdit && !gmEditing)" class="gm-actions">
            <RouterLink v-if="gmLink" class="gm-link" :to="{ name: 'gm-review', params: { id: character.id } }">
              {{ character.status === 'pending' ? 'GM review' : 'GM controls' }}
            </RouterLink>
            <button v-if="gmCanEdit && !gmEditing" type="button" class="small" @click="setEdit(true)">Edit pilot</button>
          </div>
        </div>
      </header>

      <GmEditBar
        v-if="gmEditing"
        :name="character.callsign ?? character.pilot_name"
        :waiting="waiting"
        :saving="saving"
        :saved="saved"
        :error="saveError"
        :can-retry="!anyConflict"
        @retry="track(retryAll())"
        @done="setEdit(false)"
      />

      <!-- What happens next: a badge, a sentence and the actions that do it (secondary first, the primary last). Your
           own sheet's save status follows the sentence. -->
      <div v-if="hasNext" class="next">
        <p v-if="character.status === 'dead'" class="next-text">This pilot is dead. The record is read-only.</p>
        <template v-else-if="isDraft && reviewNote">
          <span class="badge rejected">Sent back</span>
          <p class="next-text">A GM sent this back. Fix what they asked, then resubmit.</p>
        </template>
        <template v-else-if="isDraft">
          <span class="badge draft">Draft</span>
          <p class="next-text">GMs see it once you submit it.</p>
        </template>
        <template v-else-if="character.status === 'pending'">
          <span class="badge pending">Pending</span>
          <p class="next-text">Waiting on a GM.</p>
        </template>
        <p v-else-if="!draft" class="next-text">Changes need GM approval.</p>
        <template v-else-if="sentBack">
          <span class="badge rejected">Sent back</span>
          <p class="next-text">A GM sent this back. Fix what they asked, then resubmit.</p>
        </template>
        <template v-else-if="!draft.submitted_at">
          <span class="badge draft">Draft</span>
          <p class="next-text">Your approved pilot won't change until a GM approves this.</p>
        </template>
        <template v-else>
          <span class="badge pending">Submitted</span>
          <p class="next-text">Waiting on a GM.</p>
        </template>

        <SaveStatus v-if="own" :saving="saving" :saved="saved" :error="saveError" :can-retry="!anyConflict" @retry="track(retryAll())" />

        <div v-if="own && character.status !== 'dead'" class="next-actions">
          <button v-if="isDraft" type="button" class="primary small" @click="track(submitPilot())">{{ reviewNote ? 'Resubmit pilot' : 'Submit pilot' }}</button>
          <button v-else-if="character.status === 'pending'" type="button" class="small" @click="track(reopenPilot())">Edit pilot</button>
          <button v-else-if="approvedOwn && !draft" type="button" class="primary small" @click="track(proposeChange())">Propose changes</button>
          <template v-else-if="approvedOwn && !draft!.submitted_at">
            <button type="button" class="small" @click="withdraw">Withdraw change</button>
            <button type="button" class="primary small" @click="track(submitChange())">Submit change</button>
          </template>
          <template v-else-if="approvedOwn">
            <button type="button" class="small" @click="track(reopenChange())">Edit change</button>
            <button type="button" class="small" @click="withdraw">Withdraw change</button>
          </template>
        </div>
      </div>

      <ConflictNotice v-if="anyConflict" />
      <CatalogueNotice />

      <!-- Long notes and the rule check sit under the header. -->
      <div v-if="own && reviewNote && isDraft" class="notice warn" role="note">
        <p class="notice-title">Note from the GM</p>
        <p class="note-text">{{ reviewNote }}</p>
      </div>
      <div v-else-if="own && reviewNote && character.status === 'approved'" class="notice" role="note">
        <div class="notice-head">
          <p class="notice-title">Note from the GM</p>
          <button type="button" class="small quiet" :disabled="saving" @click="track(dismissApprovalNote())">Clear note</button>
        </div>
        <p class="note-text">{{ reviewNote }}</p>
      </div>
      <div v-if="changeNote" class="notice" role="note">
        <div class="notice-head">
          <p class="notice-title">Note from the GM</p>
          <button type="button" class="small quiet" @click="clearChangeNote">Clear note</button>
        </div>
        <p class="note-text">Your last change was approved.</p>
        <p class="note-text">{{ changeNote }}</p>
      </div>
      <div v-if="own && sentBack" class="notice warn" role="note">
        <p class="notice-title">Note from the GM</p>
        <p class="note-text">{{ sentBack }}</p>
      </div>
      <RuleCheck :problems="problems" :fix="ruleFix" />

      <!-- One section at a time. v-show keeps every panel mounted, so switching never loses an open picker or an
           unsaved field. Only this slim row sticks (under the top bar). -->
      <SheetTabs v-model="tab" :tabs="tabs" class="sheet-tabs" :counts="{ mechs: mechs.length }" />

      <div v-show="tab === 'profile'" class="tab-panel profile-tab">
        <CommendationBadges :awards="awards.awards.value" />
        <div class="profile">
          <div class="writing">
            <SheetField class="panel" title="Appearance" :doc="character.appearance" :editable="editable" :save="saveColumn('appearance')" />
            <SheetField class="panel" title="Personality" :doc="character.personality" :editable="editable" :save="saveColumn('personality')" />
            <SheetField
              v-if="canSeeBackstory"
              class="panel"
              title="Backstory"
              :doc="sheet.backstory ?? null"
              :editable="editable"
              :save="saveBackstory"
            >
              <template #head>
                <BackstoryVisibility :is-public="backstory.isPublic.value" :can-change="canToggleBackstory" :set="backstory.set" />
              </template>
            </SheetField>
            <SheetField v-else-if="backstory.isPublic.value" class="panel" title="Backstory" quiet :doc="backstory.copy.value" :editable="false" />
          </div>
          <section class="panel">
            <h2 class="sheet-label">Identity</h2>
            <Portrait class="identity-portrait" :src="character.pilot_image" :alt="`Portrait of ${character.callsign ?? character.pilot_name}`" />
            <ImageUpload v-if="editable" class="identity-upload" :path="character.pilot_image" :save="saveImage" />
            <dl class="kv">
              <template v-for="[column, label] in IDENTITY" :key="column">
                <dt><label v-if="editable" :for="`identity-${column}`">{{ label }}</label><template v-else>{{ label }}</template></dt>
                <dd>
                  <input v-if="editable" :id="`identity-${column}`" type="text" :value="character[column] ?? ''" @change="saveText(column, $event)" />
                  <template v-else>{{ character[column] ?? '–' }}</template>
                </dd>
              </template>
            </dl>
            <PilotColourField
              v-if="profileEditable"
              class="identity-colour"
              :colour="profile.fields.value.colour"
              @preview="previewColour = $event ?? undefined"
              @save="saveColour"
            />
          </section>
        </div>
        <PilotGallery
          :items="profile.fields.value.gallery"
          :editable="profileEditable"
          :name="character.callsign ?? character.pilot_name"
          :save="(items) => saveProfile({ gallery: items })"
        />
        <div class="record-row">
          <PilotIdCard
            :id="character.id"
            :callsign="(approved?.character ?? character).callsign"
            :name="(approved?.character ?? character).pilot_name"
            :status="character.status"
            :approved-at="character.approved_at"
            :level="gm.level"
            :licence-level="licenceLevel(approved?.sheet ?? sheet)"
            :portrait="(approved?.character ?? character).pilot_image"
            :draft-open="!!approved"
            :colour="pilotColour"
            :medals="awards.awards.value.map((a) => a.commendation.icon)"
          />
          <ServiceRecord :record="record" :can-log="canLog" :can-gm="canGmRecord" />
        </div>
        <!-- Your approved pilot can die without a GM's approval, after an "are you sure?". -->
        <section v-if="approvedOwn" class="panel danger-zone">
          <h2 class="sheet-label">Danger zone</h2>
          <div class="danger-body">
            <p class="dim">Mark this pilot dead if they die in the story. This can't be undone.</p>
            <button type="button" class="danger" @click="confirmDeath">Mark pilot dead</button>
          </div>
        </section>
      </div>

      <div v-show="tab === 'stats'" class="tab-panel section-grid">
        <StatRow class="panel span-all" title="General stats" :stats="vitals" :editable="false" :min="0" :max="0" />
        <StatRow
          class="panel"
          title="Piloting stats (HASE)"
          :stats="stats.piloting"
          :editable="editable"
          :min="STAT_MIN"
          :max="STAT_MAX"
          :budget="skillPoints(gm.level)"
          @set="(id, value) => setStat('mech_skills', stats.piloting, id, value)"
        />
        <StatRow
          class="panel"
          title="Personal stats"
          :stats="stats.personal"
          :editable="editable"
          :min="PERSONAL_STAT_MIN"
          :max="PERSONAL_STAT_MAX"
          :budget="PERSONAL_STAT_POINTS"
          @set="(id, value) => setStat('pilot_stats', stats.personal, id, value)"
        />
      </div>
      <div v-show="tab === 'equipment'" class="tab-panel">
        <LoadoutBox
          class="panel"
          title="Biomods"
          :items="bionicOptions"
          :chosen="sheet.bionics ?? []"
          :editable="editable"
          :limit="{ label: 'Mod points', unit: 'mod', max: modLimit(gm.level) }"
          :balance="balance"
          :save="saveBionics"
        />
        <PilotLoadout class="panel" :items="gear" :chosen="sheet.pilot_gear ?? []" :editable="editable" :save="saveGear" />
      </div>
      <div v-show="tab === 'licences'" class="tab-panel">
        <RankPanel
          class="panel"
          title="Licences"
          noun="licence"
          :options="licenceOptions"
          :held="sheet.licences ?? {}"
          :details="licenceDetails"
          columns
          :price="PRICES.licenceRank"
          :balance="balance"
          :editable="editable"
          :save="saveLicences"
          :choose="saveFrameChoice"
        >
          <template #summary>
            <span class="meter-inline">Licence level <span class="num">{{ licenceLevel(sheet) }}</span></span>
          </template>
        </RankPanel>
        <CoreBonusPanel
          class="panel"
          :options="coreBonuses"
          :licences="sheet.licences ?? {}"
          :frames="frames"
          :taken="sheet.core_bonuses ?? []"
          :picks="coreBonusPicks(sheet)"
          :editable="editable"
          :save="saveCoreBonuses"
        />
      </div>
      <div v-show="tab === 'talents'" class="tab-panel">
        <RankPanel
          class="panel"
          title="Talents"
          noun="talent"
          :options="talentOptions"
          :held="sheet.talents ?? {}"
          :details="talentDetails"
          tiers
          :price="PRICES.talentRank"
          :balance="balance"
          :editable="editable"
          :save="saveTalents"
        />
      </div>

      <div v-show="tab === 'mechs'" class="tab-panel">
        <MechHangar :mechs="mechs" :editable="editable" :link="mechLink" :frame-id="frameId" :save="saveMechs" :balance="balance" />
      </div>

      <!-- :key resets the decision box after a decision, so it shows the new status. -->
      <GmReview v-if="reviewing && isGm" :key="character.status" :pilot="character" :sheet-updated-at="sheetUpdatedAt" :problems="problems" :awards="awards" @reviewed="load" @awarded="record.load" />
    </div>
  </main>
</template>

<style scoped>
/* The stats tab is a .section-grid (style.css), not a column. */
.tab-panel.section-grid {
  display: grid;
}

/* --- Header: portrait, callsign and name, then the figures (the prototype's .header) --- */
.header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-l);
  --pad: var(--space-l);
  padding: var(--pad);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
  overflow-wrap: anywhere; /* a long unbroken name wraps instead of widening the page */
}

/* The pilot's colour (decoration only: it never marks a control or a status) is the header's top edge. */
.has-pilot .header {
  border-top: 3px solid var(--pilot);
}

/* The banner: a strip across the header's top, fading into the panel at its foot, with the pilot's colour under it. */
.banner {
  position: relative;
  grid-column: 1 / -1;
  height: 9rem;
  margin: calc(-1 * var(--pad)) calc(-1 * var(--pad)) 0;
  overflow: hidden;
  border-bottom: 2px solid var(--pilot, var(--rule));
  border-radius: var(--radius) var(--radius) 0 0;
}

.banner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banner::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: 60%;
  background: linear-gradient(transparent, var(--panel));
}

.banner-upload {
  grid-column: 1 / -1;
  margin: calc(-1 * var(--space-s)) 0 0;
}

/* The motto, with the pilot's colour as a small bar at its left. */
.motto {
  align-self: stretch;
  margin-top: 4px;
  padding-left: var(--space-s);
  border-left: 3px solid var(--pilot, var(--rule));
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-style: italic;
}

.motto .inline {
  max-width: 100%;
  min-width: 14ch;
  color: inherit;
  font: inherit;
}

/* A long motto wraps (a growing textarea, not a one-line box that clips it). */
.motto .motto-input {
  display: block;
  resize: none;
  overflow: hidden;
  overflow-wrap: anywhere;
  line-height: 1.4;
}

/* The ID card beside the service record; stacked on narrow screens. */
.record-row {
  display: grid;
  grid-template-columns: minmax(0, 36rem) minmax(0, 1fr);
  align-items: start;
  gap: var(--space-m);
}

@media (max-width: 64rem) {
  .record-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

.has-pilot .profile-tab .panel:not(.danger-zone) {
  border-top: 3px solid var(--pilot);
}

.identity-colour {
  margin-top: var(--space-l);
}

/* With the next-step bar under it, the two read as one block. */
.header.joined {
  border-radius: var(--radius) var(--radius) 0 0;
}

.thumb {
  display: grid;
  place-items: center;
  width: 84px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--raised);
  color: var(--text-dim);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb .icon {
  width: 28px;
  height: 28px;
}

.who {
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* don't stretch the fields: they size to their text */
  min-width: 0;
}

.callsign {
  margin: 0;
  color: var(--text);
  font: 800 var(--fs-xl) / 1.1 var(--sans);
  letter-spacing: 0.02em;
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

/* No percentage cap here: against its shrink-to-fit item it would clip the last letters. */
.inline.name {
  max-width: none;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.header-side {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-m) var(--space-xl);
}

/* Uppercase labels over mono numbers, lined up across the three (a subgrid of label, value, note). */
.facts {
  display: grid;
  grid-template-rows: auto auto auto;
  grid-auto-flow: column;
  gap: 2px var(--space-xl);
  margin: 0;
}

.fact {
  display: grid;
  grid-row: span 3;
  grid-template-rows: subgrid;
  align-content: start;
}

.fact-sub {
  color: var(--text-dim);
  font-size: var(--fs-xs);
}

/* The GM's way to the review page: a link drawn as a small button. */
.gm-actions {
  display: flex;
  align-items: stretch; /* the link and the button match in height */
  gap: var(--space-s);
}

.gm-link {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--edge);
  border-radius: var(--radius);
  font: 700 var(--fs-xs) / 1.2 var(--sans);
  letter-spacing: 0.06em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
}

.gm-link:hover {
  border-color: var(--lilac);
  background: color-mix(in srgb, var(--lilac) 8%, transparent);
}

/* --- What happens next: a band joined to the header's foot --- */
.next {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
  margin-top: calc(-1 * var(--space-m)); /* joined to the header: cancels the sheet's gap */
  padding: var(--space-s) var(--space-l);
  border: 1px solid var(--rule);
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
  background: var(--void);
  font-size: var(--fs-s);
}

.next-text {
  flex: 0 1 auto;
}

.next-actions {
  display: flex;
  gap: var(--space-s);
  margin-left: auto;
}

.note-text {
  white-space: pre-wrap;
}

/* Anything focused (tabbing through fields) scrolls clear of the top bar and tabs. */
.tab-panel * {
  scroll-margin-top: calc(var(--topbar-h) + var(--tabs-h) + var(--space-l));
}

.identity-portrait {
  width: 100%;
  max-width: 240px;
  margin-inline: auto;
}

/* Under the centred portrait, its buttons and status centre too. */
.identity-upload {
  text-align: center;
}

.identity-upload :deep(.buttons) {
  justify-content: center;
}

.kv {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 6px var(--space-l);
  margin: var(--space-l) 0 0;
  font-size: var(--fs-s);
}

.kv dt {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.kv dd {
  min-width: 0;
  margin: 0;
}

/* --- Registering --- */
.register {
  max-width: 32rem;
  margin-inline: auto;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
}

.register-form p {
  margin: 0;
}

.register-form button {
  align-self: flex-start;
}

/* --- Phones: the compact header (56px portrait, the figures on one tight row under it) --- */
@media (max-width: 48rem) {
  .header {
    --pad: var(--space-m);
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-s) var(--space-m);
  }

  .banner {
    height: 6rem;
  }

  .thumb {
    width: 56px;
  }

  .callsign {
    font-size: 22px;
  }

  .header-side {
    grid-column: 1 / -1;
    justify-content: space-between;
    padding-top: var(--space-s);
    border-top: 1px solid var(--rule);
  }

  .facts {
    gap: 0 var(--space-l);
  }

  .facts .label {
    letter-spacing: 0.04em;
  }

  .next {
    padding: var(--space-s) var(--space-m);
  }

  .next-text {
    flex-basis: 100%;
  }

  .next-actions {
    flex-basis: 100%;
  }

  .next-actions button {
    flex: 1;
  }
}
</style>
