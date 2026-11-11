async (page) => {
  const origin = 'http://127.0.0.1:47711'
  const requests = []
  page.on('request', request => { if (request.url().includes('.png')) requests.push(request.url()) })
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort())
  const results = []
  for (const width of [1280, 390, 768, 767]) {
    for (const variant of width === 1280 || width === 390 ? ['override', 'fallback', 'mobile-only', 'text-only', 'light'] : ['override']) {
      const start = requests.length
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${origin}/?case=${variant}`)
      await page.waitForLoadState('networkidle')
      const result = await page.evaluate(() => {
        const img = document.querySelector('img')
        return {
          heading: document.querySelector('h1')?.textContent,
          src: img?.currentSrc || null,
          focalPoint: img ? getComputedStyle(img).objectPosition : null,
          theme: document.querySelector('[data-header-theme]')?.getAttribute('data-header-theme'),
          images: document.querySelectorAll('img').length,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        }
      })
      const expectedSource = variant === 'text-only' ? null : variant === 'mobile-only' || (width < 768 && variant !== 'fallback') ? 'mobile.png' : 'desktop.png'
      if (result.heading !== 'Stories from the field' || result.overflow) throw new Error(`Layout failed: ${JSON.stringify(result)}`)
      if (expectedSource ? !result.src?.includes(expectedSource) || result.images !== 1 : result.images !== 0) throw new Error(`Source failed: ${JSON.stringify(result)}`)
      if (expectedSource && result.focalPoint !== (expectedSource === 'mobile.png' ? '70% 50%' : '30% 50%')) throw new Error(`Focal point failed: ${JSON.stringify(result)}`)
      if (result.theme !== (variant === 'light' ? 'light' : 'dark')) throw new Error(`Theme failed: ${JSON.stringify(result)}`)
      const downloaded = requests.slice(start)
      if (expectedSource && downloaded.some(url => !url.includes(expectedSource))) throw new Error(`Wrong breakpoint download: ${JSON.stringify(downloaded)}`)
      results.push({ width, variant, ...result, downloaded })
      if (variant === 'override' && (width === 1280 || width === 390)) await page.screenshot({ path: `/Users/jason/ecolitea.com 2.0/output/playwright/settings-hero-consistency/blog-${width}.png` })
    }
  }
  return { checks: results.length, results }
}
