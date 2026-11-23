<script lang="ts">
// Kept outside setup so they last the whole session: the list types in once, and going back keeps its scroll.
let listPlayed = false
let listScroll = 0
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm } from '../auth'
import RichText from '../components/RichText.vue'
import { useCopyLink } from '../copyLink'
import { LORE_SECTIONS, entryDate, fileName, fileSize, isDraft, loreMatches } from '../lore'
import { formatDate } from '../time'

// Pithub: the hidden leaked-files terminal. The list (/pithub) and one file (/pithub/:id) are one page, like the
// login screen's one column. Same table and store as lore (src/lore.ts), none of its kinds, summaries or related entries.
const section = LORE_SECTIONS.pithub
const { entries, loaded } = section.store
const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id ?? ''))
const { copied, copyLink } = useCopyLink()

const error = ref('')
const newError = ref('')
async function load() {
  error.value = await section.store.load()
}
load()

const query = ref('')
const searchBox = useTemplateRef<HTMLInputElement>('searchBox')
const fileTitle = useTemplateRef<HTMLElement>('fileTitle')
const shownList = computed(() => entries.value.filter((entry) => loreMatches(entry, query.value)))
const hasDrafts = computed(() => entries.value.some(isDraft))
const entry = computed(() => entries.value.find((other) => other.id === id.value))

function clear() {
  query.value = ''
  searchBox.value?.focus()
}
async function newFile() {
  const draft = await section.store.createDraft()
  if (draft.error) newError.value = draft.error
  else router.push({ name: section.edit, params: { id: draft.id } })
}
const back = () => router.push({ name: section.list })

// --- Typing animation: "typed" counts the lines printed so far. A key or click skips to the end. ---
const DONE = 1e6
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const typed = ref(listPlayed || calm ? DONE : 0)
const rule = '-'.repeat(80)
// Decoration lines are longer than any column and clipped by their .fill box, so they fit every width.
const bar = '═'.repeat(120)
const dots = '.'.repeat(120)
const shade = '░▒▓'.repeat(40)
const fileLines = computed(() => (entry.value && isDraft(entry.value) ? 4 : 3)) // cat, size, draft (if any), rule
const headerDone = computed(() => typed.value > fileLines.value)

let timer: ReturnType<typeof setTimeout> | undefined
let onEnd: (() => void) | undefined
const skip = () => finish()
function finish() {
  clearTimeout(timer)
  window.removeEventListener('keydown', skip)
  window.removeEventListener('pointerdown', skip)
  typed.value = DONE
  const done = onEnd
  onEnd = undefined
  done?.()
}
function play(count: number, delay: (typedNow: number) => number, end: () => void) {
  finish()
  onEnd = end
  if (calm) return finish()
  typed.value = 0
  window.addEventListener('keydown', skip)
  window.addEventListener('pointerdown', skip)
  const step = () => {
    typed.value++
    if (typed.value >= count) finish()
    else timer = setTimeout(step, delay(typed.value))
  }
  timer = setTimeout(step, delay(0))
}
onBeforeUnmount(() => {
  clearTimeout(timer)
  window.removeEventListener('keydown', skip)
  window.removeEventListener('pointerdown', skip)
})

// Start when what the screen needs has arrived. Opening a file always types its header; the list only the first time.
watch(
  () => [id.value, loaded.value && (!id.value || Boolean(entry.value))] as const,
  ([now, ready], old) => {
    if (!ready) return
    if (old?.[0] === now && old[1]) return
    if (now) {
      play(fileLines.value + 1, () => 110, () => nextTick(() => fileTitle.value?.focus({ preventScroll: true })))
    } else if (!listPlayed && !old?.[0]) {
      const rows = shownList.value.length
      play(rows + 2, (n) => (n < 2 ? 60 : Math.min(45, 900 / rows)), () => (listPlayed = true))
    } else {
      // Coming back from a file (or the list already played): no typing, so the row is visible to focus.
      finish()
      listPlayed = true
    }
  },
  { immediate: true },
)
// Searching while it types in skips to the end.
watch(query, () => typed.value < DONE && finish())

// Opening a file starts at the top. Back puts the list where it was and focuses the row you came from.
watch(id, async (now, was) => {
  if (now && !was) {
    listScroll = window.scrollY
    window.scrollTo(0, 0)
  } else if (!now && was) {
    await nextTick()
    window.scrollTo(0, listScroll)
    ;(document.getElementById(`pit-${was}`) ?? searchBox.value)?.focus({ preventScroll: true })
  }
})
</script>

<template>
  <main class="pit">
    <header class="pit-head">
      <p class="ln deco" aria-hidden="true"><span>╔═[ <span class="hot">HORUS</span> // UNSUPERVISED ]</span><span class="fill">{{ bar }}</span><span>╗</span></p>
      <h1><span class="sr-only">Pithub</span><span class="deco" aria-hidden="true">░▒▓█ </span><span class="pit-title glitch" aria-hidden="true">PITHUB://</span><span class="deco" aria-hidden="true"> █▓▒░</span></h1>
      <p class="node clip" aria-hidden="true">node 7f//pit <span class="flag">unsecured</span> mirror kostutet</p>
      <div v-if="!id" class="status deco" aria-hidden="true">
        <p class="ln"><span>SIGNAL</span><span class="fill">{{ dots }}</span><span class="hot">UNSECURED</span></p>
        <p class="ln"><span>ARCHIVE SCRAPE</span><span class="fill">{{ dots }}</span><span>{{ loaded ? entries.length : '??' }} FILES</span></p>
        <p class="ln"><span>SOURCE</span><span class="fill">{{ dots }}</span><span>UNKNOWN</span></p>
        <p class="ln"><span>OPERATOR</span><span class="fill">{{ dots }}</span><span>████████</span></p>
        <p class="ln"><span>INTEGRITY</span><span class="fill">{{ dots }}</span><span>▓▓▓▒▒░░ 4▒%</span></p>
      </div>
      <p class="ln deco" aria-hidden="true"><span>╚═[ R▒COVERED ]</span><span class="fill">{{ bar }}</span><span>╝</span></p>
    </header>

    <div v-if="error && !loaded" class="pit-msg">
      <p role="alert" class="err">Pithub didn't load: {{ error }}</p>
      <button type="button" class="option" @click="load">Retry</button>
    </div>

    <template v-else-if="id">
      <p v-if="!loaded" class="out" role="status">Loading…</p>
      <div v-else-if="!entry" class="pit-msg" role="status">
        <p>This entry isn't available.</p>
        <button type="button" class="option" @click="back">Back</button>
      </div>
      <template v-else>
        <p class="cmd" aria-hidden="true" :class="{ waiting: typed < 1 }"><span class="who">anon@pit:~</span><span class="dim">$</span> cat {{ fileName(entry.title) }}</p>
        <p class="out" aria-hidden="true" :class="{ waiting: typed < 2 }">lancer omni file · size {{ fileSize(entry.body) }} · modified {{ formatDate(entryDate(entry)) }}</p>
        <p v-if="isDraft(entry)" class="out" :class="{ waiting: typed < 3 }"><span class="draft">Draft</span> Only GMs can see drafts.</p>
        <p class="rule" aria-hidden="true" :class="{ waiting: typed < fileLines }">{{ rule }}</p>

        <div class="opts" :class="{ waiting: !headerDone }">
          <button type="button" class="option" @click="back">Back</button>
          <span aria-live="polite"><button type="button" class="option" @click="copyLink({ name: section.entry, params: { id } })">{{ copied || 'Copy link' }}</button></span>
          <button v-if="isGm" type="button" class="option" @click="router.push({ name: section.edit, params: { id } })">Edit file</button>
        </div>

        <article :class="{ waiting: !headerDone }">
          <h2 ref="fileTitle" tabindex="-1" class="file-title">{{ entry.title }}</h2>
          <RichText :doc="entry.body" class="file-body" />
        </article>

        <div class="opts end" :class="{ waiting: !headerDone }"><button type="button" class="option" @click="back">Back</button></div>
      </template>
    </template>

    <template v-else>
      <p class="divider" aria-hidden="true">{{ shade }}</p>
      <section v-if="!(loaded && !error && !entries.length)" class="query" aria-label="Search the archive">
        <p class="ln deco" aria-hidden="true"><span>╔═[ <span class="hot">SEARCH THE ARCHIVE</span> ]</span><span class="fill">{{ bar }}</span><span>╗</span></p>
        <div class="search">
          <label class="grep">
            <span class="sr-only">Search</span>
            <span aria-hidden="true"><span class="who">anon@pit:~</span><span class="dim">$</span> grep</span>
            <input ref="searchBox" v-model="query" type="search" placeholder="Title or text" @keydown.esc="query = ''" />
          </label>
          <button v-if="query" type="button" class="option" @click="clear">Clear</button>
          <button v-if="isGm" type="button" class="option" @click="newFile">New file</button>
        </div>
        <p class="ln deco" aria-hidden="true"><span>╚</span><span class="fill">{{ bar }}</span><span>╝</span></p>
      </section>
      <p v-if="!(loaded && !error && !entries.length)" class="divider" aria-hidden="true">{{ shade }}</p>
      <p v-if="newError" role="alert" class="err">Not saved: {{ newError }}</p>

      <p class="cmd" aria-hidden="true" :class="{ waiting: typed < 1 }"><span class="who">anon@pit:~</span><span class="dim">$</span> ls -la<template v-if="query.trim()"> | grep "{{ query.trim() }}"</template></p>
      <p class="out" aria-hidden="true" :class="{ waiting: typed < 2 }">total {{ shownList.length }}</p>

      <p v-if="!loaded" class="out" role="status">Loading…</p>
      <div v-else-if="!entries.length" class="pit-msg" role="status">
        <p>{{ section.empty }}</p>
        <button v-if="isGm" type="button" class="option" @click="newFile">New file</button>
      </div>
      <div v-else-if="!shownList.length" class="pit-msg" role="status">
        <p>Nothing matches that search.</p>
        <button type="button" class="option" @click="clear">Clear</button>
      </div>
      <template v-else>
        <ul class="files" aria-label="Files">
          <li v-for="(file, i) in shownList" :key="file.id" :class="{ waiting: typed < i + 3 }">
            <RouterLink
              :id="`pit-${file.id}`"
              :to="{ name: section.entry, params: { id: file.id } }"
              class="file"
            >
              <span class="sr-only">{{ file.title }}, {{ formatDate(entryDate(file)) }}{{ isDraft(file) ? ', Draft' : '' }}. File name: </span>
              <span class="perms" aria-hidden="true">-r--r--r--</span>
              <span class="size" aria-hidden="true">{{ fileSize(file.body) }}</span>
              <span class="date" aria-hidden="true">{{ formatDate(entryDate(file)) }}</span>
              <span class="name-cell"><span class="name">{{ fileName(file.title) }}</span><span v-if="isDraft(file)" class="draft">Draft</span></span>
            </RouterLink>
          </li>
        </ul>
        <p v-if="isGm && hasDrafts" class="out">Only GMs can see drafts.</p>
      </template>
    </template>

    <footer class="foot" aria-hidden="true">
      <p class="ln deco"><span>╚═[ END OF DUMP ]</span><span class="fill">{{ bar }}</span><span>╝</span></p>
      <p class="deco clip">no one reads this node ▒░ keep it that way</p>
    </footer>
  </main>
</template>

<style scoped>
.pit {
  container-type: inline-size;
  width: min(100% - 2rem, 47rem); /* the login's width rule, without its height cap: this page scrolls */
  margin: 0 auto;
  padding: var(--space-xl) 0 3rem;
  font: 400 0.875rem / 1.25rem var(--mono); /* the boot log's size and line height */
  overflow-wrap: anywhere;
}

@media (min-width: 48rem) {
  .pit {
    font-size: 0.9375rem;
    line-height: 1.5rem;
  }
}

.pit :where(p) {
  max-width: none;
  margin: 0;
}

/* Lines still to be printed keep their space, so nothing jumps, and can't be focused or read. */
.waiting {
  visibility: hidden;
}

.dim {
  color: var(--text-dim);
}

/* --- Header: the one glitching element --- */
.pit-head h1 {
  margin: 0;
}

.pit-title {
  font: 700 var(--fs-xl) / 1.2 var(--mono);
  color: var(--text);
}

.node {
  margin-top: var(--space-xs);
  color: var(--text-dim);
  font-size: var(--fs-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.flag {
  padding: 0 4px;
  border: 1px solid var(--rose);
  color: var(--rose);
}

.rule {
  margin: var(--space-s) 0 var(--space-m);
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
}

/* --- Prompt lines (decoration) --- */
.who {
  color: var(--sky);
}

.who + .dim {
  margin-right: 1ch;
}

.cmd {
  color: var(--text);
}

.out {
  color: var(--text-dim);
}

.err {
  color: var(--rose);
}

.draft {
  color: var(--wait);
  text-transform: uppercase;
}

.draft::before {
  content: '[' / '';
}

.draft::after {
  content: ']' / '';
}

.name-cell .draft {
  margin-left: 1ch;
}

/* --- Decoration (all aria-hidden) --- */
.deco {
  color: var(--text-dim);
}

.hot {
  color: var(--rose);
}

.clip {
  white-space: nowrap;
  overflow: hidden;
}

.ln {
  display: flex;
  white-space: nowrap;
}

.ln .fill {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.status {
  margin: var(--space-s) 0;
  font-size: var(--fs-xs);
  letter-spacing: 0.06em;
}

.pit-head h1 .deco {
  font-weight: 400;
}

.divider {
  margin: var(--space-l) 0;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
}

.foot {
  margin-top: var(--space-xl);
  font-size: var(--fs-xs);
}

/* --- Search: its own framed input, the side bars are borders so they match the ═ lines --- */
.search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
  padding: var(--space-s) var(--space-m);
  border-inline: 3px double var(--text-dim);
}

.grep {
  display: flex;
  flex: 1 1 16rem;
  align-items: center;
  gap: 1ch;
}

.grep input {
  flex: 1;
  min-width: 0;
  min-height: var(--tap);
  padding: 0 2px;
  border: 0;
  border-bottom: 1px solid var(--edge);
  border-radius: 0;
  background: none;
  color: var(--text);
  font: inherit;
  caret-color: var(--lilac);
  caret-shape: block; /* the block cursor; browsers without it show a normal caret */
}

.grep input:focus {
  border-bottom-color: var(--lilac);
  box-shadow: 0 1px 0 var(--lilac);
  outline: none;
}

.grep input::placeholder {
  color: var(--text-dim);
}

.grep input::-webkit-search-cancel-button {
  display: none;
}

/* --- File list --- */
.files {
  margin: var(--space-xs) 0 0;
  padding: 0;
  list-style: none;
}

.file {
  position: relative;
  display: grid;
  grid-template-columns: 10ch 5ch 11ch minmax(0, 1fr);
  column-gap: 2ch;
  align-items: baseline;
  min-height: var(--tap);
  padding: 4px 0 4px 2ch;
  color: var(--text-dim);
  text-decoration: none;
}

.size {
  text-align: right;
}

.date {
  text-transform: uppercase;
}

.name {
  color: var(--lilac); /* the one lilac thing in the row: it's the link */
}

.file::before {
  content: '>' / '';
  position: absolute;
  left: 0;
  color: var(--rose);
  visibility: hidden;
}

.file:hover::before,
.file:focus-visible::before {
  visibility: visible;
}

.file:hover .name,
.file:focus-visible .name {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

/* Phones: two lines per row, the name over size and date. */
@container (width < 40rem) {
  .file {
    grid-template-columns: 5ch minmax(0, 1fr);
    grid-template-areas:
      'name name'
      'size date';
    row-gap: 0;
    padding-block: 6px;
  }

  .perms {
    display: none;
  }

  .name-cell {
    grid-area: name;
  }

  .size {
    grid-area: size;
    text-align: left;
  }

  .date {
    grid-area: date;
  }
}

/* --- File --- */
.file-title {
  margin: var(--space-l) 0 var(--space-m);
  font: 700 var(--fs-l) / 1.3 var(--mono);
  color: var(--text);
}

.file-title:focus {
  outline: none; /* it only gets focus from code */
}

.file-title::before {
  content: '# ' / '';
  color: var(--text-dim);
}

.file-body {
  max-width: 70ch;
  color: var(--text);
  font-family: var(--mono);
  font-size: var(--fs-m);
  line-height: 1.6;
}

.file-body :deep(h3)::before {
  content: '## ' / '';
  color: var(--text-dim);
}

.file-body :deep(li)::marker {
  content: '- ' / '';
  color: var(--text-dim);
}

.opts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-m);
  margin-left: -0.5rem; /* the first bracket lines up with the text, cancelling the option's padding */
}

.opts.end {
  margin-top: var(--space-xl);
}

.pit button.option {
  text-transform: lowercase; /* strings are sentence case, they read [ back ] on screen */
}

.pit button.option:focus-visible,
.file:focus-visible {
  outline: 2px solid var(--lilac); /* the global ring, restored: options switch it off */
  outline-offset: 2px;
}

/* --- Empty, missing and error blocks --- */
.pit-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-s);
  padding: var(--space-xl) 0;
  color: var(--text);
  text-align: center;
}

.pit-msg .err {
  color: var(--rose);
}

@container (width < 28rem) {
  .pit-title {
    font-size: var(--fs-l);
  }

  .who {
    display: none;
  }

  .who + .dim {
    margin-right: 0.5ch;
  }

  .pit button.option {
    min-height: var(--tap);
  }
}
</style>
