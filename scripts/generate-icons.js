import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'

const sizes = [
  { width: 192, height: 192, name: 'pwa-192x192.png' },
  { width: 512, height: 512, name: 'pwa-512x512.png' },
  { width: 180, height: 180, name: 'apple-touch-icon.png' },
  { width: 16, height: 16, name: 'favicon-16x16.png' },
  { width: 32, height: 32, name: 'favicon-32x32.png' }
]

async function generateIcons() {
  try {
    const sourcePath = path.join(process.cwd(), 'public', 'favicon.png')
    const outputDir = path.join(process.cwd(), 'public')
    
    console.log('正在读取源图标:', sourcePath)
    
    // 检查源文件是否存在
    try {
      await fs.access(sourcePath)
    } catch {
      console.error('源图标文件不存在:', sourcePath)
      console.log('尝试使用logo.png作为备用...')
      const logoPath = path.join(process.cwd(), 'public', 'logo.png')
      try {
        await fs.access(logoPath)
        await generateFromSource(logoPath, outputDir)
        return
      } catch {
        console.error('logo.png也不存在')
        process.exit(1)
      }
    }
    
    await generateFromSource(sourcePath, outputDir)
  } catch (error) {
    console.error('生成图标时出错:', error)
    process.exit(1)
  }
}

async function generateFromSource(sourcePath, outputDir) {
  const sourceImage = sharp(sourcePath)
  const metadata = await sourceImage.metadata()
  
  console.log(`源图标尺寸: ${metadata.width}x${metadata.height}`)
  
  // 生成所有尺寸的图标
  for (const size of sizes) {
    const outputPath = path.join(outputDir, size.name)
    
    try {
      await sourceImage
        .resize(size.width, size.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toFile(outputPath)
      
      console.log(`✓ 生成: ${size.name} (${size.width}x${size.height})`)
    } catch (error) {
      console.error(`生成 ${size.name} 时出错:`, error)
    }
  }
  
  // 生成manifest.json需要的图标数组
  const manifestIcons = sizes
    .filter(size => size.name.startsWith('pwa-'))
    .map(size => ({
      src: `/${size.name}`,
      sizes: `${size.width}x${size.height}`,
      type: 'image/png'
    }))
  
  // 添加maskable图标
  manifestIcons.push({
    src: '/pwa-512x512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable'
  })
  
  console.log('\n图标生成完成！')
  console.log('生成的图标:', sizes.map(s => s.name).join(', '))
  
  // 不再自动更新manifest.json，由vite.config.ts配置
}

// 执行生成
generateIcons()