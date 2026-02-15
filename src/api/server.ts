import api from './index'
import { getAPIRoute } from '@/utils/config'

export const serverAPI = {
  // 获取服务器状态
  getStatus(): Promise<any> {
    return api.get(getAPIRoute('server', 'status'))
  },

  // 获取服务器历史数据
  getHistory(hours?: number): Promise<any> {
    const params: Record<string, any> = {}
    if (hours !== undefined) {
      params.hours = hours
    }
    return api.get(getAPIRoute('server', 'history'), {
      params
    })
  },

  // 获取游玩时间排行榜
  getPlaytimeLeaderboard(): Promise<any> {
    return api.get(getAPIRoute('playtime', 'leaderboard'))
  },
}

// 向后兼容的别名
export const statusAPI = serverAPI