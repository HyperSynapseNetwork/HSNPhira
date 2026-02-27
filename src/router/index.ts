import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: 'HSN Phira多人游戏服务器 - 免费·多功能·稳定·低延迟',
      description: 'HyperSynapse Network Phira多人游戏服务器，为Phira玩家提供免费、稳定的多人联机服务',
      keywords: 'Phira,多人游戏,音游,联机服务器,HSN'
    }
  },
  {
    path: '/rooms',
    name: 'RoomList',
    component: () => import('@/views/RoomList.vue'),
    meta: {
      title: '房间列表 - HSN Phira服务器',
      description: '查看当前所有在线房间，加入你感兴趣的多人游戏',
      keywords: 'Phira房间,多人房间,联机游戏'
    }
  },
  {
    path: '/chart-ranking',
    name: 'ChartRanking',
    component: () => import('@/views/ChartRanking.vue'),
    meta: {
      title: '谱面排行 - HSN Phira服务器',
      description: '查看最热门的Phira谱面排行榜',
      keywords: 'Phira谱面,热门排行,谱面推荐'
    }
  },
  {
    path: '/user-ranking',
    name: 'UserRanking',
    component: () => import('@/views/UserRanking.vue'),
    meta: {
      title: '用户排行 - HSN Phira服务器',
      description: '查看游玩时间最长的玩家排行',
      keywords: 'Phira玩家,用户排行,游戏时长'
    }
  },
  {
    path: '/account',
    name: 'Account',
    component: () => import('@/views/Account.vue'),
    meta: {
      title: '账户管理 - HSN Phira服务器',
      description: '管理你的HSN账户信息',
      keywords: '账户管理,用户信息',
      requiresAuth: true
    }
  },
  {
    path: '/agreement',
    name: 'Agreement',
    component: () => import('@/views/Agreement.vue'),
    meta: {
      title: '用户协议 - HSN Phira服务器',
      description: 'HSN Phira服务器用户协议和免责声明',
      keywords: '用户协议,免责声明,服务条款'
    }
  },
  {
    path: '/announcement',
    name: 'Announcement',
    component: () => import('@/views/Announcement.vue'),
    meta: {
      title: '公告 - HSN Phira服务器',
      description: '查看最新公告和联系方式',
      keywords: '公告,联系方式,服务更新'
    }
  },
  {
    path: '/chart-download',
    name: 'ChartDownload',
    component: () => import('@/views/ChartDownload.vue'),
    meta: {
      title: '谱面下载工具 - HSN Phira服务器',
      description: '快速下载Phira谱面',
      keywords: '谱面下载,Phira谱面,下载工具'
    }
  },
  {
    path: '/phira-download',
    name: 'PhiraDownload',
    component: () => import('@/views/PhiraDownload.vue'),
    meta: {
      title: 'Phira下载站 - HSN Phira服务器',
      description: '下载Phira游戏客户端 - Android/Windows/Linux',
      keywords: 'Phira下载,Phira客户端,Phira安装'
    }
  },
  {
    path: '/navigation',
    name: 'Navigation',
    component: () => import('@/views/Navigation.vue'),
    meta: {
      title: '导航 - HSN Phira服务器',
      description: 'Phira相关资源导航',
      keywords: 'Phira导航,相关链接,资源导航'
    }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: {
      title: '关于我们 - HSN Phira服务器',
      description: '了解HyperSynapse Network团队和项目信息',
      keywords: '关于我们,团队介绍,联系我们'
    }
  },
  {
    path: '/md',
    name: 'DocsHome',
    component: () => import('@/views/DocsHome.vue'),
    meta: {
      title: '文档中心 - HSN Phira服务器',
      description: 'HSNPhira服务器相关文档和指南',
      keywords: '文档,指南,帮助,FAQ'
    }
  },
  {
    path: '/md/:pageId',
    name: 'DocPage',
    component: () => import('@/views/DocPage.vue'),
    meta: {
      title: '文档 - HSN Phira服务器',
      description: 'HSNPhira服务器文档',
      keywords: '文档,帮助'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: {
      title: '页面未找到 - HSN Phira服务器',
      description: '您访问的页面不存在',
      keywords: '404,页面未找到'
    }
  }
]
