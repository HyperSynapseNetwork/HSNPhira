<template>
  <div class="container mx-auto px-4 py-24">
    <!-- 服务器状态 -->
    <div class="mb-6">
      <ServerStatus />
    </div>

    <!-- 时间范围选择 - 带高亮指示 -->
    <div class="mb-6 flex justify-center gap-2 md:gap-4 flex-wrap">
      <button
        v-for="range in timeRanges"
        :key="range.value"
        class="px-4 py-2 rounded-xl glass transition-all text-white text-sm md:text-base"
        :class="selectedRange === range.value ? 'bg-primary/50 ring-2 ring-primary shadow-lg scale-105' : 'hover:bg-white/10'"
        @click="selectRange(range.value)"
      >
        {{ range.label }}
      </button>
    </div>

    <!-- 搜索框 -->
    <div class="mb-6 max-w-md mx-auto">
      <div class="glass rounded-2xl p-4 flex gap-2">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('chartRanking.searchPlaceholder')"
          class="flex-1 bg-transparent text-white outline-none placeholder-white/40"
          @input="handleSearch"
        />
        <button
          v-if="searchQuery"
          @click="clearSearch"
          class="text-white/60 hover:text-white transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 排行榜表格 -->
    <Table
      :columns="columns"
      :data="displayCharts"
      :pagination="pagination"
      @page-change="handlePageChange"
    >
      <!-- 名次 -->
      <template #cell-rank="{ row }">
        <div class="flex items-center gap-2">
          <span
            v-if="row.rank <= 3"
            class="text-2xl"
          >
            {{ row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉' }}
          </span>
          <span class="text-white font-bold">#{{ row.rank }}</span>
        </div>
      </template>

      <!-- 谱面名称 -->
      <template #cell-chart_name="{ row }">
        <button
          class="px-3 py-1 rounded-full glass hover:bg-white/10 text-white text-sm transition-all"
          @click="openChartWindow(row.chart_id)"
        >
          {{ row.chart_name }}
        </button>
      </template>

      <!-- 谱面ID -->
      <template #cell-chart_id="{ row }">
        <button
          class="px-3 py-1 rounded-full glass hover:bg-white/10 text-white text-sm transition-all font-mono"
          @click="copyChartId(row.chart_id)"
        >
          #{{ row.chart_id }}
        </button>
      </template>

      <!-- 曲绘 -->
      <template #cell-image="{ row }">
        <button
          v-if="row.chart_image"
          @click="viewImage(row.chart_image)"
          class="block"
        >
          <img
            :src="row.chart_image"
            alt="Chart"
            class="w-16 h-16 object-cover rounded-lg cursor-pointer hover:scale-110 transition-transform"
          />
        </button>
        <span v-else class="text-white/40">-</span>
      </template>

      <!-- 游玩次数 -->
      <template #cell-play_count="{ row }">
        <span class="text-white">{{ row.increase || 0 }}</span>
      </template>
    </Table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18nStore } from '@/stores/i18n'
import { chartsAPI } from '@/api/charts'
import { eventBus } from '@/utils/eventBus'
import { copyToClipboard } from '@/utils/message'
import ServerStatus from '@/components/ServerStatus.vue'
import Table from '@/components/common/Table.vue'

const { t } = useI18nStore()

interface ChartRank {
  chart_id: number
  chart_name: string
  chart_image?: string
  increase: number
  last_count: number
}

const columns = [
  { key: 'rank', label: t('chartRanking.rank') },
  { key: 'chart_name', label: t('chartRanking.chartName') },
  { key: 'chart_id', label: t('chartRanking.chartId') },
  { key: 'image', label: t('chartRanking.image') },
  { key: 'play_count', label: t('chartRanking.playCount') },
]

const timeRanges = [
  { value: 'hour', label: t('chartRanking.hour') },
  { value: 'day', label: t('chartRanking.day') },
  { value: 'week', label: t('chartRanking.week') },
  { value: 'month', label: t('chartRanking.month') },
]

const selectedRange = ref('day')
const charts = ref<ChartRank[]>([])
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = 20

// 搜索过滤
const filteredCharts = computed(() => {
  if (!searchQuery.value.trim()) {
    return charts.value
  }
  
  const query = searchQuery.value.toLowerCase()
  return charts.value.filter(chart => {
    return (
      chart.chart_name.toLowerCase().includes(query) ||
      chart.chart_id.toString().includes(query)
    )
  })
})

// 分页显示
const displayCharts = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredCharts.value.slice(start, end).map((chart, index) => ({
    ...chart,
    rank: start + index + 1
  }))
})

// 分页信息
const pagination = computed(() => ({
  current: currentPage.value,
  totalPages: Math.ceil(filteredCharts.value.length / pageSize),
  total: filteredCharts.value.length
}))

async function loadData() {
  try {
    const data = await chartsAPI.getHotRank(selectedRange.value, currentPage.value, pageSize)
    if (Array.isArray(data)) {
      charts.value = data
    }
  } catch (error) {
    console.error('Failed to load chart ranking:', error)
    charts.value = []
  }
}

function selectRange(range: string) {
  selectedRange.value = range
  currentPage.value = 1
  searchQuery.value = ''
  loadData()
}

function handlePageChange(page: number) {
  currentPage.value = page
}

function handleSearch() {
  currentPage.value = 1
}

function clearSearch() {
  searchQuery.value = ''
  currentPage.value = 1
}

function openChartWindow(chartId: number) {
  eventBus.emit('open-chart', chartId)
}

function copyChartId(chartId: number) {
  copyToClipboard(`#${chartId}`, '谱面ID已复制')
}

function viewImage(imageUrl: string) {
  if (imageUrl) {
    eventBus.emit('open-lightbox', { url: imageUrl, alt: '谱面曲绘' })
  }
}

onMounted(() => {
  loadData()
})
</script>
