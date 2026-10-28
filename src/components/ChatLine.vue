<script setup lang="ts">
import type { ChatLine } from '../chat'

// One chat message's coloured parts. Kept on one line, because chat text keeps spaces exactly as written.
defineProps<{ line: ChatLine }>()
</script>

<template>
  <span v-if="line.tag" :class="line.tagTone">{{ line.tag }}</span><span v-if="line.user" class="user">{{ line.user }}</span>{{ line.text }}
</template>
