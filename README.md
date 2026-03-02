# HSNPhira Frontend

HyperSynapse Network Phira多人游戏服务器前端应用

## 项目简介

> 本项目由多个顶尖AI研究所提供技术支持<br>
> 本项目使用了多种AI工具进行开发

这是一个基于 Vue 3 + TypeScript + Tailwind CSS 构建的现代化Web应用，为HSNPhira多人游戏服务器提供完整的前端界面。
HSNPhira Frontend由HSNPhira Backend与phira-mp-logprocessor提供后端支持

## 技术栈

- **框架**: Vue 3 (Composition API)
- **语言**: TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: Pinia
- **路由**: Vue Router
- **HTTP客户端**: Axios
- **静态站点生成 (SSG)**: vite-ssg

## 项目结构

```
HSNPhira/
├── public/                     # 静态资源
│   ├── config/                # 配置文件
│   │   ├── app.config.json    # 应用配置（API路由、外部服务地址等）
│   │   ├── preferences.config.json  # 用户偏好配置
│   │   ├── version.json       # 版本信息（用于自动更新检查）
│   │   ├── global.config.json       # 全局配置（服务器地址、QQ群等）
│   │   ├── download.config.json    # 下载页面配置
│   │   ├── navigation.config.json  # 导航页面配置
│   │   ├── announcement.config.json # 公告页面配置
│   │   ├── about.config.json       # 关于我们页面配置
│   │   └── docs.config.json        # 文档页面配置
│   ├── docs/                  # 文档目录
│   │   └── guide.md          # 指南文档
│   ├── images/               # 图片资源
│   ├── .well-known/          # 数字资产链接
│   │   └── assetlinks.json   # Android数字资产链接文件
│   └── index.html            # 主HTML文件
├── src/                       # Vue前端源代码
│   ├── api/                  # API接口层
│   │   ├── index.ts          # API客户端配置
│   │   ├── server.ts         # 服务器API封装
│   │   ├── charts.ts         # 谱面相关API
│   │   └── auth.ts           # 认证相关API
│   ├── components/           # 可复用组件
│   │   ├── common/          # 通用组件
│   │   │   ├── Button.vue      # 按钮组件
│   │   │   ├── Header.vue      # 头部导航组件
│   │   │   ├── Footer.vue      # 底部组件
│   │   │   ├── Message.vue     # 消息提示组件
│   │   │   └── Table.vue       # 表格组件
│   │   ├── windows/         # 窗口组件（模态框、弹窗）
│   │   │   ├── Window.vue                # 基础窗口组件
│   │   │   ├── WindowChart.vue           # 谱面详情窗口
│   │   │   ├── WindowChartDownload.vue   # 谱面下载窗口
│   │   │   ├── WindowRoomHistory.vue     # 游玩历史窗口
│   │   │   ├── WindowAuth.vue            # 认证窗口
│   │   │   ├── WindowRoomPlayers.vue     # 房间玩家窗口
│   │   │   └── WindowManager.vue         # 窗口管理器
│   │   ├── background/      # 背景效果组件
│   │   ├── Lightbox.vue     # 图片灯箱组件
│   │   ├── ServerStatus.vue # 服务器状态组件
│   │   └── PageUpdate.vue   # 页面更新提示组件
│   ├── i18n/                 # 国际化配置
│   │   └── index.ts         # 多语言翻译文件（支持zh、zh-TW、en、ja）
│   ├── router/               # 路由配置
│   ├── stores/               # 状态管理（Pinia）
│   │   ├── index.ts         # 用户状态管理
│   │   ├── i18n.ts          # 国际化状态管理
│   │   ├── theme.ts         # 主题状态管理（深色/浅色/高对比度）
│   │   └── windowManager.ts # 窗口管理器状态
│   ├── utils/                # 工具函数
│   │   ├── config.ts        # 配置文件加载和解析工具
│   │   ├── docs.ts          # 文档处理工具
│   │   ├── meta.ts          # Meta标签和SEO管理工具
│   │   ├── message.ts       # 消息工具函数
│   │   └── eventBus.ts      # 事件总线工具
│   ├── types/                # TypeScript类型定义
│   ├── styles/               # 全局样式
│   │   └── main.css         # Tailwind CSS和自定义样式
│   ├── views/                # 页面视图组件
│   │   ├── Home.vue         # 主页
│   │   ├── RoomList.vue     # 房间列表
│   │   ├── ChartRanking.vue # 谱面排行榜
│   │   ├── UserRanking.vue  # 用户排行榜
│   │   ├── Announcement.vue # 公告页面
│   │   ├── Agreement.vue    # 用户协议页面
│   │   ├── Account.vue      # 账户管理页面
│   │   ├── PhiraDownload.vue  # Phira下载页面
│   │   ├── ChartDownload.vue  # 谱面下载页面
│   │   ├── Navigation.vue     # 导航页面
│   │   ├── About.vue          # 关于我们页面
│   │   ├── DocsHome.vue       # 文档主页
│   │   ├── DocPage.vue        # 文档详情页
│   │   └── NotFound.vue       # 404页面
│   ├── App.vue               # 根组件
│   ├── main.ts               # 应用入口
│   └── vite-env.d.ts         # Vite环境类型定义
├── HSNPM/                     # Rust通知服务（WebPush后端）
│   ├── src/                  # Rust源代码
│   │   └── main.rs           # 主程序入口
│   ├── .env.example          # 环境变量示例
│   ├── Cargo.toml            # Rust依赖配置
│   ├── Cargo.lock            # 依赖锁定文件
│   ├── docker-compose.yml    # Docker Compose配置
│   ├── Dockerfile            # Docker构建配置
│   └── README.md             # HSNPM使用文档
├── twa/                       # TWA（Android应用）配置
│   └── twa-manifest.json     # TWA应用配置
├── scripts/                   # 构建和部署脚本
│   ├── setup-twa.sh          # TWA一键安装配置脚本（推荐）
│   ├── build-twa.sh          # TWA构建脚本（手动）
│   ├── build-twa-auto.sh     # TWA自动化构建脚本（CI/CD）
│   ├── update-download-config.js # 更新下载配置脚本
│   ├── setup-webpush.sh      # WebPush配置脚本
│   ├── generate-icons.js     # PWA图标生成脚本
│   ├── generate-seo-files.js # SEO文件生成脚本
│   ├── deploy-to-server.sh   # 服务器部署脚本
│   ├── deploy-hsnpm-start.sh # HSNPM启动脚本
│   ├── deploy-hsnpm-systemd.service # HSNPM systemd服务配置
│   └── verify-deployment.sh  # 部署验证脚本
├── images/                    # 项目图片资源
│   └── deploy-result.jpg     # 部署效果截图
├── .github/workflows/        # GitHub Actions工作流
│   ├── build-on-push.yml     # 构建工作流
│   └── deploy-on-push.yml    # 部署工作流（已禁用TWA构建）
├── package.json              # Node.js项目依赖和脚本
├── pnpm-lock.yaml            # pnpm依赖锁定文件
├── tsconfig.json             # TypeScript配置
├── tsconfig.node.json        # Node.js环境TypeScript配置
├── vite.config.ts            # Vite构建配置（包含API代理、PWA支持）
├── tailwind.config.js        # Tailwind CSS配置
├── postcss.config.js         # PostCSS配置
├── .env.development          # 开发环境变量（API目标地址）
├── index.html                # 主HTML文件（Vite入口）
├── README.md                 # 项目主文档
└── LICENSE                   # 许可证文件
```

**说明**：
- 项目采用模块化设计，关注点分离清晰
- API层统一管理所有网络请求，便于维护和测试
- 组件按功能分类，windows组件用于模态交互
- 国际化配置集中管理，支持多语言切换
- 状态管理使用Pinia，替代Vuex
- 样式基于Tailwind CSS，支持响应式设计
- 新增的配置文件系统支持动态页面内容管理
- 新增PWA支持，可将页面安装为独立应用
- 新增TWA支持，可通过Trusted Web Activity技术打包为Android应用
- 新增深色模式、高对比度模式主题切换
- 新增文档中心，支持Markdown格式文档渲染
- 新增Schema结构化数据，优化SEO
- 新增移动端全屏菜单，支持滚动条

**TWA相关目录**：
- `twa/` - TWA配置文件目录，包含`twa-manifest.json`等配置
- `public/.well-known/` - 数字资产链接文件目录，包含`assetlinks.json`
- `dist/apps/` - TWA构建输出目录，存放生成的APK文件
- `scripts/` - 包含TWA构建和配置脚本，特别是`setup-twa.sh`一键安装脚本

## 快速开始

### 环境要求

- **Node.js** >= 16.0.0（推荐使用18.x或20.x LTS版本）
- **包管理器**: pnpm >= 8.0.0

### 安装依赖

```bash
# 如果未安装pnpm，请先安装（推荐方式）
npm install -g pnpm

# 安装项目依赖
pnpm install

# 或使用npm（不推荐，可能导致依赖冲突）
# npm install
```

### 配置后端API

**重要**: 在启动项目前，需要配置后端API地址。项目支持两种配置方式：

#### 1. 开发环境变量配置（推荐用于本地开发）
编辑 `.env.development` 文件：

```bash
# 后端API服务器地址（默认本地开发地址）
VITE_API_TARGET=http://localhost:8080

# 启用Vite代理（推荐开发时启用）
VITE_USE_PROXY=true
```

**配置说明**：
- `VITE_API_TARGET`: 后端服务器地址，开发时通常为 `http://localhost:8080`
- `VITE_USE_PROXY`: 是否启用Vite开发代理，启用后特定API路径将通过Vite转发到后端

#### 2. 应用配置文件（推荐用于生产环境）
编辑 `public/config/app.config.json`：

```json
{
  "apiMode": "remote",                    // "local" 或 "remote"
  "remoteBaseURL": "https://phira.htadiy.com",
  "localBaseURL": "http://localhost:8080"
}
```

**两种配置的交互**：
- **本地开发推荐配置**：`apiMode: "local"` + `VITE_USE_PROXY=true` + `VITE_API_TARGET=http://localhost:8080`
- **连接远程服务器**：`apiMode: "remote"` + `VITE_USE_PROXY=false`
- **生产环境**：根据实际部署位置设置 `apiMode`（前端构建后，通过修改配置文件切换目标服务器）

**注意**：当 `VITE_USE_PROXY=true` 时，开发代理会覆盖部分 `apiMode` 配置。详细说明请查看[API集成](#api集成)章节。

### 开发模式

```bash
# 启动开发服务器
pnpm dev
# 或 npm run dev

# 应用将在 http://localhost:3000 启动
```

**开发注意事项**：
1. **确保后端运行**：启动前端前，确保后端服务器已在 `http://localhost:8080` 运行（或您配置的地址）
2. **代理配置**：如果 `VITE_USE_PROXY=true`，API请求将自动代理到后端
3. **热重载**：代码修改会自动刷新页面，提高开发效率
4. **控制台输出**：开发服务器会显示构建错误和TypeScript检查结果

### 构建生产版本

```bash
# 执行TypeScript类型检查并构建（标准 SPA 模式）
pnpm build
# 或 npm run build

# 构建产物将输出到 dist/ 目录
```

**构建说明**：
- 构建过程会执行 `vue-tsc` 进行类型检查，确保TypeScript代码正确性
- 生产构建会优化代码、压缩资源、生成sourcemap
- 构建产物为纯静态文件，可部署到任何Web服务器

### 构建 SSG（静态站点生成）版本

```bash
# 预渲染所有静态路由为 HTML 文件（SSG 模式）
pnpm build:ssg
# 或 npm run build:ssg
```

**SSG 说明**：

SSG（Static Site Generation）会在构建时将每个路由预渲染为对应的 `index.html` 文件，输出到 `dist/` 目录。相比普通 SPA 构建，SSG 的优势包括：

- **更好的 SEO**：搜索引擎爬虫可以直接抓取完整的 HTML 内容，无需等待 JS 执行
- **更快的首屏加载**：用户首次访问即可获得完整的 HTML，无需等待 Vue 渲染
- **社交分享友好**：各平台的 Open Graph 爬虫可正确解析页面 meta 信息

**预渲染的路由**（不含需要登录的动态路由）：

| 路由 | 输出文件 |
|------|---------|
| `/` | `dist/index.html` |
| `/rooms` | `dist/rooms/index.html` |
| `/chart-ranking` | `dist/chart-ranking/index.html` |
| `/user-ranking` | `dist/user-ranking/index.html` |
| `/agreement` | `dist/agreement/index.html` |
| `/announcement` | `dist/announcement/index.html` |
| `/chart-download` | `dist/chart-download/index.html` |
| `/phira-download` | `dist/phira-download/index.html` |
| `/navigation` | `dist/navigation/index.html` |
| `/about` | `dist/about/index.html` |
| `/docs` | `dist/docs/index.html` |
| `/docs/*` | `dist/docs/*/index.html`（动态生成，根据docs.config.json配置） |
| `/404` | `dist/404/index.html` |

> **注意**：
> - `/account` 路由因需要登录鉴权，不参与 SSG 预渲染，仍以 SPA 方式在客户端渲染。
> - `/docs/*` 路由为动态生成，根据 `docs.config.json` 配置生成对应的文档页面。
> - `/404` 页面用于处理不存在的路由。

**部署 SSG 产物**：SSG 构建产物与普通构建完全兼容，可以用相同的 Nginx/Apache 配置部署。需保留 `try_files $uri $uri/ /index.html;` 以确保 SPA 回退路由正常工作。

### 预览生产构建

```bash
# 本地预览生产构建结果
pnpm preview
# 或 npm run preview

# 预览服务将在 http://localhost:4173 启动
```

**预览功能**：
- 使用Vite的预览服务器，模拟生产环境
- 检查构建产物是否正确运行
- 验证API代理在生产环境下的行为

## 配置说明

### 应用配置 (public/config/app.config.json)

```json
{
  "apiMode": "remote",                    // API模式: local（本地）或 remote（远程）
  "remoteBaseURL": "https://phira.htadiy.com",  // 远程API服务器地址
  "localBaseURL": "http://localhost:8080",      // 本地开发服务器地址
  "routes": {                              // API路由配置
    "auth": { "login": "/api/auth/login", ... },
    "rooms": { "list": "/api/rooms/info", ... },
    "charts": {
      "rank": "/chart/:id/rank",
      "chartRank": "/topchart/chart_rank/:chart_id",
      "hotRank": "/topchart/hot_rank/:timeRange"  // 注意：完整路径
    },
    "playtime": { "leaderboard": "/rankapi/playtime_leaderboard" }
  },
  "externalAPI": {
    "phiraBaseURL": "https://phira.5wyxi.com"  // 外部Phira API地址
  },
  "background": {
    "defaultImageURL": "https://webstatic.cn-nb1.rains3.com/5712×3360.jpeg"
  }
}
```

### 用户偏好配置 (public/config/preferences.config.json)

支持以下自定义选项:
- 主题颜色
- 毛玻璃背景透明度
- 背景粒子效果
- 背景图片
- 显示语言

### 全局配置 (public/config/global.config.json)

配置全局共享信息：
- 全局Phira服务器地址
- 全局QQ群号
- 统一页面中的服务器地址和联系信息显示

### 下载页面配置 (public/config/download.config.json)

配置Phira下载页面：
- 最新版本号（如v0.6.7）
- 下载卡片配置（标题、介绍、按钮文字、按钮链接的多语言支持）

### 导航页面配置 (public/config/navigation.config.json)

配置导航页面的卡片组和卡片：
- 卡片组（官方、联机服务器、社区开源仓库）的多语言名称
- 卡片的多语言标题和链接

### 公告页面配置 (public/config/announcement.config.json)

配置公告页面的公告卡片：
- 公告标题、时间、正文的多语言支持
- 支持动态添加和修改公告

### 关于我们页面配置 (public/config/about.config.json)

配置关于我们页面：
- 团队介绍文本的多语言支持
- 团队成员信息（名称、头像、主页链接）
- 致谢列表（名称、头像ID、贡献描述）

### 文档页面配置 (public/config/docs.config.json)

配置文档中心：
- 文档ID、路由名、页面标题、meta标签
- 文档文件地址映射
- 支持动态添加文档

## API集成

项目已预配置以下API端点，并已配置Vite开发代理：

### API端点配置
- 认证: `/api/auth/*`
- 房间: `/api/rooms/*`
- 排行榜: `/rankapi/playtime_leaderboard`
- 谱面信息: `/chart/*`
- 谱面排名: `/topchart/chart_rank/*`
- 谱面热门排行: `/topchart/hot_rank/*`（注意：路径为 `/topchart/hot_rank/`）
- 用户排行: `/user_rank/*`

### API模式配置（apiMode）
应用支持两种API模式，通过 `public/config/app.config.json` 中的 `apiMode` 配置：

```json
{
  "apiMode": "remote",                    // "local" 或 "remote"
  "remoteBaseURL": "https://phira.htadiy.com",
  "localBaseURL": "http://localhost:8080"
}
```

- **local 模式**：API请求发送到 `localBaseURL`（通常为本地开发服务器）
- **remote 模式**：API请求发送到 `remoteBaseURL`（生产服务器）

**注意**：在开发环境中，此配置的行为受 `VITE_USE_PROXY` 环境变量影响：
- 当 `VITE_USE_PROXY=true`（默认）时，开发服务器会代理特定路径到 `VITE_API_TARGET`，覆盖部分 `apiMode` 配置
- 当 `VITE_USE_PROXY=false` 时，`apiMode` 配置会完全生效

### 开发代理配置
在 `vite.config.ts` 中已配置以下代理规则（当 `VITE_USE_PROXY=true` 时生效）：

```javascript
proxy: {
  '/api': { target: 'http://localhost:8080' },
  '/rankapi': { target: 'http://localhost:8080' },
  '/chart': { target: 'http://localhost:8080' },
  '/topchart/hot_rank': { target: 'http://localhost:8080' },
  '/topchart/chart_rank': { target: 'http://localhost:8080' },
  '/chart_rank': { target: 'http://localhost:8080' },
  '/user_rank': { target: 'http://localhost:8080' }
}
```

**代理与apiMode的交互**：
- 开发环境中，对于使用Axios API实例的请求，代理会接管并忽略 `apiMode`
- 开发环境中，直接使用 `fetch()` 的请求会遵循 `apiMode` 配置
- 生产环境中，所有请求都遵循 `apiMode` 配置

### 外部API
部分功能（如谱面详情、用户头像）会直接调用外部Phira API（`https://phira.5wyxi.com`），这些请求不走代理，也不受 `apiMode` 影响。

### 推荐配置方案
1. **本地开发**：设置 `apiMode: "local"`，`VITE_USE_PROXY=true`，`VITE_API_TARGET=http://localhost:8080`
2. **连接远程服务器**：设置 `apiMode: "remote"`，`VITE_USE_PROXY=false`
3. **生产环境**：根据部署位置设置 `apiMode` 为 `local` 或 `remote`

## 部署

### Nginx配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend-server:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 压缩优化

项目构建时会自动生成 Brotli (`.br`) 和 Gzip (`.gz`) 压缩文件。要启用服务器端预压缩文件支持，请更新 Nginx 配置：

```nginx
# 在 http 或 server 块中添加以下配置
gzip_static on;          # 启用预压缩的 .gz 文件
brotli_static on;        # 启用预压缩的 .br 文件（需要 ngx_brotli 模块）
gzip_vary on;            # 添加 Vary: Accept-Encoding 响应头

# 如果未安装 ngx_brotli 模块，可以启用动态压缩
# gzip on;
# gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
# brotli on;
# brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

完整的 Nginx 配置示例（支持预压缩文件）：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    # 压缩优化配置
    gzip_static on;
    brotli_static on;
    gzip_vary on;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend-server:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**注意**：
- 预压缩文件由 `vite-plugin-compression` 在构建时生成，无需实时压缩开销
- 确保 Nginx 编译时包含 `--with-http_gzip_static_module` 和 `--add-module=/path/to/ngx_brotli`（如需 Brotli 支持）
- 浏览器会自动根据 `Accept-Encoding` 请求头接收合适的压缩格式

### TWA 构建（Android 应用）

HSNPhira 支持通过 Trusted Web Activity (TWA) 技术打包为 Android 应用，提供原生应用体验。

#### 使用一键安装脚本（推荐）

项目提供了 `setup-twa.sh` 一键安装脚本，支持自动检测文件、生成所需文件、共享密钥库等签名文件。

##### 功能特性

- **自动检测**：检测 Java、Node.js、bubblewrap 等依赖
- **智能配置**：自动创建/更新 TWA manifest 配置文件
- **密钥库管理**：支持导入现有密钥库或创建新的调试密钥库
- **数字资产链接**：自动生成并配置 `assetlinks.json`
- **下载配置**：更新下载页面配置文件
- **一键构建**：支持配置完成后自动构建 APK

##### 使用方法

1. **交互式配置**（推荐初次使用）：
   ```bash
   ./scripts/setup-twa.sh
   ```
   脚本会引导您完成所有配置步骤，包括密钥库设置、数字资产链接配置等。

2. **自动模式**：
   ```bash
   ./scripts/setup-twa.sh --auto --build
   ```
   自动完成所有配置并构建 APK，使用默认值。

3. **使用现有密钥库**：
   ```bash
   ./scripts/setup-twa.sh --keystore path/to/keystore \
                         --password your_password \
                         --alias key_alias \
                         --fingerprint sha256_fingerprint \
                         --build
   ```

4. **仅构建**（在配置完成后）：
   ```bash
   ./scripts/setup-twa.sh --build
   ```

##### 脚本选项

| 选项 | 说明 |
|------|------|
| `-h, --help` | 显示帮助信息 |
| `-a, --auto` | 自动模式（非交互式） |
| `-k, --keystore <文件>` | 指定密钥库文件路径 |
| `-p, --password <密码>` | 指定密钥库密码 |
| `-A, --alias <别名>` | 指定密钥别名 |
| `-f, --fingerprint <指纹>` | 指定 SHA256 证书指纹 |
| `-d, --domain <域名>` | 指定数字资产链接域名 |
| `-b, --build` | 构建 TWA APK |
| `-s, --skip-deps` | 跳过依赖检查 |

#### 手动构建步骤（备用方案）

如果您需要手动控制构建过程，可以按照以下步骤操作：

1. **环境准备**
   - 安装 Java 11+ 和 Node.js
   - 全局安装 `@bubblewrap/cli`：
     ```bash
     npm install -g @bubblewrap/cli
     ```
   - 确保已完成前端构建：`pnpm build`

2. **构建步骤**
   - 运行原始构建脚本：
     ```bash
     ./scripts/build-twa.sh
     ```
     或使用自动化脚本：
     ```bash
     ./scripts/build-twa-auto.sh
     ```

3. **部署数字资产链接**
   - 将 `public/.well-known/assetlinks.json` 部署到网站根目录
   - 确保 JSON 中的 SHA256 指纹与您的签名密钥匹配
   - 数字资产链接必须可通过 `https://your-domain.com/.well-known/assetlinks.json` 访问

#### 注意事项

- **HTTPS 要求**：TWA 要求网站支持 HTTPS
- **密钥安全**：妥善保管生产环境签名密钥
- **版本管理**：更新应用版本时，需更新 `twa/twa-manifest.json` 中的版本号
- **数字资产链接**：必须正确配置数字资产链接才能通过 Android 验证
- **浏览器支持**：TWA 需要 Chrome 72+ 或支持 Trusted Web Activities 的浏览器

更多细节请参考 [Google TWA 文档](https://developers.google.com/web/android/trusted-web-activity)。

## 开发指南

### 添加新页面

1. 在 `src/views/` 创建新的 Vue 组件
2. 在 `src/router/index.ts` 添加路由配置
3. 在 `Header.vue` 的 `navRoutes` 数组中添加导航链接

### 添加新API

1. 在 `src/api/` 创建对应的API模块
2. 在 `src/types/index.ts` 定义相关类型
3. 在组件中导入并使用

### 自定义样式

- 全局样式: `src/styles/main.css`
- Tailwind配置: `tailwind.config.js`
- 主题色通过CSS变量 `--primary-color` 控制

## 浏览器支持

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## 效果
可以前往 [HSNPhira官网](https://phira.htadiy.com/) 查看部署效果
![部署完成后的首页](images/deploy-result.jpg)

## 许可证

本项目采用 GNU Affero General Public License（AGPL）3.0 开源协议。

### 版权声明
版权所有 © HyperSynapse Network。保留所有权利。

### 开发者义务
根据 AGPL-3.0 协议，使用、修改或分发本项目的开发者必须：
- 保留原项目的版权和许可证声明。
- 在分发时提供完整的源代码。
- 任何基于本项目的衍生作品也必须使用 AGPL-3.0 协议开源。

详细条款请查看 [GNU AGPL v3.0](https://www.gnu.org/licenses/agpl-3.0.html) 许可证全文。

## 联系方式

- QQ群: 1049578201
- 邮箱: nb3502022@outlook.com
- GitHub: https://github.com/HyperSynapseNetwork/HSNPhira

## 致谢

感谢以下朋友为本项目做出的贡献，没有他们就没有本项目的现在（排名不分先后，如有遗漏非常抱歉）：

### 开发贡献
感谢以下开发者为项目开发、测试与资助做出的贡献：
*   **[TeamFlos](https://github.com/TeamFlos)**
    *   原项目 **Phira**：[Phira](https://github.com/TeamFlos/Phira)
    *   原项目 **Phira-MP**：[Phira-MP](https://github.com/TeamFlos/Phira-MP)
*   **[htadiy](https://github.com/htadiy)**
*   **[ExplodingKonjac](https://github.com/ExplodingKonjac)**
*   **[LY-Xiang](https://github.com/LY-Xiang)**
*   **[AFewSuns](https://github.com/AFewSuns)**

### 设计、资助与支持
*   感谢 **Ght/F=1** 参与设计了本项目图标。 **[Dmocken](https://github.com/Dmocken)** 为本项目宣传与监控服务器状态提供了支持。
*   感谢 **其他所有为本项目提供过支持的捐献者** 。
*   感谢 **所有使用过HSNPhira提供的服务的玩家** 。

### 社区贡献
感谢其他所有为 Phira 开源社区生态做出贡献的开发者！

### 特别感谢
感谢 **Claude** 与 **Deepseek** 对本项目的支持。
感谢 **雨云** 对本项目的支持
