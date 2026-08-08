/**
 * Календарь повторяющихся операций.
 *
 * Даты не хранятся, а вычисляются от даты первой операции: шаг в неделю, месяц
 * или год. Хранить список будущих дат нельзя — человек в любой момент меняет
 * период или ставит повтор на паузу, и сохранённый список тут же расходится
 * с правилом, по которому его строили.
 */

import type { DateKey, Recurrence, RecurrencePeriod } from '../data/types'
import { addDays, fromDateKey, toDateKey, todayKey } from './date'

/**
 * Потолок числа дат за один расчёт.
 *
 * Приложение могли не открывать год, и еженедельный повтор за это время
 * накопит полсотни операций — это нормально. Тысяча же означает кривые данные
 * (дата начала в 1970-м), и создавать тысячу расходов не нужно никому.
 */
const MAX_OCCURRENCES = 1000

/**
 * Дата, отстоящая от начала на N периодов.
 *
 * 31-е число есть не в каждом месяце, а 29 февраля — не в каждом году: и то и
 * другое съезжает на последний день месяца, ровно как поступает банк со
 * списанием. Именно съезжает, а не сдвигается на следующий месяц: аренда,
 * заведённая 31-го, в феврале списывается 28-го и в марте снова 31-го.
 */
export function occurrenceAt(startDate: DateKey, period: RecurrencePeriod, step: number): DateKey {
  const start = fromDateKey(startDate)

  if (period === 'week') return toDateKey(addDays(start, step * 7))

  const target =
    period === 'month'
      ? new Date(start.getFullYear(), start.getMonth() + step, 1)
      : new Date(start.getFullYear() + step, start.getMonth(), 1)

  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(start.getDate(), lastDay))

  return toDateKey(target)
}

/**
 * Даты повторов, попадающие в промежуток `(after, until]`.
 *
 * Левая граница открытая: `after` — это отметка «до сюда уже создано», и
 * включать её значило бы завести операцию второй раз.
 */
export function occurrencesBetween(
  rule: Pick<Recurrence, 'startDate' | 'period'>,
  until: DateKey,
  after?: DateKey,
): DateKey[] {
  const dates: DateKey[] = []

  for (let step = 0; step < MAX_OCCURRENCES; step += 1) {
    const date = occurrenceAt(rule.startDate, rule.period, step)
    if (date > until) break
    if (!after || date > after) dates.push(date)
  }

  return dates
}

/** Ближайшая дата повтора после сегодняшнего дня. */
export function nextOccurrence(rule: Recurrence, today: DateKey = todayKey()): DateKey | null {
  if (rule.pausedAt) return null

  for (let step = 0; step < MAX_OCCURRENCES; step += 1) {
    const date = occurrenceAt(rule.startDate, rule.period, step)
    if (date > today) return date
  }

  return null
}

export const PERIOD_TITLES: Record<RecurrencePeriod, string> = {
  week: 'Каждую неделю',
  month: 'Каждый месяц',
  year: 'Каждый год',
}

export const PERIOD_SHORT: Record<RecurrencePeriod, string> = {
  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
}
