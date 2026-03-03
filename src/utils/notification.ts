import { ref } from 'vue'
import { showSuccess, showError, showInfo } from './message'

// HSNPM 服务器地址（通过代理，开发环境使用 /hsnpm-api，生产环境可能需要不同配置）
const HSNPM_SERVER = import.meta.env.VITE_HSNPM_SERVER || '/hsnpm-api'
// VAPID 公钥（需要与 HSNPM 服务器的 VAPID_PUBLIC_KEY 一致）
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'YOUR_VAPID_PUBLIC_KEY'

// Web-Push 订阅管理 - 自动注册和订阅
class NotificationService {
  private isSubscribed = ref(false)
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null
  private _isInitialized = ref(false)

  // 检查是否在浏览器客户端环境中
  private get isClient(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined'
  }

  constructor() {
    // 只在浏览器环境中初始化，避免 SSR 错误
    if (typeof window !== 'undefined') {
      // 延迟初始化，避免阻塞应用启动
      setTimeout(() => this.init(), 3000) // 3秒后初始化，让页面先加载
    } else {
      // 在 SSR 环境中标记为已初始化，避免错误
      this._isInitialized.value = true
    }
  }

  private async init() {
    if (this._isInitialized.value) return

    // 双重检查：确保在浏览器环境中
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      console.warn('⚠️  不在浏览器环境中，跳过通知服务初始化')
      this._isInitialized.value = true
      return
    }

    console.log('🔔 初始化通知服务...')

    // 检查浏览器支持
    if (!('Notification' in window)) {
      console.warn('⚠️  此浏览器不支持通知')
      this._isInitialized.value = true
      return
    }

    // 始终注册 Service Worker（无论是否在后台）
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        console.log('🔧 注册 Service Worker...')
        await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })
        // ⚠️ 关键修复：必须等待 Service Worker 进入 activated 状态
        // register() 返回时 SW 可能仍在 installing/waiting 阶段，此时
        // 调用 pushManager.subscribe() 会触发 AbortError: no active Service Worker
        // navigator.serviceWorker.ready 会等到有 active SW 才 resolve
        console.log('⏳ 等待 Service Worker 激活...')
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready
        console.log('✅ Service Worker 已激活:', this.serviceWorkerRegistration)

        // 自动处理通知权限和订阅
        await this.autoHandleNotificationPermission()

      } catch (error) {
        console.error('❌ Service Worker 注册失败:', error)
        showError('通知服务', 'Service Worker 注册失败，推送通知不可用')
      }
    } else {
      console.warn('⚠️  浏览器不支持 Service Worker 或 Push API')
    }

    this._isInitialized.value = true
  }

  // 自动处理通知权限：检测到没给通知权限就弹窗要通知权限
  private async autoHandleNotificationPermission() {
    if (!this.serviceWorkerRegistration) return
    if (!this.isClient) return

    console.log('🔔 检查通知权限状态...')

    const permission = Notification.permission

    switch (permission) {
      case 'default': // 未决定，弹窗请求权限
        console.log('📢 通知权限未决定，弹窗请求权限...')
        await this.requestAndSubscribe()
        break

      case 'granted': // 已授予，检查并订阅
        console.log('✅ 通知权限已授予')
        await this.ensureSubscription()
        break

      case 'denied': // 已拒绝
        console.warn('❌ 通知权限已被拒绝')
        showInfo('通知权限', '您已拒绝通知权限。如需接收房间通知，请在浏览器设置中启用。')
        break
    }
  }

  // 请求权限并订阅
  private async requestAndSubscribe() {
    if (!this.serviceWorkerRegistration) return
    if (!this.isClient) return

    try {
      console.log('🔄 请求通知权限...')
      const permission = await Notification.requestPermission()

      if (permission === 'granted') {
        console.log('✅ 通知权限已授予')
        showSuccess('通知权限', '已授权接收通知')
        await this.subscribeToPush()
      } else if (permission === 'denied') {
        console.warn('❌ 通知权限被拒绝')
        showInfo('通知权限', '您已拒绝通知权限。如需接收房间通知，请在浏览器设置中启用。')
      } else {
        console.log('ℹ️  通知权限保持默认')
      }
    } catch (error) {
      console.error('❌ 请求通知权限失败:', error)
    }
  }

  // 确保有有效的推送订阅
  private async ensureSubscription() {
    if (!this.isClient) return
    if (!this.serviceWorkerRegistration) return

    try {
      // 检查现有订阅
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription()

      if (!subscription) {
        console.log('📝 没有推送订阅，开始订阅...')
        await this.subscribeToPush()
      } else {
        // 检查订阅是否仍然有效
        const isExpired = subscription.expirationTime && Date.now() > subscription.expirationTime
        if (isExpired) {
          console.log('🔄 订阅已过期，重新订阅...')
          await subscription.unsubscribe()
          await this.subscribeToPush()
        } else {
          console.log('✅ 已有有效的推送订阅')
          this.isSubscribed.value = true
          
          // 验证订阅是否在服务器上仍然有效（可选）
          await this.verifySubscriptionWithServer(subscription)
        }
      }
    } catch (error) {
      console.error('❌ 确保订阅失败:', error)
    }
  }

  // 验证订阅是否在服务器上仍然有效（可选）
  private async verifySubscriptionWithServer(subscription: PushSubscription) {
    try {
      console.log('🔍 验证服务器订阅状态...')
      
      // 使用相同的转换逻辑
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      
      if (!p256dhKey || !authKey) {
        console.warn('⚠️  订阅信息中缺少加密密钥，重新订阅...')
        await this.subscribeToPush()
        return
      }
      
      const p256dhArray = new Uint8Array(p256dhKey);
      const authArray = new Uint8Array(authKey);
      
      const p256dhBase64 = btoa(String.fromCharCode(...p256dhArray));
      const authBase64 = btoa(String.fromCharCode(...authArray));
      
      const p256dh = p256dhBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const auth = authBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh,
          auth
        }
      }

      const response = await fetch(`${HSNPM_SERVER}/subscriptions/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionData)
      })

      if (response.ok) {
        console.log('✅ 服务器订阅验证成功')
      } else if (response.status === 404) {
        console.warn('⚠️  服务器上不存在此订阅，重新注册...')
        await this.sendSubscriptionToHSNPM(subscription)
      } else {
        console.warn(`⚠️  服务器验证失败: ${response.status}`)
      }
    } catch (error) {
      console.error('❌ 服务器验证失败:', error)
      // 不抛出错误，避免影响主流程
    }
  }

  // 订阅 Web-Push（将订阅信息发送到 HSNPM 服务器）
  async subscribeToPush() {
    if (!this.isClient) {
      console.warn('⚠️  不在浏览器环境中，跳过推送订阅')
      return null
    }

    if (!this.serviceWorkerRegistration) {
      console.error('❌ Service Worker 未注册，无法订阅推送')
      throw new Error('Service Worker 未注册，无法订阅推送')
    }

    // 检查浏览器支持
    if (!('PushManager' in window)) {
      const error = new Error('此浏览器不支持推送通知')
      console.error('❌', error.message)
      showError('通知订阅', error.message)
      throw error
    }

    // 检查是否是移动端（某些移动浏览器可能有问题）
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    try {
      console.log('📝 开始订阅推送通知...', { isMobile })

      // 确保有通知权限
      if (Notification.permission !== 'granted') {
        console.log('🔔 请求通知权限...')
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          console.warn('❌ 通知权限被拒绝')
          throw new Error('通知权限被拒绝')
        }
      }

      // 检查VAPID公钥格式
      if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY') {
        const error = new Error('VAPID公钥未配置，请联系管理员')
        console.error('❌', error.message)
        showError('通知订阅', error.message)
        throw error
      }

      console.log('🔑 订阅推送服务...', { isMobile, vapidKeyLength: VAPID_PUBLIC_KEY.length })
      
      // 对于移动端，使用更保守的选项
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      };

      // 尝试订阅
      const subscription = await this.serviceWorkerRegistration.pushManager.subscribe(subscribeOptions)

      console.log('✅ 推送订阅成功，发送到服务器...')

      // 将订阅信息发送到 HSNPM 服务器
      await this.sendSubscriptionToHSNPM(subscription)
      this.isSubscribed.value = true

      console.log('🎉 推送通知订阅完成')
      showSuccess('通知订阅', '已成功订阅房间通知')
      return subscription
    } catch (error: any) {
      console.error('❌ 订阅推送失败:', error)
      
      let errorMessage = '订阅失败: ' + error.message
      
      // 针对特定错误提供更友好的消息
      if (error.name === 'AbortError' || error.message.includes('push service error')) {
        if (isMobile) {
          errorMessage = '移动端浏览器推送服务暂不可用，请尝试使用桌面版Chrome/Firefox'
        } else {
          errorMessage = '推送服务错误，可能是VAPID密钥配置问题或浏览器不支持'
        }
      } else if (error.message.includes('permission')) {
        errorMessage = '通知权限被拒绝，请在浏览器设置中启用通知权限'
      }
      
      showError('通知订阅', errorMessage)
      throw new Error(errorMessage)
    }
  }

  // 取消订阅 Web-Push
  // 手动重新检查并修复订阅状态
  async recheckSubscription() {
    if (!this.isClient) {
      console.warn('⚠️  不在浏览器环境中，跳过订阅状态检查')
      return false
    }
    
    console.log('🔍 手动重新检查订阅状态...')
    if (!this.serviceWorkerRegistration) {
      console.error('❌ Service Worker 未注册')
      return false
    }
    
    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription()
      if (subscription) {
        this.isSubscribed.value = true
        console.log('✅ 有推送订阅')
        
        // 验证订阅是否仍然有效
        const isExpired = subscription.expirationTime && Date.now() > subscription.expirationTime
        if (isExpired) {
          console.log('🔄 订阅已过期，重新订阅...')
          await subscription.unsubscribe()
          await this.subscribeToPush()
        } else {
          console.log('✅ 订阅有效')
          await this.verifySubscriptionWithServer(subscription)
        }
        
        return true
      } else {
        console.log('📝 没有推送订阅')
        this.isSubscribed.value = false
        
        // 如果已有权限，自动重新订阅
        if (Notification.permission === 'granted') {
          console.log('🔄 有通知权限但无订阅，自动订阅...')
          await this.subscribeToPush()
        }
        
        return false
      }
    } catch (error) {
      console.error('❌ 重新检查订阅失败:', error)
      return false
    }
  }

  // 取消订阅 Web-Push
  async unsubscribeFromPush() {
    if (!this.isClient) {
      console.warn('⚠️  不在浏览器环境中，跳过推送取消订阅')
      return
    }
    
    if (!this.serviceWorkerRegistration) {
      console.error('❌ Service Worker 未注册')
      throw new Error('Service Worker 未注册')
    }

    try {
      console.log('🗑️  取消推送订阅...')
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription()
      if (subscription) {
        // 从 HSNPM 服务器取消订阅（如果需要）
        await this.unsubscribeFromHSNPM(subscription)

        // 本地取消订阅
        const success = await subscription.unsubscribe()
        if (success) {
          this.isSubscribed.value = false
          console.log('✅ 推送订阅已取消')
          showSuccess('通知', '推送通知已取消订阅')
        } else {
          console.error('❌ 取消订阅失败')
          throw new Error('取消订阅失败')
        }
      } else {
        console.log('ℹ️  没有订阅可取消')
        this.isSubscribed.value = false
      }
    } catch (error) {
      console.error('❌ 取消订阅失败:', error)
      showError('通知', '取消订阅失败')
      throw error
    }
  }

  // 检查订阅状态
  async checkSubscription() {
    if (!this.isClient) {
      console.warn('⚠️  不在浏览器环境中，跳过订阅状态检查')
      return false
    }
    
    if (!this.serviceWorkerRegistration) {
      console.log('ℹ️  Service Worker 未注册')
      return false
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription()
      const hasSubscription = !!subscription
      this.isSubscribed.value = hasSubscription

      if (subscription) {
        console.log('✅ 已有推送订阅')
      } else {
        console.log('📝 没有推送订阅')
      }

      return hasSubscription
    } catch (error) {
      console.error('❌ 检查订阅状态失败:', error)
      return false
    }
  }

  // 发送订阅信息到 HSNPM 服务器
  private async sendSubscriptionToHSNPM(subscription: PushSubscription) {
    // 正确的将ArrayBuffer转换为base64（URL-safe）
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    
    if (!p256dhKey || !authKey) {
      throw new Error('订阅信息中缺少必要的加密密钥')
    }
    
    const p256dhArray = new Uint8Array(p256dhKey);
    const authArray = new Uint8Array(authKey);
    
    // 使用标准方法转换为base64
    const p256dhBase64 = btoa(String.fromCharCode(...p256dhArray));
    const authBase64 = btoa(String.fromCharCode(...authArray));
    
    // 转换为URL-safe base64（web-push标准格式）
    const p256dh = p256dhBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const auth = authBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    const subscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh,
        auth
      },
      expires_at: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
      user_id: null // 可以添加用户ID，如果需要用户关联
    }

    const response = await fetch(`${HSNPM_SERVER}/subscriptions`, {
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
  private async unsubscribeFromHSNPM(_subscription: PushSubscription) {
    // 如果需要服务器端取消订阅，可以在这里实现
    // 当前版本 HSNPM 没有提供取消订阅的API端点
    console.log('本地取消订阅，服务器端订阅记录可能需要手动清理')
  }

  // 工具函数：将 Base64 URL 安全的字符串转换为 Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    if (!this.isClient) {
      throw new Error('urlBase64ToUint8Array 只能在浏览器环境中调用')
    }
    
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

  // 获取初始化状态
  get isInitialized() {
    return this._isInitialized
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
    recheckSubscription: () => notificationService.recheckSubscription(),
    getServiceWorkerRegistration: () => notificationService.getServiceWorkerRegistration(),
    isInitialized: notificationService.isInitialized
  }
}