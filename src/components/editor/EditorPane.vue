<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { confirmAction } from '../../confirm'
import { loadKind } from '../../catalogue'
import { DUPLICABLE, REFERRING_KINDS, bonusTypesFor, duplicateItem, errorsOf, kindInfo, newId, problemsFor, referencesTo, usedBy, withExoticTag, type Data, type EditorKind, type Problem } from '../../contentEditor'
import { createItem, deleteItem, homebrewPack, loadList, loadSaveLine, publishItem, revertItem, saveItem, usageOf, type Loaded, type Pack } from '../../editorStore'
import { invalidateCatalogues, useGameData } from '../../gameData'
import { alternateOf, licensedFrames, useMechData } from '../../mechData'
import { CHANGED_ELSEWHERE } from '../../lib/supabaseClient'
import { useSaveStatus } from '../../saveStatus'
import { plural } from '../../text'
import ConflictNotice from '../ConflictNotice.vue'
import Icon from '../Icon.vue'
import SaveStatus from '../SaveStatus.vue'
import SheetTabs from '../SheetTabs.vue'
import BiomodForm from './BiomodForm.vue'
import CommendationForm from './CommendationForm.vue'
import CoreBonusForm from './CoreBonusForm.vue'
import EditorPreview from './EditorPreview.vue'
import GearForm from './GearForm.vue'
import ManufacturerForm from './ManufacturerForm.vue'
import FactionForm from './FactionForm.vue'
import FrameForm from './FrameForm.vue'
import ModForm from './ModForm.vue'
import RawDataField from './RawDataField.vue'
import SystemForm from './SystemForm.vue'
import TagForm from './TagForm.vue'
import ActionForm from './ActionForm.vue'
import RuleForm from './RuleForm.vue'
import TalentForm from './TalentForm.vue'
import WeaponForm from './WeaponForm.vue'
import { provideProblems } from './useFields'

// One item's editor: a bar (name, state, Revert, Publish, Save), what to know before saving, the form, the raw-data box
// under the danger zone and the live preview. Saving is explicit, not automatic, because saving an item
// pilots use changes their sheets. It owns what's on screen ("working") and the version last loaded or saved
// ("baseline"); the view keys it by item, so it starts afresh for each one. "item" is null for a new one.
const props = defineProps<{
  kind: EditorKind
  item: Loaded | null
  packs: Pack[]
  packName: string
  homebrewId: number | null
  tags: { id: string; name: string }[]
  // Every tag including hidden ones: the pickers hide those, but validation must still find them.
  knownTags: Map<string, string>
  manufacturers: { id: string; name: string }[]
  stats: { id: string; name: string }[]
  takenIds: Set<string>
  // The other factions' or commendations' names.
  names: string[]
  blank: Data
  wide: boolean
}>()
const emit = defineEmits<{ created: [key: string]; changed: []; deleted: []; duplicate: [data: Data] }>()

const info = kindInfo(props.kind)
const isNew = props.item === null
// Homebrew: in the Campaign homebrew pack (or about to be). Anything else is an imported item, whose edits are kept apart (content_items.edited).
const homebrew = !isNew && props.item!.packId !== null && props.item!.packId === props.homebrewId
const imported = !isNew && !info.site && !homebrew
// Factions and commendations are rows of their own tables: no packs and no item usage, and the owner can delete them.
const own = props.kind === 'factions' || props.kind === 'commendations'
// Biomods are rows of their own table too (not in a pack), so they're deletable once saved. The database refuses a delete while pilots use it.
const kindNamed = own || props.kind === 'bionics'
const deletable = homebrew || (kindNamed && !isNew)
const deleteLabel = `Delete ${kindNamed ? info.singular : 'item'}`
// Tags, actions, rules and biomods have a hidden control in their own form (a biomod's is "retired"); every other kind gets one here.
const ownHide = ['tags', 'actions', 'rules', 'bionics'].includes(props.kind)
const SAVE_SOURCE: Partial<Record<EditorKind, string>> = { bionics: 'bionics', factions: 'organisations', commendations: 'commendations' }
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

const working = shallowRef<Data>(clone(props.item ? (props.item.edited ?? props.item.data) : props.blank))
const baseline = shallowRef<Data>(clone(working.value))
const dirty = computed(() => JSON.stringify(working.value) !== JSON.stringify(baseline.value))
// What the database has: when it last changed (the guard for saves), whether it's still a draft, and whether an import has edits.
const updatedAt = ref(props.item?.updatedAt ?? '')
const draft = ref(props.item?.draft ?? false)
const hasEdit = ref(props.item?.edited != null)
// Starting over (Revert, Revert to original) rebuilds the form, so its text editors take the new data.
const resetKey = ref(0)
const screen = ref('Edit')
const showForm = computed(() => props.wide || screen.value === 'Edit')
const showPreview = computed(() => props.wide || screen.value === 'Preview')
// The preview sticks beside the form only while it fits on screen. A taller one (a frame's full information) scrolls with
// the page, so there's never a scroll box inside the page.
const side = useTemplateRef<HTMLElement>('side')
const fits = ref(true)
const measure = () => {
  if (side.value) fits.value = side.value.offsetHeight <= window.innerHeight - (parseFloat(getComputedStyle(side.value).top) || 0)
}
const sizeWatch = new ResizeObserver(measure)
onMounted(() => { if (side.value) sizeWatch.observe(side.value); window.addEventListener('resize', measure) })
onUnmounted(() => { sizeWatch.disconnect(); window.removeEventListener('resize', measure) })

// A new item's id comes from its name (site rows get theirs from the database, a manufacturer's is typed) until it's saved the first time.
watch(() => working.value.name, (name) => {
  if (!isNew || info.site || props.kind === 'manufacturers') return
  const id = newId(props.kind, String(name ?? ''), props.takenIds)
  // A frame is its own licence, so its licence id follows its id.
  working.value = { ...working.value, id, ...(props.kind === 'frames' && !working.value.variant ? { license_id: id } : {}) }
})

// Everything wrong with what's on screen. Errors block Save; warnings don't.
const rawError = ref('')
// Licences are frames' (a weapon of Marrow II needs the Marrow licence at rank II), so the frames are read for the choice.
const { frames } = useMechData()
const { talents, coreBonuses, bionics } = useGameData()
const licences = computed(() => licensedFrames(frames.value).map((frame) => ({ id: frame.id, name: frame.name, source: frame.source })))
// Every commendation including hidden ones, for the requirement existence check.
const commendationIds = ref<string[]>([])
onMounted(async () => { commendationIds.value = (await loadList('commendations')).rows.map((row) => row.key) })
const problems = computed<Problem[]>(() => {
  const found = problemsFor(props.kind, working.value, {
    id: props.item?.key ?? String(working.value.id ?? ''),
    tags: props.knownTags,
    statIds: props.stats.map((stat) => stat.id),
    known: props.takenIds,
    licences: new Set(frames.value.map((frame) => frame.id)),
    talents: new Set(talents.value.map((talent) => talent.id)),
    coreBonuses: new Set(coreBonuses.value.map((bonus) => bonus.id)),
    alternates: new Set(frames.value.filter((frame) => alternateOf(frame, frames.value)).map((frame) => frame.id)),
    commendations: new Set(commendationIds.value),
    others: props.names,
  })
  if (isNew && !info.site && props.takenIds.has(String(working.value.id))) found.push({ level: 'error', text: 'That ID is already used by another item.', field: 'id' })
  if (rawError.value) found.push({ level: 'error', text: rawError.value })
  return found
})
const errorCount = computed(() => errorsOf(problems.value).length)
// A new item shows no problems until something is typed (Save stays blocked meanwhile).
const shown = computed(() => (isNew && !dirty.value ? [] : problems.value))
provideProblems(shown)
// The form's folds remember being open or closed per kind (FoldPanel.vue).
provide('editor-kind', props.kind)
const bonusTypes = computed(() => bonusTypesFor(props.kind, props.stats))

// Who uses this item: saving changes their sheets.
const pilots = ref<string[]>([])
const usageError = ref(false)
onMounted(async () => {
  if (!props.item || own) return
  const result = await usageOf(props.kind, props.item.key)
  pilots.value = result.pilots
  usageError.value = !!result.error
})
// Which other items point at this one (read from the loaded content, so there's no extra request).
// The biomods arrive after this pane mounts, so the list is computed.
const loadedRows = shallowRef<{ id: string; data: unknown }[]>([])
onMounted(async () => {
  if (!props.item || info.site || props.kind === 'rules') return
  loadedRows.value = (await Promise.all(REFERRING_KINDS.map(loadKind))).flatMap((result) => result.rows)
})
const references = computed(() => (!props.item || info.site || props.kind === 'rules' ? [] : referencesTo(props.item.key, [...loadedRows.value, ...bionics.value.map((b) => ({ id: String(b.id), data: b }))])))

// Who saved it last (owner-only stamp; nothing for an item nobody has saved yet).
const savedLine = ref('')
const loadStamp = async () => { if (props.item) savedLine.value = await loadSaveLine(SAVE_SOURCE[props.kind] ?? 'content_items', props.item.key) }
onMounted(loadStamp)
const hidden = computed({
  get: () => working.value.hidden === true,
  // Unticking removes the field, so the item matches its original again.
  set: (value) => { const { hidden: _, ...rest } = working.value; working.value = value ? { ...rest, hidden: true } : rest },
})

const status = useSaveStatus()
const conflict = ref(false)
watch(working, () => { if (dirty.value) status.saved.value = false })
// An Exotic manufacturer puts the Exotic Gear tag on the item (and the save adds it too, editorStore.ts).
watch(working, (data) => { const next = withExoticTag(props.kind, data); if (next !== data) working.value = next })
const busy = computed(() => status.saving.value)
const named = computed(() => String(working.value.name ?? '').trim())
const title = computed(() => named.value || (isNew ? `New ${info.singular}` : props.item!.key))
const current = () => ({ ...props.item!, updatedAt: updatedAt.value })

// Runs one write and shows it as the page's save status. A write that finds the item saved somewhere else stops all saves.
async function run(write: () => Promise<{ updatedAt?: string; error?: string; key?: string }>, done: (result: { updatedAt?: string; key?: string }) => void) {
  const failed = await status.track(write().then((result) => {
    if (result.error === undefined) done(result)
    return result.error ?? null
  }))
  if (failed === CHANGED_ELSEWHERE) conflict.value = true
  else if (!failed) invalidateCatalogues()
}

async function save() {
  if (errorCount.value || busy.value || conflict.value) return
  const snapshot = withExoticTag(props.kind, clone(working.value))
  await run(async () => {
    if (!isNew) return saveItem(current(), snapshot, homebrew)
    let packId: number | null = null
    if (!info.site) {
      const pack = await homebrewPack(props.packs)
      if (pack.error !== undefined) return { error: pack.error }
      packId = pack.id
    }
    return createItem(props.kind, snapshot, packId)
  }, (result) => {
    baseline.value = snapshot
    if (isNew) return emit('created', result.key!)
    updatedAt.value = result.updatedAt!
    hasEdit.value = hasEdit.value || imported
    loadStamp()
    emit('changed')
  })
}

async function publish() {
  if (busy.value || dirty.value || conflict.value) return
  if (!(await confirmAction(`Publish ${title.value}? Players can use it at once. This can't be undone.`, { confirmLabel: 'Publish item' }))) return
  await run(() => publishItem(current()), (result) => {
    updatedAt.value = result.updatedAt!
    draft.value = false
    emit('changed')
  })
}

async function revertToOriginal() {
  if (busy.value || conflict.value) return
  if (!(await confirmAction(`Revert ${title.value} to the pack's version? Your edits are lost. This can't be undone.`, { confirmLabel: 'Revert to original', danger: true }))) return
  await run(() => revertItem(current()), (result) => {
    updatedAt.value = result.updatedAt!
    hasEdit.value = false
    working.value = clone(props.item!.data)
    baseline.value = clone(working.value)
    resetKey.value++
    emit('changed')
  })
}

const discard = () => {
  working.value = clone(baseline.value)
  resetKey.value++
}

const deleteError = ref('')
async function remove() {
  if (!(await confirmAction(`Delete ${title.value}? This can't be undone.`, { confirmLabel: deleteLabel, danger: true }))) return
  deleteError.value = (await deleteItem(props.item!.key, props.kind)) ?? ''
  if (!deleteError.value) {
    invalidateCatalogues()
    baseline.value = clone(working.value)
    emit('deleted')
  }
}

// Closing the tab with unsaved changes asks first. A conflict's Reload throws the edits away on purpose, so it doesn't ask.
const reloading = ref(false)
const warnLeaving = (event: BeforeUnloadEvent) => { if (dirty.value && !reloading.value) event.preventDefault() }
onMounted(() => window.addEventListener('beforeunload', warnLeaving))
onUnmounted(() => window.removeEventListener('beforeunload', warnLeaving))
defineExpose({ dirty })
</script>

<template>
  <article class="editor-pane" :aria-label="`Editing ${title}`">
    <div class="bar">
      <SheetTabs v-if="!wide" v-model="screen" class="mtabs" :tabs="['Edit', 'Preview']" label="Editor view" />
      <Icon :name="info.icon" class="kind-ico" />
      <h2>{{ title }}</h2>
      <span v-if="draft" class="badge draft">Draft</span>
      <span v-else-if="homebrew" class="badge">Published</span>
      <span v-else-if="hasEdit" class="badge">Edited</span>
      <span v-else-if="imported" class="badge">Official</span>
      <span v-if="dirty && !busy" class="dim status">Unsaved changes</span>
      <SaveStatus :saving="busy" :saved="status.saved.value && !dirty" :error="conflict ? '' : status.error.value" :can-retry="!conflict" @retry="save" />
      <div class="btn-row">
        <button v-if="!isNew && DUPLICABLE.includes(kind)" type="button" class="quiet small" @click="emit('duplicate', duplicateItem(kind, working, takenIds))">Duplicate</button>
        <button type="button" class="quiet small" :disabled="!dirty || busy" @click="discard">Discard changes</button>
        <template v-if="draft">
          <span v-if="dirty" class="blocked">
            <button type="button" class="small" disabled aria-describedby="publish-why">Publish item</button>
            <span id="publish-why" class="blocked-reason">Save your changes first</span>
          </span>
          <button v-else type="button" class="small" :disabled="busy || conflict" @click="publish">Publish item</button>
        </template>
        <span v-if="errorCount" class="blocked">
          <button type="button" class="primary small" disabled aria-describedby="save-why">{{ isNew ? (info.site ? 'Create' : 'Create draft') : 'Save changes' }}</button>
          <span id="save-why" class="blocked-reason">Fix {{ plural(errorCount, 'problem') }} first</span>
        </span>
        <button v-else type="button" class="primary small" :disabled="busy || conflict || (!isNew && !dirty)" @click="save">{{ isNew ? (info.site ? 'Create' : 'Create draft') : 'Save changes' }}</button>
      </div>
    </div>

    <ConflictNotice v-if="conflict" @reload="reloading = true" />

    <div class="cols">
      <div v-show="showForm" :key="resetKey" class="ed-form">
        <!-- Where an imported item comes from: one quiet line (the bar's badge says Official or Edited). -->
        <div v-if="imported" class="source">
          <p class="dim">From {{ packName }}.</p>
          <button v-if="hasEdit" type="button" class="small" :disabled="busy || conflict" @click="revertToOriginal">Revert to original</button>
        </div>
        <p v-if="pilots.length" class="notice" role="status">{{ usedBy(pilots) }}. Saving changes their sheets.</p>
        <p v-else-if="usageError" class="dim hint">Couldn't check who uses this.</p>
        <p v-if="references.length" class="dim hint">{{ usedBy(references) }}.</p>
        <div v-if="shown.length" class="notice" :class="{ warn: errorCount }" :role="errorCount ? 'alert' : 'status'">
          <p class="notice-title">{{ errorCount ? `Fix ${plural(errorCount, 'problem')} before saving` : plural(shown.length, 'warning') }}</p>
          <ul class="problems">
            <li v-for="(problem, index) in shown" :key="index"><b>{{ problem.level === 'error' ? 'Error' : 'Warning' }}:</b> {{ problem.text }}</li>
          </ul>
        </div>

        <label v-if="!ownHide" class="check"><input v-model="hidden" type="checkbox" />Hidden from players</label>
        <p v-if="hidden && !ownHide" class="dim hint">Players can't pick it. Pilots who have it keep it.</p>
        <p v-if="savedLine" class="dim hint">{{ savedLine }}</p>

        <GearForm v-if="kind === 'pilot_gear'" v-model="working" :tags="tags" :bonus-types="bonusTypes" :locked="!isNew" />
        <CoreBonusForm v-else-if="kind === 'core_bonuses'" v-model="working" :manufacturers="manufacturers" :bonus-types="bonusTypes" :locked="!isNew" />
        <WeaponForm v-else-if="kind === 'weapons'" v-model="working" :tags="tags" :bonus-types="bonusTypes" :locked="!isNew" :manufacturers="manufacturers" :licences="licences" />
        <SystemForm v-else-if="kind === 'systems'" v-model="working" :tags="tags" :bonus-types="bonusTypes" :locked="!isNew" :manufacturers="manufacturers" :licences="licences" />
        <ModForm v-else-if="kind === 'mods'" v-model="working" :tags="tags" :bonus-types="bonusTypes" :locked="!isNew" :manufacturers="manufacturers" :licences="licences" />
        <TalentForm v-else-if="kind === 'talents'" v-model="working" :bonus-types="bonusTypes" :locked="!isNew" />
        <FrameForm v-else-if="kind === 'frames'" v-model="working" :bonus-types="bonusTypes" :locked="!isNew" :manufacturers="manufacturers" />
        <ManufacturerForm v-else-if="kind === 'manufacturers'" v-model="working" :locked="!isNew" />
        <TagForm v-else-if="kind === 'tags'" v-model="working" :locked="!isNew" />
        <ActionForm v-else-if="kind === 'actions'" v-model="working" :locked="!isNew" />
        <RuleForm v-else-if="kind === 'rules'" v-model="working" :locked="!isNew" />
        <BiomodForm v-else-if="kind === 'bionics'" v-model="working" :stats="stats" :manufacturers="manufacturers" />
        <FactionForm v-else-if="kind === 'factions'" v-model="working" />
        <CommendationForm v-else-if="kind === 'commendations'" v-model="working" />

        <section v-if="deletable" class="panel danger-zone" aria-labelledby="danger-title">
          <h3 id="danger-title" class="sheet-label">Danger zone</h3>
          <div class="danger-body">
            <p class="dim">Deleting removes this {{ kindNamed ? info.singular : 'item' }}. This can't be undone.</p>
            <span v-if="pilots.length" class="blocked">
              <button type="button" class="danger" disabled aria-describedby="delete-why">{{ deleteLabel }}</button>
              <span id="delete-why" class="blocked-reason">{{ usedBy(pilots) }}</span>
            </span>
            <button v-else type="button" class="danger" :disabled="busy || usageError" @click="remove">{{ deleteLabel }}</button>
          </div>
          <p v-if="deleteError" class="notice warn" role="alert">Not deleted: {{ deleteError }}</p>
        </section>

        <RawDataField v-model="working" @error="rawError = $event" />
      </div>

      <aside v-show="showPreview" ref="side" class="side" :class="{ stick: fits }">
        <EditorPreview :kind="kind" :id="String(working.id ?? '')" :data="working" :original="imported && hasEdit ? item!.data : null" :stats="stats" />
      </aside>
    </div>
  </article>
</template>

<style scoped>
/* The preview sits beside the form only when the editor has the room (the pane beside the list is often narrow). */
.editor-pane {
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-m);
  min-width: 0;
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(24rem, 30%, 26rem);
  gap: var(--space-l);
  align-items: start;
}

.side {
  top: calc(var(--topbar-h) + var(--tabs-h) + 1px + 4.5rem);
}

.side.stick {
  position: sticky;
}

.problems {
  margin: 0;
  padding-left: 1.2em;
}

.source {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
}

.source p {
  margin: 0;
  font-size: var(--fs-s);
}

.hint {
  margin: 0;
  font-size: var(--fs-s);
}

@container (max-width: 54rem) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
  }

  .side.stick {
    position: static;
  }
}

/* Phones: the bar is too tall to keep on screen, so it scrolls with the page; Edit and Preview are its first row. */
@media (max-width: 56rem) {
  .mtabs {
    flex-basis: 100%;
    margin: 0 calc(var(--space-m) * -1);
    padding: 0 var(--space-m);
  }

}
</style>
