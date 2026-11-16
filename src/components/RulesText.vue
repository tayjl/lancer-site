<script lang="ts">
import { defineComponent, h, type VNodeArrayChildren } from 'vue'
import { paragraphs, parseRules, type RulesNode } from '../rulesText'

// LANCER rules text with its formatting (lists, bold, line breaks), drawn from parseRules' safe data, never
// as raw HTML; top-level line breaks become paragraphs (paragraphs()). Styled by .rules-text in style.css.
const draw = (nodes: RulesNode[]): VNodeArrayChildren =>
  nodes.map((node) => (typeof node === 'string' ? node : h(node.tag, draw(node.children))))

export default defineComponent({
  props: { html: { type: String, required: true } },
  setup(props) {
    return () => h('div', { class: 'rules-text' }, draw(paragraphs(parseRules(props.html))))
  },
})
</script>
