# Settings Global · Blog Listing Hero 设计文档

**日期**：2026-10-09
**状态**：设计已确认，待实施
**作者**：Claude + Jason
**概念图**：`output/blog-listing-hero-concept/index.html`（Admin 侧栏 + `/blogs` 实时预览）

---

## 1. 概述

### 1.1 目标

Blog 的列表页与详情页在前端都是**固定模板**：布局、层级、样式以及"槽位出现在哪里"由代码决定；槽位里的**内容**由编辑在 Admin 中管理。

本次为 Blog 列表页模板提供第一个内容槽位：**Listing page › Hero**。它替换列表页当前硬编码的 `<h1>Blogs</h1>` 标题区。

### 1.2 范围

1. 新建 Payload Global `settings`，用于承载各业务模块的全局配置；本次只包含 Blog 一个 tab。
2. Blog tab 下建立 `listing.hero` 字段组（启用开关、标题、描述、图片、Header 主题）。
3. 新建前端展示组件 `BlogListingHero` 并在 `/blogs`、`/blogs/page/N` 渲染。
4. 读取、缓存与失效链路（`getCachedSettings` + `revalidateTag('global_settings')`）。
5. 本次功能范围内的集成测试与浏览器验证。

### 1.3 不在本次范围

- Blog **详情页**（`article`）的可管理槽位。本次不创建空分组；未来出现真实槽位时再新增 `blog.article`。
- 其他业务模块的 Settings tab（如 Case Studies）。
- Hero 布局/样式的可配置化（大/中/小布局、对齐方式等）。布局归代码所有。
- 分类页 Hero：分类页不读取 Hero。
- 详情页当前硬编码的 `More to read` 标题。

---

## 2. 背景与设计原则

### 2.1 模板与槽位分离

| 归属 | 决定什么 |
| --- | --- |
| **代码（模板）** | 布局、层级、间距、排版、响应式行为、槽位在页面中的位置 |
| **CMS（槽位内容）** | 该槽位显示什么内容：文案、图片、以及影响模板少量表现分支的语义选项（如 Header 主题） |

因此 Hero **不复用** Pages 的 `hero` 字段（其 `type` 选择会让编辑决定 High/Medium/Low 布局），而是定义只描述内容的字段组。

### 2.2 与现有 Global 的关系

现有 Globals：`Header`、`Footer`、`SiteSettings`。新增 `settings` 与之并列。

- `SiteSettings`：站点级公共身份（站名、品牌、联系方式、社交、法务）。
- `settings`：**按业务模块组织的配置**。业务边界即 tab 边界。

### 2.3 扩展方式

- 列表页新增内容槽位 → 在 `blog.listing` 中 Hero 之后追加字段组。
- 详情页新增内容槽位 → 新增 `blog.article` 分组。
- 新增业务模块 → 在 Settings 的 `tabs` 中追加 tab。

---

## 3. 数据模型

### 3.1 Global

| 项 | 值 |
| --- | --- |
| slug | `settings` |
| label | `Settings` |
| interfaceName | `Settings` |
| access.read | `anyone` |
| access.update | `authenticated` |
| versions | `false` |
| hooks.afterChange | `[revalidateSettings]` |

### 3.2 字段结构

```
settings
└─ tabs
   └─ [Blog]  ← named tab: name 'blog'
      └─ listing  (group)
         └─ hero  (group)
```

数据路径：`settings.blog.listing.hero`

命名 tab（`name: 'blog'`）而非匿名 tab，使数据按业务分包，类型为 `Settings['blog']`，前端无需理解 Admin 的 tab 概念。

### 3.3 Hero 字段

| name | type | 约束 | 说明 |
| --- | --- | --- | --- |
| `enabled` | checkbox | `defaultValue: false` | 关闭后隐藏 Hero，**保留已填写内容** |
| `heading` | text | 启用时必填、trim 后非空 | 渲染为 `<h1>` |
| `description` | textarea | 可选、trim | 渲染为段落 |
| `image` | upload → `media` | 可选、仅图片 | 背景图 |
| `headerTheme` | select `light` \| `dark` | `defaultValue: 'light'` | 与 `src/heros/config.ts` 的 `headerTheme` 选项一致 |

**Admin 可见性**：`heading`、`description`、`image`、`headerTheme` 使用 `admin.condition: (_, siblingData) => siblingData?.enabled === true`，未启用时隐藏。隐藏字段的值照常保存在数据库中，因此关闭再打开不会丢内容（对应现有 Header `enableMenuCta → menuCta` 的做法）。

**标题校验**：服务端校验必须保护每一次写入。使用 `hooks.beforeValidate: [trimText]` 去除首尾空白，并配合只在启用时生效的 `validate`（纯空白视为空）。参考 `src/SiteSettings/fields/validation.ts` 的 `trimText` / `validateNonBlankText`，新增一个"条件必填"变体，不修改既有导出。

**图片类型限制**：`media` collection 同时接受图片与 MP4 视频，图片字段必须用 `filterOptions` 限定为 `MEDIA_UPLOAD_POLICY.image.mimeTypes`，避免编辑选中视频。

```ts
filterOptions: { mimeType: { in: [...MEDIA_UPLOAD_POLICY.image.mimeTypes] } }
```

**Admin 文案**：全部使用英文 `admin.description`，与现有 tab 与字段保持一致。Header 主题字段的说明需明确选择依据：

> Use Dark for dark images (white text and header), Light for bright images or no image.

### 3.4 遵循的项目规范

- 全部使用 Payload 原生字段与 Admin 插槽，不新建任何自定义 Admin 组件、不写 Admin CSS（AGENTS.md：优先原生 Admin 行为）。
- 文案与结构在 Payload 配置中表达，不在前端硬编码业务规则。
- 生成物 `src/payload-types.ts`、`src/app/(payload)/admin/importMap.js` 由命令重新生成，不手改。

---

## 4. 前端

### 4.1 组件

**新增 `src/heros/BlogListingHero/`**（`index.tsx` + `index.module.css`）

- 输入是一个**展示模型**，不接触 Payload 原始结构：

```ts
type BlogListingHeroModel = {
  heading: string
  description?: string | null
  image?: Media | number | null
  headerTheme: 'light' | 'dark'
}
```

- 固定模板结构（代码所有）：
  - 整幅横幅，凭 `data-hero` / `data-header-theme` 属性控制主题分支。
  - 有图片：`Media` 作为背景（`priority`、`fill`），叠加 `--website-scrim-*` 对比遮罩；文案左对齐、位于站点容器内、贴底。
  - 无图片：退化为文字横幅，背景使用 `--website-color-muted-surface`（light）或 `--website-color-brand-black`（dark）。
  - 复用 `HeaderThemeSync`，使 Header 前景色跟随 Hero。
- 样式只消费 `--website-*` token，不新增全局原子类。

**浅色/深色由编辑选择（已确认）**：模板不分析图片明暗、不做自动判定。深色图片必须选 Dark，浅色图片或无图选 Light；该规则写在字段的 `admin.description` 中。原因是自动判定需要引入图像分析依赖与额外失败面，而编辑在 Admin 中能直接看到自己选的图片。

### 4.2 归一化

**新增 `src/utilities/blogs/getBlogListingHero.ts`**

- 调用 `getCachedSettings()`，返回 `BlogListingHeroModel | null`。
- 返回 `null` 的条件：Global 未保存、`enabled` 非真、`heading` trim 后为空。
- 图片为关系 ID 或对象都可处理；`getCachedSettings` 使用 depth 1 时关系已被填充。

### 4.3 渲染位置与规则

`src/app/(frontend)/blogs/listing.tsx` 的 `renderBlogListing`：

| 场景 | 结果 |
| --- | --- |
| `/blogs`、`/blogs/page/N`，有 Hero | 顶部渲染 `<BlogListingHero />`，**不再渲染**默认 `<h1>Blogs</h1>` |
| `/blogs`、`/blogs/page/N`，无 Hero | 保持当前默认标题区不变 |
| `/blogs/category/[slug]` 及分页 | 不读取 Hero，页面不变 |

- 分类 tabs 与列表始终渲染在 Hero 之后。
- 有 Hero 时列表容器顶部间距相应调整（`.page` / `.list` 的 padding），避免 Hero 与 tabs 之间出现双倍留白。
- 无 Hero 时页面与当前版本像素一致。
- `generateMetadata` 不读取 Hero，title/description/canonical 保持现状。

### 4.4 缓存与失效

- `src/utilities/getGlobals.ts` 新增 `getCachedSettings = () => getCachedGlobal('settings', 1)()`，与其他 `getCached*` 一致，集中拥有 slug、depth、缓存 key 与 tag。
- `src/Settings/hooks/revalidateSettings.ts`（`GlobalAfterChangeHook`）：`revalidateTag('global_settings', 'max')`，并遵循 `context.disableRevalidate`，参考 `revalidateSiteSettings`。
- `/blogs` 为 `force-static` + `revalidate = 600`，tag 失效后静态页随访问重新生成。

---

## 5. 文件清单

**新增**

- `src/Settings/config.ts`
- `src/Settings/fields/index.ts`
- `src/Settings/fields/blog.ts`
- `src/Settings/fields/validation.ts`（条件必填）
- `src/Settings/hooks/revalidateSettings.ts`
- `src/heros/BlogListingHero/index.tsx`
- `src/heros/BlogListingHero/index.module.css`
- `src/utilities/blogs/getBlogListingHero.ts`
- `tests/int/settings.int.spec.ts`
- `tests/int/blog-listing-hero.int.spec.tsx`

**修改**

- `src/payload.config.ts`：`globals` 追加 `Settings`
- `src/utilities/getGlobals.ts`：追加 `getCachedSettings`
- `src/app/(frontend)/blogs/listing.tsx`：列表页渲染与间距分支
- `src/app/(frontend)/blogs/listing.module.css`：Hero 存在时的间距
- `tests/int/blog-listing-ui.int.spec.tsx`：补充 Hero 分支用例
- `src/payload-types.ts`、`src/app/(payload)/admin/importMap.js`：命令重新生成

---

## 6. 测试

只做本次功能相关测试，不跑全局 e2e 套件（既有约定）。

**`tests/int/settings.int.spec.ts`（schema 与配置）**

1. `settings` Global 的 slug、label、access、`versions: false` 与现有 Global 约定一致。
2. Tabs 结构：`blog` 为命名 tab，其下为 `listing` group → `hero` group。
3. `enabled` 默认 `false`；`headerTheme` 默认 `light`，选项为 `light` / `dark`。
4. `heading` / `description` / `image` / `headerTheme` 的 `admin.condition` 仅在 `enabled === true` 时显示。
5. 图片字段 `filterOptions.mimeType.in` 等于 `MEDIA_UPLOAD_POLICY.image.mimeTypes`。
6. 校验：启用且 `heading` 为纯空白 → 校验失败；启用且有内容 → 通过；未启用时不做必填校验。
7. `revalidateSettings` 调用 `revalidateTag('global_settings', 'max')`，且在 `context.disableRevalidate` 时不触发。

**`tests/int/blog-listing-hero.int.spec.tsx`（纯函数与组件）**

1. `getBlogListingHero`：未保存 / `enabled: false` / `heading` 空白 → 返回 `null`；完整数据 → 返回展示模型。该函数直接依赖 `getCachedSettings`，测试中对该模块做 mock，不连数据库。
2. `BlogListingHero`：有图片渲染媒体与遮罩；无图片渲染文字横幅；`headerTheme` 反映到 `HeaderThemeSync`。

**`tests/int/blog-listing-ui.int.spec.tsx`（列表页分支）**

1. 有 Hero：渲染 `BlogListingHero`，且不再出现默认 `<h1>Blogs</h1>`。
2. 无 Hero / `enabled: false` / `heading` 空白：默认标题区保持渲染。
3. 分类页：不渲染 Hero。

**命令**

```bash
corepack pnpm exec vitest run tests/int/settings.int.spec.ts tests/int/blog-listing-hero.int.spec.tsx tests/int/blog-listing-ui.int.spec.tsx
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
```

`tests/int` 需要 MongoDB；数据库连接失败要与应用回归分开判断。

## 7. 浏览器验证

在本地开发服务器上检查 `/blogs`：

- 带图 + Dark（Header 变白）、带图 + Light、无图 + Light、无图 + Dark、未启用（回到当前页面）。
- 桌面与移动宽度各一遍，确认遮罩方向、文案换行、Header 主题与列表间距。
- 打开 `/blogs` 确认 `h1` 唯一，仅在 Hero 存在时来自 Hero。

## 8. 验收标准

1. Admin 中 Globals 出现 `Settings`，其 Blog tab 下可编辑 Listing page Hero；未启用时其余字段隐藏，保存后重新打开内容仍在。
2. 启用并填写标题后，`/blogs` 与 `/blogs/page/N` 顶部显示 Hero，且不再有默认标题；分类页不受影响。
3. 关闭 `enabled` 后页面回到当前形态，数据未丢失。
4. 保存 Settings 后列表页内容更新，无需重新部署。
5. `payload-types.ts` 与 `importMap.js` 已重新生成；本次测试、tsc、lint 通过。
