/**
 * Единственный источник фирменного знака: растущая столбиковая диаграмма.
 * Из него рисуются и иконки сайта, и иконки Android-приложения — чтобы они
 * не разъехались, когда знак однажды поменяется.
 */

export const SIZE = 512
export const BRAND = '#2e7d6b'

const CENTER = SIZE / 2

/**
 * @param scale     Размер знака относительно холста. Меньше единицы нужно там,
 *                  где система обрезает иконку по своей форме.
 * @param withPlate Рисовать ли фирменную подложку. Для адаптивной иконки Android
 *                  подложка задаётся отдельным слоем, и здесь она только помешает.
 */
export function buildSvg({ scale = 1, withPlate = true } = {}) {
  const stroke = 34 * scale
  const point = (x, y) => `${CENTER + (x - CENTER) * scale} ${CENTER + (y - CENTER) * scale}`

  const bars = [
    [176, 330, 176, 268],
    [256, 330, 256, 212],
    [336, 330, 336, 160],
  ]
    .map(([x1, y1, x2, y2]) => `<path d="M ${point(x1, y1)} L ${point(x2, y2)}" />`)
    .join('')

  const plate = withPlate ? `<rect width="${SIZE}" height="${SIZE}" fill="${BRAND}"/>` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  ${plate}
  <g stroke="#ffffff" stroke-width="${stroke}" stroke-linecap="round" fill="none">
    ${bars}
    <path d="M ${point(140, 356)} L ${point(372, 356)}" />
  </g>
</svg>`
}
