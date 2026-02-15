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
import { computed } from 'vue'
import { getUserPreference } from './utils/config'
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

const particlesEnabled = computed(() => getUserPreference('particle_enabled', false))

// 不在应用启动时自动获取用户信息，只在登录后请求
// onMounted(async () => {
//   await userStore.fetchUser()
// })
</script>

<style>
#app {
  position: relative;
  min-height: 100vh;
}
</style>
