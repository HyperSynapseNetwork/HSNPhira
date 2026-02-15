import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { messages, detectLanguage, type Language } from '@/i18n'

export const useI18nStore = defineStore('i18n', () => {
  const currentLanguage = ref<Language>(detectLanguage())
  
  const t = computed(() => {
    return (key: string, params?: Record<string, any>): string => {
      const keys = key.split('.')
      let value: any = (messages as any)[currentLanguage.value]

      for (const k of keys) {
        value = value?.[k]
      }

      if (typeof value !== 'string') {
        return key
      }

      // 替换参数
      if (params) {
        return value.replace(/\{(\w+)\}/g, (_, key) => params[key] || '')
      }

      return value
    }
  })
  
  function setLanguage(lang: Language) {
    currentLanguage.value = lang
    localStorage.setItem('hsn_language', lang)
    
    // 同时更新用户偏好配置中的language字段
    try {
      const userPreferences = JSON.parse(localStorage.getItem('hsn_user_preferences') || '{}')
      userPreferences.language = lang
      localStorage.setItem('hsn_user_preferences', JSON.stringify(userPreferences))
    } catch (error) {
      console.error('Failed to update user preferences:', error)
    }
  }
  
  function initLanguage() {
    // 首先检查用户偏好配置中的语言设置
    const userPreferences = JSON.parse(localStorage.getItem('hsn_user_preferences') || '{}')
    const prefLanguage = userPreferences.language
    
    // 映射偏好配置中的语言值到Language类型
    let lang: Language | undefined
    if (prefLanguage === 'zh' || prefLanguage === 'zh-CN') {
      lang = 'zh'
    } else if (prefLanguage === 'zh-TW') {
      lang = 'zh-TW'
    } else if (prefLanguage === 'en' || prefLanguage === 'en-US') {
      lang = 'en'
    } else if (prefLanguage === 'ja' || prefLanguage === 'ja-JP') {
      lang = 'ja'
    }
    
    if (lang && ['zh', 'zh-TW', 'en', 'ja'].indexOf(lang) !== -1) {
      currentLanguage.value = lang
      localStorage.setItem('hsn_language', lang)
    } else {
      // 回退到旧的hsn_language设置
      const saved = localStorage.getItem('hsn_language') as Language
      if (saved && ['zh', 'zh-TW', 'en', 'ja'].indexOf(saved) !== -1) {
        currentLanguage.value = saved
      } else {
        currentLanguage.value = detectLanguage()
      }
    }
  }
  
  return {
    currentLanguage,
    t,
    setLanguage,
    initLanguage
  }
})
