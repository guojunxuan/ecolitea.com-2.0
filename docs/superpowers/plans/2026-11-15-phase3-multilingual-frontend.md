# 第三阶段实施计划：多语言前台

日期：2026-11-15
分支：feature/i18n-consent
Spec：`docs/superpowers/specs/2026-11-15-i18n-region-consent-design.md` §2、§3、§4.7–4.9、§5、§6.1、§7（`ec_preferences`）
依据：
- 路由 spike：`git show spike/i18n-routing:docs/superpowers/reports/2026-11-15-spike-i18n-routing.md`（`38f593e`）——文件布局、`src/proxy.ts`、matcher、`/en` 301、16 个入口 / 26 个文件迁移清单、缓存与预览证据。
- Payload spike：`git show spike/payload-jobs:docs/superpowers/reports/2026-11-15-spike-payload-jobs.md` §6（合并、populate、缓存 key 分区）。
- 第二阶段产物：`src/i18n/config.ts`、`src/plugins/translation/read.ts`（`mergeTranslation`）、`translation-search` 集合、`src/i18n/dictionaries/en.json`、`/next/revalidate`。
执行：Paseo Codex `gpt-6.1-sol` / `xhigh`

## 范围

做：`[lang]` 路由迁移与 `proxy.ts`、`/en` 301、保留 slug 校验与冲突扫描、按语言读取与缓存分区、失效路径改为内部 `/en/...`、未就绪 302、法律页面规则、Metadata/hreflang/sitemap、翻译搜索查询、Redirects 多语言、前端字典接入、语言选择器与 `ec_preferences`、批量补译命令。

不做：新增任何具体目标语言到 `src/i18n/config.ts`（仍只有 `en`；测试用 fixture 配置注入 `de`/`fr` 等）；人工译文；RTL。

**核心验收**：默认配置（仅英文）下，现有英文站点的 URL、内容、行为与 SEO 输出保持不变；现有英文 e2e 继续通过。

## 设计约束（来自 spike，必须遵守）

- `src/proxy.ts`（导出 `proxy`），不建 `middleware.ts`，不导出 `runtime`。Proxy 不读 Cookie / Accept-Language、不查 Payload。
- 前台根布局与全部页面入口移入 `src/app/(frontend)/[lang]/`；同层不能保留 `[slug]`。sitemap 路由、`next/preview`、`next/exit-preview`、`next/revalidate`、`(payload)` 原址不动。`/search` 移入 `[lang]`。
- 第一段为两个字母（可带 `-xx`）一律视为语言段：公开语言 → 放行；`translating` 或未配置 → 404。
- `/en` 与 `/en/:path*` 在 `redirects.ts` 中 `statusCode: 301` 到无前缀（不用 `permanent`），`/en → /` 单独一条规则。
- 缓存 **key 与 tag** 均含语言；所有 `revalidatePath` 使用内部路径（英文 `/en...`，首页 `/en`）。
- 预览 Cookie 可穿过 rewrite；草稿读取保持鉴权与缓存旁路，不进入公开语言缓存。

## 任务

### 任务 1：路由迁移与 proxy

- 按 spike 报告 §3、§8 迁移 26 个文件（`git mv` 保留历史），新增 `src/proxy.ts`（matcher 照报告，扩展名与目录排除覆盖 `public/` 现有目录）、更新 `redirects.ts`（保留现有 IE 规则）。
- `[lang]/layout.tsx`：`generateStaticParams` 返回公开语言；非公开 `lang` → `notFound()`；`<html lang={lang}>`。
- 所有入口的 `params` 类型加入 `lang`；本任务内数据读取仍为英文（`lang` 暂只透传）。
- 更新受路径变动影响的 11 个 `tests/int` 文件（报告 §8 列表）的 import 路径，不改断言语义。
- 测试：新增 `tests/int/i18n-routing.int.spec.ts`（proxy 纯函数：无前缀改写、公开语言放行、translating/未知两字母 404、排除路径不进入）；`corepack pnpm build` 成功（`DISABLE_R2_STORAGE=true`，隔离测试库），英文路由在构建输出中存在。

### 任务 2：保留 slug 校验与冲突扫描

- Pages（及任何生成根级 URL 的集合）服务端 `validate` / `beforeValidate`：slug 匹配两字母（可带 `-xx`）语法 → 拒绝并给出明确错误。
- 新增只读脚本 `scripts/scan-reserved-slugs.ts`：列出违反规则的现有文档（collection、id、slug、状态），**只报告不修改**；执行前打印目标数据库，需显式参数确认非测试库。
- 测试：校验拒绝 `de`、`zh-tw`，允许 `dev`、`d`；脚本对隔离库的输出。

### 任务 3：按语言读取与缓存分区

- 新增 `src/utilities/i18n/getLocalized.ts`：包装 `mergeTranslation`；`locale === 'en'` 直通；其他语言：源必须公开可见（沿用各集合现有 visibility 规则），译文未就绪返回 `null`。
- 改造 `getCachedGlobal`、`getProductBySlug`、blogs/posts/pages/case-studies/categories 的读取函数：签名加入 `locale`，缓存 key 加入 `locale`，tag 增加 `translation:<collection>:<id>:<locale>` 与 `translations:<locale>`（第二阶段失效使用的 tag 名称以 `src/plugins/translation` 实际实现为准）。英文 key 也加入 `'en'`，确保与其他语言不同。
- populate 关系（分类、Media alt/caption、文档标题等）按 spike 报告 §6：批量查询对应译文后合并；缺失时保留英文。合并在呈现层 normalize 之前。
- 草稿 / 预览：不走公开缓存，只读英文草稿（编辑只维护英文）。
- 测试：英文与德文缓存 key 不同；译文就绪时合并、未就绪返回 null；populate 的 Media alt 被翻译；源下线时德文返回 null。

### 任务 4：失效路径改为内部路径

- 所有现有 `revalidatePath` 调用（`src/collections/*/hooks/revalidate*.ts`、`src/{Header,Footer,SiteSettings,Settings}/hooks/*`、`src/hooks/revalidateRedirects.ts`、`propagateCategorySlug.ts` 等）改为通过一个 helper 生成内部路径：英文 `/en/...`（首页 `/en`），并对每个 `live` 语言追加 `/<locale>/...`。
- 第二阶段 `/next/revalidate` 与翻译完成路径同样使用该 helper。
- 测试：更新相关 hook spec 的断言（期望 `/en/...`）；helper 单测。

### 任务 5：页面接入、未就绪与法律页面

- 各入口用 `lang` 调用任务 3 读取函数。目标语言未就绪：302 到对应英文 URL（spec §5）。
- 法律页面（Site Settings Legal 引用的三个 Page）：非英文访问 301 到英文；非英文页面中指向它们的链接直接使用英文地址并标注 `(English)`（文案来自字典）。
- 站内链接：`getContentPath`、`resolveLinkHref`、`CMSLink`、面包屑、分类/分页链接、搜索提交，按当前 `lang` 生成前缀（英文无前缀）。当前语言通过 `[lang]` 参数自上而下传入或用一个最小的 client context（仅客户端组件需要时）。
- 测试：未就绪 302；法律页面 301 与链接；链接 helper 在 en/de 下的输出；现有英文链接不变。

### 任务 6：Metadata、hreflang、sitemap

- `generateMeta` / `buildSiteMetadata`：`alternates.canonical` 为自身语言 URL；`alternates.languages` 包含所有公开且该文档就绪的语言 + `x-default`（英文）。法律页面只有英文。
- 4 个 sitemap：每条 URL 输出所有公开且就绪语言的版本（含 `xhtml:link` 交替关系或分别列出，选其一并与 Google 文档一致）；`translating` 语言不出现。sitemap 路由不移动。
- 测试：元数据与 sitemap 在 en-only 配置下输出与当前一致（快照或精确断言）；fixture `de=live` 时包含德文与 hreflang。

### 任务 7：搜索与 Redirects

- `/[lang]/search`：英文用现有 `search` 集合；其他语言查询 `translation-search`（`locale`、`ready`、源仍公开、`publishedAt` 可见性），结果路径加语言前缀。
- `PayloadRedirects` / `resolveRedirect`：去掉语言前缀后按英文规则匹配，命中内部文档 → 生成当前语言目标；外部 URL 原样；目标未就绪 → 302 到英文。
- 测试：德文搜索只返回德文就绪记录；重定向在 en/de 下的目标。

### 任务 8：前端字典接入

- `src/i18n/getDictionary.ts`：服务端按 `lang` 读取字典（英文读 `en.json`，其他语言读第二阶段生成的字典译文，缺失 key 回退英文）。
- `src/consent/copy.ts` 及 Quote 弹窗等界面文案改为从字典读取，经 props 传入客户端组件（Provider 或参数），不在客户端打包所有语言。
- 测试：en 输出与现有文案一致；de fixture 输出译文；缺失 key 回退。

### 任务 9：语言选择器与 `ec_preferences`

视觉：只用现有 token、`typography.css` role、`src/components/ui`，沿用 Header mega menu 表面样式。Header 结构变更为用户明确批准（spec §6.1）。

- 桌面：`DesktopNav` 搜索链接左侧新增入口（🌐 + 当前语言名），点击在入口下方展开下拉面板，右缘对齐；与 mega menu 互斥；外部点击 / Esc / 再次点击关闭；透明与滚动玻璃 Header 主题下颜色跟随。
- 移动：`MobileNav` 顶栏改为“菜单 · Logo · 🌐 · 🔍”，地球按钮打开全屏面板。
- 面板：按 `group` 分组列出 `regions` 中公开语言的地区，每行“地区名 · 语言名”，当前地区 ✓（客户端读取 `ec_preferences`；无 Cookie 时按当前语言标记第一个匹配地区）。
- 点击：写 `ec_preferences`（地区代码，12 个月，`Path=/; SameSite=Lax`，HTTPS 加 `Secure`），跳转当前页面的目标语言地址；目标页未就绪 → 跳到目标语言首页并带查询参数，首页顶部显示“该页面暂无 <语言> 版本”（字典文案）。
- 默认配置只有一种语言时：**不渲染入口**（避免无意义的控件）。
- 设置面板“清除地区偏好”沿用第一阶段实现。
- 测试：组件单测（分组、✓、互斥、键盘、焦点回到入口、单语言不渲染）；定向 e2e `tests/e2e/language-switcher.e2e.spec.ts`（fixture `de=live`，桌面 1440 / 移动 390：打开面板、切换、Cookie 写入、URL 前缀、未就绪跳转提示、面板与 Cookie 设置面板互斥）。

### 任务 10：批量补译命令

- `scripts/translation-backfill.ts`：为指定 `--locale`（必须是 `translating`/`live`）把所有当前公开的源文档、Globals、Media、字典按 spec §4.6 优先级（首次补译）入队；`--dry-run` 只统计数量与预计字符数；执行前打印目标数据库与语言并要求 `--confirm`。不修改源内容。
- 文档更新 `docs/deployment.md`：上线新语言流程（加 `translating` → 部署 → backfill → 状态列表完成度 → 冲突扫描 → 改 `live` → 部署）。
- 测试：dry-run 统计；实际入队数量与优先级（隔离库、stub provider）。

## 验证汇总

只运行本阶段新增/修改的 spec、受影响的现有 spec（路径迁移涉及的 11 个文件、hook spec、footer/header/consent spec），以及：

```bash
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
DISABLE_R2_STORAGE=true corepack pnpm build        # 隔离测试库
corepack pnpm test:e2e tests/e2e/language-switcher.e2e.spec.ts
corepack pnpm test:e2e tests/e2e/cookie-consent.e2e.spec.ts tests/e2e/website-shell.e2e.spec.ts tests/e2e/frontend.e2e.spec.ts
```

最后一组 e2e 用于确认英文站点无回归（路由迁移影响全部页面，这是本阶段必须的回归范围）。集成与 e2e 使用隔离数据库，不访问 Google 或生产服务。

## 提交

每个任务一个提交，Conventional Commits，scope `i18n`（任务 2 `pages`，任务 4 `revalidate`，任务 9 `header`，任务 10 `translation`）。
