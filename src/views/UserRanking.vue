<template>
  <div class="container mx-auto px-4 py-24">
    <h1 class="text-4xl font-bold text-white text-center mb-8">{{ t('userRanking.title') }}</h1>

    <!-- 搜索框 -->
    <div class="mb-6 max-w-md mx-auto">
      <div class="glass rounded-2xl p-4">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('userRanking.searchPlaceholder')"
          class="w-full bg-transparent text-white outline-none placeholder-white/40"
          @input="handleSearch"
        />
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="mb-6 text-center">
      <div class="glass rounded-2xl p-8 inline-block">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <div class="text-white/60 text-lg">正在加载排行榜数据...</div>
      </div>
    </div>

    <!-- 用户排行榜 -->
    <div v-else>
      <Table
        :columns="columns"
        :data="displayUsers"
        :pagination="pagination"
        @page-change="handlePageChange"
      >
      <!-- 排名 -->
      <template #cell-rank="{ row }">
        <div class="flex items-center gap-2">
          <span class="text-white font-bold">{{ row.rank }}</span>
        </div>
      </template>

      <!-- 用户 -->
      <template #cell-user="{ row }">
        <button
          class="flex items-center gap-3 hover:opacity-80 transition-opacity"
          @click="openUserPage(row.userId)"
        >
          <img
            v-if="row.userData?.avatar"
            :src="row.userData.avatar"
            class="w-10 h-10 rounded-full"
            :alt="row.userData.name"
          />
          <div class="text-left">
            <div class="text-white font-medium">{{ row.userData?.name || `用户${row.userId}` }}</div>
            <div class="text-white/40 text-xs">ID: {{ row.userId }}</div>
          </div>
        </button>
      </template>

      <!-- 游玩时间 -->
      <template #cell-playtime="{ row }">
        <div class="text-white">
          <div class="font-bold text-lg">{{ row.playtimeFormatted }}</div>
          <div class="text-white/40 text-xs">{{ row.playtimeSeconds }}秒</div>
        </div>
      </template>

      <!-- RKS -->
      <template #cell-rks="{ row }">
        <span v-if="row.userData && row.userData.rks" class="text-white">
          {{ row.userData.rks.toFixed(2) }}
        </span>
        <span v-else class="text-white/40">-</span>
      </template>
      </Table>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18nStore } from '@/stores/i18n'
import { serverAPI } from '@/api/server'
import Table from '@/components/common/Table.vue'

const { t } = useI18nStore()

interface PlaytimeData {
  user_id: number
  total_playtime: number
}

const columns = [
  { key: 'rank', label: t('userRanking.rank') },
  { key: 'user', label: t('userRanking.username') },
  { key: 'playtime', label: t('userRanking.playCount') },
  { key: 'rks', label: t('userRanking.rks') },
]

const allPlaytimeData = ref<PlaytimeData[]>([])
const rankedUsers = ref<{rank: number, userId: number, playtimeSeconds: number, playtimeFormatted: string, userData: any}[]>([])
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = 20

// 用户信息缓存
const userCache = ref<Map<number, {name: string, avatar?: string, rks?: number}>>(new Map())
const isLoading = ref(false)

// 格式化时间
function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

// 搜索过滤
const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) {
    return rankedUsers.value
  }

  const query = searchQuery.value.toLowerCase()
  return rankedUsers.value.filter(user => {
    const userName = user.userData?.name?.toLowerCase() || `用户${user.userId}`.toLowerCase()
    const playerIdStr = user.userId.toString()
    return userName.includes(query) || playerIdStr.includes(query)
  })
})

// 分页显示
const displayUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredUsers.value.slice(start, end)
})

// 分页信息
const pagination = computed(() => ({
  current: currentPage.value,
  totalPages: Math.ceil(filteredUsers.value.length / pageSize),
  total: filteredUsers.value.length
}))

// 获取用户信息
async function getUserInfo(userId: number): Promise<{name: string, avatar?: string, rks?: number}> {
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
      avatar: data.avatar || undefined,
      rks: data.rks || 0
    }
    
    // 缓存结果
    userCache.value.set(userId, userInfo)
    return userInfo
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error)
    const defaultInfo = {
      name: `玩家${userId}`,
      avatar: undefined,
      rks: 0
    }
    userCache.value.set(userId, defaultInfo)
    return defaultInfo
  }
}

// 批量加载用户信息（每次最多10个）
async function batchLoadUserInfo(userIds: number[]) {
  const promises = userIds.map(userId => getUserInfo(userId))
  return await Promise.all(promises)
}

// 加载排行榜数据
async function loadPlaytimeData() {
  try {
    isLoading.value = true
    const data = await serverAPI.getPlaytimeLeaderboard()

    if (data.success && Array.isArray(data.data)) {
      allPlaytimeData.value = data.data
      
      // 初始化rankedUsers，先只包含基础信息
      const initialUsers = data.data.map((dataItem: any, index: number) => ({
        rank: index + 1,
        userId: dataItem.user_id,
        playtimeSeconds: dataItem.total_playtime,
        playtimeFormatted: formatPlaytime(dataItem.total_playtime),
        userData: null as any
      }))
      
      rankedUsers.value = initialUsers
      
      // 异步加载用户详细信息（分批进行）
      const userIdsToLoad = data.data.slice(0, 20).map((item: any) => item.user_id) // 先加载前20个
      const userInfos = await batchLoadUserInfo(userIdsToLoad)
      
      // 更新用户数据
      rankedUsers.value = rankedUsers.value.map((user, index) => {
        if (index < userInfos.length) {
          return {
            ...user,
            userData: userInfos[index]
          }
        }
        return user
      })
    }
  } catch (error) {
    console.error('Failed to load playtime data:', error)
  } finally {
    isLoading.value = false
  }
}


function handlePageChange(page: number) {
  currentPage.value = page
}

function handleSearch() {
  currentPage.value = 1
}

function openUserPage(phiraId: number) {
  if (phiraId) {
    window.open(`https://phira.moe/user/${phiraId}`, '_blank')
  }
}

onMounted(() => {
  loadPlaytimeData()
})

</script>
