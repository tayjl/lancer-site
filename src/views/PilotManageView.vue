<script setup lang="ts">
import { computed, nextTick, provide, reactive, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm, isOwner, session } from '../auth'
import { useBackstoryVisibility } from '../backstory'
import BackstoryVisibility from '../components/BackstoryVisibility.vue'
import { confirmAction } from '../confirm'
import CoreBonusPanel from '../components/CoreBonusPanel.vue'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import ConflictNotice from '../components/ConflictNotice.vue'
import CommendationAward from '../components/CommendationAward.vue'
import GmEditBar from '../components/GmEditBar.vue'
import GmRewards from '../components/GmRewards.vue'
import ReputationPanel from '../components/ReputationPanel.vue'
import RewardHistory from '../components/RewardHistory.vue'
import GmReview from '../components/GmReview.vue'
import FileIndex from '../components/FileIndex.vue'
import FileSection from '../components/FileSection.vue'
import IdentityGrid from '../components/IdentityGrid.vue'
import PilotCover from '../components/PilotCover.vue'
import PilotIdCard from '../components/PilotIdCard.vue'
import ServiceRecord from '../components/ServiceRecord.vue'
import ImageUpload from '../components/ImageUpload.vue'
import PilotColourField from '../components/PilotColourField.vue'
import PilotGallery from '../components/PilotGallery.vue'
import MechHangar from '../components/MechHangar.vue'
import LoadoutBox from '../components/LoadoutBox.vue'
import PilotLoadout from '../components/PilotLoadout.vue'
import gritIcon from '../assets/icons/skill.svg'
import RankPanel, { type RankStep } from '../components/RankPanel.vue'
import SaveStatus from '../components/SaveStatus.vue'
import RuleCheck from '../components/RuleCheck.vue'
import SheetField from '../components/SheetField.vue'
import StatFigures from '../components/StatFigures.vue'
import StatRow from '../components/StatRow.vue'
import StatSources from '../components/StatSources.vue'
import { BANNER_SIDE, cardImages, deleteImage } from '../images'
import { supabase } from '../lib/supabaseClient'
import { usePilotAwards } from '../commendations'
import { displayColour } from '../pilotColour'
import { useServiceRecord } from '../serviceRecord'
import { BANNER_CENTRED, MOTTO_MAX, usePilotProfile, type BannerPosition, type ProfileFields } from '../pilotProfile'
import { bionicItems, pilotBonuses, pilotVitals, sheetStats, useGameData } from '../gameData'
import type { Json } from '../lib/database.types'
import { chosenFrame, licenceFrames, licensedFrames, useMechData, type Frame } from '../mechData'
import { bionicInfo, frameInfo, licenceUnlocks, talentInfo } from '../info'
import { useMyPilot, type MiscItem, type OwnedGear, type Sheet } from '../myPilot'
import { GM_EDIT } from '../restriction'
import { useSaveStatus } from '../saveStatus'
import type { PublicMech } from '../pilots'
import { pilotList } from '../router'
import { coreBonusPicks, restrictionOf, licenceLevel, licenceName, mannaSpent, modLimit, pilotProblems, personalStatProblems, personalStatMin, personalStatMax, personalStatPoints, PRICES, skillPoints, formatAmount, requirementReason, unmetRequirements, useCatalogue } from '../rules'
import { capitalise } from '../text'

// my pilot: your pilot as one scrolling file. A cover (portrait, callsign, name, player, status, medals, then the key
// figures), the "what happens next" bar under it, any notes and the rule check, then numbered sections (identity,
// pilot ID, service record, capabilities, qualifications, equipment, hangar, GM only in a GM's edit mode, gallery) with an index that follows you (a list
// beside the file, a row under the top bar on phones; the url's #hash names the section). Everything is edited
// in place and saves itself. While a pilot is pending you can edit it directly; once it's approved, changes are
// proposed as a draft that a GM approves (src/myPilot.ts).
// The same page, read-only, is every pilot's record (opened from a card, route param "id"), so a record looks
// just like your own sheet. Everything on it is public except the backstory (shown only to the pilot's player and
// GMs, or as a public copy when its player toggles it; src/backstory.ts). A GM's edit mode (?edit=1) is where a GM changes a pilot, rules off: a rewards row in the bar, a GM only section and
// the danger zone. The gm-review route (from the gm: pilots tab) adds the decision for a pending pilot.
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
  grants,
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
  equipGear,
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
const deathError = ref('') // the danger zone's own error, shown under its buttons
async function confirmDeath() {
  const name = character.value!.callsign ?? character.value!.pilot_name
  if (!(await confirmAction(`Mark ${name} dead? They move to the memorial. This can't be undone.`, { confirmLabel: 'Mark dead', danger: true }))) return
  const failed = await track(markDead())
  deathError.value = failed ? `Not saved: ${failed}` : ''
}

// Owners only (the database enforces it): deleting a character also deletes its sheet, changes and reputation. The
// returned row proves something was deleted, since RLS turns a refused delete into "0 rows" rather than an error.
async function deletePilot() {
  const name = character.value!.callsign ?? character.value!.pilot_name
  if (!(await confirmAction(`Delete ${name}? This removes their sheet, mechs and changes. This can't be undone.`, { confirmLabel: 'Delete pilot', danger: true }))) return
  const { data, error } = await supabase.from('characters').delete().eq('id', character.value!.id).select('id, pilot_image, mechs')
  deathError.value = error ? `Not deleted: ${error.message}` : (data?.length ? '' : 'Not deleted: Only owners can delete pilots.')
  if (data?.length) cardImages(data[0]).forEach(deleteImage)
  if (!deathError.value) router.push({ name: 'gm-pilots' })
}

async function withdraw() {
  if (await confirmAction("Withdraw this change? Your approved pilot won't change. This can't be undone.", { confirmLabel: 'Withdraw change', danger: true }))
    track(withdrawChange())
}

// Records' breadcrumb leads back to the queue, or to the list the pilot is in.
const back = computed(() => (reviewing ? { to: { name: 'gm-pilots' }, label: 'GM pilots' } : pilotList(character.value?.status)))
// The top bar marks that list too (src/router.ts).
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
// The browser saves the ID card picture for link previews (PilotIdCard.vue): your own living pilot, or any pilot for a GM.
// Never while a picker colour is only being previewed, so the saved picture always has the saved colour.
const canSaveCard = computed(() => profile.ready.value && !!character.value && !previewColour.value && (isGm.value || (own && character.value.status !== 'dead')))
const pilotColour = computed(() => (previewColour.value ? displayColour(previewColour.value) : profile.colour.value))
const pilotStyle = computed(() => (pilotColour.value ? { '--pilot': pilotColour.value } : undefined))
const saveProfile = (changes: Partial<ProfileFields>) => track(profile.update(changes))
const saveMotto = (event: Event) => saveProfile({ motto: (event.target as HTMLTextAreaElement).value.trim().slice(0, MOTTO_MAX) || null })
const saveColour = (colour: string | null) => {
  previewColour.value = undefined
  return saveProfile({ colour })
}
// A new or removed banner starts centred; once a new one saves, the strip opens in positioning mode.
const positioningBanner = ref(false)
async function saveBanner(path: string | null) {
  const error = await saveProfile({ banner_image: path, ...BANNER_CENTRED })
  positioningBanner.value = !error && !!path
  return error
}
const positionButton = useTemplateRef<HTMLButtonElement>('positionButton')
async function placeBanner(position: BannerPosition | null) {
  positioningBanner.value = false
  if (position) saveProfile(position)
  await nextTick()
  positionButton.value?.focus() // the bar that had focus is gone
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
const canGmRecord = computed(() => isGm.value && gmEditing.value)
const rewardHistoryKey = ref(0) // refreshes the reward history after the rewards row saves
const rewarded = () => {
  load()
  rewardHistoryKey.value++
}
// Backstory privacy: the pilot's own player or a GM editing can change it; other viewers see only a public copy.
const backstory = useBackstoryVisibility(() => character.value?.id)
const canToggleBackstory = computed(() => gmEditing.value || (!!character.value && character.value.player_id === session.value?.user.id))
const gmCanEdit = computed(() => isGm.value && character.value?.status !== 'dead' && (!own || character.value?.status === 'approved'))
const setEdit = (on: boolean) =>
  own && on
    ? router.push({ name: 'pilot-record', params: { id: character.value!.id }, query: { edit: '1' } })
    : router.replace({ query: { ...route.query, edit: on ? '1' : undefined } })
const { gear, bionics, bionicPrices, pilotStats, talents, coreBonuses } = useGameData()

// The identity form. [column, label]
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
const stats = computed(() => sheetStats(sheet.value, pilotStats.value, bionics.value, pilotBonuses(sheet.value, gear.value, talents.value, coreBonuses.value, bionics.value)))
// Grit is LANCER's: half the level, rounded up. Shown only; the mech maths doesn't use it.
const vitals = computed(() => [
  ...pilotVitals(sheet.value, gear.value, talents.value, coreBonuses.value, bionics.value),
  { id: 'grit', name: 'Grit', value: Math.ceil(gm.value.level / 2), icon: gritIcon, contributors: [`Half of level ${gm.value.level}, rounded up`] },
])

// --- Level and manna (set by GMs), what manna buys, and the rule check (src/rules.ts; docs/lancer-rules.md) ---
const { frames, weapons, systems, mods } = useMechData()
const catalogue = useCatalogue()
// The approved sheet, which says which owned gear was free; null for a pilot never approved (its first full loadout is free).
const live = computed(() => (character.value?.status === 'pending' ? null : (approved.value?.sheet ?? sheet.value)))
const spent = computed(() => mannaSpent(sheet.value, bionicPrices.value, mechs.value.length, gear.value, live.value, grants.value))
// Manna is private to the pilot's player and GMs: other viewers get no figure, and nothing to check it against.
const balance = computed(() => (!canSeeManna.value ? Infinity : gm.value.manna) - spent.value)

// Licences: one per original licensed frame (alternate frames share it). Each rank unlocks the frames and gear of that
// licence level. A licence held under an alternate's own id (bought before alternates shared one) still shows, "stale", so it
// can be lowered or removed; the rule check says why.
// What an item, talent, core bonus or frame still needs of this pilot, as a picker's blocked reason ("Needs Brawler II").
const needsOf = (data: unknown) => requirementReason(unmetRequirements(data, sheet.value, (sheet.value.owned_gear ?? []).map((owned) => owned.id), { frames: frames.value, talents: talents.value, coreBonuses: coreBonuses.value, itemName: (id) => gear.value.find((item) => item.id === id)?.name }))
const licenceOptions = computed(() => {
  const option = (frame: Frame, stale = false) => ({ id: frame.id, needs: needsOf(frame.raw), name: licenceName(frames.value, frame.id), meta: frame.mechtype.join('/'), info: () => frameInfo(frame, frames.value), ...restrictionOf(frame), stale })
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
const talentOptions = computed(() => talents.value.map((t) => ({ id: t.id, needs: needsOf(t), name: t.name, meta: t.terse, info: () => talentInfo(t), ...restrictionOf(t) })))
const talentDetails = (id: string): RankStep[] =>
  (talents.value.find((t) => t.id === id)?.ranks ?? []).map((r) => ({ name: r.name, html: r.description }))
const saveTalents = (talentRanks: Record<string, number>) => track(updateSheet({ talents: talentRanks }))

const saveCoreBonuses = (ids: string[]) => track(updateSheet({ core_bonuses: ids }))

// The rule check speaks to whoever can fix it: you, on your own editable sheet (a draft: before you submit it).
const ruleFix = computed(() => (!own || !editable.value ? undefined : draft.value || isDraft.value ? 'draft' : 'own'))
// Your own sheet (and any dead pilot's) has the next-step bar under the header; GMs on a record get a link to review.
const hasNext = computed(() => own || character.value?.status === 'dead')
const gmLink = computed(() => isGm.value && !own && !reviewing && character.value?.status === 'pending')

// The file's sections, in order (the numbers are part of the design). The gallery is left out for read-only viewers when
// it is empty, GM only shows in a GM's edit mode and GM review on a pending pilot's review page. The ids are the url's #hash (a mech page links back to #hangar).
const SEC = {
  identity: { id: 'identity', title: 'Identity' },
  pilotId: { id: 'pilot-id', title: 'Pilot ID' },
  record: { id: 'service-record', title: 'Service record' },
  capabilities: { id: 'capabilities', title: 'Capabilities' },
  qualifications: { id: 'qualifications', title: 'Qualifications' },
  equipment: { id: 'equipment', title: 'Equipment' },
  hangar: { id: 'hangar', title: 'Hangar' },
  gm: { id: 'gm-only', title: 'GM only' },
  review: { id: 'gm-review', title: 'GM review' },
  gallery: { id: 'gallery', title: 'Gallery' },
}
const showGallery = computed(() => profileEditable.value || profile.fields.value.gallery.length > 0)
const showGm = computed(() => isGm.value && (gmEditing.value || character.value?.status === 'dead'))
const showReview = computed(() => reviewing && isGm.value && character.value?.status === 'pending')
// Marking dead: your own approved pilot, or any approved pilot in a GM's edit mode. Deleting: owners, in edit mode or on a dead pilot.
const canMarkDead = computed(() => approvedOwn.value || (gmEditing.value && character.value?.status === 'approved'))
const canDelete = computed(() => isOwner.value && (gmEditing.value || character.value?.status === 'dead'))
// Numbered by position among the shown sections, so a hidden one leaves no gap.
const sections = computed(() =>
  Object.values(SEC)
    .filter((s) => (s !== SEC.gallery || showGallery.value) && (s !== SEC.gm || showGm.value) && (s !== SEC.review || showReview.value))
    .map((s, i) => ({ ...s, no: String(i + 1).padStart(2, '0') })),
)
const sec = (s: { id: string; title: string }) => sections.value.find((x) => x.id === s.id) ?? { ...s, no: '' }

// The cover: the pilot's status as a badge, and the figures that matter. Manna only for the pilot's player and GMs.
const coverBadge = computed(() =>
  isDraft.value && reviewNote.value ? { label: 'Sent back', status: 'rejected' } : isDraft.value ? { label: 'Draft', status: 'draft' } : { label: capitalise(character.value?.status ?? ''), status: character.value?.status ?? '' },
)
const figures = computed(() => [
  { label: 'Level', value: gm.value.level },
  { label: 'Licence level', value: licenceLevel(sheet.value) },
  { label: 'Grit', value: vitals.value.find((v) => v.id === 'grit')?.value ?? '–' },
  { label: 'HP', value: vitals.value.find((v) => v.id === 'pilot_hp')?.value ?? '–' },
  ...(canSeeManna.value
    ? [{ label: 'Manna left', value: formatAmount(balance.value), over: balance.value < 0, sub: `${formatAmount(spent.value)} of ${formatAmount(gm.value.manna)} spent` }]
    : []),
])

// Waits for the catalogues, so mechs don't flash up as "not in the loaded content packs".
const problems = computed(() =>
  frames.value.length
    ? pilotProblems(sheet.value, canSeeManna.value ? gm.value : { ...gm.value, manna: Infinity }, catalogue.value, Object.fromEntries(mechs.value.map((m) => [m.id, m.name])), live.value, grants.value)
    : personalStatProblems(sheet.value.pilot_stats),
)

// Saves every stat in the row, so the sheet records the defaults too, not just the one that changed.
function setStat(key: 'pilot_stats' | 'mech_skills', stats: { id: string; value: number }[], id: string, value: number) {
  const values: Sheet['pilot_stats'] = Object.fromEntries(stats.map((stat) => [stat.id, stat.value]))
  track(updateSheet({ [key]: { ...values, [id]: value } }))
}

// --- Bionics and the loadout (1 armour, 2 weapons, 3 gear): picked from the catalogues, stored as ids ---
const saveBionics = (ids: (string | number)[]) => track(updateSheet({ bionics: ids as number[] }))
// Owned gear and descriptions go into the sheet being edited (a change needs approval); an approved pilot's equipping is live.
const saveOwned = (owned: OwnedGear[], equipped?: string[]) => track(updateSheet(equipped ? { owned_gear: owned, equipped_gear: equipped } : { owned_gear: owned }))
const saveEquipped = (keys: string[]) => track(equipGear(keys))
const saveMisc = (items: MiscItem[]) => track(updateSheet({ misc_items: items }))
const canEquip = computed(() => (character.value?.status === 'pending' ? editable.value : character.value?.status === 'approved' && (own || gmEditing.value)))
</script>

<template>
  <main class="page manage">
    <nav v-if="!own && character" aria-label="Breadcrumb" class="crumbs">
      <ol>
        <li><RouterLink :to="back.to">{{ back.label }}</RouterLink></li>
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

    <div v-else class="sheet" :style="pilotStyle">
      <!-- The cover: who this is and the figures that matter. -->
      <PilotCover
        :id="character.id"
        :callsign="character.callsign"
        :name="character.pilot_name"
        :player="playerName || 'Unknown player'"
        :portrait="character.pilot_image"
        :banner="profile.fields.value.banner_image"
        :banner-position="profile.fields.value"
        :positioning="positioningBanner && profileEditable"
        :motto="profile.fields.value.motto"
        :editable="editable"
        :motto-editable="profileEditable"
        :badge="coverBadge"
        :awards="awards.awards.value"
        :figures="figures"
        :joined="hasNext || gmEditing"
        @text="saveText"
        @motto="saveMotto"
        @position="placeBanner"
      >
        <template #actions>
          <RouterLink v-if="gmLink" class="gm-link gm" :to="{ name: 'gm-review', params: { id: character.id } }">
            GM review
          </RouterLink>
          <button v-if="gmCanEdit && !gmEditing" type="button" class="small gm" @click="setEdit(true)">Edit as GM</button>
        </template>
        <template v-if="editable || profileEditable" #tools>
          <div v-if="editable" class="tool">
            <span class="label">Portrait</span>
            <ImageUpload :path="character.pilot_image" :save="saveImage" />
          </div>
          <div v-if="profileEditable" class="tool">
            <span class="label">Banner</span>
            <ImageUpload noun="banner" :side="BANNER_SIDE" :path="profile.fields.value.banner_image" :save="saveBanner">
              <button v-if="profile.fields.value.banner_image" ref="positionButton" type="button" class="quiet small" :disabled="positioningBanner" @click="positioningBanner = true">
                Position banner
              </button>
            </ImageUpload>
          </div>
          <PilotColourField v-if="profileEditable" :colour="profile.fields.value.colour" @preview="previewColour = $event ?? undefined" @save="saveColour" />
        </template>
      </PilotCover>

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
      >
        <GmRewards :pilot="character" @saved="rewarded" />
      </GmEditBar>

      <!-- What happens next: a sentence and the actions that do it (secondary first, the primary last). A badge only for a
           change, since the cover already shows the pilot's own status. Your own sheet's save status follows the sentence. -->
      <div v-if="hasNext" class="next">
        <p v-if="character.status === 'dead'" class="next-text">This pilot is dead. The record is read-only.</p>
        <p v-else-if="isDraft && reviewNote" class="next-text">A GM sent this back. Fix what they asked, then resubmit.</p>
        <p v-else-if="isDraft" class="next-text">GMs see it once you submit it.</p>
        <p v-else-if="character.status === 'pending'" class="next-text">Waiting on a GM.</p>
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

      <!-- Long notes and the rule check sit under the cover. -->
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

      <!-- The file: an index (it follows you), then the sections on the page itself, not in boxes. -->
      <div class="dossier">
        <FileIndex :sections="sections" />
        <div class="file">
          <FileSection v-bind="sec(SEC.identity)" fixed>
            <IdentityGrid :fields="IDENTITY" :values="character" :editable="editable" @save="(column, event) => saveText(column as TextColumn, event)" />
            <div class="notes">
              <SheetField title="Appearance" :doc="character.appearance" :editable="editable" :save="saveColumn('appearance')" />
              <SheetField title="Personality" :doc="character.personality" :editable="editable" :save="saveColumn('personality')" />
              <SheetField v-if="canSeeBackstory" title="Backstory" :doc="sheet.backstory ?? null" :editable="editable" :save="saveBackstory">
                <template #head>
                  <BackstoryVisibility :is-public="backstory.isPublic.value" :can-change="canToggleBackstory" :set="backstory.set" />
                </template>
              </SheetField>
              <SheetField v-else-if="backstory.isPublic.value" title="Backstory" quiet :doc="backstory.copy.value" :editable="false" />
            </div>
          </FileSection>

          <FileSection v-bind="sec(SEC.pilotId)">
            <PilotIdCard
              class="id-card"
              :id="character.id"
              :callsign="(approved?.character ?? character).callsign"
              :name="(approved?.character ?? character).pilot_name"
              :status="character.status"
              :approved-at="character.approved_at"
              :level="gm.level"
              :licence-level="licenceLevel(approved?.sheet ?? sheet)"
              :portrait="(approved?.character ?? character).pilot_image"
              :draft-open="!!approved"
              :card-version="profile.fields.value.card_version"
              :save-path="canSaveCard ? `${character.player_id}/card-${character.id}.png` : null"
              extra="pilot-id-extra"
              @card-saved="(version) => saveProfile({ card_version: version })"
              :colour="pilotColour"
              :medals="awards.awards.value.map((a) => a.commendation.icon)"
            />
          </FileSection>

          <FileSection v-bind="sec(SEC.record)">
            <ServiceRecord :record="record" :can-log="canLog" :can-gm="canGmRecord" />
          </FileSection>

          <FileSection v-bind="sec(SEC.capabilities)">
            <StatFigures :stats="vitals" />
            <StatSources :stats="vitals" />
            <StatRow
              class="stat-block"
              title="Personal stats"
              :stats="stats.personal"
              :editable="editable"
              :min="personalStatMin()"
              :max="personalStatMax()"
              :budget="personalStatPoints()"
              @set="(id, value) => setStat('pilot_stats', stats.personal, id, value)"
            />
            <StatRow
              class="stat-block"
              title="Piloting stats (HASE)"
              :stats="stats.piloting"
              :editable="editable"
              :min="STAT_MIN"
              :max="STAT_MAX"
              :budget="skillPoints(gm.level)"
              @set="(id, value) => setStat('mech_skills', stats.piloting, id, value)"
            />
          </FileSection>

          <FileSection v-bind="sec(SEC.qualifications)">
            <div class="quals">
              <RankPanel
                class="qual"
                title="Licences"
                noun="licence"
                :options="licenceOptions"
                :held="sheet.licences ?? {}"
                :details="licenceDetails"
                columns
                rows
                :price="PRICES.licenceRank"
                :granted="grants.licences"
                :balance="balance"
                :editable="editable"
                :save="saveLicences"
                :choose="saveFrameChoice"
              >
                <template #summary>
                  <span class="meter-inline">Licence level <span class="num">{{ licenceLevel(sheet) }}</span></span>
                </template>
              </RankPanel>
              <RankPanel
                class="qual"
                title="Talents"
                noun="talent"
                :options="talentOptions"
                :held="sheet.talents ?? {}"
                :details="talentDetails"
                tiers
                rows
                :price="PRICES.talentRank"
                :granted="grants.talents"
                :balance="balance"
                :editable="editable"
                :save="saveTalents"
              />
              <CoreBonusPanel
                class="qual"
                :options="coreBonuses"
                :licences="sheet.licences ?? {}"
                :talents="sheet.talents ?? {}"
                :needs="needsOf"
                :frames="frames"
                :taken="sheet.core_bonuses ?? []"
                :picks="coreBonusPicks(sheet)"
                :editable="editable"
                :save="saveCoreBonuses"
              />
            </div>
          </FileSection>

          <FileSection v-bind="sec(SEC.equipment)">
            <PilotLoadout
              :items="gear"
              :owned="sheet.owned_gear ?? []"
              :equipped="sheet.equipped_gear ?? []"
              :live="live"
              :can-equip="canEquip"
              :editable="editable"
              :can-remove="gmEditing && character.status === 'approved'"
              :balance="balance"
              :granted="grants.gear"
              :needs="(item) => needsOf(item.raw)"
              :equip="saveEquipped"
              :save-owned="saveOwned"
              :misc="sheet.misc_items ?? []"
              :save-misc="saveMisc"
            />
            <LoadoutBox
              class="biomods"
              title="Biomods"
              :items="bionicOptions"
              :chosen="sheet.bionics ?? []"
              :editable="editable"
              :limit="{ label: 'Mod points', unit: 'mod', max: modLimit(gm.level) }"
              :balance="balance"
              :granted="grants.bionics"
              :save="saveBionics"
            />
          </FileSection>

          <FileSection v-bind="sec(SEC.hangar)">
            <MechHangar :mechs="mechs" :editable="editable" :link="mechLink" :frame-id="frameId" :save="saveMechs" :balance="balance" :granted="grants.mechs" />
          </FileSection>

          <FileSection v-if="showGm" v-bind="sec(SEC.gm)">
            <div class="gm-controls">
              <ReputationPanel v-if="character.status !== 'dead'" :character-id="character.id" />
              <CommendationAward v-if="character.status !== 'dead'" :awards="awards" @awarded="record.load" />
              <RewardHistory :character-id="character.id" :refresh="rewardHistoryKey" />
            </div>
          </FileSection>

          <FileSection v-if="showReview" v-bind="sec(SEC.review)">
            <!-- :key resets the decision box after a decision, so it shows the new status. -->
            <GmReview :key="character.status" :pilot="character" :sheet-updated-at="sheetUpdatedAt" :problems="problems" @reviewed="load" />
          </FileSection>

          <FileSection v-if="showGallery" v-bind="sec(SEC.gallery)">
            <PilotGallery
              :items="profile.fields.value.gallery"
              :editable="profileEditable"
              :name="character.callsign ?? character.pilot_name"
              :save="(items) => saveProfile({ gallery: items })"
            />
          </FileSection>

          <!-- Your approved pilot can die without a GM's approval, after an "are you sure?"; a GM in edit mode can too, and owners delete. -->
          <section v-if="canMarkDead || canDelete" class="panel danger-zone">
            <h2 class="sheet-label">Danger zone<span v-if="!approvedOwn" class="private gm">{{ canMarkDead ? 'GM only' : 'Owner only' }}</span></h2>
            <div v-if="canMarkDead" class="danger-body">
              <p class="dim">{{ approvedOwn ? 'Mark this pilot dead if they die in the story.' : `Mark ${character.callsign ?? character.pilot_name} dead if they die in the story.` }} This can't be undone.</p>
              <button type="button" class="danger" @click="confirmDeath">Mark pilot dead</button>
            </div>
            <div v-if="canDelete" class="danger-body">
              <p class="dim">
                Deleting {{ character.callsign ?? character.pilot_name }} removes their sheet, mechs and changes. This can't be undone.<span v-if="canMarkDead" class="private gm">Owner only</span>
              </p>
              <button type="button" class="danger" @click="deletePilot">Delete pilot</button>
            </div>
            <p v-if="deathError" class="notice warn" role="alert">{{ deathError }}</p>
          </section>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* The file's layout (.dossier, .file, .notes) is shared with the mech page, in style.css. */
/* --- 01 Identity: the details, then the long writing (one under another, full width) --- */
.notes {
  margin-top: var(--space-xl);
}

/* --- 02 Pilot ID: the card on show, centred --- */
.id-card {
  max-width: 36rem;
  margin-inline: auto;
}

/* --- 04 Capabilities: blocks set apart by space and their headings alone --- */
.stat-block {
  margin-top: var(--space-xl);
}

/* --- Qualifications (licences, talents, core bonuses) and GM controls: blocks stacked full width --- */
.quals,
.gm-controls {
  display: grid;
  gap: var(--space-xl);
}
/* GmReview's blocks sit unboxed, so a hairline marks where each one starts. */
.gm-controls > :deep(*:not(:first-child):not(.panel)) {
  border-top: 1px solid var(--rule);
  padding-top: var(--space-l);
}

/* --- 06 Equipment: biomods in their own row under the loadout --- */
.biomods {
  margin-top: var(--space-xl);
}

/* --- The cover's tools: a label, then its control, the same gap as a form field's --- */
.tool {
  display: grid;
  gap: var(--space-xs);
}

.tool :deep(.buttons) {
  margin-top: 0;
}

/* --- The GM's way to the review page: a link drawn as a small button (teal and hover from .gm) --- */
.gm-link {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-width: 1px;
  border-style: solid;
  border-radius: var(--radius);
  font: 700 var(--fs-xs) / 1.2 var(--sans);
  letter-spacing: 0.06em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
}

/* As tall as a .small button on touch screens. */
@media (pointer: coarse) {
  .gm-link {
    min-height: 44px;
  }
}

/* --- What happens next: a band joined to the cover's foot --- */
.next {
  margin-top: calc(-1 * var(--space-m)); /* joined to the cover: cancels the sheet's gap */
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
}

.next-text {
  flex: 0 1 auto;
}

.note-text {
  white-space: pre-wrap;
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

@media (max-width: 48rem) {
  .next {
    padding: var(--space-s) var(--space-m);
  }

  .next-text {
    flex-basis: 100%;
  }

  /* The buttons share the row and never break their labels: one that doesn't fit takes the next row. */
  .next-actions {
    flex-wrap: wrap;
    flex-basis: 100%;
  }

  .next-actions button {
    flex: 1 1 auto;
    white-space: nowrap;
  }
}

/* Phones: the next band's buttons in equal columns, one under another when two labels can't both fit. The cover's GM
   link as tall as the buttons stacked with it, and each cover tool's buttons the full width. */
@media (max-width: 40rem) {
  .next-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }

  .gm-link {
    min-height: var(--tap);
  }

  .tool :deep(.buttons) {
    display: grid;
  }
}
</style>
