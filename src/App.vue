<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logo from './assets/logo.txt?raw'
import { isGm, isOwner, profile } from './auth'
import ConfirmDialog from './components/ConfirmDialog.vue'
import InfoDialog from './components/InfoDialog.vue'
import { supabase } from './lib/supabaseClient'
import { sectionOverride } from './router'

const route = useRoute()
const router = useRouter()
// The logo art without Windows line endings or trailing blank lines.
const logoArt = logo.replace(/\r/g, '').trimEnd()

// The tabs across the top bar. Everyone gets the pilot tabs; GMs and owners also get the GM tabs, and owners
// the content tab. Each is "current" on its own page, or on a page whose route meta.section names it (like a
// pilot record under the registry).
const tabs = [
  { name: 'pilot', label: 'my pilot' },
  { name: 'registry', label: 'registry' },
  { name: 'pending', label: 'pending' },
  { name: 'memorial', label: 'memorial' },
  { name: 'archives', label: 'archives' },
]
const gmTabs = computed(() => [
  { name: 'gm-pilots', label: 'pilots' },
  { name: 'gm-changes', label: 'changes' },
  ...(isOwner.value ? [{ name: 'gm-content', label: 'content' }] : []),
])
const isCurrent = (name: string) => route.name === name || (sectionOverride.value ?? route.meta.section) === name

// On phones the bar collapses to the logo and a [ menu ] toggle (see the CSS at the bottom).
// The menu closes when you pick a page, or once you've scrolled past it.
const menuOpen = ref(false)
const bar = useTemplateRef('bar')
watch(() => route.fullPath, () => (menuOpen.value = false))

function closeMenuOnScroll() {
  if (menuOpen.value && window.scrollY > (bar.value?.offsetHeight ?? 0)) menuOpen.value = false
}

onMounted(() => window.addEventListener('scroll', closeMenuOnScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', closeMenuOnScroll))

async function disconnect() {
  await supabase.auth.signOut()
  await router.push({ name: 'login' })
}
</script>

<template>
  <RouterView v-if="route.meta.public" />

  <!-- The logged-in layout: a bar across the top, the page under it. -->
  <div v-else class="shell" :class="{ 'menu-open': menuOpen }">
    <header ref="bar" class="topbar">
      <div class="bar-inner">
        <div class="brand-row">
          <!-- The HORUS logo (src/assets/logo.txt), small, linking home. Screen readers get the link's label. -->
          <RouterLink :to="{ name: 'home' }" class="brand" aria-label="HOR_OS: home">
            <pre class="logo" aria-hidden="true">{{ logoArt }}</pre>
          </RouterLink>
          <!-- Phones only. -->
          <button type="button" class="option menu-toggle" aria-controls="main-menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            {{ menuOpen ? 'close' : 'menu' }}
          </button>
        </div>

        <nav id="main-menu" aria-label="Main" class="tabs">
          <RouterLink v-for="tab in tabs" :key="tab.name" :to="{ name: tab.name }" :class="{ current: isCurrent(tab.name) }">
            {{ tab.label }}
          </RouterLink>
          <template v-if="isGm">
            <span class="group" aria-hidden="true">gm:</span>
            <RouterLink v-for="tab in gmTabs" :key="tab.name" :to="{ name: tab.name }" :class="{ current: isCurrent(tab.name) }">
              {{ tab.label }}
            </RouterLink>
          </template>
        </nav>

        <div class="operator">
          <p v-if="profile">{{ profile.display_name }} <span class="role">[{{ profile.role }}]</span></p>
          <button type="button" class="quiet" :title="profile ? `connected as ${profile.display_name} [${profile.role}]` : undefined" @click="disconnect">
            disconnect
          </button>
        </div>
      </div>
    </header>

    <!-- Keyed by path, so going from one pilot's record (or your own sheet) to another starts the page afresh. -->
    <RouterView :key="route.path" />
  </div>
  <!-- The full information on any item (src/info.ts), opened from cards and pickers anywhere. -->
  <InfoDialog />
  <!-- "Are you sure?" (src/confirm.ts). Opened last, so it sits above the info dialog and pickers. -->
  <ConfirmDialog />
</template>

<style scoped>
/* --topbar-h: the sticky bar's height, for anything else that sticks under it. */
.shell {
  --topbar-h: 3.875rem; /* the logo (48px) and its padding, plus the bottom border */
  display: grid;
  grid-template-rows: auto 1fr; /* top bar, page */
  grid-template-columns: minmax(0, 1fr); /* wide tables scroll in their own box, not the page */
  min-height: 100vh;
  min-height: 100dvh;
}

/* --- Top bar: the name, the tabs, who you are, lined up with the page column --- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid var(--rule);
  background: var(--void);
  font: 400 0.9375rem/1.6 var(--mono);
}

.bar-inner {
  display: flex;
  align-items: stretch;
  gap: 0 2rem;
  max-width: var(--page-max);
  min-height: calc(var(--topbar-h) - 1px);
  margin: 0 auto;
  padding: 0 1.5rem;
}

.brand-row {
  display: flex;
  align-items: center;
}

.brand {
  padding: 0.4rem 0;
  color: var(--lilac);
  text-decoration: none;
}

/* Whole-pixel sizes keep the block characters sharp. */
.logo {
  margin: 0;
  font: 400 4px / 4px var(--mono);
}

.brand:hover {
  color: var(--rose);
}

/* One row, never wrapped, so --topbar-h stays true (the narrower layouts below take over before it would). */
.tabs {
  display: flex;
  align-items: stretch;
  gap: 0 0.25rem;
}

/* A tab is plain text with room to tap; the current one is lilac on a panel, with a line under it. */
.tabs a {
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  color: var(--text-dim);
  text-decoration: none;
}

.tabs a:hover {
  color: var(--text);
}

.tabs a.current {
  border-bottom-color: var(--lilac);
  background: var(--panel);
  color: var(--lilac);
}

/* "gm:" starts the GM tabs, after a thin divider. */
.group {
  display: flex;
  align-items: center;
  padding-left: 1rem;
  border-left: 1px solid var(--rule);
  margin: 0.75rem 0 0.75rem 0.75rem;
  color: var(--rose);
  font-size: 0.8125rem;
}

.operator {
  display: flex;
  align-items: center;
  gap: 0 1rem;
  min-width: 0;
  margin-left: auto;
  font-size: 0.875rem;
}

/* A long Discord name is cut short rather than pushing the bar onto a second row; the tooltip has it in full. */
.operator p {
  max-width: 18ch;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role {
  color: var(--rose);
}

.operator button {
  font-size: 0.875rem;
}

.menu-toggle {
  display: none;
}

/* --- Tablets and small laptops: the same one-row bar, tightened (14px tabs, smaller gaps), and the operator's name
   moves into disconnect's tooltip. An owner's full tab set fits down to 56rem. --- */
@media (max-width: 72rem) {
  .topbar {
    font-size: 0.875rem;
  }

  .bar-inner {
    gap: 0 1rem;
    padding: 0 1rem;
  }

  .tabs {
    gap: 0 0.125rem;
  }

  .tabs a {
    padding: 0 0.45rem;
  }

  .group {
    padding-left: 0.6rem;
    margin-left: 0.4rem;
  }

  .operator p {
    display: none;
  }
}

/* --- Phones and narrow windows (too narrow for every tab on one row, an owner's included): the bar shows the logo
   and [ menu ], which opens the tabs and who you are. Not sticky here. --- */
@media (max-width: 56rem) {
  .operator p {
    display: block;
    max-width: none;
    white-space: normal;
  }

  .shell {
    --topbar-h: 0px;
  }

  .topbar {
    position: static;
  }

  .bar-inner {
    flex-direction: column;
    padding: 0 1rem;
  }

  .brand-row {
    justify-content: center;
    min-height: 3rem;
    position: relative;
  }

  .menu-toggle {
    position: absolute;
    right: 0;
    display: block;
    min-height: 2.5rem;
    padding-inline: 0;
    font-size: 0.875rem;
  }

  .shell:not(.menu-open) .tabs,
  .shell:not(.menu-open) .operator {
    display: none;
  }

  .tabs {
    flex-wrap: wrap;
    justify-content: center;
    padding-bottom: 0.5rem;
  }

  .tabs a {
    min-height: 2.75rem;
  }

  .group {
    flex-basis: 100%;
    justify-content: center;
    padding: 0.5rem 0 0;
    border-top: 1px solid var(--rule);
    border-left: 0;
    margin: 0.25rem 0 0;
  }

  .operator {
    flex-wrap: wrap;
    justify-content: center;
    margin: 0;
    padding: 0.5rem 0 0.75rem;
    border-top: 1px solid var(--rule);
  }
}
</style>
