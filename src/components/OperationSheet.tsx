import { useState } from 'react'
import { Sheet } from './Sheet'
import { Field } from './Field'
import { CategoryIcon } from './CategoryIcon'
import { actions, categoriesOf, useFinance } from '../data/store'
import type { Operation, OperationType } from '../data/types'
import { formatAmountInput, formatMoney, parseAmount } from '../lib/money'
import { formatFullDate, todayKey } from '../lib/date'

interface OperationSheetProps {
  open: boolean
  /** Операция для правки; если не передана — создаём новую. */
  operation?: Operation
  onClose: () => void
}

export function OperationSheet({ open, operation, onClose }: OperationSheetProps) {
  const data = useFinance()
  const isEditing = Boolean(operation)

  const [type, setType] = useState<OperationType>(operation?.type ?? 'expense')
  const [amount, setAmount] = useState(
    operation ? formatAmountInput(String(operation.amount / 100).replace('.', ',')) : '',
  )
  const [categoryId, setCategoryId] = useState(operation?.categoryId ?? 'products')
  const [date, setDate] = useState(operation?.date ?? todayKey())
  const [note, setNote] = useState(operation?.note ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const categories = categoriesOf(data, type)
  const parsed = parseAmount(amount)
  const canSave = parsed !== null && categories.some((c) => c.id === categoryId)

  function changeType(next: OperationType) {
    setType(next)
    // Категории у доходов и расходов разные — переносим выбор на первую подходящую.
    const first = categoriesOf(data, next)[0]
    if (first) setCategoryId(first.id)
  }

  function handleSave() {
    if (parsed === null) return
    const payload = { type, amount: parsed, categoryId, date, note: note.trim() || undefined }

    if (operation) actions.updateOperation(operation.id, payload)
    else actions.addOperation(payload)

    onClose()
  }

  function handleDelete() {
    if (!operation) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    actions.deleteOperation(operation.id)
    onClose()
  }

  /**
   * Платежи по кредиту — производная от графика, а не самостоятельные записи:
   * правку тут же затрёт ближайшая сверка. Поэтому вместо формы объясняем,
   * где их менять по-настоящему.
   */
  if (operation?.loanId) {
    return (
      <Sheet open={open} onClose={onClose} title="Платёж по кредиту">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-surface px-4 py-4">
            <p className="text-[30px] font-semibold tabular-nums">{formatMoney(operation.amount)}</p>
            <p className="mt-1 text-[14px] text-muted">
              {operation.note} · {formatFullDate(operation.date)}
            </p>
          </div>

          <p className="px-1 text-[14px] leading-snug text-muted">
            Эта операция создана автоматически по графику кредита. Её сумма и дата пересчитываются
            вместе с графиком, поэтому вручную их не изменить. Чтобы что-то поправить, откройте
            кредит на главной: там можно изменить условия, внести досрочное погашение или выключить
            учёт платежей в расходах.
          </p>

          <button
            onClick={onClose}
            className="mt-1 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
          >
            Понятно
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title={isEditing ? 'Операция' : 'Новая операция'}>
      <div className="flex flex-col gap-5">
        <div className="flex gap-2 rounded-2xl bg-surface p-1.5">
          <TypeTab active={type === 'expense'} tone="expense" onClick={() => changeType('expense')}>
            Расход
          </TypeTab>
          <TypeTab active={type === 'income'} tone="income" onClick={() => changeType('income')}>
            Доход
          </TypeTab>
        </div>

        <Field label="Сумма">
          <div className="flex items-baseline gap-2 rounded-2xl bg-surface px-4 py-4">
            <input
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              // inputMode вызывает цифровую клавиатуру, не переключая раскладку.
              inputMode="decimal"
              placeholder="0"
              autoFocus={!isEditing}
              className="min-w-0 flex-1 bg-transparent text-[30px] font-semibold tabular-nums outline-none placeholder:text-muted"
            />
            <span className="text-[22px] font-medium text-muted">₽</span>
          </div>
        </Field>

        <Field label="Категория">
          <div className="grid grid-cols-4 gap-x-2 gap-y-4 rounded-2xl bg-surface px-3 py-4">
            {categories.map((category) => {
              const active = category.id === categoryId
              return (
                <button
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                  className="flex flex-col items-center gap-1.5 transition-transform duration-200 active:scale-90"
                >
                  <span
                    className="rounded-2xl transition-all duration-200"
                    style={{
                      boxShadow: active ? `0 0 0 2px white, 0 0 0 4px ${category.color}` : 'none',
                    }}
                  >
                    <CategoryIcon icon={category.icon} color={category.color} size={44} />
                  </span>
                  <span
                    className="line-clamp-2 text-center text-[11px] leading-tight"
                    style={{ color: active ? 'var(--color-ink)' : 'var(--color-muted)' }}
                  >
                    {category.title}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Дата">
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none"
            />
            {/* Поверх нативного поля показываем дату по-русски: браузер рисует ДД.ММ.ГГГГ. */}
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center bg-surface pr-3 text-[17px]">
              {formatFullDate(date)}
            </span>
          </div>
        </Field>

        <Field label="Комментарий" optional>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например, Пятёрочка"
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
        </Field>

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="mt-1 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-30"
        >
          {parsed === null ? 'Сохранить' : `Сохранить ${formatMoney(parsed)}`}
        </button>

        {isEditing && (
          <button
            onClick={handleDelete}
            className="w-full rounded-2xl py-3.5 text-[17px] font-medium transition-all duration-200 active:scale-[0.98]"
            style={{
              color: 'var(--color-danger)',
              backgroundColor: confirmingDelete ? '#f4433614' : 'transparent',
            }}
          >
            {confirmingDelete ? 'Точно удалить?' : 'Удалить операцию'}
          </button>
        )}
      </div>
    </Sheet>
  )
}

function TypeTab({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone: OperationType
  onClick: () => void
  children: React.ReactNode
}) {
  const color = tone === 'income' ? 'var(--color-brand)' : 'var(--color-danger)'

  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl py-2.5 text-[15px] font-semibold transition-all duration-200"
      style={{
        backgroundColor: active ? (tone === 'income' ? '#2e7d6b14' : '#f4433612') : 'transparent',
        color: active ? color : 'var(--color-muted)',
      }}
    >
      {children}
    </button>
  )
}

