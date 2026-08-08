import { copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/** GitHub Pages отдаёт 404.html вместо ошибки — кладём туда копию приложения. */
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

await copyFile(join(dist, 'index.html'), join(dist, '404.html'))
console.log('✓ dist/404.html')
