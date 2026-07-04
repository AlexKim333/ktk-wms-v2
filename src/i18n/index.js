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

// Get saved language or fallback to Korean
const savedLanguage = localStorage.getItem('lady_polo_lang') || 'ko'

const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: savedLanguage,
  fallbackLocale: 'ko',
  messages
})

export default i18n
