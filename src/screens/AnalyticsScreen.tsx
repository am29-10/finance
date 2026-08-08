import { useState } from 'react'
import { BarChart } from '../components/BarChart'
import { totalsByCategory, totalsOf, useFinance } from '../data/store'
import type { FlowType } from '../data/types'
import {
  averagePerDay,
  changeVsPrevious,
  forecast,
  operationsIn,
  rangeOf,
  series,
  shift,
  type Period,
} from '../lib/analytics'
import { formatMonth } from '../lib/date'
import { formatMoney } from '../lib/money'

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
]

export function AnalyticsScreen() {
  const data = useFinance()
  const [period, setPeriod] = useState<Period>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [type, setType] = useState<FlowType>('expense')

  const range = rangeOf(period, anchor)
  const operations = operationsIn(data, range)
  const totals = totalsOf(operations)
  const total = type === 'income' ? totals.income : totals.expense

  const points = series(period, range, operations, type)
  const change = changeVsPrevious(data, period, anchor, type)
  const rows = totalsByCategory(data, operations, type)
  const average = averagePerDay(total, range)
  const projected = period === 'month' ? forecast(total, range) : null

  const color = type === 'income' ? 'var(--color-income)' : 'var(--color-violet)'
  const canGoForward = range.to < new Date()

  function changePeriod(next: Period) {
    setPeriod(next)
    // Возвращаемся к сегодняшнему дню: старый якорь в другом масштабе уводит непонятно куда.
    setAnchor(new Date())
  }

  return (
    <div className="px-4 pb-8">
      <header className="pt-4 pb-4">
        <h1 className="px-1 text-[28px] font-bold tracking-tight">Аналитика</h1>
      </header>

      <div className="flex gap-2 rounded-2xl bg-surface p-1.5">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            onClick={() => changePeriod(item.id)}
            className="flex-1 rounded-xl py-2 text-[14px] font-semibold transition-all duration-200"
            style={{
              backgroundColor: period === item.id ? 'var(--color-brand)' : 'transparent',
              color: period === item.id ? 'white' : 'var(--color-muted)',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Arrow label="Назад" onClick={() => setAnchor(shift(period, anchor, -1))}>
          <path d="M15 5l-7 7 7 7" />
        </Arrow>
        <span className="text-[15px] font-semibold">{rangeTitle(period, range)}</span>
        <Arrow
          label="Вперёд"
          disabled={!canGoForward}
          onClick={() => setAnchor(shift(period, anchor, 1))}
        >
          <path d="M9 5l7 7-7 7" />
        </Arrow>
      </div>

      <div className="mt-3 flex gap-2 rounded-2xl bg-surface p-1.5">
        <TypeTab active={type === 'expense'} onClick={() => setType('expense')}>
          Расходы
        </TypeTab>
        <TypeTab active={type === 'income'} onClick={() => setType('income')}>
          Доходы
        </TypeTab>
      </div>

      <section className="mt-3 rounded-2xl bg-surface px-4 py-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-muted">{type === 'income' ? 'Доходы' : 'Расходы'}</p>
            <p className="mt-0.5 text-[26px] font-bold tabular-nums">{formatMoney(total)}</p>
          </div>

          {change && (
            <span
              className="rounded-full px-2.5 py-1 text-[13px] font-semibold"
              style={{
                backgroundColor: isGood(change.down, type) ? '#2e7d6b14' : '#f4433612',
                color: isGood(change.down, type) ? 'var(--color-brand)' : 'var(--color-danger)',
              }}
            >
              {change.down ? '−' : '+'}
              {change.percent}%
            </span>
          )}
        </div>

        <BarChart points={points} color={color} />
      </section>

      {total > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Tile label="В среднем в день" value={formatMoney(average)} />
          {projected !== null ? (
            <Tile label="Прогноз до конца месяца" value={formatMoney(projected)} />
          ) : (
            <Tile label="Операций за период" value={String(operations.length)} />
          )}
        </div>
      )}

      <h2 className="mt-6 mb-2 px-1 text-[17px] font-semibold">
        {type === 'income' ? 'Структура доходов' : 'Структура расходов'}
      </h2>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-surface px-5 py-8 text-center text-[14px] text-muted">
          За этот период данных нет
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl bg-surface px-4 py-4">
          {rows.map((row) => (
            <div key={row.category.id}>
              <div className="mb-1.5 flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                  {row.category.title}
                </span>
                <span className="shrink-0 text-[15px] tabular-nums">
                  {formatMoney(row.amount)}
                </span>
                <span className="w-9 shrink-0 text-right text-[13px] tabular-nums text-muted">
                  {Math.round(row.share * 100)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-[var(--ease-ios)]"
                  style={{
                    width: `${Math.max(row.share * 100, 2)}%`,
                    backgroundColor: row.category.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Рост расходов — плохо, рост доходов — хорошо. */
function isGood(down: boolean, type: FlowType): boolean {
  return type === 'income' ? !down : down
}

function rangeTitle(period: Period, range: { from: Date; to: Date }): string {
  if (period === 'year') return String(range.from.getFullYear())
  if (period === 'month') return formatMonth(range.from)

  const sameMonth = range.from.getMonth() === range.to.getMonth()
  const day = new Intl.DateTimeFormat('ru-RU', { day: 'numeric' })
  const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })

  return sameMonth
    ? `${day.format(range.from)} — ${dayMonth.format(range.to)}`
    : `${dayMonth.format(range.from)} — ${dayMonth.format(range.to)}`
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3.5">
      <p className="text-[12px] leading-tight text-muted">{label}</p>
      <p className="mt-1 text-[19px] font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function TypeTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl py-2 text-[14px] font-semibold transition-all duration-200"
      style={{
        backgroundColor: active ? 'var(--color-bg)' : 'transparent',
        color: active ? 'var(--color-ink)' : 'var(--color-muted)',
      }}
    >
      {children}
    </button>
  )
}

function Arrow({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full bg-surface text-muted transition-transform active:scale-90 disabled:opacity-30"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  )
}
