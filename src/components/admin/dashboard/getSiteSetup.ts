import type { PayloadRequest } from 'payload'

export async function getSiteSetup(req: PayloadRequest) {
  if (req.user?.role !== 'admin') return 'hidden'

  try {
    const { siteName, logo } = await req.payload.findGlobal({
      slug: 'site-settings',
      req,
      overrideAccess: false,
      depth: 0,
      select: { siteName: true, logo: true },
    })
    return siteName?.trim() && logo ? 'complete' : 'incomplete'
  } catch {
    return 'unavailable'
  }
}
