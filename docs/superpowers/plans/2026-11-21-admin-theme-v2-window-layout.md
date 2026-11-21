# Admin 主题 v2（窗口式布局）实施计划

> 执行方式：superpowers:executing-plans + test-driven-development。每个任务先写失败测试，再实现，再单独提交。

**目标** — 按规格实现窗口式布局（A）、Dashboard（B）、侧栏插槽（C）、编辑页细节（D）。全部定制只放在 `src/plugins/adminTheme/`，移除插件即恢复原生 Admin。

**规格** — [admin-theme-v2-window-layout-design](../specs/2026-11-20-admin-theme-v2-window-layout-design.md)；前置 [admin-theme-plugin-design](../specs/2026-11-20-admin-theme-plugin-design.md)；视觉稿 `admin-demo-v3.html`（只读，不提交）。

**基线** — 分支 `feature/visual-refresh`，HEAD `4fb6e1d`；Payload 4.0.0-beta.10、Next 16.4.6、React 19.3.1。规格写于 canary.29，下文「beta.10 核实」一节取代规格 §2 的清单。

## 约束与验证环境

- 每条命令先 `export PATH="/tmp/node-24.22.3/node-v24.22.3-darwin-arm64/bin:$PATH"`；不装、不切 Node。
- int：`source /tmp/admin-ui-verification-env`，`DATABASE_URI=mongodb://127.0.0.1:27017/themev2-int-test`。
- build：`DATABASE_URI=.../themev2-build-test`、`PLAYWRIGHT_TEST=true`、`DISABLE_R2_STORAGE=true`，输出 `.next-e2e`。
- e2e：仓库的 `playwright.config.ts` 要求 `E2E_DATABASE_URI` 以 `-e2e` 结尾并自动生成 run 级库，因此用 `E2E_DATABASE_URI=mongodb://127.0.0.1:27017/themev2-e2e`，`DATABASE_URI=.../themev2-build-test` 作为“开发库”占位。**这与任务书“e2e 用 themev2-build-test”不同，原因是该命名会被配置拒绝。**
- 截图服务：dev server 在本环境不可用（Turbopack 解析不了 mock 字体；webpack dev 在 instrumentation 报 `stream`），因此用 `payload build --webpack` 的产物 + standalone 在 3002 上提供，数据库为 `themev2-shots-e2e`（e2e 夹具种子）。3000 端口与 `ecolitea2` 开发库一概不碰。
- 只暂存自己改的文件；`docs/` 被 `.gitignore` 忽略，仅本计划用 `git add -f`。不 push、不切分支、不合并；不动 `public/demos/*`；e2e 在仓库根留下的 `site-assets/` 核实后删除。
- 只跑定向测试：`admin-*` int spec、本计划新增 spec、`tests/e2e/admin.e2e.spec.ts`。最后跑 `tsc --noEmit --incremental false`、`lint`（基线 0 error / 17 warning）、`build`。
- 新增/移动组件后 `corepack pnpm generate:importmap`；`payload-types.ts` 若有变化先停下报告。

## beta.10 核实（取代规格 §2）

对 `node_modules/@payloadcms/ui/dist/styles.css` 逐个检查规格列出的 17 个 class，**全部仍存在**：`.template-default`、`.template-default__wrap`、`.nav`、`.app-header`、`.table`、`.collection-list`、`.collection-list__header`、`.collection-list__sub-header`、`.tabs-field`、`.tabs-field__tabs`、`.tabs-field__tabs-wrap`、`.group-field`、`.collapsible`、`.document-fields__main`、`.document-fields__sidebar`、`.document-fields__sidebar-wrap`、`.pill`。

beta.10 新增可用项：`.tabs-field__tab-button`、`.tabs__tab-button`、`.tabs__tab-button--active`、`.list-header`、`.list-controls`、`.paginator`、`.step-nav`、`.doc-controls`、`.collection-edit__main-wrapper`。不存在：`.doc-header`（不使用）。

- **tabs 按钮选择器**：规格担心无稳定选择器。beta.10 的 `TabButton` 带 `role="tab"` 与 `aria-selected`（`elements/Tabs/index.js`），ARIA 属性是公开契约，选择器用 `.tabs-field__tabs [role='tab']` / `[aria-selected='true']`，不依赖深层 DOM。契约测试同时断言安装包的 Tabs 源码仍输出这两个属性。
- **样式层**：Payload 全部样式在 `@layer payload-default` 内，项目样式在层外，优先级不依赖加载顺序，不需要 `!important`。
- **Nav 结构变化**：beta.10 的 `.nav` 顶部已有原生 UserMenu（头像+名称，含账户/登出）；`beforeNavLinks` 渲染在导航分组之前，`afterNav` 在 `.nav` 末尾。用户卡片仍按规格放 `afterNav`，与原生 UserMenu 的重复在报告中说明。

## 设计决策（相对规格的取舍）

1. **搜索只做原生 CommandPalette 的入口**（取代规格 §4.1 的自建搜索）：beta.10 的 Default 模板无条件挂载 `CommandPalette`，用 ⌘K / Ctrl+K 打开，列出与导航同一可见性规则下的 collections/globals；`CommandPalette`、`commandPaletteSlug`、`useModal` 均为 `@payloadcms/ui` 的公开导出。按 AGENTS.md“优先原生 Admin 行为”，侧栏 `beforeNavLinks` 只放一个触发按钮（`openModal(commandPaletteSlug)`），不自建搜索、不绑定快捷键，避免抢 ⌘K。契约测试断言这三个导出与 Default 模板的挂载仍在。
   - 规格 §5 中“搜索过滤 / 键盘行为”的组件测试因此不再适用；对应覆盖改为“入口只打开原生面板、不自绑快捷键”与上述契约。
   - 规格 §4.2 用户卡片：beta.10 的 `afterNav` 渲染在 `.nav__scroll` 滚动区末尾，需 `position: sticky; bottom: 0` 才能固定在可视区底部。
2. **Dashboard 宽度**：已安装 `WidgetWidth` = x-small 25 / small 33.3 / medium 50 / large 66.7 / x-large 75 / full 100。demo 第 3 行 1.25:1:1 最接近 `small×3`；第 4 行 1:1.25 最接近 `medium×2`。实施时截图确认。非 admin：recent-quotes + content-activity 用 `medium×2`。
3. **Header 日期**：Site Settings 没有时区字段，用 `payload.config.admin.timezones.defaultTimezone`（若有）否则 UTC 格式化，并在日期旁不加时区缩写。
4. **translations 汇总口径**：启用语种 = `status` 为 `translating` / `live`（与 system-status 一致）；每语种 `failed>0` → Failed；`ready===total` 且无 failed/waiting → Synced；其余 → In progress。圆环 = Synced / 启用语种。
5. **颜色**：新增尺寸与表面作为 `--admin-*` 变量放 `theme.css`（`--admin-canvas`、`--admin-window-gap`、`--admin-window-radius`、`--admin-window-shadow`、`--admin-row-height`、`--admin-widget-radius`）；`enhanced.css` 与组件 CSS 只引用 `--admin-*` / Payload 语义 token，不写裸色值。

## 任务

### 0. 计划与环境
- [x] 读规格、插件、测试、demo v3；核实 beta.10 class 与插槽类型。
- [ ] 提交本计划：`git add -f docs/superpowers/plans/2026-11-21-admin-theme-v2-window-layout.md`，`docs(admin): plan theme v2 window layout`。

### 1. A 窗口式布局（`theme.css` + `enhanced.css` + 契约）
- [ ] 改 `tests/int/admin-theme.int.spec.ts`：
  - enhanced 契约改为“`enhanced.css` 每个 class 都在安装 CSS 中；每个声明值只含 `var(--…)`、`calc(var…)`、`0`/`none`/长度关键字，无裸色（`#`、`rgb(`、`hsl(`）、无 `!important`；窄屏 `@media` 内面板外边距与圆角归零”。
  - token：`theme.css` 定义 6 个新 `--admin-*` 变量，light/dark 均有 canvas 与 shadow。
  - 删除“blocks 必须恰为 ['.nav']”的断言。
- [ ] 运行，观察失败。
- [ ] 实现：`.template-default` 窗口底；`.nav` 透明于窗口底；`.template-default__wrap` 浮动圆角面板（外边距、圆角、0.5px 描边 + 极淡阴影、`overflow: clip`）；`.app-header` 去分隔重影；`.collection-list .table` 圆角卡片、表头次级底色、行高、悬停；`.collection-list__header` 与 `__sub-header` 间距；`.paginator` 当前页实心；窄屏（Payload 收起侧栏的 768px 断点）归零。
- [ ] 在 3002 截图（light/dark）微调，与 demo v3 对照；处理编辑页“整页滚动 + `.template-default__wrap:has(.collection-edit__main-wrapper--scroll-fields-only)` 固定高度”与面板外边距叠加产生的双滚动条。
- [ ] 重跑测试通过，提交 `feat(admin): window layout for the enhanced theme`。

### 2. D 编辑页细节（`enhanced.css`）
- [ ] 先在契约测试中加入：tabs 选择器 class + ARIA 源码断言；group/collapsible/文档侧栏 class 存在。
- [ ] 实现：`.tabs-field__tabs` 分段控件容器（well 底、圆角、内边距）、`[role='tab']` 圆角、`[aria-selected='true']` 面板底 + 微阴影，去掉原生下划线伪元素的视觉重复；`.group-field`、`.collapsible` 次级底色圆角分组；字段间距与标签字重统一（仅使用已核实 class）；文档侧栏分组。不改 DOM、不隐藏元素。
- [ ] 截图核对；提交 `feat(admin): edit view details for the enhanced theme`。

### 3. B Dashboard 数据层（纯函数，先测）
- [ ] 新测试 `tests/int/admin-dashboard-v2.int.spec.ts`：
  - `getContentActivity`：给定“今天”，返回 7 个连续日期区间（含当日、UTC 日界），对 `products`/`blogs`/`pages` 各 7 次共 21 次 `count`，`overrideAccess:false`；各日求和；任一失败 → `null`（Unavailable）。
  - `summarizeTranslations`：按决策 4 分类；无启用语种 → `null`；`total=0` 视为 Synced。
  - `getDashboardHeader`：站点名取 `siteName` 去空白，空则省略；日期格式；主按钮取首个有 create 权限的 collection（顺序 products → blogs → pages → media），无则省略。
  - `getSystemStatus` 增加 `overall`：全部项非 “Not configured/Needs attention/failed>0” → `normal`，否则 `attention`。
- [ ] 实现上述模块（`getContentActivity.ts`、`summarizeTranslations.ts`、`getDashboardHeader.ts`，扩展 `getSystemStatus.ts`），复用 `getTranslationStatus`。
- [ ] 提交 `feat(admin): dashboard data for activity, translations and header`。

### 4. B Dashboard 组件与布局
- [ ] 测试：`admin-theme-plugin` 增加 widgets 追加断言；`DashboardHeader` / `Translations` / `ContentActivity` 渲染测试（空/Unavailable/正常）；`defaultLayout` 顺序与权限（admin / editor）。
- [ ] 实现：`DashboardHeader`、`Translations`（`conic-gradient` 圆环，CSS 变量 `--p`）、`ContentActivity`（7 柱，当日实色）、`Overview` 图标色块（内联 SVG，色取 `--admin-*`）、`RecentQuotes` 对齐 demo、`SystemStatus` 总体状态点、`QuickActions` 图标卡片；`Dashboard.module.css` 改为次级底色、16px 圆角、无描边、数字 tabular。
- [ ] `config.ts` 追加 widgets 与默认布局；`generate:importmap`；截图核对宽度组合。
- [ ] 提交 `feat(admin): window-style dashboard widgets`。

### 5. C 侧栏插槽
- [x] 测试：
  - 原生面板契约：`CommandPalette`/`commandPaletteSlug`/`useModal` 仍公开导出，Default 模板仍挂载面板，面板仍以 `cmdCtrlKey` + `k` 打开。
  - `SidebarSearch`：点击只调用 `openModal('command-palette')`；`⌘K`/`Ctrl K` 按平台显示；不自绑键盘快捷键。
  - `getUserCard`：角色文案 Administrator / Editor（未知角色回退原值）、姓名缺省回退邮箱、首字符大写（含非拉丁）、账户链接用配置的 admin 与 account 路由。
  - `UserCard`：账户链接、首字母、角色；无用户时不渲染。
  - 插件注册：`beforeNavLinks` 在既有项之后追加品牌与搜索入口；`afterNav` 追加用户卡片；`enabled:false` 不变。
- [x] 实现 `sidebar/`：`SidebarSearch.tsx`（client，入口）、`getUserCard.ts`、`UserCard.tsx`（sticky 固定底部）、`Sidebar.module.css`；`index.ts` 注册；`generate:importmap`。
- [x] 提交 `feat(admin): sidebar search entry and user card slots`。

### 6. e2e、截图与收尾
- [ ] 更新 `tests/e2e/admin.e2e.spec.ts`：增强布局下内容面板圆角与外边距、侧栏窗口底色；⌘K 聚焦并跳转；用户卡片；Dashboard 新 widgets；截图分支改指 demo v3 与 `/tmp/themev2-shots`。
- [ ] 跑 `tests/e2e/admin.e2e.spec.ts`（`ADMIN_UI_SCREENSHOTS=true`），核实并删除根目录 `site-assets/`。
- [ ] 跑 `tsc --noEmit --incremental false`、`lint`、`build`；`git status` 确认无多余文件。
- [ ] 提交 `test(admin): cover theme v2 in e2e`，输出报告。

## 风险
- 编辑页面板外边距与 Payload 固定高度/粘性定位叠加；以截图和 e2e 的几何断言兜底，失败时只缩减到容器级样式并报告。
- 当前环境无可用 dev server，视觉迭代依赖“build + standalone + 注入样式”；最终以完整 build 截图为准。
