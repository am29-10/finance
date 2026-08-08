import { defineConfig } from 'vitest/config'

/**
 * Тесты живут отдельно от сборки приложения: vite.config.ts тянет PWA-плагин и
 * генерацию иконок, которым в прогоне тестов делать нечего.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Модуль store при импорте читает хранилище — подсовываем ему localStorage.
    setupFiles: ['src/test/setup.ts'],
  },
})
