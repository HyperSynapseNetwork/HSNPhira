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
          <template v-if="isLoading">
            <span class="inline-flex items-center animate-pulse">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在加载用户数...
            </span>
          </template>
          <template v-else>
            {{ t('home.visitCount', { count: visitedCount }) }}
          </template>
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
              <div class="text-white text-lg sm:text-xl font-mono">{{ qqGroup }}</div>
            </div>

            <div class="glass rounded-2xl p-4 hover:scale-105 transition-transform">
              <div class="text-white/60 text-sm mb-1">{{ t('home.serverAddress') }}</div>
              <div class="text-white text-base sm:text-xl font-mono break-all">
                {{ phiraServerAddress }}
              </div>
            </div>

            <div class="glass rounded-2xl p-4 hover:scale-105 transition-transform">
              <div class="text-white/60 text-sm mb-1">{{ t('home.hsnmcServerAddress') }}</div>
              <div class="text-white text-base sm:text-xl font-mono break-all">
                {{ hsnmcServerAddress }}
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
            <button
              class="flex-1 px-6 py-3 rounded-xl glass text-white font-medium hover:scale-105 hover:shadow-lg transition-all text-sm sm:text-base"
              @click="copyHsnmc"
            >
              {{ t('home.copyHsnmc') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { authAPI } from '@/api/auth'
import { copyToClipboard } from '@/utils/message'
import { useI18nStore } from '@/stores/i18n'
import { getGlobalConfig, getLocalizedText } from '@/utils/config'
import ServerStatus from '@/components/ServerStatus.vue'

const visitedCount = ref(0)
const isLoading = ref(true)
const { t } = useI18nStore()

// 全局配置
const globalConfig = computed(() => getGlobalConfig())

// 配置值计算属性
const qqGroup = computed(() => getLocalizedText(globalConfig.value.server.qqGroup))
const phiraServerAddress = computed(() => getLocalizedText(globalConfig.value.server.phiraServerAddress))
const hsnmcServerAddress = computed(() => getLocalizedText(globalConfig.value.server.hsnmcServerAddress))

// 缓存键名
const CACHE_KEY = 'hsn_visited_count'
const CACHE_TIMESTAMP_KEY = 'hsn_visited_count_timestamp'
const CACHE_EXPIRY_MS = 60 * 60 * 1000 // 1小时缓存

// 获取缓存的访问次数
function getCachedVisitedCount(): number | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    
    if (!cached || !timestamp) return null
    
    const now = Date.now()
    const cachedTime = parseInt(timestamp, 10)
    
    if (now - cachedTime > CACHE_EXPIRY_MS) return null
    
    return parseInt(cached, 10)
  } catch {
    return null
  }
}

// 保存到缓存
function saveToCache(count: number) {
  try {
    localStorage.setItem(CACHE_KEY, count.toString())
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
  } catch {
    // 忽略localStorage错误
  }
}

async function loadVisitedCount() {
  isLoading.value = true
  
  // 先尝试从缓存读取
  const cachedCount = getCachedVisitedCount()
  if (cachedCount !== null) {
    visitedCount.value = cachedCount
    isLoading.value = false
  }
  
  // 无论如何都获取最新数据
  try {
    const freshCount = await authAPI.getVisitedCount()
    visitedCount.value = freshCount
    saveToCache(freshCount)
  } catch {
    // 如果API失败且没有缓存，使用0
    if (cachedCount === null) {
      visitedCount.value = 0
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadVisitedCount()
})

function copyQQ() {
  copyToClipboard(qqGroup.value, t('home.qqCopied'))
}

function copyServer() {
  copyToClipboard(phiraServerAddress.value, t('home.serverCopied'))
}

function copyHsnmc() {
  copyToClipboard(hsnmcServerAddress.value, t('home.hsnmcCopied'))
}
</script>
