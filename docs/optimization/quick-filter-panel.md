# 快速筛选面板实施方案

Dropped 2026-10-07 — see docs/superpowers/plans/2026-10-07-blog-listing-simplification.md

## 目标
在博客列表页添加侧边筛选面板，支持多维度快速筛选博客内容。

## 当前问题
- 只能按分类筛选，维度单一
- 无法按作者、日期、标签组合筛选
- 高级筛选需求无法满足

## 技术方案

### 筛选维度设计

#### 1. 分类（Category）
- 单选
- 与现有分类 tabs 联动

#### 2. 作者（Authors）
- 多选
- 支持博客多作者

#### 3. 发布日期（Date Range）
- 预设范围：Last 7 days, Last 30 days, Last 3 months, Last year
- 自定义日期范围

#### 4. 标签（Tags，可选）
- 多选
- 需要先在 Blog collection 添加 tags 字段

#### 5. 排序（Sort）
- 最新发布（默认）
- 最早发布
- 标题 A-Z
- 标题 Z-A

---

### 实施步骤

#### 第一步：扩展 Blog Collection（可选）

如果需要标签功能，先添加 tags 字段：

文件：`src/collections/Blogs/index.ts`

```typescript
{
  name: 'tags',
  type: 'array',
  label: 'Tags',
  admin: {
    description: 'Add tags to categorize your blog post',
  },
  fields: [
    {
      name: 'tag',
      type: 'text',
      required: true,
    },
  ],
}
```

---

#### 第二步：创建筛选面板组件

文件：`src/components/BlogFilterPanel/index.tsx`

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { BlogCategory, User } from '@/payload-types'
import styles from './index.module.css'

export interface BlogFilterPanelProps {
  categories: BlogCategory[]
  authors: User[]
  availableTags?: string[]
}

interface FilterState {
  category: string | null
  authors: string[]
  dateRange: 'all' | '7d' | '30d' | '3m' | '1y' | 'custom'
  dateFrom: string
  dateTo: string
  tags: string[]
  sort: 'newest' | 'oldest' | 'title-asc' | 'title-desc'
}

export function BlogFilterPanel({
  categories,
  authors,
  availableTags = [],
}: BlogFilterPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<FilterState>({
    category: searchParams.get('category'),
    authors: searchParams.getAll('author'),
    dateRange: (searchParams.get('dateRange') as FilterState['dateRange']) || 'all',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    tags: searchParams.getAll('tag'),
    sort: (searchParams.get('sort') as FilterState['sort']) || 'newest',
  })

  const [isOpen, setIsOpen] = useState(false)

  // 应用筛选
  const applyFilters = () => {
    const params = new URLSearchParams()

    if (filters.category) params.set('category', filters.category)
    filters.authors.forEach((author) => params.append('author', author))
    if (filters.dateRange !== 'all') params.set('dateRange', filters.dateRange)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    filters.tags.forEach((tag) => params.append('tag', tag))
    if (filters.sort !== 'newest') params.set('sort', filters.sort)

    router.push(`/blogs?${params.toString()}`)
    setIsOpen(false)
  }

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      category: null,
      authors: [],
      dateRange: 'all',
      dateFrom: '',
      dateTo: '',
      tags: [],
      sort: 'newest',
    })
    router.push('/blogs')
    setIsOpen(false)
  }

  // 计算活跃筛选器数量
  const activeFilterCount =
    (filters.category ? 1 : 0) +
    filters.authors.length +
    (filters.dateRange !== 'all' ? 1 : 0) +
    filters.tags.length +
    (filters.sort !== 'newest' ? 1 : 0)

  return (
    <>
      {/* 移动端触发按钮 */}
      <button
        className={styles.mobileTrigger}
        onClick={() => setIsOpen(true)}
        aria-label="Open filters"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M3 6h14M6 10h8M8 14h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className={styles.badge}>{activeFilterCount}</span>
        )}
      </button>

      {/* 筛选面板 */}
      <aside
        className={`${styles.panel} ${isOpen ? styles.open : ''}`}
        aria-label="Blog filters"
      >
        {/* 头部 */}
        <div className={styles.header}>
          <h2 className={styles.title}>Filters</h2>
          <button
            className={styles.close}
            onClick={() => setIsOpen(false)}
            aria-label="Close filters"
          >
            ×
          </button>
        </div>

        {/* 筛选内容 */}
        <div className={styles.content}>
          {/* 分类 */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Category</h3>
            <div className={styles.radioGroup}>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="category"
                  checked={!filters.category}
                  onChange={() => setFilters({ ...filters, category: null })}
                />
                <span>All Categories</span>
              </label>
              {categories.map((cat) => (
                <label key={cat.id} className={styles.radio}>
                  <input
                    type="radio"
                    name="category"
                    checked={filters.category === cat.slug}
                    onChange={() =>
                      setFilters({ ...filters, category: cat.slug || null })
                    }
                  />
                  <span>{cat.title}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 作者 */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Authors</h3>
            <div className={styles.checkboxGroup}>
              {authors.map((author) => (
                <label key={author.id} className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={filters.authors.includes(author.id)}
                    onChange={(e) => {
                      const newAuthors = e.target.checked
                        ? [...filters.authors, author.id]
                        : filters.authors.filter((id) => id !== author.id)
                      setFilters({ ...filters, authors: newAuthors })
                    }}
                  />
                  <span>{author.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 日期范围 */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Date Range</h3>
            <select
              className={styles.select}
              value={filters.dateRange}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dateRange: e.target.value as FilterState['dateRange'],
                })
              }
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="3m">Last 3 Months</option>
              <option value="1y">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>

            {filters.dateRange === 'custom' && (
              <div className={styles.dateInputs}>
                <label>
                  <span className={styles.label}>From</span>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={filters.dateFrom}
                    onChange={(e) =>
                      setFilters({ ...filters, dateFrom: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span className={styles.label}>To</span>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={filters.dateTo}
                    onChange={(e) =>
                      setFilters({ ...filters, dateTo: e.target.value })
                    }
                  />
                </label>
              </div>
            )}
          </div>

          {/* 标签（可选） */}
          {availableTags.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Tags</h3>
              <div className={styles.tagGroup}>
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    className={`${styles.tag} ${
                      filters.tags.includes(tag) ? styles.active : ''
                    }`}
                    onClick={() => {
                      const newTags = filters.tags.includes(tag)
                        ? filters.tags.filter((t) => t !== tag)
                        : [...filters.tags, tag]
                      setFilters({ ...filters, tags: newTags })
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 排序 */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Sort By</h3>
            <select
              className={styles.select}
              value={filters.sort}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  sort: e.target.value as FilterState['sort'],
                })
              }
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
            </select>
          </div>
        </div>

        {/* 底部操作 */}
        <div className={styles.footer}>
          <button className={styles.reset} onClick={resetFilters}>
            Reset All
          </button>
          <button className={styles.apply} onClick={applyFilters}>
            Apply Filters
          </button>
        </div>
      </aside>

      {/* 遮罩层 */}
      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)} />
      )}
    </>
  )
}
```

文件：`src/components/BlogFilterPanel/index.module.css`

```css
.mobileTrigger {
  display: none;
  align-items: center;
  gap: var(--website-space-2);
  min-height: var(--website-control-default);
  padding: 0 var(--website-space-4);
  border: 1px solid var(--website-color-border);
  border-radius: var(--website-radius-control);
  background: var(--website-color-surface);
  color: var(--website-color-foreground);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--website-duration-standard)
      var(--website-easing-standard),
    border-color var(--website-duration-standard) var(--website-easing-standard);
}

.mobileTrigger:hover,
.mobileTrigger:focus-visible {
  border-color: var(--website-color-action);
  background: var(--website-color-action);
  color: var(--website-color-brand-white);
}

.badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 var(--website-space-1);
  border-radius: var(--website-radius-pill);
  background: var(--website-color-action);
  color: var(--website-color-brand-white);
  font-size: 0.6875rem;
  font-weight: 600;
}

.panel {
  position: sticky;
  top: calc(var(--header-height) + var(--website-space-4));
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - var(--header-height) - var(--website-space-8));
  padding: var(--website-space-6);
  border: 1px solid var(--website-color-border);
  border-radius: var(--website-radius-content);
  background: var(--website-color-surface);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--website-space-4);
}

.title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.close {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--website-color-foreground);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.section {
  margin-bottom: var(--website-space-6);
}

.section:last-child {
  margin-bottom: 0;
}

.sectionTitle {
  margin: 0 0 var(--website-space-3);
  color: var(--website-color-muted-foreground);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.radioGroup,
.checkboxGroup {
  display: flex;
  flex-direction: column;
  gap: var(--website-space-2);
}

.radio,
.checkbox {
  display: flex;
  align-items: center;
  gap: var(--website-space-2);
  cursor: pointer;
}

.radio input,
.checkbox input {
  cursor: pointer;
}

.select,
.dateInput {
  width: 100%;
  min-height: var(--website-control-default);
  padding: 0 var(--website-space-3);
  border: 1px solid var(--website-color-border);
  border-radius: var(--website-radius-control);
  background: var(--website-color-surface);
  color: var(--website-color-foreground);
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color var(--website-duration-standard)
    var(--website-easing-standard);
}

.select:hover,
.select:focus,
.dateInput:hover,
.dateInput:focus {
  border-color: var(--website-color-action);
  outline: none;
}

.dateInputs {
  display: flex;
  flex-direction: column;
  gap: var(--website-space-3);
  margin-top: var(--website-space-3);
}

.label {
  display: block;
  margin-bottom: var(--website-space-1);
  font-size: 0.75rem;
  font-weight: 500;
}

.tagGroup {
  display: flex;
  flex-wrap: wrap;
  gap: var(--website-space-2);
}

.tag {
  padding: var(--website-space-1) var(--website-space-3);
  border: 1px solid var(--website-color-border);
  border-radius: var(--website-radius-pill);
  background: transparent;
  color: var(--website-color-foreground);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--website-duration-standard)
      var(--website-easing-standard),
    border-color var(--website-duration-standard) var(--website-easing-standard),
    color var(--website-duration-standard) var(--website-easing-standard);
}

.tag:hover,
.tag.active {
  border-color: var(--website-color-action);
  background: var(--website-color-action);
  color: var(--website-color-brand-white);
}

.footer {
  display: flex;
  gap: var(--website-space-3);
  padding-top: var(--website-space-4);
  border-top: 1px solid var(--website-color-border);
  margin-top: var(--website-space-4);
}

.reset,
.apply {
  flex: 1;
  min-height: var(--website-control-default);
  border-radius: var(--website-radius-control);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--website-duration-standard)
      var(--website-easing-standard),
    border-color var(--website-duration-standard) var(--website-easing-standard),
    color var(--website-duration-standard) var(--website-easing-standard);
}

.reset {
  border: 1px solid var(--website-color-border);
  background: transparent;
  color: var(--website-color-foreground);
}

.reset:hover,
.reset:focus-visible {
  border-color: var(--website-color-muted-foreground);
  background: var(--website-color-muted-surface);
}

.apply {
  border: 1px solid var(--website-color-action);
  background: var(--website-color-action);
  color: var(--website-color-brand-white);
}

.apply:hover,
.apply:focus-visible {
  background: color-mix(
    in srgb,
    var(--website-color-action) 85%,
    var(--website-color-brand-black)
  );
}

.overlay {
  display: none;
}

/* 响应式 */
@media (width < 64rem) {
  .mobileTrigger {
    display: flex;
  }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: var(--website-z-modal);
    width: min(85vw, 24rem);
    max-height: none;
    border: none;
    border-radius: 0;
    transform: translateX(100%);
    transition: transform var(--website-duration-standard)
      var(--website-easing-standard);
  }

  .panel.open {
    transform: translateX(0);
  }

  .close {
    display: flex;
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: var(--website-z-overlay);
    display: block;
    background: rgb(0 0 0 / var(--website-scrim-standard));
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--website-duration-standard)
      var(--website-easing-standard);
  }

  .panel.open ~ .overlay {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel,
  .overlay {
    transition: none;
  }
}
```

---

#### 第三步：更新页面布局

文件：`src/app/(frontend)/blogs/page.tsx`

```tsx
import { BlogFilterPanel } from '@/components/BlogFilterPanel'
import { CollectionArchive } from '@/components/CollectionArchive'
import { PageHeader } from '@/components/PageHeader'
import { getBlogs } from '@/utilities/blogs/getBlogs'
import { getBlogCategories } from '@/utilities/blogs/getBlogCategories'
import { getBlogAuthors } from '@/utilities/blogs/getBlogAuthors'
import styles from './listing.module.css'

export default async function BlogsPage({ searchParams }: PageProps) {
  const params = await searchParams
  
  const categories = await getBlogCategories()
  const authors = await getBlogAuthors()
  const blogs = await getBlogs({
    categorySlug: params.category,
    authorIds: params.author ? [params.author].flat() : undefined,
    dateRange: params.dateRange,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    tags: params.tag ? [params.tag].flat() : undefined,
    sort: params.sort,
    page: parseInt(params.page || '1', 10),
    limit: 12,
  })

  return (
    <div className={styles.container}>
      <PageHeader
        title="Blog"
        description="Discover tea wisdom, sustainability practices, and brewing guides"
      />

      <div className={styles.layout}>
        {/* 侧边筛选面板 */}
        <BlogFilterPanel
          categories={categories}
          authors={authors}
        />

        {/* 主内容区 */}
        <main className={styles.main}>
          <CollectionArchive posts={blogs.docs} />
          {/* Pagination 或 Infinite Scroll */}
        </main>
      </div>
    </div>
  )
}
```

文件：`src/app/(frontend)/blogs/listing.module.css`

```css
.container {
  width: min(100% - (2 * var(--website-gutter)), var(--website-container-site));
  margin-inline: auto;
  padding-block: var(--website-space-12);
}

.layout {
  display: grid;
  grid-template-columns: 16rem 1fr;
  gap: var(--website-space-8);
  align-items: start;
}

.main {
  min-width: 0;
}

@media (width < 64rem) {
  .layout {
    display: block;
  }

  .main {
    margin-top: var(--website-space-6);
  }
}
```

---

#### 第四步：实现筛选逻辑

文件：`src/utilities/blogs/getBlogs.ts`

```typescript
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Blog } from '@/payload-types'

interface GetBlogsOptions {
  categorySlug?: string
  authorIds?: string[]
  dateRange?: '7d' | '30d' | '3m' | '1y' | 'custom'
  dateFrom?: string
  dateTo?: string
  tags?: string[]
  sort?: 'newest' | 'oldest' | 'title-asc' | 'title-desc'
  page?: number
  limit?: number
}

export async function getBlogs(options: GetBlogsOptions = {}) {
  const {
    categorySlug,
    authorIds = [],
    dateRange,
    dateFrom,
    dateTo,
    tags = [],
    sort = 'newest',
    page = 1,
    limit = 12,
  } = options

  const payload = await getPayload({ config })

  // 构建查询条件
  const where: any = {
    _status: { equals: 'published' },
  }

  // 分类筛选
  if (categorySlug && categorySlug !== 'all') {
    const category = await payload.find({
      collection: 'blog-categories',
      where: { slug: { equals: categorySlug } },
      limit: 1,
    })

    if (category.docs[0]) {
      where.category = { equals: category.docs[0].id }
    }
  }

  // 作者筛选
  if (authorIds.length > 0) {
    where.authors = {
      in: authorIds,
    }
  }

  // 日期范围筛选
  if (dateRange || dateFrom || dateTo) {
    const now = new Date()
    let from: Date | undefined
    let to: Date | undefined

    switch (dateRange) {
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '3m':
        from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      case 'custom':
        from = dateFrom ? new Date(dateFrom) : undefined
        to = dateTo ? new Date(dateTo) : undefined
        break
    }

    if (from || to) {
      where.publishedAt = {}
      if (from) where.publishedAt.greater_than_equal = from.toISOString()
      if (to) where.publishedAt.less_than_equal = to.toISOString()
    }
  }

  // 标签筛选（如果实现了 tags 字段）
  if (tags.length > 0) {
    where['tags.tag'] = {
      in: tags,
    }
  }

  // 排序
  let sortField: string
  switch (sort) {
    case 'oldest':
      sortField = 'publishedAt'
      break
    case 'title-asc':
      sortField = 'title'
      break
    case 'title-desc':
      sortField = '-title'
      break
    case 'newest':
    default:
      sortField = '-publishedAt'
      break
  }

  const result = await payload.find({
    collection: 'blogs',
    where,
    sort: sortField,
    limit,
    page,
    depth: 1,
  })

  return result
}
```

文件：`src/utilities/blogs/getBlogAuthors.ts`

```typescript
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'

export const getBlogAuthors = unstable_cache(
  async () => {
    const payload = await getPayload({ config })

    // 获取所有博客的作者
    const blogs = await payload.find({
      collection: 'blogs',
      where: {
        _status: { equals: 'published' },
      },
      limit: 1000,
      depth: 1,
    })

    // 提取唯一作者
    const authorSet = new Set<string>()
    const authorMap = new Map()

    blogs.docs.forEach((blog) => {
      if (Array.isArray(blog.authors)) {
        blog.authors.forEach((author) => {
          if (typeof author === 'object' && author.id) {
            authorSet.add(author.id)
            authorMap.set(author.id, author)
          }
        })
      }
    })

    return Array.from(authorSet).map((id) => authorMap.get(id))
  },
  ['blog-authors'],
  {
    tags: ['blogs-list', 'users'],
    revalidate: 3600, // 1 hour
  }
)
```

---

## 测试验证

### 1. 单元测试

文件：`tests/int/blog-filter-panel.int.spec.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { BlogFilterPanel } from '@/components/BlogFilterPanel'

const mockCategories = [
  { id: '1', title: 'Tea Guides', slug: 'tea-guides' },
  { id: '2', title: 'Sustainability', slug: 'sustainability' },
]

const mockAuthors = [
  { id: 'a1', name: 'John Doe' },
  { id: 'a2', name: 'Jane Smith' },
]

describe('BlogFilterPanel', () => {
  test('renders all filter sections', () => {
    render(
      <BlogFilterPanel categories={mockCategories} authors={mockAuthors} />
    )

    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Authors')).toBeInTheDocument()
    expect(screen.getByText('Date Range')).toBeInTheDocument()
    expect(screen.getByText('Sort By')).toBeInTheDocument()
  })

  test('shows active filter count', () => {
    render(
      <BlogFilterPanel categories={mockCategories} authors={mockAuthors} />
    )

    // 初始无筛选器
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument()

    // 选择一个分类
    fireEvent.click(screen.getByLabelText('Tea Guides'))

    // 应该显示计数
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  test('applies filters on button click', () => {
    const mockPush = jest.fn()
    jest.mock('next/navigation', () => ({
      useRouter: () => ({ push: mockPush }),
      useSearchParams: () => new URLSearchParams(),
    }))

    render(
      <BlogFilterPanel categories={mockCategories} authors={mockAuthors} />
    )

    fireEvent.click(screen.getByText('Apply Filters'))

    expect(mockPush).toHaveBeenCalled()
  })

  test('resets all filters', () => {
    render(
      <BlogFilterPanel categories={mockCategories} authors={mockAuthors} />
    )

    // 选择一些筛选器
    fireEvent.click(screen.getByLabelText('Tea Guides'))
    fireEvent.click(screen.getByLabelText('John Doe'))

    // 重置
    fireEvent.click(screen.getByText('Reset All'))

    // 所有筛选器应该被清除
    expect(screen.getByLabelText('All Categories')).toBeChecked()
  })
})
```

---

### 2. E2E 测试

文件：`tests/e2e/blog-filter-panel.e2e.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Blog Filter Panel', () => {
  test('filters by category', async ({ page }) => {
    await page.goto('/blogs')

    // 点击分类
    await page.click('text="Sustainability"')

    // URL 应该更新
    await expect(page).toHaveURL(/category=sustainability/)

    // 应该只显示该分类的博客
    const cards = page.locator('[data-blog-card]')
    await expect(cards.first()).toBeVisible()
  })

  test('filters by multiple authors', async ({ page }) => {
    await page.goto('/blogs')

    // 打开筛选面板（移动端）
    if (await page.locator('.mobileTrigger').isVisible()) {
      await page.click('.mobileTrigger')
    }

    // 选择多个作者
    await page.check('text="John Doe"')
    await page.check('text="Jane Smith"')

    // 应用筛选
    await page.click('text="Apply Filters"')

    // URL 应该包含两个作者参数
    await expect(page).toHaveURL(/author=/)
  })

  test('filters by date range', async ({ page }) => {
    await page.goto('/blogs')

    // 选择日期范围
    await page.selectOption('select', '30d')
    await page.click('text="Apply Filters"')

    // URL 应该更新
    await expect(page).toHaveURL(/dateRange=30d/)
  })

  test('combines multiple filters', async ({ page }) => {
    await page.goto('/blogs')

    // 分类
    await page.click('text="Tea Guides"')

    // 作者
    await page.check('text="John Doe"')

    // 日期
    await page.selectOption('select', '7d')

    // 应用
    await page.click('text="Apply Filters"')

    // URL 应该包含所有参数
    const url = page.url()
    expect(url).toContain('category=tea-guides')
    expect(url).toContain('author=')
    expect(url).toContain('dateRange=7d')
  })

  test('resets filters', async ({ page }) => {
    await page.goto('/blogs?category=tea-guides&author=a1&dateRange=30d')

    // 点击重置
    await page.click('text="Reset All"')

    // 应该回到默认状态
    await expect(page).toHaveURL('/blogs')
  })

  test('mobile drawer opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/blogs')

    // 打开
    await page.click('.mobileTrigger')
    await expect(page.locator('.panel')).toHaveClass(/open/)

    // 关闭
    await page.click('.close')
    await expect(page.locator('.panel')).not.toHaveClass(/open/)
  })
})
```

---

## 实施步骤

### 第一步：数据层（2小时）
1. 可选：添加 tags 字段到 Blog collection
2. 创建 `getBlogAuthors` utility
3. 扩展 `getBlogs` 支持多维度筛选
4. 测试查询逻辑

### 第二步：组件开发（3小时）
1. 创建 `BlogFilterPanel` 组件
2. 实现状态管理
3. 实现移动端抽屉
4. 添加样式

### 第三步：页面集成（30分钟）
1. 更新 `/blogs/page.tsx`
2. 调整布局
3. 测试 URL 参数

### 第四步：测试验证（30分钟）
1. 单元测试
2. E2E 测试
3. 手动测试各种组合

---

## 验证清单

### 功能测试
- [ ] 所有筛选维度正常工作
- [ ] 多选筛选正确组合
- [ ] URL 参数正确更新
- [ ] 刷新页面保持筛选状态
- [ ] 重置按钮清除所有筛选
- [ ] 活跃筛选器计数正确

### 响应式测试
- [ ] 桌面端侧边栏固定
- [ ] 移动端抽屉可打开/关闭
- [ ] 平板布局合理

### 性能测试
- [ ] 筛选响应速度 < 500ms
- [ ] 无不必要的重新渲染
- [ ] 移动端抽屉动画流畅

---

## 性能优化

### 1. 防抖搜索
```typescript
import { useDebouncedCallback } from 'use-debounce'

const debouncedApply = useDebouncedCallback(applyFilters, 300)
```

### 2. URL 参数优化
```typescript
// 使用简短的参数名
const params = new URLSearchParams()
if (filters.category) params.set('c', filters.category)
if (filters.dateRange) params.set('d', filters.dateRange)
```

### 3. 缓存作者列表
已在 `getBlogAuthors` 中实现 `unstable_cache`。

---

## 扩展功能

### 1. 保存筛选器预设
```typescript
const savePreset = () => {
  localStorage.setItem('blog-filter-preset', JSON.stringify(filters))
}

const loadPreset = () => {
  const saved = localStorage.getItem('blog-filter-preset')
  if (saved) setFilters(JSON.parse(saved))
}
```

### 2. 显示结果数量
```tsx
<div className={styles.resultsCount}>
  {totalResults} blog{totalResults !== 1 ? 's' : ''} found
</div>
```

### 3. 筛选器历史
```typescript
const [filterHistory, setFilterHistory] = useState<FilterState[]>([])

const applyFilters = () => {
  setFilterHistory((prev) => [...prev.slice(-4), filters])
  // ...
}
```

---

## 回退方案

### 方案 A：简化筛选器
只保留分类和排序，移除其他维度。

### 方案 B：移动端隐藏
桌面端显示筛选面板，移动端只显示触发按钮。

### 方案 C：完全移除
恢复到只有分类 tabs 的状态。
