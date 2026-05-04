// HSNPhira Service Worker - 推送通知 + 离线缓存
// ⚠️ 此文件通过 VitePWA injectManifest 策略处理：
//    构建时 self.__WB_MANIFEST 会被替换为实际的预缓存文件清单

const CACHE_NAME = 'hsnphira-v2'

// VitePWA 会在构建时将 self.__WB_MANIFEST 替换为带版本号的资源列表
// 开发环境或未替换时回退为空数组
const PRECACHE_LIST = self.__WB_MANIFEST || []

// ─────────────────────────────────────────
// 安装：预缓存 Vite 构建产物（带哈希的文件）
// ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] 安装中，预缓存资源数量:', PRECACHE_LIST.length)

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const urls = PRECACHE_LIST.map((entry) =>
        typeof entry === 'string' ? entry : entry.url
      )
      // 逐个缓存，单个失败不阻断整体安装
      return Promise.allSettled(
        urls.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] 预缓存失败，跳过:', url, err.message)
          })
        )
      )
    }).then(() => {
      console.log('[SW] 安装完成，跳过等待立即激活')
      return self.skipWaiting()
    })
  )
})

// ─────────────────────────────────────────
// 激活：清理旧版本缓存，接管所有客户端
// ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] 激活中...')
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] 删除旧缓存:', name)
            return caches.delete(name)
          })
      )
    ).then(() => {
      console.log('[SW] 激活完成，接管页面')
      return self.clients.claim()
    })
  )
})

// ─────────────────────────────────────────
// Fetch：缓存优先，回落网络（SPA 友好）
// ─────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (event.request.url.startsWith('chrome-extension://')) return
  // 跳过 API / SSE 动态请求
  if (event.request.url.includes('/hsnpm-api')) return
  if (event.request.url.includes('/api/')) return
  if (event.request.url.includes('/about')) return
  if (event.request.url.includes('/newapi/')) return

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok && networkResponse.type !== 'opaque') {
          const responseClone = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, responseClone)
          )
        }
        return networkResponse
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/index.html')
        }
      })
    })
  )
})

// ─────────────────────────────────────────
// Push：展示推送通知
// ─────────────────────────────────────────
// 修复关键：
// 1. 任何情况下都必须调用 showNotification —— 否则 Chrome 显示默认"已更新"通知
// 2. event.data 为 null（加密失败/空 payload）时也显示兜底通知
// 3. JSON 解析失败时不静默 return
self.addEventListener('push', (event) => {
  console.log('[SW] 收到推送通知')

  let title = 'HSNPhira'
  let body = '服务器有新消息'
  let icon = '/logo.png'
  let badge = '/pwa-192x192.png'
  let tag = 'hsnphira-notification'
  let notifData = {}

  if (event.data) {
    try {
      const payload = event.data.json()
      title    = payload.title  || title
      body     = payload.body   || body
      icon     = payload.icon   || icon
      tag      = payload.tag    || tag
      notifData = payload.data  || {}
    } catch (e) {
      const text = event.data.text()
      if (text) body = text
      console.warn('[SW] 推送 JSON 解析失败，使用文本:', text)
    }
  } else {
    console.warn('[SW] 推送 payload 为空（可能是 VAPID 密钥问题），展示兜底通知')
  }

  const options = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    requireInteraction: false,
    data: notifData,
    actions: [
      { action: 'open',    title: '查看房间' },
      { action: 'dismiss', title: '忽略'     }
    ]
  }

  // ⚠️ 必须用 event.waitUntil 包裹，否则 push handler 提前退出
  //    浏览器会显示 "phira.htadiy.com已更新" 这个默认通知
  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// ─────────────────────────────────────────
// 通知点击
// ─────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 通知点击:', event.action)
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = (event.notification.data && event.notification.data.url) || '/rooms'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({ type: 'NAVIGATE', url })
          return
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

// ─────────────────────────────────────────
// 订阅变更（修复：event.oldSubscription 可能为 null）
// ─────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] 推送订阅变更，重新订阅...')

  const options = (event.oldSubscription && event.oldSubscription.options) ||
    { userVisibleOnly: true }

  event.waitUntil(
    self.registration.pushManager.subscribe(options).then((newSubscription) => {
      return fetch('/hsnpm-api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubscription.toJSON())
      })
    }).catch((err) => {
      console.error('[SW] 重新订阅失败:', err)
    })
  )
})
