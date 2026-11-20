# 移除 Posts 与 Categories — 设计

- 日期：2026-11-19
- 分支：`feature/admin-ui-macos`（在 `2026-11-19-admin-ui-macos-redesign-design.md` 完成后执行，单独提交）
- 状态：设计已确认（方案 A：彻底移除），待编写实施计划

## 1. 背景与目标

`posts` / `categories` 是 Payload 网站模板遗留的 collection，与 `blogs` / `blog-categories` 功能重叠。目标：

1. 从内容模型中彻底移除 `posts` 与 `categories`，所有消费方统一改用 `blogs` / `blog-categories`。
2. 旧的 `/posts` URL 永久重定向到 `/blogs`。
3. 迁移只在数据“干净”时执行；发现残留数据或引用时拒绝执行并列出明细，不自动删除或改写内容。

不做：自动把 posts 转换为 blogs（方案 B 已否决）。各环境中现存的 posts 由内容编辑在后台手动处理（改建为 blog 或删除）。

已知现状（2026-11-19，本地开发库 `mongodb://127.0.0.1:27017/ecolitea2`，只读计数）：`posts` 2 条（`_posts_versions` 5 条），`categories` 0 条。因此在该库上，迁移预检会按设计拒绝，直到这 2 条被手动处理。生产库数据量未知，部署前必须先运行预检。

## 2. 影响范围

### 2.1 删除

| 类别 | 路径 |
|---|---|
| Collection | `src/collections/Posts/`（含 hooks、blocks）、`src/collections/Categories.ts`、`src/collections/hooks/revalidateCategories.ts` |
| 前台路由 | `src/app/(frontend)/[lang]/posts/`（列表、分页、详情）、`src/app/(frontend)/(sitemaps)/posts-sitemap.xml/` |
| 翻译规则 | `src/plugins/translation/rules/posts.ts`、`categories.ts` 及其在 `rules/index.ts` 中的注册 |
| Post 卡片分支 | `src/components/Card` 与 `src/components/CollectionArchive` 中的 `posts` 变体及 `CardPostData` 类型 |

### 2.2 修改（改为只使用 blogs / blog-categories，或删除 posts / categories 选项）

| 位置 | 改动 |
|---|---|
| `src/payload.config.ts` | 从 collections 中移除 `Posts`、`Categories` |
| `src/collections/Pages/blocks/Archive/` | `relationTo` 选项改为 `blogs`（默认值 `blogs`）；`categories` 关系改为 `blog-categories`；`selectedDocs` 改为 `['blogs']`；组件按 `blogs` 的 `category` 字段过滤，并以 `CollectionArchive relationTo="blogs"` 渲染 |
| 链接目标 | `src/fields/link.ts` 默认 `relationTo` 改为 `['pages', 'blogs']`；`src/Header/fields/links.ts`、`src/Footer/config.ts`、`src/fields/defaultLexical.ts`、`src/Settings/fields/productListing.ts` 移除 `posts`、`categories` |
| `src/utilities/resolveLinkHref.ts` | 移除 `posts`、`categories`（`/posts?category=`）分支 |
| 搜索 | `src/plugins/index.ts` 中 search 插件的 collections 移除 `posts`；`src/search/beforeSync.ts`、`fieldOverrides.ts` 移除 `categories` 相关同步与字段；`src/search/visibility.ts`、`getTranslatedSearchResults.ts`、`src/app/(frontend)/[lang]/search/page.tsx` 只处理 `blogs`（及原有的其他非 posts collection） |
| SEO / redirects / nested-docs 插件 | `src/plugins/index.ts` 中各插件的 collections 列表与 `generateTitle` 的 `posts` 分支移除 |
| i18n 工具 | `src/app/(frontend)/next/language-target/route.ts`、`src/utilities/i18n/resolveRedirect.ts`、`publicSourceVisibility.ts`、`getDocumentBySlug.ts`、`listingAccess.ts` 移除 `posts` |
| `src/utilities/generateMeta.ts` | `doc` 类型移除 `Post` |
| `next-sitemap.config.*` | 移除 `posts-sitemap.xml` 与 `/posts/*` 条目 |
| 后台导航 | admin 设计 §6 的 `Content` 分组移除 Posts、Categories，并同步更新分组测试 |

历史迁移文件（`src/migrations/*`）中的 `posts` 字面量保持不变。

### 2.3 生成文件

`corepack pnpm generate:types`、`corepack pnpm generate:importmap`。

## 3. URL 重定向

在 `redirects.ts`（`next.config` 的 `redirects`）中新增永久重定向（301）：

| 来源 | 目标 |
|---|---|
| `/posts`、`/posts/:path*` | `/blogs` |
| `/:lang/posts`、`/:lang/posts/:path*` | `/:lang/blogs` |

- `:lang` 用正则限制为语言代码格式（例如 `[a-z]{2,3}(-[A-Za-z0-9]{2,8})?`），不匹配其他一级路径。
- 详情页统一跳转到 blogs 列表页，不按 slug 一一映射（内容不做迁移，slug 不对应）。
- 已知限制：此后 Pages 中 slug 为 `posts` 的页面会被重定向覆盖。

## 4. 迁移：`src/migrations/<实施日期>_remove_posts_categories.ts`

文件名日期取实施当天（`YYYYMMDD`），与现有迁移命名一致。

沿用现有迁移的写法：先纯函数生成计划，再执行；先报告目标数据库，再操作。

### 4.1 预检（任一项不为零即拒绝，并输出每项的数量和文档位置）

| 检查 | 范围 |
|---|---|
| 残留文档 | `posts`、`categories` 中的文档 |
| 链接引用 | 从数据库发现现有集合，递归扫描原始文档，包括版本和所有 globals。逐项报告 `relationTo` 为 `posts` 或 `categories` 的对象及其集合、文档 ID 和点分路径，包括富文本 `fields.doc` 与 relationship 节点。引用扫描排除待移除集合及其版本，以及派生索引 `search` 和 `translation-search`。Archive 自身的旧 `posts` 集合选择器按 §4.2 处理。 |
| Archive 区块 | `categories` 或 `selectedDocs` 非空且指向 `categories` / `posts` 的 Archive 区块 |
| 重定向 | `redirects` 中指向 `posts` 或 `categories` 的 `to.reference`，由同一递归扫描识别并单列 |
| 翻译内容 | `translations` 中 `sourceCollection` 为 `posts` 或 `categories` 的记录 |

### 4.2 执行（仅在预检通过时）

- 改写 Archive 区块中 `populateBy = 'collection'` 且 `relationTo = 'posts'` 的取值为 `'blogs'`（包括 `_pages_versions`）。这是取值规范化，不删除内容。
- 删除派生数据：`search` 与 `translation-search` 中 `doc.relationTo` / `sourceCollection` 为 `posts` 的索引记录（可重建的索引）。
- 删除空的 `posts`、`categories`、`_posts_versions`、`_categories_versions` 集合。`_posts_versions` 中只有已删除文档的历史版本时视为空（版本所属文档不存在）。
- 输出执行报告：目标数据库名、改写的区块数、删除的索引数、删除的集合。

### 4.3 回滚

`down` 不恢复数据（`up` 只在没有内容时执行）；只把 Archive 区块的 `relationTo` 改回 `'posts'`。代码回滚依靠 git。

## 5. 测试

只写本任务相关的测试。

| 测试 | 类型 | 内容 |
|---|---|---|
| 迁移计划 | int（纯函数） | 各类引用被识别并拒绝；干净数据生成正确的改写与删除计划；`_versions` 孤儿版本判定 |
| 迁移执行 | int（隔离数据库，复用 `tests/helpers/isolatedDatabase.ts`） | 有残留时拒绝且数据库不变；干净时执行后集合被删除、Archive 区块被改写 |
| Schema | int | config 中不存在 `posts`、`categories`；所有链接 / 关系字段的 `relationTo` 不包含二者；Archive 区块指向 `blogs` / `blog-categories` |
| 重定向 | int | `redirects()` 返回的规则覆盖 §3 的四种来源，`:lang` 不匹配非语言代码路径 |
| Archive 区块 | int | 按 blog 分类过滤与按选择渲染 |
| 现有测试 | — | 约 25 个以 `posts` / `categories` 作为 fixture 的测试改用 `blogs` / `blog-categories`；只测试 posts 行为的用例删除。e2e 中 `website-shell`、`task6-visual-matrix` 的 posts fixture 同样改用 blogs |

全局检查：`tsc --noEmit`、`lint`、`build`。int / e2e 需要 MongoDB；数据库连接失败需单独报告。

## 6. 数据与环境安全

- 迁移执行前打印并确认目标数据库名；测试只使用隔离数据库。
- 不对生产或远程存储做任何操作。各环境由运维按以下顺序执行：预检 → 内容编辑手动处理残留 → 再次预检 → 执行迁移 → 部署代码。
- 预检可单独运行：沿用现有 `scripts/report-*.ts` 的模式，新增只读脚本 `scripts/report-remove-posts-categories.ts`，调用迁移导出的同一个预检函数，只输出报告、不写入，供部署前检查。
