# Next.js 16 多语言路由可行性 spike

日期：2026-11-15。工作树：`spike-i18n-routing`；分支：`spike/i18n-routing`；起点：`895ecb9`（`feature/i18n-consent`）。

**结论：方案可行，但必须连同前台根布局、路径失效和 URL 生成一起迁移。** 仅移动页面、保留原根布局和缓存 hook 不足以完成多语言支持。本报告是技术验证，非生产实现；本提交只保留报告，临时原型和类型检查辅助修改均已撤回。

## 1. 六项裁决

| 问题 | 裁决 | 关键证据 / 条件 |
|---|---|---|
| 1. `[lang]` + 无前缀内部 rewrite | **works with caveats** | 安装版 Next **16.3.3**，`src/proxy.ts`，`export function proxy(request)`（也可 default）；英文请求 200、无 Location，实际路由 `/en/...`；`/de/...` 得到 `lang=de`。同层旧 `[slug]` 必须迁入 `[lang]/[slug]`。 |
| 2. 显式 `/en/...` 301 | **works with caveats** | 推荐合并进现有 `redirects.ts` / `next.config.ts` 的静态 redirects；必须显式覆盖 `/en → /`。只用 wildcard 在 `/en` 上产生空 Location。`statusCode: 301`，不能用 `permanent: true`（得到的是 308）。 |
| 3. 现有特殊路由 | **works with caveats** | 四个 XML handler、sitemap index、robots、Payload Admin/API、预览/退出预览正常；这些应排除 rewrite。`/search` 应移入 `[lang]` 并参与 rewrite，不应排除。 |
| 4. SSG 与 HTML lang | **works with caveats** | build 成功，`en/de × one/two` 四条静态 HTML 进入 prerender manifest。**保留 `(frontend)/layout.tsx` 并从它的 params 读取子级 lang：does not work**；移为 `(frontend)/[lang]/layout.tsx` 后 HTML 正确且可静态生成。 |
| 5. 未知 / translating / slug 冲突 | **works with caveats** | `/xx`、`/xx/...`、fixture `fr=translating` 均 404。`de=live` 时 `/de` 已被德文首页占用；Payload 当前允许保存 `slug=de`，需要服务端保留 slug 校验。未知代码的词法识别需要明确约定，见 §6。 |
| 6. 缓存与 draft preview | **works with caveats** | `unstable_cache`、`revalidateTag` 工作；必须把 locale 加入缓存 **key 和 tag**。`revalidatePath('/routing-probe/two')` 无效，`revalidatePath('/en/routing-probe/two')` 有效。现有登录 + preview handler 的 bypass Cookie 可穿过 rewrite；英文/德文探针 draft 均为 true。 |

## 2. 环境、边界与读过的文档

- `package.json` / 安装版本：Next `16.3.3`、React `19.2.6`、Payload 与全部 `@payloadcms/*` `4.0.0-canary.29`；Node `v24.20.0`、pnpm `9.15.4`。
- 起始 Git status 干净。`node_modules` 缺失，运行 `corepack pnpm install --frozen-lockfile`，成功；lockfile 无变化。
- 全程只在本工作树操作。未访问 `/Users/jason/ecolitea.com 2.0`，未使用端口 3000。
- 本地数据库准确目标：`mongodb://127.0.0.1:27017/ecolitea2-spike-routing`。MongoDB 可用；首次沙箱连接 EPERM 属于权限限制，授权后连接正常，不能把它解释成应用回归。
- `DISABLE_R2_STORAGE=true`；R2 bucket/keys 均为 `spike-unused`，endpoint `https://storage.example.invalid`、public URL `https://media.example.invalid`。无上传、无生产凭据、无生产服务调用。
- 仅通过 Payload Local API 在隔离库写入 3 个已发布 Pages：`home`、`routing-spike`、故意冲突的 `de`；另建 `routing-spike@example.invalid` 本地预览用户。页面用有效 `pageContent` 块、无图片。未 seed 产品或博客，故真实文档的翻译就绪过滤不在本实验覆盖内。
- 服务最终统一使用 `--port 3101 --hostname localhost`，`NEXT_PUBLIC_SERVER_URL=http://localhost:3101`。
- seed 的第一次 `layout: []` 被原有 required 校验拒绝（`Content > Layout: This field requires at least 1 Row.`）；改用 `layout: [{ blockType: 'pageContent', columns: [] }]` 后成功。这是测试输入错误，不是路由缺陷。

写代码前阅读了 `AGENTS.md` 和设计 §3 / §5，并阅读以下 **安装包自带** 文档（前缀 `node_modules/next/dist/docs/01-app/`）：

- `01-getting-started/16-proxy.md`
- `03-api-reference/03-file-conventions/{proxy,dynamic-routes,route-groups,layout}.md`
- `03-api-reference/04-functions/generate-static-params.md`
- `03-api-reference/05-config/01-next-config-js/{rewrites,redirects}.md`
- 后续针对缓存 / 预览读 `04-functions/{unstable_cache,revalidateTag,revalidatePath,draft-mode}.md` 和 `02-guides/internationalization.md`。

公开主文档可交叉参考：[Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)、[Layout](https://nextjs.org/docs/app/api-reference/file-conventions/layout)、[Rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)、[revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)。本报告以安装版行为为准。

## 3. 推荐文件布局与 proxy

```text
src/
  proxy.ts                         # 与 src/app 同级，不能放 app 内或 route group 内
  i18n/config.ts                   # source / live / translating 单一来源
  app/
    (frontend)/
      globals.css                  # 可原址保留；新 layout 改为 ../globals.css
      [lang]/
        layout.tsx                 # 前台根布局，拥有 html/body，await params.lang
        not-found.tsx
        page.tsx                   # 英文公开 /，内部 /en
        [slug]/page.tsx
        search/page.tsx
        blogs/...
        posts/...
        products/...
        case-studies/...
        pages.module.css
      (sitemaps)/.../route.ts       # 原址保留，无语言前缀
      next/preview/route.ts         # 原址保留
      next/exit-preview/route.ts    # 原址保留
    (payload)/                     # 原址保留；自有根布局
      layout.tsx
      admin/[[...segments]]/...
      api/...
```

安装版接受 `proxy.ts` / `proxy.js`，单个函数为 named `proxy` 或 default；只支持一个 proxy 文件。这个仓库的准确位置是 **`src/proxy.ts`**。不要新建 `middleware.ts`；该名字已弃用，也不要导出 `runtime`，Proxy 固定默认 Node.js runtime，该配置会报错。build 输出仍显示 `ƒ Proxy (Middleware)`，这是内部命名，不代表需要旧文件名。

以下是经过验证的临时路由逻辑（未实现任何翻译读取）：

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { locales } from './i18n/config'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const first = pathname.split('/')[1]
  const locale = locales.find(({ code }) => code === first)

  if (locale?.status === 'translating') {
    return new NextResponse('Unavailable locale', { status: 404 })
  }
  if (locale) return NextResponse.next()

  // Explicit policy: reserve syntactic locale prefixes too; see §6.
  if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(first)) {
    return new NextResponse('Unknown locale', { status: 404 })
  }

  const destination = request.nextUrl.clone()
  destination.pathname = `/en${pathname === '/' ? '' : pathname}`
  return NextResponse.rewrite(destination)
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|admin(?:/|$)|next(?:/|$)|_next(?:/|$)|fonts(?:/|$)|media(?:/|$)|brand-assets(?:/|$)|.*\\.[^/]+$).*)',
  ],
}
```

Matcher 必须是静态字符串常量。`(?:/|$)` 避免错误排除 `/apiary` 这类正常页面。末尾扩展名规则覆盖当前 `*.xml`、robots、favicon、图片、脚本、字体等文件；目录排除也保护无扩展名的资源。**此 matcher 假设英文内容 URL 的最后一段不含点**；若允许点号 slug，应换成显式 sitemap / public 资源规则并加覆盖测试，不能默默牺牲这些 Pages。新增无扩展名 public 资源目录也需加入规则。

不读取语言偏好或授权 Cookie，不读取 Accept-Language；明确 URL 决定语言。不要在 Proxy 内查 Payload、认证会话或译文就绪状态。Proxy 不承担数据授权；Payload access control 仍是 API / Admin 的边界。

### 301 的位置

推荐复用当前 `redirects.ts`，在原有 IE 规则前加入：

```ts
return [
  { source: '/en', destination: '/', statusCode: 301 },
  { source: '/en/:path*', destination: '/:path*', statusCode: 301 },
  internetExplorerRedirect,
]
```

`statusCode` 与 `permanent` 不要同时指定。配置 redirects 在 proxy 前执行；同源内部 rewrite 不重新执行 redirects，因此无循环，查询参数自动保留。规则针对显式入口（包括 `/en/admin → /admin`），实际 `/admin` 仍不经过语言 rewrite。

也可在 proxy **rewrite 前**判断 `pathname === '/en' || pathname.startsWith('/en/')` 并 `NextResponse.redirect(url, 301)`，但这里没有依赖请求数据的必要。静态配置更直接，且用相对目标避免部署主机名影响 Location。

### 本机 IP 与 hostname 不一致的陷阱

最初使用 `--hostname 127.0.0.1`，`request.nextUrl.clone()` 生成了 `http://localhost:3101/en/routing-probe`。无前缀请求结果为：

```text
HTTP/1.1 301 Moved Permanently
x-middleware-rewrite: http://localhost:3101/en/routing-probe
location: /routing-probe
```

这会自重定向。安装版 `next/dist/server/web/next-url.js` 的 `REGEX_LOCALHOST_HOSTNAME` 把环回 IP 改为 localhost；`shared/lib/router/utils/relativize-url.js` 按 origin 是否相等决定内部或外部 URL，`server/lib/router-utils/resolve-routes.js` 对绝对目标走代理分支。因 origin 不同而再次入站，才触发了 `/en` redirect。把 redirect 挪进 proxy 也不能解决这个同源问题（对照实验同样重定向）。

统一启动 hostname 和测试 URL 为 **localhost** 后，两套路由 200，配置 redirect 也正确。不要误报为“next.config redirects 与内部 rewrite 不兼容”。正式容器应测试真实 Host / 反向代理部署，确认 rewrite 保持同源；不要盲目把所有 URL 的 hostname 强制改成 localhost。

## 4. 页面、根布局和静态生成

### 同层 `[slug]` 不能留下

只新建 `(frontend)/[lang]/routing-probe/page.tsx`，保留旧 `[slug]`，`next dev` 在启动阶段退出：

```text
Error: You cannot use different slug names for the same dynamic path ('lang' !== 'slug').
ELIFECYCLE Command failed with exit code 1.
```

因此根首页和 `[slug]` 必须协调迁移，不能靠 route group 隔开；route group 不参与 URL，无法解除冲突。原首页从 `./[slug]/page` 导入模板，整个子树一起移即可保留该关系。

### 根布局也必须下移

保留旧 `(frontend)/layout.tsx` 时，临时打印其 params 与页面 params，GET `/de/routing-probe` 返回：

```html
<html ... lang="en" data-spike-parent-params="{}">
<pre id="routing-probe">{&quot;lang&quot;:&quot;de&quot;}</pre>
```

这是父布局看不到子动态段的实证。根布局移入 `[lang]`，使用 Promise params 后：

```tsx
export default async function RootLayout({ children, params }: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!publicLocales.some(({ code }) => code === lang)) notFound()
  // Existing site-settings read, Providers, Header, Footer remain here.
  return <html lang={lang}><body>{children}</body></html>
}

export function generateStaticParams() {
  return publicLocales.map(({ code: lang }) => ({ lang }))
}
```

保留已有布局代码 / metadata，仅改变位置和参数，既能按语言输出 html，也不需要调用 `headers()`。`(payload)` 保持独立根布局；XML / preview handler 不渲染 HTML，不需要网站根布局。跨语言根参数切换要预期完整文档导航并验证 Header 的客户端行为，不要依赖共享旧根布局只重绘子页面来更新 html lang。

### params 笛卡尔积有效，但 ready 过滤还需实现

fixture 配置：`en=source, de=live, fr=translating`。父 layout 返回 en/de，子探针在 `generateStaticParams({ params })` 中返回 `one/two`。build 输出：

```text
SPIKE child generateStaticParams en
SPIKE child generateStaticParams de
✓ Generating static pages using 9 workers (31/31)
/[lang]/routing-probe/[slug]
  ● /en/routing-probe/one
  ● /en/routing-probe/two
  ● /de/routing-probe/one
  ● /de/routing-probe/two
```

`.next/prerender-manifest.json` 确认这四条及 en/de 基础探针均存在。真实 Pages 的 `/en/routing-spike`、`/de/routing-spike` 和首页也生成成功；search 保持动态，case-studies 原来没有 SSG 的行为仍然是动态。没有为了证明静态生成而加 `force-static` 到原 Pages，`draftMode().isEnabled` 也保留。

生产实施时子生成器接收父 `params.lang`，英文输出已发布文档，其他语言输出 **ready 且仍公开的文档**；不是无条件复制所有英文参数。也可以由叶页面一次返回完整 `{ lang, category, product }`，但两种策略不应混用成重复组合。ISR 不会重新运行 generateStaticParams；保留文档级 dynamicParams 的运行时路径以支持发布后的新内容 / 草稿，live 语言未 ready 的直达 302 需要在数据消费层另做。不要在文档路由上为省事设置 `dynamicParams=false` 而挡住新发布和预览文档。

## 5. 特殊路由交互和生产 HTTP 证据

使用下列命令启动（全部在本工作树）：

```sh
DISABLE_R2_STORAGE=true NEXT_PUBLIC_SERVER_URL=http://localhost:3101 corepack pnpm build
DISABLE_R2_STORAGE=true NEXT_PUBLIC_SERVER_URL=http://localhost:3101 corepack pnpm start --port 3101 --hostname localhost
curl -sS -D - -o /dev/null http://localhost:3101/routing-spike
curl -sS -D - -o /dev/null 'http://localhost:3101/en/routing-spike?q=ok'
```

build / postbuild exit 0；TS 检查、31 页生成、四个 sitemap index 配置都完成。第一次 build 有未展开细节的编译 warning；最终重建显示 `Compiled successfully`。`next start` 对仓库现有 `output: 'standalone'` 打印建议使用 `.next/standalone/server.js` 的 warning，但本次生产服务器正常响应。此验证不是 Docker / standalone 包装验证；正式部署仍用仓库原有 standalone 启动方式。

临时 Node fetch 脚本以 `node /tmp/i18n-spike-check.mjs` 运行（两次均 exit 0），禁用自动跟随 redirect，记录 status / Location / rewrite / html lang / cache。生产验证输出摘要：

| 请求 | HTTP | 语言 / 关键结果 |
|---|---:|---|
| `/` | 200 | HTML en，rewrite `/en`，`x-nextjs-cache: HIT`，无 Location |
| `/routing-spike` | 200 | HTML en，rewrite `/en/routing-spike`，HIT，无 Location |
| `/de`、`/de/routing-spike` | 200 | HTML de，无 rewrite，HIT |
| `/search?q=spike` | 200 | HTML en，rewrite `/en/search?q=spike`，保留 query |
| `/de/search?q=spike` | 200 | HTML de；当前仍读原英文 search collection，未实现语言索引 |
| `/en/routing-spike?q=ok` | 301 | Location `/routing-spike?q=ok` |
| `/xx`、`/xx/routing-spike` | 404 | Proxy 拒绝，无 rewrite |
| `/fr`、`/fr/routing-spike` | 404 | translating fixture 拒绝 |
| `/de/de` | 200 | 体现保留 slug 校验尚不存在，见 §6 |
| 四个 `/{pages,posts,blogs,products}-sitemap.xml` | 200 | XML，均无 rewrite |
| `/sitemap.xml`、`/robots.txt` | 200 | postbuild 输出，均无 rewrite |
| 从首页解析出的 `/_next/static/...js` | 200 | 无 rewrite |
| `/admin`、`/admin/login` | 200 | Payload 根布局，HTML en，无 rewrite |
| `/api/users/me`、`/api/pages?limit=1` | 200 | JSON，无 rewrite |
| `/next/preview?previewSecret=wrong&path=/routing-spike` | 403 | 原认证入口仍生效，无 rewrite |
| `/next/exit-preview` | 200 | 原 handler，无 rewrite |
| `/de/api/users/me`、`/de/next/preview` | 404 | 不生成带语言前缀的基础设施入口 |

仅 wildcard 的原始 `/en` 301 返回 `Location: ''`，不能作为合格规范跳转；最终显式根规则的复测记录见 §9。

Sitemap handler 留在原 route group 不会与 `[lang]` 冲突：静态 XML 段优先，matcher 不改写它们。当前 sitemap 内容仍全是英文；添加 locale / ready URL 列表是后续 sitemap 数据逻辑工作。搜索 page 必须移；搜索客户端目前 `router.push('/search...')` 写死英文路径，德文页的后续搜索会掉回英文，必须同步改为 locale URL helper。

## 6. 未知语言、translating 与保留 slug

- Proxy 先查配置，再对 translating 返回真实 404；layout 也验证允许公开的语言，避免仅依赖入口过滤。配置 `en/source` 也属于公开语言，不能只筛 `status === 'live'`。
- Proxy fixture 用两字母（可带两字母地区）语法识别未知语言段，保证 `/xx/...` 不降级成英文页面。**这是明确的词法策略，不是 Next 自动提供的功能**；若将来允许 `zh-Hant`、三字母代码等，应使用配置匹配并扩展未知语言识别约定。
- 此语法也把所有两字母根 slug 视为保留（例如未配置的 `it`）。这比设计“仅配置中的 code 为保留 slug”更严格。生产前要统一 URL 语法与 Pages 服务端 validator；若坚持只保留已配置 code，就不能同时保证一个已有英文 Page `slug=xx` 的 `/xx` 永远 404。对多段未知前缀，也可让无匹配的路由自然 404，但不要做任意二次 fallback。
- `slug=de` 是已验证的冲突：Payload 当前接受并发布它；内部生成 `/en/de` 与 `/de/de`，但浏览器入口 `/de` 代表德文首页，显式 `/en/de` 又会规范为 `/de`。该英文 Page 的正常入口因此被占用。必须在 Pages 写入边界拦截配置中 **所有** code（含 en、translating），不能只做 Admin UI 提示。
- 上线前扫描既有 Pages 的保留 slug 冲突并报告人工处理，不能隐式改 slug 或删除文档。本次只在隔离库故意创建冲突，没有修改生产 / 主库内容。
- 本实验没有实现 translating→live 部署切换或每篇译文就绪检查。配置部署后需重新构建 / 更新静态参数；语言 live 不等于每篇文档 ready。

## 7. 缓存和草稿预览

### 缓存 key/tag 不能靠改路由自动获得语言隔离

当前 `getGlobals.ts` key `[slug, depth]`、tags `global_${slug}`；blogs/product 读取主要按文档 ID、slug、category key 缓存。`unstable_cache` 的 tags 用于失效，**不参与唯一 key**。翻译合并后的数据要同时加入 locale key 与 locale tag；原始英文源文档可按共享契约继续缓存，再合并目标译文。不要仅改变 tag 却共用 key。

安装文档建议 Next 16 使用 `use cache`，但现有未启用 Cache Components 的配置中 `unstable_cache` 仍工作；本次没有进行缓存 API 迁移。Proxy 内不能执行 tag/path 失效，失效应留在 Route Handler / Payload hook 所在服务器上下文。Cookie / headers 不应读进公共缓存函数。

静态探针使用：

```ts
const value = await unstable_cache(
  async () => randomUUID(),
  ['routing-spike', lang, slug],
  { tags: [`routing-spike:${lang}`] },
)()
```

探针同时输出另一个 render UUID，区分“data cache 没变”和“整页根本没重新渲染”。临时 `/next/spike-cache` handler 执行受控的 `revalidateTag(tag, { expire: 0 })` / `revalidatePath(path)`，仅在本地运行，已撤回。生产输出：

```text
CACHE baseline: repeatEqual=true; en.value != de.value
CACHE invalidate en tag: {"enChanged":true,"deUnchanged":true}
CACHE revalidatePath: {"sourceChanged":false,"destinationChanged":true}
```

先请求两个英文/德文静态页面，重复请求 stamp 相同；失效 `routing-spike:en` 后只变英文。路径对照使用另一静态页面：失效浏览器路径 `/routing-probe/two` 不改变 render UUID，失效内部目标 `/en/routing-probe/two` 会改变。

**现有 hook 必改**：Pages 当前 `revalidatePath('/')` / `revalidatePath('/slug')`，Blogs / BlogCategories / Products / Posts 等同样使用无前缀路径。迁移后要指向真实 `/en...` 路径（首页 `/en`），目标语言使用 `/<locale>...`，包括旧 slug、分类列表、分页与 search。保持 tags 失效的同时修正路径，不能依赖 broad tag 恰好掩盖路径失效错误。共享英文源变更和单语言译文写入的失效依赖也需按实际缓存层设计。

### 现有 preview 入口不移动

`generatePreviewPath.ts` 继续生成 `/next/preview?path=...`；handler 验证 secret / Payload 登录、调用 `draftMode().enable()` 后 redirect(path)。英文内容编辑默认使用无前缀 path，经 rewrite 到 en；所有 request cookies / headers 由 NextResponse.rewrite 正常保留。

本地 REST 登录后携带认证 Cookie 访问现有 preview handler，探针结果：

```text
PREVIEW {"status":307,"location":"/routing-probe/one",
 "bypassCookie":true,"enDraft":true,"deDraft":true,"uncached":true}
ALL PROBE ASSERTIONS PASSED
```

`__prerender_bypass` 可同时用于英文 rewrite 页和 `/de/...`；draft 分支两次返回不同 value；不带 Cookie 再访问为 draft=false。探针在 draft 时显式绕过公共 `unstable_cache`；实际 Blogs / Products 已有各自 draft 读取逻辑，应继续保留鉴权和缓存旁路，不把草稿合并结果塞进公开语言缓存。语言入口通过不意味着已实现译文草稿预览（设计本身只编辑英文）；本次也未跑浏览器里的 LivePreviewListener / Admin iframe 全流程。

## 8. 预估改动面

以下 **16 个页面入口**都应从 `src/app/(frontend)/` 相对移动到其 `[lang]/` 下：

```text
page.tsx
[slug]/page.tsx
blogs/page.tsx
blogs/[slug]/page.tsx
blogs/page/[pageNumber]/page.tsx
blogs/category/[categorySlug]/page.tsx
blogs/category/[categorySlug]/page/[pageNumber]/page.tsx
case-studies/[slug]/page.tsx
posts/page.tsx
posts/[slug]/page.tsx
posts/page/[pageNumber]/page.tsx
products/page.tsx
products/[category]/page.tsx
products/[category]/[product]/page.tsx
products/[category]/page/[pageNumber]/page.tsx
search/page.tsx
```

还需移动 / 同步：

- `layout.tsx`、`not-found.tsx`、`pages.module.css`。
- 邻近文件：`blogs/listing.tsx`、`blogs/listing.module.css`、`blogs/[slug]/page.module.css`；`products/page.module.css`、`products/[category]/listing.tsx`、`products/[category]/listing.module.css`、`products/[category]/[product]/page.module.css`。合计 **26 个现有文件**路径发生变化，`globals.css` 可不移动。
- 新增 `src/proxy.ts`、`src/i18n/config.ts`；更新 `redirects.ts`，无需 Page/Collection 内容结构迁移。
- 16 个入口涉及的 params 类型、metadata、SSG / ready 过滤、数据读取 locale；Header / Footer 读取的稳定 presentation model 需接受 locale。
- 共用 URL helper / `getContentPath`、内部 Link、breadcrumb、分类/分页、搜索 push、canonical / hreflang、PayloadRedirects 规则目标、live preview path。现有 CMS redirects 在英文路径空间匹配后恢复目标语言，外链保持原样；原型没有改完这部分。
- 四个 sitemap handler 改数据输出与 cache 依赖，**不移动文件**；预览两 handler 和所有 Payload route **不移动**。
- 调整现有缓存读取函数和各集合 / Global 的 revalidation hook（尤其 rewrite 目标路径）。
- 至少 11 个 `tests/int` 文件直接引用旧页面、布局或样式路径：blog-detail、blog-routes、blog-search-results、frontend-module-visual-roles、frontend-style-architecture、layout-primitives、products-mobile-cards、products-pages、quote-request-presentation、search-query、website-shell；路径和新行为断言需更新。新增真实 locale/ready/保留 slug/redirect/cache/preview 覆盖，现有英文 E2E 应保留。

总体是 **中等规模路由迁移 + 横跨数据消费层的多语言适配**，不是只加一个 proxy 文件。具体翻译插件实现不属于本 spike。

## 9. 验证限制与交付检查

- 全量 `corepack pnpm exec tsc --noEmit --incremental false` 初次失败：临时 seed 缺 `hero.headerTheme`，以及起点 `website-shell.int.spec.tsx` 的四处 `<Providers>` 缺必需 `gtmDisabled`。前者修正 fixture；后者仅临时加 `gtmDisabled={false}` 解锁 spike build，报告提交前撤回。这四处是既有分支类型问题，不是路由迁移产生的错误。
- 临时修正后 tsc exit 0，build / postbuild exit 0。撤回全部临时改动后，再运行同一 tsc 命令，exit 2，仅剩 `website-shell.int.spec.tsx:74/124/135/143` 四处缺 `gtmDisabled` 的 TS2741；没有路由原型残留错误。不能据此声称未经修改的起点分支通过全量 tsc。
- 没有跑整个 integration / Playwright suite、真实翻译服务、真实产品 / 博客 readiness 矩阵或生产反向代理；不属于此可行性原型的验证范围。没有触碰端口 3000 的其他代理测试。
- 最终重定向规则、最终重建与报告单文件提交检查见最终复核记录。

### 最终复核记录

最终规则重建 exit 0（编译 11.2s，TypeScript 8.7s，31/31 静态页；postbuild 成功）。同一生产 HTTP / cache / preview 脚本再次 exit 0，新增断言结果：

```text
{"path":"/en","status":301,"location":"/","rewrite":null}
{"path":"/en/routing-spike?q=ok","status":301,"location":"/routing-spike?q=ok","rewrite":null}
CACHE invalidate en tag {"enChanged":true,"deUnchanged":true}
CACHE revalidatePath {"sourceChanged":false,"destinationChanged":true}
PREVIEW {"status":307,"location":"/routing-probe/one","bypassCookie":true,"enDraft":true,"deDraft":true,"uncached":true}
ALL PROBE ASSERTIONS PASSED
```

原型关键配置和实现摘录已保留在本报告；临时源码、fixture seed、测试路径改动和 `gtmDisabled` 辅助改动均不进入提交。依赖不变，生成的 Payload types / import map 无差异。测试服务器已停止；隔离数据库保留上述 fixture，未做数据库删除。未运行任何生产数据操作。
