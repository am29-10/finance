/**
 * Расчёт кредитов: график погашения, остаток долга, эффект досрочных платежей.
 *
 * Ключевое допущение, на котором держится весь модуль: **регулярные платежи
 * вносятся вовремя**. Банк списывает их автоматически, и требовать от человека
 * отмечать 240 платежей по ипотеке бессмысленно — он бросит это на третий месяц,
 * и остаток долга станет враньём. Поэтому вручную заводятся только досрочные
 * погашения, а плановый график строится сам от даты начала.
 *
 * Второе допущение: проценты начисляются раз в месяц на остаток, а досрочный
 * платёж применяется в конце того периода, в который он попал. Банки считают по
 * фактическим дням, поэтому итог здесь расходится с выпиской на десятки рублей
 * при остатке в миллионы. Для «что будет, если внести 300 тысяч» этой точности
 * достаточно, для сверки с банком — нет.
 */

import type { DateKey, EarlyMode, Loan, Prepayment } from '../data/types'
import { fromDateKey, toDateKey, todayKey } from './date'
import { plural } from './text'

/** Потолок длины графика — 50 лет. Страховка от вечного цикла на кривых данных. */
const MAX_MONTHS = 600

/** Годовая ставка в сотых долях процента → месячная дробью: 1050 (10,5 %) → 0,00875. */
function monthlyRate(rate: number): number {
  return rate / 120_000
}

/**
 * Дата N-го платежа, считая от месяца начала.
 * 31-го числа в феврале не бывает — платёж съезжает на последний день месяца,
 * ровно как в банке.
 */
export function paymentDate(startDate: DateKey, index: number, paymentDay: number): DateKey {
  const start = fromDateKey(startDate)
  const target = new Date(start.getFullYear(), start.getMonth() + index, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(Math.max(paymentDay, 1), lastDay))
  return toDateKey(target)
}

/** Аннуитетный платёж: P · i · (1+i)^n / ((1+i)^n − 1). При нулевой ставке — просто P / n. */
export function annuityPayment(balance: number, rate: number, months: number): number {
  if (balance <= 0) return 0
  if (months <= 0) return balance

  const i = monthlyRate(rate)
  if (i === 0) return Math.ceil(balance / months)

  const factor = (1 + i) ** months
  return Math.round((balance * i * factor) / (factor - 1))
}

export interface ScheduleRow {
  /** Номер платежа, с единицы. */
  index: number
  date: DateKey
  /** Сколько уходит банком в этом месяце по графику, без досрочки. */
  payment: number
  interest: number
  /** Часть планового платежа, ушедшая в тело долга. */
  principal: number
  /** Досрочно внесено сверх графика в этом периоде. */
  prepayment: number
  /** Остаток долга после планового платежа и досрочки. */
  balance: number
}

/**
 * Помесячная симуляция от даты начала до полного погашения.
 *
 * Досрочка применяется после планового платежа того периода, в чью дату она
 * попала; всё, что внесено до первого платежа, приходит в первый период.
 */
function buildSchedule(loan: Loan, prepayments: Prepayment[]): ScheduleRow[] {
  const i = monthlyRate(loan.rate)
  const queue = [...prepayments].sort((a, b) => (a.date < b.date ? -1 : 1))

  const rows: ScheduleRow[] = []
  let balance = loan.principal
  let termLeft = loan.termMonths
  let payment = annuityPayment(balance, loan.rate, termLeft)
  let body = Math.round(balance / Math.max(termLeft, 1))
  let queued = 0

  for (let index = 1; index <= MAX_MONTHS && balance > 0; index += 1) {
    const date = paymentDate(loan.startDate, index, loan.paymentDay)
    const interest = Math.round(balance * i)

    /**
     * Последний по сроку платёж забирает весь остаток.
     *
     * Платёж округлён до копейки, и за две сотни месяцев недобор в полкопейки
     * складывается в живые рубли. Без этого после финального платежа на долге
     * висело бы несколько рублей, график уезжал на лишний месяц, и режим
     * «снизить платёж» втихую менял срок, который обязан оставаться прежним.
     */
    const planned = termLeft === 1 ? balance : loan.scheme === 'annuity' ? payment - interest : body

    // Платёж, не покрывающий проценты, долг не гасит — такой график бесконечен.
    if (planned <= 0) break

    const principal = Math.min(planned, balance)
    balance -= principal
    termLeft = Math.max(termLeft - 1, 0)

    let prepaid = 0
    let mode: EarlyMode = loan.earlyMode

    while (queued < queue.length && queue[queued].date <= date) {
      const applied = Math.min(queue[queued].amount, balance)
      balance -= applied
      prepaid += applied
      mode = queue[queued].mode
      queued += 1
    }

    // Сокращение срока не трогает платёж: график просто обрывается раньше.
    if (prepaid > 0 && balance > 0 && mode === 'payment' && termLeft > 0) {
      payment = annuityPayment(balance, loan.rate, termLeft)
      body = Math.round(balance / termLeft)
    }

    rows.push({ index, date, payment: interest + principal, interest, principal, prepayment: prepaid, balance })
  }

  return rows
}

export interface LoanStats {
  schedule: ScheduleRow[]
  /** Ближайший платёж по графику; нет — значит кредит выплачен. */
  next?: ScheduleRow
  /** Сколько платить в следующий раз. */
  monthlyPayment: number
  /** Остаток долга на сегодня — главное число на карточке. */
  balance: number
  /** Погашено тела долга, включая досрочные. */
  paidPrincipal: number
  paidInterest: number
  /** Всего внесено денег на сегодня. */
  paidTotal: number
  prepaidTotal: number
  /** Проценты за весь срок — переплата. */
  totalInterest: number
  /** Тело плюс проценты: полная стоимость кредита. */
  totalCost: number
  closingDate: DateKey
  monthsLeft: number
  /** Доля погашенного тела, 0…1. */
  progress: number
  /** Сэкономлено на процентах благодаря досрочным. */
  savedInterest: number
  /** На сколько месяцев досрочные приблизили закрытие. */
  savedMonths: number
  isPaidOff: boolean
}

export function loanStats(loan: Loan, today: DateKey = todayKey()): LoanStats {
  const schedule = buildSchedule(loan, loan.prepayments)
  const base = loan.prepayments.length > 0 ? buildSchedule(loan, []) : schedule

  const past = schedule.filter((row) => row.date <= today)
  const next = schedule.find((row) => row.date > today)

  const paidPrincipal = sum(past, (row) => row.principal + row.prepayment)
  const paidInterest = sum(past, (row) => row.interest)
  const totalInterest = sum(schedule, (row) => row.interest)

  const balance = past.length > 0 ? past[past.length - 1].balance : loan.principal
  const last = schedule[schedule.length - 1]

  return {
    schedule,
    next,
    monthlyPayment: next?.payment ?? 0,
    balance,
    paidPrincipal,
    paidInterest,
    paidTotal: paidPrincipal + paidInterest,
    prepaidTotal: sum(schedule, (row) => row.prepayment),
    totalInterest,
    totalCost: loan.principal + totalInterest,
    closingDate: last?.date ?? loan.startDate,
    monthsLeft: schedule.length - past.length,
    progress: loan.principal > 0 ? Math.min(paidPrincipal / loan.principal, 1) : 1,
    savedInterest: Math.max(sum(base, (row) => row.interest) - totalInterest, 0),
    savedMonths: Math.max(base.length - schedule.length, 0),
    isPaidOff: balance <= 0,
  }
}

export interface Forecast {
  mode: EarlyMode
  /**
   * Долг сразу после внесения суммы — то число, которое человек ждёт увидеть
   * в банке. Взять остаток из графика нельзя: досрочка ложится в период
   * ближайшего планового платежа, и его тело тоже попало бы в этот остаток.
   */
  balance: number
  /** Ежемесячный платёж после пересчёта. */
  monthlyPayment: number
  closingDate: DateKey
  monthsLeft: number
  /** Сколько процентов эта сумма экономит по сравнению с «не вносить». */
  savedInterest: number
  savedMonths: number
  /** Насколько упадёт ежемесячный платёж. */
  savedMonthly: number
}

/**
 * «Что будет, если внести N рублей» — в обоих режимах сразу, чтобы человек
 * увидел развилку: сократить срок или снизить платёж.
 */
export function forecastPrepayment(
  loan: Loan,
  amount: number,
  date: DateKey = todayKey(),
): Record<EarlyMode, Forecast> | null {
  if (amount <= 0) return null

  const current = loanStats(loan, date)
  if (current.isPaidOff) return null

  const build = (mode: EarlyMode): Forecast => {
    const virtual: Prepayment = {
      id: '__forecast',
      date,
      amount,
      mode,
      createdAt: date,
    }

    const after = loanStats({ ...loan, prepayments: [...loan.prepayments, virtual] }, date)

    /**
     * Пересчитанный платёж начинается не с ближайшего списания, а со следующего:
     * досрочка ложится в конец того же периода, и его платёж банк уже посчитал
     * по старому графику. Брать `after.monthlyPayment` нельзя — он показал бы
     * прежнюю сумму, и режим «снизить платёж» выглядел бы бесполезным.
     */
    const landing = after.schedule.findIndex((row) => row.date > date)
    const monthlyPayment =
      landing >= 0 ? (after.schedule[landing + 1]?.payment ?? 0) : after.monthlyPayment

    return {
      mode,
      balance: Math.max(current.balance - amount, 0),
      monthlyPayment,
      closingDate: after.closingDate,
      monthsLeft: after.monthsLeft,
      savedInterest: Math.max(current.totalInterest - after.totalInterest, 0),
      savedMonths: Math.max(current.schedule.length - after.schedule.length, 0),
      savedMonthly: Math.max(current.monthlyPayment - monthlyPayment, 0),
    }
  }

  return { term: build('term'), payment: build('payment') }
}

/**
 * Плановые платежи, срок которых уже наступил, — из них синхронизация делает
 * операции расхода. Досрочные сюда не входят: они попадают в расходы сразу
 * при добавлении.
 */
export function duePayments(loan: Loan, today: DateKey = todayKey()): ScheduleRow[] {
  return buildSchedule(loan, loan.prepayments).filter((row) => row.date <= today)
}

export interface LoansSummary {
  /** Суммарный остаток по всем незакрытым кредитам. */
  debt: number
  /** Сколько уходит на кредиты в месяц. */
  monthly: number
  /** Ближайший платёж по любому из кредитов. */
  nextDate?: DateKey
  nextAmount: number
  count: number
}

export function loansSummary(loans: Loan[], today: DateKey = todayKey()): LoansSummary {
  const summary: LoansSummary = { debt: 0, monthly: 0, nextAmount: 0, count: 0 }

  for (const loan of loans) {
    if (loan.closedAt) continue

    const stats = loanStats(loan, today)
    if (stats.isPaidOff) continue

    summary.count += 1
    summary.debt += stats.balance
    summary.monthly += stats.monthlyPayment

    if (stats.next && (!summary.nextDate || stats.next.date < summary.nextDate)) {
      summary.nextDate = stats.next.date
      summary.nextAmount = stats.next.payment
    }
  }

  return summary
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + pick(row), 0)
}

export const LOAN_KIND_TITLES: Record<Loan['kind'], string> = {
  mortgage: 'Ипотека',
  consumer: 'Потребительский',
  auto: 'Автокредит',
  other: 'Другой',
}

/** «10,5 %» из 1050. */
export function formatRate(rate: number): string {
  const value = rate / 100
  return `${value.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} %`
}

/** Ввод ставки в сотые доли процента: «10,5» → 1050. null, если это не ставка. */
export function parseRate(input: string): number | null {
  const cleaned = input.replace(/\s/g, '').replace(',', '.')
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null

  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0 || value > 200) return null

  return Math.round(value * 100)
}

/** «3 года 4 месяца», «11 месяцев» — срок словами. */
export function formatTerm(months: number): string {
  if (months <= 0) return 'меньше месяца'

  const years = Math.floor(months / 12)
  const rest = months % 12
  const parts: string[] = []

  if (years > 0) parts.push(`${years} ${plural(years, 'год', 'года', 'лет')}`)
  if (rest > 0) parts.push(`${rest} ${plural(rest, 'месяц', 'месяца', 'месяцев')}`)

  return parts.join(' ')
}
