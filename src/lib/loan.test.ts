import { describe, expect, it } from 'vitest'
import {
  annuityPayment,
  duePayments,
  forecastPrepayment,
  formatTerm,
  loanStats,
  loansSummary,
  parseRate,
  paymentDate,
} from './loan'
import type { Loan, Prepayment } from '../data/types'

/** Ипотека: 3 000 000 ₽ под 10 % на 20 лет, списание 15-го числа. */
function mortgage(patch: Partial<Loan> = {}): Loan {
  return {
    id: 'l1',
    title: 'Ипотека',
    kind: 'mortgage',
    principal: 300_000_000,
    rate: 1000,
    termMonths: 240,
    startDate: '2024-01-15',
    paymentDay: 15,
    scheme: 'annuity',
    earlyMode: 'term',
    autoExpense: true,
    prepayments: [],
    createdAt: '2024-01-15T00:00:00.000Z',
    ...patch,
  }
}

function prepayment(patch: Partial<Prepayment> = {}): Prepayment {
  return {
    id: 'p1',
    date: '2024-03-01',
    amount: 50_000_00,
    mode: 'term',
    createdAt: '2024-03-01T00:00:00.000Z',
    ...patch,
  }
}

describe('annuityPayment', () => {
  it('считает платёж по формуле аннуитета', () => {
    /**
     * 3 млн под 10 % на 240 месяцев. Считано отдельно от кода:
     * i = 0,1/12 = 0,00833333; (1+i)^240 = 7,328074;
     * 3 000 000 · 0,00833333 · 7,328074 / 6,328074 = 28 950,65 ₽.
     */
    expect(annuityPayment(300_000_000, 1000, 240)).toBe(2_895_065)
  })

  it('при нулевой ставке делит долг поровну', () => {
    expect(annuityPayment(120_000_00, 0, 12)).toBe(100_000_0)
  })

  it('возвращает ноль на погашенном долге', () => {
    expect(annuityPayment(0, 1000, 240)).toBe(0)
  })

  it('считает весь долг платежом, если срока не осталось', () => {
    expect(annuityPayment(50_000_00, 1000, 0)).toBe(50_000_00)
  })
})

describe('paymentDate', () => {
  it('держится указанного числа', () => {
    expect(paymentDate('2024-01-15', 1, 15)).toBe('2024-02-15')
    expect(paymentDate('2024-01-15', 12, 15)).toBe('2025-01-15')
  })

  it('съезжает на последний день короткого месяца', () => {
    expect(paymentDate('2024-01-31', 1, 31)).toBe('2024-02-29')
    expect(paymentDate('2023-01-31', 1, 31)).toBe('2023-02-28')
  })

  it('возвращается к своему числу после короткого месяца', () => {
    expect(paymentDate('2024-01-31', 2, 31)).toBe('2024-03-31')
  })
})

describe('loanStats', () => {
  it('гасит долг в ноль ровно за срок', () => {
    const stats = loanStats(mortgage(), '2044-02-01')

    expect(stats.schedule).toHaveLength(240)
    expect(stats.schedule[239].balance).toBe(0)
    expect(stats.isPaidOff).toBe(true)
  })

  it('не оставляет хвоста долга из-за округления платежа', () => {
    // Последний платёж забирает остаток целиком — иначе график уезжал бы на 241-й месяц.
    const last = loanStats(mortgage(), '2044-02-01').schedule.at(-1)
    expect(last?.balance).toBe(0)
  })

  it('считает переплату больше тела долга на длинном сроке', () => {
    const stats = loanStats(mortgage(), '2024-02-01')

    expect(stats.totalInterest).toBeGreaterThan(300_000_000)
    expect(stats.totalCost).toBe(300_000_000 + stats.totalInterest)
  })

  it('на старте показывает весь долг непогашенным', () => {
    const stats = loanStats(mortgage(), '2024-01-20')

    expect(stats.balance).toBe(300_000_000)
    expect(stats.paidPrincipal).toBe(0)
    expect(stats.progress).toBe(0)
  })

  it('учитывает внесённую досрочку сразу, не дожидаясь планового платежа', () => {
    const loan = mortgage({ prepayments: [prepayment({ date: '2024-03-01', amount: 50_000_00 })] })

    const before = loanStats(mortgage(), '2024-03-05').balance
    const after = loanStats(loan, '2024-03-05').balance

    // 1 марта деньги ушли, а ближайший платёж только 15-го: разница ровно в досрочке.
    expect(before - after).toBe(50_000_00)
  })

  it('сокращает срок досрочкой в режиме term', () => {
    const loan = mortgage({
      prepayments: [prepayment({ amount: 500_000_00, mode: 'term' })],
    })

    const stats = loanStats(loan, '2024-04-01')

    expect(stats.savedMonths).toBeGreaterThan(0)
    expect(stats.savedInterest).toBeGreaterThan(0)
  })

  it('в режиме payment оставляет срок прежним, а платёж снижает', () => {
    const loan = mortgage({
      earlyMode: 'payment',
      prepayments: [prepayment({ amount: 500_000_00, mode: 'payment' })],
    })

    const stats = loanStats(loan, '2024-04-01')
    const base = loanStats(mortgage(), '2024-04-01')

    expect(stats.savedMonths).toBe(0)
    expect(stats.monthlyPayment).toBeLessThan(base.monthlyPayment)
  })

  it('не уводит долг в минус досрочкой больше остатка', () => {
    const loan = mortgage({
      prepayments: [prepayment({ amount: 500_000_000 })],
    })

    const stats = loanStats(loan, '2024-04-01')

    expect(stats.balance).toBe(0)
    expect(stats.isPaidOff).toBe(true)
  })

  it('обрывает бесконечный график, если платёж не покрывает проценты', () => {
    // Ставка 200 % при сроке 240 месяцев: тело не гасится, симуляция обязана остановиться.
    const stats = loanStats(mortgage({ rate: 20_000, scheme: 'differentiated', termMonths: 600 }), '2024-02-01')
    expect(stats.schedule.length).toBeLessThanOrEqual(600)
  })
})

describe('duePayments', () => {
  it('отдаёт только наступившие платежи', () => {
    const due = duePayments(mortgage(), '2024-04-20')

    expect(due.map((row) => row.date)).toEqual(['2024-02-15', '2024-03-15', '2024-04-15'])
  })

  it('в день платежа считает его наступившим', () => {
    expect(duePayments(mortgage(), '2024-02-15')).toHaveLength(1)
  })
})

describe('forecastPrepayment', () => {
  it('показывает остаток сразу после внесения суммы', () => {
    const forecast = forecastPrepayment(mortgage(), 100_000_00, '2024-02-20')

    expect(forecast).not.toBeNull()
    expect(forecast!.term.balance).toBe(loanStats(mortgage(), '2024-02-20').balance - 100_000_00)
  })

  it('в режиме срока экономит больше процентов, чем в режиме платежа', () => {
    const forecast = forecastPrepayment(mortgage(), 300_000_00, '2024-02-20')!

    expect(forecast.term.savedInterest).toBeGreaterThan(forecast.payment.savedInterest)
    expect(forecast.term.savedMonths).toBeGreaterThan(0)
    expect(forecast.payment.savedMonthly).toBeGreaterThan(0)
  })

  it('отказывается считать нулевую и отрицательную сумму', () => {
    expect(forecastPrepayment(mortgage(), 0)).toBeNull()
    expect(forecastPrepayment(mortgage(), -100)).toBeNull()
  })

  it('ничего не считает по выплаченному кредиту', () => {
    expect(forecastPrepayment(mortgage(), 100_000_00, '2044-02-01')).toBeNull()
  })
})

describe('loansSummary', () => {
  it('складывает долги и платежи по незакрытым кредитам', () => {
    const summary = loansSummary(
      [mortgage(), mortgage({ id: 'l2', principal: 100_000_000, termMonths: 60 })],
      '2024-02-01',
    )

    expect(summary.count).toBe(2)
    expect(summary.debt).toBe(400_000_000)
    expect(summary.nextDate).toBe('2024-02-15')
  })

  it('пропускает закрытые кредиты', () => {
    const summary = loansSummary([mortgage({ closedAt: '2024-02-01T00:00:00.000Z' })], '2024-02-01')

    expect(summary.count).toBe(0)
    expect(summary.debt).toBe(0)
  })
})

describe('parseRate', () => {
  it('переводит проценты в сотые доли', () => {
    expect(parseRate('10,5')).toBe(1050)
    expect(parseRate('10.5')).toBe(1050)
    expect(parseRate('7')).toBe(700)
  })

  it('отвергает мусор и невозможные ставки', () => {
    expect(parseRate('')).toBeNull()
    expect(parseRate('abc')).toBeNull()
    expect(parseRate('-5')).toBeNull()
    expect(parseRate('300')).toBeNull()
  })
})

describe('formatTerm', () => {
  it('склоняет годы и месяцы', () => {
    expect(formatTerm(40)).toBe('3 года 4 месяца')
    expect(formatTerm(11)).toBe('11 месяцев')
    expect(formatTerm(12)).toBe('1 год')
    expect(formatTerm(0)).toBe('меньше месяца')
  })
})
