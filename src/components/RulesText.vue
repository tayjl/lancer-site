<script lang="ts">
import { defineComponent, h, type VNodeArrayChildren } from 'vue'
import Icon from './Icon.vue'
import { GAME_ICONS } from '../richTextSafe'
import { firstLine, paragraphs, parseRules, type RulesNode } from '../rulesText'

// LANCER rules text with its formatting (lists, bold, line breaks), drawn from parseRules' safe data, never
// as raw HTML; top-level line breaks become paragraphs (paragraphs()). Styled by .rules-text in style.css.
const draw = (nodes: RulesNode[]): VNodeArrayChildren =>
  nodes.map((node) => {
    if (typeof node === 'string') return node
    if (node.tag === 'icon') return h('span', { role: 'img', style: { display: 'inline-flex', verticalAlign: '-0.125em' }, 'aria-label': GAME_ICONS.find((icon) => icon.name === node.name)?.label }, h(Icon, { name: node.name }))
    if (node.tag === 'span') return h('span', { class: node.glitch ? 'glitch' : undefined, style: { fontSize: node.size, color: node.color } }, draw(node.children))
    return h(node.tag, draw(node.children))
  })

export default defineComponent({
  props: { html: { type: String, required: true }, firstLineOnly: Boolean },
  setup(props) {
    return () => h('div', { class: 'rules-text' }, draw(props.firstLineOnly ? firstLine(parseRules(props.html)) : paragraphs(parseRules(props.html))))
  },
})
</script>
