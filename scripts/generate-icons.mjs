import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { buildSvg } from './icon-svg.mjs'

/**
 * Иконки сайта из общего шаблона. Запуск: npm run icons
 * scale < 1 — для maskable-иконки: Android обрезает её по своей форме,
 * поэтому содержимое должно уместиться в центральные 80%.
 */

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
await mkdir(publicDir, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.76 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
]

for (const { file, size, scale } of targets) {
  await sharp(Buffer.from(buildSvg({ scale })))
    .resize(size, size)
    .png()
    .toFile(join(publicDir, file))
  console.log(`✓ ${file} (${size}×${size})`)
}

await writeFile(join(publicDir, 'favicon.svg'), buildSvg(), 'utf8')
console.log('✓ favicon.svg')
