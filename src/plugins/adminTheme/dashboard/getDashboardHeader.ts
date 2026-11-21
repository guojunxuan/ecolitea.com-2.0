import type { PayloadRequest, SanitizedPermissions } from 'payload'
import { getQuickActions } from './getQuickActions'

function zoned(now: Date, timeZone: string) {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone }
  return {
    date: new Intl.DateTimeFormat('en-GB', options).format(now),
    // en-CA formats as YYYY-MM-DD, which is what <time dateTime> expects.
    dateTime: new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(now),
  }
}

async function siteName(req: PayloadRequest) {
  try {
    const { siteName } = await req.payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: false,
      select: { siteName: true },
      req,
    })
    return siteName?.trim() || undefined
  } catch {
    return undefined
  }
}

/** Presentation model for the dashboard title row. The date uses the Admin default timezone, else UTC. */
export async function getDashboardHeader(req: PayloadRequest, permissions: SanitizedPermissions, now = new Date()) {
  const configured = req.payload.config.admin?.timezones?.defaultTimezone
  let day
  try {
    day = zoned(now, configured || 'UTC')
  } catch {
    day = zoned(now, 'UTC')
  }
  const name = await siteName(req)
  const action = getQuickActions(req, permissions)[0]

  return { ...(name && { siteName: name }), ...day, ...(action && { action }) }
}
