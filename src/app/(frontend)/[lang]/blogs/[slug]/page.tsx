import { localizeMetadata, readySourceIDs } from '@/utilities/i18n/seo'
import { fallbackToEnglish } from '@/utilities/i18n/pageAccess'
import { blogRichTextBlocks } from '@/collections/Blogs/blocks/richTextBlocks'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { RelatedBlogs } from '@/blocks/RelatedBlogs/Component'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import RichText from '@/components/RichText'
import { ArticleShare } from '@/components/ArticleShare'
import { adaptArticleShare } from '@/utilities/blogs/articleShare'
import { getCachedSettings } from '@/utilities/getGlobals'
import { getServerSideURL } from '@/utilities/getURL'
import { TableOfContents } from '@/components/TableOfContents'
import { SkipLink } from '@/components/SkipLink'
import { BlogHero } from '@/heros/BlogHero'
import { getBlogBySlug } from '@/utilities/blogs/getBlogBySlug'
import { getRelatedBlogs } from '@/utilities/blogs/getRelatedBlogs'
import { extractTOC } from '@/utilities/blogs/extractTOC'
import { publicBlogVisibility } from '@/utilities/blogs/publicVisibility'
import { generateMeta } from '@/utilities/generateMeta'
import styles from './page.module.css'

type Args = { params: Promise<{ lang: string; slug: string }> }

// Unknown slugs remain available at runtime through Next's default dynamicParams behavior.
export async function generateStaticParams(options: { params: { lang: string } }) {
  const locale = options?.params.lang ?? 'en'
  const payload = await getPayload({ config: configPromise })
  const slugs: { slug: string }[] = []
  let page = 1
  let hasNextPage = true
  while (hasNextPage) {
    const result = await payload.find({
      collection: 'blogs',
      depth: 0,
      draft: false,
      limit: 100,
      page,
      overrideAccess: false,
      select: { slug: true },
      where: publicBlogVisibility(new Date()),
    })
    const ready = await readySourceIDs(
      payload,
      'blogs',
      result.docs.map((doc) => String(doc.id)),
      locale,
    )
    slugs.push(
      ...result.docs
        .filter((blog) => Boolean(blog.slug) && ready.has(String(blog.id)))
        .map(({ slug }) => ({ slug })),
    )
    hasNextPage = result.hasNextPage
    page += 1
  }
  return slugs
}

export default async function BlogPage({ params }: Args) {
  const { slug, lang = 'en' } = await params
  const decodedSlug = decodeURIComponent(slug)
  const url = `/blogs/${decodedSlug}`
  const { isEnabled: draft } = await draftMode()
  const blog = await getBlogBySlug(decodedSlug, draft, lang)
  await fallbackToEnglish(blog, lang, url, () => getBlogBySlug(decodedSlug, false))
  if (!blog) return <PayloadRedirects locale={lang} url={url} />

  const payload = await getPayload({ config: configPromise })
  const related = await getRelatedBlogs(blog, payload, new Date(), lang)
  const toc = extractTOC(blog.content)
  const canonicalURL = new URL(
    `/blogs/${encodeURIComponent(blog.slug)}`,
    getServerSideURL(),
  ).toString()
  const share = adaptArticleShare(await getCachedSettings(lang), canonicalURL, blog.title)
  const hasShare = share.links.length > 0 || share.copyLink

  return (
    <article className={styles.article}>
      {toc.length > 0 && <SkipLink href="#table-of-contents">Skip to table of contents</SkipLink>}
      <PayloadRedirects locale={lang} disableNotFound url={url} />
      {draft && <LivePreviewListener />}
      <BlogHero blog={blog} />
      <div className={styles.body} data-slot="blog-article-body">
        <TableOfContents
          items={toc}
          sidebar={hasShare ? <ArticleShare model={share} url={canonicalURL} /> : undefined}
        >
          <div className={styles.content} data-slot="blog-article-content">
            <RichText
              blocks={blogRichTextBlocks}
              context="article"
              data={blog.content}
              enableGutter={false}
              headingIds={toc.map((item) => item.id)}
            />
            {hasShare && (
              <div className={styles.mobileShare}>
                <ArticleShare model={share} url={canonicalURL} title="Share this article" />
              </div>
            )}
          </div>
        </TableOfContents>
      </div>
      <RelatedBlogs blogs={related} />
    </article>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug, lang = 'en' } = await params
  const decodedSlug = decodeURIComponent(slug)
  const { isEnabled: draft } = await draftMode()
  const blog = await getBlogBySlug(decodedSlug, draft, lang)
  if (!blog) return { robots: { index: false, follow: false } }
  const generated = await generateMeta({
    doc: blog,
    locale: lang,
    sourceCollection: 'blogs',
    path: `/blogs/${blog.slug}`,
    draft,
  })
  const canonical = `/blogs/${blog.slug}`
  return localizeMetadata(
    {
      ...generated,
      title: blog.meta?.title ?? blog.title,
      description: blog.meta?.description ?? blog.excerpt,
      alternates: { canonical },
      openGraph: {
        ...generated.openGraph,
        title: blog.meta?.title ?? blog.title,
        description: blog.meta?.description ?? blog.excerpt,
        url: canonical,
      },
      ...(draft ? { robots: { index: false, follow: false } } : {}),
    },
    { path: canonical, locale: lang, sourceCollection: 'blogs', sourceId: blog.id, draft },
  )
}
