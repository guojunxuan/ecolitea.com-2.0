// Design-only layer over the real page. No application files or Payload data change.
// The visual button is a span inside the existing product link: no nested controls.
const frame = document.getElementById('page')
const status = document.getElementById('status')
const overview = document.getElementById('overview')
const category = document.getElementById('category')
const design = document.getElementById('design')
const original = document.getElementById('original')
let enabled = true
let buttonClasses = ''
let categoryHref = ''
let siteStyles = []
let observer
let refreshFrame = 0
let initialCategory = new URLSearchParams(location.search).get('view') === 'category'
let focusRequested = true

function systemDefaultClasses(doc) {
  const template = doc.querySelector('a[data-slot="button"]')
  if (!template) throw new Error('Missing native system button')
  // Use the real default Button appearance; only its width changes in the mockup.
  return template.className
}

function pageKind(doc) {
  const path = doc.defaultView.location.pathname
  if (path === '/products' || path === '/products/') return 'overview'
  return /^\/products\/[^/]+(?:\/page\/\d+)?\/?$/.test(path) ? 'category' : 'detail'
}

function refresh() {
  const doc = frame.contentDocument
  if (!doc) return
  const kind = pageKind(doc)
  // Route changes can update history before the old content has been replaced.
  if (kind === 'category' && doc.querySelector('[data-product-preview]')) return
  if (kind === 'overview' && !doc.getElementById('product-category-carousel')) return
  overview.setAttribute('aria-pressed', String(kind === 'overview'))
  category.setAttribute('aria-pressed', String(kind === 'category'))
  doc.body.classList.toggle('product-card-actions-preview', enabled && kind !== 'detail')
  design.setAttribute('aria-pressed', String(enabled))
  original.setAttribute('aria-pressed', String(!enabled))
  overview.disabled = false
  category.disabled = !categoryHref
  design.disabled = original.disabled = kind === 'detail'
  if (kind === 'detail') {
    status.textContent = '已进入产品详情，可切换回总览或分类页'
    document.body.dataset.previewReady = 'detail'
    return
  }
  const cards = [...doc.querySelectorAll('[data-product-card]')]
  if (!cards.length || !buttonClasses) return
  const applied = cards.every((card) => card.querySelector('[data-product-card-action]'))
  design.disabled = original.disabled = applied
  cards
    .filter(
      (card) =>
        !card.hasAttribute('data-sim-card-decorated') &&
        !card.querySelector('[data-product-card-action]'),
    )
    .forEach((card) => {
      const wrapper = doc.createElement('span')
      wrapper.className = 'sim-card-actions'
      const action = doc.createElement('span')
      action.className = `${buttonClasses} sim-card-action`
      action.textContent = 'View More'
      action.dataset.simCardAction = ''
      wrapper.append(action)
      card.lastElementChild.append(wrapper)
      card.setAttribute('data-sim-card-decorated', '')
    })
  status.textContent = `${kind === 'overview' ? '总览' : '分类页'} · ${
    applied ? '已应用到正式页面' : enabled ? '整宽按钮 · 系统黑色' : '当前正式版'
  }`
  document.body.dataset.previewReady = 'true'
  if (focusRequested) {
    focusRequested = false
    const target = kind === 'overview' ? doc.querySelector('[data-product-preview]') : cards[0]
    doc.fonts.ready.then(() => target?.scrollIntoView({ block: 'center', behavior: 'instant' }))
  }
}

function navigate(kind) {
  const doc = frame.contentDocument
  const href = kind === 'overview' ? '/products' : categoryHref
  if (!href) return
  if (pageKind(doc) === kind) {
    focusRequested = true
    refresh()
    return
  }
  focusRequested = true
  document.body.dataset.previewReady = 'loading'
  const link = [...doc.querySelectorAll('a[href]')].find((a) => a.getAttribute('href') === href)
  if (link) link.click()
  else frame.src = href
}

async function navigationReady(doc) {
  const section = doc.querySelector('main section[id][aria-labelledby]')
  if (!doc.getElementById('product-category-carousel') || !section || section.style.scrollMarginTop)
    return
  await new Promise((resolve, reject) => {
    const watcher = new MutationObserver(() => {
      if (!section.style.scrollMarginTop) return
      clearTimeout(timeout)
      watcher.disconnect()
      resolve()
    })
    const timeout = setTimeout(() => {
      watcher.disconnect()
      reject(new Error('Original navigation is not ready'))
    }, 15000)
    watcher.observe(section, { attributes: true, attributeFilter: ['style'] })
  })
}

frame.addEventListener('load', async () => {
  observer?.disconnect()
  if (refreshFrame) frame.contentWindow.cancelAnimationFrame(refreshFrame)
  refreshFrame = 0
  document.body.dataset.previewReady = 'loading'
  const doc = frame.contentDocument
  if (!doc) return
  const stylesheet = doc.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = '/demos/product-card-actions-20261106/preview.css?revision=system-black'
  const loaded = new Promise((resolve, reject) => {
    stylesheet.onload = resolve
    stylesheet.onerror = reject
  })
  doc.head.append(stylesheet)
  try {
    await loaded
    await navigationReady(doc)
    if (pageKind(doc) === 'overview') {
      buttonClasses = systemDefaultClasses(doc)
      categoryHref =
        doc.querySelector('#product-category-carousel a')?.getAttribute('href') || categoryHref
      siteStyles = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href)
    } else {
      // Carry the site's native button module across a full-document fallback.
      const present = new Set(
        [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href),
      )
      siteStyles
        .filter((href) => !present.has(href))
        .forEach((href) => {
          const link = doc.createElement('link')
          link.rel = 'stylesheet'
          link.href = href
          doc.head.append(link)
        })
    }
    observer = new MutationObserver(() => {
      if (refreshFrame) return
      refreshFrame = doc.defaultView.requestAnimationFrame(() => {
        refreshFrame = 0
        refresh()
      })
    })
    observer.observe(doc.getElementById('main-content'), { childList: true, subtree: true })
    refresh()
    if (initialCategory) {
      initialCategory = false
      navigate('category')
    }
  } catch {
    status.textContent = '预览未加载，请刷新重试'
    document.body.dataset.previewReady = 'error'
  }
})

overview.addEventListener('click', () => navigate('overview'))
category.addEventListener('click', () => navigate('category'))
design.addEventListener('click', () => {
  enabled = true
  refresh()
})
original.addEventListener('click', () => {
  enabled = false
  refresh()
})
document.getElementById('collapse').addEventListener('click', (event) => {
  const compact = document.querySelector('.tools').classList.toggle('compact')
  event.currentTarget.textContent = compact ? '预览工具' : '收起'
  event.currentTarget.setAttribute('aria-expanded', String(!compact))
  event.currentTarget.setAttribute('aria-label', compact ? '展开预览工具' : '收起预览工具')
})
frame.src = '/products'
