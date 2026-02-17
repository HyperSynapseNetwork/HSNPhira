<template>
  <Window v-model="isOpen" width="600px">
    <div class="text-white">
      <h2 class="text-2xl font-bold mb-6 text-center">房间人员</h2>
      
      <!-- 房间信息 -->
      <div v-if="roomData" class="glass-dark rounded-xl p-4 mb-6">
        <div class="text-lg font-bold mb-2">{{ roomData.name }}</div>
        <div class="text-white/60 text-sm">
          人数：{{ roomData.player_count }}/{{ roomData.max_players || 100 }}
        </div>
      </div>

      <!-- 玩家列表 -->
      <div class="space-y-2 max-h-[400px] overflow-y-auto">
        <div
          v-for="player in players"
          :key="player.id"
          class="glass-dark rounded-xl p-4 hover:bg-white/5 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <!-- 头像 -->
              <img
                v-if="player.avatar"
                :src="player.avatar"
                class="w-10 h-10 rounded-full"
                :alt="player.username"
              />
              <div
                v-else
                class="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center text-white font-bold"
              >
                {{ player.username.charAt(0).toUpperCase() }}
              </div>
              
              <!-- 用户名 -->
              <button
                class="text-white font-medium hover:text-primary transition-colors"
                :class="{ 'text-yellow-400 font-bold': player.is_owner }"
                @click="openPlayerPage(player.phira_id)"
              >
                {{ player.username }}
                <span v-if="player.is_owner" class="ml-2 text-xs">(房主)</span>
              </button>
            </div>
            
            <!-- RKS -->
            <div v-if="player.rks" class="text-white/60 text-sm">
              RKS: {{ player.rks.toFixed(2) }}
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-if="players.length === 0" class="text-center text-white/40 py-8">
          暂无玩家
        </div>
      </div>
    </div>
  </Window>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { eventBus } from '@/utils/eventBus'
import { getBaseURL } from '@/utils/config'
import Window from './Window.vue'

interface Player {
  id: number
  username: string
  phira_id: number
  avatar?: string
  rks?: number
  is_owner: boolean
}

interface RoomData {
  id: string
  name: string
  player_count: number
  max_players?: number
  owner_id: number
  players?: Player[]
}

const isOpen = ref(false)
const roomData = ref<RoomData | null>(null)
const players = ref<Player[]>([])
const isLoading = ref(false)

async function fetchRoomInfo(roomName: string) {
  try {
    isLoading.value = true
    const baseURL = getBaseURL()
    const response = await fetch(`${baseURL}/api/rooms/info/${encodeURIComponent(roomName)}`)
    if (!response.ok) throw new Error('获取房间信息失败')
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Failed to fetch room info:', error)
    return null
  } finally {
    isLoading.value = false
  }
}

async function openWindow(room: RoomData) {
  // 先显示传入的数据
  roomData.value = room
  players.value = room.players || []
  isOpen.value = true
  
  // 然后异步获取最新数据
  const freshData = await fetchRoomInfo(room.name)
  if (freshData) {
    // 转换数据格式
    const roomInfo = freshData.data || freshData
    const playerIds = Array.isArray(roomInfo.users) ? roomInfo.users : []
    
    // 构建玩家列表（需要获取用户信息）
    // 暂时使用ID列表，实际需要异步获取用户信息
    // 这里简化处理，只更新player_count
    roomData.value = {
      ...roomData.value,
      player_count: playerIds.length,
      max_players: 100
    }
  }
}

function openPlayerPage(phiraId: number) {
  if (phiraId) {
    window.open(`https://phira.moe/user/${phiraId}`, '_blank')
  }
}

function handleViewPlayers(room: RoomData) {
  openWindow(room)
}

onMounted(() => {
  eventBus.on('view-players', handleViewPlayers)
})

onUnmounted(() => {
  eventBus.off('view-players', handleViewPlayers)
})
</script>
