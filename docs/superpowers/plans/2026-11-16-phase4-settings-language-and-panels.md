# 第四阶段：语言配置后台化 + Translation 标签页 + 语言/Cookie 面板重设计

日期：2026-11-16
分支：feature/i18n-consent
上位 spec：`docs/superpowers/specs/2026-11-15-i18n-region-consent-design.md`（本文件修订其 §3、§6、§9；冲突以本文件为准）
执行：Paseo Codex `gpt-6.1-sol` / `xhigh`

## 已确认的决定（用户 2026-11-16）

1. 语言**目录**留在代码（18 种，见 §A1）；每种语言的**状态**与**地区**改由 Site Settings 管理，后台修改无需重新部署即生效。
2. Site Settings 新增 **Translation** 标签页：本月额度、语言状态表、地区。`translations` / `translation-usage` 从 Admin 导航移除（`admin.hidden`），仅能从该标签页链接进入。
3. 状态表“完成度”分母 = 全站应翻译内容总数；“问题”列显示“N 失败 · M 等待额度”。
4. Header 语言入口：项目自有 SVG 图标 + 语言简写（EN/DE/ZH/ZH-TW）；点击打开**独立面板**（不再是下拉）。手机顶栏只显示图标；展开菜单底部另有一行入口。语言面板**不放国旗**。
5. Cookie 设置面板改为“列表 + 展开”，说明默认收起；手机底部按钮**保持上下排列**。手机 Cookie 通栏中 “Cookie settings” 改为文字链接。
6. Cookie 通栏与设置面板的说明文案**不再写死**，在后台可编辑。

参考图仅作结构思路；视觉一律使用项目现有 token、`typography.css` role、`src/components/ui`。不新增依赖。

## A. 语言配置后台化

### A1 代码：语言目录 `src/i18n/catalog.ts`

`en`(English, 源语言) `de`(Deutsch) `fr`(Français) `es`(Español) `it`(Italiano) `pt`(Português) `nl`(Nederlands) `pl`(Polski) `sv`(Svenska) `tr`(Türkçe) `ru`(Русский) `ja`(日本語) `ko`(한국어) `zh`(简体中文) `zh-tw`(繁體中文) `vi`(Tiếng Việt) `th`(ไทย) `id`(Bahasa Indonesia)。每项：`code`、原名 `label`、简写 `short`（如 `EN`、`ZH-TW`）、Google 目标语言代码（`zh`→`zh-CN`、`zh-tw`→`zh-TW`，其余同名）。无 RTL 语言。

### A2 Site Settings → Translation 标签页字段

- `languages`：array，每行 `code`（select，选项=目录除 `en`，unique）、`status`（select：`off` | `translating` | `live`，默认 `off`）。英文固定为源语言，不出现在数组中。
- `regions`：array，每行 `label`（text，当地语言书写）、`group`（text，如 North America）、`locale`（select，选项=`en` + 目录）。服务端校验：`locale` 必须是 `en` 或状态非 `off` 的语言；至少保留一个 `locale=en` 的地区（缺省视为 `Global · en`）。
- 删除语言或改为 `off` 不删除已有译文（遵守“不因校验删除数据”的规范）。

### A3 运行时读取

- 新增 `getI18nSettings()`：读取 Site Settings（沿用现有 `global_site-settings` 缓存 tag），返回 `publicLocales`（en + live）、`targetLocales`（translating + live）、`regions`。替换所有对 `src/i18n/config.ts` 常量的读取；`config.ts` 只保留 `sourceLocale`、`isLocaleSegment` 与目录再导出。
- `src/proxy.ts` 不能查 Payload：目录内语言段一律放行，目录外的两字母段 404；是否公开由 `[lang]/layout.tsx` 判定（非 public → `notFound()`）。
- 静态生成：`generateStaticParams` 构建时从 Site Settings 读取 public 语言；保留 `dynamicParams`，构建后启用的语言按需渲染。
- Site Settings 保存后：除现有失效外，失效 sitemap、语言相关页面（内部 `/[lang]` 路径）及翻译运行时缓存。语言从 `off` 变为 `translating`/`live` 时**不自动**入队全站补译（仍由补译命令执行，避免意外耗尽额度）。
- 翻译插件、补译命令、sitemap/hreflang、语言选择器、搜索均改用 `getI18nSettings()`。
- 测试注入：删除 `next.config.ts` 中替换 `i18n/config` 的 webpack 插件与 `src/i18n/testFixtureGuard.ts`；e2e 改为在隔离测试库中写入 Site Settings 的 `languages`/`regions`。

### A4 Translation 标签页展示（`ui` 字段自定义组件，Payload 公开扩展点）

- 顶部：本月额度进度条（已用 / `TRANSLATION_MONTHLY_CHAR_LIMIT`）+ 重置日期（下月 1 日 UTC）。
- 语言状态表：语言 | 状态（即 `languages` 字段本身）| 完成度 `已就绪 / 全站应翻译总数` | 问题 `N 失败 · M 等待额度`（为 0 显示 —；数字链接到 `/admin/collections/translations?where[locale][equals]=xx&where[status][equals]=failed` 等原生列表）| 最近更新（相对时间）。
- “全站应翻译总数”= 补译命令同一口径的公开源清单数量（复用 `scripts/translation-backfill.ts` 的清单逻辑，提取为共享函数），按语言计算已就绪数。服务端计算，组件只读。
- `translations`、`translation-usage` 设 `admin.hidden: true`；访问控制不变。

## B. Cookie 文案后台化

- Site Settings → Legal 新增 group `cookieConsent`：`bannerTitle`、`bannerDescription`（textarea）、`settingsDescription`（textarea）、`necessaryDescription`、`analyticsDescription`、`marketingDescription`。均可选；为空时回退前端字典 `en.json` 的默认值。
- 翻译规则把这些字段声明为 `translate`；非英文页面读取 Site Settings 译文，未就绪回退英文。
- 按钮、分类名、“Always active”等短界面文案仍在字典中。

## C. Header 语言入口与面板

- 入口：`src/components/icons/GlobeIcon.tsx`（项目自有 SVG，`currentColor`，尺寸与搜索图标一致）+ 简写（桌面显示，如 `EN`）。手机顶栏只显示图标；手机展开菜单底部增加一行“图标 · 地区名 · 简写 ›”打开同一面板。透明/玻璃 Header 主题下颜色跟随。
- 面板：原生 `<dialog>`，遮罩沿用 `--website-scrim-standard`。标题居中 “Select your location and language”（字典），下方分隔线；按 `group` 分组，分组名为小标题。
  - 桌面：3 列网格（平板 2 列），每项浅灰底卡片 `--website-color-muted-surface`，左地区名、右语言简写（muted），当前项黑色描边 + ✓。
  - 手机：全屏，顶部标题栏与关闭按钮固定，内容滚动；一行一个地区的列表，分隔线分隔，行高 ≥ 44px。
  - Esc/遮罩关闭，焦点陷阱，关闭后焦点回入口；与 Cookie 面板互斥（沿用现有 panelEvents）。点击行为（写 `ec_preferences`、跳转、未就绪提示）不变。

## D. Cookie 面板与通栏

- 设置面板：标题 + 关闭；说明文字（来自 B）最多两行，超出显示 “Read more” 展开；分类为列表行：名称 | 开关或 “Always active”（caption、muted）| 展开按钮（+/−，`aria-expanded`/`aria-controls`）。说明默认收起；行间细分隔线，无卡片/边框/底色。“Region & language preference / Clear” 移到 Necessary 展开内容中。底部：桌面左右排列；手机上下排列、固定底部。
- 通栏（手机 < 48rem）：说明压缩；Accept all / Reject optional 并排各占一半（同等权重，黑色主按钮）；“Cookie settings” 改为按钮下方的文字链接。桌面保持现状。

## 验收与测试

- 默认（Site Settings 未配置语言）时英文站行为与 SEO 输出不变；Header 入口显示 `EN`，面板仅 Global · EN。
- 后台把某语言改为 `live` → 无需重新部署：入口面板出现对应地区、`/xx/...` 可访问已就绪内容、sitemap/hreflang 包含该语言；改回 `off` → 对应 URL 404、面板移除。
- Translation 标签页：额度条、完成度（分母为全站清单）、问题计数与跳转链接正确。
- Cookie：后台修改说明文案后前台更新；分类展开/收起与键盘可达；手机布局符合 D。
- 运行：受影响的定向 int spec、新增 spec、`tsc`、`lint`、`build`（隔离库）、`language-switcher` 与 `cookie-consent` e2e（桌面 1440 / 手机 390），英文回归 e2e（`website-shell`、`frontend`，按项目存储模式 `DISABLE_R2_STORAGE=false` 本地 S3）。截图存 `/tmp`。
- 生成文件用 `corepack pnpm generate:types` / `generate:importmap`。不访问 Google/生产服务；测试库名含 `phase4`。

## 提交拆分

1. `feat(i18n): manage locale status and regions in Site Settings`（A1–A3，含测试注入改造）
2. `feat(translation): add Site Settings Translation tab`（A4）
3. `feat(consent): make cookie copy editable in Site Settings`（B）
4. `feat(header): redesign language entry and location panel`（C）
5. `feat(consent): simplify cookie settings panel and mobile banner`（D）
6. `docs(i18n): update deployment and spec for Site Settings language control`（更新 `docs/deployment.md` 上线语言流程与上位 spec §3/§6/§9 指向本文件）
