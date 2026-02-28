#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 路由配置路径
const ROUTER_PATH = join(__dirname, '../src/router/index.ts')

// 文档配置路径  
const DOCS_CONFIG_PATH = join(__dirname, '../public/config/docs.config.json')

// 基础URL
const BASE_URL = 'https://phira.htadiy.com'

// 从路由配置中提取路径
function getRoutes() {
  try {
    const routerContent = readFileSync(ROUTER_PATH, 'utf-8')
    
    // 简单解析路由配置中的路径
    // 查找所有 path: '...' 模式
    const pathRegex = /path:\s*['"]([^'"]+)['"]/g
    const routes = []
    let match
    
    while ((match = pathRegex.exec(routerContent)) !== null) {
      const path = match[1]
      
      // 排除动态路径（包含:的路径）和通配符路径
      if (!path.includes(':') && !path.includes('*') && !path.includes('?')) {
        // 排除404页面（它已经包含在SSG构建中）
        if (path !== '/:pathMatch(.*)*') {
          routes.push(path)
        }
      }
    }
    
    // 确保首页在列表中
    if (!routes.includes('/')) {
      routes.push('/')
    }
    
    // 添加文档路由
    try {
      const docsConfig = JSON.parse(readFileSync(DOCS_CONFIG_PATH, 'utf-8'))
      for (const pageId in docsConfig.pages) {
        routes.push(`/md/${pageId}`)
      }
    } catch (err) {
      console.warn('无法读取文档配置:', err.message)
    }
    
    // 去重和排序
    const uniqueRoutes = [...new Set(routes)].sort()
    
    console.log(`找到 ${uniqueRoutes.length} 个静态路由:`)
    uniqueRoutes.forEach(route => console.log(`  ${route}`))
    
    return uniqueRoutes
  } catch (err) {
    console.error('读取路由配置失败:', err)
    // 返回默认路由列表作为后备
    return [
      '/',
      '/rooms',
      '/chart-ranking', 
      '/user-ranking',
      '/agreement',
      '/announcement',
      '/chart-download',
      '/phira-download',
      '/navigation',
      '/about',
      '/md'
    ]
  }
}

// 生成sitemap.xml
function generateSitemap(routes) {
  const urls = routes.map(route => {
    // 为不同页面设置不同的优先级
    let priority = '0.8'
    if (route === '/') priority = '1.0'
    else if (route === '/rooms') priority = '0.9'
    else if (route === '/chart-ranking' || route === '/user-ranking') priority = '0.85'
    else if (route.startsWith('/md/')) priority = '0.7'
    
    return `  <url>
    <loc>${BASE_URL}${route}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

// 生成robots.txt
function generateRobotsTxt() {
  return `User-agent: *
Disallow: /404
Disallow: /account
Disallow: /api/
Disallow: /auth/

Sitemap: ${BASE_URL}/sitemap.xml`
}

// 主函数
function main() {
  console.log('正在生成SEO文件...')
  
  const routes = getRoutes()
  
  // 生成sitemap.xml
  const sitemap = generateSitemap(routes)
  const sitemapPath = join(__dirname, '../dist/sitemap.xml')
  writeFileSync(sitemapPath, sitemap, 'utf-8')
  console.log(`✅ 已生成 sitemap.xml (${sitemapPath})`)
  
  // 生成robots.txt
  const robots = generateRobotsTxt()
  const robotsPath = join(__dirname, '../dist/robots.txt')
  writeFileSync(robotsPath, robots, 'utf-8')
  console.log(`✅ 已生成 robots.txt (${robotsPath})`)
  
  console.log('🎉 SEO文件生成完成！')
}

main()