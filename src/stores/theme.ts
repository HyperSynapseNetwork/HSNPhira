import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { setUserPreference, getUserPreference } from '@/utils/config'

export type ThemeMode = 'light' | 'dark' | 'high-contrast'

export const useThemeStore = defineStore('theme', () => {
  const themeMode = ref<ThemeMode>(getUserPreference('theme_mode', 'light'))
  const isDarkMode = computed(() => themeMode.value === 'dark')
  const isHighContrastMode = computed(() => themeMode.value === 'high-contrast')

  // 初始化主题
  function initTheme() {
    const savedTheme = getUserPreference('theme_mode', 'light') as ThemeMode
    themeMode.value = savedTheme
    applyTheme(savedTheme)
  }

  // 切换主题
  function setTheme(mode: ThemeMode) {
    themeMode.value = mode
    setUserPreference('theme_mode', mode)
    applyTheme(mode)
  }

  // 切换主题模式（循环：light -> dark -> high-contrast -> light）
  function toggleDarkMode() {
    const nextMode: ThemeMode = 
      themeMode.value === 'light' ? 'dark' :
      themeMode.value === 'dark' ? 'high-contrast' : 'light'
    setTheme(nextMode)
  }

  // 切换高对比度模式
  function toggleHighContrastMode() {
    const newMode = isHighContrastMode.value ? 'light' : 'high-contrast'
    setTheme(newMode)
  }

  // 应用主题到DOM
  function applyTheme(mode: ThemeMode) {
    const html = document.documentElement
    html.classList.remove('theme-light', 'theme-dark', 'theme-high-contrast')
    html.classList.add(`theme-${mode}`)
    
    // 设置data-theme属性，用于CSS选择器
    html.setAttribute('data-theme', mode)
    
    // 如果是深色模式或高对比度模式，移除毛玻璃效果
    if (mode === 'dark' || mode === 'high-contrast') {
      html.classList.add('no-glass-effect')
    } else {
      html.classList.remove('no-glass-effect')
    }
  }

  // 监听系统主题偏好
  if (typeof window !== 'undefined' && window.matchMedia) {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      // 如果用户没有手动设置主题，则跟随系统
      const userTheme = getUserPreference('theme_mode')
      if (!userTheme) {
        const newMode = e.matches ? 'dark' : 'light'
        setTheme(newMode)
      }
    }
    
    darkModeMediaQuery.addEventListener('change', handleSystemThemeChange)
    
    // 初始时如果没有用户设置，跟随系统
    if (!getUserPreference('theme_mode')) {
      const systemPrefersDark = darkModeMediaQuery.matches
      const initialTheme = systemPrefersDark ? 'dark' : 'light'
      setTheme(initialTheme)
    }
  }

  return {
    themeMode,
    isDarkMode,
    isHighContrastMode,
    setTheme,
    toggleDarkMode,
    toggleHighContrastMode,
    initTheme
  }
})
