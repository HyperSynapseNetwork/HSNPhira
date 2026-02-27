import { ref } from 'vue'
import type { DocConfig, DocCard, DocPage, DocCategory, MultiLanguageText } from '@/types'
import { loadDocConfig as loadDocConfigFromApi, getLocalizedText } from './config'

const docsConfig = ref<DocConfig | null>(null)

export async function loadDocsConfig(): Promise<DocConfig> {
  if (docsConfig.value) return docsConfig.value

  try {
    const config = await loadDocConfigFromApi()
    docsConfig.value = config
    return config
  } catch (error) {
    console.error('Error loading docs config:', error)
    // 返回默认配置
    const defaultConfig: DocConfig = {
      cards: [],
      pages: {},
      categories: {}
    }
    docsConfig.value = defaultConfig
    return defaultConfig
  }
}

export function getDocPage(pageId: string): DocPage | null {
  if (!docsConfig.value) return null
  return docsConfig.value.pages[pageId] || null
}

export function getDocCard(cardId: string): DocCard | null {
  if (!docsConfig.value) return null
  return docsConfig.value.cards.find(card => card.id === cardId) || null
}

export function getAllCards(): DocCard[] {
  if (!docsConfig.value) return []
  return [...docsConfig.value.cards].sort((a, b) => a.order - b.order)
}

export function getCardsByCategory(category: string): DocCard[] {
  if (!docsConfig.value) return []
  return docsConfig.value.cards
    .filter(card => card.category === category)
    .sort((a, b) => a.order - b.order)
}

export function getAllCategories(): Array<{id: string, category: DocCategory}> {
  if (!docsConfig.value) return []
  return Object.entries(docsConfig.value.categories).map(([id, category]) => ({
    id,
    category
  }))
}

export function getCategory(categoryId: string): DocCategory | null {
  if (!docsConfig.value) return null
  return docsConfig.value.categories[categoryId] || null
}

export function getCurrentLanguageDoc(doc: MultiLanguageText): string {
  return getLocalizedText(doc)
}

// 加载文档内容（支持文件和内联内容）
export async function loadDocContent(pageId: string): Promise<string> {
  const page = getDocPage(pageId)
  if (!page) {
    console.log(`Page ${pageId} not found`)
    return ''
  }

  try {
    // 优先从文件加载
    if (page.file) {
      console.log(`Loading file: ${page.file} for page ${pageId}`)
      const response = await fetch(page.file)
      console.log(`Fetch response status: ${response.status} ${response.statusText}`)
      if (response.ok) {
        const text = await response.text()
        console.log(`Loaded ${text.length} chars from file`)
        return text
      } else {
        console.log(`File load failed: ${response.status}`)
      }
    }

    // 如果文件不存在或加载失败，使用内联内容
    if (page.content) {
      console.log(`Using inline content for page ${pageId}`)
      return getCurrentLanguageDoc(page.content)
    }

    console.log(`No content available for page ${pageId}`)
    return ''
  } catch (error) {
    console.error(`Error loading doc content for ${pageId}:`, error)
    // 如果文件加载失败，尝试使用内联内容
    if (page.content) {
      return getCurrentLanguageDoc(page.content)
    }
    return ''
  }
}


// 解析markdown为HTML
export async function parseMarkdown(markdown: string): Promise<string> {
  try {
    if (!markdown) return ''
    
    console.log('Parsing markdown, length:', markdown.length)
    
    // 超简单解析器 - 逐步构建
    let html = ''
    const lines = markdown.split('\n')
    
    for (const line of lines) {
      // 处理标题
      if (line.startsWith('###### ')) {
        html += `<h6 class="text-sm font-bold text-white mt-3 mb-1">${escapeHtml(line.substring(7))}</h6>\n`
      } else if (line.startsWith('##### ')) {
        html += `<h5 class="text-base font-bold text-white mt-4 mb-2">${escapeHtml(line.substring(6))}</h5>\n`
      } else if (line.startsWith('#### ')) {
        html += `<h4 class="text-lg font-bold text-white mt-4 mb-2">${escapeHtml(line.substring(5))}</h4>\n`
      } else if (line.startsWith('### ')) {
        html += `<h3 class="text-xl font-bold text-white mt-6 mb-3">${escapeHtml(line.substring(4))}</h3>\n`
      } else if (line.startsWith('## ')) {
        html += `<h2 class="text-2xl font-bold text-white mt-8 mb-4">${escapeHtml(line.substring(3))}</h2>\n`
      } else if (line.startsWith('# ')) {
        html += `<h1 class="text-3xl font-bold text-white mt-10 mb-6">${escapeHtml(line.substring(2))}</h1>\n`
      } 
      // 处理空行
      else if (line.trim() === '') {
        html += '<br>\n'
      }
      // 处理图片
      else if (line.includes('![') && line.includes('](') && line.includes(')')) {
        // 提取图片链接
        const imgMatch = line.match(/!\[(.*?)\]\((.*?)\)/)
        if (imgMatch) {
          const alt = imgMatch[1] || ''
          let href = imgMatch[2] || ''
          
          // 处理相对路径
          if (!href.includes('://') && !href.startsWith('//') && !href.startsWith('data:')) {
            if (href.startsWith('/')) {
              // 已经是根路径
            } else if (href.startsWith('./') && !href.startsWith('./images/')) {
              href = `/docs/images/${href.substring(2)}`
            } else if (href.startsWith('images/')) {
              href = `/docs/${href}`
            } else {
              href = `/docs/images/${href}`
            }
          }
          
          html += `<img src="${href}" alt="${escapeHtml(alt)}" class="rounded-lg my-4 max-w-full mx-auto" loading="lazy">\n`
        } else {
          html += `<p class="text-white/80 mb-4 leading-relaxed">${escapeHtml(line)}</p>\n`
        }
      }
      // 普通段落
      else {
        if (containsHtmlTags(line)) {
          // 包含HTML标签，直接输出（安全处理），不添加额外包装
          html += `${safeHtml(line)}\n`
        } else {
          // 不包含HTML标签，进行Markdown处理
          html += `<p class="text-white/80 mb-4 leading-relaxed">${processInlineMarkdownSimple(line)}</p>\n`
        }
      }
    }
    
    console.log('Generated HTML length:', html.length)
    console.log('First 200 chars:', html.substring(0, 200))
    return html
  } catch (error) {
    console.error('Error in parseMarkdown:', error)
    return '<p class="text-red-400">文档解析错误</p>'
  }
}

// 简单的行内Markdown处理
function processInlineMarkdownSimple(text: string): string {
  let result = text
  
  // 处理链接 [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, url) => {
    const isExternal = url.startsWith('http') || url.startsWith('//')
    const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${url}" class="text-primary hover:text-primary/80 underline"${target}>${linkText}</a>`
  })
  
  // 处理粗体 **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
  
  // 处理斜体 *text*
  result = result.replace(/\*([^*]+)\*/g, '<em class="italic text-white/90">$1</em>')
  
  // 处理行内代码 `code`
  result = result.replace(/`([^`]+)`/g, '<code class="bg-gray-800/50 px-1.5 py-0.5 rounded text-white/90 font-mono text-sm">$1</code>')
  
  // 不进行escapeHtml，因为我们已经生成了HTML
  return result
}

// 检查是否包含HTML标签
function containsHtmlTags(text: string): boolean {
  // 检测HTML标签：<tag> 或 <tag attr="value"> 或 </tag>
  return /<[a-z][^>]*>|<\/[a-z][^>]*>/i.test(text)
}

// 安全地处理包含HTML的文本
function safeHtml(text: string): string {
  // 只转义&符号（如果不是HTML实体）
  return text.replace(/&(?!\w+;)/g, '&amp;')
}

// HTML转义（普通文本）
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}