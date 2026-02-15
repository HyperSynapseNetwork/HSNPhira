import api from './index'
import { getAPIRoute } from '@/utils/config'
import type { Room, GameHistory } from '@/types'

export const roomsAPI = {
  // 获取房间列表
  getRoomList(): Promise<Room[]> {
    return api.get(getAPIRoute('rooms', 'list'))
  },

  // 获取房间历史记录
  getRoomHistory(roomId: string): Promise<GameHistory[]> {
    return api.get(getAPIRoute('rooms', 'history'), {
      params: { room_id: roomId }
    })
  },
}
