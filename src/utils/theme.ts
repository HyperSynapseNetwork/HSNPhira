// 主题管理
export type ThemeMode = 'light' | 'dark'

const THEME_KEY = 'hsn_theme_mode'

export function getThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  // 默认跟随系统
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function setThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode)
  applyTheme(mode)
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  const body = document.body

  if (mode === 'light') {
    // 亮色主题
    root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.15)')
    root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.3)')
    root.style.setProperty('--text-primary', 'rgba(0, 0, 0, 0.9)')
    root.style.setProperty('--text-secondary', 'rgba(0, 0, 0, 0.6)')
    // 设置背景色为透明，让背景图片原色显示
    body.style.backgroundColor = 'transparent'
    root.classList.remove('dark')
    root.classList.add('light')
  } else {
    // 暗色主题
    root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.1)')
    root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.2)')
    root.style.setProperty('--text-primary', 'rgba(255, 255, 255, 0.9)')
    root.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.6)')
    // 设置背景色为透明，让背景图片原色显示
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

// 初始化主题
export function initTheme(): void {
  const mode = getThemeMode()
  applyTheme(mode)
}
