<script setup lang="ts">
// The identity details as a filled-in form: a labelled cell each (age, gender, sexuality, height, weight, eyes, hair),
// text while read-only, a field while editable (saved when you leave it). "fields" is [column, label]; "values" the card.
defineProps<{ fields: readonly (readonly [string, string])[]; values: Record<string, unknown>; editable: boolean }>()
const emit = defineEmits<{ save: [column: string, event: Event] }>()
</script>

<template>
  <dl class="form">
    <div v-for="[column, label] in fields" :key="column" class="cell">
      <dt><label v-if="editable" :for="`identity-${column}`">{{ label }}</label><template v-else>{{ label }}</template></dt>
      <dd>
        <input v-if="editable" :id="`identity-${column}`" type="text" :value="values[column] ?? ''" @change="emit('save', column, $event)" />
        <template v-else>{{ values[column] ?? '–' }}</template>
      </dd>
    </div>
  </dl>
</template>

<style scoped>
/* Seven cells in a row on wide screens, four then three under it, two to a row on phones: the last one widens to fill
   the row, so there is never a ragged empty cell. */
.form {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--rule);
}

.cell {
  display: grid;
  align-content: start;
  gap: 2px;
  padding: var(--space-s) var(--space-m) var(--space-m);
  background: var(--panel);
}

dt {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

dd {
  min-width: 0;
  margin: 0;
  font-size: var(--fs-m);
  overflow-wrap: anywhere;
}

dd input {
  width: 100%;
  min-width: 0;
}

@media (max-width: 80rem) {
  .form {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .cell:last-child {
    grid-column: span 2;
  }
}

@media (max-width: 56rem) {
  .form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cell:last-child {
    grid-column: span 2;
  }
}
</style>
