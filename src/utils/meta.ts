import { getAppConfig } from './config'
import { useI18nStore } from '@/stores/i18n'
import type { Language } from '@/i18n'

// 结构化数据类型定义
export interface SchemaData {
  '@context': string
  '@type': string
  [key: string]: any
}

export interface PageMeta {
  title: Record<Language, string>
  description: Record<Language, string>
  keywords?: Record<Language, string>
}

export async function getPageMeta(routeName: string): Promise<PageMeta | null> {
  const config = getAppConfig()
  
  // 检查是否是文档页面
  if (routeName === 'docs-home' || routeName.startsWith('doc-')) {
    try {
      // 动态导入docs工具，避免循环依赖
      const { loadDocsConfig, getDocPage } = await import('./docs')
      await loadDocsConfig()
      
      let pageId: string
      if (routeName === 'docs-home') {
        pageId = 'home'
      } else {
        pageId = routeName.replace('doc-', '')
      }
      
      const page = getDocPage(pageId)
      if (page) {
        return {
          title: page.title,
          description: page.description,
          keywords: {
            'zh': '文档,指南,帮助',
            'zh-TW': '文檔,指南,幫助',
            'en': 'documentation,guide,help',
            'ja': 'ドキュメント,ガイド,ヘルプ'
          }
        }
      }
    } catch (error) {
      console.error('Error loading docs meta:', error)
      // 回退到app.config.json中的配置
    }
  }
  
  // 从app.config.json获取
  const meta = config.meta?.[routeName]
  if (!meta) return null
  return meta as PageMeta
}

export async function setPageMeta(routeName: string, language: Language) {
  const meta = await getPageMeta(routeName)
  if (!meta) return

  // 设置页面标题
  const title = meta.title[language] || meta.title['zh']
  if (title) {
    document.title = title
  }

  // 设置meta description
  const description = meta.description[language] || meta.description['zh']
  const descMeta = document.querySelector('meta[name="description"]')
  if (descMeta) {
    descMeta.setAttribute('content', description)
  } else {
    const metaTag = document.createElement('meta')
    metaTag.name = 'description'
    metaTag.content = description
    document.head.appendChild(metaTag)
  }

  // 设置meta keywords (如果存在)
  if (meta.keywords && meta.keywords[language]) {
    const keywords = meta.keywords[language] || meta.keywords['zh']
    const keywordsMeta = document.querySelector('meta[name="keywords"]')
    if (keywordsMeta) {
      keywordsMeta.setAttribute('content', keywords)
    } else {
      const metaTag = document.createElement('meta')
      metaTag.name = 'keywords'
      metaTag.content = keywords
      document.head.appendChild(metaTag)
    }
  }

  // 设置Open Graph meta (可选)
  const ogTitleMeta = document.querySelector('meta[property="og:title"]')
  if (ogTitleMeta && title) {
    ogTitleMeta.setAttribute('content', title)
  }
  const ogDescMeta = document.querySelector('meta[property="og:description"]')
  if (ogDescMeta && description) {
    ogDescMeta.setAttribute('content', description)
  }
}

// 将路由路径映射到页面名称（用于meta配置）
export function getPageNameFromRoute(path: string): string {
  // 移除开头的斜杠和结尾的斜杠
  const cleanPath = path.replace(/^\/|\/$/g, '')
  if (cleanPath === '') return 'home'

  // 检查是否是文档路由
  if (cleanPath === 'md') {
    return 'docs-home'
  }
  
  if (cleanPath.startsWith('md/')) {
    const pageId = cleanPath.replace('md/', '')
    return `doc-${pageId}`
  }

  // 特殊映射：某些路径名称不同
  const mapping: Record<string, string> = {
    'chart-ranking': 'chart-ranking',
    'user-ranking': 'user-ranking',
    'chart-download': 'chart-download',
    'phira-download': 'phira-download',
    'navigation': 'navigation',
    'announcement': 'announcement',
    'agreement': 'agreement',
    'about': 'about',
    'rooms': 'rooms',
    'account': 'account'
  }

  // 如果映射中存在，返回映射值，否则返回路径本身
  return mapping[cleanPath] || cleanPath
}

// 更新页面meta（供路由守卫调用）
export async function updatePageMeta(pageName: string) {
  await updateFullPageMeta(pageName)
}

// 在路由变化时调用此函数
export function useRouteMeta() {
  const i18nStore = useI18nStore()

  return {
    setMetaForRoute(routeName: string) {
      setPageMeta(routeName, i18nStore.currentLanguage)
    }
  }
}

// Schema结构化数据相关函数
export function getPageSchema(pageName: string, language: Language): SchemaData | null {
  const baseUrl = 'https://phira.htadiy.com'
  
  // 基本Schema数据
  const baseSchema = {
    '@context': 'https://schema.org',
    '@id': `${baseUrl}/${pageName === 'home' ? '' : pageName}`
  }

  // 根据不同页面类型返回不同的Schema
  switch (pageName) {
    case 'home':
      return {
        ...baseSchema,
        '@type': 'WebPage',
        'name': 'HSN Phira多人游戏服务器',
        'description': 'HyperSynapse Network Phira多人游戏服务器 - 免费·多功能·稳定·低延迟',
        'url': baseUrl,
        'isPartOf': {
          '@id': `${baseUrl}/#website`
        },
        'about': {
          '@id': `${baseUrl}/#organization`
        }
      }
    
    case 'about':
      return {
        ...baseSchema,
        '@type': 'AboutPage',
        'name': language === 'zh' ? '关于我们' : 
                language === 'zh-TW' ? '關於我們' :
                language === 'en' ? 'About Us' :
                '私たちについて',
        'description': language === 'zh' ? 'HyperSynapse Network团队介绍和联系信息' :
                       language === 'zh-TW' ? 'HyperSynapse Network團隊介紹和聯繫信息' :
                       language === 'en' ? 'HyperSynapse Network team introduction and contact information' :
                       'HyperSynapse Networkチーム紹介と連絡先情報',
        'url': `${baseUrl}/about`,
        'isPartOf': {
          '@id': `${baseUrl}/#website`
        }
      }
    
    case 'phira-download':
      return {
        ...baseSchema,
        '@type': 'SoftwareApplication',
        'name': 'Phira',
        'applicationCategory': 'GameApplication',
        'operatingSystem': ['Android', 'Windows', 'Linux', 'macOS'],
        'downloadUrl': 'https://github.com/TeamFlos/phira/releases',
        'softwareVersion': '0.6.7',
        'description': language === 'zh' ? '开源音乐游戏Phira下载' :
                       language === 'zh-TW' ? '開源音樂遊戲Phira下載' :
                       language === 'en' ? 'Open source music game Phira download' :
                       'オープンソース音楽ゲームPhiraダウンロード',
        'url': `${baseUrl}/phira-download`,
        'isPartOf': {
          '@id': `${baseUrl}/#website`
        },
        'publisher': {
          '@id': `${baseUrl}/#organization`
        }
      }
    
    case 'announcement':
      return {
        ...baseSchema,
        '@type': 'CollectionPage',
        'name': language === 'zh' ? '公告' :
                language === 'zh-TW' ? '公告' :
                language === 'en' ? 'Announcements' :
                'お知らせ',
        'description': language === 'zh' ? 'HSNPhira服务器公告和最新消息' :
                       language === 'zh-TW' ? 'HSNPhira伺服器公告和最新消息' :
                       language === 'en' ? 'HSNPhira server announcements and latest news' :
                       'HSNPhiraサーバーお知らせと最新情報',
        'url': `${baseUrl}/announcement`,
        'isPartOf': {
          '@id': `${baseUrl}/#website`
        }
      }
    
    case 'docs-home':
      return {
        ...baseSchema,
        '@type': 'CollectionPage',
        'name': language === 'zh' ? '文档中心' :
                language === 'zh-TW' ? '文檔中心' :
                language === 'en' ? 'Documentation Center' :
                'ドキュメントセンター',
        'description': language === 'zh' ? 'HSNPhira服务器文档和用户指南' :
                       language === 'zh-TW' ? 'HSNPhira伺服器文檔和用戶指南' :
                       language === 'en' ? 'HSNPhira server documentation and user guides' :
                       'HSNPhiraサーバードキュメントとユーザーガイド',
        'url': `${baseUrl}/md`,
        'isPartOf': {
          '@id': `${baseUrl}/#website`
        }
      }
    
    case 'agreement':
      return {
        ...baseSchema,
        '@type': 'LegalService',
        'name': language === 'zh' ? '用户协议' :
                language === 'zh-TW' ? '用戶協議' :
                language === 'en' ? 'User Agreement' :
                '利用規約',
        'description': language === 'zh' ? 'HSNPhira服务器用户协议和免责声明' :
                       language === 'zh-TW' ? 'HSNPhira伺服器用戶協議和免責聲明' :
                       language === 'en' ? 'HSNPhira server user agreement and disclaimer' :
                       'HSNPhiraサーバー利用規約と免責事項',
        'url': `${baseUrl}/agreement`,
        'isPartOf': {
          '@id': `${baseUrl}/#website`
        }
      }
    
    default:
      // 对于其他页面，返回基本的WebPage Schema
      return {
        ...baseSchema,
        '@type': 'WebPage',
        'name': pageName,
        'url': `${baseUrl}/${pageName}`,
        'isPartOf': {
          '@id': `${baseUrl}/#website`
        }
      }
  }
}

// 更新页面Schema
export function updatePageSchema(pageName: string, language: Language) {
  const schema = getPageSchema(pageName, language)
  if (!schema) return
  
  const schemaElement = document.getElementById('current-page-schema')
  if (schemaElement) {
    schemaElement.textContent = JSON.stringify(schema, null, 2)
  }
}

// 完整的页面meta更新函数，包括Schema
export async function updateFullPageMeta(pageName: string) {
  const i18nStore = useI18nStore()
  const language = i18nStore.currentLanguage
  
  // 更新meta标签
  await setPageMeta(pageName, language)
  
  // 更新Schema结构化数据
  updatePageSchema(pageName, language)
  
  // 更新其他结构化数据
  updateAdditionalStructuredData(pageName, language)
}

// 更新其他结构化数据（如BreadcrumbList等）
function updateAdditionalStructuredData(pageName: string, language: Language) {
  const baseUrl = 'https://phira.htadiy.com'
  
  // 生成面包屑导航Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': generateBreadcrumbItems(pageName, language, baseUrl)
  }
  
  // 更新或创建面包屑Schema元素
  let breadcrumbElement = document.getElementById('breadcrumb-schema') as HTMLScriptElement | null
  if (!breadcrumbElement) {
    breadcrumbElement = document.createElement('script')
    breadcrumbElement.id = 'breadcrumb-schema'
    breadcrumbElement.type = 'application/ld+json'
    document.head.appendChild(breadcrumbElement)
  }
  breadcrumbElement.textContent = JSON.stringify(breadcrumbSchema, null, 2)
}

// 生成面包屑导航项目
function generateBreadcrumbItems(pageName: string, language: Language, baseUrl: string) {
  const items = [
    {
      '@type': 'ListItem',
      'position': 1,
      'name': language === 'zh' ? '主页' :
              language === 'zh-TW' ? '主頁' :
              language === 'en' ? 'Home' :
              'ホーム',
      'item': baseUrl
    }
  ]
  
  let position = 2
  
  // 根据页面名称添加对应的面包屑
  const pageTitles: Record<string, Record<Language, string>> = {
    'about': {
      'zh': '关于我们',
      'zh-TW': '關於我們',
      'en': 'About Us',
      'ja': '私たちについて'
    },
    'phira-download': {
      'zh': 'Phira下载',
      'zh-TW': 'Phira下載',
      'en': 'Phira Download',
      'ja': 'Phiraダウンロード'
    },
    'announcement': {
      'zh': '公告',
      'zh-TW': '公告',
      'en': 'Announcements',
      'ja': 'お知らせ'
    },
    'docs-home': {
      'zh': '文档中心',
      'zh-TW': '文檔中心',
      'en': 'Documentation Center',
      'ja': 'ドキュメントセンター'
    },
    'agreement': {
      'zh': '用户协议',
      'zh-TW': '用戶協議',
      'en': 'User Agreement',
      'ja': '利用規約'
    }
  }
  
  if (pageName !== 'home' && pageTitles[pageName]) {
    items.push({
      '@type': 'ListItem',
      'position': position,
      'name': pageTitles[pageName][language] || pageTitles[pageName]['zh'],
      'item': `${baseUrl}/${pageName === 'docs-home' ? 'md' : pageName}`
    })
  }
  
  return items
}
