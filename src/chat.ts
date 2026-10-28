// Shared by the login screen's log and the in-app chat panel, so both chats look the same.
// A chat line is "username: message", optionally starting with "[ MOD ]" or "[ ADMIN ]".
// Ban notices are wrapped in "// ... //". ChatLine.vue draws a parsed line.

export type ChatLine = { text: string; tone?: string; tag?: string; tagTone?: string; user?: string }

export function parseChat(file: string): ChatLine[] {
  return file
    .replace(/\r/g, '')
    .trimEnd()
    .split('\n')
    .map((line) => {
      if (/^\/\/.*\/\/$/.test(line)) return { text: line, tone: 'rose' }
      // The tag and username keep their trailing spaces, because Vue would trim a space typed into the template.
      const [, tag = '', rank = '', user = '', text = ''] = line.match(/^(\[ (MOD|ADMIN) \] ?)?([^\s:]+: ?)?(.*)$/)!
      return { tag, tagTone: rank === 'MOD' ? 'lilac' : 'rose', user, text }
    })
}

// For "tail"-style boxes, where old lines drop off the top: a long message that wraps can have its
// first line cut off, leaving a fragment. This hides any message that's partly off the top.
export function hideCutLines(box: HTMLElement | null | undefined) {
  if (!box) return
  const top = box.getBoundingClientRect().top
  for (const line of box.querySelectorAll('p')) {
    line.style.visibility = line.getBoundingClientRect().top < top - 1 ? 'hidden' : ''
  }
}
