<script setup lang="ts">
import { computed } from 'vue'

// What breaks LANCER's rules on this sheet (src/rules.ts; docs/lancer-rules.md), for the player to fix and for GMs to
// see before approving. Nothing shows when everything is legal. The title speaks to whoever can fix it: "fix" on the
// owner's own editable sheet ("draft" adds "before you submit"), otherwise it just counts the problems.
const props = defineProps<{ problems: string[]; fix?: 'draft' | 'own' }>()
const title = computed(() => {
  const n = props.problems.length
  if (!props.fix) return `${n} rule ${n === 1 ? 'problem' : 'problems'}`
  return `${n} ${n === 1 ? 'rule' : 'rules'} to fix${props.fix === 'draft' ? ' before you submit' : ''}`
})
</script>

<template>
  <div v-if="problems.length" class="notice warn" role="note">
    <p class="notice-title">{{ title }}</p>
    <ul>
      <li v-for="problem in problems" :key="problem">{{ problem }}</li>
    </ul>
  </div>
</template>
