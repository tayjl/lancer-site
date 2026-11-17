<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logo from './assets/logo.txt?raw'
import { isGm, isOwner, loadProfile, profile, profileError, session } from './auth'
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
  { name: 'pilot', label: 'My pilot' },
  { name: 'registry', label: 'Registry' },
  { name: 'pending', label: 'Pending' },
  { name: 'memorial', label: 'Memorial' },
  { name: 'archives', label: 'Archives' },
  { name: 'lore', label: 'Lore' },
]
const gmTabs = computed(() => [
  { name: 'gm-pilots', label: 'Pilots' },
  { name: 'gm-changes', label: 'Changes' },
  ...(isOwner.value ? [{ name: 'gm-content', label: 'Content' }] : []),
])
const isCurrent = (name: string) => route.name === name || (sectionOverride.value ?? route.meta.section) === name
// Set on every tab, so it overrides RouterLink's own (which only marks the exact page).
const current = (name: string) => (isCurrent(name) ? 'page' : undefined)

// Narrow screens: the tabs move into a drawer under the bar, opened by Menu. It closes when you pick a page.
const menuOpen = ref(false)
watch(() => route.fullPath, () => (menuOpen.value = false))

// The session ended while the site was open (signed out in another tab, expired): back to the login page.
watch(session, (now, before) => {
  if (before && !now && !route.meta.public) router.replace({ name: 'login' })
})

async function disconnect() {
  await supabase.auth.signOut()
  await router.push({ name: 'login' })
}
</script>

<template>
  <RouterView v-if="route.meta.public" />

  <!-- The logged-in layout: a bar across the top, the page under it. -->
  <div v-else class="shell">
    <header class="topbar">
      <div class="topbar-inner">
        <!-- The HORUS logo (src/assets/logo.txt), small, linking home. Screen readers get the link's label. -->
        <RouterLink :to="{ name: 'home' }" class="home" aria-label="HOR_OS: home">
          <pre class="logo" aria-hidden="true">{{ logoArt }}</pre>
        </RouterLink>

        <nav class="nav" aria-label="Main">
          <div class="tabs" data-end>
            <RouterLink v-for="tab in tabs" :key="tab.name" :to="{ name: tab.name }" class="tab" :aria-current="current(tab.name)">
              {{ tab.label }}
            </RouterLink>
          </div>
          <div v-if="isGm" class="group">
            <span class="label">GM</span>
            <div class="tabs" data-end>
              <RouterLink v-for="tab in gmTabs" :key="tab.name" :to="{ name: tab.name }" class="tab" :aria-current="current(tab.name)">
                {{ tab.label }}
              </RouterLink>
            </div>
          </div>
        </nav>

        <div class="user">
          <span v-if="profile" class="who">{{ profile.display_name }} <span class="label">{{ profile.role }}</span></span>
          <button type="button" class="quiet small" @click="disconnect">Disconnect</button>
          <button type="button" class="small menu" aria-controls="drawer" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            {{ menuOpen ? 'Close' : 'Menu' }}
          </button>
        </div>
      </div>

      <!-- Narrow screens only: the same tabs as 44px rows. -->
      <nav v-show="menuOpen" id="drawer" class="drawer" aria-label="Main">
        <RouterLink v-for="tab in tabs" :key="tab.name" :to="{ name: tab.name }" :aria-current="current(tab.name)">{{ tab.label }}</RouterLink>
        <template v-if="isGm">
          <span class="label">GM</span>
          <RouterLink v-for="tab in gmTabs" :key="tab.name" :to="{ name: tab.name }" :aria-current="current(tab.name)">{{ tab.label }}</RouterLink>
        </template>
        <span v-if="profile" class="label">Signed in as {{ profile.display_name }} ({{ profile.role }})</span>
      </nav>
    </header>

    <!-- Keyed by path, so going from one pilot's record (or your own sheet) to another starts the page afresh. The lore
         list and its entries are one page (the list keeps its place and search as you read). -->
    <main v-if="profileError" class="page">
      <div class="notice warn" role="alert">
        <div class="notice-head">
          <p class="notice-title">Couldn't load your profile</p>
          <button type="button" class="small" @click="loadProfile">Retry</button>
        </div>
        <p>Can't reach the database. If the site has had a quiet week, the free Supabase project may be paused: an owner can restore it from the Supabase dashboard.</p>
      </div>
    </main>
    <RouterView v-else :key="route.meta.section === 'lore' ? 'lore' : route.path" />
  </div>
  <!-- The full information on any item (src/info.ts), opened from cards and pickers anywhere. -->
  <InfoDialog />
  <!-- "Are you sure?" (src/confirm.ts). Opened last, so it sits above the info dialog and pickers. -->
  <ConfirmDialog />
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-rows: auto 1fr; /* top bar, page */
  grid-template-columns: minmax(0, 1fr); /* wide tables scroll in their own box, not the page */
  min-height: 100vh;
  min-height: 100dvh;
}

/* --- The top bar: the site's one sticky bar, on every screen size. Its height is --topbar-h (style.css). --- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: var(--topbar-h);
  border-bottom: 1px solid var(--rule);
  background: var(--void);
}

.topbar-inner {
  display: flex;
  align-items: center;
  gap: var(--space-l);
  max-width: var(--page-max);
  height: 100%;
  margin: 0 auto;
  padding: 0 var(--space-l);
}

.home {
  flex: none;
  color: var(--text);
  text-decoration: none;
}

/* The HORUS art, small: the one terminal flourish in the bar. Whole-pixel sizes keep the block characters sharp. */
.logo {
  margin: 0;
  font: 400 4px / 4px var(--mono);
  white-space: pre;
}

.nav {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  height: 100%;
}

/* The bar draws its own line, so the tab rows don't. */
.nav .tabs {
  height: 100%;
  border-bottom: 0;
}

.nav .tab {
  min-height: calc(var(--topbar-h) - 1px);
}

/* "GM" starts the GM tabs, after a thin divider. */
.group {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-s);
  height: 100%;
  margin-left: var(--space-s);
  padding-left: var(--space-m);
}

.group::before {
  content: '';
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 0;
  border-left: 1px solid var(--rule);
}

.user {
  display: flex;
  align-items: center;
  gap: var(--space-m);
  font-size: var(--fs-s);
  white-space: nowrap;
}

/* A long Discord name is cut short rather than pushing the tabs off the bar. */
.who {
  max-width: 18ch;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu,
.drawer {
  display: none;
}

/* --- Narrow screens (an owner's full tab set, with Lore, needs about 75rem): logo, Disconnect and Menu; Menu opens the drawer. --- */
@media (max-width: 77rem) {
  .nav,
  .who {
    display: none;
  }

  .user {
    margin-left: auto;
  }

  .menu {
    display: inline-flex;
  }

  .drawer {
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    display: block;
    max-height: calc(100dvh - var(--topbar-h));
    overflow-y: auto;
    padding: var(--space-s) var(--space-l) var(--space-l);
    border-bottom: 1px solid var(--rule);
    background: var(--panel);
  }

  .drawer a {
    display: flex;
    align-items: center;
    min-height: 44px;
    border-bottom: 1px solid var(--rule);
    color: var(--text);
    text-decoration: none;
  }

  .drawer a[aria-current='page'] {
    color: var(--lilac);
    font-weight: 700;
  }

  .drawer .label {
    display: block;
    margin-top: var(--space-m);
  }
}
</style>
