// Shared by the login screen's log and the in-app chat panel, so both chats look the same.
// A chat line is "username: message", optionally starting with "[ MOD ]" or "[ ADMIN ]".
// Ban notices are wrapped in "// ... //". Inside a message, @mentions are sky blue (like usernames)
// and <SYSTEM MESSAGES> in angle brackets are lilac. ChatLine.vue draws a parsed line.

export type ChatPart = { text: string; tone?: string }
export type ChatLine = { tone?: string; tag?: string; tagTone?: string; user?: string; parts: ChatPart[] }

// The capturing group makes split() keep the mentions and system messages as their own pieces.
function messageParts(text: string): ChatPart[] {
  return text
    .split(/(@[^\s.,!?:;]+|<[^<>]+>)/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('@')) return { text: part, tone: 'user' }
      if (part.startsWith('<')) return { text: part, tone: 'lilac' }
      return { text: part }
    })
}

export function parseChat(file: string): ChatLine[] {
  return file
    .replace(/\r/g, '')
    .trimEnd()
    .split('\n')
    .map((line) => {
      if (/^\/\/.*\/\/$/.test(line)) return { tone: 'rose', parts: [{ text: line }] }
      // The tag and username keep their trailing spaces, because Vue would trim a space typed into the template.
      const [, tag = '', rank = '', user = '', text = ''] = line.match(/^(\[ (MOD|ADMIN) \] ?)?([^\s:]+: ?)?(.*)$/)!
      return { tag, tagTone: rank === 'MOD' ? 'lilac' : 'rose', user, parts: messageParts(text) }
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
