<script setup lang="ts">
import { ref, watch } from 'vue'
import { parseRaw, type Data } from '../../contentEditor'
import Icon from '../Icon.vue'
import FoldPanel from './FoldPanel.vue'
import { latest } from './useFields'

// The item's data as JSON, for everything the form has no field for (and for every kind that has no form yet). It edits the
// same object as the form: what you type here shows in the form and the preview as soon as it's valid JSON, and the
// form's changes appear here. While the JSON is broken the last good data stays, and "error" says why (Save is blocked).
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
const emit = defineEmits<{ error: [message: string] }>()

const pretty = (value: Data) => JSON.stringify(value, null, 2)
const text = ref(pretty(model.value))
const error = ref('')
watch(error, (message) => emit('error', message), { immediate: true })

// The form changed the data: show it here, unless this box already says the same (so typing isn't reformatted).
watch(model, (value) => {
  const parsed = parseRaw(text.value)
  if (!('value' in parsed) || JSON.stringify(parsed.value) !== JSON.stringify(value)) {
    text.value = pretty(value)
    error.value = ''
  }
})

function input(event: Event) {
  text.value = (event.target as HTMLTextAreaElement).value
  const parsed = parseRaw(text.value)
  error.value = 'error' in parsed ? parsed.error : ''
  if ('value' in parsed) model.value = parsed.value
}
</script>

<template>
  <!-- Always starts folded, at the bottom of the form. -->
  <FoldPanel title="Advanced: raw data" summary="JSON" forget>
    <textarea
      class="code"
      rows="16"
      spellcheck="false"
      aria-label="Raw data (JSON)"
      :value="text"
      :aria-invalid="!!error"
      aria-describedby="raw-error"
      @input="input"
    ></textarea>
    <p v-if="error" id="raw-error" class="err" role="alert"><Icon name="warning" /><span><b>Error:</b> {{ error }}</span></p>
  </FoldPanel>
</template>

<style scoped>
textarea {
  width: 100%;
  min-height: 12rem;
  font-family: var(--mono);
  font-size: var(--fs-s);
  line-height: 1.5;
  resize: vertical;
  tab-size: 2;
}

textarea[aria-invalid='true'] {
  border-color: var(--danger);
}
</style>
