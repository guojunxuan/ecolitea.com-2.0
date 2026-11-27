# Phase 3 多语言前台实施与验证报告

日期：2026-11-16。分支：`feature/i18n-consent`。起点：`3f82299`。

## 结果与范围

任务 1–10 已实现。默认 `src/i18n/config.ts` 仍只有 English / Global；没有新增生产语言、依赖或 lockfile 改动。所有目标语言验证通过注入 fixture 完成。主 checkout 没有切换或创建分支；未修改生产内容、基础设施或远端存储。

最终定向验证：51 个 integration spec / 451 项通过；语言切换 E2E 3 项通过；英文回归 E2E 29 项通过；TypeScript、lint、build 通过。lint 有 10 个既有 warning。没有运行完整 E2E suite。

## 逐任务提交

| 任务 | 主分支提交 | Subject |
|---|---|---|
| 1 | `7e75d6c` | feat(i18n): migrate public routes under locale root |
| 2 | `b6929fb` | feat(pages): reserve language-shaped root slugs |
| 3 | `c09a8bb` | feat(i18n): partition public reads and caches by locale |
| 4 | `18083b5` | fix(revalidate): invalidate locale rewrite destinations |
| 5 | `e78f66c` | feat(i18n): render localized pages and internal links |
| 6 | `faf1a1d` | feat(i18n): publish ready locale metadata and sitemaps |
| 7 | `b189041` | feat(i18n): localize frontend search and redirect destinations |
| 8 | `2736bfc` | feat(i18n): localize frontend interface copy |
| 9 | `ecde34c` | feat(header): add region and language switching |
| 10 | `5d01f8a` | feat(translation): add public content backfill command |

另有两项独立提交：

- `0f58f6a fix(i18n): align readiness and invalidation with public routes`：按用户要求保留独立审查修复提交。修正翻译就绪筛选先于分页、源可见性一致性、Lexical 关系合并、Page Archive 查询、资源链接与真实动态路由失效模式。
- `74af259 test(i18n): align branch fixtures with consent and Admin ownership`：按用户明确指示单独修复 Phase 1 Footer 测试缺少 ConsentProvider、Phase 2 Admin 组件被前台类名审计误扫。只改两个测试配置；审计排除仅限 `src/plugins/translation/admin/`。

以上每个提交均包含要求的 Co-Authored-By trailer。

## 委派与集成

所有编辑型子代理仅在自己的 `/tmp` git worktree 工作，未并发编辑主 checkout。

| 任务 | worktree | 子代理提交 → 主分支提交 |
|---|---|---|
| 2 | `/tmp/ecolitea-phase3-slugs` | `547a54d` → `b6929fb` |
| 6 | `/tmp/ecolitea-phase3-dictionary` | `5e3f0de` 在隔离 worktree 解决 Task 5 冲突后变为 `d2059df` → `faf1a1d` |
| 7 | `/tmp/ecolitea-phase3-search` | `a98abc4` → `b189041`，集成后补齐源公开规则和静态资源目标回归 |
| 8 | `/tmp/ecolitea-phase3-dictionary` | `19b970b` → `2736bfc`，根布局按 lang 读取字典并补充法律标记测试 |
| 9 | `/tmp/ecolitea-phase3-header` | `3067398` → `ecde34c`，主代理整合目标接口与 notice；仅一个 LocaleProvider |
| 10 | `/tmp/ecolitea-phase3-backfill` | `82d3ede` → `5d01f8a`，集成后重新生成 Payload artifacts |

集成采用 cherry-pick；任务 6 的冲突先在其 worktree 重做，再集成。主代理完成任务 1、3、4、5、审查修复和最终验证。任务 1→3→4→5 依赖顺序保持。各子代理定向测试均在集成后重跑，最终 51 个 spec 覆盖这些任务。规格审查和代码质量审查均无剩余阻塞项。

## 安装版本兼容与偏差

- 用户已批准：Server Component 数据驱动临时跳转使用公开 `redirect()` 的 307；非英文法律页使用 `permanentRedirect()` 的 308。安装版不公开页面内 302/301 API。代码注释、任务 5 提交说明已记录；静态 `/en`、`/en/:path*` 仍为明确的 301。
- 具体路径失效使用 `/en/...` 与 live 语言路径；含动态段的 pattern 失效使用实际物理模式 `/[lang]/...`，否则安装版 Next 的 implicit tag 不匹配。这不改变预期失效范围，原因记录在修复提交。
- 沿用 Phase 2 的 last-ready checkpoint 规则：pending/failed 新任务仍可展示保留的就绪译文，不能只按最新 status=ready 判断。
- 安装版 Payload Jobs 没有 priority 参数。任务 10 使用公开 `meta.translationPriority`、`jobs.processingOrder`，并保存可选 `requestPriority` 以供额度恢复；生成类型与配置同步。
- 英文回归 spec 原本断言存储模式 URL。按用户后续明确指示，最终使用 `DISABLE_R2_STORAGE=false` + `tests/helpers/localS3Server.mjs` 本地 S3；所有 endpoint/key 都由 Playwright 注入本地占位配置，不访问生产。两份英文 spec 的断言没有修改。

## 最终验证命令与结果

以下值均为公开测试占位值，不是生产凭据。集成测试中需要数据库的 spec 通过 `tests/helpers/isolatedDatabase.ts` 生成带 `phase3` 的独立本地库。E2E 使用下列明确的 run-scoped 库。

### 定向 integration：51 个文件，451 passed，exit 0

```bash
DISABLE_R2_STORAGE=true JOBS_AUTORUN=false GOOGLE_TRANSLATE_API_KEY= \
DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-phase3-int \
corepack pnpm test:int \
  tests/int/blog-category-seo.int.spec.ts \
  tests/int/blog-detail.int.spec.tsx \
  tests/int/blog-listing-seo.int.spec.ts \
  tests/int/blog-redirects.int.spec.ts \
  tests/int/blog-routes.int.spec.tsx \
  tests/int/blog-search-results.int.spec.tsx \
  tests/int/blog-sitemap.int.spec.ts \
  tests/int/blogs-hooks.int.spec.ts \
  tests/int/consent-gtm.int.spec.ts \
  tests/int/consent-provider.int.spec.tsx \
  tests/int/consent-state.int.spec.ts \
  tests/int/consent-ui.int.spec.tsx \
  tests/int/footer-adapter.int.spec.ts \
  tests/int/footer-component.int.spec.tsx \
  tests/int/footer-payload-depth.int.spec.tsx \
  tests/int/frontend-module-visual-roles.int.spec.ts \
  tests/int/frontend-style-architecture.int.spec.ts \
  tests/int/generate-meta.int.spec.ts \
  tests/int/get-globals-cache.int.spec.ts \
  tests/int/header-component.int.spec.tsx \
  tests/int/header-desktop.int.spec.tsx \
  tests/int/header-mobile-navigation.int.spec.tsx \
  tests/int/i18n-archive.int.spec.tsx \
  tests/int/i18n-dictionary.int.spec.tsx \
  tests/int/i18n-language-target.int.spec.ts \
  tests/int/i18n-legal-links.int.spec.tsx \
  tests/int/i18n-links.int.spec.ts \
  tests/int/i18n-localized.int.spec.ts \
  tests/int/i18n-page-access.int.spec.ts \
  tests/int/i18n-revalidation.int.spec.ts \
  tests/int/i18n-routing.int.spec.ts \
  tests/int/i18n-search-redirects.int.spec.ts \
  tests/int/i18n-seo.int.spec.ts \
  tests/int/i18n-sitemaps.int.spec.ts \
  tests/int/language-switcher.int.spec.tsx \
  tests/int/layout-primitives.int.spec.tsx \
  tests/int/products-mobile-cards.int.spec.ts \
  tests/int/products-pages.int.spec.tsx \
  tests/int/products-revalidation.int.spec.ts \
  tests/int/products-site-integration.int.spec.ts \
  tests/int/products-sitemap.int.spec.ts \
  tests/int/quote-request-form.int.spec.tsx \
  tests/int/quote-request-presentation.int.spec.tsx \
  tests/int/quote-request-utils.int.spec.ts \
  tests/int/reserved-slug-scan.int.spec.ts \
  tests/int/reserved-slug-writes.int.spec.ts \
  tests/int/reserved-slugs.int.spec.ts \
  tests/int/revalidate-route.int.spec.ts \
  tests/int/search-query.int.spec.tsx \
  tests/int/translation-backfill.int.spec.ts \
  tests/int/website-shell.int.spec.tsx
```

### TypeScript / lint / 生成 artifacts

```bash
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
DISABLE_R2_STORAGE=true NODE_ENV=test DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-phase3-types corepack pnpm generate:types
DISABLE_R2_STORAGE=true NODE_ENV=test DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-phase3-types corepack pnpm generate:importmap
git diff --check
```

全部 exit 0。lint：0 errors / 10 既有 warnings。types 与 import map 在集成树上重新生成后没有额外差异。

### Build：exit 0

为避免 Payload Admin 的 next/font 在验证时访问 Google，使用 Next 自带的测试响应入口：

```js
// /tmp/phase3-fonts.cjs，仅验证环境，不进入仓库
module.exports = new Proxy({}, {
  get: () => '@font-face { font-family: "Mock"; src: local("Arial"); }',
})
```

```bash
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/tmp/phase3-fonts.cjs \
DISABLE_R2_STORAGE=true JOBS_AUTORUN=false GOOGLE_TRANSLATE_API_KEY= \
DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-phase3-build \
PAYLOAD_SECRET=phase3-only-secret-with-at-least-32-characters \
NEXT_PUBLIC_SERVER_URL=http://localhost:3120 CRON_SECRET=phase3-test PREVIEW_SECRET=phase3-test \
R2_BUCKET=phase3-unused R2_ACCESS_KEY_ID=phase3-unused R2_SECRET_ACCESS_KEY=phase3-unused \
R2_ENDPOINT=https://storage.example.invalid R2_PUBLIC_URL=https://media.example.invalid \
corepack pnpm build
```

build / postbuild 成功；输出包含 `/en`、`/en/blogs`、`/en/posts`、`/en/products` 及全部 `[lang]` 路由，sitemap / preview / Payload 入口保持原位置。

### 语言选择器 E2E：3 passed，exit 0

```bash
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/tmp/phase3-fonts.cjs \
DISABLE_R2_STORAGE=true JOBS_AUTORUN=false GOOGLE_TRANSLATE_API_KEY= \
DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-phase3-lang-final-20261116-e2e \
PLAYWRIGHT_E2E_RUN_ID=phase3-lang-final-20261116 PLAYWRIGHT_PORT=3113 PLAYWRIGHT_STORAGE_PORT=9113 \
PAYLOAD_SECRET=phase3-only-secret-with-at-least-32-characters \
CRON_SECRET=phase3-test PREVIEW_SECRET=phase3-test R2_BUCKET=phase3-unused \
corepack pnpm test:e2e tests/e2e/language-switcher.e2e.spec.ts
```

覆盖 1440px / 390px 打开面板、地区选择、Cookie、语言前缀、不可用页面首页提示、与 Cookie 设置面板互斥。fixture 为 de=live / fr=translating，生产配置仍 en-only。

### 英文回归 E2E：29 passed，exit 0

```bash
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/tmp/phase3-fonts.cjs PHASE3_I18N_FIXTURE=false \
DISABLE_R2_STORAGE=false JOBS_AUTORUN=false GOOGLE_TRANSLATE_API_KEY= \
DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-phase3-english-storage-final-20261116-e2e \
PLAYWRIGHT_E2E_RUN_ID=phase3-english-storage-final-20261116 PLAYWRIGHT_PORT=3114 PLAYWRIGHT_STORAGE_PORT=9114 \
PAYLOAD_SECRET=phase3-only-secret-with-at-least-32-characters \
CRON_SECRET=phase3-test PREVIEW_SECRET=phase3-test R2_BUCKET=phase3-unused \
corepack pnpm test:e2e tests/e2e/cookie-consent.e2e.spec.ts tests/e2e/website-shell.e2e.spec.ts tests/e2e/frontend.e2e.spec.ts
```

仅运行 Cookie consent、website shell、frontend 三个指定文件；原英文 URL、关联卡片、Header/Footer 响应式几何与导航、授权行为通过回归。

## 过程中的失败与复验

- 早期 build 的 MongoDB 连接被沙箱 EPERM 阻止；按权限流程重跑后通过。这是环境限制，不是应用回归。
- 早期安装版 Payload Admin 尝试下载 Google Fonts，DNS 失败；后续所有最终构建使用上面的 mock，没有成功的 Google Fonts 下载。未调用真实 Google Translation。
- 最初最终 integration 为 449 passed / 2 failed：Footer 缺少 ConsentProvider、Admin 类名误入前台审计。用户确认纳入后单独提交测试配置修复；两项 spec 25 passed，最终全组 451 passed。
- 英文 E2E 误用本地文件模式时为 7 passed / 2 failed / 20 未运行，失败在存储 URL 断言和种子检查，并未到 Header 几何断言。两份 spec 的试改已按用户要求完全撤销；正确的本地 S3 模式复验为 29 passed。没有修改断言来掩盖失败。
- 语言 E2E 服务端曾输出 `The destination stream closed early`，全部 3 项断言仍通过；未将其未经证实地归因为某个具体原因。另有 Mongoose deprecation、未配置 email adapter、NO_COLOR/FORCE_COLOR 与 jsdom scrollTo 提示，均未导致最终失败。

## 未验证与已知边界

- 未验证真实 Google Translation 凭据、线上额度、生产 Jobs 常驻运行或容器部署后的反向代理同源 rewrite；只用了 stub/provider-free 测试和本地 standalone 浏览器运行。
- 没有向生产数据库、Google Translation 或远端 R2 写入；没有部署、push、合并主分支。
- 非阻塞边界：自定义分类分页 redirect 的分页可用性最终由页面读取层校验；可能先到当前语言地址，再 307 到英文。最终目标正确，不会展示未就绪译文。
- RTL、人工翻译和添加真实目标语言均不在本阶段范围。
- 浏览器截图、Playwright 输出、测试数据库和临时字体 mock 均未提交。
