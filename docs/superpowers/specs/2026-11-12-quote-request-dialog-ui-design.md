# Request a quote 弹窗 UI 优化设计

日期：2026-11-12
分支：feature/products
前置：`docs/superpowers/specs/2026-11-11-product-request-a-quote-design.md`（功能与数据契约，本次不变）

## 1. 范围

只改前端视觉与展示，不改字段、校验、接口契约、集合 schema 和访问控制。

- 改动对象：`src/components/Products/QuoteRequest/` 下的 `QuoteRequestDialog`、`QuoteRequestForm` 及其 CSS Modules；`ProductActions` 与详情页仅为向弹窗传入展示数据而调整。
- 视觉一律使用现有 `--website-*` token、`src/styles/typography.css` 的 `.website-type-*` role（不新增、不修改 role），以及 `src/components/ui` 的 `Input`、`Textarea`、`Label`、`Button`。
- 用户提供的参考图（Request a call 弹窗、Quotation form）只提供结构思路；不照搬其蓝色按钮、全大写标题、灰底输入框等视觉。

明确不做：新增字段（电话、数量等）、邮件通知、修改 `DownloadDialog` 的样式或行为、修改 Turnstile 逻辑。

## 2. 表单弹窗

### 2.1 头部

- Eyebrow：`Get pricing`（`website-type-eyebrow`，muted 色）。
- 标题：`Request a quote`（沿用现有标题 role），仍是弹窗 `aria-labelledby` 的目标，打开时获得焦点。
- 说明：`Tell us what you need and our team will reply with pricing and lead times.`（muted 色、正文小号 role）。
- 关闭按钮不变。

### 2.2 产品卡片

- 浅色 muted 表面、内容圆角的卡片：左侧 48px 缩略图，右侧上方分类名（eyebrow role），下方产品名（强调正文）。
- 缩略图取产品图集第一张，通过项目共享的 Media 渲染器输出，不在组件内拼接存储或 Cloudflare 地址；需要声明尺寸以免布局抖动。
- 无图时不渲染缩略图，只显示文字；无分类时不渲染分类行。
- 详情页把这两项与现有 `title`、`slug` 一起传入（前端展示数据，不改数据模型）。弹窗的产品参数应是稳定的展示模型，不让组件解析原始 Payload 关系值。

### 2.3 字段

| 字段 | 标签 | 占位 | 布局 |
|---|---|---|---|
| name | Name | Your full name | 桌面与 Company 并排 |
| company | Company | Company name | 桌面与 Name 并排 |
| email | Work email | name@company.com | 整行 |
| message | Message | Quantity, customization, target delivery date… | 整行 |

- 窄屏（与现有断点一致，`< 48rem`）全部单列。
- 必填标识：标签后加 `*`，对辅助技术隐藏（`aria-hidden`），控件本身标注必填（`aria-required` 或等效方式），不得因此触发浏览器原生校验气泡（表单保持 `noValidate`）。
- Message 下方右对齐字数 `n / 2000`（caption role、muted 色），上限取自 `QUOTE_LIMITS.message`。
- 字段级错误保持在字段下方，现有 `aria-invalid` / `aria-describedby` 关联不变。

### 2.4 验证区与底部

- Turnstile 组件位置与逻辑不变。
- 底部固定区：全宽主按钮 `Send request` + 右箭头图标（lucide，`aria-hidden`）；提交中显示 `Sending…` 并禁用。
- 按钮下方说明：`We only use your details to respond to this request.`（caption role、muted、居中）。
- 整体提示（unavailable、needsVerification、verification、rate_limited、server、productSlug）改为提示块：使用现有 error status token 的背景、边框和前景色，带图标（`aria-hidden`），保留 `role="alert"`，文案不变。

### 2.5 移动端

保持现有行为：弹窗全宽、内容区滚动、底部按钮区固定且尊重安全区。

## 3. 成功页

替换表单内容，居中：

1. 成功图标：success background 圆底 + success accent 色对勾（`aria-hidden`）。
2. 标题：`Thank you, {name}!`，`{name}` 为用户提交的完整姓名（已 trim，不拆分姓名）；长名正常换行。
3. 说明：`We've received your request for {产品名} and will get back to you shortly.`，产品名加强调。
4. 主按钮 `Close`，关闭弹窗。

- 成功页出现时焦点移到成功标题，确保屏幕阅读器读出。
- 不显示回复邮箱、不承诺确认邮件或具体时限。
- 关闭后再次打开仍为空白表单（现有行为）。
- 姓名只在前端由表单回传给弹窗，不新增服务端数据或响应字段。

## 4. 测试与验证

- 更新 `tests/int/quote-request-form.int.spec.tsx`：按钮与成功文案断言；新增带称呼的成功标题、产品卡片有图／无图／无分类、星号对辅助技术隐藏、字数统计、提示块。
- `tests/int/products-pages.int.spec.tsx` 中 Download 与详情页既有用例不得回归。
- 只跑任务相关测试、`tsc --noEmit --incremental false`、针对性 ESLint；不跑全局 e2e。
- 浏览器验证桌面与 375px：表单、错误提示块、成功页、焦点与关闭行为。
