# Settings Blog 后台折叠布局设计

## 决策

Settings 的 Blog 标签直接呈现 Hero 和 SEO 两个原生 Payload `collapsible` 区域。Hero 默认展开，SEO 默认折叠。后台不再显示 “Listing page” 标题。

保留 `blog.listing.hero` 和 `blog.listing.seo` 的持久化路径；仅将现有 `listing` group 作为无标题的数据容器。这样现有配置与前端消费者无需迁移或改变行为，未来 Blog 其他设置可作为 Blog 标签的兄弟字段继续增加。

## 实现与验证

在 `src/Settings/fields/blog.ts` 中为 `listing` group 设置 `label: false` 和 `admin.hideGutter`，其 Hero 与 SEO group 外各加一层无名称 `collapsible`。原生 group 继续承载持久化字段。校验现有 SEO 插件字段、生成按钮、图片选择和前端数据读取均不变。更新 Settings 结构测试、生成类型，并在后台浏览器验证折叠与展开。
