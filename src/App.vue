<template>
  <div id="app" class="min-h-screen relative">
    <!-- 背景 -->
    <BackgroundImage />
    
    <!-- 粒子效果 -->
    <ParticleEffect v-if="particlesEnabled" />

    <!-- 顶部导航 -->
    <Header />

    <!-- 主要内容 -->
    <main class="relative z-10">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- 底部 -->
    <Footer />

    <!-- 全局组件 -->
    <Message />
    <WindowAuth />
    <WindowChart />
    <WindowRoomPlayers />
    <WindowRoomHistory />
    <WindowChartDownload />
    <Lightbox />
    <PageUpdate />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { getUserPreference } from './utils/config'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store'
import { useThemeStore } from '@/stores/theme'
import { useI18nStore } from '@/stores/i18n'
import Header from './components/common/Header.vue'
import Footer from './components/common/Footer.vue'
import Message from './components/common/Message.vue'
import WindowAuth from './components/windows/WindowAuth.vue'
import WindowChart from './components/windows/WindowChart.vue'
import WindowRoomPlayers from './components/windows/WindowRoomPlayers.vue'
import WindowRoomHistory from './components/windows/WindowRoomHistory.vue'
import WindowChartDownload from './components/windows/WindowChartDownload.vue'
import Lightbox from './components/Lightbox.vue'
import BackgroundImage from './components/background/BackgroundImage.vue'
import ParticleEffect from './components/background/ParticleEffect.vue'
import PageUpdate from './components/PageUpdate.vue'

const userStore = useUserStore()
const themeStore = useThemeStore()
const i18nStore = useI18nStore()
const route = useRoute()
const particlesEnabled = computed(() => getUserPreference('particle_enabled', false))

// Watch language changes: sync HTML lang attr + re-apply page meta
watch(
  () => i18nStore.currentLanguage,
  async (newLang) => {
    const { refreshMetaForLanguageChange, getPageNameFromRoute } = await import('@/utils/meta')
    const pageName = getPageNameFromRoute(route.path)
    await refreshMetaForLanguageChange(pageName, newLang)
  }
)

onMounted(async () => {
  await userStore.fetchUser()
  themeStore.initTheme()
})
</script>

<style>
#app {
  position: relative;
  min-height: 100vh;
}
</style>
