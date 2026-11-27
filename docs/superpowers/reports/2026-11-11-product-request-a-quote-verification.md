# Product Request a quote 实施与验证记录

日期：2026-11-11。分支：`feature/products`。起点：`9e2f710`，开工时工作区干净。
按要求保留当前分支，未 push、未创建 PR、未改 lockfile、未新增依赖、未改 `.env`。

## 提交

| Task | Commit | 内容 |
| --- | --- | --- |
| 1 | `9990a9a` | 可选 Turnstile secret / IP salt、测试默认值与 `.env.example` |
| 2 | `9946a75` | 字段规整校验、Turnstile 服务端验证、IP 提取与哈希 |
| 3 | `b0b08a7` | Payload 集合、访问控制、MongoDB 限流、提交 endpoint、生成类型 |
| 4 | `6acfcac` | 原生弹窗、表单、Turnstile widget、移动端布局及生命周期防护 |
| 5 | `c0bdf87` | 产品详情页启用询盘入口，保留 Download 行为 |
| 6 | `fe4d9b6` | Docker / Compose / release 构建参数和运行时变量、README |
| 7 | 本记录所在提交 | 类型兼容调整及最终验证记录 |

每个提交均附 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## 实际执行的验证命令与结果

Vitest 命令前均使用 `DISABLE_R2_STORAGE=true`。数据库测试另指定
`DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test`，测试 helper 实际连接
`127.0.0.1:27017/ecolitea2-quote-requests-<随机UUID>`，打印目标，结束删除同一随机库。
所有 Cloudflare 请求在自动化测试中 mock；真实浏览器仅用官方测试 key。

```sh
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/quote-request-utils.int.spec.ts
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/quote-request-collection.int.spec.ts
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/quote-request-form.int.spec.tsx
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/products-pages.int.spec.tsx -t 'omits an empty Download action'
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/products-pages.int.spec.tsx tests/int/quote-request-form.int.spec.tsx
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/quote-request-utils.int.spec.ts tests/int/quote-request-collection.int.spec.ts tests/int/quote-request-form.int.spec.tsx tests/int/products-pages.int.spec.tsx
```

- Task 1：红灯 `expected undefined to be 'secret'`，1 failed / 1 passed；实现后 2 passed。
- Task 2：先因缺少 `@/utilities/quoteRequests/clientIp` 红灯；实现后 10 passed，补边界覆盖后 14 passed。
- Task 3：先因缺少集合模块红灯。第一次连接 MongoDB 被沙箱 `connect EPERM 127.0.0.1:27017` 拒绝，13 项 skipped，属环境权限问题；获准连接后，邮箱长度回归先出现 `promise resolved instead of rejecting`（12 passed / 1 failed），修正后 13 passed。原生邮箱校验响应回归先出现 `expected 500 to be 400`（13 passed / 1 failed），修正后 14 passed。
- Task 4：先因缺少 QuoteRequestDialog 红灯；另以迟到响应回归复现“关闭重开后新表单被旧响应覆盖”，修复后最终 20 passed。覆盖真实 widget 的加载失败、超时、缺 API、回调、过期、reset/remove 和 render 异常。
- Task 5：入口测试先出现 `expected true to be false`。接入后 Download 旧测试误选第一个 dialog，3 failed / 46 passed；改为按 Resources 标题定位后 49 passed。
- 最终四个文件合跑：**4 files passed，77 tests passed**（工具 14、集合 14、表单 20、产品页面 29）。未跑全量 `test:int` 或全局 E2E。

```sh
DISABLE_R2_STORAGE=true NODE_ENV=test DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test corepack pnpm generate:types
DISABLE_R2_STORAGE=true NODE_ENV=test DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test corepack pnpm generate:importmap
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm exec eslint src/components/Products/QuoteRequest src/components/Products/ProductActions 'src/app/(frontend)/products/[category]/[product]/page.tsx' src/collections/QuoteRequests src/utilities/quoteRequests src/utilities/env.ts tests/int/quote-request-*.int.spec.* tests/int/products-pages.int.spec.tsx
corepack pnpm exec prettier --check src/components/Products/QuoteRequest src/collections/QuoteRequests src/utilities/quoteRequests tests/int/quote-request-*.int.spec.*
node --test tests/deploy/
node --test tests/deploy/*.test.mjs
git diff --check
git diff --cached --check
```

- 生成命令成功；`payload-types.ts` 只增加新集合及其关联生成类型（54 行），import map 提示 `No new imports found`，无差异。均未手改。
- 早期 tsc 报 Form 的 `validation` union、隔离 schema fixture、正式类型要求 `status`，以及 ProcessEnv 缺少无关必填属性；逐项修正后最终 tsc exit 0。
- 针对性 ESLint exit 0；Prettier 检查通过。实现文件及测试曾用 `prettier --write` 格式化。
- Node 24 的目录参数失败：`Cannot find module '.../tests/deploy'`；显式匹配 `*.test.mjs` 后 **4 passed**。Compose 对既有可选变量未设置给出 warning，没有测试失败。
- Git 差异检查通过。部分 Git 暂存因沙箱 `index.lock: Operation not permitted` 失败，获准后以相同精确文件列表重试并提交。
- Payload 测试日志有未配置 email adapter 的 warning；本功能不发邮件。

## 浏览器验证

使用 Playwright CLI 技能，先检查 `command -v npx`，执行 wrapper `--help`，再以
`playwright_cli.sh -s=quotes open/snapshot/run-code/eval/close` 操作本地浏览器。
一次 snapshot 因沙箱 DNS `ENOTFOUND registry.npmjs.org` 失败，获准后重试成功。
一次 run-code 回调误用解构参数导致 `getByRole` undefined，改为 CLI 的 `(page)` 参数后继续。

临时脚本在 `/tmp`，服务使用 `next dev --port 3021`、`PLAYWRIGHT_TEST=true`（`.next-e2e`），
不占用原有开发服务。所有环境变量由启动进程注入，未改 `.env`。
明确目标为 `mongodb://127.0.0.1:27017/ecolitea2-quote-browser-test-20261111`，
R2 关闭，媒体初始存于系统临时目录；随后把本次测试图片复制到本地服务期望目录用于页面预览。
初次图片请求因此出现 500（fixture 路径差异），修正临时文件位置后末轮浏览器无 console errors，未改媒体实现。

验证结果：

1. 桌面产品详情页弹窗打开，标题和只读产品名正确，初始焦点在标题。空提交显示字段错误。
2. 官方通过 site/secret 组合自动生成 `XXXX.DUMMY.TOKEN.XXXX`，真实提交 HTTP 200，展示成功确认文案。
3. 同 IP 共 5 次成功入库，第 6 次 HTTP 429 `{ok:false,code:'rate_limited'}`，提示 Too many requests，保留字段。
4. 375 × 667 下弹窗实际为 `x=0,y=0,width=375,height=667`；字段区 `clientHeight=481,scrollHeight=576`，可滚动。提交按钮为 `y=604,height=48`，滚动字段区前后 y 均为 604；截图目视检查通过。
5. Esc 和桌面遮罩关闭后焦点回到 Request a quote。原生 dialog 的焦点行为通过实际键盘操作检查；一次 Shift+Tab 可把焦点交给浏览器界面（body），未据此声称自定义循环焦点锁。组件沿用 DownloadDialog 的原生 dialog 行为。
6. 测试管理员登录 Payload 后台，列表恰有 5 条 New，产品名正确；详情 Product Title 为 Quote Test Paper Bag、Product Slug 为 quote-test-bag，IP hash 无展示。
7. 官方通过 site key + 官方失败 secret：真实 HTTP 403 `{ok:false,code:'verification'}`，显示 Verification failed，保留 Message。已检查桌面遮罩关闭与焦点返回。
8. 计划指定的失败 site key + 失败 secret：组件阶段 token 为空，显示 Verification is unavailable，没有可提交 token。此情形不能直接用于验证 endpoint 的 403 文案，因此额外执行第 7 项。

截图仅保存在 `/tmp`，不提交浏览器快照、日志或测试媒体。
验证后停止专用服务、关闭 quotes 浏览器会话，严格匹配 URI 和库名后删除本次隔离数据库及临时媒体；不删除现有开发数据。

## 与计划的偏离及原因

1. 沿用计划已批准的环境契约偏差：secret/salt 可选，缺失拒绝提交；site key 直接读 `process.env` 作 Next 构建时内联。按用户要求直接在既有 feature/products 分支提交，没有另建 worktree。
2. 安装版本的 Payload `EmailField` 不支持 `maxLength`。改用公开 `validate` 扩展点添加长度校验并调用 `validations.email` 保留原生校验。共享轻量校验与原生校验规则不完全相同，因此增加原生 `ValidationError` 白名单映射，返回 400 validation；其他存储异常仍返回 500。
3. 计划中的隔离 products schema 与正式生成类型不同，fixture 显式标注 `RequiredDataFromCollectionSlug`；直接创建询盘的测试提供 `status:new`。固定测试 secret/salt 后恢复，避免开发 `.env` 干扰。
4. `parseServerEnv` 参数改为 `Partial<NodeJS.ProcessEnv>`，允许校验不完整输入，运行时必填验证不变。原因是项目对 ProcessEnv 有额外必填声明，计划测试中的对象原本无法通过 tsc。
5. 按协调者要求使用已有错误 token `--website-status-error-inline-foreground`，无新增 token。补齐 spec 已要求但计划示例 CSS 漏掉的移动端全宽、字段滚动区及固定底部提交区。
6. 修正计划 Form 响应 `code` union 缺少 validation；产品不可编辑，productSlug 服务端错误作为 notice 展示。补脚本 15 秒超时/缺 API 提示、失败 token 清除，以及卸载后迟到响应保护，均有组件覆盖。
7. Download 测试不能再假定页面只有一个 dialog，改用 Resources 标题定位；没有修改 DownloadDialog 实现。
8. Node 部署测试从目录参数改为文件 glob。浏览器使用进程环境注入的隔离库和官方 key，未写 `.env`；失败 site key 的实际语义及额外失败 secret 组合见上。
9. Task 7 新增本验证记录并提交类型修正，以满足每 Task 一次提交及可审查交付要求。

## 审查、未验证项与范围外发现

后端先做 spec/质量审查，发现邮箱响应和测试环境依赖后修复并复核通过；前端由独立 agent 审查通过；最终页面接入和部署变量审查通过。
核对了安装的 Next server/client、CSS、环境变量指南，Payload Endpoint/CollectionConfig/EmailField/ValidationError 类型，以及 [Payload Beta REST 文档](https://payloadcms.com/docs/beta/rest-api/overview) 和 [Cloudflare 客户端文档](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)。

未验证：真实生产 Turnstile key、生产代理对 X-Forwarded-For 的覆盖行为、真实多实例并发压力、生产部署与镜像构建、Safari/真实移动设备/软键盘。限流检查与写入之间的并发窗口、无法解析 IP 共用 unknown 桶是计划已接受取舍。
隐私政策关于 Turnstile 浏览器信号采集的文案仍需内容负责人上线前补充。

范围外既存问题：基线 Dockerfile 已调用当前 package.json 不存在的 `build:puck-css` script。
本任务仅按范围增加变量，未修此问题，部署配置测试不等于镜像构建验证，不能据此宣称镜像可构建。
