<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logo from './assets/logo.txt?raw'
import netChat from './assets/net-chat.txt?raw'
import { isGm, isOwner, profile } from './auth'
import ChatFeed from './components/ChatFeed.vue'
import { supabase } from './lib/supabaseClient'

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
]
const gmTabs = computed(() => [
  { name: 'gm-pilots', label: 'pilots' },
  { name: 'gm-changes', label: 'changes' },
  ...(isOwner.value ? [{ name: 'gm-content', label: 'content' }] : []),
])
const isCurrent = (name: string) => route.name === name || route.meta.section === name

// On phones the bar collapses to the name and [ menu ] / [ chat ] toggles (see the CSS at the bottom).
// The menu closes when you pick a page, or once you've scrolled past it.
const menuOpen = ref(false)
const bar = useTemplateRef('bar')
// The chat panel is always shown on wide screens; on phones, a [ chat ] toggle shows it.
const chatOpen = ref(false)
// Wide screens can minimise it to one line. Remembered in this browser (storage can be blocked, hence the try).
const CHAT_KEY = 'hor_os.chat-minimised'
const chatMinimised = ref(readFlag())

function readFlag() {
  try {
    return localStorage.getItem(CHAT_KEY) === '1'
  } catch {
    return false
  }
}

function toggleChat() {
  chatMinimised.value = !chatMinimised.value
  try {
    localStorage.setItem(CHAT_KEY, chatMinimised.value ? '1' : '0')
  } catch {
    // Not remembered; it still works for this visit.
  }
}

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

  <!-- The logged-in layout: a bar across the top, the page under it, the net chat at the bottom. -->
  <div v-else class="shell" :class="{ 'menu-open': menuOpen, 'chat-open': chatOpen }">
    <header ref="bar" class="topbar">
      <div class="brand-row">
        <!-- The HORUS logo (src/assets/logo.txt), small, linking home. Screen readers get the link's label. -->
        <RouterLink :to="{ name: 'home' }" class="brand" aria-label="HOR_OS: home">
          <pre class="logo" aria-hidden="true">{{ logoArt }}</pre>
        </RouterLink>
        <!-- Phones only. -->
        <button type="button" class="chat-toggle" aria-controls="net-chat" :aria-expanded="chatOpen" @click="chatOpen = !chatOpen">
          chat
        </button>
        <button type="button" class="menu-toggle" aria-controls="main-menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
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
        <button type="button" @click="disconnect">disconnect</button>
      </div>
    </header>

    <!-- Keyed by path, so going from one pilot's record (or your own sheet) to another starts the page afresh. -->
    <RouterView :key="route.path" />

    <!-- The net chat (src/assets/net-chat.txt), pinned to the bottom of the window. -->
    <section id="net-chat" class="chat-panel" :class="{ minimised: chatMinimised }" aria-label="Net chat">
      <button type="button" class="chat-minimise" :aria-expanded="!chatMinimised" @click="toggleChat">
        {{ chatMinimised ? 'show chat' : 'minimise' }}
      </button>
      <!-- The 5-line MOTD block comes out quickly, then a message every 1.8 seconds: slower than the
           login chat, so it's readable while browsing. -->
      <ChatFeed :text="netChat" :delay="1800" :quick-lines="5" />
    </section>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-rows: auto 1fr auto; /* top bar, page, chat */
  min-height: 100vh;
  min-height: 100dvh;
}

/* --- Top bar: the name, the tabs, who you are --- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: stretch;
  gap: 0 2rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--rule);
  background: var(--void);
  font: 400 0.9375rem/1.6 var(--mono);
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

.tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0 1.5rem;
}

/* A tab is plain text; the current one is lilac with a line under it. */
.tabs a {
  display: flex;
  align-items: center;
  padding: 0.85rem 0 calc(0.85rem - 2px);
  border-bottom: 2px solid transparent;
  color: var(--text-dim);
  text-decoration: none;
}

.tabs a:hover {
  color: var(--text);
}

.tabs a.current {
  border-bottom-color: var(--lilac);
  color: var(--lilac);
}

/* "gm:" starts the GM tabs, after a thin divider. */
.group {
  display: flex;
  align-items: center;
  padding-left: 1.5rem;
  border-left: 1px solid var(--rule);
  margin-block: 0.75rem;
  color: var(--rose);
  font-size: 0.8125rem;
}

.operator {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 1.25rem;
  margin-left: auto;
  font-size: 0.875rem;
}

.operator p {
  margin: 0;
}

.role {
  color: var(--rose);
}

.operator button {
  padding-inline: 0;
  font-size: 0.875rem;
}

/* Pages use the full width under the bar. */
.shell :deep(.page) {
  margin: 0;
}

/* --- Net chat: at the bottom of the window, over the page as it scrolls. 8 chat lines tall, plus padding and the 1px line. --- */
.chat-panel {
  position: sticky;
  bottom: 0;
  height: calc(8 * 1.5rem + 1.5rem + 1px);
  padding: 0.75rem 1.5rem;
  border-top: 1px solid var(--rule);
  background: var(--void);
}

/* Wide screens only: a small option in the chat's top-right corner. */
.chat-minimise {
  position: absolute;
  top: 0.5rem;
  right: 1.5rem;
  z-index: 1;
  padding: 0;
  font-size: 0.75rem;
}

/* Minimised: just the option, on one line. The feed keeps running underneath, so it doesn't restart. */
@media (min-width: 48.0625rem) {
  .chat-panel.minimised {
    height: auto;
    padding-block: 0.35rem;
  }

  .minimised .chat-minimise {
    position: static;
    display: block;
    margin-left: auto;
  }

  .minimised :deep(.feed) {
    display: none;
  }
}

.menu-toggle,
.chat-toggle {
  display: none;
}

/* --- Phones and narrow windows: the bar shows the name and two toggles; [ menu ] opens the tabs --- */
@media (max-width: 48rem) {
  .topbar {
    position: static;
    flex-direction: column;
    padding: 0 1rem;
  }

  .brand-row {
    justify-content: center;
    gap: 0;
    min-height: 3rem;
    position: relative;
  }

  .menu-toggle,
  .chat-toggle {
    position: absolute;
    display: block;
    padding-inline: 0;
    font-size: 0.875rem;
  }

  .chat-toggle {
    left: 0;
  }

  .menu-toggle {
    right: 0;
  }

  .shell:not(.menu-open) .tabs,
  .shell:not(.menu-open) .operator {
    display: none;
  }

  .tabs {
    justify-content: center;
    gap: 0 1.25rem;
    padding-bottom: 0.5rem;
  }

  .tabs a {
    padding: 0.5rem 0 calc(0.5rem - 2px);
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
    justify-content: center;
    margin: 0;
    padding: 0.5rem 0 0.75rem;
    border-top: 1px solid var(--rule);
  }

  /* Phones open and close the chat with [ chat ] instead. */
  .chat-minimise {
    display: none;
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
}
</style>
