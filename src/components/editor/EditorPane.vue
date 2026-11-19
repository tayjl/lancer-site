<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { confirmAction } from '../../confirm'
import { bonusTypesFor, errorsOf, kindInfo, newId, problemsFor, usedBy, withExoticTag, type Data, type EditorKind, type Problem } from '../../contentEditor'
import { createItem, deleteItem, homebrewPack, publishItem, revertItem, saveItem, usageOf, type Loaded, type Pack } from '../../editorStore'
import { invalidateCatalogues } from '../../gameData'
import { alternateOf, licensedFrames, useMechData } from '../../mechData'
import { CHANGED_ELSEWHERE } from '../../lib/supabaseClient'
import { useSaveStatus } from '../../saveStatus'
import { plural } from '../../text'
import ConflictNotice from '../ConflictNotice.vue'
import Icon from '../Icon.vue'
import SaveStatus from '../SaveStatus.vue'
import SheetTabs from '../SheetTabs.vue'
import BionicForm from './BionicForm.vue'
import CoreBonusForm from './CoreBonusForm.vue'
import EditorPreview from './EditorPreview.vue'
import GearForm from './GearForm.vue'
import ManufacturerForm from './ManufacturerForm.vue'
import FrameForm from './FrameForm.vue'
import ModForm from './ModForm.vue'
import RawDataField from './RawDataField.vue'
import StatForm from './StatForm.vue'
import SystemForm from './SystemForm.vue'
import TagForm from './TagForm.vue'
import TalentForm from './TalentForm.vue'
import WeaponForm from './WeaponForm.vue'
import { provideProblems } from './useFields'

// One item's editor: a bar (name, state, Revert, Publish, Save), what to know before saving, the form (or the raw-data
// box, for kinds with no form yet) and the live preview. Saving is explicit, not automatic, because saving an item
// pilots use changes their sheets. It owns what's on screen ("working") and the version last loaded or saved
// ("baseline"); the view keys it by item, so it starts afresh for each one. "item" is null for a new one.
const props = defineProps<{
  kind: EditorKind
  item: Loaded | null
  packs: Pack[]
  packName: string
  homebrewId: number | null
  tags: { id: string; name: string }[]
  manufacturers: { id: string; name: string }[]
  stats: { id: string; name: string }[]
  takenIds: Set<string>
  blank: Data
  wide: boolean
}>()
const emit = defineEmits<{ created: [key: string]; changed: []; deleted: [] }>()

const info = kindInfo(props.kind)
const isNew = props.item === null
// Homebrew: in the Campaign homebrew pack (or about to be). Anything else is an imported item, whose edits are kept apart (content_items.edited).
const homebrew = !isNew && props.item!.packId !== null && props.item!.packId === props.homebrewId
const imported = !isNew && !info.site && !homebrew
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

// A new item's id comes from its name (bionics get theirs from the database, a manufacturer's is typed) until it's saved the first time.
watch(() => working.value.name, (name) => {
  if (!isNew || props.kind === 'bionics' || props.kind === 'manufacturers') return
  const id = newId(props.kind, String(name ?? ''), props.takenIds)
  // A frame is its own licence, so its licence id follows its id.
  working.value = { ...working.value, id, ...(props.kind === 'frames' && !working.value.variant ? { license_id: id } : {}) }
})

// Everything wrong with what's on screen. Errors block Save; warnings don't.
const rawError = ref('')
// Licences are frames' (a weapon of Marrow II needs the Marrow licence at rank II), so the frames are read for the choice.
const { frames } = useMechData()
const licences = computed(() => licensedFrames(frames.value).map((frame) => ({ id: frame.id, name: frame.name, source: frame.source })))
const problems = computed<Problem[]>(() => {
  const found = problemsFor(props.kind, working.value, {
    id: props.item?.key ?? String(working.value.id ?? ''),
    tags: new Map(props.tags.map((tag) => [tag.id, tag.name])),
    statIds: props.stats.map((stat) => stat.id),
    known: props.takenIds,
    licences: new Set(frames.value.map((frame) => frame.id)),
    alternates: new Set(frames.value.filter((frame) => alternateOf(frame, frames.value)).map((frame) => frame.id)),
  })
  if (isNew && props.kind !== 'bionics' && props.takenIds.has(String(working.value.id))) found.push({ level: 'error', text: 'That ID is already used by another item.', field: 'id' })
  if (rawError.value) found.push({ level: 'error', text: rawError.value })
  return found
})
const errorCount = computed(() => errorsOf(problems.value).length)
provideProblems(problems)
const bonusTypes = computed(() => bonusTypesFor(props.kind, props.stats))

// Who uses this item: saving changes their sheets.
const pilots = ref<string[]>([])
const usageError = ref(false)
onMounted(async () => {
  if (!props.item) return
  const result = await usageOf(props.kind, props.item.key)
  pilots.value = result.pilots
  usageError.value = !!result.error
})

const status = useSaveStatus()
const conflict = ref(false)
watch(working, () => { if (dirty.value) status.saved.value = false })
// An Exotic manufacturer puts the Exotic Gear tag on the item (and the save adds it too, editorStore.ts).
watch(working, (data) => { const next = withExoticTag(props.kind, data); if (next !== data) working.value = next })
const busy = computed(() => status.saving.value)
const title = computed(() => String(working.value.name ?? '').trim() || (isNew ? `New ${info.singular}` : props.item!.key))
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
  if (!(await confirmAction(`Delete ${title.value}? This can't be undone.`, { confirmLabel: 'Delete item', danger: true }))) return
  deleteError.value = (await deleteItem(props.item!.key)) ?? ''
  if (!deleteError.value) {
    invalidateCatalogues()
    baseline.value = clone(working.value)
    emit('deleted')
  }
}

// Closing the tab with unsaved changes asks first.
const warnLeaving = (event: BeforeUnloadEvent) => { if (dirty.value) event.preventDefault() }
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
      <span v-else-if="homebrew" class="badge approved">Published</span>
      <span v-else-if="hasEdit" class="badge">Edited</span>
      <span v-if="dirty && !busy" class="dim status">Unsaved changes</span>
      <SaveStatus :saving="busy" :saved="status.saved.value && !dirty" :error="status.error.value" :can-retry="!conflict" @retry="save" />
      <div class="btn-row">
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

    <ConflictNotice v-if="conflict" />

    <div class="cols">
      <div v-show="showForm" :key="resetKey" class="ed-form">
        <div v-if="imported" class="notice" role="note">
          <template v-if="hasEdit">
            <div class="notice-head">
              <p class="notice-title">Edited from {{ packName }}</p>
              <button type="button" class="small" :disabled="busy || conflict" @click="revertToOriginal">Revert to original</button>
            </div>
            <p>The pack's version is under Original in the preview.</p>
          </template>
          <template v-else>
            <p class="notice-title">Official content from {{ packName }}</p>
            <p>Saving makes a campaign version.</p>
          </template>
        </div>
        <div v-if="pilots.length" class="notice" role="status">
          <p class="notice-title">{{ usedBy(pilots) }}</p>
          <p>Saving changes their sheets.</p>
        </div>
        <p v-else-if="usageError" class="dim hint">Couldn't check who uses this.</p>
        <div v-if="problems.length" class="notice" :class="{ warn: errorCount }" :role="errorCount ? 'alert' : 'status'">
          <p class="notice-title">{{ errorCount ? `Fix ${plural(errorCount, 'problem')} before saving` : plural(problems.length, 'warning') }}</p>
          <ul class="problems">
            <li v-for="(problem, index) in problems" :key="index"><b>{{ problem.level === 'error' ? 'Error' : 'Warning' }}:</b> {{ problem.text }}</li>
          </ul>
        </div>

        <GearForm v-if="kind === 'pilot_gear'" v-model="working" :tags="tags" :bonus-types="bonusTypes" :locked="!isNew" />
        <CoreBonusForm v-else-if="kind === 'core_bonuses'" v-model="working" :manufacturers="manufacturers" :bonus-types="bonusTypes" :locked="!isNew" />
        <WeaponForm v-else-if="kind === 'weapons'" v-model="working" :tags="tags" :bonus-types="bonusTypes" :locked="!isNew" :manufacturers="manufacturers" :licences="licences" />
        <SystemForm v-else-if="kind === 'systems'" v-model="working" :tags="tags" :bonus-types="bonusTypes" :locked="!isNew" :manufacturers="manufacturers" :licences="licences" />
        <ModForm v-else-if="kind === 'mods'" v-model="working" :tags="tags" :bonus-types="bonusTypes" :locked="!isNew" :manufacturers="manufacturers" :licences="licences" />
        <TalentForm v-else-if="kind === 'talents'" v-model="working" :bonus-types="bonusTypes" :locked="!isNew" />
        <FrameForm v-else-if="kind === 'frames'" v-model="working" :bonus-types="bonusTypes" :locked="!isNew" :manufacturers="manufacturers" />
        <ManufacturerForm v-else-if="kind === 'manufacturers'" v-model="working" :locked="!isNew" />
        <TagForm v-else-if="kind === 'tags'" v-model="working" :locked="!isNew" />
        <BionicForm v-else-if="kind === 'bionics'" v-model="working" :stats="stats" :manufacturers="manufacturers" />
        <StatForm v-else-if="kind === 'pilot_stats'" v-model="working" :locked="!isNew" />
        <p v-else class="notice" role="note">
          <span>No form for {{ info.label.toLowerCase() }} yet. Edit the raw data.</span>
        </p>
        <RawDataField v-if="!info.site" v-model="working" :open="!info.form" @error="rawError = $event" />

        <section v-if="homebrew" class="panel danger-zone" aria-labelledby="danger-title">
          <h3 id="danger-title" class="sheet-label">Danger zone</h3>
          <div class="danger-body">
            <p class="dim">Deleting removes this item. This can't be undone.</p>
            <span v-if="pilots.length" class="blocked">
              <button type="button" class="danger" disabled aria-describedby="delete-why">Delete item</button>
              <span id="delete-why" class="blocked-reason">{{ usedBy(pilots) }}</span>
            </span>
            <button v-else type="button" class="danger" :disabled="busy || usageError" @click="remove">Delete item</button>
            <p v-if="deleteError" class="notice warn" role="alert">Not deleted: {{ deleteError }}</p>
          </div>
        </section>
      </div>

      <aside v-show="showPreview" class="side">
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

/* Where it stands: the item's name and state, then what to do, sticky under the tabs so Save is always at hand. */
.bar {
  position: sticky;
  top: calc(var(--topbar-h) + var(--tabs-h) + 1px);
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
  padding: var(--space-s) var(--space-m);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
}

.bar h2 {
  margin: 0;
  font-size: var(--fs-l);
  overflow-wrap: anywhere;
}

.kind-ico {
  width: 22px;
  height: 22px;
  color: var(--text-dim);
}

.status {
  font-size: var(--fs-s);
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s);
  margin-left: auto;
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24rem;
  gap: var(--space-l);
  align-items: start;
}

.side {
  position: sticky;
  top: calc(var(--topbar-h) + var(--tabs-h) + 1px + 4.5rem);
  max-height: calc(100dvh - var(--topbar-h) - var(--tabs-h) - 7rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.problems {
  margin: 0;
  padding-left: 1.2em;
}

.hint {
  margin: 0;
  font-size: var(--fs-s);
}

@container (max-width: 54rem) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
  }

  .side {
    position: static;
    max-height: none;
    overflow: visible;
  }
}

/* Phones: the bar is too tall to keep on screen, so it scrolls with the page; Edit and Preview are its first row. */
@media (max-width: 56rem) {
  .bar {
    position: static;
  }

  .mtabs {
    flex-basis: 100%;
    margin: 0 calc(var(--space-m) * -1);
    padding: 0 var(--space-m);
  }

  .btn-row {
    flex-basis: 100%;
    margin-left: 0;
  }

  .kind-ico {
    display: none;
  }
}
</style>
