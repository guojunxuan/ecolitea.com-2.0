# Playwright 产品示例数据创建记录

完成日期：2026-10-25（Asia/Shanghai）。目标：`mongodb://127.0.0.1:27017/ecolitea2`，后台 `http://localhost:3000`。

**结果：新增10条产品草稿，共29个非空sections、29个Block，覆盖6种现有Product Blocks。每条3张图库、2条卖点、2条规格；使用已有媒体，没有上传文件。**

新增关联分类：影像设备 · 示例（`6adcb95ef43c3bb2c41ea3f5`）。原有未命名草稿 `6adcb533f43c3bb2c41ea3ef` 保留。

| 产品 | slug | sections | 后台 |
|---|---|---:|---|
| Insta360 X6 · 示例 01 | `demo-insta360-x6` | 2 | [编辑](http://localhost:3000/admin/collections/products/6adcb636f43c3bb2c41ea3f2) |
| Insta360 X5 · 示例 02 | `demo-insta360-x5` | 3 | [编辑](http://localhost:3000/admin/collections/products/6add5b7e82afd3ebe2331b22) |
| Insta360 X4 Air · 示例 03 | `demo-insta360-x4-air` | 3 | [编辑](http://localhost:3000/admin/collections/products/6add5c1f82afd3ebe2331b24) |
| Insta360 Ace Pro 2 · 示例 04 | `demo-insta360-ace-pro-2` | 3 | [编辑](http://localhost:3000/admin/collections/products/6add5c3782afd3ebe2331b26) |
| Insta360 GO Ultra · 示例 05 | `demo-insta360-go-ultra` | 3 | [编辑](http://localhost:3000/admin/collections/products/6add5c3d82afd3ebe2331b28) |
| Insta360 GO 3S · 示例 06 | `demo-insta360-go-3s` | 3 | [编辑](http://localhost:3000/admin/collections/products/6add5c4582afd3ebe2331b2a) |
| Insta360 Flow 2 Series · 示例 07 | `demo-insta360-flow-2-series` | 3 | [编辑](http://localhost:3000/admin/collections/products/6add5c4b82afd3ebe2331b2c) |
| Insta360 Link 2 Pro · 示例 08 | `demo-insta360-link-2-pro` | 3 | [编辑](http://localhost:3000/admin/collections/products/6add5c5382afd3ebe2331b2e) |
| Insta360 Mic Pro · 示例 09 | `demo-insta360-mic-pro` | 3 | [编辑](http://localhost:3000/admin/collections/products/6add5c5b82afd3ebe2331b30) |
| Insta360 Pro 2 · 示例 10 | `demo-insta360-pro-2` | 3 | [编辑](http://localhost:3000/admin/collections/products/6add5c6182afd3ebe2331b32) |

## 创建与验证方式

第一条通过Playwright操作Admin表单创建。新建和Duplicate入口之后返回默认slug唯一性错误，后9条改由Playwright的page.request调用Payload公开REST接口创建，显式传入独立slug和draft状态，保留访问控制、服务器校验和hooks。未使用直接MongoDB写入。

后9条复用第一条真实sections结构，并添加Carousel、Tabs、Accordion、Code示例。创建期间当前schema更新为Tabs/Accordion子项title、Banner.body、Code.minHeight，数据按当前配置适配；前两条自建草稿的Banner文案同步到body。没有修改应用源码或覆盖其它工作区改动。

最终通过公开只读API检查10条记录状态、slug、媒体引用、section及Block内容，并在Admin搜索“示例”确认10行均为Draft。临时调整的Media列显示和每页10条设置已恢复。

证据：`verified-products.json`、`final-verification.log`、`ui-verification.log`、`preferences-restored.log`、`products-list.png`。

Block分布：{"productMediaBanner": 10, "productMediaText": 10, "productMediaCarousel": 3, "productMediaTabs": 2, "productMediaAccordion": 2, "productCode": 2}。
