# HSNPM 通知服务

HSNPhira 房间新增 Web-Push 通知服务后端，基于 Rust 实现。监听远程 Phira 服务器的房间事件，通过 Web-Push 向订阅者发送浏览器推送通知。

## 功能特性

- **远程SSE监听**：自动连接到远程 Phira 服务器的 SSE 事件流 (`/api/rooms/listen`)
- **Web-Push 通知**：当有新房间创建时，向所有订阅者发送浏览器推送通知
- **VAPID 认证**：安全的 Web-Push 端点认证
- **自动重连**：SSE 连接断开时自动重试
- **CORS 支持**：允许跨域请求，方便前端集成

## 架构概述

```
远程 Phira 服务器 (phira.htadiy.com)
        ↓ SSE 事件流 (/api/rooms/listen)
HSNPM 通知服务 (监听远程SSE)
        ↓ Web-Push 通知
前端浏览器 (通过 Service Worker 接收推送)
```

## 快速开始

### 环境要求

- Rust 1.70+ 和 Cargo
- OpenSSL 开发库
- Node.js（用于生成 VAPID 密钥）

### 安装和运行

1. 进入 HSNPM 目录：
   ```bash
   cd HSNPM
   ```

2. 复制环境变量文件并配置：
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，设置 VAPID 密钥
   ```

3. 生成 VAPID 密钥：
   ```bash
   # 安装 web-push 工具
   npm install -g web-push

   # 生成密钥对
   web-push generate-vapid-keys

   # 将输出的私钥（PEM格式）设置为 VAPID_PRIVATE_KEY
   # 将公钥（Base64）设置为 VAPID_PUBLIC_KEY
   # VAPID_SUBJECT 设置为您的邮箱（格式：mailto:your-email@example.com）
   ```

4. 编译和运行：
   ```bash
   cargo run
   ```

5. 服务将在 `http://localhost:3030` 启动，并自动连接到远程 SSE。

## API 文档

### 1. Web-Push 订阅端点

**POST /api/subscriptions**

前端注册 Web-Push 订阅。

**请求体**：
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BP4...",
    "auth": "kH..."
  },
  "expires_at": "2026-03-01T12:00:00Z",
  "user_id": 12345
}
```

**响应**：
```json
{
  "success": true,
  "id": "subscription-id"
}
```

### 2. 健康检查

**GET /health**

返回 "OK" 表示服务正常。

## 配置说明

### 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| PORT | 服务监听端口 | 3030 |
| VAPID_PRIVATE_KEY | VAPID 私钥（PEM格式） | -----BEGIN EC PRIVATE KEY-----... |
| VAPID_PUBLIC_KEY | VAPID 公钥（Base64） | BEl... |
| VAPID_SUBJECT | VAPID 主题（邮箱） | mailto:admin@example.com |
| REMOTE_PHIRA_SERVER | 远程 Phira 服务器地址 | https://phira.htadiy.com |
| RUST_LOG | 日志级别 | info |

### 事件处理

HSNPM 会自动监听远程服务器的 SSE 事件流，当收到 `create_room` 事件时，会：
1. 解析房间信息和房主ID
2. 向所有注册的 Web-Push 订阅者发送推送通知
3. 通知标题："HSNPhira服务器上有新房间"
4. 通知内容："房间名:{房间名} 房主:{房主名}"

## 前端集成

### Web-Push 订阅示例

```javascript
// 前端订阅 Web-Push
async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('浏览器不支持 Web-Push');
    return;
  }

  // 注册 Service Worker
  const registration = await navigator.serviceWorker.register('/sw.js');
  
  // 请求推送权限
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('推送权限被拒绝');
  }

  // 订阅推送
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY')
  });

  // 将订阅信息发送到 HSNPM 服务器
  const response = await fetch('http://localhost:3030/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription)
  });

  if (!response.ok) {
    throw new Error('订阅注册失败');
  }

  console.log('Web-Push 订阅成功');
}
```

### Service Worker 示例 (sw.js)

```javascript
// 监听推送事件
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body || '新房间创建通知',
    icon: data.icon || '/logo.png',
    tag: data.tag || 'room-creation',
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: '查看房间' },
      { action: 'dismiss', title: '忽略' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'HSNPhira 通知', options)
  );
});

// 监听通知点击
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
```

## 部署

### Docker 部署

1. 构建 Docker 镜像：
   ```bash
   docker build -t hsnpm-notification .
   ```

2. 运行容器：
   ```bash
   docker run -d \
     --name hsnpm-notification \
     -p 3030:3030 \
     --env-file .env \
     hsnpm-notification
   ```

### 系统服务（systemd）

创建 `/etc/systemd/system/hsnpm-notification.service`：
```ini
[Unit]
Description=HSNPM Notification Service
After=network.target

[Service]
Type=simple
User=hsn
WorkingDirectory=/opt/hsnpm
EnvironmentFile=/opt/hsnpm/.env
ExecStart=/usr/local/bin/hsnpm-notification
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## 故障排除

### 常见问题

1. **VAPID 密钥错误**
   - 确保私钥是有效的 PEM 格式
   - 检查公钥是否正确（Base64格式）
   - 确认 VAPID_SUBJECT 格式正确（mailto:email@example.com）

2. **SSE 连接失败**
   - 检查远程服务器地址是否正确
   - 确认网络可以访问远程服务器
   - 查看防火墙设置

3. **Web-Push 发送失败**
   - 检查订阅信息是否正确
   - 确认浏览器支持 Web Push
   - 查看服务端日志获取详细错误信息

### 日志查看

```bash
# 查看实时日志
journalctl -u hsnpm-notification -f

# 查看指定时间范围的日志
journalctl -u hsnpm-notification --since "2026-03-01 12:00:00"
```

## 许可证

本项目采用 GNU Affero General Public License v3.0 (AGPL-3.0) 许可证。

## 联系方式

- GitHub: [HyperSynapseNetwork/HSNPhira](https://github.com/HyperSynapseNetwork/HSNPhira)
- QQ群: 1049578201
- 邮箱: nb3502022@outlook.com