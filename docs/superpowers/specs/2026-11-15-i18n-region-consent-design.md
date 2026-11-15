# 多语言、地区切换与 Cookie 授权设计

日期：2026-11-15
分支：feature/i18n-consent（基于 feature/products `265074b`）
状态：设计已确认，未实施

本文取代 Codex 讨论记录 `Ecolitea-地区语言与-Cookie-设计讨论记录.docx` 中与下文冲突的内容；该文档仅作讨论历史。旧仓库 `/Users/jason/ecolitea.com` 的 Cookie 标准化规格（`c4db29c`）不适用于 2.0。

## 1. 目标与范围

- 运营只维护英文源内容；其他语言由系统自动翻译、保存，并作为独立 URL 由服务端输出，可被搜索引擎收录。
- 前台提供地区/语言切换入口和 Cookie 授权（首次通栏 + 设置面板）。
- 这是通用系统：语言、地区、额度上限均由部署方配置，设计中不写死具体市场。

明确不做：人工翻译或人工修正译文、术语表、按地区区分内容（币种/联系人/产品可见性）、按地区设置授权默认值、授权版本、数据看板、HubSpot 等第三方 CRM 接入、RTL 语言。

## 2. 核心概念

| 概念 | 决定者 | 作用 |
|---|---|---|
| 页面语言 `locale` | URL | 正文、导航、界面文案、SEO |
| 选中地区 `region` | 用户点击，存 `ec_preferences` | 仅作为选择语言的入口，在面板中标 ✓ |
| 授权 `consent` | 用户选择，存 `ec_consent` | 控制统计、营销服务能否运行 |

三者互相独立：切换地区不改变授权；修改授权不改变地区或页面语言；Cookie 永远不覆盖明确访问的 URL。

## 3. 语言与地区配置

单一来源、类型化的代码配置 `src/i18n/config.ts`，做法与 Payload 官方把 `localization.locales` 放在 config 中一致（语言属于系统结构，新增必须部署）。翻译插件、`proxy.ts`、sitemap、hreflang、Header 选择器都只从这里读取。

```ts
export const sourceLocale = 'en'
export const locales = [
  { code: 'en', label: 'English', status: 'source' },
  // { code: 'de', label: 'Deutsch', status: 'translating' | 'live' },
] as const
export const regions = [
  { code: 'GLOBAL', label: 'Global', group: null, locale: 'en' },
  // { code: 'DE', label: 'Deutschland', group: 'Europe', locale: 'de' },
] as const
```

- 默认只有 `en` / `Global`。地区名用当地语言书写，不翻译。
- 语言状态：

| 状态 | 后台翻译 | 前台 `/xx/...` | 切换器 | sitemap / hreflang |
|---|---|---|---|---|
| `translating` | 执行 | 404 | 不显示 | 不包含 |
| `live` | 执行 | 公开（仅已就绪文档） | 显示 | 包含（仅已就绪文档） |

- 逐种语言上线：补译完成（状态列表显示完成度）后由开发改为 `live` 并部署。

## 4. 翻译系统（方案 B：独立译文存储）

不使用 Payload 原生 Localization，不给现有字段加 `localized`，不迁移现有数据。理由：翻译是内置功能，后台不展示其他语言；保持内容模型与官方升级路径一致；插件可整体移除。

### 4.1 插件结构

项目自有插件 `src/plugins/translation/`，只使用公开 API（plugins、collections、hooks、Jobs、Local API）：

```
index.ts            插件入口
collection.ts       translations 集合（只读，仅管理员可见）
hooks.ts            英文发布时入队
task.ts             Jobs 任务：提取 → 翻译 → 写入
rules/              各集合 / Global / Block 的可翻译字段规则
provider/google.ts  翻译服务适配器（provider-neutral 接口）
quota.ts            月度字符计数
```

移除插件后网站退回纯英文并正常运行。

### 4.2 译文记录

`translations` 集合每条记录对应“一个文档 × 一种语言”：`collection`、`docId`（Global 用 slug）、`locale`、`status`（`ready` / `pending` / `waiting_quota` / `failed`）、`sourceVersion`、`fields`（字段路径 → 译文）、`error`、`translatedAt`。

后台只读列表视图，显示每种语言的完成度与本月已用字符数。

### 4.3 翻译范围

| 内容 | 翻译 |
|---|---|
| Products、Product Categories、产品 Blocks | 是 |
| Blogs、Blog Categories | 是 |
| Posts、Case Studies | 是 |
| Pages（含 Hero、Blocks） | 是，法律页面除外（§4.7） |
| Header、Footer 导航文字 | 是 |
| Site Settings 中面向访客的文字 | 是 |
| Form Builder 表单标签、确认信息 | 是 |
| 表单内部通知邮件 | 否 |
| 前端代码中的界面文案（含 Quote 弹窗、Cookie 面板） | 是，走前端字典（§4.8） |

字段规则：展示文字（标题、简介、按钮文字、富文本、SEO 标题/描述、图片 alt）翻译；slug、型号、规格数值、布局、主题、开关、关联、媒体、链接 URL 共享不翻译。Blocks 共用一套布局，只翻译 Block 内的文字字段。

规则维护：规则与 Block 一一对应；测试遍历所有 Collection / Global / Block 配置，凡文字字段（text、textarea、richText）未在规则中声明“翻译”或“排除”即失败，防止新增字段漏翻。

### 4.4 触发与执行

- 仅在英文**发布**（含定时发布生效）时入队；autosave 草稿不触发。写回译文使用 `context` 标记，不触发自身 hook。
- 每次发布整篇重译该文档的全部目标语言（所有 `translating` / `live` 语言）。
- 英文下线或删除时，对应译文一并失效。
- 任务失败自动重试；失败保留旧译文并标记 `failed`。
- 任务执行前校验 `sourceVersion`，旧任务不得覆盖新译文。

### 4.5 富文本

Lexical 按段落转换为 HTML，用 Google HTML 模式整段翻译，再还原回节点；段内加粗、链接以标签保留，链接只翻译文字。标签无法对齐时降级为该段纯文本，不使整篇失败。同一文档的文本打包批量请求（v2 单次上限 128 段），文档内相同原文只翻译一次。不使用术语表；正文中品牌名/型号被改写的风险首版接受。

### 4.6 额度（仅使用免费额度）

- 第一层（主控）：插件按自然月计数已发送字符，超过 `TRANSLATION_MONTHLY_CHAR_LIMIT`（默认 450000）后新任务标为 `waiting_quota`，下月 1 日自动恢复。
- 第二层（兜底）：部署时在 Google Cloud Console 设置每日字符配额与预算告警（写入部署文档，非代码）。
- 排队优先级：已有译文的更新 → 新发布内容 → 首次补译。
- 注意：免费额度也需要绑定结算账户。

### 4.7 法律页面

Site Settings → Legal 引用的 Privacy Policy、Cookie Policy、Terms 三个 Page 自动认定为法律页面：只提供英文，不生成译文；`/xx/<legal-slug>` 301 到英文；非英文页面中的政策链接直接指向英文地址并标注 `(English)`；不进入其他语言 sitemap / hreflang。

### 4.8 前端字典

`src/i18n/dictionaries/en.json` 为源文件，其他语言由翻译插件生成，同样受额度与就绪状态控制。

### 4.9 机器翻译署名

只在 Cookie Policy 等政策页面（英文）说明网站使用 Google 机器翻译。已知风险：Google 条款要求在译文展示处标注，此做法可能不满足条款，由站点所有者承担。

### 4.10 运行环境

自托管 Docker Compose 单常驻容器，使用 Payload Jobs `autoRun` 在进程内拉取任务；保留现有 `CRON_SECRET` 入口供手动或外部触发。多实例部署时通过环境变量指定唯一运行任务的实例。

## 5. 路由、渲染与 SEO

| 部分 | 方案 |
|---|---|
| 路由 | 前台路由移入 `app/(frontend)/[lang]/...`；`proxy.ts` 将无前缀请求内部改写为 `en`；显式 `/en/...` 301 到无前缀 |
| URL | 英文保持现有地址；其他语言加前缀，如 `/de/products/...`；所有语言共用英文 slug |
| 保留 slug | 配置中的所有语言代码为保留 slug，Pages 服务端校验拦截 |
| 读取 | 新增 `getLocalizedDoc()`：读英文文档并合并对应语言译文；现有 `getProductBySlug`、`getGlobals` 等统一经由它 |
| 缓存 | cache tag 增加语言维度；英文发布失效英文缓存，某语言译文写入只失效该语言 |
| 静态生成 | `generateStaticParams` 输出 `live` 语言 × 已就绪文档 |
| Cookie 与渲染 | 服务端不读取 `ec_preferences` / `ec_consent`，避免整页动态化；相关 UI 状态在客户端读取 |
| Metadata | `<html lang>`、自身 canonical、所有已就绪语言 hreflang + `x-default`（英文） |
| Sitemap | 现有 4 个 sitemap 增加语言维度，只列 `live` 语言的已就绪文档 |
| 搜索 | 索引增加 `locale`，各语言独立记录；语言页面只搜索本语言 |
| Redirects | 运营只维护英文规则；查询时去掉语言前缀匹配，命中后按当前语言生成目标地址；外部 URL 原样跳转；目标未就绪按下方规则 |
| 未就绪页面 | 直接访问 `live` 语言下未就绪的 `/xx/...`：302 到英文版 |

## 6. 前台界面

### 6.1 语言选择器

- 桌面：入口位于 Header 搜索按钮左侧，显示 🌐 + 当前语言名（始终只显示语言）。点击后在入口正下方展开下拉面板，右缘对齐入口，沿用现有 mega menu 表面样式；与 mega menu 互斥；点击外部、Esc、再次点击入口收起。透明 Header 与滚动玻璃 Header 下颜色跟随现有主题。
- 移动：顶栏改为“菜单 · Logo · 🌐 · 🔍”，地球图标仅图标，点击打开全屏语言面板。
- 面板：按分组列出地区，每行“地区名 · 语言名”，当前地区 ✓（客户端读取 Cookie）。仅列出 `live` 语言对应的地区。
- 点击地区：直接切换并写入 `ec_preferences`，不做二次确认；跳转到当前页面对应语言地址；该页面在目标语言未就绪时跳到目标语言首页，并在顶部提示“该页面暂无 <语言> 版本”。
- 结构变更说明：Header 原约定只调整卡片尺寸、字体和间距；本次新增入口为用户明确要求的结构变更。

### 6.2 Cookie 首次通栏

- 无有效 `ec_consent` 时显示，固定在页面底部、横跨全宽。
- 桌面：左侧标题、说明、Cookie Policy (English) 链接；右侧“接受全部 / 拒绝非必要 / Cookie 设置”；右上角 X。移动：上下排列，按钮全宽。
- “接受全部”与“拒绝非必要”视觉权重相同。X 仅收起，授权保持未决定，下次访问再次出现。关闭或继续浏览不视为同意。

### 6.3 Cookie 设置面板

- 桌面居中弹窗，移动全屏面板（保存按钮固定底部）。
- 必要：始终启用；其下列出“地区与语言偏好：<地区>”及“清除”按钮（删除 `ec_preferences`）。
- 统计、营销：独立开关；GPC 信号存在时营销锁定关闭。
- 开关显示已保存的选择；“保存设置”后生效，直接关闭不保存；另提供“拒绝非必要”。
- Footer 法律链接区域增加“Cookie 设置”按钮，打开本面板。

所有面板：键盘可操作、焦点管理、关闭后焦点回到入口；同一时间只打开一个面板。视觉沿用现有 token、`typography.css` role 和 `src/components/ui` 组件。

## 7. Cookie 与授权

| Cookie | 内容 | 有效期 | 写入时机 |
|---|---|---|---|
| `ec_preferences` | 地区代码，如 `DE` | 12 个月 | 用户点击地区 |
| `ec_consent` | `analytics`、`marketing` 布尔值与时间 | 6 个月 | 用户接受、拒绝或保存设置 |

- 第一方、当前主机、`Secure`（生产）、`SameSite=Lax`、`Path=/`；不在 localStorage 另存副本。
- 分类：必要、统计、营销；不设“功能增强”。
- 默认：全球统一，统计和营销关闭，用户同意后启用（Google Consent Mode v2 Basic）。
- GPC：浏览器发出 GPC 时营销视为拒绝。
- 不设授权版本：新增服务时旧同意自动覆盖。前提是每接入新服务都同步更新 Cookie Policy 中的服务清单；合规风险由站点所有者承担。
- 地区偏好属于“必要”下的语言偏好用途，仅存地区代码，不含身份或行为数据，可在设置面板清除。
- 授权到期或 Cookie 损坏：视为未决定，统计与营销关闭，重新显示通栏。

## 8. Google 标签

```
同意管理器 → Consent Mode v2 Basic → GTM → GA4（统计） / 广告标签（营销）
```

- GTM 容器 ID 由环境变量提供（如 `NEXT_PUBLIC_GTM_ID`），有则加载，无则不加载；GA4 与广告标签在 GTM 后台配置，项目不直接接入 GA4。
- 紧急总开关：Site Settings 增加“停用 GTM”，默认关闭；开启后无论授权一律不加载 GTM。
- 默认授权状态先于任何标签设置；授权变更立即更新 Consent Mode。
- 客户端路由换页不重复初始化 GTM、不重复发送 `page_view`。
- GTM 加载失败不影响浏览、切换语言和询盘。
- 事件中不发送邮箱、电话、询盘正文等个人信息。

## 9. 配置归属

| 位置 | 内容 |
|---|---|
| `src/i18n/config.ts` | 语言、地区、状态 |
| 环境变量 | `NEXT_PUBLIC_GTM_ID`、`TRANSLATION_MONTHLY_CHAR_LIMIT`、Google 翻译凭据、任务运行实例标识；同步更新 `src/utilities/env.ts` 与 `.env.example` |
| Site Settings → Legal | Privacy Policy、Terms（已有），新增 Cookie Policy 页面关联、“停用 GTM”开关 |
| Pages | 三个法律页面正文（英文） |
| Google Cloud Console | 每日字符配额、预算告警（部署文档） |

## 10. 实施阶段

1. Cookie 同意 + GTM（独立于多语言，可先上线）：同意管理器、通栏、设置面板、Footer 入口、Legal 新字段、GTM 加载。
2. 翻译插件：`translations` 集合、规则与覆盖测试、Google 适配器、额度、Jobs 任务、状态列表、前端字典生成。
3. 多语言前台：`[lang]` 路由与 `proxy.ts`、`getLocalizedDoc()`、缓存与静态生成、Metadata、sitemap、搜索、Redirects、语言选择器。

每阶段单独出实施计划并只运行与该阶段相关的测试。

## 11. 待验证（实施前）

- Next.js 16 `proxy.ts` 内部改写与 `[lang]` 段在现有路由（含根级 `[slug]`、sitemap 路由）下的行为。
- Payload 4 canary 的 Jobs `autoRun`、hook `context` 与发布事件识别（区分 autosave 与 publish）。
- Search 插件按语言建索引的扩展方式。
- Google Cloud Translation v2 HTML 模式对段内标签的保留程度。
