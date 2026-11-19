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
})
