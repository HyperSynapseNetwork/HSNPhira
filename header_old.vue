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
        <div class="p-4">
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
import { eventBus } from '@/utils/eventBus'
import type { Language } from '@/i18n'

const userStore = useUserStore()
const i18nStore = useI18nStore()
const { t, currentLanguage } = i18nStore

const showUserMenu = ref(false)
const showMobileMenu = ref(false)
const showLangMenu = ref(false)
const userMenuRef = ref<HTMLElement>()
const langMenuRef = ref<HTMLElement>()

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

onMounted(() => {
  eventBus.on('login-success', handleLoginSuccess)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  eventBus.off('login-success', handleLoginSuccess)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  height: 3px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
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
