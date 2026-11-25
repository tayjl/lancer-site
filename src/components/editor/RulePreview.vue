<script setup lang="ts">
import { computed } from 'vue'
import type { Data } from '../../contentEditor'
import { firstSentence, rowEntry, type CombatEntry } from '../../combatEntries'
import { hasValue, ruleSection, sectionIcon } from '../../ruleList'
import { defData, defList } from '../../definitions'
import { fill } from '../../rulesData'
import { plainText } from '../../rulesText'
import CombatGroup from '../CombatGroup.vue'
import RulesText from '../RulesText.vue'

// A rule drawn as the combat page draws it (CombatGroup), from the data on screen.
const props = defineProps<{ data: Data }>()
const str = (key: string) => String(props.data[key] ?? '')
const section = computed(() => ruleSection(str('section')))
const numbers = computed(() => (Array.isArray(props.data.numbers) ? props.data.numbers : []))

type Card = { title: string; icon: string; note?: string; entries?: CombatEntry[]; gist?: boolean }
const card = computed<Card | null>(() => {
  const s = section.value
  if (!s || s.shape === 'numbers') return null
  const name = str('name')
  const text = fill(str('text'))
  if (s.id === 'notes') return { title: name || 'Unnamed', icon: 'info', note: plainText(text) }
  if (s.shape === 'steps') return { title: 'Your turn', icon: 'list', gist: true, entries: [{ name, frequency: str('value') || undefined, gist: str('gist') || firstSentence(text), text, open: true }] }
  const value = str('value')
  // No value, no value column (no empty gutter).
  const column = hasValue(s.id) && !!value
  const row = { value: column ? value : name, short: str('short') || undefined, name: column ? name : undefined, gist: str('gist') || undefined, text, icon: str('icon') || undefined }
  const status = s.id === 'statuses' ? defList('status_groups', true).find((g) => g.id === str('group')) : undefined
  return { title: status?.label ?? s.label, icon: (status && String(defData('status_groups', status.id).icon ?? '')) || sectionIcon(s.id), entries: [{ ...rowEntry(row, { column }), open: true }] }
})
</script>

<template>
  <div class="rule-preview">
    <p v-if="data.hidden === true" class="dim note">Hidden from players.</p>
    <template v-if="section?.shape === 'numbers'">
      <p class="label">{{ str('name') }}</p>
      <p class="nums num">{{ numbers.join(' · ') || 'None' }}</p>
      <RulesText :html="str('text')" />
    </template>
    <p v-else-if="!card" class="notice warn" role="alert">Preview failed: Choose a section.</p>
    <p v-else-if="!str('name')" class="dim note">Add a name to see the preview.</p>
    <CombatGroup v-else :title="card.title" :icon="card.icon" :note="card.note" :entries="card.entries" :gist="card.gist" />
  </div>
</template>

<style scoped>
.rule-preview {
  display: grid;
  gap: var(--space-s);
}

.note {
  margin: 0;
  font-size: var(--fs-s);
}

.nums {
  margin: 0;
  font-size: var(--fs-l);
  text-align: center;
}
</style>
