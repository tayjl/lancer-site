<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logo from './assets/logo.txt?raw'
import netChat from './assets/net-chat.txt?raw'
import { isGm, profile } from './auth'
import ChatFeed from './components/ChatFeed.vue'
import { supabase } from './lib/supabaseClient'

const route = useRoute()
const router = useRouter()

// The sidebar menu, in groups of related pages, with space between groups.
// Labels match each route's meta.title in router.ts.
const menu = [
  [{ name: 'pilot', label: 'pilot_management' }],
  [
    { name: 'registry', label: 'pilot_registry' },
    { name: 'pending', label: 'pending_paperwork' },
    { name: 'memorial', label: 'those_who_passed' },
  ],
  [{ name: 'archive', label: 'archive_viewer' }],
  [
    { name: 'pilot-gear', label: 'pilot_gear' },
    { name: 'mech-gear', label: 'mech_gear' },
  ],
]

// On phones the header collapses to just the logo and a [ menu ] toggle (see the CSS at the bottom).
// It closes again when you pick a page, or once you've scrolled past it.
const menuOpen = ref(false)
const sidebar = useTemplateRef('sidebar')
// The chat panel is always shown on wide screens; on phones, a [ chat ] toggle shows it.
const chatOpen = ref(false)

watch(() => route.fullPath, () => (menuOpen.value = false))

function closeMenuOnScroll() {
  if (menuOpen.value && window.scrollY > (sidebar.value?.offsetHeight ?? 0)) menuOpen.value = false
}

onMounted(() => window.addEventListener('scroll', closeMenuOnScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', closeMenuOnScroll))

function toggleGmView() {
  router.push({ name: route.meta.gm ? 'registry' : 'gm' })
}

async function disconnect() {
  await supabase.auth.signOut()
  await router.push({ name: 'login' })
}
</script>

<template>
  <RouterView v-if="route.meta.public" />

  <!-- The logged-in layout: a sidebar on the left, a top bar and the page on the right. -->
  <div v-else class="shell" :class="{ 'menu-open': menuOpen, 'chat-open': chatOpen }">
    <aside ref="sidebar" class="sidebar">
      <div class="brand-bar">
        <!-- Phones only, mirroring the menu toggle on the right. -->
        <button
          type="button"
          class="chat-toggle"
          aria-controls="net-chat"
          :aria-expanded="chatOpen"
          @click="chatOpen = !chatOpen"
        >
          chat
        </button>
        <!-- The HORUS logo (src/assets/logo.txt). Screen readers get the link's label instead of the art. -->
        <RouterLink :to="{ name: 'registry' }" class="brand" aria-label="h0r_os: pilot registry">
          <pre class="logo" aria-hidden="true">{{ logo.replace(/\r/g, '').trimEnd() }}</pre>
        </RouterLink>
        <!-- Phones only. -->
        <button
          type="button"
          class="menu-toggle"
          aria-controls="main-menu"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          {{ menuOpen ? 'close' : 'menu' }}
        </button>
      </div>

      <nav id="main-menu" aria-label="Main" class="menu">
        <ul v-for="(group, i) in menu" :key="i">
          <li v-for="item in group" :key="item.name">
            <!-- "current": this page, or a page in its section (like a pilot record under the registry). -->
            <RouterLink
              :to="{ name: item.name }"
              :class="{ current: route.name === item.name || route.meta.section === item.name }"
            >
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <button v-if="isGm" type="button" class="gm-toggle" @click="toggleGmView">
        {{ route.meta.gm ? 'exit gm view' : 'gm view' }}
      </button>
    </aside>

    <header class="topbar">
      <p class="dim">~/{{ route.meta.title }}</p>
      <div class="operator">
        <p v-if="profile">
          <span class="dim">uuid:</span> {{ profile.display_name }} <span class="role">[{{ profile.role }}]</span>
        </p>
        <button type="button" @click="disconnect">disconnect</button>
      </div>
    </header>

    <RouterView />

    <!-- The net chat (src/assets/net-chat.txt), pinned to the bottom of the window. -->
    <section id="net-chat" class="chat-panel" aria-label="Net chat">
      <!-- The 5-line MOTD block comes out quickly, then a message every 1.8 seconds: slower than the
           login chat, so it's readable while browsing. -->
      <ChatFeed :text="netChat" :delay="1800" :quick-lines="5" />
    </section>
  </div>
</template>

<style scoped>
.shell {
  /* The brand area and top bar share this height, so their bottom lines meet.
     It fits the logo: 12 lines at 7px each, plus padding. */
  --bar-height: calc(12 * 7px + 1.5rem);
  display: grid;
  grid-template-columns: 16rem minmax(0, 1fr);
  grid-template-rows: auto 1fr auto; /* top bar, page, chat */
  min-height: 100vh;
  min-height: 100dvh;
}

/* The sidebar stays put while the page scrolls. */
.sidebar {
  position: sticky;
  top: 0;
  grid-row: 1 / -1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  border-right: 1px solid var(--rule);
  font-family: var(--mono);
}

.brand-bar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: var(--bar-height);
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--rule);
  font-size: 0.9375rem;
}

.brand {
  color: var(--lilac);
  text-decoration: none;
}

.brand:hover {
  color: var(--rose);
}

/* Whole-pixel sizes keep the block characters sharp. */
.logo {
  margin: 0;
  font: 400 6px / 7px var(--mono);
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 1.5rem; /* the space between groups */
  padding: 1.5rem 1.5rem 0;
}

.menu ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Menu items have a two-character gutter that turns into "> " for the current page or on hover,
   like a terminal menu pointing at an option. */
.menu a {
  display: block;
  padding: 0.6rem 0;
  color: var(--text-dim);
  font-size: 1rem;
  text-decoration: none;
}

.menu a::before {
  content: '  ' / '';
  white-space: pre;
  color: var(--rose);
}

.menu a:hover,
.menu a.current {
  color: var(--lilac);
}

.menu a:hover::before,
.menu a.current::before {
  content: '> ' / '';
}

.gm-toggle {
  align-self: flex-start;
  margin: auto 1.5rem 1.25rem;
  padding-inline: 0;
}

.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 1.5rem;
  min-height: var(--bar-height);
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--rule);
  font: 400 0.875rem/1.6 var(--mono);
}

.topbar p {
  margin: 0;
}

.operator {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 1.25rem;
}

.role {
  color: var(--rose);
}

.operator button {
  padding-inline: 0;
  font-size: 0.875rem;
}

/* The page sits next to the sidebar rather than centred in the space. */
.shell :deep(.page) {
  margin: 0;
}

/* Sits at the bottom of the window, over the page as it scrolls. 8 chat lines tall, plus padding and the 1px line. */
.chat-panel {
  position: sticky;
  bottom: 0;
  height: calc(8 * 1.5rem + 1.5rem + 1px);
  padding: 0.75rem 1.5rem;
  border-top: 1px solid var(--rule);
  background: var(--void);
}

.menu-toggle,
.chat-toggle {
  display: none;
}

/* Phones and narrow windows: the sidebar stacks on top and the menu wraps across the screen. */
@media (max-width: 48rem) {
  .shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
    align-content: start;
  }

  .sidebar {
    position: static;
    grid-row: auto;
    height: auto;
    border-right: 0;
  }

  .brand-bar {
    position: relative;
    padding: 0 1rem;
  }

  .menu-toggle,
  .chat-toggle {
    position: absolute;
    display: block;
    padding-inline: 0;
    font-size: 0.875rem;
  }

  .menu-toggle {
    right: 1rem;
  }

  .chat-toggle {
    left: 1rem;
  }

  .shell:not(.chat-open) .chat-panel {
    display: none;
  }

  /* On phones the chat pops up over the bottom of the screen. */
  .chat-panel {
    position: fixed;
    right: 0;
    left: 0;
    height: calc(8 * 1.25rem + 1.5rem + 1px);
    padding: 0.75rem 1rem;
  }

  /* Collapsed: only the logo and the toggle show. */
  .shell:not(.menu-open) .menu,
  .shell:not(.menu-open) .gm-toggle,
  .shell:not(.menu-open) .topbar {
    display: none;
  }

  .menu {
    gap: 0.5rem;
    padding: 0.75rem 1rem 0;
  }

  /* Each group is a centred row. */
  .menu ul {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0 1.25rem;
  }

  .menu a {
    padding: 0.4rem 0;
  }

  /* Centred items get a gutter on both sides, so the current page reads "> like this <". */
  .menu a::after {
    content: '  ' / '';
    white-space: pre;
    color: var(--rose);
  }

  .menu a:hover::after,
  .menu a.current::after {
    content: ' <' / '';
  }

  .gm-toggle {
    align-self: center;
    margin: 0.75rem 0 0;
  }

  /* Stacked, the top bar doesn't sit beside the logo, so it doesn't need to match its height. */
  .topbar {
    justify-content: center;
    min-height: 0;
    padding: 0.75rem 1rem;
    text-align: center;
  }

  .operator {
    justify-content: center;
  }
}
</style>
