<template>
  <div
    class="glass rounded-2xl p-4 transition-colors"
    :class="[
      status.online ? 'bg-green-500/20' : 'bg-red-500/20'
    ]"
  >
    <div class="text-white text-center">
      <div class="text-lg font-bold mb-2">
        {{ status.online ? t('serverStatus.online') : t('serverStatus.offline') }}
      </div>
      <div class="text-sm space-y-1">
        <div>{{ t('serverStatus.availability') }}: {{ status.availability.toFixed(2) }}%</div>
        <div>{{ t('serverStatus.ping') }}: {{ status.latency }}ms</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18nStore } from '@/stores/i18n'
import { serverAPI } from '@/api/server'

const { t } = useI18nStore()

interface StatusData {
  online: boolean
  availability: number
  latency: number
}

const status = ref<StatusData>({
  online: true,
  availability: 99.9,
  latency: 15,
})

let intervalId: number

async function checkServerStatus() {
  try {
    const start = Date.now()
    const data = await serverAPI.getStatus()
    const latency = Date.now() - start

    status.value = {
      online: data.online || false,
      availability: data.availability || 99.9,
      latency: data.latency_ms || latency,
    }
  } catch {
    status.value = {
      online: false,
      availability: 0,
      latency: 0,
    }
  }
}

onMounted(() => {
  checkServerStatus()
  intervalId = setInterval(checkServerStatus, 30000) as unknown as number
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>
