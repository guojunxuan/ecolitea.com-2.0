import type { PayloadRequest } from 'payload'
import { getI18nSettings } from '@/i18n/getI18nSettings'
import { getEmailConfiguration } from '@/plugins/email/config'
import { getTranslationStatus } from '@/plugins/translation/admin/getTranslationStatus'
import { serverEnv } from '@/utilities/env'

const notConfigured = 'Not configured'
const emailSources = { env: 'Environment variables', settings: 'Site Settings' } as const

async function emailStatus(req: PayloadRequest) {
  const { source, status } = await getEmailConfiguration(req.payload, req)
  if (source === 'none') return notConfigured

  const label = status === 'configured' ? 'Configured' : 'Needs attention'
  return `${label} · ${emailSources[source]}`
}

async function translationStatus(req: PayloadRequest) {
  const { payload } = req
  if (!payload.collections.translations) return notConfigured
  const { targetLocales } = await getI18nSettings(payload, req)
  if (!targetLocales.length) return notConfigured

  const { counts } = await getTranslationStatus(payload, req)
  const enabled = counts.filter(({ status }) => status === 'translating' || status === 'live')
  if (!enabled.length) return notConfigured

  const { totalDocs } = await payload.count({
    collection: 'translations',
    req,
    overrideAccess: false,
    where: { status: { equals: 'pending' }, locale: { in: enabled.map(({ code }) => code) } },
  })
  const failed = enabled.reduce((sum, row) => sum + row.failed, 0)
  return `${totalDocs} in progress · ${failed} failed`
}

async function scheduleStatus(req: PayloadRequest) {
  const { payload } = req
  if (!payload.collections['payload-jobs'] ||
      !payload.config.jobs.tasks?.some(({ slug }) => slug === 'schedulePublish')) return notConfigured

  const { docs } = await payload.find({
    collection: 'payload-jobs',
    depth: 0,
    limit: 1,
    sort: 'waitUntil',
    req,
    // Jobs are internal. The role check in getSystemStatus gates this read.
    overrideAccess: true,
    select: { waitUntil: true },
    where: {
      taskSlug: { equals: 'schedulePublish' },
      completedAt: { exists: false },
      processingUntil: { exists: false },
      hasError: { not_equals: true },
      waitUntil: { exists: true },
    },
  })
  return docs[0]?.waitUntil ? { next: docs[0].waitUntil } : 'No scheduled publications'
}

export async function getSystemStatus(req: PayloadRequest) {
  if (req.user?.role !== 'admin') return null

  const [email, translation, schedule] = await Promise.all([
    emailStatus(req).catch(() => notConfigured),
    translationStatus(req).catch(() => notConfigured),
    scheduleStatus(req).catch(() => notConfigured),
  ])
  const storage = process.env.DISABLE_R2_STORAGE === 'true'
    ? 'Local storage'
    : serverEnv.R2_BUCKET && serverEnv.R2_ENDPOINT && serverEnv.R2_ACCESS_KEY_ID && serverEnv.R2_SECRET_ACCESS_KEY
      ? 'Object storage configured'
      : notConfigured

  return { email, translation, storage, schedule }
}
