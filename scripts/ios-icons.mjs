/**
 * Заменяет стандартные картинки сгенерированного проекта iOS на фирменные.
 *
 * Запускается на сборке сразу после `cap add ios`: папка ios/ каждый раз
 * создаётся заново из шаблона Capacitor, а в шаблоне лежит логотип Capacitor.
 * Без этого шага приложение на телефоне выглядит чужим.
 *
 * Размеры не перечислены здесь списком, а читаются из Contents.json рядом с
 * картинками: набор нужных файлов задаёт Xcode, и он менялся уже не раз —
 * в старых проектах это два десятка иконок под каждый размер, в нынешних одна
 * на 1024 px. Список, выписанный вручную, разошёлся бы с шаблоном молча:
 * сборка прошла бы, а иконка осталась чужой.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { buildSvg, buildSplashSvg } from './icon-svg.mjs'

const assets = resolve(import.meta.dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets')

if (!existsSync(assets)) {
  console.error('Проект iOS не найден. Сначала выполните: npx cap add ios')
  process.exit(1)
}

const icons = join(assets, 'AppIcon.appiconset')
const splash = join(assets, 'Splash.imageset')

/**
 * Иконка приложения.
 *
 * Скругление рисовать не нужно и нельзя: углы обрезает сама система, а
 * заготовленные съедутся с её формой. Прозрачность iOS тоже не принимает —
 * поэтому знак кладётся на сплошную подложку, а `flatten` убирает альфа-канал,
 * который sharp иначе оставит в PNG.
 */
const contents = JSON.parse(await readFile(join(icons, 'Contents.json'), 'utf8'))
const plate = Buffer.from(buildSvg())
let written = 0

for (const image of contents.images) {
  if (!image.filename) continue

  // «60x60» + scale «3x» → 180 px. У универсальной иконки scale нет вовсе.
  const side = Number.parseFloat(image.size)
  const scale = Number.parseInt(image.scale ?? '1', 10)
  const px = Math.round(side * scale)

  await sharp(plate)
    .resize(px, px)
    .flatten({ background: '#2e7d6b' })
    .png()
    .toFile(join(icons, image.filename))

  written += 1
}

/**
 * Экран запуска. Xcode тянет картинку из общего набора, а какие именно файлы в
 * нём лежат — дело шаблона: сейчас это три квадрата 2732×2732 под светлую и
 * тёмную тему. Перерисовываем все, что нашлись, одним и тем же изображением:
 * приложение живёт на светлом фоне в обеих темах, и разводить их незачем.
 */
const splashSvg = Buffer.from(buildSplashSvg({ width: 2732, height: 2732 }))
const splashPng = await sharp(splashSvg).png().toBuffer()
const splashFiles = (await readdir(splash)).filter((file) => file.endsWith('.png'))

for (const file of splashFiles) {
  await writeFile(join(splash, file), splashPng)
}

console.log(`✓ иконки (${written}) и экран запуска (${splashFiles.length}) обновлены`)
