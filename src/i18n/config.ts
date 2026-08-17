// i18n configuration — cookie-based locale
export const locales = [
  'en',
  'zh',
  'es',
  'hi',
  'ar',
  'pt',
  'fr',
  'ru',
  'de',
  'ja',
  'bn',
  'id',
  'ur',
  'tr',
  'ko',
  'it',
  'vi',
  'fa',
  'th',
  'zh-Hant',
  'arz',
  'pcm',
  'lah',
  'en-Runr'
] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const COOKIE_NAME = 'tc-next-locale'

// Native language names shown in the language switcher.
export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '简体中文',
  'zh-Hant': '繁體中文',
  ko: '한국어',
  ru: 'Русский',
  es: 'Español',
  fa: 'فارسی',
  tr: 'Türkçe',
  hi: 'हिन्दी',
  ar: 'العربية',
  fr: 'Français',
  bn: 'বাংলা',
  pt: 'Português',
  ja: '日本語',
  lah: 'لہندا',
  ur: 'اردو',
  id: 'Bahasa Indonesia',
  de: 'Deutsch',
  it: 'Italiano',
  pcm: 'Naijá',
  arz: 'العربية المصرية',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  'en-Runr': 'ᚠᚢᚦᚨᚱᚲ'
}

// ISO 3166-1 alpha-2 country code whose flag is shown next to each locale in
// the language switcher. Rendered as an SVG via country-flag-icons. Locales
// with no country of their own are absent here and listed in localeFlags.
export const localeCountries: Partial<Record<Locale, string>> = {
  en: 'US',
  zh: 'CN',
  'zh-Hant': 'TW',
  ko: 'KR',
  ru: 'RU',
  es: 'ES',
  fa: 'IR',
  tr: 'TR',
  hi: 'IN',
  ar: 'SA',
  fr: 'FR',
  bn: 'BD',
  pt: 'PT',
  ja: 'JP',
  lah: 'PK',
  ur: 'PK',
  id: 'ID',
  de: 'DE',
  it: 'IT',
  pcm: 'NG',
  arz: 'EG',
  vi: 'VN',
  th: 'TH'
}

// Locales that ship their own flag from /public instead of a country flag.
export const localeFlags: Partial<Record<Locale, string>> = {
  'en-Runr': '/flags/en-Runr.svg'
}

// Right-to-left locales need dir="rtl" on the <html> element.
const rtlLocales: Locale[] = ['fa', 'ar', 'arz', 'ur', 'lah']

export const getLangDir = (locale: Locale): 'rtl' | 'ltr' => (rtlLocales.includes(locale) ? 'rtl' : 'ltr')

export const isLocale = (value: unknown): value is Locale => locales.includes(value as Locale)
