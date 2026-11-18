<script setup lang="ts">
import { sourceOf, type Item } from '../gameData'
import { itemInfo } from '../info'
import Icon from './Icon.vue'
import InfoButton from './InfoButton.vue'
import ItemBody from './ItemBody.vue'

// A weapon's mod, at the end of its card (BuildItem.vue), on the card's own surface under a thin rule: the mod's name
// (opening its full information) and system points, then what ItemBody shows, and its own source line when its pack
// isn't the weapon's ("weaponSource"). While "editable" it has Swap and Remove; with no mod it's one slim row: a quiet
// Add mod, or, when the weapon takes none, "refusal" (why not). "mod" arrives with the Limited bonus applied
// (src/equipment.ts).
defineProps<{ mod?: Item; editable: boolean; refusal?: string; weaponSource?: string }>()
const emit = defineEmits<{ pick: []; remove: [] }>()
</script>

<template>
  <section class="mod" aria-label="Weapon mod">
    <template v-if="mod">
      <header class="mod-head">
        <span class="mod-icon"><Icon name="mod" /></span>
        <h4 class="mod-name"><InfoButton :info="() => itemInfo(mod!)" :label="mod.name" /></h4>
        <span v-if="mod.sp" class="mod-sp"><span class="num">{{ mod.sp }}</span><span class="unit">SP</span></span>
      </header>
      <ItemBody :item="mod" />
      <p v-if="sourceOf(mod.id) && sourceOf(mod.id) !== weaponSource" class="pack-source">Source: {{ sourceOf(mod.id) }}</p>
      <div v-if="editable" class="mod-foot">
        <button type="button" class="small" @click="emit('pick')">Swap mod</button>
        <button type="button" class="small quiet" @click="emit('remove')">Remove mod</button>
      </div>
    </template>
    <p v-else-if="refusal" class="dim">{{ refusal }}.</p>
    <div v-else class="mod-add">
      <button type="button" class="small quiet" @click="emit('pick')"><Icon name="mod" />Add mod</button>
    </div>
  </section>
</template>

<style scoped>
.mod {
  display: grid;
  gap: var(--space-m);
  padding-top: var(--space-m);
  border-top: 1px solid var(--rule);
}

.mod-head {
  display: flex;
  align-items: center;
  gap: var(--space-s);
}

/* Mods are system-family gear, so the mod's symbol wears the system colour. */
.mod-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius);
  background: var(--type-system);
  color: #fff;
  font-size: 16px;
}

.mod-name {
  min-width: 0;
  margin: 0;
  font-size: var(--fs-m);
  overflow-wrap: anywhere;
}

.mod-sp {
  margin-left: auto;
  font-size: var(--fs-s);
  font-weight: 700;
  white-space: nowrap;
}

.unit {
  margin-left: 3px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.85;
}

.mod-foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
}

.dim,
.pack-source {
  margin: 0;
}

.mod-add .icon {
  width: 16px;
  height: 16px;
}
</style>
