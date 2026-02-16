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

          <!-- 谱面热度信息 -->
          <div v-if="chartRankInfo" class="glass rounded-2xl p-4">
            <h3 class="text-white font-bold mb-3">谱面热度</h3>
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <!-- 小时热度 -->
                <div v-if="chartRankInfo.ranks.hour" class="glass-dark rounded-xl p-3">
                  <div class="text-white/60 text-xs mb-1">最近1小时</div>
                  <div class="text-white font-bold text-lg">
                    <span class="text-green-400">+{{ chartRankInfo.ranks.hour.increase }}</span>
                  </div>
                  <div class="text-white/80 text-sm mt-1">
                    排名: <span class="font-bold">#{{ chartRankInfo.ranks.hour.rank }}</span>
                  </div>
                </div>

                <!-- 日热度 -->
                <div v-if="chartRankInfo.ranks.day" class="glass-dark rounded-xl p-3">
                  <div class="text-white/60 text-xs mb-1">最近1天</div>
                  <div class="text-white font-bold text-lg">
                    <span class="text-yellow-400">+{{ chartRankInfo.ranks.day.increase }}</span>
                  </div>
                  <div class="text-white/80 text-sm mt-1">
                    排名: <span class="font-bold">#{{ chartRankInfo.ranks.day.rank }}</span>
                  </div>
                </div>

                <!-- 周热度 -->
                <div v-if="chartRankInfo.ranks.week" class="glass-dark rounded-xl p-3">
                  <div class="text-white/60 text-xs mb-1">最近1周</div>
                  <div class="text-white font-bold text-lg">
                    <span class="text-blue-400">+{{ chartRankInfo.ranks.week.increase }}</span>
                  </div>
                  <div class="text-white/80 text-sm mt-1">
                    排名: <span class="font-bold">#{{ chartRankInfo.ranks.week.rank }}</span>
                  </div>
                </div>

                <!-- 月热度 -->
                <div v-if="chartRankInfo.ranks.month" class="glass-dark rounded-xl p-3">
                  <div class="text-white/60 text-xs mb-1">最近1月</div>
                  <div class="text-white font-bold text-lg">
                    <span class="text-purple-400">+{{ chartRankInfo.ranks.month.increase }}</span>
                  </div>
                  <div class="text-white/80 text-sm mt-1">
                    排名: <span class="font-bold">#{{ chartRankInfo.ranks.month.rank }}</span>
                  </div>
                </div>
              </div>
              
              <div v-if="chartRankInfo.ranks.day" class="text-white/60 text-xs">
                数据更新时间: {{ formatDate(chartRankInfo.ranks.day.last_updated) }}
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
                    <th class="px-2 py-2 text-right">{{ t('chart.good') }}</th>
                    <th class="px-2 py-2 text-right">{{ t('chart.bad') }}</th>
                    <th class="px-2 py-2 text-right">{{ t('chart.miss') }}</th>
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
                    <td class="px-2 py-2 text-right text-yellow-400">
                      {{ record.good || 0 }}
                    </td>
                    <td class="px-2 py-2 text-right text-orange-400">
                      {{ record.bad || 0 }}
                    </td>
                    <td class="px-2 py-2 text-right text-red-400">
                      {{ record.miss || 0 }}
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
            <div v-if="recordsTotalPages > 1" class="flex flex-col items-center mt-4 pt-4 border-t border-white/20">
              <div class="text-white/60 text-sm mb-2">
                {{ t('chart.pageInfo', { page: recordsPage, totalPages: recordsTotalPages, total: recordsTotal }) }}
              </div>
              <div class="flex items-center justify-center gap-4">
                <button
                  class="px-4 py-2 rounded-lg glass hover:bg-white/10 text-white text-sm transition-all disabled:opacity-30"
                  :disabled="recordsPage === 1"
                  @click="loadRecords(1)"
                >
                  {{ t('chart.firstPage') }}
                </button>
                <button
                  class="px-4 py-2 rounded-lg glass hover:bg-white/10 text-white text-sm transition-all disabled:opacity-30"
                  :disabled="recordsPage >= recordsTotalPages"
                  @click="loadMoreRecords"
                >
                  {{ recordsLoading ? t('common.loading') : t('chart.loadMore') }}
                </button>
              </div>
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

// 谱面排名信息接口
interface ChartRankInfo {
  chart_id: number
  ranks: {
    hour?: {
      increase: number
      rank: number
      last_updated: string
    }
    day?: {
      increase: number
      rank: number
      last_updated: string
    }
    week?: {
      increase: number
      rank: number
      last_updated: string
    }
    month?: {
      increase: number
      rank: number
      last_updated: string
    }
  }
}

const isOpen = ref(false)
const loading = ref(false)
const chartId = ref(0)
const chartData = ref<ChartData | null>(null)
const records = ref<ScoreRecord[]>([])
const chartRankInfo = ref<ChartRankInfo | null>(null)
const recordsPage = ref(1)
const recordsPerPage = 20
const recordsTotal = ref(0)
const recordsLoading = ref(false)

const recordsTotalPages = computed(() =>
  Math.ceil(recordsTotal.value / recordsPerPage)
)

const currentPageRecords = computed(() => {
  return records.value
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
  chartRankInfo.value = null

  try {
    // 并行加载谱面详情、排名信息和第一页成绩记录（每页20条）
    const [chartDetail, rankInfo, recordsData] = await Promise.all([
      chartsAPI.getChartDetail(id),
      chartsAPI.getChartRankDetail(id).catch(error => {
        console.warn('Failed to load chart rank info:', error)
        return null
      }),
      chartsAPI.getChartRecords(id, 1, recordsPerPage)
    ])

    chartData.value = chartDetail
    records.value = recordsData.results || []
    recordsTotal.value = recordsData.count || 0

    if (rankInfo) {
      chartRankInfo.value = rankInfo
    }
  } catch (error) {
    console.error('Failed to load chart:', error)
    chartData.value = null
  } finally {
    loading.value = false
  }
}

// 加载成绩记录
async function loadRecords(page: number = recordsPage.value) {
  if (recordsLoading.value) {
    return
  }

  recordsLoading.value = true

  try {
    const recordsData = await chartsAPI.getChartRecords(chartId.value, page, recordsPerPage)
    
    if (page === 1) {
      // 如果是第一页，替换现有记录
      records.value = recordsData.results || []
    } else {
      // 如果是其他页，追加记录
      records.value = [...records.value, ...(recordsData.results || [])]
    }
    
    recordsPage.value = page
  } catch (error) {
    console.error('Failed to load records:', error)
  } finally {
    recordsLoading.value = false
  }
}

// 加载更多成绩记录
async function loadMoreRecords() {
  if (recordsPage.value >= recordsTotalPages.value) {
    return
  }
  await loadRecords(recordsPage.value + 1)
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

// 格式化日期时间
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (error) {
    return dateString
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
