import api from './index'
import { getAPIRoute } from '@/utils/config'
import type { User } from '@/types'

export interface LoginData {
  username: string
  password: string
  remember: boolean
}

export interface RegisterData {
  username: string
  password: string
  phira_id_or_username: string
  group_id?: number
}

export const authAPI = {
  // 登录
  login(data: LoginData): Promise<User> {
    return api.post(getAPIRoute('auth', 'login'), data)
  },

  // 登出
  logout(): Promise<void> {
    return api.post(getAPIRoute('auth', 'logout'))
  },

  // 获取当前用户信息
  me(): Promise<User> {
    return api.get(getAPIRoute('auth', 'me'))
  },

  // 注册（返回SSE流）
  async register(data: RegisterData): Promise<EventSource> {
    const url = getAPIRoute('auth', 'register')
    
    // 先发送POST请求开始注册流程
    await api.post(url, data)
    
    // 创建EventSource监听SSE事件
    const eventSource = new EventSource(url, {
      withCredentials: true,
    })

    return eventSource
  },

  // 获取访问计数
  getVisitedCount(): Promise<number> {
    return api.get(getAPIRoute('auth', 'visitedCount'))
  },
}
