import { describe, expect, it } from 'vitest'
import { nextOccurrence, occurrenceAt, occurrencesBetween } from './recurrence'
import type { Recurrence } from '../data/types'

function rule(patch: Partial<Recurrence> = {}): Recurrence {
  return {
    id: 'r1',
    type: 'expense',
    amount: 29900,
    categoryId: 'subscriptions',
    accountId: 'a1',
    period: 'month',
    startDate: '2026-01-15',
    createdAt: '2026-01-15T00:00:00.000Z',
    ...patch,
  }
}

describe('occurrenceAt', () => {
  it('шагает неделями', () => {
    expect(occurrenceAt('2026-01-15', 'week', 0)).toBe('2026-01-15')
    expect(occurrenceAt('2026-01-15', 'week', 3)).toBe('2026-02-05')
  })

  it('шагает месяцами, держась своего числа', () => {
    expect(occurrenceAt('2026-01-15', 'month', 1)).toBe('2026-02-15')
    expect(occurrenceAt('2026-01-15', 'month', 12)).toBe('2027-01-15')
  })

  it('съезжает на последний день короткого месяца', () => {
    expect(occurrenceAt('2026-01-31', 'month', 1)).toBe('2026-02-28')
    expect(occurrenceAt('2024-01-31', 'month', 1)).toBe('2024-02-29')
  })

  it('после короткого месяца возвращается к своему числу', () => {
    // Аренда 31-го числа: в феврале списывается 28-го, но в марте снова 31-го.
    expect(occurrenceAt('2026-01-31', 'month', 2)).toBe('2026-03-31')
  })

  it('шагает годами и переносит 29 февраля на 28-е', () => {
    expect(occurrenceAt('2026-03-01', 'year', 2)).toBe('2028-03-01')
    expect(occurrenceAt('2024-02-29', 'year', 1)).toBe('2025-02-28')
  })
})

describe('occurrencesBetween', () => {
  it('включает дату начала и все даты до границы', () => {
    expect(occurrencesBetween(rule(), '2026-04-01')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ])
  })

  it('включает саму границу', () => {
    expect(occurrencesBetween(rule(), '2026-02-15')).toEqual(['2026-01-15', '2026-02-15'])
  })

  it('пропускает всё, что уже создано', () => {
    expect(occurrencesBetween(rule(), '2026-04-20', '2026-02-15')).toEqual([
      '2026-03-15',
      '2026-04-15',
    ])
  })

  it('не отдаёт дату, равную отметке о создании', () => {
    // Иначе операция, заведённая руками при создании правила, задвоилась бы.
    expect(occurrencesBetween(rule(), '2026-01-20', '2026-01-15')).toEqual([])
  })

  it('пуст, если правило ещё не началось', () => {
    expect(occurrencesBetween(rule({ startDate: '2026-06-01' }), '2026-01-20')).toEqual([])
  })

  it('накапливает пропущенное за долгое отсутствие', () => {
    expect(occurrencesBetween(rule({ period: 'week' }), '2026-03-15')).toHaveLength(9)
  })
})

describe('nextOccurrence', () => {
  it('находит ближайшую будущую дату', () => {
    expect(nextOccurrence(rule(), '2026-02-20')).toBe('2026-03-15')
  })

  it('в день срабатывания смотрит уже на следующий раз', () => {
    expect(nextOccurrence(rule(), '2026-02-15')).toBe('2026-03-15')
  })

  it('молчит про приостановленное правило', () => {
    expect(nextOccurrence(rule({ pausedAt: '2026-02-01T00:00:00.000Z' }), '2026-02-20')).toBeNull()
  })
})
