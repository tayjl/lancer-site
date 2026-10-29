<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { isGm, isOwner } from '../auth'
import BootSequence from '../components/BootSequence.vue'

// Home (/, and the logo in the top bar): the login screen's boot scrawl again, inside the logged-in layout,
// with buttons to every tab where the login screen has [ uplink with discord ].
const router = useRouter()
const booted = ref(false)
const nav = useTemplateRef('nav')

const pages = computed(() => [
  [
    { name: 'pilot', label: 'my pilot' },
    { name: 'registry', label: 'registry' },
    { name: 'pending', label: 'pending' },
    { name: 'memorial', label: 'memorial' },
  ],
  ...(isGm.value
    ? [
        [
          { name: 'gm-pilots', label: 'gm: pilots' },
          { name: 'gm-changes', label: 'gm: changes' },
          ...(isOwner.value ? [{ name: 'gm-content', label: 'gm: content' }] : []),
        ],
      ]
    : []),
])

async function onBooted() {
  booted.value = true
  await nextTick()
  // Ready for Enter straight away, like the login screen.
  nav.value?.querySelector('button')?.focus()
}
</script>

<template>
  <main class="home">
    <h1 class="sr-only">HOR_OS</h1>
    <BootSequence @done="onBooted" />

    <!-- Hidden (but still taking up its space) until the log finishes, so nothing jumps when it appears. -->
    <nav ref="nav" class="links" :class="{ waiting: !booted }" aria-label="Pages">
      <div v-for="(group, i) in pages" :key="i" class="row">
        <button v-for="page in group" :key="page.name" type="button" @click="router.push({ name: page.name })">
          {{ page.label }}
        </button>
      </div>
    </nav>
  </main>
</template>

<style scoped>
/* As the login screen (LoginView.vue), but fitting under the top bar: the art pinned at the top, the log in
   the middle, the buttons at the bottom. --chrome is the height the bar takes; the art shrinks with the
   height left, and the column narrows with it (not below 34rem). */
.home {
  --chrome: 4rem;
  container-type: inline-size;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(100% - 2rem, 47rem, max(34rem, (100dvh - var(--chrome) - 20rem) * 1.514));
  height: calc(100vh - var(--chrome));
  height: calc(100dvh - var(--chrome));
  margin: 0 auto;
}

.links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 1rem 0 1.25rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 0.5rem;
}

.links button {
  font-size: 1rem;
}

.waiting {
  visibility: hidden;
}

/* Too short to pin anything (e.g. a phone held sideways): the page just scrolls normally. */
@media (max-height: 30rem) {
  .home {
    display: block;
    height: auto;
  }
}
</style>
