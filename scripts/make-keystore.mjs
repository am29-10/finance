/**
 * Создаёт ключ, которым подписывается APK.
 *
 * Android опознаёт приложение по подписи, а не по имени. Пока APK собирается
 * одним и тем же ключом, установка новой версии поверх старой — это обновление
 * с сохранением данных. Если ключ потерять и собрать новым, телефон посчитает
 * это чужим приложением: «Приложение не установлено», и единственный выход —
 * удалить старое вместе со всей историей операций.
 *
 * Поэтому файл ключа создаётся один раз и хранится вне репозитория, а на сборку
 * попадает через секреты GitHub.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const keystore = resolve(root, 'wallet-release.jks')
const secretsFile = resolve(root, 'keystore-secrets.txt')

if (existsSync(keystore)) {
  console.error(
    `\nКлюч уже существует: ${keystore}\n\n` +
      'Второй раз создавать его нельзя — новый ключ сломает обновление\n' +
      'у всех, кто уже поставил приложение. Если секреты потерялись, а файл цел,\n' +
      'пароль лежит в keystore-secrets.txt рядом.\n',
  )
  process.exit(1)
}

const password = randomBytes(24).toString('base64url')
const alias = 'wallet'

console.log('Создаю ключ подписи…')

try {
  execFileSync(
    'keytool',
    [
      '-genkeypair',
      '-keystore', keystore,
      '-alias', alias,
      '-keyalg', 'RSA',
      '-keysize', '4096',
      // 10 000 дней ≈ 27 лет: ключ обязан пережить приложение, продлить его нельзя.
      '-validity', '10000',
      '-storepass', password,
      '-keypass', password,
      '-dname', 'CN=Koshelek, O=Personal, C=RU',
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  )
} catch {
  console.error('\nНе удалось запустить keytool. Он входит в состав JDK — проверьте, что java установлена и доступна в PATH.\n')
  process.exit(1)
}

const base64 = readFileSync(keystore).toString('base64')

const instructions = `Секреты для GitHub Actions
==========================

Откройте репозиторий на GitHub → Settings → Secrets and variables → Actions
→ New repository secret. Создайте четыре секрета с такими именами и значениями.

1) KEYSTORE_BASE64
${base64}

2) KEYSTORE_PASSWORD
${password}

3) KEY_ALIAS
${alias}

4) KEY_PASSWORD
${password}

Файл ключа: ${keystore}
Его нельзя выкладывать в репозиторий и нельзя терять — сохраните копию файла
и этого текста там, где не пропадёт вместе с ноутбуком.
`

writeFileSync(secretsFile, instructions, 'utf8')

console.log(`\nГотово.\n\nКлюч:     ${keystore}\nСекреты:  ${secretsFile}\n`)
console.log('Дальше — перенести четыре секрета из этого файла в настройки репозитория на GitHub.')
console.log('Оба файла уже в .gitignore и в репозиторий не попадут.\n')
