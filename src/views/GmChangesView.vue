<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { isGm, profile } from '../auth'
import PageHeader from '../components/PageHeader.vue'
import ReviewQueue from '../components/ReviewQueue.vue'
import { supabase } from '../lib/supabaseClient'
import { capitalise } from '../text'
import { since } from '../time'

// gm: changes: changes players have submitted to their approved pilots, oldest submission first,
// so whoever has waited longest is reviewed first. Drafts players are still writing don't show. Below, the
// latest reviewed changes, which are kept as history (who reviewed them, when, and why if rejected).

type Pilot = { id: number; callsign: string | null; pilot_name: string; pilot_image?: string | null; player?: { display_name: string } | null } | null
type Waiting = { id: number; submitted_at: string; character: Pilot }
type Reviewed = { id: number; status: string; review_reason: string | null; reviewed_at: string | null; character: Pilot; reviewer: { display_name: string } | null }

const waiting = shallowRef<Waiting[]>([])
const reviewed = shallowRef<Reviewed[]>([])
const queueCards = computed(() => waiting.value.map(item => ({
  id: item.id, callsign: item.character?.callsign ?? null,
  name: item.character?.pilot_name ?? 'A deleted pilot', image: item.character?.pilot_image ?? null,
  player: item.character?.player?.display_name ?? '–', submittedAt: item.submitted_at,
  to: { name: 'gm-change', params: { id: item.id } },
})))
const loading = ref(true)
const error = ref('')

async function load() {
  const [queue, history] = await Promise.all([
    supabase
      .from('pending_changes')
      .select('id, submitted_at, character:characters(id, callsign, pilot_name, pilot_image, player:profiles(display_name))')
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

const nameOf = (pilot: Pilot) => pilot?.callsign ?? pilot?.pilot_name ?? 'A deleted pilot'
</script>

<template>
  <main class="page">
    <PageHeader title="GM changes" summary="Changes to approved pilots." />

    <p v-if="!profile" class="dim">Loading…</p>
    <p v-else-if="!isGm" class="notice warn" role="alert">Only GMs can see this page.</p>
    <template v-else>
      <p v-if="loading" class="dim">Loading…</p>
      <p v-else-if="error" class="notice warn" role="alert">{{ error }}</p>
      <ReviewQueue v-else :items="queueCards" description="Changes to approved pilots, oldest first." />

      <section v-if="!loading && !error" class="panel" aria-labelledby="history-title">
        <header class="panel-head">
          <h2 id="history-title">Reviewed</h2>
        </header>
        <p v-if="!reviewed.length" class="empty">No reviewed changes yet.</p>
        <div v-else class="table-window" role="region" aria-label="Reviewed changes" tabindex="0">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Pilot</th>
                <th scope="col">Status</th>
                <th scope="col">Reviewer</th>
                <th scope="col">When</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in reviewed" :key="item.id">
                <td><RouterLink :to="{ name: 'gm-change', params: { id: item.id } }" class="callsign">{{ nameOf(item.character) }}</RouterLink></td>
                <td><span class="badge" :class="item.status === 'approved' ? 'approved' : 'rejected'">{{ capitalise(item.status) }}</span></td>
                <td>{{ item.reviewer?.display_name ?? '–' }}</td>
                <td class="dim"><template v-if="item.reviewed_at">{{ since(item.reviewed_at) }} ago</template></td>
                <td class="dim reason" :title="item.review_reason ?? ''">{{ item.review_reason ?? '–' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
section + section { margin-top: var(--space-l); }
.table-window { overflow: auto; border: 1px solid var(--rule); }
.table th, .table td { white-space: nowrap; }
.callsign { font-weight: 700; }
/* The rejection reason, cut to one line; the full reason is on the change's page. */
.reason { max-width: 24rem; overflow: hidden; text-overflow: ellipsis; }
</style>
