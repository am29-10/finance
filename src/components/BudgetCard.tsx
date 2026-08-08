import { formatMoney } from '../lib/money'
import { endOfMonth, isSameMonth } from '../lib/date'

interface BudgetCardProps {
  /** Лимит в копейках; 0 — не задан. */
  budget: number
  spent: number
  /** Месяц, за который показаны траты. */
  month: Date
  onEdit: () => void
}

export function BudgetCard({ budget, spent, month, onEdit }: BudgetCardProps) {
  if (budget === 0) {
    return (
      <button
        onClick={onEdit}
        className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-left transition-transform active:scale-[0.99]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="var(--color-brand)" strokeWidth={1.9} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-medium">Установить бюджет на месяц</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            Чтобы видеть, сколько осталось
          </span>
        </span>
      </button>
    )
  }

  const left = budget - spent
  const ratio = spent / budget
  const over = left < 0

  // Оранжевый начинается с 80% — предупреждение должно приходить до того, как деньги кончились.
  const color = over
    ? 'var(--color-danger)'
    : ratio >= 0.8
      ? 'var(--color-orange)'
      : 'var(--color-brand)'

  const perDay = dailyAllowance(left, month)

  return (
    <button
      onClick={onEdit}
      className="w-full rounded-2xl bg-surface px-4 py-4 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold">Бюджет на месяц</span>
        <span className="text-[13px] tabular-nums text-muted">{formatMoney(budget)}</span>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full transition-all duration-500 ease-[var(--ease-ios)]"
          style={{ width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: color }}
        />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-muted">Потрачено</p>
          <p className="mt-0.5 text-[17px] font-semibold tabular-nums">{formatMoney(spent)}</p>
        </div>

        <div className="text-right">
          <p className="text-[12px] text-muted">{over ? 'Превышение' : 'Осталось'}</p>
          <p className="mt-0.5 text-[17px] font-semibold tabular-nums" style={{ color }}>
            {formatMoney(Math.abs(left))}
          </p>
        </div>
      </div>

      {over ? (
        <p className="mt-3 rounded-xl bg-danger/8 px-3 py-2 text-[13px] leading-snug" style={{ color: 'var(--color-danger)' }}>
          Бюджет превышен на {Math.round((Math.abs(left) / budget) * 100)}%.
        </p>
      ) : (
        perDay !== null && (
          <p className="mt-3 text-[13px] text-muted">
            Можно тратить {formatMoney(perDay)} в день до конца месяца.
          </p>
        )
      )}
    </button>
  )
}

/** Остаток, поделённый на оставшиеся дни. Только для текущего месяца — в прошедших смысла нет. */
function dailyAllowance(left: number, month: Date): number | null {
  const today = new Date()
  if (!isSameMonth(month, today) || left <= 0) return null

  const daysLeft = endOfMonth(today).getDate() - today.getDate() + 1
  return Math.round(left / Math.max(daysLeft, 1))
}
