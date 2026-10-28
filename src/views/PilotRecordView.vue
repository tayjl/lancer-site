<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import GlitchText from '../components/GlitchText.vue'
import Portrait from '../components/Portrait.vue'
import RichText from '../components/RichText.vue'
import { examplePilots } from '../pilots'

// One pilot's full public record, opened from a registry card. Only public fields: the private
// sheet (stats, loadouts, backstory) isn't shown here.
const route = useRoute()
const pilot = computed(() => examplePilots.find((p) => p.id === Number(route.params.id)))

const facts = computed(() => {
  const p = pilot.value
  if (!p) return []
  const all: [label: string, value: string | null][] = [
    ['pilot', p.pilot_name],
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
    <RouterLink :to="{ name: 'registry' }" class="back">&lt; pilot_registry</RouterLink>

    <template v-if="pilot">
      <h1><span class="prompt" aria-hidden="true">&gt; </span><GlitchText :text="pilot.callsign ?? pilot.pilot_name" /></h1>

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

      <section v-if="pilot.traits">
        <h2>traits</h2>
        <RichText :doc="pilot.traits" />
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
