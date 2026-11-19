<script setup lang="ts">
import { ref } from 'vue'
import { useSaveStatus } from '../saveStatus'
import Icon from './Icon.vue'
import SaveStatus from './SaveStatus.vue'

// The backstory's privacy, in its panel's head: Private (the default) or Public (every logged-in user can read it). It saves
// at once, with its own status. "canChange" is the pilot's own player or a GM editing; everyone else sees the state only.
const props = defineProps<{ isPublic: boolean; canChange: boolean; set: (makePublic: boolean) => Promise<string | null> }>()
const status = useSaveStatus()
const wanted = ref(false)

async function choose(makePublic: boolean) {
  if (makePublic === props.isPublic || status.saving.value) return
  wanted.value = makePublic
  await status.track(props.set(makePublic))
}
</script>

<template>
  <div class="visibility">
    <div v-if="canChange" class="seg" role="group" aria-label="Backstory visibility">
      <button type="button" :aria-pressed="!isPublic" :disabled="status.saving.value" @click="choose(false)"><Icon name="lock" />Private</button>
      <button type="button" :aria-pressed="isPublic" :disabled="status.saving.value" @click="choose(true)">Public</button>
    </div>
    <span v-else-if="!isPublic" class="private">Private</span>
    <span v-else class="state dim">Public</span>
    <SaveStatus :saving="status.saving.value" :saved="status.saved.value" :error="status.error.value" :can-retry="true" @retry="choose(wanted)" />
    <span v-if="isPublic" class="hint dim">Everyone logged in can read this.</span>
  </div>
</template>

<style scoped>
.visibility {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs) var(--space-m);
  margin-left: auto;
}

.seg {
  display: inline-flex;
  border: 1px solid var(--edge);
  border-radius: var(--radius);
  overflow: hidden;
}

.seg button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--tap);
  padding: 0 var(--space-m);
  border: 0;
  border-radius: 0;
  background: none;
  color: var(--text-dim);
}

.seg button + button {
  border-left: 1px solid var(--edge);
}

.seg button[aria-pressed='true'] {
  background: color-mix(in srgb, var(--lilac) 14%, transparent);
  color: var(--lilac);
}

.state,
.hint {
  font-size: var(--fs-s);
}
</style>
