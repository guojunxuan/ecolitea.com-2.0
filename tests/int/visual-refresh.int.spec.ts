import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { auditCss } from '../helpers/cssAudit'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('visual refresh contracts', () => {
  it('underlines only inline body links on hover', () => {
    const titleLinkModules = [
      'src/components/Card/index.module.css',
      'src/components/Products/OverflowCarousel/index.module.css',
      'src/components/TableOfContents/index.module.css',
      'src/blocks/RelatedBlogs/Component.module.css',
      'src/Footer/index.module.css',
      'src/components/BlogCategoryTabs/index.module.css',
      'src/components/Products/AnchorNav/index.module.css',
      'src/components/Products/CategoryCard/index.module.css',
      'src/components/Products/CategoryCarousel/index.module.css',
      'src/components/Products/ProductCard/index.module.css',
      'src/components/Products/ProductPreviewGrid/index.module.css',
    ]
    for (const file of titleLinkModules) {
      expect(read(file), file).not.toMatch(/:hover[^{]*\{[^}]*text-decoration(-line)?:\s*underline/s)
    }
    expect(read('src/styles/base.css')).not.toMatch(/(^|\s)a:hover\s*\{[^}]*underline/s)
    expect(auditCss(read('src/styles/content.css')).declarations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          header: '&:where(a)',
          prop: 'text-decoration',
          value: 'underline',
          ancestors: expect.arrayContaining([expect.stringContaining('.payload-richtext')]),
        }),
      ]),
    )
  })

  it('removes content-layer shadows, lift and archive stagger', () => {
    const card = read('src/components/Card/index.module.css')
    expect(card).not.toMatch(/var\(--website-shadow-(subtle|raised)\)/)
    expect(card).not.toMatch(/translate(Y)?\(\s*-2px/)
    expect(card).toMatch(/scale\(1\.03\)/)
    expect(read('src/components/CollectionArchive/index.module.css')).not.toMatch(/animation|@keyframes/)
  })
  it('keeps the production category chip on blog cards', () => {
    const card = read('src/components/Card/index.module.css')
    expect(card).toMatch(/background-color:\s*var\(--website-color-category-background\)/)
    expect(card).toMatch(/background-color:\s*var\(--website-color-category-hover-background\)/)
  })
  it('uses solid surfaces for article tools and eyebrow for their labels', () => {
    for (const file of ['src/components/TableOfContents/index.module.css', 'src/components/BlogCategoryTabs/index.module.css']) {
      const css = read(file)
      expect(css, file).not.toMatch(/backdrop-filter/)
      expect(css, file).not.toMatch(/var\(--website-shadow-subtle\)/)
    }
    for (const file of ['src/components/TableOfContents/index.module.css', 'src/components/ArticleShare/index.module.css']) {
      const css = read(file)
      expect(css, file).not.toMatch(/text-transform:\s*uppercase/)
      expect(css, file).not.toMatch(/letter-spacing:/)
      expect(css, file).toMatch(/website-type-eyebrow/)
    }
  })

  it('keeps product cards flat and dialogs on the overlay shadow', () => {
    for (const file of ['src/components/Products/ProductCard/index.module.css', 'src/components/Products/ProductPreviewGrid/index.module.css']) {
      expect(read(file), file).not.toMatch(/var\(--website-shadow-(subtle|raised)\)/)
    }
    for (const file of ['src/components/Products/ProductActions/DownloadDialog.module.css']) {
      const css = read(file)
      expect(css, file).toMatch(/var\(--website-shadow-overlay\)/)
      expect(css, file).toMatch(/var\(--website-radius-panel\)/)
    }
  })
  it('groups accordion items and rotates the plus icon', () => {
    const css = read('src/collections/Products/blocks/MediaAccordion/Component.module.css')
    expect(css).toMatch(/background(-color)?:\s*var\(--website-color-muted-surface\)/)
    expect(css).toMatch(/border-radius:\s*var\(--website-radius-content\)/)
    expect(css).toMatch(/\[aria-expanded=['"]?true['"]?\][^{]*\{[^}]*rotate\(45deg\)/s)
  })
  it('shows entrance content in its final state unless motion is ready', () => {
    const css = read('src/collections/Products/blocks/shared/Entrance.module.css')
    expect(css).toMatch(/\[data-motion=['"]?ready['"]?\]/)
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/)
  })
  it('uses tabular numerals for specification values', () => {
    expect(read('src/components/Products/ProductSpecifications/index.module.css')).toMatch(/tabular-nums|'tnum'/)
  })

  it('maps hero literal font sizes to roles', () => {
    for (const file of ['src/heros/PostHero/index.module.css', 'src/heros/BlogHero/index.module.css', 'src/heros/BlogListingHero/index.module.css', 'src/blocks/RelatedBlogs/Component.module.css']) {
      expect(read(file), file).not.toMatch(/font-size:\s*(clamp\(|[0-9.]+(px|rem))/)
    }
  })

  it('puts a token-driven scrim behind inverse photo slide copy', () => {
    const css = read('src/heros/ProductListingHero/index.module.css')
    expect(css).toMatch(/\.slide\[data-website-theme='inverse'\][^{]*::after[^{]*\{[^}]*linear-gradient/s)
  })
})
