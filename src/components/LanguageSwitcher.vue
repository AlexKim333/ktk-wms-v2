<template>
  <div class="language-switcher">
    <select v-model="currentLanguage" @change="changeLanguage">
      <option value="ko">한국어 (Korean)</option>
      <option value="en">English</option>
      <option value="es">Español (Spanish)</option>
      <option value="zh">中文 (Chinese)</option>
    </select>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()
const currentLanguage = ref(locale.value)

const changeLanguage = () => {
  locale.value = currentLanguage.value
  localStorage.setItem('lady_polo_lang', currentLanguage.value)
}

watch(locale, (newLocale) => {
  currentLanguage.value = newLocale
})
</script>

<style scoped>
.language-switcher {
  display: inline-block;
}
.language-switcher select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  font-size: 14px;
  color: #334155;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.language-switcher select:hover {
  border-color: #cbd5e1;
}
.language-switcher select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}
</style>
