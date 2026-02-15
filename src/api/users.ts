import api from './index'
import axios from 'axios'
import { getAPIRoute, getPhiraBaseURL } from '@/utils/config'

export const usersAPI = {
  // 获取用户排行（兼容旧API）
  getUserRank(timeRange: string, page = 1, perPage = 20): Promise<any> {
    return api.get(getAPIRoute('users', 'rank', { timeRange }), {
      params: { page, per_page: perPage }
    })
  },

  // 根据用户ID获取用户信息（从Phira API）
  async getUserById(userId: number): Promise<any> {
    const baseURL = getPhiraBaseURL()
    const response = await axios.get(`${baseURL}/user/${userId}`)
    return response.data
  },
}
