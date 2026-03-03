// HSNPhira Service Worker - 用于推送通知和离线缓存

const CACHE_NAME = 'hsnphira-v1'
const OFFLINE_URL = '/offline.html'

// 需要缓存的资源
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/css/main.css',
  '/js/main.js'
]

// 安装 Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] 安装中...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] 缓存静态资源')
        return cache.addAll(STATIC_CACHE_URLS)
      })
      .then(() => {
        console.log('[Service Worker] 安装完成，跳过等待')
        return self.skipWaiting()
      })
  )
})

// 激活 Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] 激活中...')
  
  // 清理旧缓存
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 删除旧缓存:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
    .then(() => {
      console.log('[Service Worker] 激活完成，接管页面')
      return self.clients.claim()
    })
  )
})

// 拦截网络请求
self.addEventListener('fetch', event => {
  // 跳过非 GET 请求
  if (event.request.method !== 'GET') return

  // 跳过 Chrome 扩展等
  if (event.request.url.startsWith('chrome-extension://')) return

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 返回缓存响应，否则从网络获取
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // 将新响应添加到缓存
            if (event.request.method === 'GET' && networkResponse.ok) {
              const responseToCache = networkResponse.clone()
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseToCache))
            }
            return networkResponse
          })
          .catch(error => {
            console.error('[Service Worker] 获取失败:', error)
            
            // 如果请求的是 HTML 页面，返回离线页面
            if (event.request.destination === 'document') {
              return caches.match(OFFLINE_URL)
            }
            
            // 其他情况返回缓存响应
            return cachedResponse
          })

        return cachedResponse || fetchPromise
      })
  )
})

// 处理推送通知
self.addEventListener('push', event => {
  console.log('[Service Worker] 收到推送通知:', event)

  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch (e) {
    console.warn('[Service Worker] 推送数据不是 JSON 格式，使用默认消息')
    data = {
      title: 'HSNPhira',
      body: '您收到一条新消息',
      icon: '/logo.png'
    }
  }

  const options = {
    body: data.body || 'HSNPhira服务器通知',
    icon: data.icon || '/logo.png',
    badge: '/logo.png',
    tag: data.tag || 'hsnphira-notification',
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: '打开' },
      { action: 'dismiss', title: '忽略' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'HSNPhira', options)
  )
})

// 处理通知点击
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] 通知被点击:', event.notification.tag)

  event.notification.close()

  const data = event.notification.data || {}
  const url = data.url || '/'

  if (event.action === 'open' || event.action === '') {
    // 打开对应页面
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
          // 如果有打开的客户端，聚焦它
          for (const client of clients) {
            if (client.url === url && 'focus' in client) {
              return client.focus()
            }
          }
          
          // 否则打开新窗口
          if (self.clients.openWindow) {
            return self.clients.openWindow(url)
          }
        })
    )
  } else if (event.action === 'dismiss') {
    // 忽略通知，不做任何操作
    console.log('[Service Worker] 通知被忽略')
  }
})

// 处理推送订阅变更
self.addEventListener('pushsubscriptionchange', event => {
  console.log('[Service Worker] 推送订阅变更:', event)

  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(newSubscription => {
        // 将新的订阅信息发送到服务器
        return fetch('/hsnpm-api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSubscription)
        })
      })
      .catch(error => {
        console.error('[Service Worker] 更新订阅失败:', error)
      })
  )
})