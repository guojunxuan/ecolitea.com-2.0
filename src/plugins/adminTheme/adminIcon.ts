import type { Endpoint } from 'payload'

import { resolveFavicon } from '@/components/Logo/resolveFavicon'

export const adminIconEndpoint: Endpoint = {
  method: 'get',
  path: '/admin-icon',
  handler: async (req) => {
    const { favicon } = await req.payload.findGlobal({
      slug: 'site-settings',
      depth: 1,
      overrideAccess: false,
      select: { favicon: true },
      req,
    })

    return new Response(null, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store',
        Location: resolveFavicon(favicon)?.url ?? '/favicon.svg',
      },
    })
  },
}
