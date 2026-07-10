import { createI18n } from 'vue-i18n'
import ko from './locales/ko.json'
import en from './locales/en.json'
import es from './locales/es.json'
import zh from './locales/zh.json'

const messages = {
  ko,
  en,
  es,
  zh
}

// Get saved language or fallback to Spanish (es)
const savedLanguage = localStorage.getItem('lady_polo_lang') || 'es'

const numberFormats = {
  'en': { currency: { style: 'currency', currency: 'USD' } },
  'ko': { currency: { style: 'currency', currency: 'KRW' } },
  'es': { currency: { style: 'currency', currency: 'MXN' } },
  'zh': { currency: { style: 'currency', currency: 'CNY' } }
}

const datetimeFormats = {
  'en': { short: { year: 'numeric', month: 'short', day: 'numeric' } },
  'ko': { short: { year: 'numeric', month: 'short', day: 'numeric' } },
  'es': { short: { year: 'numeric', month: 'short', day: 'numeric' } },
  'zh': { short: { year: 'numeric', month: 'short', day: 'numeric' } }
}

const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: savedLanguage,
  fallbackLocale: 'es',
  messages,
  numberFormats,
  datetimeFormats
})

export default i18n
