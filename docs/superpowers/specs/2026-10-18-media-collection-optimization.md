# Media Collection 完善与优化

本文档记录 Media 解耦前的第一阶段：在拆分 Documents Collection 之前，先把 Media 自身的功能、数据完整性与编辑体验补齐。决策来自 2026-10-17 至 2026-10-18 的代码审查与后台实测（本地 MongoDB `ecolitea2`，R2 开发桶 `ecolitea-media-dev`，截图见 `output/playwright/media-audit/`）。

Documents Collection 的设计在本阶段完成后单独成文。下列事项明确留到 Documents 阶段：

- 前台渲染器的文档兜底分支（`components/Media/DocumentMedia` 及 `Media/index.tsx` 中的下载链接分支）。
- `folders` 是否在 Media 与 Documents 之间共用一棵树（`collectionSpecific`）。

---

## 1. 现状结论

| 项 | 结论 |
|---|---|
| 数据 | 45 条，全部 PNG/JPEG；2 条无 alt；2 条已归档到文件夹 |
| 图片/视频服务端校验 | 完整：MIME 白名单、宽高比、MP4 容器/编码/时长/大小，`durationSeconds` 防篡改 |
| 文件类型 | 未限制：非图片/视频文件直接放行 |
| 文件夹 | 关联方式正确（`folders: true` + `createFolderField`）；删除文件夹会级联删除子文件夹，素材变为未归档 |
| 编辑图片按钮 | 无功能（`crop`、`focalPoint` 均关闭，但按钮仅按 MIME 显示） |
| 下载按钮 | 跨域 `download` 属性失效，当前标签页跳转到 R2 |
| 版本记录 | Payload 4 默认开启；每次上传产生 2 个相同版本；换文件后旧版本指向已删除文件 |
| R2 | media、site-assets 共用桶根目录；5 条记录对应文件已 404，且无任何引用 |
| 列表/检索 | 默认列含 `Duration Seconds`，缺类型/尺寸/大小；只能按文件名搜索 |
| 后台缩略图 | 加载原图（单张可达 2MB） |
| 清理脚本 | 引用扫描漏掉 blogs、Header、Settings 及所有 Global |

---

## 2. 决策

### 2.1 数据完整性与存储

**D1 丢失文件的记录**：`atlas-x1-featured`、`atlas-x1-featured-1`、`run5-valid-png-4x3`、`run3-valid-png-4x3-1`、`delta` 五条记录暂不处理，在 D3 迁移的盘点步骤中一并处理。

**D2 关闭版本记录**：Media 设置 `versions: false`。删除已有的 Media 版本记录（当前 99 条）；执行前报告目标数据库并再次确认。

**D3 R2 按 collection 使用 prefix**：

- 前缀：`media/`、`site-assets/`，后续 `documents/`。
- R2 与 Cloudflare 无需改配置（prefix 只是对象 key 的一部分，公开域名绑定整个桶）。
- 存储插件规则：新文档的隐藏字段 `prefix` 默认为 collection prefix；存储 key 为 `文档 prefix || collection prefix` + 文件名；URL 在读取时由 `generateR2FileURL` 计算。
- `generateR2FileURL` 必须与插件的 key 规则一致（文档 prefix 为空时退回 collection prefix），并以集成测试锁定。
- 已有文件必须迁移（只对新文件生效会导致旧文件的删除/替换指向错误 key）。一次性迁移脚本，默认 dry-run：
  1. 盘点 media、site-assets 全部记录并检查根目录文件是否存在；
  2. 复制 `xxx` 到 `<prefix>/xxx`，不删除原文件；
  3. 更新文档的 `prefix` 与 `url`；
  4. 逐条校验新地址返回 200；
  5. 扫描写死的完整 URL 后，再删除根目录旧文件。
- 每个环境执行前报告目标数据库与桶。

**D4 Media 只接受图片与视频**：

- `upload.mimeTypes`：`image/jpeg`、`image/png`、`image/webp`、`image/avif`、`image/gif`、`video/mp4`。
- 服务端白名单：其余类型一律拒绝。报错只说明类型不受支持与允许的类型，不指向 Documents：
  `Unsupported file type: application/pdf. Media accepts images (JPEG, PNG, WebP, AVIF, GIF) and video (MP4).`
- 接受 Documents 上线前无处上传文档的空档。

**D5 上传字段的类型过滤**：在 `mediaUploadPolicy` 旁导出共享的 `imageOnly`、`imageOrVideo`（由 `MEDIA_UPLOAD_POLICY` 生成），所有引用 Media 的字段统一使用（服务端同样执行）：

| 字段 | 过滤 |
|---|---|
| CTA 卡片 `media` | `imageOnly` |
| Blogs/Posts `heroImage`（Blogs 由 `contains` 改为白名单） | `imageOnly` |
| Pages/Posts/CaseStudies/Blogs `meta.image` | `imageOnly` |
| Header 卡片图、Settings 博客 Hero 图与 SEO 图 | `imageOnly` |
| Hero（Pages、CaseStudies）`media` | `imageOrVideo` |
| MediaBlock `media` | `imageOrVideo` |

### 2.2 上传与校验

**D6 比例校验 + 锁比例裁剪 + 焦点**：

- 图片比例保持 1:1、4:3、3:2、16:9、9:16、4:5，容差 1%。
- 选择文件后在浏览器读取宽高；不合规时自动弹出项目自有裁剪框：可在 6 种比例间切换，默认最接近的比例，裁剪框锁定比例。
- 裁剪参数经公开的 `useUploadEdits` 交给 Payload 服务端（sharp）执行；裁剪结果替换原文件。
- 通过 `upload.admin.components.controls` 挂载；新增直接依赖 `react-image-crop@^10.1.8`（与 Payload 内部版本一致）。
- 服务端比例校验保留为兜底（API、粘贴 URL 上传不弹框，直接拒绝）。需测试确认服务端校验读到的是裁剪后的尺寸。
- 开启 `focalPoint`；前台裁切时将 `focalX`/`focalY` 作为 Cloudflare `gravity` 传入。已有图片焦点默认居中。

**D7 规则说明与报错**：

- Media `admin.description` 展示上传规则，文案由 `MEDIA_UPLOAD_POLICY` 生成。
- 每条报错说明“哪里不符合”与“允许什么”。
- 所有报错与说明使用英文，与 Payload 后台默认语言一致。

**D8 alt 必填、视频比例**：

- alt 对图片与视频均必填。
- 选择文件时若 alt 为空，预填文件名去掉扩展名后的部分（不做其他转换）。由 alt 字段的自定义客户端组件实现，批量上传同样生效。
- 不做实时校验；保存时服务端校验，不通过则无法保存，由用户修改：

| 规则 | 报错 |
|---|---|
| 去除首尾空格后非空 | `Alt text is required.` |
| 长度 5–125 字符 | `Alt text should be 5–125 characters.` |
| 不含文件扩展名 | `Alt text should describe the image, not repeat the filename.` |
| 不是相机/截图默认命名、纯数字或日期（`IMG_1234`、`DSC0021`、`Screenshot 2026-08-06`、`截屏2026-08-06 14.03.23`、`20260806`） | 同上 |
| 不是泛指词（`image`、`photo`、`picture`、`video`、`image2`） | `Alt text is too generic. Describe what is shown.` |

- 校验时机（见 D18）：仅在新建、替换文件、或本次提交修改 alt 时校验。不限制语言。已有数据不自动修改。
- 视频比例：16:9、9:16、1:1、4:5，容差 1%；先按旋转矩阵换算显示宽高；不提供视频裁剪，不合规直接拒绝。
- 视频的显示宽高写入 `width`、`height`。

**D20 视频解析与 faststart**：

- MP4 改为分块解析（每块 1MB），读到 `moov` 即停止，不再整读与整份复制。
- 拒绝 `moov` 位于文件末尾的视频：
  `Video is not optimized for web streaming (moov atom at end of file). Re-export with "Fast Start" / "Web Optimized" enabled, or run: ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`

### 2.3 后台列表、预览与操作

**D9 默认列**：缩略图 + 文件名、Alt、类型、尺寸、大小、文件夹、更新时间；`durationSeconds` 不在列表显示。尺寸与大小通过 `admin.components.Cell` 实现：`width` 列显示 `1356 × 910`（可按宽度排序），`filesize` 列使用 `payload/shared` 的 `formatFilesize`，与详情页格式一致。

**D10 搜索**：`listSearchableFields: ['filename', 'alt']`，`alt` 建索引。

**D11 后台缩略图**：图片 `adminThumbnail` 使用 `buildCloudflareImageURL`，宽 1200、`scale-down`（详情页大预览也使用 `thumbnailURL`，因此不能用 300 宽）；视频返回 `null`，显示默认文件图标。

**D12 下载与打开原图**：

- 新增 `GET /api/media/:id/download`：仅登录用户；`findByID` 取 `doc.url`；要求 `doc.url` 以 `R2_PUBLIC_URL` 开头（防 SSRF）；`fetch` 后以流转发，响应头 `Content-Disposition: attachment; filename*=UTF-8''<filename>`、`Cache-Control: private, no-store`。不新增 AWS SDK 依赖，不自行计算存储 key。
- 通过 `upload.admin.components.controls` 增加项目自有的 **Download**（指向上述接口）与 **Open original**（新标签打开 `doc.url`）。
- 以项目自有 class 作用域的 CSS 隐藏 Payload 自带的“新标签打开”与“下载”按钮；该 CSS 依赖 Payload DOM，由 E2E 断言兜底。
- Cloudflare 无需配置。

**D17 caption**：保留 Media 与 MediaBlock 两个 caption，补充说明：
- Media：`Default caption shown when this media is used in a Media block. A caption set on the block overrides it.`
- MediaBlock：`Overrides the media's default caption for this block only.`

**D19 复制**：Media 设置 `disableDuplicate: true`。

### 2.4 引用与删除

**D13 共享的素材引用查询**：与 schema 无关的通用扫描——遍历除 media 外的所有 collection、其版本记录、所有 Global 及其版本记录，在文档数据中匹配素材 ID。误判方向为“不删”。供清理脚本、D3 迁移、D1 处理、D14 使用。以对照测试锁定 Header、Blogs、Settings 等位置的识别。

**D14 删除保护与使用位置**：

- Media `beforeDelete` 调用 D13；被当前内容引用时拒绝删除并列出位置，批量删除与 API 删除同样生效：
  `Cannot delete: this media is used in Blogs "Title A" (heroImage), Header (navItems › Insta360 X4 › image). Remove these references first.`
- 版本记录中的历史引用不阻止删除，仅在面板中注明数量。
- 详情页侧边栏 `ui` 字段 “Used in” 面板，数据来自 `GET /api/media/:id/references`（仅登录用户，打开详情页时查询）。

**D18 文件夹**：

- 修正 D8 的 alt 校验时机，保证删除文件夹、批量移动等系统批量更新不会被旧数据中的不合规 alt 阻断。
- 补测试：素材可归档；删除文件夹后子文件夹被删除、素材变为未归档；文件夹内含不合规 alt 的素材时删除仍成功。
- `folders` 配置保持现有写法。选择弹窗不能按文件夹浏览为 Payload 能力限制，仅记录。

### 2.5 前台渲染

**D15 `ImageMedia`**：

- 调用方传入的 `alt` 优先（含空字符串，使用 `??`），否则使用素材 alt。`Header/Nav/NavigationCard.tsx` 的 `alt=""` 将由此生效（装饰图，修正重复朗读）。
- 无宽高时：有 `fill` 或比例则照常渲染；否则开发环境警告、生产环境渲染空占位。

**D16 `VideoMedia`**：

- `presentation.video` 增加播放模式：`ambient`（默认：自动播放、静音、循环、无控件）、`player`（有控件、不自动播放、可出声）。
- MediaBlock 增加 Playback 选项（Ambient / Player，默认 Ambient）；Hero 固定 Ambient。
- 封面由 Cloudflare 截帧生成（`/cdn-cgi/media/mode=frame,time=1s,width=…/<source>`），在 Cloudflare 适配器中构建；超出转换限制或本地存储时不设封面。
- 补 `type="video/mp4"`；60 秒转码阈值移入 `cloudflare.ts` 配置；删除无效的 `suspend` 监听。

### 2.6 测试环境

**E2E 默认关闭 R2**：`playwright.config.ts` 的 `DISABLE_R2_STORAGE` 默认改为 `true`；仅显式开启时写入 R2。不新增数据库与桶的对应约定。

---

## 3. 依赖与升级风险

新增直接依赖仅 `react-image-crop`（锁定 10.x）。项目自有组件与 Payload 内部实例互不传递，版本不一致不会冲突。

| 依赖点 | 公开 API | 风险 | 兜底 |
|---|---|---|---|
| `upload.admin.components.controls` | 是 | 低 | 重新生成 importMap；E2E 断言按钮存在 |
| `useUploadEdits` 与裁剪参数格式 | 是 | 中 | `tsc`；集成测试断言裁剪后尺寸 |
| `admin.components.Cell` | 是 | 低 | 组件测试 |
| CSS 隐藏自带按钮 | 否（DOM） | 高 | E2E 断言自带按钮不可见、项目按钮可见 |
| 存储插件 `prefix`/`url` 规则 | 是 | 中 | 集成测试断言 `generateR2FileURL` 与插件 key 一致 |

`docs/` 中增加 Media 升级检查清单，列出上述依赖点与对应测试。Payload 与 `@payloadcms/*` 同步升级后只运行清单内的定向测试。

---

## 4. 实施顺序

1. **配置与校验**：D2、D19、D4、D5、D7、D8（含 D18 的校验时机）、D20、D9、D10、D11、D17、E2E 默认值。重新生成 `payload-types.ts` 与 `importMap.js`。
2. **引用与删除**：D13、D14、D18 测试、清理脚本改用 D13。
3. **裁剪与焦点**：D6，含 Cloudflare `gravity`。
4. **下载与打开原图**：D12。
5. **前台渲染**：D15、D16。
6. **R2 迁移**：D3（含 D1、D2 的数据清理），按环境逐一执行，先 dry-run。

每一步只运行与该步相关的测试；数据操作前报告目标数据库与存储环境。
