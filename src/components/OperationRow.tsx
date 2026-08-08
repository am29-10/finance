import { CategoryIcon } from './CategoryIcon'
import type { Category, Operation } from '../data/types'
import { formatMoney } from '../lib/money'

interface OperationRowProps {
  operation: Operation
  category?: Category
  /** Подпись под суммой — например дата, когда список не сгруппирован по дням. */
  meta?: string
  onClick?: () => void
}

export function OperationRow({ operation, category, meta, onClick }: OperationRowProps) {
  const isIncome = operation.type === 'income'
  // Комментарий выносим в заголовок: «Пятёрочка» полезнее, чем «Продукты».
  const title = operation.note?.trim() || category?.title || 'Без категории'

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-bg"
    >
      <CategoryIcon icon={category?.icon ?? 'dots'} color={category?.color ?? '#94a3b8'} size={42} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-muted">{category?.title}</span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className="block text-[15px] font-semibold tabular-nums"
          style={{ color: isIncome ? 'var(--color-income)' : 'var(--color-ink)' }}
        >
          {formatMoney(isIncome ? operation.amount : -operation.amount, { sign: isIncome })}
        </span>
        {meta && <span className="mt-0.5 block text-[13px] text-muted">{meta}</span>}
      </span>
    </button>
  )
}
