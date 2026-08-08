/**
 * Все суммы внутри приложения — целое число копеек.
 * Здесь единственное место, где они превращаются в рубли и обратно.
 */

/** 125050 → «1 250,50 ₽», 12000000 → «120 000 ₽» (копейки скрыты, когда их нет). */
export function formatMoney(cents: number, options: { sign?: boolean } = {}): string {
  const hasKopecks = cents % 100 !== 0
  const value = Math.abs(cents) / 100

  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: hasKopecks ? 2 : 0,
    maximumFractionDigits: hasKopecks ? 2 : 0,
  }).format(value)

  const prefix = options.sign ? (cents < 0 ? '−' : '+') : cents < 0 ? '−' : ''
  return `${prefix}${formatted} ₽`
}

/** Компактный формат для осей графиков: 56250000 → «56k». */
export function formatCompact(cents: number): string {
  const rubles = Math.round(cents / 100)
  if (Math.abs(rubles) >= 1000) return `${Math.round(rubles / 1000)}k`
  return String(rubles)
}

/**
 * Разбор пользовательского ввода в копейки: «1 250,50», «1250.5», «1250» → 125050.
 * Возвращает null, если ввод не похож на сумму.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/\s| /g, '').replace(',', '.')
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null

  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null

  // Округляем до копейки: 0.1 + 0.2 в JS даёт 0.30000000000000004.
  return Math.round(value * 100)
}

/** Ввод суммы с разделителями разрядов по мере набора: «1250» → «1 250». */
export function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, '').replace('.', ',')
  const [whole, ...rest] = cleaned.split(',')
  const fraction = rest.join('').slice(0, 2)

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return rest.length > 0 ? `${grouped},${fraction}` : grouped
}
