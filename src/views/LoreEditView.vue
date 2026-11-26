<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm, profile } from '../auth'
import ConflictNotice from '../components/ConflictNotice.vue'
import Icon from '../components/Icon.vue'
import ImageUpload from '../components/ImageUpload.vue'
import ItemPicker from '../components/ItemPicker.vue'
import PageHeader from '../components/PageHeader.vue'
import SaveStatus from '../components/SaveStatus.vue'
import SheetField from '../components/SheetField.vue'
import { confirmAction } from '../confirm'
import type { Json } from '../lib/database.types'
import { deleteImage, imageUrl } from '../images'
import { CHANGED_ELSEWHERE, readError } from '../lib/supabaseClient'
import { KIND_INFO, LORE_KINDS, isDraft, isKind, loreSection, type LoreEntry, type LoreKind } from '../lore'

// The GM's editor for one lore entry. Every field saves itself (title, summary and related entries when you leave
// them or pick, the body a moment after you stop typing); saves run in order (src/lore.ts). Publishing makes it
// readable by everyone; until then only GMs see it.
const route = useRoute()
const router = useRouter()
const id = String(route.params.id)
// Lore or Pithub (the route's meta.section): which table, route names and wording.
const section = loreSection(route.meta.section)
const { entries } = section.store

// The fields are taken once the entry has been fetched afresh (not from the shared list's older copy), so the version
// saves are guarded with (src/lore.ts) is the one on screen.
const loadError = ref('')
const fresh = ref(false)
onMounted(async () => {
  loadError.value = readError(await section.store.load())
  fresh.value = !loadError.value
})
const entry = computed(() => entries.value.find((other) => other.id === id))

// The fields keep what you typed, taken from the entry once it has loaded (saving doesn't overwrite them).
const title = ref('')
const summary = ref('')
const kind = ref<LoreKind>('story')
const related = ref<string[]>([])
const image = ref<string | null>(null) // Pithub only
// The body lives in its editor; this is the latest of it, for Retry.
let body: Json | null = null
watch(
  () => fresh.value && entry.value?.id,
  () => {
    if (!fresh.value || !entry.value) return
    body = entry.value.body
    title.value = entry.value.title
    summary.value = entry.value.summary
    kind.value = entry.value.kind
    related.value = entry.value.related
    image.value = entry.value.image ?? null
  },
  { immediate: true },
)

// The save status for the whole page: how many saves are running, and whether the last one worked.
const saving = ref(0)
const saved = ref(false)
const error = ref('')
// Set when someone else saved the entry first: every save stops until the page is reloaded.
const conflict = ref(false)
// Every save sends the whole entry as it is on screen (plus "extra", the publish state), so a later save also carries
// an earlier one that failed, and "Saved" means everything is.
async function save(extra: { published_at?: string | null } = {}) {
  saving.value++
  saved.value = false
  const name = title.value.trim()
  // lore_entries has no image column, so only Pithub sends it.
  const fields = { title: name, kind: kind.value, summary: summary.value, body, related: related.value, ...(section.plain && { image: image.value }), ...extra }
  const failed = !name ? 'A title is needed.' : conflict.value ? CHANGED_ELSEWHERE : await section.store.save(id, fields)
  saving.value--
  error.value = readError(failed ?? '')
  saved.value = !failed
  if (failed === CHANGED_ELSEWHERE) conflict.value = true
  return failed
}

function saveTitle() {
  title.value = title.value.trim()
  if (title.value !== entry.value?.title) save()
}
const saveSummary = () => summary.value !== entry.value?.summary && save()
const saveKind = (next: LoreKind) => ((kind.value = next), save())
// The body is never empty in the database: an empty editor saves an empty document.
const saveBody = (doc: Json | null) => ((body = doc ?? { type: 'doc', content: [] }), save())

// Pithub's picture: saved like any field. The replaced file is deleted once the save works (best effort, see deleteImage).
async function saveImage(path: string | null) {
  const old = image.value
  image.value = path
  const failed = await save()
  if (!failed && old && old !== path) deleteImage(old)
  return failed
}

const draft = computed(() => (entry.value ? isDraft(entry.value) : false))
const publish = () => save({ published_at: new Date().toISOString() })
async function unpublish() {
  if (await confirmAction(`Unpublish ${entry.value?.title}? Only GMs can read it.`, { confirmLabel: 'Unpublish entry' })) save({ published_at: null })
}

// What the pickers offer: the other entries ("kind · Draft" under the title).
const option = (other: LoreEntry) => ({
  id: other.id,
  name: other.title,
  meta: `${KIND_INFO[other.kind].name}${isDraft(other) ? ' · Draft' : ''}`,
  text: other.summary,
})
const others = computed(() => entries.value.filter((other) => other.id !== id))
const linkable = computed(() => others.value.map(option))
const relatable = computed(() => others.value.filter((other) => !related.value.includes(other.id)).map(option))
const relatedEntries = computed(() => related.value.map((relatedId) => ({ id: relatedId, entry: entries.value.find((other) => other.id === relatedId) })))

const relatedPicker = useTemplateRef('relatedPicker')
function setRelated(next: string[]) {
  related.value = next
  save()
}
function addRelated(relatedId: string) {
  setRelated([...related.value, relatedId])
  relatedPicker.value?.close()
}

const deleteError = ref('') // shown in the danger zone, beside its button
async function remove() {
  if (!(await confirmAction(`Delete ${entry.value?.title}? Links to it stop working. This can't be undone.`, { confirmLabel: 'Delete entry', danger: true }))) return
  const picture = image.value
  const failed = await section.store.remove(id)
  deleteError.value = readError(failed ?? '')
  if (failed) return
  if (picture) deleteImage(picture) // best effort, so the picture doesn't outlive its entry
  router.push({ name: section.list })
}
</script>

<template>
  <main class="page">
    <p v-if="!profile" class="dim">Loading…</p>
    <p v-else-if="!isGm" class="notice warn" role="alert">Only GMs can see this page.</p>
    <p v-else-if="loadError" class="notice warn" role="alert">{{ section.name }} didn't load: {{ loadError }}</p>
    <p v-else-if="!fresh" class="dim">Loading…</p>
    <p v-else-if="!entry" class="empty" role="status">
      <span>This entry isn't available.</span>
      <RouterLink :to="{ name: section.list }">Back to {{ section.name }}</RouterLink>
    </p>

    <template v-else>
      <PageHeader
        :title="entry.title"
        summary="Publish when it's ready."
        :crumbs="[{ label: section.name, to: { name: section.list } }, { label: entry.title, to: { name: section.entry, params: { id } } }, { label: 'Edit' }]"
      />

      <!-- Where it stands: draft or published, the save status, and what to do next. -->
      <div class="next">
        <template v-if="draft">
          <span class="badge draft">Draft</span>
          <p class="next-text">Only GMs can see this until it's published.</p>
        </template>
        <template v-else>
          <span class="badge approved">Published</span>
          <p class="next-text">Everyone can read it.</p>
        </template>
        <SaveStatus :saving="saving > 0" :saved="saved" :error="error" :can-retry="!conflict" @retry="save()" />
        <div class="next-actions">
          <button type="button" class="small" @click="router.push({ name: section.entry, params: { id } })">View entry</button>
          <button v-if="draft" type="button" class="primary small" @click="publish">Publish entry</button>
          <button v-else type="button" class="small" @click="unpublish">Unpublish entry</button>
        </div>
      </div>

      <ConflictNotice v-if="conflict" />

      <div class="grid">
        <div class="stack">
          <section class="panel fields">
            <label class="field">
              <span>Title</span>
              <input v-model="title" type="text" maxlength="120" @change="saveTitle" />
            </label>
            <fieldset v-if="!section.plain" class="kind">
              <legend>Kind</legend>
              <div class="kind-options">
                <label v-for="option in LORE_KINDS" :key="option" class="kind-opt">
                  <input type="radio" name="kind" :value="option" :checked="kind === option" @change="isKind(option) && saveKind(option)" />
                  <Icon :name="KIND_INFO[option].icon" />{{ KIND_INFO[option].name }}
                </label>
              </div>
            </fieldset>
            <label v-if="!section.plain" class="field">
              <span>Summary</span>
              <input v-model="summary" type="text" maxlength="300" @change="saveSummary" />
            </label>
          </section>

          <section class="panel">
            <SheetField title="Body" :doc="entry.body" editable quiet :links="section.links ? linkable : undefined" :save="saveBody" />
          </section>
        </div>

        <div class="stack">
          <section v-if="section.plain" class="panel picture">
            <h2 class="sheet-label">Image</h2>
            <img v-if="imageUrl(image)" :src="imageUrl(image)!" alt="" class="preview" />
            <ImageUpload :path="image" :save="saveImage" />
          </section>
          <section v-if="!section.plain" class="panel related">
            <h2 class="sheet-label">Related entries</h2>
            <ul v-if="relatedEntries.length" class="chips">
              <li v-for="link in relatedEntries" :key="link.id" class="chip-x">
                <Icon v-if="link.entry" :name="KIND_INFO[link.entry.kind].icon" />
                {{ link.entry?.title ?? 'Deleted entry' }}
                <button type="button" :aria-label="`Remove ${link.entry?.title ?? 'deleted entry'}`" @click="setRelated(related.filter((other) => other !== link.id))">
                  <Icon name="close" />
                </button>
              </li>
            </ul>
            <p v-else class="empty">No related entries yet.</p>
            <div><button type="button" class="small" @click="relatedPicker?.open()"><Icon name="plus" />Link entry</button></div>
          </section>
        </div>
      </div>

      <section class="panel danger-zone">
        <h2 class="sheet-label">Danger zone</h2>
        <div class="danger-body">
          <p class="dim">Deleting this entry breaks links to it. This can't be undone.</p>
          <button type="button" class="danger" @click="remove">Delete entry</button>
        </div>
        <p v-if="deleteError" class="notice warn" role="alert">Not deleted: {{ deleteError }}</p>
      </section>

      <ItemPicker ref="relatedPicker" title="Link entry" :options="relatable" empty="No other entries to link." @choose="addRelated" />
    </template>
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
}

.page > :deep(.page-header) {
  margin-bottom: 0;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22rem;
  align-items: start;
  gap: var(--space-l);
}

/* minmax(0, ...) so a wide toolbar can't push the column past the screen. */
.stack,
.fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-l);
}

.fields input {
  width: 100%;
}

.hint {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

/* Kind: real radio buttons drawn as the filter's toggle boxes. */
.kind {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.kind legend {
  padding: 0 0 var(--space-xs);
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.kind-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
}

.kind-opt {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-s);
  min-height: var(--tap);
  padding: 0 14px;
  border: 1px solid var(--edge);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.kind-opt input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.kind-opt .icon {
  width: 18px;
  height: 18px;
  color: var(--text-dim);
}

.kind-opt:hover {
  border-color: var(--lilac);
}

.kind-opt:has(:checked) {
  border-color: var(--lilac);
  background: color-mix(in srgb, var(--lilac) 14%, transparent);
  color: var(--lilac);
}

.kind-opt:has(:checked) .icon {
  color: var(--lilac);
}

.kind-opt:has(:focus-visible) {
  outline: 2px solid var(--lilac);
  outline-offset: 2px;
}

/* The body's field sits in its own panel, so no box around the panel's heading. */
.panel :deep(.sheet-label) {
  margin-top: 0;
}

/* Pithub's picture: a small preview above the buttons. */
.picture .sheet-label {
  margin: 0 0 var(--space-s);
}

.preview {
  display: block;
  max-width: 100%;
  max-height: 12rem;
  border: 1px solid var(--rule);
  object-fit: contain;
}

/* Related entries: removable chips. */
.related {
  display: grid;
  gap: var(--space-m);
}

.related .sheet-label {
  margin: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip-x {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 4px 0 10px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: var(--raised);
  font: 700 var(--fs-xs) / 1 var(--sans);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.chip-x > .icon {
  width: 14px;
  height: 14px;
  color: var(--text-dim);
}

.chip-x button {
  width: 28px;
  min-height: 28px;
  padding: 0;
  border: 0;
  border-radius: 2px;
  color: var(--text-dim);
}

.chip-x button:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
}

.chip-x button .icon {
  width: 14px;
  height: 14px;
}

/* Phones: an even two-column grid, each button filling its cell; an odd last one sits centred across both (as
   HomeView's options). */
@media (max-width: 40rem) {
  .kind-options {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
  }

  .kind-opt {
    grid-column: span 2;
    justify-content: center;
    padding: 0 var(--space-xs);
  }

  .kind-opt:last-child:nth-child(odd) {
    grid-column: 2 / span 2;
  }
}

@media (max-width: 64rem) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Where it stands: the bar under the header sticks under the top bar on wider screens, so Publish is always at hand
   (on phones it wraps to three rows, too tall to keep on screen). */
@media (min-width: 40.0625rem) {
  .next {
    position: sticky;
    top: var(--topbar-h);
    z-index: 9;
  }
}

/* Phones: the bar wraps (the sentence first, then the buttons across the row), and the chips are 44px tall. */
@media (max-width: 40rem) {
  .next {
    padding: var(--space-s) var(--space-m);
  }

  .next-text,
  .next-actions {
    flex-basis: 100%;
  }

  .next-actions button {
    flex: 1;
  }

  .chip-x {
    min-height: 44px;
  }

  .chip-x button {
    width: 44px;
    min-height: 42px;
  }
}
</style>
