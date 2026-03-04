<template>
  <div class="container mx-auto px-4 py-24">
    <!-- 服务器状态 -->
    <div class="mb-6">
      <ServerStatus />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="text-center py-12">
      <div class="glass rounded-2xl p-12 inline-block">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <div class="text-white/60 text-lg">{{ t('rooms.loading') }}</div>
      </div>
    </div>

    <!-- 房间列表表格 -->
    <div v-else-if="rooms.length > 0">
      <Table
        :columns="columns"
        :data="formattedRooms"
        :pagination="pagination"
        @page-change="handlePageChange"
      >
        <!-- 房主 -->
        <template #cell-owner="{ row }">
          <button
            v-if="row.ownerData"
            class="px-3 py-1 rounded-full glass hover:bg-white/10 text-white text-sm transition-all"
            @click="openPhiraPage(row.ownerData.phira_id)"
          >
            {{ row.ownerData.username }}
          </button>
          <span v-else class="text-white/40">-</span>
        </template>

        <!-- 人数 -->
        <template #cell-players="{ row }">
          <span class="text-white">{{ row.playerCount }}/{{ row.maxPlayers }}</span>
        </template>

        <!-- 状态 -->
        <template #cell-status="{ row }">
          <span class="text-white">{{ row.status }}</span>
        </template>

        <!-- 循环 -->
        <template #cell-is_cycling="{ row }">
          <span class="text-white">{{ row.isCycling ? t('common.yes') : t('common.no') }}</span>
        </template>

        <!-- 谱面 -->
        <template #cell-chart="{ row }">
          <button
            v-if="row.chartData"
            class="px-3 py-1 rounded-full glass hover:bg-white/10 text-white text-sm transition-all"
            @click="openChartWindow(row.chartData.id)"
          >
            {{ row.chartData.name }}
          </button>
          <span v-else class="text-white/40">{{ t('rooms.noChart') }}</span>
        </template>

        <!-- 曲绘 -->
        <template #cell-image="{ row }">
          <button
            v-if="row.chartData && row.chartData.image"
            @click="viewImage(row.chartData.image)"
            class="block"
          >
            <img
              :src="row.chartData.image"
              alt="Chart"
              class="w-16 h-16 object-cover rounded-lg cursor-pointer hover:scale-110 transition-transform"
            />
          </button>
          <span v-else class="text-white/40">-</span>
        </template>

        <!-- 下载 -->
        <template #cell-download="{ row }">
          <div v-if="row.chartData && row.chartData.file">
            <button
              @click="openDownloadWindow(row.chartData)"
              class="px-3 py-1 rounded-full glass hover:bg-white/10 text-white text-sm transition-all"
            >
              {{ t('rooms.download') }}
            </button>
          </div>
          <span v-else class="text-white/40">-</span>
        </template>

        <!-- 人员 -->
        <template #cell-players_detail="{ row }">
          <button
            class="px-3 py-1 rounded-full glass hover:bg-white/10 text-white text-sm transition-all"
            @click="viewPlayers(row.rawData)"
          >
            {{ t('rooms.viewPlayers') }}
          </button>
        </template>

        <!-- 游玩历史 -->
        <template #cell-history="{ row }">
          <button
            class="px-3 py-1 rounded-full glass hover:bg-white/10 text-white text-sm transition-all"
            @click="viewHistory(row.rawData.id)"
          >
            {{ t('rooms.viewHistory') }}
          </button>
        </template>
      </Table>
    </div>

    <!-- 空状态 -->
    <div v-else class="text-center py-12">
      <div class="glass rounded-2xl p-12 inline-block">
        <svg class="w-16 h-16 mx-auto text-white/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <div class="text-white/60 text-lg">{{ t('rooms.noRooms') }}</div>
        <div class="text-white/40 text-sm mt-2">{{ t('rooms.noActiveRooms') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { eventBus } from '@/utils/eventBus'
import { useI18nStore } from '@/stores/i18n'
import { getBaseURL, getPhiraBaseURL } from '@/utils/config'
import ServerStatus from '@/components/ServerStatus.vue'
import Table from '@/components/common/Table.vue'
import type { Room } from '@/types'

// 缓存用户和谱面信息
const USER_CACHE = new Map<number, any>()
const CHART_CACHE = new Map<number, any>()

async function getUserInfo(userId: number) {
  if (USER_CACHE.has(userId)) {
    return USER_CACHE.get(userId)
  }

  try {
    const baseURL = getPhiraBaseURL()
    const res = await fetch(`${baseURL}/user/${userId}`)
    if (!res.ok) return null
    const data = await res.json()
    USER_CACHE.set(userId, data)
    return data
  } catch {
    return null
  }
}

async function getChartInfo(chartId: number) {
  if (CHART_CACHE.has(chartId)) {
    return CHART_CACHE.get(chartId)
  }

  try {
    const baseURL = getPhiraBaseURL()
    const res = await fetch(`${baseURL}/chart/${chartId}`)
    if (!res.ok) return null
    const data = await res.json()
    CHART_CACHE.set(chartId, data)
    return data
  } catch {
    return null
  }
}

const { t } = useI18nStore()

const columns = computed(() => [
  { key: 'name', label: t('rooms.name') },
  { key: 'owner', label: t('rooms.owner') },
  { key: 'players', label: t('rooms.players') },
  { key: 'status', label: t('rooms.status') },
  { key: 'is_cycling', label: t('rooms.is_cycling') },
  { key: 'chart', label: t('rooms.chart') },
  { key: 'image', label: t('rooms.image') },
  { key: 'download', label: t('rooms.download') },
  { key: 'players_detail', label: t('rooms.players_detail') },
  { key: 'history', label: t('rooms.history') },
])

const allRooms = ref<Room[]>([])
const rooms = ref<Room[]>([])
const loading = ref(false)
const pagination = ref({
  current: 1,
  totalPages: 1,
  total: 0,
  pageSize: 10,
})

// 打开下载窗口
function openDownloadWindow(chartData: any) {
  if (!chartData) return

  // 映射到WindowChartDownload组件期望的格式
  const downloadData = {
    id: chartData.id,
    name: chartData.name || chartData.title || `Chart ${chartData.id}`,
    image_url: chartData.illustration || chartData.image || chartData.image_url || chartData.cover_url,
    audio_url: chartData.preview || '', // 使用预览音频URL
    file_url: chartData.file
  }

  eventBus.emit('open-chart-download', downloadData)
}

// 格式化房间数据
const formattedRooms = computed(() => {
  return rooms.value.map(room => ({
    name: room.name || '-',
    ownerData: room.owner_id ? {
      username: room.owner || `User${room.owner_id}`,
      phira_id: room.owner_id
    } : null,
    playerCount: room.player_count ?? 0,
    maxPlayers: room.max_players ?? 100,
    status: room.status || '-',
    isCycling: room.is_cycling ?? false,
    chartData: room.chart_id ? {
      id: room.chart_id,
      name: room.chart_name || `Chart ${room.chart_id}`,
      image: room.chart_image,
      file: room.chart_file
    } : null,
    rawData: room
  }))
})

async function loadRooms(page = 1) {
  try {
    loading.value = true

    // 直接从API获取房间数据，参考HSNPhira实现
    const baseURL = getBaseURL()
    const response = await fetch(`${baseURL}/newapi/rooms/info`)
    if (!response.ok) throw new Error('获取房间信息失败')
    const roomsData = await response.json()

    if (!Array.isArray(roomsData) || roomsData.length === 0) {
      allRooms.value = []
      pagination.value.total = 0
      pagination.value.totalPages = 1
      pagination.value.current = page
      rooms.value = []
      return
    }

    const transformedRooms: Room[] = []

    // 收集所有需要获取的用户和谱面ID
    const userIdsToFetch = new Set<number>()
    const chartIdsToFetch = new Set<number>()

    for (const roomData of roomsData) {
      // 处理可能的data嵌套：如果roomData有data字段，使用data，否则使用roomData本身
      const roomInfo = roomData.data || roomData
      
      if (roomInfo.host) userIdsToFetch.add(roomInfo.host)
      if (roomInfo.chart) chartIdsToFetch.add(roomInfo.chart)
      if (Array.isArray(roomInfo.users)) {
        roomInfo.users.forEach((userId: number) => userIdsToFetch.add(userId))
      }
    }

    // 批量获取用户信息
    const userPromises = Array.from(userIdsToFetch).map(async (userId) => {
      try {
        const info = await getUserInfo(userId)
        return { userId, info }
      } catch {
        return { userId, info: null }
      }
    })

    // 批量获取谱面信息
    const chartPromises = Array.from(chartIdsToFetch).map(async (chartId) => {
      try {
        const info = await getChartInfo(chartId)
        return { chartId, info }
      } catch {
        return { chartId, info: null }
      }
    })

    const userResults = await Promise.all(userPromises)
    const chartResults = await Promise.all(chartPromises)

    // 转换为Map方便查找
    const userMap = new Map<number, any>()
    const chartMap = new Map<number, any>()

    userResults.forEach(({ userId, info }) => userMap.set(userId, info))
    chartResults.forEach(({ chartId, info }) => chartMap.set(chartId, info))

    // 处理每个房间
    for (const roomData of roomsData) {
      // 处理可能的data嵌套
      const roomInfo = roomData.data || roomData
      const roomName = roomData.name || roomInfo.name || `房间${transformedRooms.length + 1}`

      // 房主信息
      const ownerId = roomInfo.host
      let ownerName = `用户${ownerId || '未知'}`
      const ownerInfo = ownerId ? userMap.get(ownerId) : null
      if (ownerInfo) {
        ownerName = ownerInfo.name || ownerInfo.username || ownerName
      }

      // 谱面信息
      const chartId = roomInfo.chart
      let chartName = chartId ? `谱面${chartId}` : undefined
      let chartImage = undefined
      let chartFile = undefined
      const chartInfo = chartId ? chartMap.get(chartId) : null
      if (chartInfo) {
        chartName = chartInfo.name || chartInfo.title || chartName
        chartImage = chartInfo.illustration || chartInfo.image_url || chartInfo.cover_url
        chartFile = chartInfo.file
      }

      // 状态映射（使用i18n）
      const stateMap: Record<string, string> = {
        'SELECTING_CHART': t('rooms.state.selecting'),
        'WAITING_FOR_READY': t('rooms.state.waiting'),
        'PLAYING': t('rooms.state.playing')
      }
      const statusText = stateMap[roomInfo.state] || roomInfo.state || '-'

      // 玩家信息
      const playerIds = Array.isArray(roomInfo.users) ? roomInfo.users : []
      const players = playerIds.map((userId: number) => {
        const userInfo = userMap.get(userId)
        return {
          id: userId,
          username: userInfo?.name || userInfo?.username || `用户${userId}`,
          phira_id: userId,
          is_owner: userId === ownerId
        }
      })

      // 人数统计
      const playerCount = players.length
      const maxPlayers = 100 // 默认值

      // 循环状态（API字段为cycle，需求文档为is_cycling）
      const isCycling = roomInfo.cycle || false

      // 构建Room对象
      const room: Room = {
        id: roomName,
        name: roomName,
        owner: ownerName,
        owner_id: ownerId || 0,
        player_count: playerCount,
        max_players: maxPlayers,
        status: statusText,
        is_cycling: isCycling,
        chart_id: chartId,
        chart_name: chartName,
        chart_image: chartImage,
        chart_file: chartFile,
        players: players,
        history: roomInfo.rounds || []
      }

      transformedRooms.push(room)
    }

    allRooms.value = transformedRooms
    pagination.value.total = transformedRooms.length
    pagination.value.totalPages = Math.max(1, Math.ceil(transformedRooms.length / pagination.value.pageSize))
    pagination.value.current = page

    // 实现分页：从allRooms中提取当前页的数据
    const startIndex = (page - 1) * pagination.value.pageSize
    const endIndex = startIndex + pagination.value.pageSize
    rooms.value = allRooms.value.slice(startIndex, endIndex)

  } catch (error) {
    console.error('Failed to load rooms:', error)
    allRooms.value = []
    rooms.value = []
    pagination.value.total = 0
    pagination.value.totalPages = 1
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  loadRooms(page)
}

function openPhiraPage(phiraId: number) {
  if (phiraId) {
    window.open(`https://phira.moe/user/${phiraId}`, '_blank')
  }
}

function openChartWindow(chartId: number) {
  if (chartId) {
    eventBus.emit('open-chart', chartId)
  }
}

function viewImage(imageUrl: string) {
  if (imageUrl) {
    eventBus.emit('open-lightbox', { url: imageUrl, alt: '谱面曲绘' })
  }
}

function viewPlayers(room: Room) {
  eventBus.emit('view-players', room)
}

async function viewHistory(roomId: string) {
  try {
    // 从已加载的房间数据中获取历史（API没有独立的历史端点）
    const room = allRooms.value.find(r => r.id === roomId)
    const rawHistory = room?.history || []
    
    // 传递原始数据，让WindowRoomHistory组件自己获取详细信息
    // 注意：API返回的rounds数组可能是按时间顺序排列的，但我们需要确保最新的在最前
    // 假设API返回的顺序是最新的在最后，所以需要反转
    const reversedHistory = [...rawHistory].reverse()
    
    eventBus.emit('view-history', roomId, reversedHistory)
  } catch (error) {
    console.error('Failed to load room history:', error)
    eventBus.emit('view-history', roomId, [])
  }
}

const autoUpdateTimer = ref<NodeJS.Timeout | null>(null)
const eventSource = ref<EventSource | null>(null)

// 自动更新房间列表
function startAutoUpdate() {
  // 每30秒更新一次
  if (autoUpdateTimer.value) {
    clearInterval(autoUpdateTimer.value)
  }
  autoUpdateTimer.value = setInterval(() => {
    loadRooms(1) // 总是刷新第一页
  }, 30000)
}

// 增量更新辅助函数
function findRoomById(roomId: string | number): Room | undefined {
  return allRooms.value.find(room => room.id === roomId || room.id?.toString() === roomId.toString())
}

function updateRoomInList(roomId: string | number, updatedData: Partial<Room>) {
  const index = allRooms.value.findIndex(room => room.id === roomId || room.id?.toString() === roomId.toString())
  if (index !== -1) {
    // 保留原有数据的其他字段，只更新提供的字段
    allRooms.value[index] = { ...allRooms.value[index], ...updatedData }
    updatePaginatedRooms()
  } else {
  }
}

function addRoomToList(newRoom: Room) {
  // 检查是否已存在
  const existingIndex = allRooms.value.findIndex(room => room.id === newRoom.id)
  if (existingIndex === -1) {
    allRooms.value.unshift(newRoom) // 新房间添加到列表顶部
  } else {
    // 如果已存在，更新它
    allRooms.value[existingIndex] = newRoom
  }
  updatePaginatedRooms()
}

function removeRoomFromList(roomId: string | number) {
  const index = allRooms.value.findIndex(room => room.id === roomId || room.id?.toString() === roomId.toString())
  if (index !== -1) {
    allRooms.value.splice(index, 1)
    updatePaginatedRooms()
  } else {
  }
}

// SSE事件处理函数
async function handleRoomCreateEvent(eventData: any) {
  // 事件数据应包含完整的房间信息
  if (eventData.room) {
    try {
      // 需要将事件数据转换为Room类型
      const newRoom = await transformRoomData(eventData.room)
      addRoomToList(newRoom)
    } catch (error) {
      console.error('转换房间数据失败:', error)
      loadRooms(1)
    }
  } else {
    // 如果没有完整数据，重新加载列表
    loadRooms(1)
  }
}

async function handleRoomUpdateEvent(eventData: any) {
  if (eventData.room_id && eventData.updates) {
    // 部分更新
    updateRoomInList(eventData.room_id, eventData.updates)
  } else if (eventData.room) {
    // 完整房间数据
    try {
      const updatedRoom = await transformRoomData(eventData.room)
      updateRoomInList(updatedRoom.id, updatedRoom)
    } catch (error) {
      console.error('转换房间数据失败:', error)
      loadRooms(1)
    }
  } else {
    loadRooms(1)
  }
}

function handleUserJoinEvent(eventData: any) {
  if (eventData.room_id && eventData.user_id) {
    // 增加房间人数计数
    const room = findRoomById(eventData.room_id)
    if (room) {
      const currentCount = room.player_count || 0
      updateRoomInList(eventData.room_id, { player_count: currentCount + 1 })
    } else {
      // 房间不存在，重新加载列表
      loadRooms(1)
    }
  } else {
    loadRooms(1)
  }
}

function handleUserLeaveEvent(eventData: any) {
  if (eventData.room_id && eventData.user_id) {
    // 减少房间人数计数
    const room = findRoomById(eventData.room_id)
    if (room) {
      const currentCount = room.player_count || 1 // 假设至少1人
      updateRoomInList(eventData.room_id, { player_count: Math.max(0, currentCount - 1) })
    } else {
      loadRooms(1)
    }
  } else {
    loadRooms(1)
  }
}

function handleRoomDeleteEvent(eventData: any) {
  if (eventData.room_id) {
    removeRoomFromList(eventData.room_id)
  } else {
    loadRooms(1)
  }
}

// 转换房间数据为Room类型（复用loadRooms中的逻辑）
async function transformRoomData(roomData: any): Promise<Room> {
  const roomInfo = roomData.data || roomData
  const roomName = roomInfo.name || roomData.name || `房间${Date.now().toString().slice(-4)}`

  // 房主信息
  const ownerId = roomInfo.host || roomInfo.owner_id
  let ownerName = `用户${ownerId || '未知'}`
  
  // 如果事件数据中没有用户信息，可能需要异步获取
  // 但为了增量更新，我们先用事件中的数据
  if (roomInfo.owner_name || roomInfo.owner) {
    ownerName = roomInfo.owner_name || roomInfo.owner
  }

  // 谱面信息
  const chartId = roomInfo.chart || roomInfo.chart_id
  let chartName = chartId ? `谱面${chartId}` : undefined
  let chartImage = roomInfo.chart_image || undefined
  let chartFile = roomInfo.chart_file || undefined
  
  // 状态映射
  const stateMap: Record<string, string> = {
    'SELECTING_CHART': t('rooms.state.selecting'),
    'WAITING_FOR_READY': t('rooms.state.waiting'),
    'PLAYING': t('rooms.state.playing')
  }
  const statusText = stateMap[roomInfo.state] || roomInfo.state || roomInfo.status || '-'

  // 玩家信息（事件可能不包含完整玩家列表）
  const playerIds = Array.isArray(roomInfo.users) ? roomInfo.users : []
  const playerCount = roomInfo.player_count || playerIds.length || 0
  const maxPlayers = roomInfo.max_players || 100

  // 循环状态
  const isCycling = roomInfo.cycle || roomInfo.is_cycling || false

  // 构建Room对象
  return {
    id: roomInfo.id || roomInfo.room_id || roomName, // 使用房间ID或名称作为ID
    name: roomName,
    owner: ownerName,
    owner_id: ownerId || 0,
    player_count: playerCount,
    max_players: maxPlayers,
    status: statusText,
    is_cycling: isCycling,
    chart_id: chartId,
    chart_name: chartName,
    chart_image: chartImage,
    chart_file: chartFile,
    players: [], // 事件数据可能不包含完整玩家列表，留空
    history: roomInfo.rounds || []
  }
}

// 更新分页后的房间列表
function updatePaginatedRooms() {
  const startIndex = (pagination.value.current - 1) * pagination.value.pageSize
  const endIndex = startIndex + pagination.value.pageSize
  rooms.value = allRooms.value.slice(startIndex, endIndex)
  pagination.value.total = allRooms.value.length
  pagination.value.totalPages = Math.max(1, Math.ceil(allRooms.value.length / pagination.value.pageSize))
}

// 建立SSE连接监听房间实时更新
function setupSSE() {
  try {
    const baseURL = getBaseURL()
    const sseUrl = `${baseURL}/newapi/rooms/listen`
    
    const es = new EventSource(sseUrl)
    eventSource.value = es
    
    es.addEventListener('open', () => {
    })
    
    es.addEventListener('error', (event) => {
      console.error('SSE连接错误:', event)
      // 错误时尝试重新连接
      es.close()
      eventSource.value = null
      setTimeout(() => {
        if (!eventSource.value) {
          setupSSE()
        }
      }, 5000)
    })
    
    // 监听房间创建事件
    es.addEventListener('create_room', (event) => {
      try {
        const eventData = event.data ? JSON.parse(event.data) : {}
        handleRoomCreateEvent(eventData)
      } catch (error) {
        console.error('解析房间创建事件数据失败:', error)
        loadRooms(1) // 失败时回退到重新加载
      }
    })

    // 监听房间更新事件
    es.addEventListener('update_room', (event) => {
      try {
        const eventData = event.data ? JSON.parse(event.data) : {}
        handleRoomUpdateEvent(eventData)
      } catch (error) {
        console.error('解析房间更新事件数据失败:', error)
        loadRooms(1)
      }
    })

    // 监听用户加入事件
    es.addEventListener('join_room', (event) => {
      try {
        const eventData = event.data ? JSON.parse(event.data) : {}
        handleUserJoinEvent(eventData)
      } catch (error) {
        console.error('解析用户加入事件数据失败:', error)
        loadRooms(1)
      }
    })

    // 监听用户离开事件
    es.addEventListener('leave_room', (event) => {
      try {
        const eventData = event.data ? JSON.parse(event.data) : {}
        handleUserLeaveEvent(eventData)
      } catch (error) {
        console.error('解析用户离开事件数据失败:', error)
        loadRooms(1)
      }
    })

    // 监听房间删除事件（如果有）
    es.addEventListener('delete_room', (event) => {
      try {
        const eventData = event.data ? JSON.parse(event.data) : {}
        handleRoomDeleteEvent(eventData)
      } catch (error) {
        console.error('解析房间删除事件数据失败:', error)
        loadRooms(1)
      }
    })

    // 监听其他事件（这些事件可能不需要更新列表）
    es.addEventListener('player_score', () => {
      // 玩家成绩事件通常不需要更新房间列表，除非显示玩家分数
      // 暂时不处理，仅记录日志
    })

    es.addEventListener('start_round', (event) => {
      // 开始新一轮可能更新房间状态
      try {
        const eventData = event.data ? JSON.parse(event.data) : {}
        if (eventData.room_id) {
          // 更新房间状态为"游戏中"或类似状态
          updateRoomInList(eventData.room_id, { status: '游戏中' })
        }
      } catch (error) {
        console.error('解析开始新一轮事件数据失败:', error)
      }
    })
    
  } catch (error) {
    console.error('初始化SSE连接失败:', error)
  }
}

onMounted(() => {
  loadRooms()
  startAutoUpdate()
  setupSSE()
})

onUnmounted(() => {
  if (autoUpdateTimer.value) {
    clearInterval(autoUpdateTimer.value)
    autoUpdateTimer.value = null
  }
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
  }
})
</script>
