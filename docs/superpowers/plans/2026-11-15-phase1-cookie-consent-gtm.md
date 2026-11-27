# 第一阶段实施计划：Cookie 授权 + GTM

> 2026-11-16: Historical implementation plan. Google integration settings and credential/environment instructions are superseded by [Integrations Settings design](../specs/2026-11-16-integrations-settings-analytics-design.md). Use [deployment documentation](../../deployment.md) for current operation.

日期：2026-11-15
分支：feature/i18n-consent
Spec：`docs/superpowers/specs/2026-11-15-i18n-region-consent-design.md`（§6.2、§6.3、§7、§8、§9 中与授权相关的部分）
执行：Paseo Codex `gpt-6.1-sol` / `xhigh`

## 范围

做：同意状态模型、`ec_consent` 读写、GPC、Consent Mode v2 Basic + GTM 加载、首次通栏、设置面板、Footer 入口、Site Settings → Legal 新字段、环境变量契约、部署文档。

不做（属于第二、三阶段）：语言选择器、`ec_preferences` 写入、翻译、`[lang]` 路由、前端字典生成。设置面板中“地区与语言偏好”一行仅在存在 `ec_preferences` 时显示，本阶段只实现“清除”（删除该 Cookie）。

## 现状（已核对）

- `src/app/(frontend)/layout.tsx`：`Providers` 包裹 Header / main / Footer；`<html lang="en">`。
- `src/providers/index.tsx`：只有 `HeaderThemeProvider`。
- `src/SiteSettings/fields/legal.ts`：`copyrightText`、`companyRegistrationNumber`、`privacyPolicyPage`、`termsPage`。
- `src/Footer/adaptFooter.ts:111`：`legalLinks` 由 Privacy Policy、Terms 组成；`src/Footer/Component.tsx:93` 渲染 `nav[aria-label=Legal]`。
- 部署已预留 `NEXT_PUBLIC_GTM_MEASUREMENT_ID`（`Dockerfile:13`、`docker-compose.yml:33`），**沿用此名**，不新建 `NEXT_PUBLIC_GTM_ID`；`.env.example` 尚未列出。`NEXT_PUBLIC_GA_MEASUREMENT_ID` 也存在，但按 spec 不直接接入 GA4，本阶段不使用。
- `next.config.ts` 无 CSP，加载 GTM 无需改 headers。
- 弹窗模式：`src/components/Products/QuoteRequest/QuoteRequestDialog.tsx` 使用原生 `<dialog>`，沿用。
- UI 组件：`src/components/ui/button`、`checkbox`、`label`；无 switch 组件。
- 测试：Vitest jsdom，`tests/int/**/*.int.spec.{ts,tsx}`；Playwright `tests/e2e/`。

## 模块归属

```
src/consent/
  types.ts            ConsentState、ConsentCategory
  cookie.ts           ec_consent / ec_preferences 解析、序列化、写入、删除（纯函数 + document.cookie 薄封装）
  gpc.ts              navigator.globalPrivacyControl 检测
  gtm.ts              Consent Mode 默认值、更新、GTM 脚本注入（幂等）
  ConsentProvider.tsx 'use client'，状态、打开设置面板、应用授权
  CookieBanner.tsx    'use client'
  CookieSettingsDialog.tsx 'use client'
  CookieSettingsButton.tsx 'use client'（Footer 用）
  *.module.css
  copy.ts             本阶段的英文界面文案（第三阶段迁入字典）
```

`'use client'` 仅加在上述交互组件上；Footer、layout 保持服务端组件。

## 任务

### 任务 1：同意状态模型（纯逻辑）

文件：`src/consent/types.ts`、`cookie.ts`、`gpc.ts`、`tests/int/consent-state.int.spec.ts`

- `ConsentState = { analytics: boolean; marketing: boolean; decidedAt: string }`；“未决定”用 `null` 表示。
- `ec_consent` 值为紧凑 JSON 经 `encodeURIComponent`；解析失败、字段缺失、类型不符、`decidedAt` 超过 6 个月 → 返回 `null`（视为未决定）。
- 写入属性：`Path=/; SameSite=Lax; Max-Age=15552000`（180 天），`location.protocol === 'https:'` 时加 `Secure`；不设 `Domain`。
- `clearPreferences()` 删除 `ec_preferences`（`Max-Age=0`，同 Path）。
- `applyGpc(state, gpc)`：`gpc === true` 时 `marketing` 强制 `false`。
- 不使用 localStorage。

测试：往返序列化、损坏值、过期、缺字段、GPC 覆盖、写入字符串含正确属性（http 无 Secure、https 有 Secure）。

验收：`corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/consent-state.int.spec.ts` 通过。

### 任务 2：Site Settings → Legal 字段 + Footer 链接

文件：`src/SiteSettings/fields/legal.ts`、`src/Footer/adaptFooter.ts`、`src/Footer/types.ts`（如需）、生成文件、相关测试

- 新增 `cookiePolicyPage`（relationship → pages，label `Cookie Policy Page`），放在 `privacyPolicyPage` 之后。
- 新增 `disableGtm`（checkbox，默认 `false`，label `Disable Google Tag Manager`，admin description：`Emergency switch. When enabled, Google Tag Manager is never loaded, regardless of visitor consent.`）。
- `adaptFooter` 的 `legalLinks` 顺序：Privacy Policy、Cookie Policy、Terms。
- 重新生成：`corepack pnpm generate:types`、`corepack pnpm generate:importmap`（不手改）。
- Site Settings 现有 revalidate hook 已覆盖该 Global，无需新增。

测试：更新 `tests/int/footer-adapter.int.spec.ts` 覆盖 Cookie Policy 链接与顺序、未配置时不渲染；Site Settings schema 测试（若存在对应 spec，找到并扩展；否则在 footer-config 同级新增 `site-settings-legal.int.spec.ts`）断言两个新字段的类型与默认值。

验收：上述 spec 通过；`corepack pnpm exec tsc --noEmit --incremental false` 通过。

### 任务 3：环境变量契约

文件：`.env.example`、`src/environment.d.ts`、`src/consent/gtm.ts`（读取处）

- `.env.example` 增加 `NEXT_PUBLIC_GTM_MEASUREMENT_ID=`（空值，注释：`Optional. Google Tag Manager container ID (GTM-XXXX). Leave empty to disable.`）。
- `environment.d.ts` 声明 `NEXT_PUBLIC_GTM_MEASUREMENT_ID?: string`。
- 公共变量只在客户端读取，不放入 `parseServerEnv`（与 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 一致）。值需匹配 `/^GTM-[A-Z0-9]+$/`，否则视为未配置。

验收：类型检查通过。

### 任务 4：Consent Mode + GTM 加载

文件：`src/consent/gtm.ts`、`tests/int/consent-gtm.int.spec.ts`

- `ensureConsentDefaults()`：幂等；初始化 `window.dataLayer` 与 `gtag`，推送 `consent default`：`analytics_storage`、`ad_storage`、`ad_user_data`、`ad_personalization` 全部 `denied`，`wait_for_update: 500`。
- `updateConsent(state)`：`analytics_storage` ← analytics；`ad_storage`、`ad_user_data`、`ad_personalization` ← marketing。
- `loadGtm(id)`：幂等（以 `script[data-ecolitea-gtm]` 判断），推送 `gtm.start`，注入 `https://www.googletagmanager.com/gtm.js?id=...`，`async`；`onerror` 只记录，不抛出。
- Basic 模式规则：只有 `id` 有效、`disableGtm === false`、且 `analytics || marketing` 为真时才调用 `loadGtm`。未决定或全部拒绝时不加载脚本。
- 撤回：已加载后两项都被关闭 → 仅 `updateConsent`（GTM 无法卸载），并删除本站可控的 `_ga`、`_ga_*`、`_gcl_*` Cookie（当前主机与父域各尝试一次）。
- 不手动推送 `page_view`；客户端换页由 GTM 的 History Change / GA4 增强测量负责（写入部署文档）。不向 dataLayer 推送任何个人信息。

测试（jsdom）：默认值只推送一次；更新映射正确；未授权不注入脚本；授权后注入一次，重复调用不重复；`disableGtm` 时永不注入；无效 ID 不注入；撤回删除 GA Cookie。

验收：该 spec 通过。

### 任务 5：ConsentProvider

文件：`src/consent/ConsentProvider.tsx`、`src/providers/index.tsx`、`src/app/(frontend)/layout.tsx`、`tests/int/consent-provider.int.spec.tsx`

- Props：`gtmDisabled: boolean`（来自 Site Settings `disableGtm`，由 layout 通过已缓存的 `getCachedSiteSettings()` 传入）。
- 挂载后（`useEffect`）读取 Cookie 与 GPC，避免水合不一致：首屏服务端不渲染通栏，挂载后决定是否显示。
- Context：`state`、`gpc`、`acceptAll()`、`rejectOptional()`、`save(state)`、`openSettings(returnFocusEl?)`、`closeSettings()`、`bannerDismissed`、`dismissBanner()`。
- 任何决定都写 `ec_consent`、调用 `updateConsent`，满足条件时 `loadGtm`；`acceptAll` 在 GPC 下营销仍为 `false`。
- `dismissBanner` 只改内存状态，不写 Cookie。
- `Providers` 接收并透传 `gtmDisabled`；`ensureConsentDefaults()` 在 Provider 首次挂载时调用。

测试：无 Cookie 时显示通栏；有效 Cookie 时不显示且按状态加载/不加载 GTM；`dismissBanner` 不写 Cookie；GPC 下 `acceptAll` 结果；`gtmDisabled` 时永不加载。

验收：该 spec 通过。

### 任务 6：界面组件

文件：`CookieBanner.tsx`、`CookieSettingsDialog.tsx`、`CookieSettingsButton.tsx`、对应 `.module.css`、`copy.ts`、`src/Footer/Component.tsx`、`tests/int/consent-ui.int.spec.tsx`

视觉：只用现有 `--website-*` token、`src/styles/typography.css` 的 `.website-type-*` role（不新增、不修改 role）、`src/components/ui/button`。参考 UI 原型（底部白色通栏）的结构，不照搬原型中的具体数值。

- **CookieBanner**：`role="region"`，`aria-label="Cookie consent"`；固定底部全宽；桌面左侧标题 + 说明 + Cookie Policy 链接（来自 Site Settings `cookiePolicyPage`，未配置则不显示链接），右侧三个按钮：Accept all、Reject optional、Cookie settings；右上角关闭按钮（`aria-label="Close"`）。Accept all 与 Reject optional 使用同一按钮变体。移动端（沿用项目现有断点）上下排列、按钮全宽。不得遮挡键盘焦点：显示时给 `body` 增加底部内边距等于通栏高度（ResizeObserver），隐藏时移除。
- **CookieSettingsDialog**：原生 `<dialog>`，模式同 `QuoteRequestDialog`（showModal、Esc 关闭、焦点回到触发元素）。分组：
  - Necessary — “Always active”，说明文字；若存在 `ec_preferences`，显示一行 “Region & language preference” + “Clear” 按钮。
  - Analytics — 开关（`role="switch"`、`aria-checked`，触控区域 ≥ 44×44）。
  - Marketing — 开关；GPC 时禁用并显示 “Disabled by your browser’s Global Privacy Control setting.”
  - 底部：Reject optional、Save settings。移动端全屏、底部按钮固定。
  - 开关初值为已保存状态（未决定时为关闭）；关闭弹窗不保存。
- **CookieSettingsButton**：Footer 中 `nav[aria-label=Legal]` 列表末尾的一个 `<button>`，文案 “Cookie settings”，样式与相邻法律链接一致，调用 `openSettings`。
- `copy.ts`：集中本阶段全部英文文案，组件不硬编码字符串。

测试：渲染与 ARIA；三按钮行为；关闭不写 Cookie；设置面板保存/放弃；GPC 禁用营销；Clear 删除 `ec_preferences`；Footer 按钮打开面板。

验收：该 spec 与 `tests/int/footer-component.int.spec.tsx` 通过。

### 任务 7：浏览器验证（定向 e2e）

文件：`tests/e2e/cookie-consent.e2e.spec.ts`

使用测试专用 GTM ID（如 `GTM-TEST000`），并用 Playwright `page.route` 拦截 `googletagmanager.com` 返回空脚本，**不访问真实 Google 服务**。用例：

1. 首次访问显示通栏；未操作时没有任何 `googletagmanager.com` 请求。
2. Reject optional → 通栏消失、刷新不再出现、无 GTM 请求。
3. Accept all → 恰好一次 GTM 请求；站内跳转后仍只有一次。
4. 关闭 X → 刷新后通栏再次出现。
5. Footer “Cookie settings” 打开面板，开启 Analytics 保存 → 加载 GTM；再关闭 → `_ga` Cookie 被清除。
6. 桌面 1440 与移动 390 截图检查通栏不溢出，设置面板保存按钮可见。

仅运行：`corepack pnpm test:e2e tests/e2e/cookie-consent.e2e.spec.ts`（需要 MongoDB；连接失败须与应用回归分开报告）。

### 任务 8：文档

- `docs/deployment.md`：`NEXT_PUBLIC_GTM_MEASUREMENT_ID` 的设置；GTM 后台要求（GA4 / 广告标签启用内置 Consent 检查、客户端换页用 History Change 触发、不在 GTM 中另加 consent default）；紧急总开关位置。
- README 如有环境变量列表则同步。

## 验证汇总

只运行本阶段相关测试：

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts \
  tests/int/consent-state.int.spec.ts tests/int/consent-gtm.int.spec.ts \
  tests/int/consent-provider.int.spec.tsx tests/int/consent-ui.int.spec.tsx \
  tests/int/footer-adapter.int.spec.ts tests/int/footer-component.int.spec.tsx
corepack pnpm test:e2e tests/e2e/cookie-consent.e2e.spec.ts
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
```

不运行全量 e2e。不提交 Playwright 输出、截图或临时数据库文件。

## 提交

每个任务一个提交，Conventional Commits，scope `consent`（任务 2 为 `site-settings`，任务 8 为 `docs`）。不改 lockfile、不新增依赖。
