<script setup lang="ts">
import { computed } from 'vue'
import { groupPicks, type PickOption } from '../pickerRows'
import Icon from './Icon.vue'
import InfoButton from './InfoButton.vue'
import ItemStats from './ItemStats.vue'
import MechImage from './MechImage.vue'
import RadarChart from './RadarChart.vue'

// The options of a picker dialog (ItemPicker.vue, LoadoutBox.vue's biomod picker): a box per manufacturer where the
// options have one (logo, id and name in the header, the colour only on the logo and a 3px top border), then a row
// each. A row is visual: the kind's symbol on its type colour (a frame's picture, or a tiny radar without one), the name (opening its full
// information), a strip of symbols and mono numbers, a few chips. The button comes in through the "action" slot.
// Something that can't be chosen is dimmed.
const props = defineProps<{ options: PickOption[]; current?: string | number | null }>()
const boxes = computed(() => groupPicks(props.options, props.current))
const blocked = (option: PickOption) => !!option.blocked && option.id !== props.current
const lines = (meta: PickOption['meta']) => [meta ?? ''].flat().filter(Boolean)
</script>

<template>
  <section v-for="box in boxes" :key="box.group?.key ?? ''" class="pick-box" :class="{ branded: box.group }" :style="box.group ? { '--mf': box.group.colour } : undefined">
    <header v-if="box.group" class="pick-box-head">
      <Icon v-if="box.group.logo" :src="box.group.logo" class="pick-logo" />
      <h3>{{ box.group.title }}</h3>
      <span v-if="box.group.name" class="dim pick-maker">{{ box.group.name }}</span>
      <span class="num dim pick-count">{{ box.options.length }}</span>
    </header>
    <ul class="pick-list">
      <li v-for="option in box.options" :key="option.id" :class="{ blocked: blocked(option), picked: option.picked }">
        <span v-if="option.art" class="pick-art art"><MechImage size="pick" :art="option.art" :art-alt="`${option.name} frame`" /></span>
        <span v-else-if="option.radar" class="pick-art"><RadarChart :axes="option.radar" :summary="`${option.name}: ${option.radar.map((axis) => `${axis.label} ${axis.value}`).join(', ')}`" mini /></span>
        <span v-else-if="option.look" class="pick-icon" :class="option.look.type"><Icon :name="option.look.icon" /></span>
        <div class="pick-about">
          <span class="pick-name"><InfoButton v-if="option.info" :info="option.info" :label="option.name" /><template v-else>{{ option.name }}</template></span>
          <ItemStats v-if="option.stats?.length" :stats="option.stats" compact />
          <ul v-if="option.chips?.length" class="chips pick-chips">
            <li v-for="(chip, i) in option.chips" :key="i" class="chip"><Icon v-if="chip.icon" :name="chip.icon" />{{ chip.label }}</li>
          </ul>
          <span v-if="Array.isArray(option.meta) && lines(option.meta).length" class="pick-meta sep"><span v-for="fact in lines(option.meta)" :key="fact">{{ fact }}</span></span>
          <span v-else-if="option.meta" class="pick-meta pick-line">{{ option.meta }}</span>
          <span v-if="option.text" class="pick-text">{{ option.text }}</span>
        </div>
        <div class="pick-action"><slot name="action" :option="option" /></div>
      </li>
    </ul>
  </section>
</template>
