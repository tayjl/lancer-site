<script setup lang="ts">
import { ref } from 'vue'
import { HEX } from '../pilotColour'

// The pilot's colour (decoration only, see src/pilotColour.ts): a hex box and a colour picker. "preview" fires while
// you drag the picker, so the sheet shows it at once; "save" fires when you let go or leave the box.
// "preview" gets null when you stop previewing (a saved or reset colour is the page's own value again).
const props = defineProps<{ colour: string | null }>()
const emit = defineEmits<{ preview: [colour: string | null]; save: [colour: string | null] }>()

const error = ref('')

function commit(value: string) {
  const text = value.trim()
  if (text && !HEX.test(text)) {
    error.value = 'Use a colour like #1c9ae8.'
    return
  }
  error.value = ''
  emit('preview', null)
  emit('save', text ? text.toLowerCase() : null)
}
</script>

<template>
  <div class="colour-field">
    <!-- Reset sits beside the boxes rather than under them, outside the label so the label names only the hex box. -->
    <div class="line">
      <label class="field">
        <span>Colour</span>
        <span class="row">
          <input
            class="code"
            type="text"
            spellcheck="false"
            autocomplete="off"
            placeholder="#1c9ae8"
            maxlength="7"
            :value="colour ?? ''"
            :aria-invalid="!!error"
            @change="commit(($event.target as HTMLInputElement).value)"
          />
          <input
            type="color"
            aria-label="Pick a colour"
            :value="colour && HEX.test(colour) ? colour : '#808080'"
            @input="emit('preview', ($event.target as HTMLInputElement).value)"
            @change="commit(($event.target as HTMLInputElement).value)"
          />
        </span>
      </label>
      <button v-if="props.colour" type="button" class="quiet" @click="commit('')">Reset colour</button>
    </div>
    <p v-if="error" class="error" role="alert">Not saved: {{ error }}</p>
  </div>
</template>

<style scoped>
.colour-field {
  display: grid;
  gap: var(--space-xs);
}

/* The button is full height (not .small), so lined up at the bottom it sits level with the boxes. */
.line {
  display: flex;
  align-items: flex-end;
  gap: var(--space-s);
}

.field {
  flex: 1;
  min-width: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-s);
}

.row input[type='text'] {
  flex: 1;
  min-width: 0;
}

.row input[type='color'] {
  flex: none;
  width: var(--tap);
  min-height: var(--tap);
  height: var(--tap);
  padding: 2px;
  cursor: pointer;
}

.error {
  margin: 0;
  color: var(--danger);
  font-size: var(--fs-s);
}
</style>
