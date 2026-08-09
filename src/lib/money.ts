import { BASE_CURRENCY, currencySymbol } from './currency'

/**
 * Все суммы внутри приложения — целое число минорных единиц (копеек, центов).
 * Здесь единственное место, где они превращаются в рубли и обратно.
 *
 * Показываем и вводим только целые рубли: в личном учёте копейки — шум, из-за
 * которого крупные числа читаются хуже, а решений они не меняют. Хранение при
 * этом остаётся копеечным — иначе развалились бы и импорт банковской выписки,
 * где копейки настоящие, и расчёт процентов по кредиту.
 *
 * Плата за это: сумма показанных частей иногда отличается от показанного итога
 * на рубль. Это неизбежно при любом округлении и лучше, чем «45 638,78 ₽».
 */

interface FormatOptions {
  /** Показывать «+» у положительных чисел. Минус ставится всегда. */
  sign?: boolean
  /** Код валюты; по умолчанию рубль. */
  currency?: string
}

/** 12505000 → «125 050 ₽», 2500 → «25 $». */
export function formatMoney(minor: number, options: FormatOptions = {}): string {
  const value = Math.round(Math.abs(minor) / 100)

  const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
  const prefix = options.sign ? (minor < 0 ? '−' : '+') : minor < 0 ? '−' : ''

  return `${prefix}${formatted} ${currencySymbol(options.currency ?? BASE_CURRENCY)}`
}

/** Компактный формат для осей графиков: 5 625 000 копеек (56 250 ₽) → «56k». */
export function formatCompact(minor: number): string {
  const units = Math.round(minor / 100)
  if (Math.abs(units) >= 1000) return `${Math.round(units / 1000)}k`
  return String(units)
}

/**
 * Разбор пользовательского ввода в минорные единицы: «1 250» → 125000.
 * Возвращает null, если ввод не похож на сумму.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/\s| /g, '')
  if (!cleaned || !/^\d+$/.test(cleaned)) return null

  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null

  return value * 100
}

/** Ввод суммы с разделителями разрядов по мере набора: «1250» → «1 250». */
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Сумма из хранилища в поле ввода: 14999 → «150».
 * Округляем здесь, а не при сохранении, иначе открытая на правку операция
 * с копейками превратилась бы в сумму в сто раз больше.
 */
export function toAmountInput(minor: number): string {
  return formatAmountInput(String(Math.round(minor / 100)))
}

/* ── Остаток на счёте ──────────────────────────────────────────────────── */

/**
 * Остаток разбирается не так, как сумма операции: он бывает нулевым и
 * отрицательным.
 *
 * Ноль — это «на карте пусто», а не «человек ничего не ввёл», и отвергать его
 * значило бы не давать обнулить счёт. Минус — это карта, ушедшая в овердрафт:
 * запретив его, мы заставили бы показывать чужое число вместо своего.
 *
 * Возвращает null, если ввод вообще не похож на число.
 */
export function parseBalance(input: string): number | null {
  const cleaned = input.replace(/\s| /g, '').replace(/^[−–—-]/, '-')
  if (!/^-?\d+$/.test(cleaned)) return null

  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null

  return value * 100
}

/**
 * Ввод остатка с разрядами и сохранением минуса: «-12500» → «−12 500».
 * Одинокий минус оставляем как есть — человек ещё набирает число.
 */
export function formatBalanceInput(raw: string): string {
  const negative = /^\s*[−–—-]/.test(raw)
  const grouped = formatAmountInput(raw)

  return negative ? `−${grouped}` : grouped
}

/** Остаток из хранилища в поле ввода: −125000 → «−1 250». */
export function toBalanceInput(minor: number): string {
  return formatBalanceInput(String(Math.round(minor / 100)))
}
