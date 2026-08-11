import { describe, expect, it } from 'vitest'
import { averagePerDay, changeVsPrevious, forecast, rangeOf, series, shift } from './analytics'
import { defaultCategories } from '../data/categories'
import { toDateKey } from './date'
import type { FinanceData, Operation } from '../data/types'

function operation(patch: Partial<Operation> = {}): Operation {
  return {
    id: `o${Math.round(Math.random() * 1e9)}`,
    type: 'expense',
    amount: 100_000,
    categoryId: 'products',
    date: '2026-02-10',
    accountId: 'a1',
    createdAt: '2026-02-10T00:00:00.000Z',
    ...patch,
  }
}

function data(operations: Operation[]): FinanceData {
  return {
    version: 4,
    operations,
    categories: defaultCategories(),
    accounts: [],
    loans: [],
    recurrences: [],
    vehicles: [],
    properties: [],
    settings: { monthlyBudget: 0, rates: {} },
  }
}

describe('rangeOf', () => {
  it('берёт неделю с понедельника по воскресенье', () => {
    // 11 февраля 2026 — среда.
    const range = rangeOf('week', new Date(2026, 1, 11))

    expect(toDateKey(range.from)).toBe('2026-02-09')
    expect(toDateKey(range.to)).toBe('2026-02-15')
  })

  it('в воскресенье не перескакивает на следующую неделю', () => {
    const range = rangeOf('week', new Date(2026, 1, 15))

    expect(toDateKey(range.from)).toBe('2026-02-09')
  })

  it('берёт месяц целиком, включая февраль', () => {
    const range = rangeOf('month', new Date(2026, 1, 10))

    expect(toDateKey(range.from)).toBe('2026-02-01')
    expect(toDateKey(range.to)).toBe('2026-02-28')
  })

  it('берёт год целиком', () => {
    const range = rangeOf('year', new Date(2026, 5, 10))

    expect(toDateKey(range.from)).toBe('2026-01-01')
    expect(toDateKey(range.to)).toBe('2026-12-31')
  })
})

describe('shift', () => {
  it('двигает на неделю, месяц и год', () => {
    expect(toDateKey(shift('week', new Date(2026, 1, 11), -1))).toBe('2026-02-04')
    expect(toDateKey(shift('month', new Date(2026, 1, 11), 1))).toBe('2026-03-01')
    expect(toDateKey(shift('year', new Date(2026, 1, 11), -1))).toBe('2025-02-01')
  })
})

describe('series', () => {
  it('даёт точку на каждый день периода, включая пустые', () => {
    const range = rangeOf('week', new Date(2026, 1, 11))
    const points = series('week', range, [operation({ date: '2026-02-10' })], 'expense')

    expect(points).toHaveLength(7)
    expect(points[1].amount).toBe(100_000)
    expect(points[0].amount).toBe(0)
  })

  it('за год складывает по месяцам', () => {
    const range = rangeOf('year', new Date(2026, 0, 1))
    const points = series(
      'year',
      range,
      [operation({ date: '2026-02-10' }), operation({ date: '2026-02-20' })],
      'expense',
    )

    expect(points).toHaveLength(12)
    expect(points[1].amount).toBe(200_000)
  })

  it('не смешивает доходы с расходами', () => {
    const range = rangeOf('month', new Date(2026, 1, 1))
    const points = series(
      'month',
      range,
      [operation({ date: '2026-02-10', type: 'income', amount: 500_000 })],
      'expense',
    )

    expect(points.every((point) => point.amount === 0)).toBe(true)
  })
})

describe('changeVsPrevious', () => {
  it('считает рост в процентах от предыдущего периода', () => {
    const state = data([
      operation({ date: '2026-01-10', amount: 100_000 }),
      operation({ date: '2026-02-10', amount: 150_000 }),
    ])

    expect(changeVsPrevious(state, 'month', new Date(2026, 1, 15), 'expense')).toEqual({
      percent: 50,
      down: false,
    })
  })

  it('отмечает снижение', () => {
    const state = data([
      operation({ date: '2026-01-10', amount: 200_000 }),
      operation({ date: '2026-02-10', amount: 100_000 }),
    ])

    expect(changeVsPrevious(state, 'month', new Date(2026, 1, 15), 'expense')?.down).toBe(true)
  })

  it('молчит, когда сравнивать не с чем', () => {
    const state = data([operation({ date: '2026-02-10' })])

    expect(changeVsPrevious(state, 'month', new Date(2026, 1, 15), 'expense')).toBeNull()
  })

  it('молчит при нулевой разнице', () => {
    const state = data([
      operation({ date: '2026-01-10', amount: 100_000 }),
      operation({ date: '2026-02-10', amount: 100_000 }),
    ])

    expect(changeVsPrevious(state, 'month', new Date(2026, 1, 15), 'expense')).toBeNull()
  })
})

describe('averagePerDay', () => {
  it('делит на все дни завершённого периода', () => {
    const range = { from: new Date(2020, 0, 1), to: new Date(2020, 0, 10) }

    expect(averagePerDay(1_000_000, range)).toBe(100_000)
  })

  it('никогда не делит на ноль', () => {
    const day = new Date(2020, 0, 1)

    expect(averagePerDay(100_000, { from: day, to: day })).toBe(100_000)
  })
})

describe('forecast', () => {
  it('не строит прогноз по прошедшему периоду', () => {
    expect(forecast(100_000, { from: new Date(2020, 0, 1), to: new Date(2020, 0, 31) })).toBeNull()
  })

  it('не строит прогноз по будущему периоду', () => {
    expect(forecast(100_000, { from: new Date(2099, 0, 1), to: new Date(2099, 0, 31) })).toBeNull()
  })

  it('экстраполирует темп текущего месяца', () => {
    const today = new Date()
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const lived = today.getDate()
    const projected = forecast(100_000 * lived, { from, to })

    // До третьего числа прогноз не строится: слишком мало данных, чтобы гадать.
    if (lived < 3 || lived >= to.getDate()) {
      expect(projected).toBeNull()
    } else {
      expect(projected).toBe(100_000 * to.getDate())
    }
  })
})
