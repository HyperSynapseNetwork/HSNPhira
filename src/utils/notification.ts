import { ref, onUnmounted } from 'vue'
import { showSuccess, showError, showInfo } from './message'

// HSNPM 服务器地址（通过代理，开发环境使用 /hsnpm-api，生产环境可能需要不同配置）
const HSNPM_SERVER = import.meta.env.VITE_HSNPM_SERVER || '/hsnpm-api'
// VAPID 公钥（需要与 HSNPM 服务器的 VAPID_PUBLIC_KEY 一致）
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'YOUR_VAPID_PUBLIC_KEY'

// Web-Push 订阅管理
class NotificationService {
  private isSubscribed = ref(false)
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null

  constructor() {
    this.init()
  }

  private async init() {
    // 检查浏览器支持
    if (!('Notification' in window)) {
      console.warn('此浏览器不支持通知')
      return
    }

    // 请求通知权限（可选，可以在用户点击订阅时再请求）
    // if (Notification.permission === 'default') {
    //   await Notification.requestPermission()
    // }

    // 注册 Service Worker（用于 Web-Push）
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })
        console.log('Service Worker 注册成功:', this.serviceWorkerRegistration)
        
        // 检查现有订阅
        await this.checkSubscription()
      } catch (error) {
        console.error('Service Worker 注册失败:', error)
      }
    } else {
      console.warn('浏览器不支持 Service Worker 或 Push API')
    }
  }

  // 订阅 Web-Push（将订阅信息发送到 HSNPM 服务器）
  async subscribeToPush() {
    if (!this.serviceWorkerRegistration) {
      throw new Error('Service Worker 未注册，无法订阅推送')
    }

    try {
      // 请求通知权限
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('通知权限被拒绝')
      }

      // 订阅推送
      const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer
      })

      // 将订阅信息发送到 HSNPM 服务器
      await this.sendSubscriptionToHSNPM(subscription)
      this.isSubscribed.value = true

      showSuccess('成功', '推送通知订阅成功')
      return subscription
    } catch (error) {
      console.error('订阅推送失败:', error)
      showError('错误', '订阅推送失败: ' + (error as Error).message)
      throw error
    }
  }

  // 取消订阅 Web-Push
  async unsubscribeFromPush() {
    if (!this.serviceWorkerRegistration) {
      throw new Error('Service Worker 未注册')
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription()
      if (subscription) {
        // 从 HSNPM 服务器取消订阅（如果需要）
        await this.unsubscribeFromHSNPM(subscription)
        
        // 本地取消订阅
        const success = await subscription.unsubscribe()
        if (success) {
          this.isSubscribed.value = false
          showSuccess('成功', '推送通知已取消订阅')
        } else {
          throw new Error('取消订阅失败')
        }
      }
    } catch (error) {
      console.error('取消订阅失败:', error)
      showError('错误', '取消订阅失败')
      throw error
    }
  }

  // 检查订阅状态
  async checkSubscription() {
    if (!this.serviceWorkerRegistration) return false

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription()
      this.isSubscribed.value = !!subscription
      
      // 如果本地有订阅，验证是否在 HSNPM 服务器上仍然有效
      if (subscription) {
        // 可以添加服务器端验证逻辑
        console.log('已有推送订阅:', subscription)
      }
      
      return !!subscription
    } catch (error) {
      console.error('检查订阅状态失败:', error)
      return false
    }
  }

  // 发送订阅信息到 HSNPM 服务器
  private async sendSubscriptionToHSNPM(subscription: PushSubscription) {
    const subscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
      },
      expires_at: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
      user_id: null // 可以添加用户ID，如果需要用户关联
    }

    const response = await fetch(`${HSNPM_SERVER}/api/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscriptionData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`订阅信息发送到 HSNPM 服务器失败: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log('订阅成功，服务器返回:', result)
  }

  // 从 HSNPM 服务器取消订阅（可选实现）
  private async unsubscribeFromHSNPM(subscription: PushSubscription) {
    // 如果需要服务器端取消订阅，可以在这里实现
    // 当前版本 HSNPM 没有提供取消订阅的API端点
    console.log('本地取消订阅，服务器端订阅记录可能需要手动清理')
  }

  // 工具函数：将 Base64 URL 安全的字符串转换为 Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }

  // 获取订阅状态
  getIsSubscribed() {
    return this.isSubscribed
  }

  // 获取 Service Worker 注册
  getServiceWorkerRegistration() {
    return this.serviceWorkerRegistration
  }
}

// 创建单例实例
export const notificationService = new NotificationService()

// Vue 组合式函数
export function useNotifications() {
  const isSubscribed = notificationService.getIsSubscribed()

  return {
    isSubscribed,
    subscribeToPush: () => notificationService.subscribeToPush(),
    unsubscribeFromPush: () => notificationService.unsubscribeFromPush(),
    checkSubscription: () => notificationService.checkSubscription(),
    getServiceWorkerRegistration: () => notificationService.getServiceWorkerRegistration()
  }
}