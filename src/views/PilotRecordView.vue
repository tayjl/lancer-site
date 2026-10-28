<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isGm } from '../auth'
import GlitchText from '../components/GlitchText.vue'
import GmReview from '../components/GmReview.vue'
import Portrait from '../components/Portrait.vue'
import RichText from '../components/RichText.vue'
import { parseEntries } from '../entries'
import { fetchPilot, type PublicPilot } from '../pilots'

// One pilot's full public record, opened from a card in pilot_registry or pending_paperwork. Only public
// fields for everyone; GMs and owners also get the private sheet and the approval decision (GmReview).
const route = useRoute()
const pilot = shallowRef<PublicPilot | null>(null)
const loading = ref(true)
const error = ref('')
const traits = computed(() => parseEntries(pilot.value?.traits))
// Back to the list the pilot is in.
const back = computed(() =>
  pilot.value?.status === 'pending' ? { name: 'pending', label: 'pending_paperwork' } : { name: 'registry', label: 'pilot_registry' },
)

async function load() {
  ;({ pilot: pilot.value, error: error.value } = await fetchPilot(Number(route.params.id)))
  loading.value = false
}

watch(() => route.params.id, load, { immediate: true })

const facts = computed(() => {
  const p = pilot.value
  if (!p) return []
  const all: [label: string, value: string | null][] = [
    ['pilot', p.pilot_name],
    ['player', p.player?.display_name ?? null],
    ['age', p.age],
    ['gender', p.gender],
    ['sexuality', p.sexuality],
    ['height', p.height],
    ['weight', p.weight],
    ['eyes', p.eye_colour],
    ['hair', p.hair_colour],
  ]
  return all.filter(([, value]) => value)
})
</script>

<template>
  <main class="page">
    <RouterLink :to="{ name: back.name }" class="back">&lt; {{ back.label }}</RouterLink>

    <p v-if="loading" class="dim">loading record...</p>
    <p v-else-if="error" class="rose" role="alert">{{ error }}</p>
    <template v-else-if="pilot">
      <h1><span class="prompt" aria-hidden="true">&gt; </span><GlitchText :text="pilot.callsign ?? pilot.pilot_name" /></h1>
      <p v-if="pilot.status !== 'approved'" class="badge" :class="pilot.status">{{ pilot.status }}</p>

      <div class="top">
        <Portrait :src="pilot.pilot_image" :alt="`Portrait of ${pilot.callsign ?? pilot.pilot_name}`" />
        <dl class="facts">
          <template v-for="[label, value] in facts" :key="label">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </template>
        </dl>
      </div>

      <section v-if="pilot.appearance">
        <h2>appearance</h2>
        <RichText :doc="pilot.appearance" />
      </section>

      <section v-if="pilot.personality">
        <h2>personality</h2>
        <RichText :doc="pilot.personality" />
      </section>

      <section v-if="traits.length">
        <h2>traits</h2>
        <div v-for="trait in traits" :key="trait.id" class="trait">
          <h3>{{ trait.name }}</h3>
          <RichText v-if="trait.description" :doc="trait.description" />
        </div>
      </section>

      <section v-if="pilot.mechs.length">
        <h2>{{ pilot.mechs.length === 1 ? 'mech' : 'mechs' }}</h2>
        <div v-for="mech in pilot.mechs" :key="mech.id" class="mech">
          <Portrait :src="mech.image" :alt="`Image of ${mech.name}`" />
          <div>
            <h3>{{ mech.name }}</h3>
            <p class="dim">{{ mech.manufacturer_id }}</p>
            <RichText v-if="mech.appearance" :doc="mech.appearance" class="mech-appearance" />
          </div>
        </div>
      </section>

      <!-- :key reloads the review after a decision, so it shows the new status. -->
      <GmReview v-if="isGm" :key="pilot.status" :pilot="pilot" @reviewed="load" />
    </template>

    <p v-else class="rose">no pilot record with that id.</p>
  </main>
</template>

<style scoped>
.back {
  display: inline-block;
  margin-bottom: 1rem;
  color: var(--text-dim);
  font-size: 0.875rem;
  text-decoration: none;
}

.back:hover {
  color: var(--lilac);
}

/* The status, as a small outlined badge: rose while pending, dim once dead. */
.badge {
  width: fit-content;
  margin: -0.5rem 0 1.25rem;
  padding: 0 0.4rem;
  border: 1px solid currentColor;
  font-size: 0.8125rem;
}

.badge.pending {
  color: var(--rose);
}

.badge.dead {
  color: var(--text-dim);
}

.top {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
  margin-bottom: 2rem;
}

.facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.25rem 1.25rem;
  margin: 0;
}

.facts dt {
  color: var(--text-dim);
}

.facts dd {
  margin: 0;
}

section {
  margin-bottom: 1.75rem;
}

/* Section headings are quiet labels; the content is what matters. */
h2 {
  margin-bottom: 0.4rem;
  color: var(--text-dim);
  font-size: 0.875rem;
  font-weight: 400;
}

.mech {
  display: grid;
  grid-template-columns: 8rem minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.mech h3 {
  margin: 0;
}

.trait + .trait {
  margin-top: 0.75rem;
}

.trait h3 {
  margin: 0 0 0.15rem;
  font-size: 0.9375rem;
}

.mech-appearance {
  margin-top: 0.5rem;
}

.mech p {
  margin: 0.25rem 0 0;
}

@media (max-width: 30rem) {
  .top {
    grid-template-columns: 7rem minmax(0, 1fr);
    gap: 1rem;
  }

  .mech {
    grid-template-columns: 5.5rem minmax(0, 1fr);
    gap: 1rem;
  }
}
</style>
