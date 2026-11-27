import type { Payload, PayloadRequest } from 'payload'

// The deployment has one designated worker. Serialize even separately-created quota
// clients within it; this is not a distributed lock for multiple worker processes.
const reservations = new WeakMap<Payload, Promise<unknown>>()

export function createQuota(
  payload: Payload,
  limit: number,
  now = () => new Date(),
  req?: PayloadRequest,
) {
  return {
    reserve(characters: number): Promise<boolean> {
      if (!Number.isSafeInteger(characters) || characters < 0) {
        return Promise.reject(new Error('Quota characters must be a non-negative safe integer'))
      }
      const pending = (reservations.get(payload) ?? Promise.resolve())
        .catch(() => undefined)
        .then(async () => {
          const month = now().toISOString().slice(0, 7)
          const usage = await payload.findGlobal({
            slug: 'translation-usage',
            depth: 0,
            overrideAccess: true,
            req,
          })
          const used = usage.month === month ? (usage.characters ?? 0) : 0
          if (characters > limit - used) return false
          await payload.updateGlobal({
            slug: 'translation-usage',
            data: { month, characters: used + characters },
            overrideAccess: true,
            req,
          })
          return true
        })
      reservations.set(payload, pending)
      return pending
    },
  }
}
