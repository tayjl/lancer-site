<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { isGm, profile } from '../auth'
import GlitchText from '../components/GlitchText.vue'
import { supabase } from '../lib/supabaseClient'

// gm_view: the review queue. Every pending pilot, oldest first, so whoever has waited longest is reviewed
// first. Ones a GM sent back are waiting on their player, so they sit in their own list until the player
// resubmits. Changes to approved pilots join the queue once pending changes are built.
// The database only shows GMs and owners everyone's notes; the page just hides the queue from players.

type QueueItem = {
  id: number
  callsign: string | null
  pilot_name: string
  created_at: string
  player: { display_name: string } | null
  sheet: { review_note: string | null } | null
}

const items = shallowRef<QueueItem[]>([])
const loading = ref(true)
const error = ref('')

const waiting = computed(() => items.value.filter((item) => !item.sheet?.review_note))
const sentBack = computed(() => items.value.filter((item) => item.sheet?.review_note))

async function load() {
  const { data, error: loadError } = await supabase
    .from('characters')
    .select('id, callsign, pilot_name, created_at, player:profiles(display_name), sheet:character_sheets(review_note)')
    .eq('status', 'pending')
    .order('created_at')
  items.value = (data ?? []) as QueueItem[]
  error.value = loadError?.message ?? ''
  loading.value = false
}

// The profile (and so the role) can arrive just after the page opens.
watch(isGm, (gm) => gm && load(), { immediate: true })

// How long ago, roughly: "3d 4h", "5h 12m" or "8m".
function since(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  const [d, h, m] = [Math.floor(minutes / 1440), Math.floor((minutes % 1440) / 60), minutes % 60]
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}
</script>

<template>
  <main class="page">
    <h1><span class="prompt" aria-hidden="true">&gt; </span><GlitchText text="gm_view" /></h1>

    <p v-if="!profile" class="dim">loading...</p>
    <p v-else-if="!isGm" class="rose">gm_view is for gms and owners.</p>
    <template v-else>
      <section>
        <h2 class="sheet-label">review queue</h2>
        <p class="dim small">waiting on a gm, oldest first. take the top one.</p>

        <p v-if="loading" class="dim">loading queue...</p>
        <p v-else-if="error" class="rose" role="alert">{{ error }}</p>
        <p v-else-if="!waiting.length" class="dim">nothing waiting on a gm.</p>
        <ol v-else class="queue">
          <li v-for="item in waiting" :key="item.id">
            <RouterLink :to="{ name: 'gm-review', params: { id: item.id } }" class="row">
              <span class="who">
                <span class="callsign">{{ item.callsign ?? item.pilot_name }}</span>
                <span class="dim">{{ item.callsign ? item.pilot_name : '' }}</span>
              </span>
              <span class="dim">{{ item.player?.display_name }}</span>
              <span class="dim">new pilot</span>
              <span class="age">waiting {{ since(item.created_at) }}</span>
            </RouterLink>
          </li>
        </ol>
      </section>

      <section v-if="sentBack.length">
        <h2 class="sheet-label">sent back</h2>
        <p class="dim small">waiting on the player. they rejoin the queue when the player resubmits.</p>
        <ul class="queue">
          <li v-for="item in sentBack" :key="item.id">
            <RouterLink :to="{ name: 'gm-review', params: { id: item.id } }" class="row">
              <span class="who">
                <span class="callsign">{{ item.callsign ?? item.pilot_name }}</span>
                <span class="dim">{{ item.callsign ? item.pilot_name : '' }}</span>
              </span>
              <span class="dim">{{ item.player?.display_name }}</span>
              <span class="dim note">{{ item.sheet?.review_note }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section>
        <h2 class="sheet-label">reputation and owner tools</h2>
        <p class="dim small">module offline.</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
section {
  margin-bottom: 2rem;
}

.small {
  margin: 0.5rem 0 0.75rem;
  font-size: 0.8125rem;
}

.queue {
  margin: 0;
  padding: 0;
  border: 1px solid var(--rule);
  list-style: none;
}

.queue li + li {
  border-top: 1px solid var(--rule);
}

/* One line per pilot on wide screens; it wraps on phones. */
.row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 0.25rem 1.5rem;
  align-items: baseline;
  padding: 0.6rem 0.9rem;
  color: var(--text);
  font-size: 0.875rem;
  text-decoration: none;
}

.row:hover,
.row:focus-visible {
  background: var(--panel);
}

.row:hover .callsign {
  color: var(--rose);
}

.who {
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.75rem;
  min-width: 0;
}

.callsign {
  color: var(--lilac);
  font-weight: 700;
}

.age {
  color: var(--sky);
  white-space: nowrap;
}

/* The GM's note, cut to one line; the full note is on the review page. */
.note {
  grid-column: span 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 40rem) {
  .row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .note {
    grid-column: 1 / -1;
  }
}
</style>
