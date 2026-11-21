<script setup lang="ts">
import FileIndex from '../components/FileIndex.vue'
import FileSection from '../components/FileSection.vue'
import InfoRule from '../components/InfoRule.vue'
import PageHeader from '../components/PageHeader.vue'
import RulesText from '../components/RulesText.vue'
import { COMBAT_SECTIONS } from '../combatRules'

// The combat guide: what you can do on your turn, read-only. The text is in src/combatRules.ts. Sections use the
// pilot file's numbered sections and sticky index.
const index = COMBAT_SECTIONS.map((sec, i) => ({ id: sec.id, no: String(i + 1).padStart(2, '0'), title: sec.title }))
</script>

<template>
  <main class="page">
    <PageHeader title="Combat" summary="What you can do on your turn." />
    <div class="dossier">
      <FileIndex :sections="index" />
      <div class="file">
        <FileSection v-for="(sec, i) in COMBAT_SECTIONS" :id="sec.id" :key="sec.id" :no="index[i].no" :title="sec.title">
          <RulesText v-if="sec.intro" :html="sec.intro" class="intro" />
          <ul v-if="sec.actions.length" class="actions">
            <li v-for="action in sec.actions" :key="action.name">
              <InfoRule :heading="action.name" :activation="action.activation" :html="action.text" />
            </li>
          </ul>
        </FileSection>
      </div>
    </div>
  </main>
</template>

<style scoped>
.intro {
  max-width: 68ch;
  margin-bottom: var(--space-l);
}

.actions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 0 var(--space-xl);
  margin: 0;
  padding: 0;
  list-style: none;
}

.actions li {
  padding: var(--space-m) 0;
  border-top: 1px solid var(--rule);
}
</style>
