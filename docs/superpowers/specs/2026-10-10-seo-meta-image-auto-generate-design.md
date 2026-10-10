# SEO Meta Image 自动选图设计

## 范围

在现有全部 SEO 编辑处启用 Payload SEO 插件的 Meta Image Auto-generate：Settings → Blog、Blogs、Posts、Pages 和 Case Studies。不生成新文件，也不接入 AI。按钮只填入表单，仍由编辑点击 Save 后持久化。

## 图片来源

| SEO 编辑处 | 自动选图来源 |
| --- | --- |
| Settings → Blog | `blog.listing.hero.image`，与 Hero 启用开关无关 |
| Blogs | `heroImage` |
| Posts | `heroImage` |
| Pages / Case Studies | `hero.media`，仅在 Hero 类型会显示媒体时采用 |

所有候选关系通过 Payload Media 读取并核实 MIME 属于项目允许的图片类型。不存在、无权限或为视频时，返回当前 Meta Image；当前 Meta Image 也为空时，保持空值。按钮不修改内容主图，不绕过保存动作。原有 SEO 字段和前端 Metadata 读取规则不变。

## 实现边界

在共享 SEO 插件配置增加 `generateImage`，在五个现有 MetaImageField 上打开 `hasGenerateFn`。继续使用 Payload 公共 API 查询 Media，不直接访问数据库或存储提供方。用聚焦测试覆盖映射、类型校验、空值保留和已有标题/描述生成逻辑；再进行类型与后台按钮验证。
