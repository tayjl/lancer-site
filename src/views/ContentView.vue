<script setup lang="ts">
import { ref, watch } from 'vue'
import { isOwner, profile } from '../auth'
import PageHeader from '../components/PageHeader.vue'
import SlotCard from '../components/SlotCard.vue'
import { supabase } from '../lib/supabaseClient'

// gm: content (owners only): the game content pilots are built from. The LCP importer loads official packs and
// homebrew; the editors fix imported items by hand afterwards. Neither is built yet; for now each kind shows
// how many items are loaded. The database only lets owners change content.

// [content_items kind (or a table), label, what it holds]
const KINDS = [
  ['frames', 'frames', 'stats, mounts and traits; each is also a licence.'],
  ['weapons', 'mech weapons', 'size, damage, range and tags.'],
  ['systems', 'mech systems', 'system points, effects and tags.'],
  ['pilot_gear', 'pilot gear', 'armour, weapons and gear.'],
  ['talents', 'talents', 'three ranks each.'],
  ['core_bonuses', 'core bonuses', 'their effects.'],
  ['tags', 'tags', 'the names and rules of item tags.'],
  ['bionics', 'biomods', "the site's own: stat bonuses and mod-point costs."],
] as const

const counts = ref<Record<string, number>>({})
const loading = ref(true)

async function load() {
  const [items, bionics] = await Promise.all([
    supabase.from('content_items').select('kind'),
    supabase.from('bionics').select('id', { count: 'exact', head: true }),
  ])
  const tally: Record<string, number> = { bionics: bionics.count ?? 0 }
  for (const { kind } of items.data ?? []) tally[kind] = (tally[kind] ?? 0) + 1
  counts.value = tally
  loading.value = false
}

watch(isOwner, (owner) => owner && load(), { immediate: true })
</script>

<template>
  <main class="page content">
    <PageHeader title="gm: content" summary="the game content pilots are built from." />

    <p v-if="!profile" class="dim">loading...</p>
    <p v-else-if="!isOwner" class="rose">access denied. owners only.</p>
    <template v-else>
      <section>
        <h2 class="sheet-label">lcp importer</h2>
        <div class="box">
          <p>import lancer content packs (.lcp files): the official books and homebrew made in cc-lcp-editor.</p>
          <p class="dim">not built yet.</p>
        </div>
      </section>

      <section>
        <h2 class="sheet-label">editors</h2>
        <ul class="slot-grid">
          <SlotCard v-for="[kind, label, about] in KINDS" :key="kind" :title="label">
            <p class="count">
              <strong>{{ loading ? '-' : (counts[kind] ?? 0) }}</strong> <span class="dim">loaded</span>
            </p>
            <p class="dim small">{{ about }}</p>
            <p class="dim small">editing: not built yet.</p>
          </SlotCard>
        </ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
.content section {
  margin-bottom: 1.75rem;
  container-type: inline-size;
}

.box {
  padding: 0.75rem;
  border: 1px solid var(--rule);
}

.box p,
.content :deep(.slot-body) p {
  margin: 0;
}

.box p + p {
  margin-top: 0.35rem;
}

.count strong {
  color: var(--lilac);
  font-size: 1.375rem;
}

.small {
  font-size: 0.8125rem;
}
</style>
