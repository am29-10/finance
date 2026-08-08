import { useState } from 'react'
import { CategoryIcon } from './CategoryIcon'
import type { Account, Category, Operation } from '../data/types'
import { BASE_CURRENCY } from '../lib/currency'
import { formatMoney } from '../lib/money'
import { plural } from '../lib/text'

interface OperationGroupRowProps {
  /** Однотипные операции одного дня; их всегда больше одной. */
  operations: Operation[]
  category?: Category
  account?: Account
  toAccount?: Account
  onSelect: (operation: Operation) => void
}

/**
 * Несколько однотипных операций за день одной строкой.
 *
 * Список, в котором пять раз подряд написано «Продукты», отвечает на вопрос
 * «что я покупал» и не отвечает на вопрос «сколько ушло на продукты». Группа
 * показывает сумму сразу, а сами операции остаются на месте — они разворачиваются
 * нажатием, и любую по-прежнему можно открыть и поправить.
 */
export function OperationGroupRow({
  operations,
  category,
  account,
  toAccount,
  onSelect,
}: OperationGroupRowProps) {
  const [open, setOpen] = useState(false)

  const first = operations[0]
  const isIncome = first.type === 'income'
  const isTransfer = first.type === 'transfer'
  const currency = account?.currency ?? BASE_CURRENCY

  const total = operations.reduce((sum, operation) => sum + operation.amount, 0)
  const notes = [...new Set(operations.map((o) => o.note?.trim()).filter(Boolean))] as string[]

  // Если комментарий у всех один — он и есть название группы: «Пятёрочка» вместо «Продукты».
  const sameNote = notes.length === 1 && notes.length === operations.length ? notes[0] : undefined

  const title =
    sameNote ?? (isTransfer ? 'Перевод' : category?.title) ?? 'Без категории'

  const count = `${operations.length} ${plural(operations.length, 'операция', 'операции', 'операций')}`

  const subtitle = isTransfer
    ? `${account?.title ?? '—'} → ${toAccount?.title ?? '—'} · ${count}`
    : sameNote
      ? `${category?.title ?? 'Без категории'} · ${count}`
      : notes.length > 0
        ? `${count} · ${notes.slice(0, 3).join(', ')}`
        : count

  const icon = isTransfer ? 'repeat' : (category?.icon ?? 'dots')
  const color = isTransfer ? 'var(--color-violet)' : (category?.color ?? '#94a3b8')

  const amountColor = isIncome
    ? 'var(--color-income)'
    : isTransfer
      ? 'var(--color-muted)'
      : 'var(--color-ink)'

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-bg"
      >
        <CategoryIcon icon={icon} color={color} size={42} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{title}</span>
          <span className="mt-0.5 block truncate text-[13px] text-muted">{subtitle}</span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-[15px] font-semibold tabular-nums" style={{ color: amountColor }}>
            {isTransfer
              ? formatMoney(total, { currency })
              : formatMoney(isIncome ? total : -total, { sign: isIncome, currency })}
          </span>
        </span>

        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0 text-muted transition-transform duration-200"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {open && (
        <div className="bg-bg/60 pb-1">
          {operations.map((operation) => (
            <button
              key={operation.id}
              onClick={() => onSelect(operation)}
              className="flex w-full items-center gap-3 py-2.5 pl-[69px] pr-11 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-[14px]">
                {operation.note?.trim() || category?.title || 'Без комментария'}
              </span>
              <span className="shrink-0 text-[14px] tabular-nums" style={{ color: amountColor }}>
                {isTransfer
                  ? formatMoney(operation.amount, { currency })
                  : formatMoney(isIncome ? operation.amount : -operation.amount, {
                      sign: isIncome,
                      currency,
                    })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
