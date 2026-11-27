# 本地 Cookie Consent、GTM、GA4 与邮件验证报告

验证日期：2026-11-17（Asia/Shanghai）。没有修改应用代码、没有提交、没有重启应用。临时浏览器已关闭。

环境：`http://localhost:3000`；数据库严格限定 `127.0.0.1:27017/ecolitea2`；SMTP 为 `127.0.0.1:1025`；Mailpit 为 `http://localhost:8025`。所有独立浏览器场景均使用新的 Chromium 无头 context；GPC 场景同时设置 `Sec-GPC: 1` 与 `navigator.globalPrivacyControl=true`。Payload Local API 的盘点、精确清理和最终核验均关闭 R2 与 jobs，未上传或修改远程存储。

结论：4 个业务事件及其 GA4 参数均已观察到；询价邮件和邮件失败隔离通过。发现 2 个应用问题（慢加载撤销竞态、可选下拉导致表单 400），以及 GA4 自动表单测量造成的重复/失败误计。管理员测试邮件、表单通知邮件和忘记密码没有完成，原因见表。

| 场景 | 结果 | 证据 |
|---|---|---|
| GTM 发布状态 | PASS | 公开 `gtm.js?id=<local test GTM container>` 返回 200，356785 字符，包含 `<local test GA4 ID>` 及全部 4 个事件名。不是未发布容器。 |
| A 首访 | PASS | 显示 Cookie consent banner；无 `ec_consent`、无 `_ga`；dataLayer 的 consent default 四项均 denied，`wait_for_update=500`；同意前没有 GTM/GA 请求。 |
| A 拒绝 | PASS | `ec_consent={analytics:false,marketing:false,...}`；新 context 内 GTM/GA 请求数 0，Google Cookie 数 0。 |
| A 仅分析 | PASS | `{analytics:true,marketing:false}`；`analytics_storage=granted`，`ad_storage/ad_user_data/ad_personalization=denied`；GTM 和 Google tag 返回 200；page_view collect 返回 204，`gcs=G101`。 |
| A 接受全部 | PASS | `{analytics:true,marketing:true}`；四项 consent update 均 granted；GTM 加载；观察到 `gcs=G111` 的 page_view。 |
| A 撤销，标签已加载 | PASS | 原有 `_ga`、`_ga_<stream>` 及额外注入的 `_gcl_au` 测试 Cookie 均立即消失；2.5 秒、8.5 秒和拒绝后刷新仍为空。 |
| A 撤销，Google 标签慢加载 | **FAIL** | 将真实 `gtag/js` 响应延迟 7 秒以模拟慢网络：撤销时 Cookie 为空，但 11 秒后出现 `_ga` 和 `_ga_<stream>`，后续仍残留。未伪造脚本或同意逻辑。 |
| A GPC | PASS | 点击 Accept all 后仍为 `{analytics:true,marketing:false}`；Marketing switch disabled、aria-checked=false；三项广告权限 denied。 |
| B GTM 开关当前状态 | PASS | Local API 确认 `disableGtm=false`、容器 ID 正确；同意后实际加载 GTM。本次未切换设置；`disableGtm=true` 分支未验证。 |
| C 正常询价 | PASS | 产品页真实 Turnstile 测试挑战通过；POST 返回 `200 {ok:true}`、显示成功确认；dataLayer 出现一次 `quote_submit`。正常邮件启用时请求约 976ms。 |
| C 无效询价 | PASS | 空字段提交产生 4 个字段错误，`quote_submit` 数保持 0。 |
| C 正常表单 | PASS | 首页现有“全字段示例表单”，补全字段后 POST 返回 201，显示确认，dataLayer 一次 `form_submit`，带 `form_title`。没有新建页面或表单配置。 |
| C 可选下拉留空 | **FAIL（表单可用性）** | 只填必填字段时 POST 返回 400；错误 `submissionData.4.value`，对应未选择的可选 `topic`（undefined 值在 JSON 中被省略）。应用未推送 `form_submit`，这部分成功条件正确。 |
| C 下载 | PASS | 产品 Download → Resources → 点击现有 PDF，出现 `file_download`，含文件名和产品 slug。验证范围是资源链接激活/事件，未验证 PDF 内容完整性。 |
| C 联系方式 | PASS | 分别点击页脚邮箱和电话，出现 `contact_click {method:email}` / `{method:phone}`。未调用外部邮件客户端或拨号。 |
| C 参数与隐私 | PASS | 4 个业务 dataLayer 对象只有规定参数（另有 GTM 内部 uniqueEventId）；GA4 自定义参数没有姓名、邮箱、公司或留言值；测试 PII 标记扫描未命中。 |
| D GA4 成功业务事件 | PASS | 已捕获 page_view、quote_submit、form_submit、file_download、contact_click 的 `/g/collect` 请求；`tid=<local test GA4 ID>`，同意后 `gcs=G111`，参数见下表。观察到 collect 204 响应。未登录 GA4 验证后台报表。 |
| D 分析拒绝时 | PASS（首次拒绝）；撤销有注意项 | 首次拒绝无任何 GTM/collect 请求。标签已加载后撤销，新触发的 contact_click 请求为 `gcs=G100`，Cookie 仍为空；同时观察到撤销后才发出的 `scroll gcs=G111`，可能来自此前排队事件，生成时点未验证。慢加载竞态还会残留 Cookie，见上文 FAIL。 |
| D GA4 自动表单测量 | **FAIL（统计准确性）** | 400 表单请求虽无应用 dataLayer form_submit，仍出现无 `form_title` 的 GA4 form_submit；成功表单又出现自动 form_submit 和带 `form_title` 的业务 form_submit，询价表单也会产生自动 form_submit。符合增强型表单测量与自定义同名事件冲突的现象；未登录 Google 修改设置。 |
| E 管理员 Send test email | BLOCKED | 新 context 打开 `/admin` 后转到 `/admin/login`，密码框可见；`/api/users/me` 返回 user=null。没有可用合法管理员会话，未尝试密码、未伪造会话、未调用测试邮件端点。 |
| E 询价通知 | PASS | Mailpit 捕获 1 封通知，收件人 `<configured admin recipient>`，Reply-To `test+e2e@example.com`。HTML 含 `&lt;b&gt;test&lt;/b&gt;`，不含原始 `<b>test</b>`。SMTP 使用本地 Mailpit，邮件没有投递到真实 Gmail。 |
| E 表单通知 | BLOCKED（无配置） | 现有表单 `emails.length=0`，无通知模板/收件人；本次保持内容配置原状。 |
| E 忘记密码 | BLOCKED（按要求跳过） | 未对真实用户发起密码重置。 |
| E 邮件失败隔离 | PASS | `corepack pnpm mail:down` 后确认 Mailpit API 不可达；真实询价仍 `200 {ok:true}`，约 3399ms，保存成功、显示确认、推送 quote_submit。随后 `mail:up` 成功，API 恢复 200。 |
| 数据清理与工作区 | PASS | 精确删除 2 条询价和 1 条表单提交，原有 ID 集合/数量恢复基线；未修改设置。Git 无 tracked diff，仅保留原有用户未跟踪 demos 目录。 |

## 业务事件证据（无客户 PII）

| dataLayer event / GA4 en | dataLayer 参数 | GA4 参数 |
|---|---|---|
| `quote_submit` | `product_slug=demo-insta360-flow-2-series` | `ep.product_slug=demo-insta360-flow-2-series` |
| `form_submit` | `form_title=全字段示例表单` | `ep.form_title=全字段示例表单` |
| `file_download` | `file_name=demo-20261019-09-exhibition-checklist.pdf`, `product_slug=demo-insta360-flow-2-series` | 同名 `ep.file_name`、`ep.product_slug` |
| `contact_click` | `method=email` / `phone` | `ep.method=email` / `phone` |

所有上述业务 collect 请求的目标均为 `<local test GA4 ID>`。仅分析的 page_view 使用 `G101`；接受全部的业务事件使用 `G111`；撤销后新触发的联系事件使用 `G100`。没有导出 GA Client ID 或 Cookie 标识值。

## 问题定位建议（本次没有修复）

1. **撤销竞态**：`src/consent/gtm.ts:58` 的 Cookie 清理，以及 `src/consent/gtm.ts:82` 附近的 applyConsent。清理只在撤销时同步执行；已经启动但尚未完成的 Google tag 初始化之后仍可能新建 Cookie。普通“等 Cookie 已存在再撤销”会通过，慢网络用例会失败。证据为 `revoke-race-results.json`：撤销约 8797ms，page_view 请求约 16189ms，11 秒后两个 `_ga` Cookie 残留。
2. **可选下拉无法留空**：`src/collections/Pages/blocks/Form/Component.tsx:57` 将每个表单值直接转为 submissionData；`src/collections/Pages/blocks/Form/Select/index.tsx:40` 的未配置默认值为 undefined；已安装插件 `node_modules/@payloadcms/plugin-form-builder/dist/collections/FormSubmissions/index.js:46` 的 value 字段/validator 要求值存在。实际错误路径为 `submissionData.4.value`（topic）。建议后续修复时明确处理未填写的可选值，并补针对性测试。
3. **GA4 重复/误计**：配置层面疑似开启 GA4 Enhanced measurement → Form interactions。应用成功后才发业务事件的位置为 `src/collections/Pages/blocks/Form/Component.tsx:83`、`:96`；询价为 `src/components/Products/QuoteRequest/QuoteRequestForm.tsx:109`。不要将 GA4 自动 form_submit 当作成功业务提交。建议在该测试数据流中关闭自动表单交互测量后复验；本次未修改 Google 设置。

## 创建并删除的记录

| collection | ID | 用途 | 结果 |
|---|---|---|---|
| quote-requests | `6afc6fc88e1379a6aca7e231` | 正常邮件/HTML 转义 | 已删除 |
| quote-requests | `6afc70a38e1379a6aca7e233` | Mailpit 停止时的失败隔离 | 已删除 |
| form-submissions | `6afc70af8e1379a6aca7e235` | 完整表单成功提交 | 已删除 |

基线 → 测试后 → 清理后：询价 `2 → 4 → 2`；表单提交 `1 → 2 → 1`。最终还比较了原有完整 ID 集合，并核验测试 ID 不再存在。表单、页面、产品、用户和 Site Settings 没有写入改动。

Mailpit 基线为 0 封。本次正常通知的 ID 为 `2LOmN8Ewdg0MRGvMGVH6FB`，已保存于本报告目录中的受保护 JSON 文件。`mail:down` 删除了无持久卷的测试 Mailpit 容器，因此该测试邮件随容器清除；重启后 0 封，没有原有邮件损失。失败询价未投递邮件。

## 执行与证据文件

- 只运行本次针对性浏览器脚本，没有运行全量 e2e、Vitest、构建、tsc 或 lint（无代码改动）。
- Playwright CLI 通过本机已安装的 Chromium headless revision 1217 运行；CLI 默认要求的 revision 1254 未安装，因此使用临时 launchOptions.executablePath，没有下载安装浏览器。
- 命令模式：`npm_config_offline=true /Users/jason/.codex/skills/playwright/scripts/playwright_cli.sh -s=ecolitea-local-e2e run-code --filename=/tmp/ecolitea-local-e2e-20261117/<script>.js`。
- 脚本：`consent.js`（4 fresh contexts）、`events.js`、`revoke.js`、`failure-form.js`、`revoke-race.js`（2 fresh contexts）、`failed-form-auth.js`。
- 邮件故障：`corepack pnpm mail:down`，在 shell EXIT trap 中执行 `corepack pnpm mail:up`；均 exit 0。
- 数据盘点/清理：`corepack pnpm exec tsx /tmp/ecolitea-local-e2e-20261117/local-api.ts baseline|inventory|cleanup|verify`，每次严格核对数据库 URI 与实际连接主机/库名。baseline/inventory/verify 只读；cleanup 仅删除上表 ID。
- HTTP 读取：应用首页；GTM 公共脚本；Mailpit `/api/v1/messages` 与 `/api/v1/message/<ID>`。首次沙箱网络 EPERM/ENOTFOUND 后使用已批准权限重试成功，不属于应用故障。
- 主要结果：`consent-results.json`、`events-results.json`、`failure-form-results.json`、`revoke-results.json`、`revoke-race-results.json`、`failed-form-auth-results.json`、`mail-results.json`、`cleanup.json`、`final-state.json`。

## 留给用户的手动步骤 / 未验证项

1. 以现有合法管理员账号登录本地 Admin → Site Settings → Integrations → Email → Send test email，在 Mailpit 查看邮件。不要改密码来解锁测试。
2. 在 GA4 测试数据流检查 Enhanced measurement 的 Form interactions；关闭自动表单测量后重跑成功/失败表单，确认每次成功仅一个带 form_title 的事件。后台 Realtime/DebugView 是否接收本次事件未检查。
3. 在有通知邮件配置的表单上手动验证发信；当前唯一表单没有配置 emails，本次没有修改它。
4. 忘记密码仅使用隔离测试账号与 Mailpit 手工验证；本次未向真实用户发重置邮件。
5. 后续修复撤销竞态与可选字段问题后复测。本次仅测试 localhost、Chromium；其他浏览器、HTTPS/父域 Cookie、GTM disabled=true、真实外部 SMTP/SPF/DKIM 和 PDF 内容未验证。
