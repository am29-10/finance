import type { FinanceData, FlowType, Operation } from '../data/types'
import { operationsBetween, totalsOf } from '../data/store'
import {
  addDays,
  addMonths,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from './date'

export type Period = 'week' | 'month' | 'year'

export interface Range {
  from: Date
  to: Date
}

/** Границы периода, в который попадает опорная дата. */
export function rangeOf(period: Period, anchor: Date): Range {
  if (period === 'week') {
    const from = startOfWeek(anchor)
    return { from, to: addDays(from, 6) }
  }
  if (period === 'month') {
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
  }
  return {
    from: new Date(anchor.getFullYear(), 0, 1),
    to: new Date(anchor.getFullYear(), 11, 31),
  }
}

/** Сдвиг опорной даты на несколько периодов вперёд или назад. */
export function shift(period: Period, anchor: Date, amount: number): Date {
  if (period === 'week') return addDays(anchor, amount * 7)
  if (period === 'month') return addMonths(anchor, amount)
  return new Date(anchor.getFullYear() + amount, anchor.getMonth(), 1)
}

export function operationsIn(data: FinanceData, range: Range): Operation[] {
  return operationsBetween(data, toDateKey(range.from), toDateKey(range.to))
}

export interface Point {
  /** Подпись под столбиком: день месяца или месяц года. */
  label: string
  /** Полная подпись для выбранного столбика. */
  full: string
  amount: number
}

/**
 * Ряд для графика: по дням для недели и месяца, по месяцам для года.
 * Пустые интервалы остаются в ряду нулями — иначе провалы в тратах будут не видны.
 */
export function series(
  period: Period,
  range: Range,
  operations: Operation[],
  type: FlowType,
): Point[] {
  const sums = new Map<string, number>()
  for (const operation of operations) {
    if (operation.type !== type) continue
    const key = period === 'year' ? operation.date.slice(0, 7) : operation.date
    sums.set(key, (sums.get(key) ?? 0) + operation.amount)
  }

  const points: Point[] = []

  if (period === 'year') {
    for (let m = 0; m < 12; m++) {
      const date = new Date(range.from.getFullYear(), m, 1)
      const key = toDateKey(date).slice(0, 7)
      points.push({
        label: new Intl.DateTimeFormat('ru-RU', { month: 'narrow' }).format(date),
        full: new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date),
        amount: sums.get(key) ?? 0,
      })
    }
    return points
  }

  for (let cursor = new Date(range.from); cursor <= range.to; cursor = addDays(cursor, 1)) {
    points.push({
      label: String(cursor.getDate()),
      full: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(cursor),
      amount: sums.get(toDateKey(cursor)) ?? 0,
    })
  }

  return points
}

/** Изменение суммы относительно предыдущего такого же периода, в процентах. */
export function changeVsPrevious(
  data: FinanceData,
  period: Period,
  anchor: Date,
  type: FlowType,
): { percent: number; down: boolean } | null {
  const current = pick(totalsOf(operationsIn(data, rangeOf(period, anchor))), type)
  const previous = pick(totalsOf(operationsIn(data, rangeOf(period, shift(period, anchor, -1)))), type)

  if (previous === 0 || current === 0) return null

  const percent = Math.round(Math.abs((current - previous) / previous) * 100)
  if (percent === 0) return null

  return { percent, down: current < previous }
}

function pick(totals: { income: number; expense: number }, type: FlowType): number {
  return type === 'income' ? totals.income : totals.expense
}

/**
 * Средний расход в день. Для текущего периода делим на прожитые дни,
 * иначе незаконченный месяц занижал бы среднее в разы.
 */
export function averagePerDay(total: number, range: Range): number {
  const today = startOfDay(new Date())
  const last = today < range.to ? today : range.to
  return Math.round(total / Math.max(1, daysBetween(range.from, last)))
}

/** Сколько будет потрачено к концу месяца, если темп сохранится. Только для текущего месяца. */
export function forecast(total: number, range: Range): number | null {
  const today = startOfDay(new Date())
  if (today < startOfDay(range.from) || today > range.to) return null

  const lived = daysBetween(range.from, today)
  const all = daysBetween(range.from, range.to)
  if (lived >= all || lived < 3) return null

  return Math.round((total / lived) * all)
}

/**
 * Сколько календарных дней в отрезке, считая оба конца.
 *
 * Дни считаем от полуночи, а не от текущего мгновения: иначе «прожито дней»
 * увеличивалось бы на единицу в середине суток, и среднее с прогнозом
 * прыгали бы после обеда без единой новой операции.
 */
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000) + 1
}
