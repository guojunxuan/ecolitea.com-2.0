import { localeCatalog, type LocaleConfig, type RegionConfig } from './catalog'

type Language = { code?: string | null; status?: string | null }
type Region = {
  id?: string | null
  label?: string | null
  group?: string | null
  locale?: string | null
}
export type I18nInput = { languages?: Language[] | null; regions?: Region[] | null }
export type I18nSettings = {
  configuredLocales?: LocaleConfig[]
  publicLocales: LocaleConfig[]
  targetLocales: LocaleConfig[]
  regions: RegionConfig[]
}
export function validateLanguages(value: Language[] | null | undefined): true | string {
  const seen = new Set<string>()
  for (const row of value ?? []) {
    if (!row.code || row.code === 'en' || !localeCatalog.some(({ code }) => code === row.code))
      return 'Select a target language from the catalog.'
    if (seen.has(row.code)) return 'Each language may be configured only once.'
    seen.add(row.code)
  }
  return true
}
export function validateRegions(
  value: Region[] | null | undefined,
  languages: Language[] | null | undefined,
): true | string {
  if (!value?.length) return true
  if (!value.some(({ locale }) => locale === 'en')) return 'Keep at least one English region.'
  if (
    value.some(
      ({ locale }) =>
        locale !== 'en' &&
        !languages?.some(
          (language) =>
            language.code === locale && ['translating', 'live'].includes(language.status ?? ''),
        ),
    )
  )
    return 'Regions must use English or an enabled target language.'
  return true
}
export function normalizeI18nSettings(input: I18nInput): I18nSettings {
  const locales: LocaleConfig[] = localeCatalog.map((entry) => ({
    ...entry,
    status:
      entry.code === 'en'
        ? 'source'
        : ((input.languages?.find(({ code }) => code === entry.code)
            ?.status as LocaleConfig['status']) ?? 'off'),
  }))
  const publicLocales = locales.filter(({ status }) => status === 'source' || status === 'live')
  const targetLocales = locales.filter(
    ({ status }) => status === 'translating' || status === 'live',
  )
  const regions = (input.regions ?? [])
    .filter((row) => row.label && publicLocales.some(({ code }) => code === row.locale))
    .map((row) => ({
      code: row.id ?? `${row.locale}:${row.label}`,
      label: row.label!,
      group: row.group || null,
      locale: row.locale!,
    }))
  if (!regions.some(({ locale }) => locale === 'en'))
    regions.unshift({ code: 'GLOBAL', label: 'Global', group: null, locale: 'en' })
  return {
    configuredLocales: locales.filter(({ code }) =>
      input.languages?.some((row) => row.code === code),
    ),
    publicLocales,
    targetLocales,
    regions,
  }
}
