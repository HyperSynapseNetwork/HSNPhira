<template>
  <div class="glass rounded-2xl p-6 tilt-3d" @mousemove="handleMouseMove" @mouseleave="resetTilt">
    <div class="overflow-x-auto table-scroll">
      <table class="w-full min-w-max">
        <thead>
          <tr class="border-b border-white/20">
            <th
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 text-left font-semibold"
              :style="{ color: primaryColor }"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in data"
            :key="index"
            class="border-b border-white/10 hover:bg-white/5 transition-colors"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 text-white/90"
            >
              <slot
                :name="`cell-${column.key}`"
                :row="row"
                :column="column"
                :index="index"
              >
                {{ row[column.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 - 只在totalPages > 1时显示 -->
    <div v-if="pagination && pagination.totalPages > 1" class="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
      <div class="text-white/60 text-sm">
        共 {{ pagination.total }} 条
      </div>
      <div class="flex gap-2">
        <Button
          size="sm"
          :disabled="pagination.current === 1"
          @click="$emit('page-change', pagination.current - 1)"
        >
          上一页
        </Button>
        <div class="text-white/80 px-4 py-1">
          {{ pagination.current }} / {{ pagination.totalPages }}
        </div>
        <Button
          size="sm"
          :disabled="pagination.current === pagination.totalPages"
          @click="$emit('page-change', pagination.current + 1)"
        >
          下一页
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getUserPreference } from '@/utils/config'
import Button from './Button.vue'

interface Column {
  key: string
  label: string
}

interface Pagination {
  current: number
  totalPages: number
  total: number
}

interface Props {
  columns: Column[]
  data: any[]
  pagination?: Pagination
}

defineProps<Props>()

defineEmits<{
  'page-change': [page: number]
}>()

const primaryColor = computed(() => getUserPreference('theme_color', '#00F7FF'))

// 3D倾斜效果（仅桌面端）- 添加最大倾斜值限制
function handleMouseMove(event: MouseEvent) {
  if (window.innerWidth < 768) return // 移动端不启用

  const card = event.currentTarget as HTMLElement
  const rect = card.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  
  const maxTilt = 8 // 最大倾斜角度
  const rotateX = Math.max(-maxTilt, Math.min(maxTilt, (centerY - y) / 20))
  const rotateY = Math.max(-maxTilt, Math.min(maxTilt, (x - centerX) / 20))
  
  card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
}

function resetTilt(event: MouseEvent) {
  const card = event.currentTarget as HTMLElement
  card.style.transform = ''
}
</script>
