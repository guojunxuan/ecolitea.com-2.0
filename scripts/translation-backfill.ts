import { pathToFileURL } from 'node:url'
import type { Payload } from 'payload'
import { getTranslationInventory } from '../src/plugins/translation/inventory'
import type { LocaleConfig } from '../src/i18n/config'
import { getI18nSettings } from '../src/i18n/getI18nSettings'
import type { TranslationInput, TranslationRuntime } from '../src/plugins/translation/task'

type BackfillArguments = { locale: string; dryRun: boolean; confirmNonTest?: string }
export type BackfillReport = {
  locale: string
  mode: 'dry-run' | 'execute'
  counts: Record<string, number>
  total: number
  estimatedCharacters: number
  queued: number
}

export function parseBackfillArguments(argv: string[]): BackfillArguments {
  let locale = ''
  let dryRun = false
  let confirmed = false
  let confirmNonTest: string | undefined
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--' && index === 0) continue
    if (argument === '--dry-run') dryRun = true
    else if (argument === '--confirm') confirmed = true
    else if (argument.startsWith('--confirm-non-test=')) {
      if (confirmNonTest !== undefined) throw new Error('Duplicate --confirm-non-test.')
      confirmNonTest = argument.slice('--confirm-non-test='.length)
    } else if (argument === '--locale' || argument.startsWith('--locale=')) {
      if (locale) throw new Error('Duplicate --locale.')
      locale = argument === '--locale' ? (argv[++index] ?? '') : argument.slice('--locale='.length)
      if (!locale || locale.startsWith('--')) throw new Error('An explicit --locale is required.')
    } else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!locale) throw new Error('An explicit --locale is required.')
  if (!confirmed)
    throw new Error('Review the printed target and pass --confirm (including --dry-run).')
  return { locale, dryRun, confirmNonTest }
}

export function inspectBackfillTarget(databaseURI: string, confirmNonTest?: string) {
  const target = new URL(databaseURI)
  if (!['mongodb:', 'mongodb+srv:'].includes(target.protocol) || !target.pathname.slice(1))
    throw new Error('DATABASE_URI must name a MongoDB database.')
  const name = decodeURIComponent(target.pathname.slice(1))
  if (name === 'ecolitea2') throw new Error('Refusing the developer database ecolitea2.')
  const test = /(?:^|[-_])(?:test|int|e2e|ci)(?:$|[-_])/.test(name)
  if (!test && confirmNonTest !== name)
    throw new Error(
      `Non-test databases also require --confirm-non-test=${name} after reviewing the target.`,
    )
  return { database: `${target.host}${target.pathname}`, test }
}

function assertTargetLocale(locale: string, locales: readonly LocaleConfig[]) {
  if (
    !locales.some(
      (value) =>
        value.code === locale && (value.status === 'translating' || value.status === 'live'),
    )
  )
    throw new Error('--locale must be a configured translating or live language.')
}

/** Queue only plugin-owned records and Jobs. English sources are never saved. */
export async function runTranslationBackfill({
  payload,
  locale,
  dryRun = false,
  locales,
  now = new Date(),
}: {
  payload: Payload
  locale: string
  dryRun?: boolean
  locales?: readonly LocaleConfig[]
  now?: Date
}): Promise<BackfillReport> {
  assertTargetLocale(locale, locales ?? (await getI18nSettings(payload)).targetLocales)
  const { createPayloadRequest } = await import('payload')
  const { getTranslationRuntime } = await import('../src/plugins/translation/hooks')
  const req = await createPayloadRequest({ payload })
  const runtime = getTranslationRuntime(req)
  if (
    !dryRun &&
    (!runtime ||
      !(await runtime.canQueue(req)) ||
      !(await runtime.getTargets(req)).includes(locale))
  )
    throw new Error(
      'Translation queueing is disabled; configure the target locale and provider first.',
    )
  const report: BackfillReport = {
    locale,
    mode: dryRun ? 'dry-run' : 'execute',
    counts: {},
    total: 0,
    estimatedCharacters: 0,
    queued: 0,
  }
  const add = async (input: TranslationInput, characters: number) => {
    report.counts[input.sourceCollection] = (report.counts[input.sourceCollection] ?? 0) + 1
    report.total++
    report.estimatedCharacters += characters
    if (!dryRun) {
      if (await (runtime as TranslationRuntime).queue(req, input, { backfill: true }))
        report.queued++
    }
  }
  for (const { input, characters } of await getTranslationInventory(payload, req, now, locale))
    await add(input, characters)
  return report
}

async function main() {
  await import('dotenv/config')
  const argv = process.argv.slice(2)
  const databaseURI = process.env.DATABASE_URI ?? ''
  const target = new URL(databaseURI)
  const localeIndex = argv.indexOf('--locale')
  const locale =
    argv.find((value) => value.startsWith('--locale='))?.slice('--locale='.length) ??
    argv[localeIndex + 1]
  // Do not print credentials or URI options, and do not initialize Payload before confirmation.
  process.stderr.write(
    `Translation backfill target: database=${target.host}${target.pathname}; locale=${localeIndex < 0 && !argv.some((value) => value.startsWith('--locale=')) ? 'missing' : locale}; storage=${process.env.DISABLE_R2_STORAGE === 'true' ? 'local (R2 disabled)' : `R2 bucket=${process.env.R2_BUCKET ?? 'unconfigured'}`}; mode=${argv.includes('--dry-run') ? 'dry-run' : 'execute'}\n`,
  )
  const args = parseBackfillArguments(argv)
  inspectBackfillTarget(databaseURI, args.confirmNonTest)
  // This producer never starts a worker or dictionary bootstrap during inventory/dry-run.
  process.env.JOBS_AUTORUN = 'false'
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  const payload = await getPayload({ config })
  try {
    const report = await runTranslationBackfill({
      payload,
      locale: args.locale,
      dryRun: args.dryRun,
    })
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } finally {
    await payload.destroy()
  }
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
