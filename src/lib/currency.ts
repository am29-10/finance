/**
 * Валюты счетов.
 *
 * Базовая валюта приложения — рубль, и это осознанно не настраивается: общий
 * итог всегда в рублях, а валютные счета к нему приводятся. Иначе пришлось бы
 * тащить выбранную базу через каждую функцию форматирования ради возможности,
 * которой почти никто не воспользуется.
 *
 * Курсы вводятся вручную. Тянуть их из интернета — значит потерять главное
 * свойство приложения: оно работает без сервера и без сети. Курс, введённый
 * раз в месяц, для «сколько у меня всего» точен более чем достаточно.
 */

export const BASE_CURRENCY = 'RUB'

interface CurrencyInfo {
  code: string
  symbol: string
  title: string
}

/** Валюты с двумя знаками после запятой — все суммы в приложении целые в минорных единицах. */
export const CURRENCIES: CurrencyInfo[] = [
  { code: 'RUB', symbol: '₽', title: 'Рубль' },
  { code: 'USD', symbol: '$', title: 'Доллар США' },
  { code: 'EUR', symbol: '€', title: 'Евро' },
  { code: 'GBP', symbol: '£', title: 'Фунт стерлингов' },
  { code: 'CNY', symbol: '¥', title: 'Юань' },
  { code: 'KZT', symbol: '₸', title: 'Тенге' },
  { code: 'BYN', symbol: 'Br', title: 'Белорусский рубль' },
  { code: 'TRY', symbol: '₺', title: 'Турецкая лира' },
  { code: 'AED', symbol: 'AED', title: 'Дирхам ОАЭ' },
  { code: 'GEL', symbol: '₾', title: 'Лари' },
  { code: 'RSD', symbol: 'RSD', title: 'Сербский динар' },
  { code: 'THB', symbol: '฿', title: 'Бат' },
]

export function currencyInfo(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? { code, symbol: code, title: code }
}

export function currencySymbol(code: string): string {
  return currencyInfo(code).symbol
}

/**
 * Курс к рублю: сколько КОПЕЕК стоит одна единица валюты.
 * 1 $ = 95,50 ₽ → 9550. Целое по той же причине, что и суммы.
 */
export type Rates = Record<string, number>

/**
 * Перевод суммы в рубли. Возвращает null, если курс не задан, — тогда счёт
 * нельзя молча приплюсовать к итогу, и интерфейс обязан сказать об этом вслух.
 */
export function toBase(amount: number, currency: string, rates: Rates): number | null {
  if (currency === BASE_CURRENCY) return amount

  const rate = rates[currency]
  if (!rate || rate <= 0) return null

  return Math.round((amount * rate) / 100)
}

/** Ввод курса в копейки за единицу: «95,5» → 9550. */
export function parseRateInput(input: string): number | null {
  const cleaned = input.replace(/\s/g, '').replace(',', '.')
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null

  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null

  return Math.round(value * 100)
}

/** 9550 → «95,5» для поля ввода. */
export function formatRateInput(rate: number): string {
  return String(rate / 100).replace('.', ',')
}
