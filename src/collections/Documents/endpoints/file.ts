import type { Endpoint, PayloadRequest } from 'payload'
import { serverEnv } from '@/utilities/env'
import { getServerSideURL } from '@/utilities/getURL'

const headers = { 'Cache-Control': 'private, no-store' }
const failure = (status: number, error: string) => Response.json({ error }, { status, headers })

/** Decode individual segments so encoded separators cannot escape a trusted path boundary. */
function pathSegments(url: URL): string[] | undefined {
  try {
    const segments = url.pathname.split('/').map(decodeURIComponent)
    if (segments.some((segment) => segment === '.' || segment === '..' || /[\\/\0]/.test(segment)))
      return undefined
    return segments
  } catch {
    return undefined
  }
}

function trustedSource(source: unknown, req: PayloadRequest): string | undefined {
  if (typeof source !== 'string' || !source || source.trim() !== source) return
  try {
    const site = new URL(req.payload.config.serverURL || getServerSideURL())
    const url = new URL(source, site)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
      return
    const segments = pathSegments(url)
    if (!segments) return
    if (url.origin === site.origin) {
      if (process.env.DISABLE_R2_STORAGE !== 'true') return
      const prefix = `${req.payload.config.routes.api.replace(/\/$/, '')}/documents/file/`
      if (
        !url.pathname.startsWith(prefix) ||
        !url.pathname.slice(prefix.length) ||
        url.pathname.slice(prefix.length).includes('/') ||
        url.search
      )
        return
      // Same-site reads only use Payload's native route, never this proxy endpoint.
      return url.href
    }
    const publicBase = new URL(process.env.R2_PUBLIC_URL ?? serverEnv.R2_PUBLIC_URL)
    const baseSegments = pathSegments(publicBase)
    const basePath = baseSegments?.slice(1).join('/').replace(/\/+$/, '')
    const filePath = segments.slice(1).join('/')
    if (
      /^https?:\/\//.test(source) &&
      !publicBase.username &&
      !publicBase.password &&
      basePath !== undefined &&
      url.origin === publicBase.origin &&
      (!basePath || filePath.startsWith(`${basePath}/`))
    )
      return url.href
  } catch {
    return
  }
}

export const documentFileEndpoint: Endpoint = {
  path: '/:id/file',
  method: 'get',
  handler: async (req) => {
    if (!req.user) return failure(401, 'Unauthorized')
    if (req.headers.get('Sec-Fetch-Dest') === 'image') return failure(404, 'Not found')
    const id = req.routeParams?.id
    if ((typeof id !== 'string' && typeof id !== 'number') || !String(id))
      return failure(400, 'Document ID is required.')
    const doc = await req.payload.findByID({ collection: 'documents', id, depth: 0, req })
    const source = trustedSource(doc.url, req)
    if (!source) return failure(403, 'Document file source is not allowed.')
    try {
      const upstream = await fetch(source, { redirect: 'manual', cache: 'no-store' })
      if (upstream.status !== 200) {
        await upstream.body?.cancel()
        return failure(502, 'Unable to retrieve the document file.')
      }
      return new Response(upstream.body, {
        headers: {
          ...headers,
          'Content-Type': doc.mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.filename || 'document').replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`,
        },
      })
    } catch {
      return failure(502, 'Unable to retrieve the document file.')
    }
  },
}
