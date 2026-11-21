<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { isGm, isOwner } from '../auth'
import BootSequence from '../components/BootSequence.vue'

// Home (/, and the logo in the top bar): the login screen's boot scrawl again, inside the logged-in layout,
// with buttons to every tab where the login screen has [ uplink with discord ].
const router = useRouter()
const booted = ref(false)

const pages = computed(() => [
  [
    { name: 'pilot', label: 'my pilot' },
    { name: 'registry', label: 'registry' },
    { name: 'archives', label: 'archives' },
    { name: 'lore', label: 'lore' },
    { name: 'combat', label: 'combat' },
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

</script>

<template>
  <main class="home">
    <h1 class="sr-only">HOR_OS</h1>
    <BootSequence :link="{ name: 'pithub' }" @done="booted = true" />

    <nav class="links" aria-label="Pages">
      <div v-for="(group, i) in pages" :key="i" class="row" :class="{ waiting: !booted }">
        <button v-for="page in group" :key="page.name" type="button" class="option" @click="router.push({ name: page.name })">
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
  --chrome: var(--topbar-h);
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
  text-align: center;
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

/* Narrow column (the same 28rem break as the art in BootSequence): each group is an even two-column grid, the
   button filling its cell so the whole cell is the tap target. It's four half-width tracks so an odd last
   option can sit across the middle two, centred, at the same width as the others. 15px is the largest size
   at which "[ gm: changes ]" (15 characters) fits a cell at 320px wide; every option shares it. */
@container (width < 28rem) {
  /* Less padding, to give back some of the log the taller buttons take. */
  .links {
    padding-block: 0.5rem 0.75rem;
  }

  .row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
    width: 100%;
  }

  .links button {
    grid-column: span 2;
    min-height: var(--tap);
    padding-inline: 0.25rem;
    font-size: 0.9375rem;
  }

  .links button:last-child:nth-child(odd) {
    grid-column: 2 / span 2;
  }
}

/* Too short to pin anything (e.g. a phone held sideways): the page just scrolls normally. */
@media (max-height: 30rem) {
  .home {
    display: block;
    height: auto;
  }
}
</style>
