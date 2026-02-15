<template>
  <Window v-model="isOpen" width="500px">
    <div class="text-white">
      <h2 class="text-2xl font-bold mb-6 text-center">{{ t('chartDownload.title') }}</h2>
      
      <div v-if="chartData" class="space-y-4">
        <!-- 谱面信息 -->
        <div class="glass-dark rounded-xl p-4 text-center">
          <div class="text-lg font-bold mb-2">{{ chartData.name }}</div>
          <div class="text-white/60 text-sm">{{ t('chartDownload.idLabel') }}: #{{ chartData.id }}</div>
        </div>

        <!-- 下载选项 -->
        <div class="space-y-3">
          <button
            class="w-full px-6 py-4 rounded-xl glass hover:bg-white/10 text-left transition-all flex items-center justify-between group"
            @click="download('image')"
          >
            <div>
              <div class="font-bold mb-1">{{ t('chartDownload.downloadImage') }}</div>
              <div class="text-white/60 text-sm">{{ t('chartDownload.pngFormat') }}</div>
            </div>
            <svg class="w-6 h-6 text-white/60 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <button
            class="w-full px-6 py-4 rounded-xl glass hover:bg-white/10 text-left transition-all flex items-center justify-between group"
            @click="download('audio')"
          >
            <div>
              <div class="font-bold mb-1">{{ t('chartDownload.downloadAudio') }}</div>
              <div class="text-white/60 text-sm">{{ t('chartDownload.mp3Format') }}</div>
            </div>
            <svg class="w-6 h-6 text-white/60 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <button
            class="w-full px-6 py-4 rounded-xl glass hover:bg-white/10 text-left transition-all flex items-center justify-between group"
            @click="download('chart')"
          >
            <div>
              <div class="font-bold mb-1">{{ t('chartDownload.downloadChart') }}</div>
              <div class="text-white/60 text-sm">{{ t('chartDownload.zipFormat') }}</div>
            </div>
            <svg class="w-6 h-6 text-white/60 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>

        <!-- 提示 -->
        <div class="text-center text-white/40 text-xs mt-4">
          {{ t('chartDownload.tip') }}
        </div>
      </div>
    </div>
  </Window>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { eventBus } from '@/utils/eventBus'
import { useI18nStore } from '@/stores/i18n'
import { showSuccess } from '@/utils/message'
import Window from './Window.vue'

const { t } = useI18nStore()

interface ChartData {
  id: number
  name: string
  image_url?: string
  audio_url?: string
  file_url?: string
}

const isOpen = ref(false)
const chartData = ref<ChartData | null>(null)

function openWindow(data: ChartData) {
  chartData.value = data
  isOpen.value = true
}

async function download(type: 'image' | 'audio' | 'chart') {
  if (!chartData.value) return

  let url = ''
  let extension = ''

  switch (type) {
    case 'image':
      url = chartData.value.image_url || ''
      extension = '.png'
      break
    case 'audio':
      url = chartData.value.audio_url || ''
      extension = '.mp3'
      break
    case 'chart':
      url = chartData.value.file_url || ''
      extension = '.zip'
      break
  }

  if (!url) {
    showSuccess(t('common.hint') || '提示', t('chartDownload.hint'))
    return
  }

  // 清理文件名：移除非法字符，替换空格为下划线
  const cleanName = chartData.value.name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_')
  const filename = `${cleanName}${extension}`

  try {
    
    // 直接在新窗口打开下载链接，让浏览器处理下载
    window.open(url, '_blank')
    
    showSuccess(t('chartDownload.downloadSuccess'), `${filename} ${t('chartDownload.downloadSuccessMsg')}`)
  } catch (error) {
    console.error(t('chartDownload.downloadFailed'), error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    showSuccess(t('chartDownload.downloadFailed'), `${filename} ${t('chartDownload.downloadFailedMsg')}: ${errorMessage}`)
  }
}

function handleOpenDownload(data: ChartData) {
  openWindow(data)
}

onMounted(() => {
  eventBus.on('open-chart-download', handleOpenDownload)
})

onUnmounted(() => {
  eventBus.off('open-chart-download', handleOpenDownload)
})
</script>
