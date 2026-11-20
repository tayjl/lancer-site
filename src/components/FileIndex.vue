<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setFolded } from '../fileSections'
import SheetTabs from './SheetTabs.vue'

// The pilot file's index: a sticky list beside the file on wide screens, a sticky sideways-scrolling row under the top
// bar on phones. The section in view is marked (aria-current), a click scrolls to one, and the url's #hash follows so
// /pilot#hangar links and reloads land there.
const props = defineProps<{ sections: { id: string; no: string; title: string }[] }>()
const route = useRoute()
const router = useRouter()
const current = ref(props.sections[0]?.id ?? '')

const label = (s: { no: string; title: string }) => `${s.no} ${s.title}`
const tabs = computed(() => props.sections.map(label))
// SheetTabs works in labels; the index works in ids.
const tab = computed({
  get: () => tabs.value[props.sections.findIndex((s) => s.id === current.value)] ?? '',
  set: (next: string) => go(props.sections[tabs.value.indexOf(next)]?.id),
})

async function go(id?: string) {
  const el = id && document.getElementById(id)
  if (!el || !id) return
  current.value = id
  setFolded(id, false)
  await nextTick()
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  router.replace({ query: route.query, hash: `#${id}` })
}

// On phones the row scrolls the current tab into view as you move down the file.
const phoneRow = useTemplateRef<HTMLElement>('phoneRow')
watch(current, () => nextTick(() => phoneRow.value?.querySelector('.tab[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })))

// The section in view is the last one reaching the upper part of the screen.
const seen = new Set<string>()
let watcher: IntersectionObserver | undefined
// At the foot of the page the last sections can't reach the band, so the last one is marked there.
function pick() {
  const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2
  const last = atEnd ? props.sections.at(-1) : [...props.sections].reverse().find((s) => seen.has(s.id))
  if (last) current.value = last.id
}
function observe() {
  watcher?.disconnect()
  seen.clear()
  props.sections.forEach((s) => {
    const el = document.getElementById(s.id)
    if (el) watcher?.observe(el)
  })
}
onMounted(() => {
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 56
  watcher = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.isIntersecting ? seen.add(entry.target.id) : seen.delete(entry.target.id)
      pick()
    },
    { rootMargin: `-${top + 60}px 0px -55% 0px` },
  )
  observe()
  addEventListener('scroll', pick, { passive: true })
  // A link to /pilot#hangar scrolls there once the sections are drawn (only for ids on this page).
  const wanted = props.sections.find((s) => `#${s.id}` === route.hash)
  if (wanted) {
    setFolded(wanted.id, false)
    nextTick(() => document.getElementById(wanted.id)?.scrollIntoView())
  }
})
// The gallery appears once the profile has loaded.
watch(() => props.sections.length, () => nextTick(observe))
onUnmounted(() => {
  watcher?.disconnect()
  removeEventListener('scroll', pick)
})
</script>

<template>
  <div class="file-index">
    <nav class="list" aria-label="File index">
      <span class="label">File index</span>
      <ol>
        <li v-for="s in sections" :key="s.id">
          <a :href="`#${s.id}`" :aria-current="s.id === current ? 'true' : undefined" @click.prevent="go(s.id)"><span class="num">{{ s.no }}</span>{{ s.title }}</a>
        </li>
      </ol>
    </nav>
    <div ref="phoneRow" class="row"><SheetTabs v-model="tab" :tabs="tabs" label="File index" /></div>
  </div>
</template>

<style scoped>
.file-index {
  align-self: stretch; /* the list sticks inside this column, so it is as tall as the file */
}

.list {
  position: sticky;
  top: calc(var(--topbar-h) + var(--space-l));
}

.list .label {
  display: block;
  margin-bottom: var(--space-s);
}

.list ol {
  display: grid;
  margin: 0;
  padding: 0;
  border-left: 1px solid var(--rule);
  list-style: none;
}

.list a {
  display: flex;
  align-items: center;
  gap: var(--space-s);
  min-height: var(--tap);
  margin-left: -1px;
  padding: 0 var(--space-m);
  border-left: 2px solid transparent;
  color: var(--text-dim);
  font: 700 13px / 1.2 var(--sans);
  letter-spacing: 0.06em;
  text-decoration: none;
  text-transform: uppercase;
}

.list a .num {
  font-weight: 400;
  font-size: var(--fs-xs);
  letter-spacing: 0;
}

.list a:hover {
  color: var(--text);
}

.list a[aria-current='true'] {
  border-left-color: var(--lilac);
  color: var(--lilac);
}

.row {
  display: none;
}

@media (max-width: 56rem) {
  .file-index {
    position: sticky;
    top: var(--topbar-h);
    z-index: 2;
    align-self: start;
    background: var(--void);
  }

  .list {
    display: none;
  }

  .row {
    display: block;
  }
}
</style>
