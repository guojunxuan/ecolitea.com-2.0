import type { PayloadRequest } from 'payload'
import { getTranslationStatus } from '@/plugins/translation/admin/getTranslationStatus'

type LanguageCount = { status: string; total: number; ready: number; failed: number; waiting: number }

/** Enabled languages are the ones being translated or live; "off" languages are not part of the ring. */
export function summarizeTranslations(counts: readonly LanguageCount[]) {
  const enabled = counts.filter(({ status }) => status === 'translating' || status === 'live')
  if (!enabled.length) return null

  const failed = enabled.filter((row) => row.failed > 0).length
  const synced = enabled.filter((row) => row.failed === 0 && row.waiting === 0 && row.ready === row.total).length
  return {
    enabled: enabled.length,
    synced,
    inProgress: enabled.length - synced - failed,
    failed,
    percent: Math.round((synced / enabled.length) * 100),
  }
}

export type TranslationSummary =
  | { status: 'hidden' | 'empty' | 'unavailable' }
  | ({ status: 'ready' } & NonNullable<ReturnType<typeof summarizeTranslations>>)

export async function getTranslationSummary(req: PayloadRequest): Promise<TranslationSummary> {
  // Translation inventory reads bypass access control; the role check is the gate.
  if (req.user?.role !== 'admin') return { status: 'hidden' }
  if (!req.payload.collections.translations) return { status: 'empty' }

  try {
    const { counts } = await getTranslationStatus(req.payload, req)
    const summary = summarizeTranslations(counts)
    return summary ? { status: 'ready', ...summary } : { status: 'empty' }
  } catch {
    return { status: 'unavailable' }
  }
}
