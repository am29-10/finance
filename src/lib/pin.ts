/**
 * PIN-код закрывает приложение от чужих глаз, а не от взлома.
 *
 * Данные лежат в хранилище браузера в открытом виде: человек с разблокированным
 * телефоном и минимальными знаниями достанет их в обход экрана ввода. Поэтому
 * здесь обычный быстрый хеш, а не криптография — она создала бы ложное чувство
 * защищённости и при этом не работала бы по HTTP (Web Crypto требует HTTPS).
 */

const SALT = 'finance-pin-v1'

export const PIN_LENGTH = 4

export function hashPin(pin: string): string {
  const input = SALT + pin
  let hash = 5381

  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }

  return (hash >>> 0).toString(36)
}

export function checkPin(pin: string, hash: string | undefined): boolean {
  return Boolean(hash) && hashPin(pin) === hash
}
