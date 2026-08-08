/**
 * Заменяет стандартные картинки сгенерированного проекта Android на фирменные.
 *
 * Запускается на сборке сразу после `cap add android`: папка android/ каждый раз
 * создаётся заново из шаблона Capacitor, а в шаблоне лежит логотип Capacitor.
 * Без этого шага приложение на телефоне выглядит чужим.
 */
import { readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { BRAND, buildSvg } from './icon-svg.mjs'

const res = resolve(import.meta.dirname, '..', 'android', 'app', 'src', 'main', 'res')

if (!existsSync(res)) {
  console.error('Проект Android не найден. Сначала выполните: npx cap add android')
  process.exit(1)
}

/** Классическая иконка: 48 dp в пяти плотностях экрана. */
const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }

/**
 * Слой адаптивной иконки — 108 dp вместо 48. Система обрезает его своей формой
 * и может съесть до 18 dp с каждой стороны, поэтому знак ужимаем: при обрезке
 * под круг у него должен оставаться воздух по краям.
 */
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }
const FOREGROUND_SCALE = 0.62

const plate = Buffer.from(buildSvg())
const glyph = Buffer.from(buildSvg({ scale: FOREGROUND_SCALE, withPlate: false }))

for (const [density, size] of Object.entries(LAUNCHER)) {
  const dir = join(res, `mipmap-${density}`)

  for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
    await sharp(plate).resize(size, size).png().toFile(join(dir, name))
  }

  await sharp(glyph)
    .resize(FOREGROUND[density], FOREGROUND[density])
    .png()
    .toFile(join(dir, 'ic_launcher_foreground.png'))
}

// Подложка адаптивной иконки — сплошной фирменный цвет, а не белый по умолчанию.
await writeFile(
  join(res, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BRAND}</color>\n</resources>\n`,
  'utf8',
)

/**
 * Экран запуска. Показывается доли секунды, пока поднимается веб-слой, поэтому
 * это просто знак на фоне приложения — рисовать здесь нечего, а белая вспышка
 * вместо него выглядит как сбой.
 */
const splash = await sharp({
  create: { width: 1080, height: 1920, channels: 4, background: '#f5f7fa' },
})
  .composite([{ input: await sharp(Buffer.from(buildSvg())).resize(320, 320).png().toBuffer() }])
  .png()
  .toBuffer()

const splashDirs = (await readdir(res)).filter((dir) => dir === 'drawable' || dir.startsWith('drawable-port') || dir.startsWith('drawable-land'))

for (const dir of splashDirs) {
  await writeFile(join(res, dir, 'splash.png'), splash)
}

console.log(`✓ иконки и экран запуска обновлены (${splashDirs.length} вариантов заставки)`)
