import type { Endpoint } from 'payload'
import type { EmailDeliveryResult } from './adapter'

/** Rate limit is per application worker. No submitted recipient or message is accepted. */
export function createTestEmailEndpoint({ now = Date.now }: { now?: () => number } = {}): Endpoint {
  const attempts = new Map<string, number>()
  const interval = 30000
  return {
    path: '/email-test',
    method: 'post',
    handler: async (req) => {
      if (req.user?.role !== 'admin') {
        return Response.json({ error: 'Administrator access required.' }, { status: 403 })
      }
      const email = req.user.email
      if (!email || /[\r\n]/.test(email)) {
        return Response.json(
          { error: 'Your account needs a valid email address.' },
          { status: 400 },
        )
      }
      const time = now()
      for (const [id, expiry] of attempts) if (expiry <= time) attempts.delete(id)
      const id = String(req.user.id)
      const nextAttempt = attempts.get(id)
      if (nextAttempt !== undefined && nextAttempt > time) {
        return Response.json(
          { error: 'Wait 30 seconds before sending another test email.' },
          {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil((nextAttempt - time) / 1000)) },
          },
        )
      }
      attempts.set(id, time + interval)
      try {
        const result = (await req.payload.sendEmail({
          to: email,
          subject: 'Website email configuration test',
          text: 'This test email confirms that the website can send email using the saved configuration.',
        })) as EmailDeliveryResult | undefined
        if (result?.status !== 'sent') {
          return Response.json(
            {
              status: result?.status ?? 'failed',
              error: result?.error ?? 'Email delivery failed.',
            },
            { status: 503 },
          )
        }
        return Response.json({
          status: 'sent',
          message: 'Test email sent to your account email address.',
        })
      } catch {
        return Response.json({ status: 'failed', error: 'Email delivery failed.' }, { status: 503 })
      }
    },
  }
}
