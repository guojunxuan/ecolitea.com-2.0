// UI draft over the real page: retain React nodes, media, links, and native controls.
// Related actions reuse a native card-action template; Payload is never written.
const frame = document.getElementById('page')
const status = document.getElementById('status')
const design = document.getElementById('design')
const original = document.getElementById('original')
const restore = document.getElementById('restore')
const overview = document.getElementById('overview')
const category = document.getElementById('category')
const detail = document.getElementById('detail')
let enabled = true
let observer
let focusRequested = true
let refreshFrame = 0
let categoryHref = ''
let detailHref = ''
let actionTemplate
let initialView = new URLSearchParams(location.search).get('view')

function pageKind(doc) {
  const path = doc.defaultView.location.pathname
  if (/^\/products\/?$/.test(path)) return 'overview'
  return /^\/products\/[^/]+(?:\/page\/\d+)?\/?$/.test(path) ? 'category' : 'detail'
}

function markCarousel(track, kind) {
  if (!track) return
  const viewport = track.parentElement
  viewport.dataset.threeCarousel = kind
  viewport.querySelectorAll(':scope > button').forEach((button, index) => {
    button.dataset.threeArrow = index === 0 ? 'previous' : 'next'
  })
  const section = viewport.parentElement
  if (kind === 'ranges' || section.hasAttribute('data-three-related')) {
    section.setAttribute('data-three-section', '')
    const header = section.firstElementChild
    header.setAttribute('data-three-section-header', '')
    header.querySelector('h2')?.parentElement.setAttribute('data-three-section-heading', '')
    header.querySelector('.website-type-eyebrow')?.setAttribute('data-three-section-eyebrow', '')
    const link = header.querySelector(':scope > a')
    link?.setAttribute('data-three-section-link', '')
    if (link && !link.querySelector('[data-three-link-chevron]')) {
      const chevron = link.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg')
      chevron.setAttribute('data-three-link-chevron', '')
      chevron.setAttribute('aria-hidden', 'true')
      chevron.setAttribute('focusable', 'false')
      chevron.setAttribute('viewBox', '0 0 16 19')
      chevron.setAttribute('width', '16')
      chevron.setAttribute('height', '19')
      const path = link.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute(
        'd',
        'M10.5224 9.74237C10.5285 9.73077 10.5386 9.72104 10.5439 9.70907C10.6498 9.49501 10.6152 9.23305 10.4277 9.0609L6.17769 5.15357C6.06639 5.05124 5.91783 4.99608 5.7647 5.00022C5.61156 5.00436 5.46638 5.06746 5.36111 5.17565C5.25584 5.28383 5.19909 5.42823 5.20335 5.57709C5.20761 5.72595 5.27253 5.86706 5.38382 5.96939L9.19722 9.47592L5.39884 13.0345C5.28856 13.1378 5.22503 13.2795 5.22221 13.4283C5.2194 13.5772 5.27753 13.721 5.38382 13.8282C5.49012 13.9354 5.63587 13.9972 5.789 13.9999C5.94214 14.0026 6.09013 13.9461 6.2004 13.8428L10.4119 9.89731C10.42 9.88945 10.4231 9.87859 10.4311 9.87036C10.4373 9.86475 10.4438 9.86063 10.45 9.85464C10.4827 9.82134 10.5001 9.78055 10.5224 9.74237Z',
      )
      path.setAttribute('fill', '#0052D1')
      chevron.append(path)
      link.append(chevron)
    }
  }
  if (kind === 'ranges') {
    track.querySelectorAll('[data-product-category-card]').forEach((card) => {
      card.setAttribute('data-three-range-card', '')
      card.firstElementChild.setAttribute('data-three-range-cover', '')
      card.lastElementChild.setAttribute('data-three-range-caption', '')
    })
  }
}

function refresh() {
  const doc = frame.contentDocument
  if (!doc) return
  const kind = pageKind(doc)
  if (kind === 'category' && doc.querySelector('[data-product-preview]')) return
  if (kind === 'overview' && !doc.getElementById('product-category-carousel')) return
  const roots = kind === 'overview' ? [...doc.querySelectorAll('[data-product-preview]')] : []
  const relatedTrack =
    kind === 'detail' ? doc.querySelector('#related-products [role="region"]') : null
  const cardRoot = kind === 'detail' ? relatedTrack : doc
  const cards = [...(cardRoot?.querySelectorAll('[data-product-card]') || [])]
  if (kind !== 'detail' && cards.length) {
    detailHref = cards[0].getAttribute('href') || detailHref
    const action = cards[0].querySelector('[data-product-card-action]')
    if (action) actionTemplate = action.parentElement.cloneNode(true)
  }
  if (kind === 'overview')
    categoryHref =
      roots[0]?.querySelector('[data-product-view-more]')?.getAttribute('href') || categoryHref
  overview.setAttribute('aria-pressed', String(kind === 'overview'))
  category.setAttribute('aria-pressed', String(kind === 'category'))
  detail.setAttribute('aria-pressed', String(kind === 'detail'))
  overview.disabled = false
  category.disabled = !categoryHref
  detail.disabled = !detailHref
  design.disabled = original.disabled = !cards.length
  restore.hidden = kind !== 'detail'
  const applied = Boolean(
    doc.querySelector('[data-product-layout="three"], [data-product-carousel]'),
  )
  doc.body.classList.toggle('three-card-preview', !applied && enabled && cards.length > 0)
  doc.body.classList.toggle(
    'three-card-category-preview',
    !applied && enabled && kind === 'category',
  )
  if (!cards.length) {
    status.textContent = kind === 'detail' ? '此详情页暂无关联产品，保留原页面' : '等待产品内容…'
    document.body.dataset.previewReady = kind === 'detail' ? 'content' : 'loading'
    return
  }
  if (applied) {
    design.disabled = original.disabled = true
    status.textContent = '已应用正式页面 · 三页卡片与轮播保持一致'
    document.body.dataset.previewReady = 'true'
    if (focusRequested) {
      focusRequested = false
      const target = roots[0] || relatedTrack || cards[0]
      doc.fonts.ready.then(() => target.scrollIntoView({ block: 'center', behavior: 'instant' }))
    }
    return
  }
  cards.forEach((card) => {
    card.firstElementChild.setAttribute('data-three-cover', '')
    if (kind === 'category') card.parentElement.setAttribute('data-three-category-grid', '')
  })
  roots.forEach((root) => {
    const products = [...root.querySelectorAll('[data-product-card]')]
    root.dataset.threeCount = String(Math.min(products.length, 3))
    markCarousel(root.querySelector('[role="region"]'), 'products')
    root
      .querySelector('[data-product-view-more]')
      ?.firstElementChild.setAttribute('data-three-more-icon', '')
  })
  if (kind === 'category') {
    doc.querySelectorAll('[role="region"]:has([data-product-category-card])').forEach((track) => {
      markCarousel(track, 'ranges')
    })
  }
  if (relatedTrack) {
    relatedTrack.parentElement.parentElement.setAttribute('data-three-related', '')
    markCarousel(relatedTrack, 'products')
    if (enabled && actionTemplate) {
      cards.forEach((card) => {
        if (card.querySelector('[data-product-card-action]')) return
        const action = doc.importNode(actionTemplate, true)
        action.setAttribute('data-three-added-action', '')
        card.lastElementChild.append(action)
      })
    }
  }
  design.setAttribute('aria-pressed', String(enabled))
  original.setAttribute('aria-pressed', String(!enabled))
  status.textContent = enabled
    ? kind === 'overview'
      ? '总览 · 三卡与两侧延伸 · 箭头向内容外侧让位'
      : kind === 'category'
        ? '分类页 · 同款产品卡片 · 探索轮播箭头向外让位'
        : '详情页 · 关联产品与总览同款卡片、按钮及轮播箭头'
    : '当前正式版 · 原始卡片数量与比例'
  document.body.dataset.previewReady = 'true'
  if (focusRequested) {
    focusRequested = false
    const target = roots[0] || relatedTrack || cards[0]
    doc.fonts.ready.then(() => target.scrollIntoView({ block: 'center', behavior: 'instant' }))
  }
}

function navigate(kind) {
  const doc = frame.contentDocument
  const href = kind === 'overview' ? '/products' : kind === 'category' ? categoryHref : detailHref
  if (!href) return
  focusRequested = true
  if (pageKind(doc) === kind) {
    refresh()
    return
  }
  document.body.dataset.previewReady = 'loading'
  const link = [...doc.querySelectorAll('a[href]')].find((a) => a.getAttribute('href') === href)
  if (link) link.click()
  else frame.src = href
}

function queueRefresh() {
  const win = frame.contentWindow
  if (refreshFrame) return
  refreshFrame = win.requestAnimationFrame(() => {
    refreshFrame = 0
    refresh()
  })
}

async function waitForNavigation(doc) {
  if (doc.defaultView.location.pathname !== '/products') return
  const section = doc.querySelector('main section[id][aria-labelledby]')
  if (!section || section.style.scrollMarginTop) return
  await new Promise((resolve, reject) => {
    const watcher = new MutationObserver(() => {
      if (!section.style.scrollMarginTop) return
      clearTimeout(timeout)
      watcher.disconnect()
      resolve()
    })
    const timeout = setTimeout(() => {
      watcher.disconnect()
      reject(new Error('Navigation hydration timed out'))
    }, 15000)
    watcher.observe(section, { attributes: true, attributeFilter: ['style'] })
  })
}

frame.addEventListener('load', async () => {
  observer?.disconnect()
  refreshFrame = 0
  document.body.dataset.previewReady = 'loading'
  const doc = frame.contentDocument
  const css = doc.createElement('link')
  css.rel = 'stylesheet'
  css.href = '/demos/products-three-cards-20261107/preview.css?revision=svg-chevron'
  const loaded = new Promise((resolve, reject) => {
    css.onload = resolve
    css.onerror = reject
  })
  doc.head.append(css)
  try {
    await loaded
    await waitForNavigation(doc)
    observer = new MutationObserver(queueRefresh)
    observer.observe(doc.getElementById('main-content'), { childList: true, subtree: true })
    refresh()
    if ((initialView === 'category' && categoryHref) || (initialView === 'detail' && detailHref)) {
      const destination = initialView
      initialView = ''
      navigate(destination)
    }
  } catch {
    document.body.dataset.previewReady = 'error'
    status.textContent = '预览未加载，请刷新重试'
  }
})

function setMode(value) {
  enabled = value
  focusRequested = true
  frame.contentDocument
    ?.querySelectorAll('[data-three-carousel] [role="region"]')
    .forEach((track) => {
      track.scrollLeft = 0
    })
  refresh()
}

design.addEventListener('click', () => setMode(true))
original.addEventListener('click', () => setMode(false))
overview.addEventListener('click', () => navigate('overview'))
category.addEventListener('click', () => navigate('category'))
detail.addEventListener('click', () => navigate('detail'))
restore.addEventListener('click', () => {
  focusRequested = true
  frame.src = '/products'
})
document.getElementById('collapse').addEventListener('click', (event) => {
  const compact = document.querySelector('.tools').classList.toggle('compact')
  event.currentTarget.textContent = compact ? '预览工具' : '收起'
  event.currentTarget.setAttribute('aria-expanded', String(!compact))
})
frame.src = '/products'
