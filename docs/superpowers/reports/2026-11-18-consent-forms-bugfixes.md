# Consent 与表单修复报告

分支：`feature/i18n-consent`。没有 push 或 merge。只暂存本次文件，用户的两个未跟踪目录 `public/demos/visual-refresh-20261117/`、`public/demos/visual-refresh-20261117-v2/` 均保留。

## 提交与改动

- `3dab8cf fix(consent): keep clearing Google cookies after late tag loads`
  - `src/consent/gtm.ts`：在双拒绝/初始化时立即清理，并在 1、3、8 秒补清；重新授予任一权限时取消全部待执行清理。Cookie 匹配和域/path 范围保持原样，只处理 `_ga`、`_ga_*`、`_gcl_*`。
  - `tests/int/consent-gtm.int.spec.ts`：fake timers 覆盖延迟写 Cookie、重授权取消、初始拒绝清理、不清理已授权 Cookie。
- `5e42123 fix(forms): omit empty optional fields from submissions`
  - `src/plugins/formBuilder/submissionData.ts`：前后端共享可选空值规范化，保留 `0` 和 `false`，不省略必填项来绕过校验。
  - `src/collections/Pages/blocks/Form/Component.tsx`：提交前规范化；移除将字段配置数组误作表单 defaultValues 的用法；成功后业务事件行为保持不变。
  - `src/collections/Pages/blocks/Form/Checkbox/index.tsx`：用 React Hook Form Controller 绑定真实 boolean，修正未勾选时提交 `"on"`、绕过 required 的问题。
  - `src/plugins/formBuilder/validateSubmission.ts`、`src/plugins/index.ts`：通过公开 `formSubmissionOverrides.hooks.beforeValidate` 读取实际关联表单，规范化空可选值，并检查缺失/空必填值及必选 checkbox；使用 Payload ValidationError，无私有 API。
  - `tests/int/form-submissions.int.spec.tsx`：可选空 select/number/checkbox、零与 false、必填客户端拦截、成功事件和失败不计事件。
  - `tests/int/email-consumers.int.spec.ts`：实际 Payload+Mongo 写入验证可选空值成功、必填缺失/空值/空白失败、select/number/checkbox 的必填条件，以及现有邮件消费者。
  - `tests/int/block-style-contracts.int.spec.tsx`：原先只期望两个必填错误；现在第三个必选 checkbox 也正确报错，并检查其可访问错误关联。

无依赖、字段 schema 或 Admin 组件注册变化；没有修改生成的 types/importMap。

## 根因

1. `applyConsent` 原先只同步清理一次。Google 的在途初始化可能稍后处理之前已排队的授权并创建 Cookie。现在补清初始化窗口，且每次新决策取消旧计时器，避免重授权后误删合法 Cookie。
2. 已安装 form-builder 插件的 submissionData.value validator 只检查 `typeof value !== 'undefined'`。未选可选下拉的 undefined 在 JSON 中丢失 value，触发 400。插件同时没有按表单配置校验缺失或空必填项；实测缺失 name、空字符串和未选 required checkbox 都曾保存成功。因此除可选值规范化外，补了服务器必填检查。复选框原先错误地用 register 绑定 Radix button，读到默认值 `"on"`，本次改为受控 boolean。

## 验证命令与结果

回归测试均先在修复前观察到预期失败：consent 的延迟 Cookie 清理失败；组件的空可选下拉和未勾选 checkbox 失败；实际 Mongo 用例显示可选 undefined 被拒绝、缺失/空必填项反而被接受。测试夹具缺失 confirmationMessage 的问题修正后，required select/number/checkbox 的回归也确认按预期失败。

最终命令：

```bash
DISABLE_R2_STORAGE=true JOBS_AUTORUN=false DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test corepack pnpm test:int tests/int/consent-gtm.int.spec.ts tests/int/consent-provider.int.spec.tsx tests/int/consent-state.int.spec.ts tests/int/consent-panel-phase4.int.spec.tsx tests/int/consent-copy-phase4.int.spec.ts tests/int/consent-ui.int.spec.tsx tests/int/form-submissions.int.spec.tsx tests/int/analytics-actions.int.spec.tsx tests/int/analytics-events.int.spec.ts tests/int/block-style-contracts.int.spec.tsx tests/int/quote-request-form.int.spec.tsx
```

11 文件、114 测试通过，exit 0。

```bash
DISABLE_R2_STORAGE=true JOBS_AUTORUN=false DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test corepack pnpm test:int tests/int/email-consumers.int.spec.ts
```

1 文件、14 测试通过，exit 0。只连接隔离测试库，R2/jobs 关闭，邮件 transport 注入，未连接真实 SMTP。夹具按本轮创建的 ID 精确清理。初次运行被沙箱 EPERM 拒绝访问 MongoDB，获准重跑后成功；该沙箱失败不是应用回归。现有 Mongo adapter 的 Mongoose `new` option 弃用警告仍存在，未在本任务修改。

```bash
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
git diff --check
git diff --cached --check
```

均 exit 0。tsc 无错误；lint 为 0 errors、12 warnings，均位于未涉及的 output、用户 demos、CaseStudies、Posts、article-block-editor 测试中。没有运行全量 e2e 或 build。

## 浏览器复查

使用 Playwright CLI、本机 Chromium headless、新 context，访问已运行的 `http://localhost:3000`，没有重启服务。

```bash
npm_config_offline=true /Users/jason/.codex/skills/playwright/scripts/playwright_cli.sh -s=ecolitea-bugfixes open http://localhost:3000 --config=/tmp/ecolitea-bugfix-recheck-20261118/browser.json
npm_config_offline=true /Users/jason/.codex/skills/playwright/scripts/playwright_cli.sh -s=ecolitea-bugfixes run-code --filename=/tmp/ecolitea-bugfix-recheck-20261118/revoke-race.js
npm_config_offline=true /Users/jason/.codex/skills/playwright/scripts/playwright_cli.sh -s=ecolitea-bugfixes close
```

- 已加载 Google tag 后撤销：立即、11 秒后、后续联系事件后 Google Cookie 均为空。
- 将真实 `gtag/js` 响应延迟 7 秒：撤销约在 7152ms，延迟 page_view 请求约在 14559ms；11 秒后、后续联系事件后 Cookie 均为空（修复前同场景会残留两个 `_ga` Cookie）。
- 撤销后新发出的 contact_click 为 `tid=<local test GA4 ID>, gcs=G100`。同意阶段旧队列的 page_view/scroll 仍可能稍后发出 G111 请求，这不是本次 Cookie 补清所阻止的范围。
- 浏览器已关闭。结果保存在同目录的 `revoke-race-results.json`。

## 开发库安全与未验证项

写入前只读基线检查发现实际开发库已为 **2 条询价、2 条表单提交**，并非任务中记录的 2/1；多出的记录不属于本次修复。为保留用户数据，本次没有在开发库提交表单，也没有创建或删除任何开发库记录。最后比较询价、表单提交的完整 ID 集合均与观察基线完全一致；GTM ID 仍为 `<local test GTM container>`，`disableGtm=false`。证据为 `baseline.json`、`final-state.json`、`final-summary.txt`。

表单的浏览器真实 POST 没有重跑；组件测试和隔离 Mongo/Payload 测试已覆盖成功、失败及事件条件。

GTM 脚本在曾经加载后仍留在页面；Consent Mode update 会持续拒绝原生 Google 标签的 storage，1/3/8 秒清理用于处理此前排队的初始化竞态，并非无限期轮询或任意自定义标签的 Cookie 防火墙。超过 8 秒才新建 Cookie 的极端启动、忽略 Consent Mode 的第三方自定义标签、其他浏览器和父域 Cookie 未复测。Cookie 清理范围没有扩大。

本次没有修改之前报告的 GA4 自动表单测量重复问题；这是 Google 数据流设置的独立问题。没有触发真实用户密码重置，没有接触生产 SMTP、生产数据库或远程存储写入。
