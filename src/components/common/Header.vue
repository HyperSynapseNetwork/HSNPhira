<template>
  <header class="fixed top-0 left-0 right-0 z-50 glass-dark backdrop-blur-md">
    <div class="px-3 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2 md:gap-4">
      <!-- 左侧Logo -->
      <router-link to="/" class="flex-shrink-0">
        <img src="/logo.png" alt="HSN Logo" class="h-6 md:h-8 hover:opacity-80 transition-opacity" />
      </router-link>

      <!-- 移动端汉堡菜单按钮 -->
      <button
        class="md:hidden p-2 rounded-lg glass hover:bg-white/10 transition-colors"
        @click="toggleMobileMenu"
      >
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <!-- 中间导航（桌面端） -->
      <nav class="hidden md:flex flex-1 overflow-x-auto mx-4 custom-scrollbar">
        <div class="flex gap-2 min-w-max">
          <router-link
            v-for="route in navRoutes"
            :key="route.path"
            :to="route.path"
            class="px-4 py-1.5 rounded-xl glass hover:bg-white/10 text-white text-sm whitespace-nowrap transition-all"
            :class="{ 'bg-primary/40 ring-1 ring-primary shadow-lg': $route.path === route.path }"
          >
            {{ t(route.nameKey) }}
          </router-link>
        </div>
      </nav>

      <!-- 右侧功能区（桌面端） -->
      <div class="hidden md:flex flex-shrink-0 items-center gap-2">
        <!-- 语言切换 -->
        <div class="relative" ref="langMenuRef">
          <button
            class="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
            @click="toggleLangMenu"
            title="切换语言"
          >
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </button>

          <!-- 语言菜单 -->
          <transition name="fade">
            <div
              v-if="showLangMenu"
              class="absolute right-0 top-12 min-w-[120px] glass rounded-xl p-2 shadow-xl"
            >
              <button
                v-for="lang in languages"
                :key="lang.code"
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-white text-sm"
                :class="{ 'bg-primary/40': currentLanguage === lang.code }"
                @click="changeLang(lang.code)"
              >
                {{ lang.name }}
              </button>
            </div>
          </transition>
        </div>

        <!-- PWA安装按钮 -->
        <div class="relative" v-if="showInstallButton">
          <button
            class="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
            @click="handleInstall"
            :aria-label="t('common.installApp')"
            title="安装为应用"
          >
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>

        <!-- 主题切换 -->
        <div class="relative">
          <button
            class="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
            @click="themeStore.toggleDarkMode()"
            :aria-label="getThemeLabel()"
            :title="getThemeLabel()"
          >
            <svg v-if="themeStore.themeMode === 'light'" class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else-if="themeStore.themeMode === 'dark'" class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <svg v-else class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <defs>
                <linearGradient id="hc-glass" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.8" />
                  <stop offset="100%" stop-color="#F0F0F0" stop-opacity="0.2" />
                </linearGradient>
              </defs>
              <circle cx="12" cy="12" r="10" fill="url(#hc-glass)" stroke="#B0B0B0" stroke-width="0.5" />
              <path d="M12,4 A8,8 0 0 0 12,20" fill="#2B2B2B" />
              <path d="M12,4 A8,8 0 0 1 12,20" fill="#E0E0E0" />
              <circle cx="15" cy="9" r="1.5" fill="#FFFFFF" fill-opacity="0.9" />
              <circle cx="12" cy="12" r="9" fill="none" stroke="#4A4A4A" stroke-width="0.6" stroke-opacity="0.3" />
            </svg>
          </button>
        </div>

        <!-- 登录按钮或用户头像 -->
        <template v-if="!userStore.isLoggedIn">
          <button
            class="px-4 py-1.5 rounded-xl glass hover:bg-white/10 text-white text-sm transition-all hover:scale-105"
            @click="showAuthWindow"
          >
            {{ t('common.login') }}
          </button>
        </template>

        <template v-else>
          <div class="relative" ref="userMenuRef">
            <img
              :src="userStore.user?.phira_avatar || '/default-avatar.png'"
              alt="User Avatar"
              class="w-9 h-9 rounded-full cursor-pointer ring-2 ring-white/20 hover:ring-primary transition-all"
              @click="toggleUserMenu"
            />

            <!-- 用户菜单 -->
            <transition name="fade">
              <div
                v-if="showUserMenu"
                class="absolute right-0 top-12 min-w-[200px] glass rounded-2xl p-4 shadow-xl"
              >
                <div class="text-white mb-3 pb-3 border-b border-white/20">
                  <div class="font-bold text-sm">{{ userStore.user?.username }}</div>
                  <div class="text-xs text-white/60">ID: {{ userStore.user?.id }}</div>
                </div>

                <div class="space-y-2">
                  <router-link
                    to="/account"
                    class="block px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-white text-sm"
                    @click="closeUserMenu"
                  >
                    {{ t('common.account') }}
                  </router-link>
                  
                  <a
                    :href="`https://phira.moe/user/${userStore.user?.phira_id}`"
                    target="_blank"
                    class="block px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-white text-sm"
                  >
                    Phira{{ t('common.homepage') }}
                  </a>
                  
                  <button
                    class="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-red-400 text-sm"
                    @click="handleLogout"
                  >
                    {{ t('common.logout') }}
                  </button>
                </div>
              </div>
            </transition>
          </div>
        </template>
      </div>
    </div>

    <!-- 移动端菜单 -->
    <transition name="mobile-menu">
      <div v-if="showMobileMenu" class="md:hidden glass-dark" @click.self="closeMobileMenu">
        <div class="p-4 max-h-[calc(100vh-120px)] overflow-y-auto">
          <!-- 导航链接 -->
          <div class="space-y-2 mb-4">
            <router-link
              v-for="route in navRoutes"
              :key="route.path"
              :to="route.path"
              class="block px-4 py-2 rounded-lg hover:bg-white/10 text-white transition-colors text-sm"
              :class="{ 'bg-primary/40': $route.path === route.path }"
              @click="closeMobileMenu"
            >
              {{ t(route.nameKey) }}
            </router-link>
          </div>

          <div class="pt-4 border-t border-white/20 space-y-2">
            <!-- 语言切换 -->
            <div class="px-4 py-2 text-white/60 text-xs">{{ t('common.language') }}</div>
            <select
              v-model="currentLanguage"
              @change="changeLang(currentLanguage); closeMobileMenu()"
              class="w-full px-4 py-2 rounded-lg glass text-white bg-transparent border border-white/20 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="zh">简体中文</option>
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>

            <!-- 主题切换 -->
            <div class="px-4 py-2 text-white/60 text-xs">{{ t('common.theme') }}</div>
            <button
              class="w-full px-4 py-2 rounded-lg glass hover:bg-white/10 text-white transition-colors text-sm flex items-center justify-between"
              @click="themeStore.toggleDarkMode(); closeMobileMenu()"
            >
              <span>{{ getThemeLabel() }}</span>
              <div class="flex items-center">
                <svg v-if="themeStore.themeMode === 'light'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <svg v-else-if="themeStore.themeMode === 'dark'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <defs>
                    <linearGradient id="hc-glass-mobile" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.8" />
                      <stop offset="100%" stop-color="#F0F0F0" stop-opacity="0.2" />
                    </linearGradient>
                  </defs>
                  <circle cx="12" cy="12" r="10" fill="url(#hc-glass-mobile)" stroke="#B0B0B0" stroke-width="0.5" />
                  <path d="M12,4 A8,8 0 0 0 12,20" fill="#2B2B2B" />
                  <path d="M12,4 A8,8 0 0 1 12,20" fill="#E0E0E0" />
                  <circle cx="15" cy="9" r="1.5" fill="#FFFFFF" fill-opacity="0.9" />
                  <circle cx="12" cy="12" r="9" fill="none" stroke="#4A4A4A" stroke-width="0.6" stroke-opacity="0.3" />
                </svg>
              </div>
            </button>


            <!-- 登录或用户菜单 -->
            <template v-if="!userStore.isLoggedIn">
              <button
                class="w-full px-4 py-2 rounded-lg glass hover:bg-white/10 text-white transition-colors text-sm"
                @click="showAuthWindow(); closeMobileMenu()"
              >
                {{ t('common.login') }}
              </button>
            </template>

            <template v-else>
              <router-link
                to="/account"
                class="block px-4 py-2 rounded-lg hover:bg-white/10 text-white transition-colors text-sm"
                @click="closeMobileMenu"
              >
                {{ t('common.account') }}
              </router-link>
              <a
                :href="`https://phira.moe/user/${userStore.user?.phira_id}`"
                target="_blank"
                class="block px-4 py-2 rounded-lg hover:bg-white/10 text-white transition-colors text-sm"
              >
                Phira{{ t('common.homepage') }}
              </a>
              <button
                class="w-full text-left px-4 py-2 rounded-lg hover:bg-white/10 text-red-400 transition-colors text-sm"
                @click="handleLogout(); closeMobileMenu()"
              >
                {{ t('common.logout') }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </transition>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/store'
import { useI18nStore } from '@/stores/i18n'
import { useThemeStore } from '@/stores/theme'
import { eventBus } from '@/utils/eventBus'
import type { Language } from '@/i18n'

const userStore = useUserStore()
const i18nStore = useI18nStore()
const themeStore = useThemeStore()
const { t, currentLanguage } = i18nStore

const showUserMenu = ref(false)
const showMobileMenu = ref(false)
const showLangMenu = ref(false)
const userMenuRef = ref<HTMLElement>()
const langMenuRef = ref<HTMLElement>()

// PWA 安装
const installPrompt = ref<any>(null)
const showInstallButton = ref(false)

const navRoutes = [
  { path: '/', nameKey: 'nav.home' },
  { path: '/rooms', nameKey: 'nav.rooms' },
  { path: '/chart-ranking', nameKey: 'nav.chartRanking' },
  { path: '/user-ranking', nameKey: 'nav.userRanking' },
  { path: '/chart-download', nameKey: 'nav.chartDownload' },
  { path: '/phira-download', nameKey: 'nav.phiraDownload' },
  { path: '/navigation', nameKey: 'nav.navigation' },
  { path: '/announcement', nameKey: 'nav.announcement' },
  { path: '/agreement', nameKey: 'nav.agreement' },
  { path: '/about', nameKey: 'nav.about' },
  { path: '/md', nameKey: 'nav.docs' },
]

const languages = [
  { code: 'zh' as Language, name: '简体中文' },
  { code: 'zh-TW' as Language, name: '繁體中文' },
  { code: 'en' as Language, name: 'English' },
  { code: 'ja' as Language, name: '日本語' },
]

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
  showLangMenu.value = false
}

function closeUserMenu() {
  showUserMenu.value = false
}

function toggleMobileMenu() {
  showMobileMenu.value = !showMobileMenu.value
}

function closeMobileMenu() {
  showMobileMenu.value = false
}

function toggleLangMenu() {
  showLangMenu.value = !showLangMenu.value
  showUserMenu.value = false
}

function changeLang(lang: Language) {
  i18nStore.setLanguage(lang)
  showLangMenu.value = false
}

function showAuthWindow() {
  eventBus.emit('open-window', 'auth')
}


async function handleLogout() {
  closeUserMenu()
  await userStore.logout()
}

function handleLoginSuccess() {
  closeUserMenu()
}

// PWA 安装相关函数
async function handleInstall() {
  if (!installPrompt.value) return

  installPrompt.value.prompt()
  const choiceResult = await installPrompt.value.userChoice

  if (choiceResult.outcome === 'accepted') {
    console.log('用户接受了PWA安装')
  } else {
    console.log('用户拒绝了PWA安装')
  }

  installPrompt.value = null
  showInstallButton.value = false
}

function getThemeLabel() {
  const mode = themeStore.themeMode
  if (mode === 'light') return t('common.themeLight')
  if (mode === 'dark') return t('common.themeDark')
  return t('common.themeHighContrast')
}

// 点击外部关闭菜单
function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node
  
  if (userMenuRef.value && !userMenuRef.value.contains(target)) {
    showUserMenu.value = false
  }
  
  if (langMenuRef.value && !langMenuRef.value.contains(target)) {
    showLangMenu.value = false
  }
  
  // 汉堡菜单：点击外部关闭
  if (showMobileMenu.value) {
    const header = document.querySelector('header')
    if (header && !header.contains(target)) {
      closeMobileMenu()
    }
  }
}

// PWA事件处理函数
function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  installPrompt.value = e
  showInstallButton.value = true
  console.log('PWA安装提示已准备就绪')
}

function handlePwaInstallReady(e: Event) {
  const customEvent = e as CustomEvent
  if (customEvent.detail) {
    installPrompt.value = customEvent.detail
    showInstallButton.value = true
  }
}

function handleAppInstalled() {
  installPrompt.value = null
  showInstallButton.value = false
  window.__pwaInstallPrompt = null
  console.log('PWA已成功安装')
}

onMounted(() => {
  // Check if PWA install prompt was already captured before Vue mounted
  if (window.__pwaInstallPrompt) {
    installPrompt.value = window.__pwaInstallPrompt
    showInstallButton.value = true
  }

  // Listen for future beforeinstallprompt events
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  // Listen for the custom event dispatched by the early capture script
  window.addEventListener('pwa-install-ready', handlePwaInstallReady)

  // 监听PWA安装完成
  window.addEventListener('appinstalled', handleAppInstalled)

  eventBus.on('login-success', handleLoginSuccess)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('pwa-install-ready', handlePwaInstallReady)
  window.removeEventListener('appinstalled', handleAppInstalled)
  eventBus.off('login-success', handleLoginSuccess)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.4);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.6);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
