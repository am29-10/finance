/**
 * Единственный источник фирменного знака: растущая столбиковая диаграмма.
 * Из него рисуются и иконки сайта, и иконки Android-приложения — чтобы они
 * не разъехались, когда знак однажды поменяется.
 */

export const SIZE = 512
export const BRAND = '#2e7d6b'
/** Фон приложения. Заставка написана им же, чтобы запуск не мигал сменой цвета. */
export const CANVAS = '#f5f7fa'

const CENTER = SIZE / 2

/**
 * Сам знак без обёртки — чтобы его можно было вложить и в иконку, и в заставку.
 *
 * @param scale     Размер знака относительно холста. Меньше единицы нужно там,
 *                  где система обрезает иконку по своей форме.
 * @param withPlate Рисовать ли фирменную подложку. Для адаптивной иконки Android
 *                  подложка задаётся отдельным слоем, и здесь она только помешает.
 * @param radius    Скругление подложки. Системные иконки система скругляет сама,
 *                  а на заставке знак лежит на голом фоне и форму держит сам.
 */
export function buildMark({ scale = 1, withPlate = true, radius = 0 } = {}) {
  const stroke = 34 * scale
  const point = (x, y) => `${CENTER + (x - CENTER) * scale} ${CENTER + (y - CENTER) * scale}`

  const bars = [
    [176, 330, 176, 268],
    [256, 330, 256, 212],
    [336, 330, 336, 160],
  ]
    .map(([x1, y1, x2, y2]) => `<path d="M ${point(x1, y1)} L ${point(x2, y2)}" />`)
    .join('')

  const plate = withPlate
    ? `<rect width="${SIZE}" height="${SIZE}"${radius ? ` rx="${radius}"` : ''} fill="${BRAND}"/>`
    : ''

  return `${plate}
  <g stroke="#ffffff" stroke-width="${stroke}" stroke-linecap="round" fill="none">
    ${bars}
    <path d="M ${point(140, 356)} L ${point(372, 356)}" />
  </g>`
}

export function buildSvg(options = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  ${buildMark(options)}
</svg>`
}

/**
 * Заставка запуска: знак по центру фирменного фона.
 *
 * Размер знака — доля от короткой стороны, а не фиксированные пиксели: одна и
 * та же картинка растягивается на экраны от старого SE до Pro Max, и знак,
 * заданный числом, на одном выглядел бы вывеской, на другом — точкой.
 */
export function buildSplashSvg({ width, height }) {
  const mark = Math.round(Math.min(width, height) * 0.22)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${CANVAS}"/>
  <svg x="${Math.round((width - mark) / 2)}" y="${Math.round((height - mark) / 2)}" width="${mark}" height="${mark}" viewBox="0 0 ${SIZE} ${SIZE}">
    ${buildMark({ radius: SIZE * 0.2258 })}
  </svg>
</svg>`
}

/**
 * Экраны iPhone, под которые нужна отдельная картинка.
 *
 * iOS выбирает заставку точным совпадением media-запроса, и промахнуться
 * значит снова показать белизну — поэтому список перечисляет размеры поимённо,
 * а не берёт «примерно подходящий». Логические размеры и плотность:
 * 375×812@3 — X, XS, 11 Pro, 12 mini; 390×844@3 — 12, 13, 14; и так далее.
 */
export const SPLASH_SCREENS = [
  { width: 320, height: 568, ratio: 2 },
  { width: 375, height: 667, ratio: 2 },
  { width: 414, height: 736, ratio: 3 },
  { width: 375, height: 812, ratio: 3 },
  { width: 414, height: 896, ratio: 2 },
  { width: 414, height: 896, ratio: 3 },
  { width: 390, height: 844, ratio: 3 },
  { width: 428, height: 926, ratio: 3 },
  { width: 393, height: 852, ratio: 3 },
  { width: 430, height: 932, ratio: 3 },
  { width: 402, height: 874, ratio: 3 },
  { width: 440, height: 956, ratio: 3 },
]

/** Имя файла заставки в пикселях устройства: 393×852@3 → apple-splash-1179x2556.png */
export function splashFile({ width, height, ratio }) {
  return `apple-splash-${width * ratio}x${height * ratio}.png`
}
