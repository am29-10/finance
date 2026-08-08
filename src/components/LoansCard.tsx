import type { Loan } from '../data/types'
import { formatDayHeading } from '../lib/date'
import { loansSummary } from '../lib/loan'
import { plural } from '../lib/text'
import { formatMoney } from '../lib/money'

interface LoansCardProps {
  loans: Loan[]
  /** Скрывать суммы, когда на главной включён режим «глаз». */
  hidden?: boolean
  onOpen: () => void
}

/**
 * Сводка по всем кредитам на главной: сколько всего должен и когда следующий платёж.
 * Подробности — на отдельном экране, здесь только то, что нужно знать каждый день.
 */
export function LoansCard({ loans, hidden, onOpen }: LoansCardProps) {
  const summary = loansSummary(loans)
  const money = (cents: number) => (hidden ? '••• ₽' : formatMoney(cents))

  if (summary.count === 0) {
    return (
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-left transition-transform active:scale-[0.99]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet/10">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="var(--color-violet)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5 12 4l9 5.5M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18" />
          </svg>
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-medium">Добавить кредит или ипотеку</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            Остаток долга, график и досрочные погашения
          </span>
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onOpen}
      className="w-full rounded-2xl bg-surface px-4 py-4 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold">Кредиты</span>
        <span className="text-[13px] text-muted">
          {summary.count} {plural(summary.count, 'кредит', 'кредита', 'кредитов')}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-muted">Остаток долга</p>
          <p className="mt-0.5 text-[22px] font-bold tabular-nums" style={{ color: 'var(--color-violet)' }}>
            {money(summary.debt)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[12px] text-muted">В месяц</p>
          <p className="mt-0.5 text-[17px] font-semibold tabular-nums">{money(summary.monthly)}</p>
        </div>
      </div>

      {summary.nextDate && (
        <p className="mt-3 text-[13px] text-muted">
          Ближайший платёж — {formatDayHeading(summary.nextDate).toLowerCase()},{' '}
          {money(summary.nextAmount)}.
        </p>
      )}
    </button>
  )
}
