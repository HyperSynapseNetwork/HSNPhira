<template>
  <div class="container mx-auto px-4 py-24 max-w-2xl">
    <div class="glass rounded-3xl p-8">
      <h1 class="text-3xl font-bold text-white mb-8 text-center">账户管理</h1>

      <div v-if="userStore.user" class="space-y-6">
        <!-- 用户信息展示 -->
        <div class="glass-dark rounded-2xl p-6">
          <div class="flex items-center gap-6 mb-6">
            <img
              :src="userStore.user.phira_avatar"
              alt="Avatar"
              class="w-24 h-24 rounded-full ring-4 ring-primary/30"
            />
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-white">{{ userStore.user.username }}</h2>
              <p class="text-white/60">ID: {{ userStore.user.id }}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 text-white/80">
            <div>
              <div class="text-white/40 text-sm mb-1">Phira用户名</div>
              <div>{{ userStore.user.phira_username }}</div>
            </div>
            <div>
              <div class="text-white/40 text-sm mb-1">Phira ID</div>
              <div>{{ userStore.user.phira_id }}</div>
            </div>
            <div>
              <div class="text-white/40 text-sm mb-1">RKS</div>
              <div>{{ userStore.user.phira_rks.toFixed(2) }}</div>
            </div>
            <div>
              <div class="text-white/40 text-sm mb-1">用户组</div>
              <div>{{ getUserGroup(userStore.user.group_id) }}</div>
            </div>
            <div>
              <div class="text-white/40 text-sm mb-1">注册时间</div>
              <div>{{ formatDate(userStore.user.register_time) }}</div>
            </div>
            <div>
              <div class="text-white/40 text-sm mb-1">最后登录</div>
              <div>{{ formatDate(userStore.user.last_login_time) }}</div>
            </div>
          </div>
        </div>

        <!-- 账户操作 -->
        <div class="space-y-4">
          <h3 class="text-xl font-bold text-white mb-4">账户操作</h3>
          
          <Button class="w-full" @click="syncPhiraData">
            同步Phira数据
          </Button>
          
          <Button class="w-full" @click="changePassword">
            修改密码
          </Button>
          
          <Button class="w-full" @click="unlinkPhira">
            解绑Phira账号
          </Button>
        </div>

        <!-- 危险操作 -->
        <div class="glass-dark rounded-2xl p-6 border-2 border-red-500/30">
          <h3 class="text-xl font-bold text-red-400 mb-4">危险操作</h3>
          <p class="text-white/60 text-sm mb-4">
            以下操作不可撤销，请谨慎操作
          </p>
          <Button class="w-full bg-red-500/20" @click="deleteAccount">
            删除账户
          </Button>
        </div>
      </div>

      <div v-else class="text-center text-white/60 py-12">
        <p class="mb-4">您尚未登录</p>
        <Button @click="login">
          前往登录
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '@/store'
import { eventBus } from '@/utils/eventBus'
import { showInfo, showWarning } from '@/utils/message'
import Button from '@/components/common/Button.vue'

const userStore = useUserStore()

function getUserGroup(groupId: number): string {
  const groups: Record<number, string> = {
    1: '管理员',
    2: '版主',
    3: '用户',
  }
  return groups[groupId] || '未知'
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function syncPhiraData() {
  showInfo('同步', '正在同步Phira数据...')
}

function changePassword() {
  showInfo('修改密码', '此功能尚未实现')
}

function unlinkPhira() {
  showWarning('警告', '解绑Phira账号功能尚未实现')
}

function deleteAccount() {
  if (confirm('确定要删除账户吗？此操作不可撤销！')) {
    showWarning('警告', '删除账户功能尚未实现')
  }
}

function login() {
  eventBus.emit('open-window', 'auth')
}
</script>
