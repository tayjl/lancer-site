// Mockup behaviour only: marks the section being read in the index, the phone menu and the tab-row fade cue.
const links = [...document.querySelectorAll('.index a')]
const index = document.querySelector('.index')
const row = index.querySelector('ol')
const sections = links.map((a) => document.querySelector(a.getAttribute('href')))

const mark = (id) => {
  links.forEach((a) => a.setAttribute('aria-current', a.getAttribute('href') === `#${id}`))
  const on = links.find((a) => a.getAttribute('href') === `#${id}`)
  if (on) { // scroll the row only when the current item would be off-screen
    const a = on.getBoundingClientRect(), r = row.getBoundingClientRect()
    if (a.left < r.left + 16) row.scrollBy({ left: a.left - r.left - 16, behavior: 'smooth' })
    else if (a.right > r.right - 16) row.scrollBy({ left: a.right - r.right + 16, behavior: 'smooth' })
  }
}
// The current section is the last one whose top has passed a line a little below the sticky bars.
const update = () => {
  const line = innerHeight * 0.3
  let current = sections[0]
  sections.forEach((s) => { if (s.getBoundingClientRect().top <= line) current = s })
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = sections.at(-1) // the last section can never reach the line
  mark(current.id)
}
addEventListener('scroll', update, { passive: true })
update()

const markEnd = () => index.toggleAttribute('data-end', row.scrollLeft + row.clientWidth >= row.scrollWidth - 2)
row.addEventListener('scroll', markEnd, { passive: true })
addEventListener('resize', markEnd)
markEnd()

const menu = document.querySelector('[data-menu]')
menu.addEventListener('click', () => {
  const open = document.getElementById('drawer').classList.toggle('open')
  menu.setAttribute('aria-expanded', open)
})

// ?y=1200 scrolls to that offset on load, for screenshots and review links.
const y = Number(new URLSearchParams(location.search).get('y'))
if (y) addEventListener('load', () => { scrollTo(0, y); update() })
