<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { isGm } from '../auth'
import { useCopyLink } from '../copyLink'
import { KIND_INFO, LORE_SECTIONS, entryMeta, isDraft, type LoreEntry } from '../lore'
import Icon from './Icon.vue'
import RichText from './RichText.vue'

// One lore entry, read: crumbs, kind, title, summary, who wrote it and when, the body, then the entries it's related
// to. In the list's pane on desktop (a second-level heading) and as its own page on phones (the page's heading).
const props = defineProps<{ entry: LoreEntry; entries: LoreEntry[]; section: (typeof LORE_SECTIONS)[keyof typeof LORE_SECTIONS]; page?: boolean }>()
const pithub = props.section === LORE_SECTIONS.pithub
const router = useRouter()

const kind = computed(() => KIND_INFO[props.entry.kind])
// Only entries that still exist and this user can see: ids of deleted entries (or drafts, for a player) are skipped.
const related = computed(() =>
  props.entry.related.flatMap((id) => props.entries.find((other) => other.id === id && other.id !== props.entry.id) ?? []),
)

// "Copy link" puts this entry's full address on the clipboard and says so for a moment.
const { copied, copyLink } = useCopyLink()
</script>

<template>
  <article class="entry" :class="{ pithub }">
    <p v-if="pithub" class="file-bar" aria-hidden="true">PITHUB://{{ entry.id.slice(0, 8) }}</p>
    <nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        <li><RouterLink :to="{ name: section.list }">{{ section.name }}</RouterLink></li>
        <li>{{ kind.plural }}</li>
        <li aria-current="page">{{ entry.title }}</li>
      </ol>
    </nav>

    <header class="head">
      <div class="top">
        <span class="chip kind"><Icon :name="kind.icon" />{{ kind.name }}</span>
        <span class="actions">
          <span aria-live="polite"><button type="button" class="quiet small" @click="copyLink({ name: section.entry, params: { id: entry.id } })"><Icon name="link" />{{ copied || 'Copy link' }}</button></span>
          <button v-if="isGm" type="button" class="small" @click="router.push({ name: section.edit, params: { id: entry.id } })">Edit entry</button>
        </span>
      </div>
      <component :is="page ? 'h1' : 'h2'" class="title">{{ entry.title }}</component>
      <p v-if="entry.summary" class="summary">{{ entry.summary }}</p>
      <p class="sep meta">
        <span v-if="isDraft(entry)" class="badge draft">Draft</span>
        <span v-if="entry.author">By {{ entry.author.display_name }}</span>
        <span>{{ entryMeta(entry) }}</span>
      </p>
    </header>

    <RichText :doc="entry.body" class="lore-body" />

    <section v-if="related.length" class="related" aria-labelledby="related-heading">
      <h3 id="related-heading" class="sheet-label">Related entries</h3>
      <ul>
        <li v-for="other in related" :key="other.id">
          <Icon :name="KIND_INFO[other.kind].icon" class="kind-icon" />
          <RouterLink :to="{ name: section.entry, params: { id: other.id } }">{{ other.title }}</RouterLink>
          <span class="dim meta-end">{{ entryMeta(other) }}</span>
        </li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
.entry {
  overflow-wrap: break-word;
}

.head {
  display: grid;
  justify-items: start;
  gap: var(--space-s);
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s);
  width: 100%;
}

.chip.kind {
  gap: 5px;
  padding-left: 6px;
}

.chip.kind .icon {
  width: 14px;
  height: 14px;
  color: var(--text-dim);
}

.actions {
  display: flex;
  gap: var(--space-xs);
  margin-left: auto;
}

.actions .icon {
  width: 14px;
  height: 14px;
}

.title {
  margin: var(--space-xs) 0 0;
  font-size: var(--fs-xl);
  font-weight: 700;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.summary {
  max-width: 60ch;
  margin: 0;
  color: var(--text-dim);
  font-size: var(--fs-l);
  line-height: 1.45;
}

.meta {
  margin: var(--space-xs) 0 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

/* The body: a comfortable measure and line height for reading at length. */
.entry .lore-body {
  max-width: 68ch;
  margin-top: var(--space-xl);
  line-height: 1.7;
}

.entry .lore-body :deep(p) {
  margin: 0 0 1em;
}

.entry .lore-body :deep(li p) {
  margin: 0;
}

.entry .lore-body :deep(h3) {
  margin: 1.9em 0 0.5em;
  font-size: 18px;
  line-height: 1.3;
}

.entry .lore-body :deep(ul) {
  margin: 0 0 1em;
}

.entry .lore-body :deep(li + li) {
  margin-top: 0.35em;
}

.entry .lore-body > :deep(:last-child) {
  margin-bottom: 0;
}

.related {
  max-width: 68ch;
  margin-top: var(--space-xl);
  padding-top: var(--space-l);
  border-top: 1px solid var(--rule);
}

.related .sheet-label {
  margin: 0 0 var(--space-s);
}

.related ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.related li {
  display: flex;
  align-items: center;
  gap: var(--space-m);
  min-height: var(--tap);
  padding: 6px 0;
}

.related li + li {
  border-top: 1px solid var(--rule);
}

.kind-icon {
  width: 18px;
  height: 18px;
  color: var(--text-dim);
}

.related a {
  font-weight: 700;
  text-decoration: none;
}

.related a:hover,
.related a:focus-visible {
  text-decoration: underline;
  text-decoration-thickness: 2px;
}

.meta-end {
  margin-left: auto;
  font-size: var(--fs-s);
  white-space: nowrap;
}

/* --- Pithub: the entry as a terminal window (the page's skin is in LoreView.vue). Only mono type and square corners
   change; the body's line below is the one to drop if the GMs want sans bodies for long stories. --- */
.pithub,
.pithub :is(button, .chip, .badge) {
  font-family: var(--mono);
}

.pithub.entry {
  padding: 0 var(--space-xl) var(--space-xl);
  border: 1px solid var(--rule);
  background-color: var(--panel);
  background-image: repeating-linear-gradient(to bottom, color-mix(in srgb, var(--text) 3%, transparent) 0 1px, transparent 1px 3px);
}

.file-bar {
  max-width: none; /* paragraphs have a reading measure; the bar spans the window */
  margin: 0 calc(-1 * var(--space-xl)) var(--space-l);
  padding: var(--space-xs) var(--space-m);
  border-bottom: 1px solid var(--rule);
  background: var(--raised);
  color: var(--text-dim);
  font: 700 var(--fs-xs) / 1.6 var(--mono);
  letter-spacing: 0.08em;
}

.pithub .title {
  font-family: var(--mono);
}

.pithub .title::before {
  content: '> ' / '';
  color: var(--text-dim);
}

.pithub .summary {
  font-size: var(--fs-m);
}

.pithub .meta {
  font-size: var(--fs-xs);
  text-transform: uppercase;
}

.pithub.entry .lore-body {
  max-width: 70ch;
  font-family: var(--mono);
  font-size: var(--fs-m);
}

.pithub.entry .lore-body :deep(h3)::before {
  content: '## ' / '';
  color: var(--text-dim);
}

.pithub.entry .lore-body :deep(li)::marker {
  content: '- ' / '';
  color: var(--text-dim);
}

.pithub .related .sheet-label {
  font-family: var(--mono);
}

@media (max-width: 40rem) {
  .pithub .title {
    font-size: 20px;
  }

  .pithub.entry {
    padding: 0 var(--space-l) var(--space-l);
  }

  .file-bar {
    margin-inline: calc(-1 * var(--space-l));
  }
}

@media (max-width: 40rem) {
  .title {
    font-size: 24px;
  }

  .summary {
    font-size: 18px;
  }

  .meta-end {
    display: none;
  }

  .related li {
    min-height: 44px;
  }
}
</style>
