import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveProductRedirect } from '@/utilities/products/resolveRedirect'

// Navigation helpers emit 307/308. Proxy owns the actual product HTTP 301 response.
// Keep these lookups uncached so publication changes and renames apply immediately.
export async function proxy(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'redirects',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    where: { and: [{ from: { equals: request.nextUrl.pathname } }, { type: { equals: '301' } }] },
  })
  const reference = docs[0]?.to?.reference
  if (reference && (!docs[0].to?.type || docs[0].to.type === 'reference')) {
    const path = await resolveProductRedirect(payload, reference)
    if (path && path !== request.nextUrl.pathname) {
      return new Response(null, {
        status: 301,
        headers: { Location: new URL(path, request.url).href, 'Cache-Control': 'no-store' },
      })
    }
  }
  return NextResponse.next()
}

export const config = { matcher: '/products/:path*' }
