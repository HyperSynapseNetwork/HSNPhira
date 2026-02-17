// 主题管理
// 注意：所有函数均依赖浏览器 API（localStorage / window / document），
// 请勿在 SSG 预渲染阶段（isClient === false）调用，以免抛出异常。

export type ThemeMode = 'light' | 'dark'

const THEME_KEY = 'hsn_theme_mode'

// SSR 环境判断
const isBrowser = typeof window !== 'undefined'

export function getThemeMode(): ThemeMode {
  if (!isBrowser) return 'dark' // SSR 默认暗色，与客户端 hydration 保持一致
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  // 默认跟随系统
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function setThemeMode(mode: ThemeMode): void {
  if (!isBrowser) return
  localStorage.setItem(THEME_KEY, mode)
  applyTheme(mode)
}

export function applyTheme(mode: ThemeMode): void {
  if (!isBrowser) return
  const root = document.documentElement
  const body = document.body

  if (mode === 'light') {
    // 亮色主题
    root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.15)')
    root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.3)')
    root.style.setProperty('--text-primary', 'rgba(0, 0, 0, 0.9)')
    root.style.setProperty('--text-secondary', 'rgba(0, 0, 0, 0.6)')
    body.style.backgroundColor = 'transparent'
    root.classList.remove('dark')
    root.classList.add('light')
  } else {
    // 暗色主题
    root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.1)')
    root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.2)')
    root.style.setProperty('--text-primary', 'rgba(255, 255, 255, 0.9)')
    root.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.6)')
    body.style.backgroundColor = 'transparent'
    root.classList.remove('light')
    root.classList.add('dark')
  }
}

export function toggleTheme(): ThemeMode {
  const current = getThemeMode()
  const newMode = current === 'light' ? 'dark' : 'light'
  setThemeMode(newMode)
  return newMode
}

// 初始化主题（仅客户端调用）
export function initTheme(): void {
  if (!isBrowser) return
  const mode = getThemeMode()
  applyTheme(mode)
}
