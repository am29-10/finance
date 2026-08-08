import { useMemo, useState } from 'react'
import { OperationRow } from '../components/OperationRow'
import { categoryById, sortedOperations, useFinance } from '../data/store'
import type { Operation, OperationType } from '../data/types'
import { formatDayHeading } from '../lib/date'
import { formatMoney } from '../lib/money'

type Filter = 'all' | OperationType

interface OperationsScreenProps {
  onEdit: (operation: Operation) => void
}

export function OperationsScreen({ onEdit }: OperationsScreenProps) {
  const data = useFinance()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const filtered = sortedOperations(data).filter((operation) => {
      if (filter !== 'all' && operation.type !== filter) return false
      if (!needle) return true

      const category = categoryById(data, operation.categoryId)
      return (
        operation.note?.toLowerCase().includes(needle) ||
        category?.title.toLowerCase().includes(needle)
      )
    })

    // Группируем по дате: список идёт от свежих к старым, порядок дней сохраняется.
    const byDay = new Map<string, Operation[]>()
    for (const operation of filtered) {
      const bucket = byDay.get(operation.date)
      if (bucket) bucket.push(operation)
      else byDay.set(operation.date, [operation])
    }

    return [...byDay.entries()]
  }, [data, filter, query])

  return (
    <div className="px-4 pb-8">
      <header className="pt-4 pb-4">
        <h1 className="px-1 text-[28px] font-bold tracking-tight">Операции</h1>
      </header>

      <SearchField value={query} onChange={setQuery} />

      <div className="mt-3 flex gap-2 rounded-2xl bg-surface p-1.5">
        <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
          Все
        </FilterTab>
        <FilterTab active={filter === 'income'} tone="income" onClick={() => setFilter('income')}>
          Доходы
        </FilterTab>
        <FilterTab active={filter === 'expense'} tone="expense" onClick={() => setFilter('expense')}>
          Расходы
        </FilterTab>
      </div>

      {groups.length === 0 ? (
        <p className="py-20 text-center text-muted">
          {query.trim() ? 'Ничего не найдено' : 'Операций пока нет'}
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {groups.map(([date, operations]) => (
            <section key={date}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-[13px] font-semibold text-muted">{formatDayHeading(date)}</h2>
                <span className="text-[13px] tabular-nums text-muted">{dayTotal(operations)}</span>
              </div>

              <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
                {operations.map((operation) => (
                  <OperationRow
                    key={operation.id}
                    operation={operation}
                    category={categoryById(data, operation.categoryId)}
                    onClick={() => onEdit(operation)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/** Итог дня со знаком: сколько в сумме прибавилось или убыло. */
function dayTotal(operations: Operation[]): string {
  const total = operations.reduce(
    (acc, operation) => acc + (operation.type === 'income' ? operation.amount : -operation.amount),
    0,
  )
  return formatMoney(total, { sign: total > 0 })
}

function FilterTab({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone?: OperationType
  onClick: () => void
  children: React.ReactNode
}) {
  const color =
    tone === 'income'
      ? 'var(--color-brand)'
      : tone === 'expense'
        ? 'var(--color-danger)'
        : 'var(--color-ink)'

  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl py-2 text-[14px] font-semibold transition-all duration-200"
      style={{
        backgroundColor: active ? 'var(--color-bg)' : 'transparent',
        color: active ? color : 'var(--color-muted)',
      }}
    >
      {children}
    </button>
  )
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <svg
        viewBox="0 0 24 24"
        className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
        fill="none"
      >
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
        <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Поиск по операциям"
        className="w-full rounded-2xl bg-surface py-3 pl-10 pr-10 text-[16px] outline-none placeholder:text-muted"
      />

      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Очистить"
          className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center text-muted"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
