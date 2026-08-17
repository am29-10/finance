/**
 * Где именно запущено приложение. От этого зависит и то, как его установить,
 * и то, насколько легко потерять данные.
 *
 * Определяем по строке user agent — способ нестрогий, но альтернатив в браузере
 * нет, а цена ошибки здесь низкая: человеку покажут инструкцию не для его
 * телефона, и он выберет вкладку сам.
 */

/**
 * Внутри установленного приложения — собранного APK на Android или IPA на
 * iPhone. Данные там лежат в приватном хранилище приложения и переживают
 * чистку браузера.
 */
export function isNativeApp(): boolean {
  const capacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return capacitor?.isNativePlatform?.() === true
}

export function isIOS(): boolean {
  const ua = navigator.userAgent

  // iPad с iPadOS 13+ представляется макбуком, отличить его можно только по касаниям.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  return /iPad|iPhone|iPod/.test(ua) || iPadOS
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent)
}

/** Приложение открыто с домашнего экрана, а не как вкладка браузера. */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
}

export type Platform = 'native' | 'ios' | 'android' | 'desktop'

export function currentPlatform(): Platform {
  if (isNativeApp()) return 'native'
  if (isIOS()) return 'ios'
  if (isAndroid()) return 'android'
  return 'desktop'
}

/**
 * Насколько легко потерять данные в текущем окружении.
 *
 * `safe` — установленное приложение: чужая чистка кеша до него не дотянется.
 * `fragile` — иконка на iPhone: контейнер принадлежит иконке, и смахнуть её
 * можно, приняв за ярлык, вместе со всей историей операций.
 * `browser` — обычная вкладка: очистка данных сайтов стирает всё.
 */
export function storageRisk(): 'safe' | 'fragile' | 'browser' {
  if (isNativeApp()) return 'safe'
  if (isIOS() && isStandalone()) return 'fragile'
  return 'browser'
}
