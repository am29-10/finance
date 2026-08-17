/**
 * Обновление установленного приложения.
 *
 * Скрипт регистрации, который генерирует плагин, умеет ровно одно — включить
 * service worker. Новую версию он скачивает молча и подменяет файлы только к
 * следующему запуску, поэтому человек, открывший приложение сразу после
 * выкладки, видит старое и решает, что ничего не поменялось.
 *
 * Здесь этого недостаточно: приложением пользуются с домашнего экрана, где
 * «обновить страницу» нечем, а половина пользователей — не автор и про кеши
 * знать не обязана. Поэтому проверяем обновления при каждом возвращении в
 * приложение и перезагружаем экран сами, как только новая версия готова.
 */
export function watchForUpdates() {
  // В установленном приложении обновляется сам файл — APK или IPA, — и service
  // worker там не нужен: в сборке с режимом app он даже не создаётся.
  if (import.meta.env.MODE === 'app') return
  if (!('serviceWorker' in navigator)) return

  /**
   * Была ли страница под управлением service worker в момент запуска.
   * При самой первой установке смена управляющего — это норма, а не новая
   * версия, и перезагружать экран в лицо человеку незачем.
   */
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })

  const base = import.meta.env.BASE_URL

  navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base })
    .then((registration) => {
      const check = () => {
        if (document.visibilityState !== 'visible') return
        registration.update().catch(() => {
          // Нет сети — не беда, приложение работает офлайн, проверим в следующий раз.
        })
      }

      document.addEventListener('visibilitychange', check)

      // Приложение могут не закрывать неделями — тогда возвращения на экран не будет.
      setInterval(check, 60 * 60 * 1000)
    })
    .catch(() => {
      // Регистрация не удалась — приложение остаётся обычной страницей и работает.
    })
}
