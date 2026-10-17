import type { Endpoint } from 'payload'

import { buildCloudflareImageURL } from '@/components/Media/cloudflare'
import { serverEnv } from '@/utilities/env'

const privateHeaders = { 'Cache-Control': 'private, no-store' }
const failure = (status: number) =>
  Response.json(
    { error: status === 401 ? 'Unauthorized' : 'File unavailable.' },
    { status, headers: privateHeaders },
  )

// Trust the configured public origin and its complete base path, never a string
// prefix. Reject credentials, encoded separators, and traversal before fetching.
const trustedSource = (source: string, serverURL: string, apiRoute: string): URL | undefined => {
  try {
    const local = process.env.DISABLE_R2_STORAGE === 'true'
    const base = new URL(local ? serverURL : process.env.R2_PUBLIC_URL || serverEnv.R2_PUBLIC_URL)
    const url = new URL(source, local ? base : undefined)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.origin !== base.origin
    )
      return
    const path = local ? `${apiRoute}/media/file/` : `${base.pathname.replace(/\/+$/, '')}/`
    const decodedPath = decodeURIComponent(url.pathname)
    if (
      /%(?:2f|5c|2e)/i.test(url.pathname) ||
      decodedPath.includes('\\') ||
      !url.pathname.startsWith(path) ||
      url.pathname.length <= path.length
    )
      return
    return url
  } catch {
    return undefined
  }
}

export const mediaFileEndpoint: Endpoint = {
  path: '/:id/file',
  method: 'get',
  handler: async (req) => {
    if (!req.user) return failure(401)
    const id = req.routeParams?.id
    if ((typeof id !== 'string' && typeof id !== 'number') || !String(id)) return failure(404)
    let doc
    try {
      doc = await req.payload.findByID({
        collection: 'media',
        id,
        depth: 0,
        req,
        overrideAccess: false,
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404)
        return failure(404)
      throw error
    }
    if (!doc?.url) return failure(404)
    const source = trustedSource(
      doc.url,
      req.payload.config.serverURL || serverEnv.NEXT_PUBLIC_SERVER_URL,
      req.payload.config.routes.api,
    )
    if (!source) return failure(502)
    if (req.headers.get('Sec-Fetch-Dest') === 'image') {
      if (!doc.mimeType?.startsWith('image/')) return failure(404)
      return new Response(null, {
        status: 302,
        headers: {
          Location:
            process.env.DISABLE_R2_STORAGE === 'true'
              ? source.href
              : buildCloudflareImageURL({
                  source: source.href,
                  width: 1200,
                  presentation: { fit: 'scale-down' },
                }),
          'Cache-Control': 'private, max-age=300',
        },
      })
    }
    try {
      // Redirects are rejected altogether, so a trusted object cannot redirect
      // this authenticated proxy to a private or unrelated host.
      const upstream = await fetch(source.href, { redirect: 'manual' })
      if (upstream.status !== 200) {
        await upstream.body?.cancel()
        return failure(502)
      }
      const filename = encodeURIComponent(doc.filename || 'media').replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      )
      return new Response(upstream.body, {
        headers: {
          ...privateHeaders,
          'Content-Type': doc.mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename*=UTF-8''${filename}`,
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {
      return failure(502)
    }
  },
}
