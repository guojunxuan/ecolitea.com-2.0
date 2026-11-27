export type LocaleConfig = {
  code: string
  label: string
  short?: string
  googleCode?: string
  status: 'source' | 'off' | 'translating' | 'live'
}
export type RegionConfig = { code: string; label: string; group: string | null; locale: string }
export const localeCatalog = [
  { code: 'en', label: 'English', short: 'EN', googleCode: 'en' },
  { code: 'de', label: 'Deutsch', short: 'DE', googleCode: 'de' },
  { code: 'fr', label: 'Français', short: 'FR', googleCode: 'fr' },
  { code: 'es', label: 'Español', short: 'ES', googleCode: 'es' },
  { code: 'it', label: 'Italiano', short: 'IT', googleCode: 'it' },
  { code: 'pt', label: 'Português', short: 'PT', googleCode: 'pt' },
  { code: 'nl', label: 'Nederlands', short: 'NL', googleCode: 'nl' },
  { code: 'pl', label: 'Polski', short: 'PL', googleCode: 'pl' },
  { code: 'sv', label: 'Svenska', short: 'SV', googleCode: 'sv' },
  { code: 'tr', label: 'Türkçe', short: 'TR', googleCode: 'tr' },
  { code: 'ru', label: 'Русский', short: 'RU', googleCode: 'ru' },
  { code: 'ja', label: '日本語', short: 'JA', googleCode: 'ja' },
  { code: 'ko', label: '한국어', short: 'KO', googleCode: 'ko' },
  { code: 'zh', label: '简体中文', short: 'ZH', googleCode: 'zh-CN' },
  { code: 'zh-tw', label: '繁體中文', short: 'ZH-TW', googleCode: 'zh-TW' },
  { code: 'vi', label: 'Tiếng Việt', short: 'VI', googleCode: 'vi' },
  { code: 'th', label: 'ไทย', short: 'TH', googleCode: 'th' },
  { code: 'id', label: 'Bahasa Indonesia', short: 'ID', googleCode: 'id' },
] as const
