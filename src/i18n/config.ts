// i18n configuration — cookie-based locale
export const locales = ['en', 'zh', 'zh-Hant', 'ko', 'ru', 'es', 'fa'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const COOKIE_NAME = 'NEXT_LOCALE'

// Native language names shown in the language switcher.
export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '简体中文',
  'zh-Hant': '繁體中文',
  ko: '한국어',
  ru: 'Русский',
  es: 'Español',
  fa: 'فارسی'
}

// Right-to-left locales need dir="rtl" on the <html> element.
const rtlLocales: Locale[] = ['fa']

export const getLangDir = (locale: Locale): 'rtl' | 'ltr' => (rtlLocales.includes(locale) ? 'rtl' : 'ltr')

export const isLocale = (value: unknown): value is Locale => locales.includes(value as Locale)
