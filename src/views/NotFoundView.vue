<script setup lang="ts">
import PageHeader from '../components/PageHeader.vue'
</script>

<template>
  <main class="page">
    <PageHeader title="Page not found" />
    <div class="empty">
      <p>This page doesn't exist.</p>
      <RouterLink :to="{ name: 'home' }" class="link-button">Go home</RouterLink>
    </div>
  </main>
</template>
