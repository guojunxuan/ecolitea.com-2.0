// Design preview only. Product cards and images are the real React-rendered nodes.
// Nothing is saved to Payload, and the production page/source remains unchanged.
const frame = document.getElementById('page')
const status = document.getElementById('status')
const preview = document.getElementById('preview')
const original = document.getElementById('original')
const restore = document.getElementById('restore')
const scenario = document.getElementById('scenario')
let layoutCount = new URLSearchParams(location.search).get('count') || 'actual'
if (!['actual', '1', '2', '3', '4'].includes(layoutCount)) layoutCount = 'actual'
scenario.value = layoutCount
let enabled = true
let refresh = []
let observer

function node(doc, tag, className, text) {
  const result = doc.createElement(tag)
  result.className = className
  if (text) result.textContent = text
  return result
}

function addRail(doc, section, templates) {
  const track = section.querySelector('ul')
  const firstCard = track?.querySelector('[data-product-card]')
  const categoryLink = [...section.querySelectorAll('a')].find((a) => a.textContent === 'View More')
  const title = section.querySelector('h2')?.textContent
  if (!firstCard || !categoryLink || !title) return false

  const rail = node(doc, 'div', `${templates.next.parentElement.className} sim-rail`)
  track.before(rail)
  rail.append(track)
  track.classList.add('sim-track')
  track.tabIndex = 0
  track.setAttribute('aria-label', `${title} · Latest Products`)
  const item = node(doc, 'li', 'sim-more-item')
  const more = node(doc, 'a', `${firstCard.className} sim-more-card`)
  more.href = categoryLink.getAttribute('href')
  more.dataset.simMore = ''
  more.setAttribute('aria-label', `View More · ${title}`)
  const icon = node(doc, 'span', 'sim-more-icon')
  icon.setAttribute('aria-hidden', 'true')
  icon.append(templates.next.querySelector('svg').cloneNode(true))
  more.append(icon, node(doc, 'span', 'website-type-title sim-more-label', 'View More'))
  item.append(more)
  track.append(item)

  const controls = ['previous', 'next'].map((direction) => {
    const button = templates[direction].cloneNode(true)
    button.dataset.simArrow = direction
    button.removeAttribute('id')
    button.setAttribute(
      'aria-label',
      `${direction === 'next' ? 'Next' : 'Previous'} products in ${title}`,
    )
    button.addEventListener('click', () => move(direction === 'next' ? 1 : -1))
    rail.append(button)
    return button
  })
  const update = () => {
    const scrollable = track.scrollWidth > track.clientWidth + 2
    rail.toggleAttribute('data-scrollable', scrollable)
    track.tabIndex =
      enabled && scrollable && !doc.defaultView.matchMedia('(width < 48rem)').matches ? 0 : -1
    controls[0].hidden = track.scrollLeft < 2
    controls[1].hidden = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2
  }
  const move = (direction) => {
    const step =
      track.firstElementChild.getBoundingClientRect().width +
      parseFloat(getComputedStyle(track).gap)
    track.scrollBy({
      left: step * direction,
      behavior: doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
  }
  track.addEventListener('scroll', update, { passive: true })
  doc.defaultView.addEventListener('resize', update)
  track.addEventListener('keydown', (event) => {
    if (
      track.tabIndex < 0 ||
      event.target !== track ||
      !['ArrowLeft', 'ArrowRight'].includes(event.key)
    )
      return
    event.preventDefault()
    move(event.key === 'ArrowLeft' ? -1 : 1)
  })
  track.addEventListener('dragstart', (event) => {
    if (track.tabIndex === 0) event.preventDefault()
  })
  let pointer
  let draggedAt = 0
  track.addEventListener('pointerdown', (event) => {
    if (track.tabIndex < 0 || event.pointerType !== 'mouse' || event.button !== 0) return
    pointer = { id: event.pointerId, x: event.clientX, scroll: track.scrollLeft, dragging: false }
  })
  track.addEventListener('pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return
    const distance = event.clientX - pointer.x
    if (!pointer.dragging && Math.abs(distance) > 6) {
      pointer.dragging = true
      track.setPointerCapture(event.pointerId)
      track.classList.add('is-dragging')
    }
    if (!pointer.dragging) return
    event.preventDefault()
    track.scrollLeft = pointer.scroll - distance
  })
  const finish = (event) => {
    if (!pointer || pointer.id !== event.pointerId) return
    if (pointer.dragging) draggedAt = Date.now()
    pointer = null
    track.classList.remove('is-dragging')
  }
  track.addEventListener('pointerup', finish)
  track.addEventListener('pointercancel', finish)
  rail.addEventListener(
    'click',
    (event) => {
      if (Date.now() - draggedAt < 200) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    true,
  )
  refresh.push(update)
  update()
  return true
}

function applyMode() {
  const doc = frame.contentDocument
  if (!doc?.querySelector('.sim-rail')) return
  doc.body.classList.toggle('products-rail-preview', enabled)
  doc.querySelectorAll('.sim-rail').forEach((rail, railIndex) => {
    const products = [...rail.querySelector('ul').children].filter((li) =>
      li.querySelector('[data-product-card]'),
    )
    const count =
      railIndex === 0 && layoutCount !== 'actual'
        ? Math.min(Number(layoutCount), products.length)
        : products.length
    rail.dataset.simCount = String(count)
    products.forEach((li, index) => li.toggleAttribute('data-sim-excluded', index >= count))
  })
  preview.setAttribute('aria-pressed', String(enabled))
  original.setAttribute('aria-pressed', String(!enabled))
  scenario.disabled = !enabled
  status.textContent =
    layoutCount === 'actual'
      ? `${doc.querySelectorAll('.sim-rail').length} 个分类 · 当前内容`
      : `首分类：最多 ${layoutCount} 款布局示例`
  if (!enabled)
    doc.querySelectorAll('.sim-track').forEach((track) => {
      track.scrollLeft = 0
    })
  doc.defaultView.requestAnimationFrame(() => refresh.forEach((update) => update()))
}

async function hydrated(doc, sections) {
  if (!sections.length || sections[0].style.scrollMarginTop) return
  await new Promise((resolve, reject) => {
    const watcher = new MutationObserver(() => {
      if (!sections[0].style.scrollMarginTop) return
      clearTimeout(timeout)
      watcher.disconnect()
      resolve()
    })
    const timeout = setTimeout(() => {
      watcher.disconnect()
      reject(new Error('Page hydration timed out'))
    }, 15000)
    watcher.observe(sections[0], { attributes: true, attributeFilter: ['style'] })
  })
}

frame.addEventListener('load', async () => {
  observer?.disconnect()
  refresh = []
  document.body.dataset.previewReady = 'loading'
  preview.disabled = original.disabled = scenario.disabled = true
  const doc = frame.contentDocument
  const carousel = doc?.getElementById('product-category-carousel')
  if (!carousel) {
    document.body.dataset.previewReady = 'content'
    status.textContent = '已进入分类或产品页'
    restore.style.display = 'inline-flex'
    return
  }
  const root = carousel.parentElement
  const sections = [...root.querySelectorAll(':scope > section[id]')]
  const stylesheet = doc.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = '/demos/products-carousel-20261106/preview.css?revision=fewer-products'
  const loaded = new Promise((resolve, reject) => {
    stylesheet.onload = resolve
    stylesheet.onerror = reject
  })
  doc.head.append(stylesheet)
  try {
    await loaded
    await hydrated(doc, sections)
    const templates = {
      previous: carousel.querySelector('button[aria-label="Previous items"]'),
      next: carousel.querySelector('button[aria-label="Next items"]'),
    }
    if (!templates.previous || !templates.next) throw new Error('Missing site controls')
    sections.forEach((section) => addRail(doc, section, templates))
    applyMode()
    preview.disabled = original.disabled = false
    restore.style.display = 'none'
    document.body.dataset.previewReady = 'true'
    if (new URLSearchParams(location.search).get('focus') === 'more') {
      await doc.fonts.ready
      const firstTrack = doc.querySelector('.sim-track')
      firstTrack.scrollLeft = firstTrack.scrollWidth
      firstTrack.parentElement.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
    observer = new MutationObserver(() => {
      if (!root.isConnected) {
        preview.disabled = original.disabled = scenario.disabled = true
        restore.style.display = 'inline-flex'
        status.textContent = '已进入分类或产品页'
        document.body.dataset.previewReady = 'content'
        observer.disconnect()
      }
    })
    observer.observe(doc.getElementById('main-content'), { childList: true, subtree: true })
  } catch {
    status.textContent = 'UI 稿未加载，请刷新重试'
    document.body.dataset.previewReady = 'error'
  }
})

preview.addEventListener('click', () => {
  enabled = true
  applyMode()
})
original.addEventListener('click', () => {
  enabled = false
  applyMode()
})
scenario.addEventListener('change', () => {
  layoutCount = scenario.value
  const url = new URL(location.href)
  if (layoutCount === 'actual') url.searchParams.delete('count')
  else url.searchParams.set('count', layoutCount)
  history.replaceState(null, '', url)
  applyMode()
  frame.contentWindow.requestAnimationFrame(() => {
    const first = frame.contentDocument.querySelector('.sim-track')
    first.scrollLeft = 0
    first.parentElement.scrollIntoView({ block: 'center', behavior: 'instant' })
  })
})
restore.addEventListener('click', () => {
  frame.src = '/products'
})
document.getElementById('collapse').addEventListener('click', (event) => {
  const compact = document.querySelector('.tools').classList.toggle('compact')
  event.currentTarget.textContent = compact ? '预览工具' : '收起'
  event.currentTarget.setAttribute('aria-label', compact ? '展开预览工具' : '收起预览工具')
  event.currentTarget.setAttribute('aria-expanded', String(!compact))
})
frame.src = '/products'
