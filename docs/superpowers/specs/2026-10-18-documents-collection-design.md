# Documents Collection 设计

本文档是 Media 解耦的第二部分：新增 `documents` Collection，专门管理产品资料、认证与合规文件、营销资料等文档。Media 的完善与优化见 `2026-10-18-media-collection-optimization.md`，两份文档需一起阅读。

Documents 只负责资源管理：上传、存储、校验、元数据、文件夹、引用与删除保护、后台下载。文档在前台如何展示由其他业务规范决定，不在本设计范围内；本设计只保证数据结构稳定。

---

## 1. 范围与原则

- 定位与 Media 相同：资源库。不提供前台渲染组件、链接类型或区块。
- **完全独立实现**：Documents 不引用 Media 的任何模块（上传策略、校验器、引用查询、下载接口、后台组件均为 Documents 自有）。与 Media 逻辑相似之处按 Documents 的需要单独实现。
- 所有文档公开可读，走 R2 公开域名，存放于 `documents/` 前缀。
- 后台文案与报错统一使用英文。

## 2. 模块结构

```
src/collections/Documents/
├── index.ts                        # Collection 配置
├── uploadPolicy.ts                 # 类型白名单、大小上限、规则说明文案
├── validateDocumentUpload.ts       # 上传内容校验
├── validateTitle.ts                # title 规则
├── references.ts                   # 引用查询
├── hooks/
│   └── preventReferencedDelete.ts  # beforeDelete 删除保护
├── endpoints/
│   ├── file.ts                     # GET /api/documents/:id/file（同源后台文件接口）
│   └── references.ts               # GET /api/documents/:id/references
└── admin/
    ├── TitlePrefill.tsx            # 选择文件时预填 title
    ├── UsedInPanel.tsx             # Used in 面板
    └── FilesizeCell.tsx            # 列表大小列
```

外部接入点（仅此几处）：

| 位置 | 改动 |
|---|---|
| `src/payload.config.ts` | 注册 `Documents` |
| `src/plugins/index.ts` | `r2StorageCollections` 增加 `documents`，`prefix: 'documents'`，URL 由 `generateR2FileURL` 生成（与 Media D3 的 key 规则一致） |
| `folders` | `createFolderField({ relationTo: 'folders' })`，与 Media 共用文件夹树（不开启 `collectionSpecific`） |
| `src/access/` | `anyone`、`authenticated` |
| `src/utilities/env.ts` | 读取 `R2_PUBLIC_URL` |

删除：`src/components/Media/DocumentMedia/` 及 `src/components/Media/index.tsx` 中的文档兜底分支（对应测试同步更新）。

## 3. 数据模型

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | text，必填，索引 | 显示名称（`useAsTitle`）。规则见 §5 |
| `description` | textarea，选填 | 一两句简介 |
| `_h_folders` | relationship（`createFolderField`） | 文件夹 |
| 上传字段 | Payload 自动 | `filename`、`mimeType`、`filesize`、`url`、`prefix` 等 |

Collection 设置：

- `slug: 'documents'`，labels `Document` / `Documents`。
- `access`：`read: anyone`；`create`、`update`、`delete: authenticated`。
- `versions: false`；`disableDuplicate: true`。
- `upload.mimeTypes`：见 §4；无 `imageSizes`，`crop: false`，`focalPoint: false`。
- `upload.adminThumbnail`：返回同源地址 `<serverURL>/api/documents/:id/file`（见 §6）。
- `admin.useAsTitle: 'title'`；`admin.defaultColumns`：`title`、`filename`、`mimeType`、`filesize`、`_h_folders`、`updatedAt`；`admin.listSearchableFields: ['title', 'filename']`。
- `admin.description`：由 `uploadPolicy.ts` 生成的规则说明。

## 4. 上传策略与内容校验

`uploadPolicy.ts`：

| 类型 | MIME | 扩展名 |
|---|---|---|
| PDF | `application/pdf` | `.pdf` |
| Word | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` |
| Excel | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` |
| PowerPoint | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | `.pptx` |

- 大小上限 10MB（10,000,000 字节）。
- 不支持旧版 `.doc`/`.xls`/`.ppt`，不支持带宏格式（`.docm`、`.xlsm`、`.pptm`），不做加密 PDF 检测。

`validateDocumentUpload.ts`（`beforeValidate`，仅在有新文件时执行），依次检查：

1. MIME 在白名单内，否则：
   `Unsupported file type: <mime>. Documents accepts PDF, Word (.docx), Excel (.xlsx) and PowerPoint (.pptx).`
2. 大小不超过 10MB：
   `File size exceeds the maximum of 10 MB.`
3. 扩展名与 MIME 一致：
   `File extension ".<ext>" does not match its type (<expected>).`
4. PDF：沿用 Payload 自带的结构检查（文件头与 `%%EOF`/`xref`），项目不重复实现。
5. Office：读取 ZIP 中央目录（使用 Node 内置 `zlib` 解压条目，不新增依赖），要求：
   - 存在 `[Content_Types].xml`，其主文档部件的 content type 与声明类型一致（`wordprocessingml.document.main+xml`、`spreadsheetml.sheet.main+xml`、`presentationml.presentation.main+xml`）；
   - 不存在 `vbaProject.bin`，且 content type 中不含 `macroEnabled`。
   报错：
   `File is not a valid <Word|Excel|PowerPoint> document.`
   `Documents with macros are not allowed. Save the file as .<docx|xlsx|pptx> without macros and upload again.`

校验抛出 `APIError(400)`，校验失败的文件不会写入 R2。

## 5. title

- 选择文件时，若 `title` 为空，`TitlePrefill` 预填文件名去掉扩展名后的部分（不做其他转换），批量上传同样生效。
- 保存时服务端校验，不通过则无法保存：

| 规则 | 报错 |
|---|---|
| 去除首尾空格后非空 | `Title is required.` |
| 长度 3–150 字符 | `Title should be 3–150 characters.` |
| 不含文件扩展名 | `Title should describe the document, not repeat the filename.` |
| 不是默认命名（`scan_001`、`Scan 2026-08-06`、`document1`、`Untitled`、`New Document`、纯数字或日期） | 同上 |
| 不是泛指词（`document`、`file`、`pdf`、`doc`、`untitled`） | `Title is too generic. Describe the document.` |

- 校验时机：新建、替换文件、或本次提交修改 `title` 时；仅修改文件夹、描述等其他字段时不校验（保证删除文件夹、批量移动不被旧数据阻断）。
- 不限制语言；已有数据不自动修改。

## 6. 后台操作

**详情页**：PDF 使用 Payload 自带的页内预览；Office 显示图标与文件信息。

**下载与打开原文件：同源后台文件接口**

不使用自定义按钮，也不隐藏 Payload 自带按钮（避免依赖 Payload 私有 DOM）。自带的“新标签打开”与“下载”按钮链接取 `thumbnailURL ?? url`，`thumbnailURL` 由公开配置 `upload.adminThumbnail` 生成；链接同源时浏览器才会遵循 `download` 属性。

- `GET /api/documents/:id/file`：
  - 仅登录用户，未登录返回 401。
  - `findByID` 取 `url`、`filename`、`mimeType`（`depth: 0`）。
  - 请求头 `Sec-Fetch-Dest: image`（列表与选择弹窗的缩略图）：返回 404，Payload 缩略图组件加载失败后显示默认文件图标。
  - 其他值或缺失（下载、新标签打开、老浏览器）：`fetch(doc.url)` 后以流转发，`Content-Type` 取 `mimeType`，`Content-Disposition: inline; filename*=UTF-8''<filename>`，`Cache-Control: private, no-store`。同源链接上的 `download` 属性使浏览器直接保存；新标签页内 PDF 直接显示。上游非 200 时返回 502。
  - 地址来源检查（防 SSRF）：`doc.url` 必须以 `R2_PUBLIC_URL` 开头；`DISABLE_R2_STORAGE=true` 时允许本站地址。
- 🔗“复制链接”使用 `url`（R2 公开地址），不受影响。PDF 页内预览使用原文件地址，不受影响。
- `thumbnailURL` 为后台专用地址，前台不得使用。
- 依赖的内部行为：自带按钮链接取自 `thumbnailURL`。若 Payload 改变此行为，仅退化为跳转到 R2，界面不出错；由定向 E2E 兜底。

**列表**：`FilesizeCell` 使用 `payload/shared` 的 `formatFilesize` 显示大小。

## 7. 引用与删除保护

- `references.ts`：与 schema 无关的通用扫描——遍历除 `documents` 外的所有 Collection、其版本记录、所有 Global 及其版本记录，在文档数据中匹配 Document ID，返回引用位置（collection/global、文档 ID 与标题、字段路径）。误判方向为“不删”。
- `preventReferencedDelete`（`beforeDelete`）：被当前内容引用时抛出错误并列出位置，批量删除与 API 删除同样生效：
  `Cannot delete: this document is used in <Collection> "<title>" (<path>). Remove these references first.`
  版本记录中的历史引用不阻止删除。
- `GET /api/documents/:id/references`：仅登录用户；返回当前引用与历史版本引用数量。
- `UsedInPanel`：详情页侧边栏 `ui` 字段，打开详情页时请求上述接口，列出引用位置并提供跳转链接，注明历史版本引用数量。

当前没有任何字段引用 `documents`，删除保护与面板为后续业务接入预留，测试中以临时 fixture 覆盖。

## 8. 测试

只运行与改动相关的测试（不运行全量 E2E）：

| 范围 | 测试 |
|---|---|
| 上传策略 | 白名单、10MB、扩展名一致性；PDF 结构不合法被拒（Payload 检查） |
| Office 校验 | 合法 docx/xlsx/pptx 通过；改名文件、缺 `[Content_Types].xml`、类型不匹配、含 `vbaProject.bin`、`macroEnabled` 均被拒（以测试内生成的最小 ZIP 构造） |
| title | 各条规则的通过与拒绝；仅改文件夹/描述时不校验 |
| Collection 配置 | access、`versions: false`、`disableDuplicate`、默认列、搜索字段、R2 前缀与 URL 生成 |
| 引用与删除 | 临时 fixture 引用时删除被拒；无引用时可删；版本引用不阻止删除；接口需要登录 |
| 后台文件接口 | 未登录 401；`Sec-Fetch-Dest: image` 返回 404；其他请求流式返回原文件且响应头正确（含中文文件名）；非允许来源拒绝；上游失败 502 |
| 文件夹 | 可归档；删除文件夹后文档变为未归档 |
| 渲染器 | `Media` 组件不再渲染文档链接 |
| 后台 E2E（定向） | 上传流程与 title 预填；点击自带下载按钮触发下载事件且页面不跳转 |

测试使用 `DISABLE_R2_STORAGE=true`，不访问生产服务。完成后重新生成 `payload-types.ts` 与 `importMap.js`，并运行 `tsc --noEmit` 与 `lint`。

## 9. 实施顺序

Documents 与 Media 计划相互独立，可在 Media 计划之后或之间实施。建议顺序：

1. Media 计划第 1 步（配置与校验，含 D4：Media 拒绝文档类型）。
2. Documents：§3–§5（Collection、上传策略、title）→ §6 → §7 → §8；同时删除 `DocumentMedia`。
3. Media 计划其余步骤。

Media 的 R2 迁移（D3）不涉及 Documents：现有 Media 中没有文档，Documents 从一开始就使用 `documents/` 前缀。
