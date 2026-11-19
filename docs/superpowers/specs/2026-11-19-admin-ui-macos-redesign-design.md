# Payload Admin 界面改造（macOS 视觉）— 设计

- 日期：2026-11-19
- 分支：`feature/admin-ui-macos`（基于 `feature/i18n-consent`，依赖其中的 email / translation 插件）
- 状态：已实现（`51ba635`…`57581a0`，计划 `docs/superpowers/plans/2026-11-19-admin-ui-macos-redesign.md`）；实现差异见 §11
- 后续：`docs/superpowers/specs/2026-11-19-remove-posts-categories-design.md`（同一分支，在本设计完成后执行）
- 视觉稿：`.superpowers/brainstorm/89787-1795079269/content/admin-demo-v2.html`（本地文件，不提交；浅色/深色 × 概览/列表/编辑）
- 参考：Apple Human Interface Guidelines（macOS 字号、系统颜色、Tab view/分段控件用法）；macOS 27 UI Kit 未能访问（Figma 登录受限），不影响本设计
- 相关：`docs/superpowers/specs/2026-11-17-visual-refresh-design.md`（公开前端视觉刷新；该文档“不改 Payload Admin”的约束仅针对该项目）

## 1. 目标与边界

### 1.1 目标

1. 去掉 Admin 中的 Payload 品牌痕迹，改为由 Site Settings 驱动的品牌。
2. 清除前台模板遗留与写死的品牌字符串，品牌统一来自 Site Settings（§9）。
3. 以 macOS（HIG）视觉语言重塑 Admin：系统字体、系统颜色、浅色/深色两套外观（跟随系统）、更圆润的控件、柔和的分层阴影。
4. 用按业务组织的 Dashboard 替代默认首页。
5. 统一侧边栏分组。

### 1.2 硬约束

- **通用系统**：本仓库可部署给不同品牌。代码、样式、默认值中不得出现任何具体品牌名（包括 “Ecolitea”）；品牌一律来自 Site Settings，缺省时回退为中性的 “Admin”。
- **只用公开扩展点**：Payload 公开 CSS token、`admin.components` 文档插槽、`admin.dashboard` widgets、`admin.group`、`admin.meta`、插件公开 overrides。不选中 Payload 私有 class、不依赖其 DOM 结构、不替换 `Nav`。
- **不使用 Apple 素材**：不分发 SF Pro 字体文件、SF Symbols 或 UI Kit 图形。字体使用系统字体栈（Mac 上即原生 SF Pro），只采纳尺寸、比例、颜色与模式。
- **不改数据模型**：不新增或修改任何持久化字段。
- 不使用 `!important`。

### 1.3 不做

- 替换 `Nav`（因此不做侧边栏彩色图标、数量、角标）
- 编辑页“灰底 + 白色字段卡片”布局（需要改 Payload DOM，见 §3.4）
- 底部状态栏、⌘K 搜索、窗口红黄绿按钮、真实毛玻璃（vibrancy）
- Dashboard 时间范围切换、问候语
- 后台标签页图标跟随 Site Settings（需新增路由，留待多品牌部署时再做）
- 双语或中文导航分组（使用英文）

## 2. 架构

| 归属 | 内容 | 位置 |
|---|---|---|
| 视觉 token | 浅色和深色两套 Payload token 映射，Admin 视觉的唯一来源 | `src/app/(payload)/custom.css` |
| 品牌插槽 | Logo、Icon 及其数据规范化 | `src/components/admin/brand/` |
| Dashboard widgets | 5 个 widget，查询与展示分离 | `src/components/admin/dashboard/` |
| 导航分组 | `admin.group` 与 collections 顺序 | 各 collection/global config、`src/plugins/index.ts`、`src/payload.config.ts` |
| Admin 配置 | 插槽、widgets、meta、theme 注册 | `src/payload.config.ts` 的 `admin` |

`src/app/(payload)/admin/importMap.js` 为生成文件，通过 `corepack pnpm generate:importmap` 重新生成。

## 3. 视觉 token（`custom.css`）

### 3.1 已安装版本中的事实（payload / @payloadcms/ui 4.0.0-canary.29）

- token 分两层：原始色板 `--ramp-*` 与语义 token `--color-*`、`--field-*`、`--radius-*`、`--text-*`、`--elevation-*` 等。深色模式只在 `html[data-theme='dark']` 中重定义语义层。
- Payload 样式位于 `@layer payload-default`。`custom.css` 不放入任何 layer，因此自然优先，不需要 `!important`。
- 默认字号：`--text-body-large` 13px（正文），`--text-body-medium` 11px，`--text-body-small` 9px。

### 3.2 文件结构

```
① 自有原始层  --admin-*   ：浅色写在 :root，深色写在 html[data-theme='dark']，取值来自 HIG
② 语义映射              ：Payload 语义 token → var(--admin-*)
```

- 只覆盖语义层，不覆盖 `--ramp-*`。
- 调整视觉时只改 ①；② 是固定的对接层。
- 选择器只允许：`:root`、`html[data-theme='dark']`、`html[data-theme='light']`，以及项目自有 CSS Module class。

### 3.3 关键取值

| 语义 | Payload token | 浅色 | 深色 |
|---|---|---|---|
| 主内容底色 | `--color-bg` | `#ffffff` | `#1e1e20` |
| 次级底色 | `--color-bg-secondary`（含 hover/pressed） | `#f5f5f7` | `#2a2a2d` |
| 三级底色 | `--color-bg-tertiary` | `#ebebed` | `#3a3a3c` |
| 浮层 | `--color-bg-elevated` | `#ffffff` | `#2c2c2e` |
| 悬停 / 按下 | `--color-bg-hover`、`--color-bg-pressed`、`--color-bg-transparent-*` | `rgb(0 0 0 / 5%)` / `8%` | `rgb(255 255 255 / 8%)` / `12%` |
| 主文字 | `--color-text`、`--color-icon` | `#1d1d1f` | `#f5f5f7` |
| 次级文字 | `--color-text-secondary`、`--color-icon-secondary` | `rgb(29 29 31 / 62%)` | `rgb(235 235 245 / 60%)` |
| 三级 / 禁用文字 | `--color-text-tertiary`、`--color-text-disabled` | `rgb(29 29 31 / 38%)` | `rgb(235 235 245 / 32%)` |
| 分隔线 | `--color-border`、`--color-border-disabled` | `rgb(0 0 0 / 8%)` | `rgb(255 255 255 / 8%)` |
| 品牌色 | `--color-bg-brand`、`--color-bg-selected-strong`、`--color-text-brand`、`--color-icon-brand`、`--color-border-selected`、`--field-color-toggle-bg-checked` | `#007aff` | `#0a84ff` |
| 选中浅底 | `--color-bg-selected`、`--color-bg-brand-tertiary` | 品牌蓝 12% | 品牌蓝 24% |
| 成功 | `--color-bg-success`、`--color-text-success`、`--color-icon-success` | `#34c759` | `#30d158` |
| 警告 | `--color-bg-warning`、`--color-text-warning`、`--color-icon-warning` | `#ff9500` | `#ff9f0a` |
| 危险 | `--color-bg-danger`、`--color-text-danger`、`--color-icon-danger` | `#ff3b30` | `#ff453a` |
| component 色 | `--color-bg-component` 等 | indigo `#5856d6` | `#5e5ce6` |
| assistive 色 | `--color-bg-assistive` 等 | pink `#ff2d55` | `#ff375f` |
| focus 光环 | `--accessibility-focus-color`（`--field-color-border-focus` 已引用它） | 品牌蓝 | 品牌蓝 |
| 字体 | `--font-family-sans` | `-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif` | 同左 |
| 控件圆角 | `--radius-medium`（原 5px，`--button-radius`、`--field-border-radius` 引用它） | 7px | 同左 |
| 浮层和卡片圆角 | `--radius-large`（原 13px，`--popup-radius` 引用它） | 12px | 同左 |
| 状态 chip | `--radius-chip`（原 3px） | 999px | 同左 |
| 最小字号 | `--text-body-small-font-size`、`--text-body-small-strong-font-size`（原 9px） | 10px | 同左 |
| 阴影 | `--elevation-300-tooltip`、`--elevation-400-menu-panel`、`--elevation-500-modal-window` | 柔和分层阴影 + `0 0 0 0.5px rgb(0 0 0 / 12%)` | 加深阴影 + `0 0 0 0.5px rgb(255 255 255 / 12%)` |

系统颜色取 Apple 公开的标准值；中性灰与透明度依据视觉稿 v2。成功/警告/危险的 `-hover`、`-pressed`、`-tertiary` 变体由 `color-mix()` 从基础色派生。

### 3.4 与视觉稿的已知差异

- 视觉稿编辑页的“灰色窗口底 + 白色字段卡片”在 Payload 自有页面上**不实现**：Payload 编辑页是一整块 `--color-bg`。列表页和编辑页的配色、圆角、字体、按钮、focus、状态色与视觉稿一致，group、array 行、上传区用 `--color-bg-secondary` 区分。
- Dashboard 由我们自己的 widget 构成，可以与视觉稿一致。
- `--color-bg-secondary` / `--color-bg-tertiary` 在 Payload 中实际出现的位置（例如侧边栏）需要在实现时截图校准（§7），不靠推测。

## 4. 品牌

### 4.1 数据来源

Site Settings 已有字段（`src/SiteSettings/fields/branding.ts`、`general.ts`）：`siteName`、`logo`（必填，横版 SVG，`site-assets`）、`favicon`（方形 SVG/PNG/ICO）。通过 `getCachedGlobal('site-settings', 1)` 读取；保存 Site Settings 后，现有 `revalidateSiteSettings` 钩子会刷新 `global_site-settings` 标签。前台以公开权限读取同一 global，因此登录页无需额外开放权限。

### 4.2 组件（`src/components/admin/brand/`）

| 文件 | 职责 |
|---|---|
| `resolveAdminBrand.ts` | 纯函数：Site Settings → `{ name, logo?, icon? }`。复用 `src/components/Logo/resolveSiteAsset.ts` 与 `resolveFavicon.ts`。回退顺序：logo 图片 → `siteName` → `"Admin"` |
| `AdminLogo.tsx` | 服务端组件，注册为 `admin.components.graphics.Logo`（登录页） |
| `AdminIcon.tsx` | 服务端组件，注册为 `admin.components.graphics.Icon`（导航）；有 favicon 时显示图片，否则显示 `siteName` 首字母方块，再没有则显示中性字母 “A” |
| `AdminBrand.module.css` | 自有 class；`html[data-theme='dark'] .logo { filter: invert(1) }` |

已知限制：深色模式反色假设 Logo 为单色；彩色 Logo 反色后颜色会失真（如以后需要，再在 Branding 中新增深色版 Logo 字段）。

### 4.3 首次使用的各阶段

| 阶段 | Logo | Icon |
|---|---|---|
| 全新部署，尚无用户（Payload 原生的创建首个管理员页） | “Admin” 字标 | 中性 “A” |
| 已登录，Site Settings 从未保存 | “Admin” 字标 | 中性 “A” |
| 有 `siteName`，无 logo（只会出现在 Site Settings 从未保存时） | `siteName` 字标 | `siteName` 首字母 |
| 已上传 logo 和 favicon | Logo 图片（深色模式反色） | favicon 图片 |

任何阶段都不会报错或显示空白。

### 4.4 其他品牌位置

- 删除 `src/components/BeforeLogin/` 与 `admin.components.beforeLogin`（删除前确认没有其他引用）。登录页只显示 Logo。
- `admin.meta.titleSuffix: ' · Admin'`；`admin.meta.icons` 指向 `public/favicon.svg`、`public/favicon.ico`（`admin.meta` 是静态配置，无法读取数据库）。
- `admin.theme: 'all'`（Payload 默认值，写明以表达意图）：跟随系统外观，用户也可以手动切换。

## 5. Dashboard（`admin.dashboard`）

使用 Payload 原生 widgets API（`admin.dashboard.widgets` + `defaultLayout`，类型中标注为 experimental）。保留原生的“用户自行调整布局”能力。风险：experimental API 升级时可能变化，影响范围限于 `src/components/admin/dashboard/`。

### 5.1 Widgets

label 用英文。每个 widget = 一个查询模块（纯数据，可单测）+ 一个展示组件。

| slug | 内容 | 数据 | 可见角色 |
|---|---|---|---|
| `site-setup` | “Complete site setup” 提醒条 + 前往 Site Settings 的链接；`siteName` 和 `logo` 都存在时不渲染任何内容 | Site Settings | admin |
| `overview` | 4 个统计块：已发布 / 草稿产品数、待处理询价数（`status = 'new'`）、博客数、已启用语种数 | `payload.count()`，携带当前用户的 `req`，遵守访问控制；语种数来自 `getI18nSettings` | 所有登录用户 |
| `recent-quotes` | 最近 5 条询价：姓名、公司、产品、状态 chip、相对时间，点击进入详情 | `payload.find({ collection: 'quote-requests', sort: '-createdAt', limit: 5 })` | 所有登录用户 |
| `system-status` | 4 行：邮件（来源与是否可用）、翻译（进行中 / 失败）、存储（对象存储已配置 / 本地）、定时发布（下一次执行时间） | 邮件复用 `getEmailConfiguration`；翻译复用 `getTranslationStatus`；存储只读运行时配置，不发起网络请求；定时发布查询 jobs 队列 | admin |
| `quick-actions` | New product / New blog / Upload media | 链接到对应的 create 页面；当前用户没有 create 权限的按钮不渲染 | 所有登录用户 |

### 5.2 默认布局

已安装的 `WidgetWidth` 取值为 `'x-small' | 'small' | 'medium' | 'large' | 'x-large' | 'full'`。

1. `site-setup`：`full`（条件显示）
2. `overview`：`full`
3. `recent-quotes`：`large` + `system-status`：`medium`（若两者不能并排，实现时按截图改为 `x-large` + `small`）
4. `quick-actions`：`full`

### 5.3 错误处理与可移植性

- 每个 widget 自行捕获查询错误，只在该卡片中显示 “Unavailable”，不影响其他 widget。
- 数据为空时显示正常的空状态（例如 “No quote requests yet”）。
- 某个模块未启用或查询失败（例如 jobs 未启用）时，对应行显示 “Not configured”。
- System status 不输出任何凭据或原始配置，沿用 `EmailStatus` 现有的约定。

## 6. 导航分组

| 分组 | 成员 |
|---|---|
| `Products` | Products、Product Categories、Quote Requests |
| `Content` | Pages、Posts、Blogs、Blog Categories、Case Studies、Categories、Forms、Form Submissions |
| `Assets` | Media、Documents、Site Assets、Folders |
| `Site` | Header、Footer、Site Settings、Settings、Redirects、Search、Users |

- 保持隐藏：Social Platforms、Translations、Translation Usage、Translation Search。
- 自有 collection/global 修改 `admin.group`；redirects、form-builder、search 插件生成的 collection 通过各插件公开的 overrides 设置分组。
- 调整 `payload.config.ts` 中 collections 数组顺序，使导航顺序与上表一致（只影响导航展示）。
- 现状：`Product`、`Blog` 两个分组改名或并入；其余目前没有分组。

## 7. 测试与验证

只写本任务相关的测试，不加全局 e2e，也不加视觉矩阵。

| 测试 | 类型 | 内容 |
|---|---|---|
| Token 契约 | int | 解析 `custom.css`：每个被覆盖的 Payload token 都存在于已安装的 `@payloadcms/ui/dist/styles.css`；选择器只属于 §3.2 允许的集合；不含 `!important`；不含任何品牌名。复用 `tests/helpers/cssAudit.ts` |
| `resolveAdminBrand` | int | logo / favicon / siteName 有无的组合与回退顺序；输出不含硬编码品牌 |
| Widget 查询模块 | int | overview 计数、询价列表整理、system status 映射、查询抛错时返回 unavailable（mock payload） |
| 导航分组 | int | 加载 config，检查每个 collection/global 的 `admin.group` 与 §6 一致，隐藏项保持隐藏 |
| Admin 冒烟 | e2e，只扩展 `tests/e2e/admin.e2e.spec.ts` | 登录页显示品牌回退；Dashboard 渲染 widget；深色主题下 `--color-bg-brand` 的计算值为 `#0a84ff`（复用 `tests/helpers/computedColor.ts`） |

其他：

- 截图校准：实现完成后，用 Playwright 截取登录页、Dashboard、列表页、编辑页的浅色和深色截图，对照视觉稿 v2 调整 `--admin-*` 取值。截图放在 `/tmp`，不提交。
- 生成文件：新增插槽后运行 `corepack pnpm generate:importmap`；如果 `payload-types.ts` 有变化，运行 `corepack pnpm generate:types`。
- 全局检查：`corepack pnpm exec tsc --noEmit --incremental false`、`corepack pnpm lint`、`corepack pnpm build`。
- int 与 e2e 需要 MongoDB；数据库连接失败要单独报告，不视为功能回归。存储不在测试范围内时使用 `DISABLE_R2_STORAGE=true`。

## 8. 与后续设计的关系

Posts 与 Categories 的移除由 `2026-11-19-remove-posts-categories-design.md` 负责，在本设计完成后执行。本设计中：

- §6 的 `Content` 分组仍包含 Posts、Categories；移除后由后续设计更新分组测试。
- §9 不修改 `src/app/(frontend)/[lang]/posts/**` 的页面标题（这些路由将被删除）。

## 9. 前台品牌字符串清理

### 9.1 现状

| 位置 | 遗留内容 |
|---|---|
| `src/plugins/index.ts` `generateTitle` | `… \| Ecolitea`、`'Ecolitea'`、默认分支 `… \| Payload Website Template` |
| `src/utilities/generateMeta.ts` | 标题后缀 `' \| Payload Website Template'`；默认 OG 图 `/website-template-OG.webp` |
| `src/utilities/mergeOpenGraph.ts` | `siteName` / `title` 为 `'Payload Website Template'`；描述 `'An open-source website built with Payload and Next.js.'`；默认 OG 图 `/website-template-OG.webp` |
| `src/utilities/buildSiteMetadata.ts` | `twitter.creator: '@payloadcms'` |
| `src/Footer/adaptFooter.ts` | 回退值 `'Ecolitea'` |
| `src/app/(frontend)/[lang]/search/page.tsx` | 标题 `'Payload Website Template Search'` |

### 9.2 规则

- 新增 `src/utilities/siteIdentity.ts`：从 Site Settings（`getCachedGlobal('site-settings')`）规范化出 `{ siteName?: string; siteDescription?: string }`，空字符串视为缺失。前台 metadata 只通过它读取品牌，不再各自解析 Site Settings。
- 标题格式统一为纯函数 `formatTitle(title?, siteName?)`：两者都有时为 `"{title} | {siteName}"`；只有其一时取其一；都没有时返回空字符串，由调用方省略 `title`。
- SEO 插件 `generateTitle`：保留现有按 collection 的标题规则（例如 Blog Categories 为 “{title} Blogs”、Product Categories 为 “{title} Products”、Settings 为 “Blogs”），后缀改为 `formatTitle` + 通过 `req` 读取的 `siteName`。
- `generateMeta`、`mergeOpenGraph`：`siteName`、默认描述来自 `siteIdentity`；缺失时省略对应字段。
- 默认 OG 图：删除对 `/website-template-OG.webp` 的引用；文档没有 meta 图片时不输出 `og:image`。删除前确认 `public/website-template-OG.webp` 没有其他引用，再一并删除该文件。
- `buildSiteMetadata`：删除 `twitter.creator`。
- Footer：回退链改为 `siteName → legalCompanyName → 不显示`。
- search 页标题：`formatTitle('Search', siteName)`。

### 9.3 测试

- `formatTitle`、`siteIdentity` 规范化：int 纯函数测试。
- `generateTitle`：更新现有 `tests/int/blog-site-integration.int.spec.ts` 中相关断言为由 `siteName` 决定的后缀，并覆盖 `siteName` 缺失的情况。
- Footer 回退：更新 `tests/int/footer-adapter.int.spec.ts`。
- 品牌守卫：一个 int 测试扫描 `src/`（排除 `payload-types.ts`、`src/migrations/`），断言不包含 `Ecolitea`、`Payload Website Template`、`@payloadcms'` 这类字面量。

## 10. 发现但不在本次范围内

- 无。前述 Posts/Categories 重叠问题已拆分到后续设计。

## 11. 实现中确认的 canary.29 差异（2026-11-20）

- 原生侧栏不渲染 `graphics.Icon`：品牌图标改为同时注册到公开插槽 `beforeNavLinks`（显示图标 + 站点名）。
- “创建首个管理员”页没有 Logo 插槽，保持 Payload 原生欢迎页（§4.3 第一行不适用）。
- 匿名访问时客户端配置缺少 `admin.theme`，自动主题不初始化：新增 `admin.components.providers` 中的 `AdminThemeProvider` + `AnonymousThemeSync`，通过公开的 `useTheme()` 设为 `auto`；用户已手动选择主题时不覆盖。该判断读取 `${cookiePrefix}-theme` cookie，属于 Payload 的约定而非文档 API，升级时需复查。
- Dashboard 宽度：`large` 为 2/3、`medium` 为 1/2，因此采用 `recent-quotes: large` + `system-status: small`。
- `public/favicon.svg`、`favicon.ico` 原为模板图标，已替换为中性图标（路径不变，前台无 favicon 时也使用它们）。
- 已保存在内容中的 SEO 标题可能仍带历史品牌后缀，本次不改写内容数据。

