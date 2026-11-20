# Admin 主题 v2（窗口式布局）— 设计

- 日期：2026-11-20
- 分支：`feature/visual-refresh`
- 状态：视觉稿已确认（demo v3），待实施
- 视觉稿：`.superpowers/brainstorm/16381-1795180738/content/admin-demo-v3.html`（本地，不提交；含 Enhanced / Tokens only 与 Slots 开关）
- 前置：`2026-11-20-admin-theme-plugin-design.md`（插件 `src/plugins/adminTheme/` 已实现）
- 约束：AGENTS.md「Payload extension conventions」——Payload 可升级、定制只在可移除插件内、超出原生架构的部分放在默认关闭的选项后并有契约测试

## 1. 范围

| 区块 | 内容 | 实现位置 | 风险 |
|---|---|---|---|
| A 窗口式布局 | 灰色窗口底与侧栏；内容区为浮动圆角面板（外边距 8px、圆角 14px、0.5px 描边 + 极淡阴影）；列表表格进入圆角卡片（表头次级底色、行高 ~44px、悬停底色）；列表标题区与工具栏间距整理；分页当前页为实心 | `enhanced.css` | 依赖 Payload 非公开 class，`enhancedLayout` 后 + 契约测试 |
| B Dashboard | 统计卡片加图标色块；新增 Translations 圆环、Content activity 7 日柱状图；Quick actions 改为图标卡片；顶部标题行（站点名、当日日期、主按钮） | `dashboard/`（自有组件） | 无 |
| C 侧栏插槽 | `beforeNavLinks`：品牌 + 搜索框（⌘K）；`afterNav`：用户卡片 | `sidebar/`（自有组件，公开插槽） | 无 |
| D 编辑页细节 | tabs 字段呈分段控件；group / collapsible 呈次级底色圆角分组；字段间距与标签字重统一；文档侧栏分组 | `enhanced.css` | 同 A |

不做（与 demo v3 一致）：导航项图标与数量徽标（需替换 Nav）、副标题插入 Payload 页面头部、字段卡片之外的表单结构改动。

## 2. A + D：`enhanced.css`

- 仅在 `enhancedLayout: true` 时由 `EnhancedLayoutStyles` 加载；关闭时 Admin 只依赖 `theme.css` 的 token（demo 的 “Tokens only”）。
- 只使用实现时在已安装 `@payloadcms/ui/dist/styles.css` 中核实存在的 class。2026-11-20 已核实存在：`.template-default`、`.template-default__wrap`、`.nav`、`.app-header`、`.table`、`.collection-list`、`.collection-list__header`、`.collection-list__sub-header`、`.tabs-field`、`.tabs-field__tabs`、`.tabs-field__tabs-wrap`、`.group-field`、`.collapsible`、`.document-fields__main`、`.document-fields__sidebar`、`.document-fields__sidebar-wrap`、`.pill`。tab 按钮没有独立 class：实现时寻找最小、稳定的选择器；若只能依赖深层 DOM 结构，则 tabs 只做容器级样式并在报告中说明。
- 值只引用 `--admin-*` 或 Payload 语义 token，不写裸色值；新增的尺寸（面板外边距、圆角、行高）定义为 `--admin-*` 变量放在 `theme.css`。
- 不改变 DOM、不隐藏元素、不改变交互；只改背景、边框、圆角、阴影、间距、字重。
- 响应式：窄屏（Payload 收起侧栏的断点）下面板外边距与圆角归零，避免浪费空间。
- 契约测试：扩展现有增强布局测试，断言 `enhanced.css` 中出现的每个 class 都存在于已安装 Payload CSS；缺失即失败。

## 3. B：Dashboard

| Widget | 变化 | 数据 |
|---|---|---|
| `dashboard-header`（新，`full`） | 标题 “Dashboard”、站点名（Site Settings `siteName`，缺省省略）、当日日期（服务端按 Admin 用户时区不可得时用站点默认时区格式化）、主按钮（首个有创建权限的 collection，默认 Products） | 现有 `siteIdentity` / 权限 |
| `overview` | 每项加图标色块（色值取系统色 token） | 不变 |
| `recent-quotes` | 样式对齐 demo | 不变 |
| `translations`（新） | 圆环：已同步语种 / 启用语种；右侧 Synced / In progress / Failed 计数 | 复用 `getTranslationStatus` |
| `content-activity`（新） | 最近 7 天每日更新的文档数柱状图 | 对 `products`、`blogs`、`pages` 按 `updatedAt` 每日区间 `payload.count`（`overrideAccess: false`），共 21 次计数；失败时 widget 显示 Unavailable |
| `system-status` | 增加总体状态（全部正常时绿点 “All systems normal”） | 不变 |
| `quick-actions` | 图标卡片样式 | 不变 |

- 默认布局：header（full）→ overview（full）→ recent-quotes + translations + content-activity（同一行，按已安装 `WidgetWidth` 选最接近 demo 的组合，实施时截图确认）→ system-status + quick-actions。
- 权限：translations、system-status 仅 admin（沿用现有规则）；其余所有登录用户。
- 每个 widget 自行捕获错误，空状态正常显示。
- 视觉取自 demo v3：widget 底色为次级底色（`--color-bg-secondary`）、圆角 16px、无描边；数字 tabular。

## 4. C：侧栏插槽组件（`src/plugins/adminTheme/sidebar/`）

### 4.1 搜索（`beforeNavLinks`，位于品牌下方）
- 输入框 + `⌘K` / `Ctrl K` 快捷键聚焦。
- 范围：当前用户可见的 collections 与 globals（使用 Payload 客户端公开 hook 读取配置与权限，以已安装版本为准），按 label 模糊匹配，回车或点击跳转。
- 不搜索文档内容（YAGNI；需要时另立设计）。
- 键盘：上下键选择、Enter 跳转、Esc 关闭；结果列表为浮层，样式用 `--admin-*`。

### 4.2 用户卡片（`afterNav`）
- 头像（姓名首字母）、姓名、角色（Administrator / Editor），点击进入账户页（Payload 公开的 account 路由）。
- 不重复 Payload 已有的登出入口。

### 4.3 品牌
- 现有 AdminIcon（`beforeNavLinks`）保持；搜索框紧随其后。

## 5. 测试

| 测试 | 内容 |
|---|---|
| 增强布局契约 | §2 |
| 插件注册 | `afterNav`、新 widgets 被追加且不覆盖已有配置；`enabled: false` 仍为原生配置 |
| Dashboard 数据 | content-activity 的日期区间与计数（mock payload）；translations 汇总；查询失败 → unavailable |
| 搜索 | 过滤只含可见 collections/globals；匹配与键盘行为（组件测试） |
| 用户卡片 | 角色文案与账户链接 |
| Admin e2e | 只跑 `tests/e2e/admin.e2e.spec.ts`：增强布局下内容面板有圆角与外边距、侧栏为窗口底色；⌘K 聚焦搜索并能跳转；用户卡片显示；Dashboard 新 widgets 渲染 |

全局检查：`tsc --noEmit --incremental false`、`lint`、`next build`。截图：login / dashboard / list / edit × light / dark，并与 demo v3 对照。
