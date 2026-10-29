<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { isGm, profile } from '../auth'
import PageHeader from '../components/PageHeader.vue'
import { supabase } from '../lib/supabaseClient'
import { since } from '../time'

// gm: changes: changes players have submitted to their approved pilots, oldest submission first,
// so whoever has waited longest is reviewed first. Drafts players are still writing don't show. Below, the
// latest reviewed changes, which are kept as history (who reviewed them, when, and why if rejected).

type Pilot = { id: number; callsign: string | null; pilot_name: string; player?: { display_name: string } | null } | null
type Waiting = { id: number; submitted_at: string; character: Pilot }
type Reviewed = { id: number; status: string; review_reason: string | null; reviewed_at: string | null; character: Pilot; reviewer: { display_name: string } | null }

const waiting = shallowRef<Waiting[]>([])
const reviewed = shallowRef<Reviewed[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  const [queue, history] = await Promise.all([
    supabase
      .from('pending_changes')
      .select('id, submitted_at, character:characters(id, callsign, pilot_name, player:profiles(display_name))')
      .eq('status', 'pending')
      .not('submitted_at', 'is', null)
      .order('submitted_at'),
    supabase
      .from('pending_changes')
      .select('id, status, review_reason, reviewed_at, character:characters(id, callsign, pilot_name), reviewer:profiles!reviewed_by(display_name)')
      .neq('status', 'pending')
      .order('reviewed_at', { ascending: false })
      .limit(20),
  ])
  waiting.value = (queue.data ?? []) as Waiting[]
  reviewed.value = (history.data ?? []) as Reviewed[]
  error.value = queue.error?.message ?? history.error?.message ?? ''
  loading.value = false
}

// The profile (and so the role) can arrive just after the page opens.
watch(isGm, (gm) => gm && load(), { immediate: true })

const nameOf = (pilot: Pilot) => pilot?.callsign ?? pilot?.pilot_name ?? 'a deleted pilot'
</script>

<template>
  <main class="page">
    <PageHeader title="gm: changes" summary="changes players want to make to their approved pilots." />

    <p v-if="!profile" class="dim">loading...</p>
    <p v-else-if="!isGm" class="rose">access denied. gm clearance required.</p>
    <template v-else>
      <section>
        <h2 class="sheet-label">review queue</h2>
        <p class="dim small">changes to approved pilots, oldest submission first. take the top one.</p>

        <p v-if="loading" class="dim">loading queue...</p>
        <p v-else-if="error" class="rose" role="alert">{{ error }}</p>
        <p v-else-if="!waiting.length" class="dim">nothing waiting on a gm.</p>
        <ol v-else class="queue">
          <li v-for="item in waiting" :key="item.id">
            <RouterLink :to="{ name: 'gm-change', params: { id: item.id } }" class="row">
              <span class="who">
                <span class="callsign">{{ nameOf(item.character) }}</span>
                <span class="dim">{{ item.character?.callsign ? item.character.pilot_name : '' }}</span>
              </span>
              <span class="dim">{{ item.character?.player?.display_name }}</span>
              <span class="dim">change</span>
              <span class="age">waiting {{ since(item.submitted_at) }}</span>
            </RouterLink>
          </li>
        </ol>
      </section>

      <section v-if="reviewed.length">
        <h2 class="sheet-label">history</h2>
        <p class="dim small">the latest reviewed changes.</p>
        <ul class="queue">
          <li v-for="item in reviewed" :key="item.id">
            <RouterLink :to="{ name: 'gm-change', params: { id: item.id } }" class="row">
              <span class="who"><span class="callsign">{{ nameOf(item.character) }}</span></span>
              <span :class="item.status === 'approved' ? 'sky' : 'rose'">{{ item.status }}</span>
              <span class="dim">{{ item.reviewer?.display_name ?? '-' }}</span>
              <span class="dim">{{ item.reviewed_at ? `${since(item.reviewed_at)} ago` : '' }}</span>
              <span v-if="item.review_reason" class="dim reason">{{ item.review_reason }}</span>
            </RouterLink>
          </li>
        </ul>
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

/* One line per change on wide screens; it wraps on phones. */
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

.sky {
  color: var(--sky);
}

/* The rejection reason, cut to one line; the full reason is on the change's page. */
.reason {
  grid-column: 1 / -1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 40rem) {
  .row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}
</style>
