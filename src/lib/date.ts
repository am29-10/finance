import type { DateKey } from '../data/types'

/** Ключ даты берём из локального времени: toISOString() переводит в UTC и вечером сдвигает день. */
export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): DateKey {
  return toDateKey(new Date())
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

/** Понедельник той недели, в которую попадает дата. */
export function startOfWeek(date: Date): Date {
  const js = date.getDay()
  const iso = js === 0 ? 7 : js
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -(iso - 1))
}

/** Полночь этого дня. Нужна там, где считают дни, а не мгновения. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/** «Сегодня» / «Вчера» / «12 августа» — заголовок группы в истории операций. */
export function formatDayHeading(key: DateKey): string {
  const today = todayKey()
  if (key === today) return 'Сегодня'
  if (key === toDateKey(addDays(new Date(), -1))) return 'Вчера'

  const date = fromDateKey(key)
  const sameYear = date.getFullYear() === new Date().getFullYear()

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: sameYear ? undefined : 'numeric',
  }).format(date)
}

/** «24 мая 2024 г.» — подпись выбранной даты в форме. */
export function formatFullDate(key: DateKey): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fromDateKey(key))
}

/** «май» или «май 2024», если год не текущий, — подпись периода внутри строки. */
export function formatMonthInline(date: Date): string {
  const sameYear = date.getFullYear() === new Date().getFullYear()

  return new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: sameYear ? undefined : 'numeric',
  })
    .format(date)
    .replace(' г.', '')
}

/** «Май 2024» — заголовок периода. */
export function formatMonth(date: Date): string {
  const text = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date)
  return text.charAt(0).toUpperCase() + text.slice(1).replace(' г.', '')
}
