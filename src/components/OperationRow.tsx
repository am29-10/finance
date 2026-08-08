import { CategoryIcon } from './CategoryIcon'
import type { Account, Category, Operation } from '../data/types'
import { BASE_CURRENCY } from '../lib/currency'
import { formatMoney } from '../lib/money'

interface OperationRowProps {
  operation: Operation
  category?: Category
  /** Счёт списания — нужен для валюты суммы и для подписи перевода. */
  account?: Account
  /** Счёт получателя; только у переводов. */
  toAccount?: Account
  /** Подпись под суммой — например дата, когда список не сгруппирован по дням. */
  meta?: string
  onClick?: () => void
}

export function OperationRow({
  operation,
  category,
  account,
  toAccount,
  meta,
  onClick,
}: OperationRowProps) {
  const isIncome = operation.type === 'income'
  const isTransfer = operation.type === 'transfer'
  const currency = account?.currency ?? BASE_CURRENCY

  // Комментарий выносим в заголовок: «Пятёрочка» полезнее, чем «Продукты».
  const title = operation.note?.trim() || (isTransfer ? 'Перевод' : category?.title) || 'Без категории'

  /**
   * У перевода вместо категории — маршрут денег. Он и отвечает на единственный
   * вопрос, который к переводу возникает: откуда и куда.
   */
  const subtitle = isTransfer
    ? `${account?.title ?? '—'} → ${toAccount?.title ?? '—'}`
    : category?.title

  const icon = isTransfer ? 'repeat' : (category?.icon ?? 'dots')
  const color = isTransfer ? 'var(--color-violet)' : (category?.color ?? '#94a3b8')

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-bg"
    >
      <CategoryIcon icon={icon} color={color} size={42} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-muted">{subtitle}</span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className="block text-[15px] font-semibold tabular-nums"
          style={{
            color: isIncome
              ? 'var(--color-income)'
              : isTransfer
                ? 'var(--color-muted)'
                : 'var(--color-ink)',
          }}
        >
          {/* Перевод показываем без знака: деньги не убыли и не прибыли, а переехали. */}
          {isTransfer
            ? formatMoney(operation.amount, { currency })
            : formatMoney(isIncome ? operation.amount : -operation.amount, {
                sign: isIncome,
                currency,
              })}
        </span>
        {meta && <span className="mt-0.5 block text-[13px] text-muted">{meta}</span>}
      </span>
    </button>
  )
}
