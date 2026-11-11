const sections = await (await fetch('../mobile-toc/content.json')).json()

document.getElementById('article').innerHTML = sections
  .map((s) => `<h${s.level} id="${s.id}">${s.text}</h${s.level}>${s.body.map((p) => `<p>${p}</p>`).join('')}`)
  .join('')

const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const headings = sections.map((s) => document.getElementById(s.id))
let activeId = sections[0].id

/** One TOC instance: a list, its rail indicator, and a temporary "preview" target (hover / press). */
const createToc = (track) => {
  const list = track.querySelector('[data-list]')
  const indicator = track.querySelector('.indicator')
  list.innerHTML = sections
    .map((s) => `<li class="l${s.level}"><a href="#${s.id}">${s.text}</a></li>`)
    .join('')
  const links = [...list.querySelectorAll('a')]
  const linkFor = (id) => links.find((link) => link.hash === `#${id}`)
  let preview = null

  const place = (link, instant = false) => {
    if (!link || !track.offsetParent) return
    indicator.classList.toggle('instant', instant || reduced.matches)
    indicator.style.transform = `translateY(${link.offsetTop}px)`
    indicator.style.height = `${link.offsetHeight}px`
    if (instant) {
      void indicator.offsetHeight
      indicator.classList.remove('instant')
    }
  }
  const sync = (instant) => place(preview ?? linkFor(activeId), instant)

  return {
    links,
    linkFor,
    sync,
    place,
    setActive(id) {
      for (const link of links) {
        if (link.hash === `#${id}`) link.setAttribute('aria-current', 'location')
        else link.removeAttribute('aria-current')
      }
      sync()
    },
    setPreview(link) {
      preview = link
      sync()
    },
  }
}

const [mobileTrack, desktopTrack] = document.querySelectorAll('[data-track]')
const mobile = createToc(mobileTrack)
const desktop = createToc(desktopTrack)
const desktopScroll = document.querySelector('[data-scroll]')
const current = document.getElementById('current')

/* Desktop: indicator follows hover and keyboard focus, then returns to the active section. */
for (const link of desktop.links) {
  link.addEventListener('pointerenter', () => desktop.setPreview(link))
  link.addEventListener('focus', () => desktop.setPreview(link))
  link.addEventListener('blur', () => desktop.setPreview(null))
}
desktopTrack.addEventListener('pointerleave', () => desktop.setPreview(null))

const keepDesktopActiveVisible = () => {
  const link = desktop.linkFor(activeId)
  if (!link || !desktopScroll.offsetParent) return
  const box = desktopScroll.getBoundingClientRect()
  const row = link.getBoundingClientRect()
  if (row.top < box.top + 12) desktopScroll.scrollTop += row.top - box.top - 12
  else if (row.bottom > box.bottom - 12) desktopScroll.scrollTop += row.bottom - box.bottom + 12
}

/* Scroll spy shared by both instances. */
const updateActive = () => {
  const line = innerHeight * 0.3
  const passed = headings.filter((h) => h.getBoundingClientRect().top <= line)
  const id = (passed.at(-1) ?? headings[0]).id
  if (id === activeId && current.textContent) return
  activeId = id
  current.textContent = sections.find((s) => s.id === id).text
  mobile.setActive(id)
  desktop.setActive(id)
  keepDesktopActiveVisible()
}
let frame = 0
addEventListener('scroll', () => {
  if (!frame) frame = requestAnimationFrame(() => ((frame = 0), updateActive()))
}, { passive: true })
addEventListener('resize', () => {
  desktop.sync(true)
  mobile.sync(true)
  if (matchMedia('(min-width: 64rem)').matches) close()
})
updateActive()
desktop.sync(true)

/* Mobile dropdown with scrim. */
const root = document.getElementById('mobile-toc')
const trigger = document.getElementById('trigger')
const panel = document.getElementById('panel')

const open = () => {
  panel.hidden = false
  root.classList.add('open')
  trigger.setAttribute('aria-expanded', 'true')
  const link = mobile.linkFor(activeId)
  // Current section sits in the upper third; the indicator slides in from the top of the view.
  panel.scrollTop = Math.max(0, link.offsetTop - panel.clientHeight * 0.25)
  mobile.place({ offsetTop: panel.scrollTop, offsetHeight: link.offsetHeight }, true)
  requestAnimationFrame(() => mobile.sync())
}
function close({ focus = false } = {}) {
  if (panel.hidden) return
  panel.hidden = true
  root.classList.remove('open')
  trigger.setAttribute('aria-expanded', 'false')
  mobile.setPreview(null)
  if (focus) trigger.focus()
}
trigger.addEventListener('click', () => (panel.hidden ? open() : close()))
document.getElementById('scrim').addEventListener('click', () => close())
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') close({ focus: true })
})

/* Touch press mirrors desktop hover; scrolling the panel or sliding off cancels it. */
let pressed = null
let hoverPoint = null
const release = () => {
  pressed?.classList.remove('pressed')
  pressed = null
  mobile.setPreview(null)
}
const previewAt = ({ x, y }) => {
  const target = document.elementFromPoint(x, y)?.closest('#panel .list a')
  mobile.setPreview(target && panel.contains(target) ? target : null)
}
for (const link of mobile.links) {
  link.addEventListener('pointerenter', (event) => {
    hoverPoint = { x: event.clientX, y: event.clientY }
    if (!pressed) mobile.setPreview(link)
  })
  link.addEventListener('focus', () => mobile.setPreview(link))
  link.addEventListener('blur', () => mobile.setPreview(null))
}
mobileTrack.addEventListener('pointerdown', (event) => {
  const link = event.target.closest('a')
  if (!link) return
  pressed = link
  link.classList.add('pressed')
  mobile.setPreview(link)
})
mobileTrack.addEventListener('pointercancel', release)
mobileTrack.addEventListener('pointerleave', () => {
  hoverPoint = null
  release()
})
panel.addEventListener('pointermove', (event) => {
  hoverPoint = { x: event.clientX, y: event.clientY }
  if (!pressed) previewAt(hoverPoint)
})
panel.addEventListener('scroll', () => {
  if (pressed) release()
  else if (hoverPoint) previewAt(hoverPoint)
}, { passive: true })
mobileTrack.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return
  release()
  close()
})
