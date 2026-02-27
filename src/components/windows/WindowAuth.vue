<template>
  <Window v-model="isOpen" width="450px">
    <div class="text-white">
      <h2 class="text-2xl font-bold mb-6 text-center">
        {{ isLogin ? t('common.login') : t('common.register') }}
      </h2>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- 用户名 -->
        <div>
          <label class="block text-sm mb-2">{{ t('auth.username') }}</label>
          <input
            v-model="formData.username"
            type="text"
            class="w-full px-4 py-2 rounded-lg glass text-white outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <!-- Phira ID (仅注册) -->
        <div v-if="!isLogin">
          <label class="block text-sm mb-2">{{ t('auth.phiraId') }}</label>
          <input
            v-model="formData.phiraId"
            type="text"
            class="w-full px-4 py-2 rounded-lg glass text-white outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <!-- 密码 -->
        <div>
          <label class="block text-sm mb-2">{{ t('auth.password') }}</label>
          <input
            v-model="formData.password"
            type="password"
            class="w-full px-4 py-2 rounded-lg glass text-white outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <!-- 选项 -->
        <div class="flex items-center justify-between text-sm">
          <div class="space-y-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="formData.remember" type="checkbox" class="rounded" />
              <span>{{ t('auth.rememberMe') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="formData.agreePolicy" type="checkbox" class="rounded" />
              <span>
                {{ t('auth.agreePolicy') }}
                <router-link
                  to="/agreement"
                  class="text-primary glow-on-hover"
                  @click="isOpen = false"
                >
                  {{ t('nav.agreement') }}
                </router-link>
              </span>
            </label>
          </div>
          <div class="space-y-1 text-right">
            <div>
              <a href="#" class="text-white/60 hover:text-white">{{ t('auth.forgotPassword') }}</a>
            </div>
            <div>
              <button
                type="button"
                class="text-primary glow-on-hover"
                @click="isLogin = !isLogin"
              >
                {{ isLogin ? t('auth.switchToRegister') : t('auth.switchToLogin') }}
              </button>
            </div>
          </div>
        </div>

        <!-- 提交按钮 -->
        <Button
          type="submit"
          class="w-full !px-6 !py-3"
          :disabled="!formData.agreePolicy || isSubmitting"
        >
          {{ isSubmitting ? t('common.loading') : (isLogin ? t('common.login') : t('common.register')) }}
        </Button>
      </form>

      <!-- 注册验证状态 -->
      <div v-if="registerStatus" class="mt-4 p-4 glass rounded-lg text-center">
        <div v-if="registerStatus.type === 'validating'" class="space-y-2">
          <div class="text-yellow-400">正在验证...</div>
          <div class="text-sm">请在Phira中创建名为以下token的房间:</div>
          <div class="text-lg font-mono bg-black/30 px-4 py-2 rounded">
            {{ registerStatus.token }}
          </div>
          <div class="text-xs text-white/60">5分钟内有效</div>
        </div>
        <div v-else-if="registerStatus.type === 'success'" class="text-green-400">
          注册成功!
        </div>
        <div v-else-if="registerStatus.type === 'error'" class="text-red-400">
          {{ registerStatus.message }}
        </div>
        <div v-else-if="registerStatus.type === 'timeout'" class="text-orange-400">
          验证超时，请重试
        </div>
      </div>
    </div>
  </Window>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/store'
import { useI18nStore } from '@/stores/i18n'
import { eventBus } from '@/utils/eventBus'
import { showSuccess, showError } from '@/utils/message'
import { authAPI } from '@/api/auth'
import Window from './Window.vue'
import Button from '../common/Button.vue'

const userStore = useUserStore()
const i18nStore = useI18nStore()
const { t } = i18nStore
const isOpen = ref(false)
const isLogin = ref(true)
const isSubmitting = ref(false)

const formData = reactive({
  username: '',
  password: '',
  phiraId: '',
  remember: false,
  agreePolicy: false,
})

const registerStatus = ref<{
  type: 'validating' | 'success' | 'error' | 'timeout'
  token?: string
  message?: string
} | null>(null)

let registerEventSource: EventSource | null = null

async function handleSubmit() {
  if (!formData.agreePolicy) {
    showError(t('common.error'), t('auth.agreePolicyRequired'))
    return
  }

  isSubmitting.value = true

  try {
    if (isLogin.value) {
      await handleLogin()
    } else {
      await handleRegister()
    }
  } catch (error: any) {
    showError(t('common.error'), error.message || t('common.operationFailed'))
  } finally {
    isSubmitting.value = false
  }
}

async function handleLogin() {
  await userStore.login(formData.username, formData.password, formData.remember)
  showSuccess(t('common.success'), t('auth.loginSuccess'))
  eventBus.emit('login-success')
  isOpen.value = false
  resetForm()
}

async function handleRegister() {
  registerStatus.value = null

  try {
    const eventSource = await authAPI.register({
      username: formData.username,
      password: formData.password,
      phira_id_or_username: formData.phiraId,
    })

    registerEventSource = eventSource

    eventSource.addEventListener('validating', (e: any) => {
      registerStatus.value = {
        type: 'validating',
        token: e.data,
      }
    })

    eventSource.addEventListener('success', (e: any) => {
      const user = JSON.parse(e.data)
      registerStatus.value = { type: 'success' }
      userStore.setUser(user)
      showSuccess(t('common.success'), t('auth.registerSuccess'))
      eventBus.emit('login-success')
      setTimeout(() => {
        isOpen.value = false
        resetForm()
      }, 1500)
      eventSource.close()
    })

    eventSource.addEventListener('error', (e: any) => {
      registerStatus.value = {
        type: 'error',
        message: e.data || t('auth.registerFailed'),
      }
      eventSource.close()
    })

    eventSource.addEventListener('timeout', () => {
      registerStatus.value = { type: 'timeout' }
      eventSource.close()
    })

    eventSource.onerror = () => {
      registerStatus.value = {
        type: 'error',
        message: t('common.connectionFailed'),
      }
      eventSource.close()
    }
  } catch (error: any) {
    registerStatus.value = {
      type: 'error',
      message: error.message || t('auth.registerRequestFailed'),
    }
  }
}

function resetForm() {
  formData.username = ''
  formData.password = ''
  formData.phiraId = ''
  formData.remember = false
  formData.agreePolicy = false
  registerStatus.value = null
}

function openWindow() {
  isOpen.value = true
}

function handleOpenWindow(type: string) {
  if (type === 'auth') {
    openWindow()
  }
}

watch(isLogin, () => {
  registerStatus.value = null
})

onMounted(() => {
  eventBus.on('open-window', handleOpenWindow)
})

onUnmounted(() => {
  eventBus.off('open-window', handleOpenWindow)
  if (registerEventSource) {
    registerEventSource.close()
  }
})
</script>
