<template>
  <div class="min-h-screen">
    <!-- 第一屏：文字居中 -->
    <div class="h-screen flex items-center justify-center px-4">
      <div class="text-center space-y-4 md:space-y-6 animate-slide-in-left max-w-4xl mx-auto">
        <h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
          {{ t('home.title') }}<br class="sm:hidden" />
          <span class="block sm:inline mt-2 sm:mt-0">{{ t('home.subtitle') }}</span>
        </h1>
        <p class="text-base sm:text-lg md:text-xl text-white/80">
          {{ t('home.features') }}
        </p>
        <p class="text-sm sm:text-base text-white/60">
          {{ t('home.visitCount', { count: visitedCount }) }}
        </p>

        <!-- 向下滚动提示 -->
        <div class="mt-12 md:mt-16 animate-bounce">
          <svg class="w-8 h-8 mx-auto text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </div>

    <!-- 第二屏：服务器信息卡片 -->
    <div class="min-h-screen flex items-center justify-center px-4 py-20">
      <div class="container mx-auto max-w-2xl">
        <div class="glass rounded-3xl p-6 sm:p-8 space-y-6">
          <!-- 服务器状态 -->
          <ServerStatus />

          <!-- 服务器信息 -->
          <div class="space-y-4">
            <div class="glass rounded-2xl p-4 hover:scale-105 transition-transform">
              <div class="text-white/60 text-sm mb-1">{{ t('home.qqGroup') }}</div>
              <div class="text-white text-lg sm:text-xl font-mono">1049578201</div>
            </div>

            <div class="glass rounded-2xl p-4 hover:scale-105 transition-transform">
              <div class="text-white/60 text-sm mb-1">{{ t('home.serverAddress') }}</div>
              <div class="text-white text-base sm:text-xl font-mono break-all">
                service.htadiy.com:7865
              </div>
            </div>
          </div>

          <!-- 复制按钮 -->
          <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              class="flex-1 px-6 py-3 rounded-xl glass text-white font-medium hover:scale-105 hover:shadow-lg transition-all text-sm sm:text-base"
              @click="copyQQ"
            >
              {{ t('home.copyQQ') }}
            </button>
            <button
              class="flex-1 px-6 py-3 rounded-xl glass text-white font-medium hover:scale-105 hover:shadow-lg transition-all text-sm sm:text-base"
              @click="copyServer"
            >
              {{ t('home.copyServer') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { authAPI } from '@/api/auth'
import { copyToClipboard } from '@/utils/message'
import { useI18nStore } from '@/stores/i18n'
import ServerStatus from '@/components/ServerStatus.vue'

const visitedCount = ref(0)
const { t } = useI18nStore()

onMounted(async () => {
  try {
    visitedCount.value = await authAPI.getVisitedCount()
  } catch {
    visitedCount.value = 0
  }
})

function copyQQ() {
  copyToClipboard('1049578201', 'QQ群号已复制')
}

function copyServer() {
  copyToClipboard('service.htadiy.com:7865', '服务器地址已复制')
}
</script>
