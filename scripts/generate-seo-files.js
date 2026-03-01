#!/usr/bin/env node
// scripts/generate-seo-files.js
// Generates sitemap.xml, sitemap-multilang.xml, robots.txt after build

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ROUTER_PATH = join(__dirname, '../src/router/index.ts')
const DOCS_CONFIG_PATH = join(__dirname, '../public/config/docs.config.json')
const DIST_DIR = join(__dirname, '../dist')
const PUBLIC_DIR = join(__dirname, '../public')
const BASE_URL = 'https://phira.htadiy.com'

const PRIORITIES = {
  '/': '1.0', '/rooms': '0.9', '/chart-ranking': '0.85', '/user-ranking': '0.85',
  '/announcement': '0.8', '/about': '0.75', '/phira-download': '0.8',
  '/chart-download': '0.75', '/navigation': '0.7', '/agreement': '0.6', '/md': '0.7',
}
const CHANGEFREQS = {
  '/': 'daily', '/rooms': 'always', '/chart-ranking': 'hourly', '/user-ranking': 'daily',
  '/announcement': 'weekly',
}

function getRoutes() {
  try {
    const content = readFileSync(ROUTER_PATH, 'utf-8')
    const re = /path:\s*['"]([^'"]+)['"]/g
    const routes = []
    let m
    while ((m = re.exec(content)) !== null) {
      const p = m[1]
      if (!p.includes(':') && !p.includes('*') && !p.includes('?')) routes.push(p)
    }
    if (!routes.includes('/')) routes.push('/')
    if (existsSync(DOCS_CONFIG_PATH)) {
      try {
        const docs = JSON.parse(readFileSync(DOCS_CONFIG_PATH, 'utf-8'))
        for (const id in docs.pages) routes.push(`/md/${id}`)
      } catch (e) { console.warn('Cannot read docs config:', e.message) }
    }
    const unique = [...new Set(routes)].sort()
    console.log(`Found ${unique.length} routes:`)
    unique.forEach(r => console.log(`  ${r}`))
    return unique
  } catch (e) {
    console.error('Failed to read routes:', e)
    return ['/', '/rooms', '/chart-ranking', '/user-ranking', '/agreement',
      '/announcement', '/chart-download', '/phira-download', '/navigation', '/about', '/md']
  }
}

const getPriority = r => PRIORITIES[r] || (r.startsWith('/md/') ? '0.65' : '0.7')
const getChangefreq = r => CHANGEFREQS[r] || 'weekly'

function generateSitemap(routes) {
  const now = new Date().toISOString().split('T')[0]
  const urls = routes.map(r => {
    const loc = r === '/' ? BASE_URL : `${BASE_URL}${r}`
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${getChangefreq(r)}</changefreq>\n    <priority>${getPriority(r)}</priority>\n  </url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
}

function generateMultilangSitemap(routes) {
  const now = new Date().toISOString().split('T')[0]
  const langs = [['zh-CN','zh-CN'],['zh-TW','zh-TW'],['en','en'],['ja','ja'],['x-default','x-default']]
  const urls = routes.map(r => {
    const loc = r === '/' ? BASE_URL : `${BASE_URL}${r}`
    const alts = langs.map(([,hreflang]) =>
      `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${loc}"/>`
    ).join('\n')
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${getChangefreq(r)}</changefreq>\n    <priority>${getPriority(r)}</priority>\n${alts}\n  </url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>`
}

function generateRobots() {
  return `User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: ${BASE_URL}/sitemap.xml\nSitemap: ${BASE_URL}/sitemap-multilang.xml`
}

function write(dir, filename, content) {
  const p = join(dir, filename)
  writeFileSync(p, content, 'utf-8')
  console.log(`  ✅ ${filename} → ${p}`)
}

function main() {
  console.log('\n📄 Generating SEO files...\n')
  const routes = getRoutes()
  const sitemap = generateSitemap(routes)
  const multilang = generateMultilangSitemap(routes)
  const robots = generateRobots()

  const distExists = existsSync(DIST_DIR)
  if (distExists) {
    console.log('\nWriting to dist/:')
    write(DIST_DIR, 'sitemap.xml', sitemap)
    write(DIST_DIR, 'sitemap-multilang.xml', multilang)
    write(DIST_DIR, 'robots.txt', robots)
  }

  console.log('\nWriting to public/ (for static serving):')
  write(PUBLIC_DIR, 'sitemap.xml', sitemap)
  write(PUBLIC_DIR, 'sitemap-multilang.xml', multilang)
  write(PUBLIC_DIR, 'robots.txt', robots)

  console.log('\n🎉 SEO files generated!\n')
}

main()
