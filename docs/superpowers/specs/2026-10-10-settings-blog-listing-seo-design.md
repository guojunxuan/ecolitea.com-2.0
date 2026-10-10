# Settings · Blog 列表页 SEO 设计

**日期**：2026-10-10
**状态**：设计已确认，待实施计划

## 目标与范围

在现有 Payload Global `settings` 的 Blog 标签中增加列表页 SEO，让编辑管理 `/blogs` 及 `/blogs/page/N` 的搜索标题、描述和社交分享图片。SEO 内容独立于 `listing.hero.enabled`；关闭 Hero 不影响 SEO。

分类列表页和博客文章页不读取这组设置。分类页继续使用分类名称、描述及自己的 canonical；文章页继续使用每篇文章的 SEO 标签。本次不添加可编辑 robots、canonical、关键词或结构化数据，也不改站点级 SEO 默认值。

## 现状与选择

`src/app/(frontend)/blogs/listing.tsx` 当前为列表页生成固定标题、描述和每页 canonical。文章在 `src/collections/Blogs/index.ts` 中手动使用 `@payloadcms/plugin-seo/fields` 的字段，页面再把保存值写入 Next.js Metadata。Settings 的 Blog 标签已有 `listing.hero`，适合在同一个 `listing` 组中追加 SEO。

采用**手动复用 SEO 插件字段**：后台路径为 `Globals → Settings → Blog → Listing page → SEO`，保存路径为 `settings.blog.listing.seo`。插件的 `globals: ['settings']` 自动注入方案会把 SEO 放在整个 Settings 顶层，与业务归属不符；普通 Payload 字段虽然可用，但与文章的 SEO 编辑体验不一致。

当前站点级 Open Graph 默认值、Twitter creator 仍含 Payload 模板品牌文案。这是独立的站点级 SEO 整理事项，不随本功能暗中修改。列表页未填写分享图片时沿用现有站点默认图。

## 内容模型与 Admin

在 `src/Settings/fields/blog.ts` 的 `listing` group 中，Hero 后增加 `seo` group（标签 `SEO`）。复用插件的 `OverviewField`、`MetaTitleField`、`MetaDescriptionField`、`MetaImageField`、`PreviewField`，并把概览/预览路径指向 `blog.listing.seo.title`、`.description` 和 `.image`。标题和描述的生成按钮调用已有 SEO 插件的生成端点；为 `globalConfig.slug === 'settings'` 增加列表页默认标题、描述和 `/blogs` URL 分支，不改变现有 Collection 的生成结果。不启用插件对整个 Settings Global 的自动字段注入。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `title` | SEO 插件文本字段 | 可选；保存前 trim；空值使用当前 `Blogs` 默认标题 |
| `description` | SEO 插件描述字段 | 可选；保存前 trim；空值使用当前列表描述 |
| `image` | SEO 插件 Media 上传关系字段 | 可选；仅允许图片 MIME；空值使用站点默认分享图 |

图片选择器使用 `MEDIA_UPLOAD_POLICY.image.mimeTypes` 限定可选内容。Settings 的服务端 Global 校验也要验证实际 Media MIME，覆盖 Admin、Local API、REST API 及隐藏字段写入；验证不能删除或改写未启用字段的已存数据。不存在或尚未填入的 SEO 组必须合法，以兼容已有 Settings 文档。重新生成 `src/payload-types.ts` 和 import map，不能手改生成物。

## 前端元数据

`blogListingMetadata` 只在未筛选列表读取缓存的 Settings。保留现有 `force-static`、`revalidate = 600`、列表查询和页面正文。建立一个小的服务端归一化边界，将 Settings 中的 SEO 字段转换为标题、描述和可用的 Media 图片；无效/未填值落回当前默认值。关系只有 ID 或图片缺少 URL 时，使用站点默认分享图，不输出失效 URL。

| 路由 | 标题 | 描述 | 分享图片 | canonical |
| --- | --- | --- | --- | --- |
| `/blogs` | 自定义标题，否则 `Blogs` | 自定义描述，否则当前默认描述 | 自定义图，否则站点默认图 | `/blogs` |
| `/blogs/page/N` | 基础标题 + ` — Page N` | 基础描述 + ` Page N.` | 与首页相同 | `/blogs/page/N` |
| 分类列表及其分页 | 保持现有分类规则 | 保持现有分类规则 | 保持现状 | 保持现状 |

自定义标题和描述同时用于标准 Metadata 与 Open Graph；分享图片用于 Open Graph 和 Twitter 元数据。媒体 URL 从持久化的原始 Media URL 解析成可公开访问的绝对 URL，不在业务代码中拼接 R2 地址。元数据不读取 Hero 内容，也不因 Hero 关闭而回退。

Settings 继续使用现有 `getCachedSettings()` 和 `global_settings` tag。Global 保存时的 `revalidateSettings` hook 负责使列表页的静态元数据随访问刷新，无需重新部署；沿用 Next.js 的 stale-while-revalidate 行为，不承诺保存后第一个请求必然立即返回新值。

## 验收与验证

- Admin 中 SEO 位于 Blog → Listing page 下，与 Hero 平级；字段可编辑且重开后保留。插件的生成、概览和预览控件使用正确的嵌套字段路径。
- 旧 Settings 文档无 SEO 字段时，`/blogs` 与分页的现有标题、描述和 canonical 不变。
- 自定义值在 `/blogs` 和第二页生成正确的标准、Open Graph、Twitter 元数据；第二页有页码后缀和独立 canonical。
- 分类页和文章页元数据不读取这组设置；Hero 开关不影响 SEO。
- 图片选择器过滤 MP4，服务端拒绝把视频关系写入 SEO 图片字段；已存在的合法图片不会因不相关的部分更新丢失。
- 定向测试、TypeScript、Lint、隔离数据库构建和浏览器元数据检查通过；数据库与存储目标在数据操作前明确报告。

## 实施边界

遵循 `AGENTS.md`：Payload 配置拥有持久结构；只用 Payload 数据 API；沿用项目缓存与媒体适配边界；读取已安装的 Next.js Metadata/缓存文档和 Payload SEO 插件类型后实施。保留当前分支以及既有未跟踪目录，不改锁文件、`.env`、生产内容或远程存储。
