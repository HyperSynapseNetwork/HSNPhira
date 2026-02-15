<template>
  <Window v-model="isOpen" width="90vw" height="85vh">
    <div v-if="loading" class="flex items-center justify-center h-full">
      <div class="text-white">{{ t('common.loading') }}</div>
    </div>

    <div v-else-if="chartData" class="h-full flex flex-col gap-4">
      <!-- 标题 -->
      <h2 class="text-2xl font-bold text-white text-center">{{ t('chart.details') }}</h2>

      <!-- 主内容区 - 两列布局 -->
      <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
        <!-- 左列 -->
        <div class="flex flex-col gap-4 overflow-y-auto">
          <!-- 曲绘 -->
          <div class="glass rounded-2xl p-4">
            <h3 class="text-white font-bold mb-3">{{ t('chart.illustration') }}</h3>
            <img
              v-if="chartImageUrl"
              :src="chartImageUrl"
              alt="Chart Image"
              class="w-full rounded-xl cursor-pointer hover:scale-105 transition-transform"
              @click="viewLargeImage"
            />
            <div v-else class="text-white/40 text-center py-12">
              {{ t('chart.noIllustration') }}
            </div>
          </div>

          <!-- Terminal风格操作区 -->
          <div class="glass rounded-2xl p-4 font-mono text-sm">
            <div class="text-green-400 mb-2">$ HSNPhira Chart Manager v1.0</div>
            <div class="text-white/60 space-y-1">
              <div>> Chart loaded: #{{ chartId }}</div>
              <div>> Status: Ready</div>
              <div>> Available operations:</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                class="px-4 py-2 rounded-lg glass hover:bg-white/10 text-white text-sm transition-all"
                @click="openPhiraPage"
              >
                {{ t('chart.openPhira') }}
              </button>
              <button
                class="px-4 py-2 rounded-lg glass hover:bg-white/10 text-white text-sm transition-all"
                @click="copyChartId"
              >
                {{ t('chart.copyId') }}
              </button>
              <button
                class="px-4 py-2 rounded-lg glass hover:bg-white/10 text-white text-sm transition-all"
                @click="showDownloadMenu"
              >
                {{ t('chart.download') }}
              </button>
            </div>
          </div>
        </div>

        <!-- 右列 -->
        <div class="flex flex-col gap-4 overflow-y-auto">
          <!-- 谱面信息 -->
          <div class="glass rounded-2xl p-4">
            <h3 class="text-white font-bold mb-3">{{ t('chart.info') }}</h3>
            <div class="space-y-3">
              <div class="glass-dark rounded-xl p-3">
                <div class="text-white/60 text-xs mb-1">{{ t('chart.name') }}</div>
                <div class="text-white font-bold">{{ chartData.name }}</div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="glass-dark rounded-xl p-3">
                  <div class="text-white/60 text-xs mb-1">{{ t('chart.id') }}</div>
                  <div class="text-white font-mono">#{{ chartData.id }}</div>
                </div>

                <div class="glass-dark rounded-xl p-3">
                  <div class="text-white/60 text-xs mb-1">{{ t('chart.difficulty') }}</div>
                  <div class="text-white font-bold">
                    {{ chartData.difficulty ? chartData.difficulty.toFixed(1) : 'N/A' }}
                  </div>
                </div>
              </div>

              <div class="glass-dark rounded-xl p-3">
                <div class="text-white/60 text-xs mb-1">{{ t('chart.charter') }}</div>
                <button
                  v-if="charterName || chartData.charter_id"
                  class="text-white hover:text-primary transition-colors"
                  @click="openCharterPage"
                >
                  {{ charterName || `Charter ${chartData.charter_id}` }}
                </button>
                <div v-else class="text-white/40">{{ t('chart.unknown') }}</div>
              </div>

              <div class="glass-dark rounded-xl p-3">
                <div class="text-white/60 text-xs mb-1">{{ t('chart.description') }}</div>
                <div class="text-white text-sm max-h-24 overflow-y-auto break-words">
                  {{ chartData.description || t('chart.noDescription') }}
                </div>
              </div>
            </div>
          </div>

          <!-- 成绩排行榜 -->
          <div class="glass rounded-2xl p-4 flex-1 flex flex-col min-h-0">
            <h3 class="text-white font-bold mb-3">{{ t('chart.rankings') }}</h3>
            <div class="flex-1 overflow-y-auto">
              <table class="w-full text-sm text-white/80">
                <thead class="sticky top-0 bg-black/50 border-b border-white/20 text-white/60">
                  <tr>
                    <th class="px-2 py-2 text-left">{{ t('chart.rank') }}</th>
                    <th class="px-2 py-2 text-left">{{ t('chart.player') }}</th>
                    <th class="px-2 py-2 text-right">{{ t('chart.score') }}</th>
                    <th class="px-2 py-2 text-right">{{ t('chart.accuracy') }}</th>
                    <th class="px-2 py-2 text-right">{{ t('chart.perfect') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="(record, index) in currentPageRecords" 
                    :key="index"
                    class="border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <td class="px-2 py-2">
                      <span class="font-bold">#{{ (recordsPage - 1) * recordsPerPage + index + 1 }}</span>
                    </td>
                    <td class="px-2 py-2">
                      <button
                        class="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        @click="openPlayerPage(record.player_id)"
                      >
                        <img
                          v-if="record.player_avatar"
                          :src="record.player_avatar"
                          class="w-6 h-6 rounded-full"
                          :alt="record.player_name"
                        />
                        <span class="text-white">{{ record.player_name }}</span>
                      </button>
                    </td>
                    <td class="px-2 py-2 text-right font-mono font-bold">
                      {{ record.score ? record.score.toLocaleString() : 0 }}
                    </td>
                    <td class="px-2 py-2 text-right">
                      {{ record.accuracy ? (record.accuracy * 100).toFixed(4) : '0.0000' }}%
                    </td>
                    <td class="px-2 py-2 text-right text-green-400">
                      {{ record.perfect || 0 }}
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- 空状态 -->
              <div v-if="records.length === 0" class="text-center text-white/40 py-8">
                {{ t('chart.noRecords') }}
              </div>
            </div>

            <!-- 排行榜翻页 -->
            <div v-if="recordsTotalPages > 1" class="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
              <button
                class="px-3 py-1 rounded-lg glass hover:bg-white/10 text-white text-sm transition-all disabled:opacity-30"
                :disabled="recordsPage === 1"
                @click="recordsPage--"
              >
                {{ t('chart.previous') }}
              </button>
              <span class="text-white/80 text-sm">
                {{ recordsPage }} / {{ recordsTotalPages }}
              </span>
              <button
                class="px-3 py-1 rounded-lg glass hover:bg-white/10 text-white text-sm transition-all disabled:opacity-30"
                :disabled="recordsPage === recordsTotalPages"
                @click="recordsPage++"
              >
                {{ t('chart.next') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex items-center justify-center h-full">
      <div class="text-white/60">{{ t('chart.loadFailed') }}</div>
    </div>
  </Window>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18nStore } from '@/stores/i18n'
import { chartsAPI } from '@/api/charts'
import { eventBus } from '@/utils/eventBus'
import { copyToClipboard } from '@/utils/message'
import Window from './Window.vue'

const { t } = useI18nStore()

interface ChartData {
  id: number
  name: string
  difficulty?: number
  charter_name?: string
  charter_id?: number
  description?: string
  image_url?: string
  audio_url?: string
  file_url?: string
  // 兼容外部API可能使用的字段名
  illustration?: string
  cover_url?: string
  charter?: string
  composer?: string
}

interface ScoreRecord {
  player_id: number
  player_name: string
  player_avatar?: string
  score: number
  accuracy: number
  perfect: number
  good: number
  bad: number
  miss: number
}

const isOpen = ref(false)
const loading = ref(false)
const chartId = ref(0)
const chartData = ref<ChartData | null>(null)
const records = ref<ScoreRecord[]>([])
const recordsPage = ref(1)
const recordsPerPage = 20

const recordsTotalPages = computed(() => 
  Math.ceil(records.value.length / recordsPerPage)
)

const currentPageRecords = computed(() => {
  const start = (recordsPage.value - 1) * recordsPerPage
  const end = start + recordsPerPage
  return records.value.slice(start, end)
})

const chartImageUrl = computed(() => {
  if (!chartData.value) return ''
  return chartData.value.image_url || chartData.value.illustration || chartData.value.cover_url || ''
})

const charterName = computed(() => {
  if (!chartData.value) return ''
  return chartData.value.charter_name || chartData.value.charter || chartData.value.composer || ''
})

async function openWindow(id: number) {
  chartId.value = id
  isOpen.value = true
  loading.value = true

  try {
    // 加载谱面详情
    chartData.value = await chartsAPI.getChartDetail(id)

    // 加载第一页成绩记录，每页30条
    const recordsData = await chartsAPI.getChartRecords(id, 1, 30)
    records.value = recordsData.results || []
  } catch (error) {
    console.error('Failed to load chart:', error)
    chartData.value = null
  } finally {
    loading.value = false
  }
}

function copyChartId() {
  copyToClipboard(`#${chartId.value}`, '谱面ID已复制')
}

function openPhiraPage() {
  window.open(`https://phira.moe/chart/${chartId.value}`, '_blank')
}

function openCharterPage() {
  if (chartData.value?.charter_id) {
    window.open(`https://phira.moe/user/${chartData.value.charter_id}`, '_blank')
  }
}

function openPlayerPage(playerId: number) {
  window.open(`https://phira.moe/user/${playerId}`, '_blank')
}

function viewLargeImage() {
  if (chartImageUrl.value) {
    eventBus.emit('open-lightbox', {
      url: chartImageUrl.value,
      alt: chartData.value?.name || '谱面曲绘'
    })
  }
}

function showDownloadMenu() {
  if (chartData.value) {
    eventBus.emit('open-chart-download', {
      id: chartId.value,
      name: chartData.value.name,
      image_url: chartData.value.image_url,
      audio_url: chartData.value.audio_url,
      file_url: chartData.value.file_url
    })
  }
}

function handleOpenChart(id: number) {
  openWindow(id)
}

onMounted(() => {
  eventBus.on('open-chart', handleOpenChart)
})

onUnmounted(() => {
  eventBus.off('open-chart', handleOpenChart)
})
</script>
