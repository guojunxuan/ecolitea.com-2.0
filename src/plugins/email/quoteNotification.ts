import type { CollectionAfterChangeHook } from 'payload'

import type { QuoteRequest, SiteSettings } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

const escapeHTML = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })

// Keep the deadline around the entire notification, including settings lookup.
// It also protects callers if a replacement email adapter does not enforce timeouts.
export const sendQuoteNotification: CollectionAfterChangeHook<QuoteRequest> = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  let expired = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let phase = 'settings_lookup_failed'
  let recipients: string[] = []
  const subject =
    `New quote request: ${doc.productTitle || doc.productSlug || 'General enquiry'} — ${doc.company}`.replace(
      /[\r\n]/g,
      '',
    )
  const warn = (reason: string) => {
    // Logging must never make an already-saved business document fail.
    try {
      req.payload.logger.warn({
        msg: 'Quote notification was not sent.',
        reason,
        subject,
        recipientCount: recipients.length,
        recipientDomains: [...new Set(recipients.map((email) => email.split('@').at(-1)))],
      })
    } catch {
      // A failing logger must not propagate from this best-effort side effect.
    }
  }

  try {
    await Promise.race([
      (async () => {
        const settings: SiteSettings = await req.payload.findGlobal({
          slug: 'site-settings',
          depth: 0,
          overrideAccess: true,
          req,
        })
        if (expired || settings.quoteNotificationsEnabled === false) return

        recipients = (settings.quoteNotificationRecipients ?? [])
          .map(({ email }) => email.trim())
          .filter(Boolean)
        if (!recipients.length && settings.salesEmail?.trim()) {
          recipients = [settings.salesEmail.trim()]
        }
        recipients = [...new Set(recipients)]
        if (!recipients.length) {
          warn('missing_recipient')
          return
        }

        phase = 'delivery_failed'
        const adminRoute = req.payload.config.routes.admin.replace(/\/$/, '')
        const origin = (req.payload.config.serverURL || getServerSideURL()).replace(/\/$/, '')
        const adminURL = `${origin}${adminRoute}/collections/quote-requests/${encodeURIComponent(doc.id)}`
        const details = [
          ['Product', doc.productTitle || 'General enquiry'],
          ['Product slug', doc.productSlug || ''],
          ['Name', doc.name],
          ['Email', doc.email],
          ['Company', doc.company],
          ['Message', doc.message],
        ]
        const result: unknown = await req.payload.sendEmail({
          to: recipients,
          replyTo: doc.email,
          subject,
          text: [
            ...details.map(([label, value]) => `${label}: ${value}`),
            `Admin: ${adminURL}`,
          ].join('\n\n'),
          html: `<h1>New quote request</h1>${details
            .map(
              ([label, value]) =>
                `<p><strong>${label}:</strong> ${escapeHTML(value).replace(/\r?\n/g, '<br>')}</p>`,
            )
            .join('')}<p><a href="${escapeHTML(adminURL)}">View quote request in Admin</a></p>`,
        })
        if (
          !expired &&
          result &&
          typeof result === 'object' &&
          'status' in result &&
          result.status === 'failed'
        ) {
          warn('delivery_failed')
        }
      })(),
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          expired = true
          warn('timeout')
          resolve()
        }, 10_000)
      }),
    ])
  } catch {
    if (!expired) warn(phase)
  } finally {
    clearTimeout(timer)
  }

  return doc
}
