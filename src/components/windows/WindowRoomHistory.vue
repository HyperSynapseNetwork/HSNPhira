<template>
  <Window v-model="isOpen" width="90vw" height="85vh">
    <div class="text-white h-full flex flex-col">
      <h2 class="text-2xl font-bold mb-6 text-center">游玩历史</h2>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="flex-1 flex flex-col items-center justify-center">
        <div class="glass rounded-2xl p-12 inline-block">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <div class="text-white/60 text-lg">正在加载游玩历史...</div>
        </div>
      </div>

      <!-- 历史记录列表 -->
      <div v-else class="flex-1 overflow-y-auto space-y-4">
        <div
          v-for="(record, index) in records"
          :key="index"
          class="glass rounded-2xl p-6"
        >
          <!-- 谱面信息 -->
          <div class="glass-dark rounded-xl p-4 mb-4 flex items-center gap-4">
            <!-- 曲绘 -->
            <img
              v-if="record.chart_image"
              :src="record.chart_image"
              class="w-20 h-20 rounded-lg object-cover"
              :alt="record.chart_name"
            />

            <div class="flex-1">
              <!-- 谱面名 - 可点击 -->
              <button
                class="text-xl font-bold text-white hover:text-primary transition-colors mb-2"
                @click="openChart(record.chart_id)"
              >
                {{ record.chart_name }}
              </button>

              <!-- 谱面ID - 可复制 -->
              <button
                class="text-white/60 text-sm hover:text-white transition-colors"
                @click="copyChartId(record.chart_id)"
              >
                ID: #{{ record.chart_id }}
              </button>

              <!-- 时间 -->
              <div class="text-white/40 text-xs mt-2">
                {{ formatTime(record.played_at) }}
              </div>
            </div>
          </div>

          <!-- 成绩卡片 - 每行2个 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="(score, scoreIndex) in record.scores"
              :key="scoreIndex"
              class="glass-dark rounded-xl p-4 transition-all"
              :class="{ 'ring-2 ring-yellow-500 shadow-lg shadow-yellow-500/50': score.is_top_score }"
            >
              <!-- 玩家信息 -->
              <button
                class="flex items-center gap-3 mb-3 w-full text-left hover:opacity-80 transition-opacity"
                @click="openPlayerPage(score.player_id)"
              >
                <img
                  v-if="score.player_avatar"
                  :src="score.player_avatar"
                  class="w-10 h-10 rounded-full"
                  :alt="score.player_name"
                />
                <div v-else class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <span class="text-white/60 text-xs">{{ score.player_name.charAt(0) }}</span>
                </div>
                <div class="font-bold text-white">{{ score.player_name }}</div>
              </button>

              <!-- 成绩详情 -->
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-white/60">分数</span>
                  <span class="text-white font-mono font-bold">{{ score.score.toLocaleString() }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/60">准度</span>
                  <span class="text-white">{{ (score.accuracy * 100).toFixed(2) }}%</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/60">Perfect</span>
                  <span class="text-green-400">{{ score.perfect }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/60">Good</span>
                  <span class="text-blue-400">{{ score.good }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/60">Bad</span>
                  <span class="text-yellow-400">{{ score.bad }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/60">Miss</span>
                  <span class="text-red-400">{{ score.miss }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="records.length === 0 && !isLoading" class="text-center text-white/40 py-12">
          暂无游玩历史
        </div>
      </div>
    </div>
  </Window>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { eventBus } from '@/utils/eventBus'
import { copyToClipboard } from '@/utils/message'
import Window from './Window.vue'

interface RawScore {
  player: number
  score: number
  accuracy: number
  perfect: number
  good: number
  bad: number
  miss: number
  max_combo: number
  full_combo: boolean
  std: number
  std_score: number
}

interface RawRound {
  chart: number
  records: RawScore[]
}

interface Score {
  player_id: number
  player_name: string
  player_avatar?: string
  score: number
  accuracy: number
  perfect: number
  good: number
  bad: number
  miss: number
  is_top_score: boolean
}

interface HistoryRecord {
  chart_id: number
  chart_name: string
  chart_image?: string
  played_at: string
  scores: Score[]
}

const isOpen = ref(false)
const roomId = ref<string>('')
const rawRounds = ref<RawRound[]>([])
const records = ref<HistoryRecord[]>([])
const isLoading = ref(false)

// 谱面信息缓存
const chartCache = ref<Map<number, {name: string, image?: string}>>(new Map())
// 用户信息缓存
const userCache = ref<Map<number, {name: string, avatar?: string}>>(new Map())

async function openWindow(id: string, rounds: RawRound[]) {
  roomId.value = id
  rawRounds.value = rounds
  records.value = [] // 先清空
  isLoading.value = true
  isOpen.value = true
  
  // 开始加载详细数据
  await loadDetailedData(rounds)
  isLoading.value = false
}

async function loadDetailedData(rounds: RawRound[]) {
  const detailedRecords: HistoryRecord[] = []
  
  // 为每个round获取详细信息
  for (const round of rounds) {
    const chartId = round.chart
    const records = round.records || []
    
    // 找出最高分
    const maxScore = records.length > 0 ? Math.max(...records.map(r => r.score || 0)) : 0
    
    // 获取谱面信息
    let chartName = `谱面${chartId}`
    let chartImage: string | undefined = undefined
    
    if (chartId > 0) {
      try {
        const chartInfo = await getChartInfo(chartId)
        chartName = chartInfo.name
        chartImage = chartInfo.image
      } catch (error) {
        console.error(`Failed to load chart info for ${chartId}:`, error)
      }
    }
    
    // 获取用户信息并构建scores数组
    const scoresPromises = records.map(async (record) => {
      let playerName = `玩家${record.player}`
      let playerAvatar: string | undefined = undefined
      
      if (record.player > 0) {
        try {
          const userInfo = await getUserInfo(record.player)
          playerName = userInfo.name
          playerAvatar = userInfo.avatar
        } catch (error) {
          console.error(`Failed to load user info for ${record.player}:`, error)
        }
      }
      
      return {
        player_id: record.player || 0,
        player_name: playerName,
        player_avatar: playerAvatar,
        score: record.score || 0,
        accuracy: record.accuracy || 0,
        perfect: record.perfect || 0,
        good: record.good || 0,
        bad: record.bad || 0,
        miss: record.miss || 0,
        is_top_score: (record.score || 0) === maxScore && maxScore > 0
      } as Score
    })
    
    const scores = await Promise.all(scoresPromises)
    
    // 对于时间，我们使用一个模拟的时间戳（因为原始数据可能没有时间信息）
    // 越早的round越早的时间
    const playedAt = new Date(Date.now() - (rounds.indexOf(round) * 60000)).toISOString()
    
    detailedRecords.push({
      chart_id: chartId,
      chart_name: chartName,
      chart_image: chartImage,
      played_at: playedAt,
      scores
    })
  }
  
  records.value = detailedRecords
}

async function getChartInfo(chartId: number): Promise<{name: string, image?: string}> {
  // 检查缓存
  if (chartCache.value.has(chartId)) {
    return chartCache.value.get(chartId)!
  }
  
  try {
    const response = await fetch(`https://phira.5wyxi.com/chart/${chartId}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch chart info: ${response.status}`)
    }
    
    const data = await response.json()
    const chartInfo = {
      name: data.name || `谱面${chartId}`,
      image: data.illustration || undefined
    }
    
    // 缓存结果
    chartCache.value.set(chartId, chartInfo)
    return chartInfo
  } catch (error) {
    console.error(`Error fetching chart ${chartId}:`, error)
    return {
      name: `谱面${chartId}`,
      image: undefined
    }
  }
}

async function getUserInfo(userId: number): Promise<{name: string, avatar?: string}> {
  // 检查缓存
  if (userCache.value.has(userId)) {
    return userCache.value.get(userId)!
  }
  
  try {
    const response = await fetch(`https://phira.5wyxi.com/user/${userId}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`)
    }
    
    const data = await response.json()
    const userInfo = {
      name: data.name || `玩家${userId}`,
      avatar: data.avatar || undefined
    }
    
    // 缓存结果
    userCache.value.set(userId, userInfo)
    return userInfo
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error)
    return {
      name: `玩家${userId}`,
      avatar: undefined
    }
  }
}

function openChart(chartId: number) {
  eventBus.emit('open-chart', chartId)
}

function openPlayerPage(playerId: number) {
  window.open(`https://phira.moe/user/${playerId}`, '_blank')
}

function copyChartId(chartId: number) {
  copyToClipboard(`#${chartId}`, '谱面ID已复制')
}

function formatTime(timeStr: string): string {
  try {
    const time = new Date(timeStr)
    if (isNaN(time.getTime())) {
      return '时间未知'
    }
    
    const now = new Date()
    const diff = now.getTime() - time.getTime()

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (days > 0) return `${days}天前`
    if (hours > 0) return `${hours}小时前`
    if (minutes > 0) return `${minutes}分钟前`
    return '刚刚'
  } catch {
    return '时间未知'
  }
}

function handleViewHistory(id: string, history: RawRound[]) {
  openWindow(id, history)
}

onMounted(() => {
  eventBus.on('view-history', handleViewHistory)
})

onUnmounted(() => {
  eventBus.off('view-history', handleViewHistory)
})
</script>
