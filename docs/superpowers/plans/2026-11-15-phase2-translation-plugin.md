# 第二阶段实施计划：翻译插件（后台）

日期：2026-11-15
分支：feature/i18n-consent
Spec：`docs/superpowers/specs/2026-11-15-i18n-region-consent-design.md` §3、§4（含 §4.4 已并入的 spike 结论）、§9
依据：`docs/superpowers/reports/2026-11-15-spike-payload-jobs.md`（分支 `spike/payload-jobs`，`afb2dcb`；实施时用 `git show spike/payload-jobs:<path>` 查阅报告与 `tests/helpers/payloadJobsSpike.ts`、`tests/int/payload-jobs-spike.int.spec.ts`）
执行：Paseo Codex `gpt-6.1-sol` / `xhigh`

## 范围

做：语言配置、`translations` 与 `translation-search` 集合、可翻译字段规则与覆盖测试、字段提取/合并（含 Lexical）、翻译服务适配器（Google v2 REST）与本地桩、额度计数、Jobs 任务与触发 hooks（发布/下线/删除）、带鉴权的缓存失效 Route Handler（并修复 Products 定时发布失效）、管理员只读状态视图、前端字典生成、合并后读取的纯函数。

不做（第三阶段）：`[lang]` 路由与 `proxy.ts`、把读取函数接入页面、缓存 key 分区落地到页面读取、sitemap/hreflang、语言选择器、翻译搜索的前台查询。本阶段结束时前台仍是纯英文，行为不变。

不新增依赖、不改 lockfile（Google 用 `fetch` 调 REST；Lexical 段落转换自写轻量标记，不用 `convertHTMLToLexical`，因其需要 `jsdom`，而 `jsdom` 仅为 devDependency）。

## 现状（已核对）

- `src/payload.config.ts:119` 已有 `jobs`（`CRON_SECRET` 鉴权、`tasks: []`）；定时发布会自动注入原生 `schedulePublish` 任务。
- drafts：Products、Blogs、Posts、CaseStudies、Pages 开启（autosave）；BlogCategories、Categories、ProductCategories 未开启。Globals：`header`、`footer`、`site-settings`、`settings`。
- Products 公开状态迁移：`src/collections/Products/hooks/productPublicTransition.ts`（beforeOperation / beforeChange / beforeDelete），其最终消费方会清空状态——翻译 hook 不得假设快照在其之后仍存在，需在同一消费点获取结果。
- 现有失效 hooks：`src/collections/*/hooks/revalidate*.ts`、`src/{Header,Footer,SiteSettings,Settings}/hooks/*`、`src/hooks/revalidateRedirects.ts` 等直接调用 `next/cache`。
- 搜索：`@payloadcms/plugin-search`（`src/plugins/index.ts:301`、`src/search/beforeSync.ts`、`src/search/visibility.ts`）。
- Form Builder：`src/plugins/index.ts:275`，集合 `forms`。
- 第一阶段界面文案：`src/consent/copy.ts`。

## 模块归属

```
src/i18n/
  config.ts                 语言、地区、状态（spec §3），默认仅 en / Global
  dictionaries/en.json      前端字典源（本阶段先收录 consent 文案与 Quote 弹窗文案的 key，组件仍读 copy.ts，第三阶段切换）
src/plugins/translation/
  index.ts                  插件入口：注册集合、任务、hooks、端点
  collections/translations.ts
  collections/translationSearch.ts
  rules/                    每个 Collection / Global / Block 的可翻译字段声明
  extract.ts / merge.ts     字段路径提取、按稳定 row id 合并
  lexical.ts                段落 ⇄ 标记文本
  provider/types.ts         TranslationProvider 接口（provider-neutral）
  provider/google.ts        Google Cloud Translation v2（REST + API key）
  provider/stub.ts          测试与无凭据环境使用
  quota.ts                  月度字符计数
  task.ts                   翻译任务
  hooks.ts                  发布 / 下线 / 删除 → 入队或失效
  revalidate.ts             调用失效 Route Handler 的客户端
  dictionary.ts             前端字典翻译
src/app/(frontend)/next/revalidate/route.ts   带鉴权的失效端点（与 preview 同目录约定，不进 [lang]）
```

## 任务

### 任务 1：语言配置与环境变量

文件：`src/i18n/config.ts`、`src/utilities/env.ts`、`.env.example`、`src/environment.d.ts`、`tests/int/i18n-config.int.spec.ts`

- 按 spec §3 定义 `sourceLocale`、`locales`（`status: source | translating | live`）、`regions`；导出 `publicLocales`（source + live）、`targetLocales`（translating + live）、`isLocaleSegment(seg)`（两个字母，可带 `-xx`；spec §5 保留 slug 规则）。默认只有 `en` / `GLOBAL`。
- `parseServerEnv` 可选项新增：`GOOGLE_TRANSLATE_API_KEY`、`TRANSLATION_MONTHLY_CHAR_LIMIT`（默认 450000，非正整数报错）、`JOBS_AUTORUN`（`'true'` 时本进程运行任务）、`REVALIDATE_SECRET`。测试默认值使用不可路由占位。
- 无 `GOOGLE_TRANSLATE_API_KEY` 时使用 stub provider 且不入队真实翻译（见任务 6）。

测试：配置派生集合、`isLocaleSegment`、env 解析默认值与非法值。

### 任务 2：两个集合

文件：`collections/translations.ts`、`collections/translationSearch.ts`、`index.ts`、`src/plugins/index.ts`（注册插件）、生成文件、`tests/int/translation-collections.int.spec.ts`

- `translations`：字段 `sourceCollection`（text，Global 用 `global:<slug>`）、`sourceId`、`locale`、`status`（`pending | waiting_quota | ready | failed`）、`requestedSourceVersion`、`lastReadySourceVersion`、`ruleVersion`、`fields`（json：路径 → 译文）、`error`（text）、`characters`（number）、`translatedAt`。唯一复合索引 `sourceCollection + sourceId + locale`。
- `translationSearch`：按 spike 报告 §5 的 schema（含唯一复合索引，`read/create/update/delete` 全部 `() => false`，仅服务端 Local API 写）。
- `translations` 访问：仅管理员可读（复用项目现有管理员判断；若仅有 `authenticated`，按现状使用并在报告中说明），create/update/delete 一律 `() => false`；admin 中列表列 `sourceCollection, sourceId, locale, status, translatedAt`，`admin.group: 'System'`，文档视图只读（字段 `admin.readOnly`）。
- 运行 `corepack pnpm generate:types`、`corepack pnpm generate:importmap`。

测试：唯一索引冲突、访问控制（匿名/普通请求不能读写）、Local API `overrideAccess` 可写。

### 任务 3：可翻译字段规则与覆盖测试

文件：`rules/*.ts`、`rules/index.ts`、`tests/int/translation-rules-coverage.int.spec.ts`

- 每个目标（spec §4.3 范围：products、product-categories、blogs、blog-categories、posts、categories、case-studies、pages、forms、globals header/footer/site-settings/settings 中面向访客的文字）一份规则：字段路径声明为 `translate` 或 `exclude`；Blocks 按 `blockType` 声明；数组/Blocks 按 row `id` 定位。
- 法律页面（Site Settings Legal 引用的 Pages）在任务 6 运行时排除，不在规则层硬编码 ID。
- `RULE_VERSION` 常量；规则变化时递增。
- **覆盖测试**：遍历已 sanitize 的 Payload config，凡 `text`、`textarea`、`richText` 字段（含 Block、array、group、tabs 内）未被规则声明即失败，输出缺失路径。slug、URL、型号等以 `exclude` 显式声明。新增字段/Block 不写规则 → 测试失败。

### 任务 4：提取与合并（纯函数）

文件：`extract.ts`、`merge.ts`、`lexical.ts`、`tests/int/translation-extract-merge.int.spec.ts`

- `extract(doc, rule)` → `{ path, kind: 'text' | 'richtext-paragraph', source }[]`；路径用 row id（如 `layout[id=abc].heading`）。
- `merge(doc, fields, rule)`：深拷贝后只写允许的路径；路径不存在（row 已删）则跳过；不改 id、slug、关系、媒体、数字。
- `lexical.ts`：对每个块级节点（paragraph、heading、listitem、quote），把内联子节点序列化为 `<x0>…</x0><x1>…</x1>` 形式（序号对应原子节点，link 节点包裹其子节点，非文本内联节点用自闭合 `<x3/>` 占位），送翻译；返回后按序号还原：文本替换到对应文本节点，保留原 format / link 属性。标签缺失、重复、嵌套不一致 → 该段降级为把整段译文写入第一个文本节点、清空其余文本节点（不抛错，计数 `degraded`）。不翻译 code、upload、relationship、block 节点。
- 文档内相同原文去重。

测试：普通字段、嵌套 Blocks、row 删除后合并、Lexical 带加粗 / 链接 / 换行的往返、标签被打乱时降级、未改动非文字属性。

### 任务 5：翻译服务适配器与额度

文件：`provider/*.ts`、`quota.ts`、`tests/int/translation-provider.int.spec.ts`

- 接口：`translate({ texts: string[]; target: string; source: string; format: 'text' | 'html' }) => Promise<string[]>`。
- Google v2：`POST https://translation.googleapis.com/language/translate/v2?key=…`，每批 ≤ 128 段；HTTP 429/5xx 抛可重试错误，403 额度类错误抛 `QuotaExceededError`。测试一律用 `fetch` 桩，**不访问真实服务**。
- `quota.ts`：本月计数存于 `translations` 之外的轻量记录（建议 Payload Global `translation-usage`，或复用 jobs 无关的集合；选择其一并说明）；`reserve(chars)` 超过 `TRANSLATION_MONTHLY_CHAR_LIMIT` 返回 false；按自然月（UTC）重置。

测试：分批、错误分类、额度预留/拒绝/跨月重置。

### 任务 6：任务与触发 hooks

文件：`task.ts`、`hooks.ts`、`index.ts`、`src/payload.config.ts`（`jobs` 合并插件任务、`autoRun` 由 `JOBS_AUTORUN` 控制、`getPayload({ cron: true })` 初始化方式按 spike §1）、`tests/int/translation-jobs.int.spec.ts`

- 入队条件严格按 spec §4.4：afterChange 完整文档 `_status === 'published'`（无 drafts 的集合与 Globals：每次 change 视为发布）；`select` 省略字段时同 `req` 恢复。法律页面不入队。
- 任务输入：`sourceCollection, sourceId, locale, sourceVersion`（`updatedAt`）；队列 key 为 `sourceCollection:sourceId:locale`，同 key 后入任务覆盖旧任务；首版并发 1。
- 执行：重读源文档（`draft: false`）→ 不公开或版本已变则跳过 → 提取 → `quota.reserve` 不足则 `status: waiting_quota` 并结束 → 翻译 → 写入前再次校验源状态与版本 → 写 `translations`（`context.translationWrite = true`）→ 更新 `translationSearch`（标题、摘要、路径用英文 slug，`ready: true`）→ 调用失效（任务 7）。
- 失败：Jobs 重试；最终失败写 `status: failed` 与 `error`，保留 `fields` 与 `lastReadySourceVersion`。
- `waiting_quota` 恢复：每日一次的计划任务（Jobs schedule）在新月份把 `waiting_quota` 重新入队，按 spec §4.6 优先级（已有 `lastReadySourceVersion` 的更新 → 新内容 → 首次补译）。
- 下线 / 删除：Products 在 `productPublicTransition` 的消费点读取迁移结果；其他 drafts 集合使用 spike 报告 §4 的前后公开状态比较；`afterDelete` 无条件处理。处理内容：删除该文档所有语言的 `translations` 与 `translationSearch` 记录并调用失效。
- 无 `GOOGLE_TRANSLATE_API_KEY` 或 `targetLocales` 为空：hooks 不入队。

测试（stub provider、隔离数据库、`DISABLE_R2_STORAGE=true`）：草稿/autosave 不入队；发布、再次发布、定时发布入队；法律页面不入队；任务成功写 ready；版本变化中途跳过；额度不足进入 `waiting_quota` 并在恢复任务中重新入队；失败重试与最终 failed 保留旧译文；下线与删除清理两个集合；写翻译不触发源 hooks。

### 任务 7：缓存失效 Route Handler

文件：`src/app/(frontend)/next/revalidate/route.ts`、`src/plugins/translation/revalidate.ts`、现有 `src/collections/Products/hooks/revalidateProduct.ts`（及其它在后台任务中可能执行的失效 hook，按实际调用路径判断）、`tests/int/revalidate-route.int.spec.ts`

- 阅读 `node_modules/next/dist/docs/` 中 Route Handler、`revalidateTag`、`revalidatePath` 的安装版文档后实现。
- `POST`，`Authorization: Bearer ${REVALIDATE_SECRET}`，body `{ tags?: string[]; paths?: string[] }`，校验为字符串数组且数量上限；`revalidateTag(tag, { expire: 0 })`；返回 204。未配置密钥 → 503。
- `revalidate.ts`：服务端 `fetch(NEXT_PUBLIC_SERVER_URL + '/next/revalidate')`，失败抛可重试错误（任务会重试）。
- 修复定时发布：现有失效 hooks 在**无 Next 请求上下文**（Jobs/`schedulePublish`）时改为调用该端点；有请求上下文时保持直接调用。判断方式以安装版 Next 行为为准（例如捕获 `static generation store missing` 再回退到端点），并在代码注释中说明。本阶段**不**修改路径为 `/en/...`（第三阶段）。

测试：鉴权失败 401、未配置 503、合法请求调用 `revalidateTag`（mock `next/cache`）；后台上下文中的 hook 走端点分支。

### 任务 8：前端字典与读取合并函数

文件：`src/i18n/dictionaries/en.json`、`dictionary.ts`、`src/plugins/translation/read.ts`、`tests/int/translation-dictionary-read.int.spec.ts`

- `en.json`：收录 `src/consent/copy.ts` 与 Quote 弹窗等前端界面文案的 key/英文值（组件本阶段不切换）。
- 字典作为 `sourceCollection: 'dictionary'`、`sourceId: 'frontend'` 走同一任务；源版本为 `en.json` 内容哈希；部署启动时若哈希变化则入队（实现于插件 `onInit`，受 `JOBS_AUTORUN` 与凭据约束）。
- `read.ts`：`mergeTranslation(doc, { sourceCollection, sourceId, locale })`：读取 `translations`（`ready` 且 `lastReadySourceVersion` 存在），按规则合并；`locale === sourceLocale` 原样返回。只提供函数与测试，不接入页面。

测试：字典哈希变化入队；合并使用最近一次就绪译文；英文直通；未就绪返回 null 以便调用方 302（spec §5）。

### 任务 9：文档

- `docs/deployment.md`：新增环境变量、Google Cloud Console 每日配额与预算告警设置、`JOBS_AUTORUN` 只在一个实例开启、失效端点与 `REVALIDATE_SECRET`、翻译状态视图位置。
- `.env.example` 同步。

## 验证汇总

只运行本阶段新增/修改的测试：

```bash
DISABLE_R2_STORAGE=true corepack pnpm exec vitest run --config ./vitest.config.mts \
  tests/int/i18n-config.int.spec.ts tests/int/translation-collections.int.spec.ts \
  tests/int/translation-rules-coverage.int.spec.ts tests/int/translation-extract-merge.int.spec.ts \
  tests/int/translation-provider.int.spec.ts tests/int/translation-jobs.int.spec.ts \
  tests/int/revalidate-route.int.spec.ts tests/int/translation-dictionary-read.int.spec.ts
```

外加被修改 hook 所属的现有 spec（如 Products 失效相关），以及：

```bash
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
```

集成测试使用隔离数据库（`tests/helpers/isolatedDatabase.ts`），不访问 Google 或任何生产服务。不运行全量 e2e。

## 提交

每个任务一个提交，Conventional Commits，scope `translation`（任务 1 `i18n`，任务 7 `revalidate`，任务 9 `docs`）。
