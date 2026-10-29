<script setup lang="ts">
// What breaks LANCER's rules on this sheet (src/rules.ts; docs/lancer-rules.md), for the player to fix and
// for GMs to see before approving. Nothing shows when everything is legal.
defineProps<{ problems: string[] }>()
</script>

<template>
  <div v-if="problems.length" class="rule-check" role="note">
    <p class="rose">rule check: {{ problems.length }} {{ problems.length === 1 ? 'problem' : 'problems' }}</p>
    <ul>
      <li v-for="problem in problems" :key="problem">{{ problem }}</li>
    </ul>
  </div>
</template>

<style scoped>
.rule-check {
  padding: 0.6rem 0.9rem;
  border-left: 3px solid var(--rose);
  background: var(--panel);
  font-size: 0.875rem;
  text-align: left;
}

.rule-check p {
  margin: 0;
}

.rule-check ul {
  margin: 0.35rem 0 0;
  padding-left: 1.25rem;
}
</style>
