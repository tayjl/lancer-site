<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

// A picker dialog for one loadout slot (or the frame): a searchable list of options, each with a short
// summary and a button to choose it. "blocked" on an option disables it and says why (e.g. "over limit").
// The parent opens it with open(), saves the choice itself, then closes it with close().
type Option = { id: string; name: string; meta?: string; text?: string; blocked?: string }
const props = defineProps<{ title: string; options: Option[]; current?: string | null; saving?: boolean; error?: string }>()
const emit = defineEmits<{ choose: [id: string] }>()

const dialog = useTemplateRef('dialog')
const filter = ref('')

const shown = computed(() => {
  const words = filter.value.trim().toLowerCase()
  return props.options.filter((option) => !words || `${option.name} ${option.meta ?? ''}`.toLowerCase().includes(words))
})

function open() {
  filter.value = ''
  dialog.value?.showModal()
}

defineExpose({ open, close: () => dialog.value?.close() })
</script>

<template>
  <dialog ref="dialog" class="picker" :aria-label="title">
    <header class="picker-head">
      <h3>{{ title }}</h3>
      <button type="button" @click="dialog?.close()">cancel</button>
    </header>
    <input v-model="filter" type="text" :aria-label="`search: ${title}`" placeholder="search..." />
    <p v-if="error" class="rose" role="alert">{{ error }}</p>

    <ul v-if="shown.length" class="options">
      <li v-for="option in shown" :key="option.id">
        <div>
          <span class="name">{{ option.name }}</span>
          <span v-if="option.meta" class="dim meta">{{ option.meta }}</span>
          <span v-if="option.text" class="text">{{ option.text }}</span>
        </div>
        <button v-if="option.id === current" type="button" disabled>chosen</button>
        <button v-else type="button" :disabled="saving || !!option.blocked" @click="emit('choose', option.id)">
          {{ option.blocked || 'choose' }}
        </button>
      </li>
    </ul>
    <p v-else class="dim">nothing to choose from{{ filter ? ' with that search' : ' yet: the content packs may not be imported' }}.</p>
  </dialog>
</template>

<style scoped>
.picker {
  width: min(44rem, calc(100vw - 2rem));
  max-height: 80vh;
  padding: 1rem;
  border: 1px solid var(--lilac);
  background: var(--void);
  color: var(--text);
  font: 400 0.9375rem/1.6 var(--mono);
}

.picker::backdrop {
  background: rgb(0 0 0 / 0.6);
}

.picker-head {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.picker-head h3 {
  margin: 0;
  font-size: 1rem;
}

.picker-head button {
  margin-left: auto;
  padding: 0;
  font-size: 0.875rem;
}

.picker p {
  margin: 0.75rem 0 0;
}

.options {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}

.options li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0;
  border-top: 1px solid var(--rule);
}

.name {
  display: block;
  color: var(--lilac);
  font-weight: 700;
}

.meta {
  display: block;
  font-size: 0.75rem;
}

.text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  color: var(--text-dim);
  font: 400 0.875rem/1.45 var(--read);
}

.options button {
  flex-shrink: 0;
  max-width: 45%;
  padding: 0;
  font-size: 0.8125rem;
}

.options button:disabled {
  color: var(--text-dim);
  cursor: default;
}
</style>
