<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setFolded } from '../fileSections'
import Icon from './Icon.vue'

// The pilot file's index: a sticky list beside the file on wide screens. On phones one sticky line under the top bar
// names the section in view and opens the same list. The section in view is marked (aria-current), a click scrolls to
// one, and the url's #hash follows so /pilot#hangar links and reloads land there.
const props = defineProps<{ sections: { id: string; no: string; title: string }[] }>()
const route = useRoute()
const router = useRouter()
const current = ref(props.sections[0]?.id ?? '')
const now = computed(() => props.sections.find((s) => s.id === current.value) ?? props.sections[0])

async function go(id?: string) {
  open.value = false
  const el = id && document.getElementById(id)
  if (!el || !id) return
  current.value = id
  setFolded(id, false)
  await nextTick()
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  router.replace({ query: route.query, hash: `#${id}` })
}

// Phones: the list opens under the line, and closes on a choice, Escape, a tap outside or focus leaving it.
const nav = useTemplateRef<HTMLElement>('nav')
const toggle = useTemplateRef<HTMLButtonElement>('toggle')
const listId = useId()
const open = ref(false)
const outside = (target: EventTarget | null) => !nav.value?.contains(target as Node)
const tapped = (event: PointerEvent) => open.value && outside(event.target) && (open.value = false)
function escape() {
  if (!open.value) return
  open.value = false
  toggle.value?.focus()
}

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
  document.addEventListener('pointerdown', tapped)
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
  document.removeEventListener('pointerdown', tapped)
})
</script>

<template>
  <div class="file-index">
    <nav
      ref="nav"
      class="list"
      :class="{ open }"
      aria-label="File index"
      @keydown.esc="escape"
      @focusout="outside($event.relatedTarget) && (open = false)"
    >
      <span class="label">File index</span>
      <button v-if="now" ref="toggle" type="button" class="toggle" :aria-expanded="open" :aria-controls="listId" @click="open = !open">
        <span class="num">{{ now.no }}</span>{{ now.title }}<Icon class="chevron" :name="open ? 'chevron-up' : 'chevron-down'" />
      </button>
      <ol :id="listId">
        <li v-for="s in sections" :key="s.id">
          <a :href="`#${s.id}`" :aria-current="s.id === current ? 'true' : undefined" @click.prevent="go(s.id)"><span class="num">{{ s.no }}</span>{{ s.title }}</a>
        </li>
      </ol>
    </nav>
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

.list a,
.toggle {
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

.list a .num,
.toggle .num {
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

.toggle {
  display: none;
}

/* Phones and tablets: one line under the top bar naming the section in view, opening the list over the file. */
@media (max-width: 56rem) {
  .file-index {
    position: sticky;
    top: var(--topbar-h);
    z-index: 2;
    align-self: start;
    background: var(--void);
  }

  .list {
    position: relative;
    top: auto;
  }

  .list .label {
    display: none;
  }

  .toggle {
    display: flex;
    width: 100%;
    min-height: var(--tabs-h);
    margin: 0;
    padding: 0 var(--space-xs);
    border: 0;
    border-bottom: 1px solid var(--rule);
    border-radius: 0;
    background: none;
    color: var(--lilac);
  }

  .toggle:hover {
    background: none;
  }

  .chevron {
    margin-left: auto;
    font-size: 16px;
  }

  .list ol {
    display: none;
  }

  .list.open ol {
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    display: grid;
    max-height: calc(100dvh - var(--topbar-h) - var(--tabs-h) - var(--space-m));
    overflow-y: auto;
    border: 1px solid var(--rule);
    border-top: 0;
    border-radius: 0 0 var(--radius) var(--radius);
    background: var(--panel);
  }
}

/* Phones and tablets: a bar the screen's full width on its own background, its text on the page's gutter. It reads as a
   control, not a heading: the "File index" label, the section in view in plain text, and only the chevron in lilac. */
@media (max-width: 56rem) {
  .file-index {
    margin-inline: calc(-1 * var(--space-l));
    padding-inline: var(--space-l);
    border-bottom: 1px solid var(--rule);
  }

  .list {
    display: flex;
    align-items: center;
    gap: var(--space-m);
  }

  .list .label {
    display: block;
    flex: none;
    margin: 0;
  }

  .toggle {
    flex: 1;
    min-width: 0;
    padding: 0;
    border-bottom: 0;
    color: var(--text);
    font: 600 var(--fs-s) / 1.2 var(--sans);
    letter-spacing: 0;
    text-transform: none;
  }

  .toggle .num {
    color: var(--text-dim);
  }

  .toggle:hover,
  .toggle:focus-visible,
  .chevron {
    color: var(--lilac);
  }
}
</style>
