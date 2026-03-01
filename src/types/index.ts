// 用户信息
export interface User {
  id: number
  group_id: number
  username: string
  phira_id: number
  phira_username: string
  phira_rks: number
  phira_avatar: string
  register_time: string
  last_login_time: string
  last_sync_time: string
}

// 房间信息
export interface Room {
  id: string
  name: string
  owner: string
  owner_id: number
  player_count: number
  max_players: number
  status: string
  is_cycling: boolean
  chart_id?: number
  chart_name?: string
  chart_image?: string
  chart_file?: string
  players: Player[]
  // 房间游玩历史（来自API的rounds字段）
  history?: Array<{
    chart: number
    records: Array<{
      id: number
      player: number
      score: number
      perfect: number
      good: number
      bad: number
      miss: number
      max_combo: number
      accuracy: number
      full_combo: boolean
      std: number
      std_score: number
    }>
  }>
}

// 玩家信息
export interface Player {
  id: number
  username: string
  phira_id: number
  is_owner: boolean
}

// 游戏历史
export interface GameHistory {
  chart_id: number
  chart_name: string
  chart_image: string
  play_time: string
  players: PlayerScore[]
}

// 玩家成绩
export interface PlayerScore {
  user_id: number
  username: string
  phira_id: number
  score: number
  accuracy: number
  perfect: number
  good: number
  bad: number
  miss: number
  max_combo: number
}

// 谱面排行
export interface ChartRank {
  rank: number
  chart_id: number
  chart_name: string
  chart_image: string
  play_count: number
  increase: number
}

// 用户排行
export interface UserRank {
  rank: number
  user_id: number
  username: string
  phira_id: number
  play_time: number
}

// 谱面详情
export interface ChartDetail {
  id: number
  name: string
  composer: string
  illustrator: string
  charter_id: number
  charter_name: string
  difficulty: number
  description: string
  image_url: string
  preview_url: string
  audio_url: string
  file_url: string
}

// 谱面成绩记录
export interface ChartRecord {
  rank: number
  player_id: number
  player_name: string
  player_avatar: string
  score: number
  accuracy: number
  perfect: number
  good: number
  bad: number
  miss: number
  time: string
}

// 多语言文本内容
export interface MultiLanguageText {
  zh: string
  'zh-TW': string
  en: string
  ja: string
}

// 配置文件类型
export interface AppConfig {
  apiMode: 'local' | 'remote'
  remoteBaseURL: string
  localBaseURL: string
  routes: Record<string, Record<string, string>>
  externalAPI: {
    phiraBaseURL: string
  }
  header: {
    visiblePages: string[]
  }
  background: {
    defaultImageURL: string
  }
  particleEffects: Record<string, string>
  versionFileURL: string
  meta: Record<string, any>
}

// 用户偏好配置
export interface PreferenceGroup {
  id: string
  name: string
  name_zh: string
}

export interface PreferenceOption {
  value: string
  name: string
  name_zh: string
}

export interface PreferenceConstraints {
  min: number
  max: number
  step?: number
}

export interface Preference {
  id: string
  group: string
  type: 'boolean' | 'free' | 'option' | 'restricted'
  name: string
  name_zh: string
  default: any
  multiple?: boolean
  options?: PreferenceOption[]
  placeholder?: string
  placeholder_zh?: string
  constraints?: PreferenceConstraints
  description?: string
}

export interface PreferencesConfig {
  version: string
  appId: string
  groups: PreferenceGroup[]
  preferences: Preference[]
}

// 消息类型
export interface Message {
  title: string
  content: string
  backgroundColor?: string
  duration?: number
}

// 服务器状态
export interface ServerStatus {
  online: boolean
  availability: number
  latency: number
}

// 全局配置
export interface GlobalConfig {
  server: {
    phiraServerAddress: MultiLanguageText
    qqGroup: MultiLanguageText
    hsnmcServerAddress: MultiLanguageText
  }
}

// 下载配置
export interface DownloadCard {
  id: string
  title: MultiLanguageText
  description: MultiLanguageText
  buttonText: MultiLanguageText
  buttonLink: string
}

export interface DownloadConfig {
  latestVersion: string
  downloadCards: DownloadCard[]
  hsnphiraApps?: DownloadCard[]
}

// 导航配置
export interface CardGroup {
  id: string
  name: MultiLanguageText
}

export interface NavigationCard {
  id: string
  groupId: string
  title: MultiLanguageText
  link: string
}

export interface NavigationConfig {
  cardGroups: CardGroup[]
  cards: NavigationCard[]
}

// 公告配置
export interface Announcement {
  id: string
  title: MultiLanguageText
  time: string
  content: MultiLanguageText
}

export interface AnnouncementConfig {
  announcements: Announcement[]
}

// 关于配置
export interface TeamMember {
  id: string
  name: string
  avatar: string
  homepage: string
}

export interface Acknowledgement {
  id: string
  name: string
  avatarId: string
  contribution: string
}

export interface AboutConfig {
  teamIntroduction: MultiLanguageText
  teamMembers: TeamMember[]
  acknowledgements: Acknowledgement[]
}

// 文档配置（已存在，但需要完善）
export interface DocConfig {
  cards: DocCard[]
  pages: Record<string, DocPage>
  categories: Record<string, DocCategory>
}

export interface DocCard {
  id: string
  icon: string
  order: number
  category: string
  title: MultiLanguageText
  description: MultiLanguageText
}

export interface DocPage {
  title: MultiLanguageText
  description: MultiLanguageText
  content?: MultiLanguageText
  file?: string
}

export interface DocCategory {
  title: MultiLanguageText
  description: MultiLanguageText
}
