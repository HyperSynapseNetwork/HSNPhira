import api from './index'
import axios from 'axios'
import { getAPIRoute, getPhiraBaseURL } from '@/utils/config'
import type { ChartDetail } from '@/types'

export const chartsAPI = {
  // 获取谱面排行信息（/chart/:id/rank）
  getChartRank(chartId: number): Promise<any> {
    return api.get(getAPIRoute('charts', 'rank', { id: chartId.toString() }))
  },

  // 获取谱面排名详情（/chart_rank/:chart_id）
  getChartRankDetail(chartId: number): Promise<any> {
    return api.get(getAPIRoute('charts', 'chartRank', { chart_id: chartId.toString() }))
  },

  // 获取热门谱面排行
  getHotRank(timeRange: string, page = 1, perPage = 20): Promise<any> {
    return api.get(getAPIRoute('charts', 'hotRank', { timeRange }), {
      params: { page, per_page: perPage }
    })
  },

  // 从Phira获取谱面详情
  async getChartDetail(chartId: number): Promise<ChartDetail> {
    const baseURL = getPhiraBaseURL()
    const response = await axios.get(`${baseURL}/chart/${chartId}`)
    const data = response.data
    // 映射字段到ChartDetail接口
    return {
      id: data.id,
      name: data.name,
      composer: data.composer || '',
      illustrator: data.illustrator || '',
      charter_id: data.charter_id || data.uploader || 0,
      charter_name: data.charter || '',
      difficulty: data.difficulty || 0,
      description: data.description || '',
      image_url: data.illustration || data.cover_url || '',
      preview_url: data.preview || '',
      audio_url: data.preview || '',
      file_url: data.file || ''
    }
  },

  // 从Phira获取谱面成绩排行
  async getChartRecords(chartId: number, page = 1, pageNum = 20): Promise<{ count: number, results: any[] }> {
    const baseURL = getPhiraBaseURL()
    // API限制每页最大30条记录
    const limitedPageNum = Math.min(pageNum, 30)
    const response = await axios.get(`${baseURL}/record/query/${chartId}`, {
      params: {
        pageNum: limitedPageNum,
        includePlayer: true,
        best: true,
        page,
        std: false
      }
    })
    // API返回格式：{ count: number, results: [...] }
    const data = response.data
    // 映射字段到前端期望的格式
    const mappedResults = data.results.map((record: any) => ({
      player_id: record.player,
      player_name: record.playerName || `玩家${record.player}`,
      player_avatar: record.playerAvatar || '',
      score: record.score,
      accuracy: record.accuracy,
      perfect: record.perfect,
      good: record.good,
      bad: record.bad,
      miss: record.miss,
      max_combo: record.max_combo,
      time: record.time,
      std: record.std,
      std_score: record.std_score,
      full_combo: record.full_combo
    }))
    return {
      count: data.count,
      results: mappedResults
    }
  },
}
