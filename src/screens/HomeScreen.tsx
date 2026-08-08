import { useState } from 'react'
import { BudgetCard } from '../components/BudgetCard'
import { BudgetSheet } from '../components/BudgetSheet'
import { LoansCard } from '../components/LoansCard'
import { AccountsStrip } from '../components/AccountsStrip'
import { DonutChart } from '../components/DonutChart'
import { OperationRow } from '../components/OperationRow'
import {
  accountBalances,
  accountById,
  categoryById,
  collapseToTop,
  operationsBetween,
  sortedOperations,
  totalBalance,
  totalsByCategory,
  totalsOf,
  useFinance,
  type CategoryTotal,
} from '../data/store'
import type { Operation } from '../data/types'
import {
  addMonths,
  endOfMonth,
  formatDayHeading,
  formatMonth,
  formatMonthInline,
  isSameMonth,
  startOfMonth,
  toDateKey,
} from '../lib/date'
import { formatMoney } from '../lib/money'

const RECENT_LIMIT = 5
const HIDDEN_KEY = 'finance:hide-balance'

interface HomeScreenProps {
  onEdit: (operation: Operation) => void
  onShowAll: () => void
  onOpenLoans: () => void
  onOpenAccounts: () => void
}

export function HomeScreen({ onEdit, onShowAll, onOpenLoans, onOpenAccounts }: HomeScreenProps) {
  const data = useFinance()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDDEN_KEY) === '1')
  const [budgetOpen, setBudgetOpen] = useState(false)

  const monthOperations = operationsBetween(
    data,
    toDateKey(startOfMonth(month)),
    toDateKey(endOfMonth(month)),
  )
  const monthTotals = totalsOf(monthOperations)
  const balance = totalBalance(data)
  const balances = accountBalances(data)

  const incomeRows = collapseToTop(totalsByCategory(data, monthOperations, 'income'))
  const expenseRows = collapseToTop(totalsByCategory(data, monthOperations, 'expense'))
  const recent = sortedOperations(data).slice(0, RECENT_LIMIT)
  const change = expenseChange(data, month)
  const monthLabel = formatMonthInline(month)

  function toggleHidden() {
    setHidden((current) => {
      localStorage.setItem(HIDDEN_KEY, current ? '0' : '1')
      return !current
    })
  }

  const money = (cents: number) => (hidden ? '••• ₽' : formatMoney(cents))

  return (
    <div className="px-4 pb-8">
      <section className="mt-5 rounded-3xl bg-brand px-5 py-5 text-white">
        <div className="flex items-start justify-between">
          <span className="text-[13px] opacity-80">Баланс</span>
          <button
            onClick={toggleHidden}
            aria-label={hidden ? 'Показать суммы' : 'Скрыть суммы'}
            className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
              <circle cx="12" cy="12" r="2.6" />
              {hidden && <path d="M4 20 20 4" />}
            </svg>
          </button>
        </div>

        <p className="mt-1 text-[34px] font-bold tabular-nums">{money(balance.amount)}</p>

        {/* Итоги месяца, а не всего времени, — поэтому месяц назван прямо в подписи. */}
        <div className="mt-5 flex gap-4">
          <div className="flex-1 rounded-2xl bg-white/10 px-3.5 py-3">
            <span className="text-[12px] leading-tight opacity-80">Доходы за {monthLabel}</span>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums">
              {money(monthTotals.income)}
            </p>
          </div>
          <div className="flex-1 rounded-2xl bg-white/10 px-3.5 py-3">
            <span className="text-[12px] leading-tight opacity-80">Расходы за {monthLabel}</span>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums">
              {money(monthTotals.expense)}
            </p>
          </div>
        </div>
      </section>

      <AccountsStrip
        balances={balances}
        missingRates={balance.missingRates}
        hidden={hidden}
        onOpen={onOpenAccounts}
      />

      <div className="mt-3">
        <BudgetCard
          budget={data.settings.monthlyBudget}
          spent={monthTotals.expense}
          month={month}
          onEdit={() => setBudgetOpen(true)}
        />
      </div>

      <div className="mt-2.5">
        <LoansCard loans={data.loans} hidden={hidden} onOpen={onOpenLoans} />
      </div>

      <div className="mt-6 mb-3 flex items-center justify-between px-1">
        <h2 className="text-[17px] font-semibold">Обзор</h2>
        <MonthSwitch month={month} onChange={setMonth} />
      </div>

      {/* Сначала откуда деньги пришли, потом куда ушли — в том порядке, в котором они движутся. */}
      <FlowSection title="Доходы" rows={incomeRows} empty="В этом месяце доходов пока нет" />
      <div className="mt-4">
        <FlowSection title="Расходы" rows={expenseRows} empty="В этом месяце расходов пока нет" />
      </div>

      {change && (
        <section
          className="mt-3 flex items-start gap-3 rounded-2xl px-4 py-4"
          style={{ backgroundColor: change.better ? '#2e7d6b12' : '#f443360f' }}
        >
          <span
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: change.better ? '#2e7d6b1f' : '#f4433618' }}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke={change.better ? 'var(--color-brand)' : 'var(--color-danger)'}
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M6 19v-6M12 19V9M18 19v-9" />
            </svg>
          </span>
          <p className="text-[14px] leading-snug">
            <span className="font-medium">
              {change.better ? 'Вы потратили на' : 'Расходы выросли на'} {change.percent}%{' '}
              {change.better ? 'меньше' : 'больше'}, чем в прошлом месяце.
            </span>
            <span className="mt-0.5 block text-[13px] text-muted">
              {change.better ? 'Отличная работа! Так держать.' : 'Стоит присмотреться к тратам.'}
            </span>
          </p>
        </section>
      )}

      <div className="mt-6 mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[17px] font-semibold">Последние операции</h2>
        {recent.length > 0 && (
          <button onClick={onShowAll} className="text-[14px] font-medium text-brand">
            Все
          </button>
        )}
      </div>

      {recent.length === 0 ? (
        <p className="rounded-2xl bg-surface px-5 py-8 text-center text-[14px] text-muted">
          Добавь первую операцию кнопкой «+»
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
          {recent.map((operation) => (
            <OperationRow
              key={operation.id}
              operation={operation}
              category={categoryById(data, operation.categoryId)}
              account={accountById(data, operation.accountId)}
              toAccount={operation.toAccountId ? accountById(data, operation.toAccountId) : undefined}
              meta={formatDayHeading(operation.date)}
              onClick={() => onEdit(operation)}
            />
          ))}
        </div>
      )}

      <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} />
    </div>
  )
}

/** Доходы или расходы месяца одним блоком: заголовок, кольцо и легенда. */
function FlowSection({
  title,
  rows,
  empty,
}: {
  title: string
  rows: CategoryTotal[]
  empty: string
}) {
  return (
    <>
      <h3 className="mb-2 px-1 text-[15px] font-semibold">{title}</h3>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-surface px-5 py-6 text-center text-[14px] text-muted">
          {empty}
        </p>
      ) : (
        <section className="rounded-2xl bg-surface px-4 py-5">
          <DonutChart rows={rows} label={title} />
        </section>
      )}
    </>
  )
}

/** Насколько расходы месяца отличаются от предыдущего. null, если сравнивать не с чем. */
function expenseChange(
  data: ReturnType<typeof useFinance>,
  month: Date,
): { percent: number; better: boolean } | null {
  const previous = addMonths(month, -1)

  const current = totalsOf(
    operationsBetween(data, toDateKey(startOfMonth(month)), toDateKey(endOfMonth(month))),
  ).expense

  const before = totalsOf(
    operationsBetween(data, toDateKey(startOfMonth(previous)), toDateKey(endOfMonth(previous))),
  ).expense

  if (before === 0 || current === 0) return null

  const percent = Math.round(Math.abs((current - before) / before) * 100)
  if (percent === 0) return null

  return { percent, better: current < before }
}

function MonthSwitch({ month, onChange }: { month: Date; onChange: (date: Date) => void }) {
  const isCurrent = isSameMonth(month, new Date())

  return (
    <div className="flex items-center gap-1">
      <ArrowButton label="Предыдущий месяц" onClick={() => onChange(addMonths(month, -1))}>
        <path d="M15 5l-7 7 7 7" />
      </ArrowButton>

      <span className="min-w-[104px] text-center text-[14px] font-medium">
        {formatMonth(month)}
      </span>

      {/* Вперёд дальше текущего месяца ходить некуда — данных там быть не может. */}
      <ArrowButton
        label="Следующий месяц"
        disabled={isCurrent}
        onClick={() => onChange(addMonths(month, 1))}
      >
        <path d="M9 5l7 7-7 7" />
      </ArrowButton>
    </div>
  )
}

function ArrowButton({
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
      className="flex size-8 items-center justify-center rounded-full bg-surface text-muted transition-transform active:scale-90 disabled:opacity-30"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}
