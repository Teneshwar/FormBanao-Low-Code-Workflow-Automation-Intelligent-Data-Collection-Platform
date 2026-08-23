import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Basic in-memory loader with dynamic imports for lazy-loading locales
const DEFAULT_LANG = 'en'
export const SUPPORTED_LANGS = [
  'en','hi','mr','bn','ta','te','kn','gu','pa','ml','ur'
]

// load English immediately
import enCommon from './locales/en/common.json'

const browserLanguage = (navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage || DEFAULT_LANG).split('-')[0]

function getLanguageStorageKey(userId?: number | null) {
  return userId != null ? `app_lang_user_${userId}` : 'app_lang'
}

function getSavedLanguage(userId?: number | null) {
  const saved = localStorage.getItem(getLanguageStorageKey(userId))
  return SUPPORTED_LANGS.includes(saved || '') ? saved : null
}

function getDefaultLanguage() {
  return SUPPORTED_LANGS.includes(browserLanguage) ? browserLanguage : DEFAULT_LANG
}

const initialLanguage = getSavedLanguage() || getDefaultLanguage()

function updateDocumentLanguage(lang: string) {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr'
}

import { formatNumber } from '../lib/localeUtils'

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon }
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  ns: ['common'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
    // auto-format numbers to locale-specific digits
    format: (value: any, _format: string | undefined, lng: string | undefined) => {
      if (typeof value === 'number') {
        try { return formatNumber(value, lng || initialLanguage) } catch (e) { return String(value) }
      }
      return String(value)
    }
  },
  react: { useSuspense: false },
})

updateDocumentLanguage(initialLanguage)
if (initialLanguage !== DEFAULT_LANG) {
  loadLocale(initialLanguage).then(() => i18n.changeLanguage(initialLanguage)).catch(() => {})
}

// Lazy-load and add resource bundle for a language
export async function loadLocale(lang: string) {
  if (!SUPPORTED_LANGS.includes(lang)) return
  if (i18n.hasResourceBundle(lang, 'common')) {
    return
  }
  try {
    const mod = await import(`./locales/${lang}/common.json`)
    i18n.addResourceBundle(lang, 'common', mod.default || mod)
  } catch (e) {
    console.warn('Failed to load locale', lang, e)
  }
}

async function applyLanguage(lang: string) {
  if (!SUPPORTED_LANGS.includes(lang)) return
  await loadLocale(lang)
  i18n.changeLanguage(lang)
  updateDocumentLanguage(lang)
}

export async function changeAppLanguage(lang: string, userId?: number | null) {
  if (!SUPPORTED_LANGS.includes(lang)) return
  await applyLanguage(lang)
  try { localStorage.setItem(getLanguageStorageKey(userId), lang) } catch {}
}

export function getSavedUserLanguage(userId: number) {
  return getSavedLanguage(userId)
}

export async function applySavedUserLanguage(userId: number) {
  const saved = getSavedLanguage(userId)
  const lang = saved || getDefaultLanguage()
  await applyLanguage(lang)
}

export default i18n
