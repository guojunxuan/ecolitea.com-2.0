# Admin 主题插件化 — 设计

- 日期：2026-11-20
- 分支：`feature/visual-refresh`
- 状态：设计已确认，待实施
- 前置：`2026-11-19-admin-ui-macos-redesign-design.md`（已实现；本设计只改变其“封装方式”，不改变视觉与功能）
- 约定：AGENTS.md「Payload extension conventions」中关于可升级性与 Admin 主题插件的条目（2026-11-20 新增）

## 1. 目标

1. 原生 Payload 不变：Admin 的全部定制封装为一个项目插件 `adminThemePlugin`。加入 `plugins` 即得到新 UI；移除即恢复原生 Payload Admin，无需改动其他代码。
2. 不阻碍升级：不修改、不 fork Payload 包，不手改生成文件；插件只使用公开配置接口。
3. Admin 标签页图标跟随 Site Settings 的 favicon。
4. 增强布局（灰色侧栏等需要依赖 Payload 非公开 class 的样式）作为插件内的显式选项，默认关闭，本项目开启。

## 2. 插件结构

```
src/plugins/adminTheme/
  index.ts             adminThemePlugin(options) — 唯一入口，只修改公开 config 键
  types.ts             AdminThemeOptions
  theme.css            语义 token 映射（自 src/app/(payload)/custom.css 迁入，内容不变）
  enhanced.css         增强布局（§4），仅在 enhancedLayout 开启时加载
  ThemeProvider.tsx    admin provider：加载 theme.css；按选项加载 enhanced.css；匿名主题同步
  brand/               自 src/components/admin/brand 迁入
  dashboard/           自 src/components/admin/dashboard 迁入
  adminIcon.ts         Payload endpoint handler（§3）
```

```ts
type AdminThemeOptions = {
  enabled?: boolean          // 默认 true；false 时插件不做任何修改
  enhancedLayout?: boolean   // 默认 false
}
```

### 2.1 插件写入的 config（全部为公开键）

- `admin.theme: 'all'`
- `admin.components.providers`（追加 ThemeProvider）、`admin.components.graphics.Logo/Icon`、`admin.components.beforeNavLinks`（追加品牌）
- `admin.dashboard`（widgets + defaultLayout）
- `admin.meta`：`titleSuffix`、`description`、`openGraph`、`icons`（指向 §3 的 endpoint）
- `endpoints`（追加 `/admin-icon`）

规则：
- 合并而非覆盖：已有的 providers、beforeNavLinks、endpoints 保留，插件只追加。
- 组件路径使用 importMap 可解析的项目路径；新增或移动组件后运行 `corepack pnpm generate:importmap`。
- `src/app/(payload)/custom.css` 恢复为空文件；`src/app/(payload)/layout.tsx` 不改。
- `payload.config.ts` 的 `admin` 中移除所有主题相关内容，只保留与主题无关的键（`importMap`、`user`、`livePreview`）；在 `plugins` 中加入 `adminThemePlugin({ enhancedLayout: true })`。

### 2.2 留在插件之外

- 导航分组 `admin.group`：属于内容组织，留在各 collection/global 配置中。
- 前台品牌清理（`siteIdentity`、metadata 等）：前台逻辑，不属于 Admin 主题。

### 2.3 CSS 加载

依据已安装的 Next 16 文档（`01-app/01-getting-started/11-css.md`），全局 CSS 可在 `app` 目录内任意组件中导入。ThemeProvider 导入 `theme.css`；样式位于 Payload 的 `@layer payload-default` 之外，因此优先级不依赖加载顺序。实现后必须用 `next build` 验证最终 CSS 顺序与生效情况（文档提示 dev 与 build 的顺序可能不同）。

`enhanced.css` 的条件加载：两个独立的 provider 组件（`ThemeStyles` 只导入 `theme.css`；`EnhancedLayoutStyles` 只导入 `enhanced.css`），插件按选项决定是否注册后者。不在运行时动态插入样式。

## 3. Admin 标签页图标跟随 Site Settings

- 插件注册 Payload endpoint：`GET /api/admin-icon`（路径以已安装 Payload 的 `endpoints` 约定为准）。
- 处理：读取 Site Settings（`depth: 1`），用现有 `resolveFavicon` 解析 favicon；存在时 `302` 重定向到其 URL（携带 `updatedAt` 版本参数，沿用 `getMediaUrl`）；不存在时 `302` 到 `/favicon.svg`。
- 响应头 `Cache-Control: no-store`（或很短的 max-age），保证更换 favicon 后刷新即可生效。
- 访问控制：favicon 本就是公开资产，前台以公开权限读取 Site Settings；endpoint 同样只读公开字段，不暴露其他设置。
- `admin.meta.icons` 指向 `/api/admin-icon`（SVG 与 ICO 两项可合为一项；以浏览器实际请求为准）。

## 4. 增强布局（`enhancedLayout`）

范围限定为一处：**侧栏与内容区的底色分层**（侧栏使用次级底色，内容区保持主底色），对应 demo v2 的最显著差异。不包括字段卡片化、Nav 图标/计数（仍不做）。

- 只在 `enhanced.css` 中，选择器限于 Payload 的 `.nav`（及其必要子元素，实施时以最少选择器为准），值只引用 `--admin-*` / Payload 语义 token。
- 契约测试：断言已安装 `@payloadcms/ui/dist/styles.css` 中仍存在 `enhanced.css` 依赖的每个 class 选择器；缺失即失败，提示升级时复查。
- 选项关闭时不加载该文件，Admin 只依赖公开 token。

## 5. 测试

| 测试 | 内容 |
|---|---|
| 插件开关 | 不加插件 / `enabled: false`：config 中不存在任何主题键（与原生一致）；加插件：providers、graphics、beforeNavLinks、dashboard、meta、endpoint 全部注册，且已有 providers/endpoints 被保留 |
| 增强布局开关 | `enhancedLayout` 关闭时不注册 `EnhancedLayoutStyles`；开启时注册 |
| Token 契约 | 迁移现有测试，路径改为 `theme.css`；`custom.css` 必须为空 |
| 增强布局契约 | §4 |
| admin-icon endpoint | 有 favicon → 302 到其 URL；无 favicon → 302 到 `/favicon.svg`；响应不含其他设置字段 |
| 现有测试 | 品牌、Dashboard、导航测试随文件迁移更新路径 |
| Admin e2e | 只跑 `tests/e2e/admin.e2e.spec.ts`：主题与品牌仍生效；`<link rel="icon">` 指向 `/api/admin-icon`；开启增强布局时侧栏底色为次级底色 |

全局检查：`tsc --noEmit --incremental false`、`lint`、`next build`（验证 CSS 顺序）。

## 6. 不做

- 发布为独立 npm 包（目录结构保持可抽离，但不建 workspace 包）。
- 字段卡片化、替换 Nav。
