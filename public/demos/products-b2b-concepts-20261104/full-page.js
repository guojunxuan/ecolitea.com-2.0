// This simulation only adds a presentation layer inside its own preview iframe.
// The application DOM is preserved, and no Payload data or source files are changed.
const frame = document.getElementById('page')
const status = document.getElementById('status')
const ab = document.getElementById('ab')
const original = document.getElementById('original')
const restore = document.getElementById('restore')
let mode = 'ab'
let navigationObserver

function element(doc, tag, className, text) {
  const node = doc.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function link(doc, href, label, className, template) {
  // Copy the actual site's button classes instead of inventing another button.
  const node = template ? template.cloneNode(false) : doc.createElement('a')
  if (!template) node.className = className
  else node.classList.add(className)
  node.href = href
  node.removeAttribute('id')
  node.textContent = label
  return node
}

function media(doc, image, className, fit) {
  const wrapper = element(doc, 'span', className)
  if (!image) return wrapper
  const copy = image.cloneNode(false)
  copy.removeAttribute('style')
  copy.removeAttribute('class')
  copy.loading = 'lazy'
  copy.decoding = 'async'
  wrapper.append(copy)
  if (fit === 'auto') {
    const update = () => {
      wrapper.dataset.fit = copy.naturalWidth / copy.naturalHeight > 1.3 ? 'cover' : 'contain'
    }
    copy.addEventListener('load', update, { once: true })
    if (copy.complete && copy.naturalWidth) update()
  } else wrapper.dataset.fit = fit
  return wrapper
}

function product(card) {
  // Preserve the current ProductCard markup, Media and CSS Modules verbatim.
  const copy = card.cloneNode(true)
  copy.setAttribute('data-simulation-product', '')
  const sourceImages = [...card.querySelectorAll('img')]
  copy.querySelectorAll('img').forEach((image, index) => {
    const source = sourceImages[index]
    // React clears Next Image's temporary blur style after the original loads.
    // Mirror that public style update rather than freezing a loading placeholder.
    const sync = () => {
      image.style.cssText = source.style.cssText
      if (source.complete && !source.style.backgroundImage) observer.disconnect()
    }
    const observer = new MutationObserver(sync)
    observer.observe(source, { attributes: true, attributeFilter: ['style'] })
    source.loading = 'eager'
    sync()
  })
  return copy
}

function category(doc, section) {
  const originals = [...section.children]
  const cards = [...section.querySelectorAll('[data-product-card]')]
  const button = section.querySelector('[data-product-band-actions] a')
  const information = button?.closest('[data-website-theme]')
  const title = information?.querySelector('h2')?.textContent || ''
  const description = information?.querySelector('p')?.textContent || ''
  const categoryHref = button?.getAttribute('href')
  if (!title || !categoryHref) return false
  const root = element(doc, 'div', 'sim-block')
  root.setAttribute('data-products-simulation', '')
  root.setAttribute('data-website-theme', 'default')
  const container = element(doc, 'div', 'sim-container')
  const feature = element(doc, 'div', 'sim-feature')
  const featureLink = element(doc, 'a', 'sim-feature-media')
  featureLink.href = categoryHref
  featureLink.append(media(doc, information.querySelector('img'), 'sim-feature-picture', 'auto'))
  const featureCopy = element(doc, 'div', 'sim-feature-copy')
  const text = element(doc, 'div')
  text.append(element(doc, 'h2', 'sim-feature-title', title))
  if (description) text.append(element(doc, 'p', 'sim-feature-summary', description))
  const actions = element(doc, 'div', 'sim-feature-actions')
  actions.append(link(doc, categoryHref, 'View More', 'sim-category-button', button))
  featureCopy.append(text, actions)
  feature.append(featureLink, featureCopy)
  container.append(feature)

  if (cards.length) {
    // The original overview is already sorted by publishedAt descending.
    // Include its first product again: the large panel now represents the category.
    const latest = cards.slice(0, 4)
    const productsHeading = element(doc, 'div', 'sim-products-heading')
    productsHeading.append(element(doc, 'h3', 'website-type-heading-3', 'Latest Products'))
    const grid = element(doc, 'ul', 'sim-grid')
    grid.setAttribute('aria-label', `${title} Latest Products`)
    latest.forEach((card) => {
      const item = element(doc, 'li', 'sim-grid-item')
      item.append(product(card))
      grid.append(item)
    })
    container.append(productsHeading, grid)
  }
  root.append(container)
  originals.forEach((child) => child.setAttribute('data-simulation-original', ''))
  section.setAttribute('data-simulation-section', '')
  section.append(root)
  return true
}

function applyMode() {
  const doc = frame.contentDocument
  if (!doc?.querySelector('[data-products-simulation]')) return
  doc.body.classList.toggle('products-simulation-enabled', mode === 'ab')
  ab.setAttribute('aria-pressed', String(mode === 'ab'))
  original.setAttribute('aria-pressed', String(mode === 'original'))
  document.body.dataset.previewMode = mode
}

function navigationReady(doc, sections) {
  // iframe load can precede React hydration. AnchorNav's existing effect sets
  // the sections' public scroll margin after hydration; wait for that signal.
  if (!sections.length || sections[0].style.scrollMarginTop) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!sections[0].style.scrollMarginTop) return
      clearTimeout(timeout)
      observer.disconnect()
      doc.defaultView.requestAnimationFrame(resolve)
    })
    const timeout = setTimeout(() => {
      observer.disconnect()
      reject(new Error('The original category navigation is not ready.'))
    }, 15000)
    observer.observe(sections[0], { attributes: true, attributeFilter: ['style'] })
  })
}

frame.addEventListener('load', async () => {
  navigationObserver?.disconnect()
  document.body.dataset.previewReady = 'loading'
  ab.disabled = original.disabled = true
  const doc = frame.contentDocument
  const carousel = doc?.getElementById('product-category-carousel')
  if (!carousel) {
    document.body.dataset.previewReady = 'content'
    status.textContent = '当前已打开内容页面'
    ab.disabled = original.disabled = true
    restore.style.display = 'inline-flex'
    return
  }
  const root = carousel.parentElement
  const sections = [...root.querySelectorAll(':scope > section[id]')]
  const stylesheet = doc.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = '/demos/products-b2b-concepts-20261104/full-page.css?revision=desktop-image'
  const loaded = new Promise((resolve, reject) => {
    stylesheet.onload = resolve
    stylesheet.onerror = reject
  })
  doc.head.append(stylesheet)
  try {
    await loaded
    await navigationReady(doc, sections)
    const count = sections.filter((section) => category(doc, section)).length
    applyMode()
    ab.disabled = original.disabled = false
    restore.style.display = 'none'
    status.textContent = `${count} 个分类 · 当前页面内容`
    document.body.dataset.previewReady = 'true'
    navigationObserver = new MutationObserver(() => {
      if (!root.isConnected) {
        document.body.dataset.previewReady = 'content'
        status.textContent = '当前已打开内容页面'
        ab.disabled = original.disabled = true
        restore.style.display = 'inline-flex'
        navigationObserver.disconnect()
      }
    })
    navigationObserver.observe(doc.getElementById('main-content'), {
      childList: true,
      subtree: true,
    })
  } catch {
    status.textContent = '仿真样式未加载，当前展示原版'
    document.body.dataset.previewReady = 'error'
  }
})

function switchMode(next) {
  mode = next
  applyMode()
}
ab.addEventListener('click', () => switchMode('ab'))
original.addEventListener('click', () => switchMode('original'))
restore.addEventListener('click', () => {
  document.body.dataset.previewReady = 'loading'
  frame.src = '/products'
})
document.getElementById('collapse').addEventListener('click', (event) => {
  const tools = document.querySelector('.preview-tools')
  const compact = tools.classList.toggle('compact')
  event.currentTarget.textContent = compact ? '预览工具' : '收起'
  event.currentTarget.setAttribute('aria-label', compact ? '展开预览工具' : '收起预览工具')
  event.currentTarget.setAttribute('aria-expanded', String(!compact))
})
frame.src = '/products'
