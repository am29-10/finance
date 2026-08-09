import { useState } from 'react'
import { Sheet } from './Sheet'
import { Field, Segmented } from './Field'
import { actions, accountById, categoryById, useFinance } from '../data/store'
import type { Recurrence, RecurrencePeriod } from '../data/types'
import { formatAmountInput, formatMoney, parseAmount, toAmountInput } from '../lib/money'
import { formatFullDate } from '../lib/date'
import { currencySymbol, BASE_CURRENCY } from '../lib/currency'
import { nextOccurrence, PERIOD_SHORT, PERIOD_TITLES } from '../lib/recurrence'

interface RecurrenceSheetProps {
  open: boolean
  rule: Recurrence
  onClose: () => void
}

/**
 * Правка повтора.
 *
 * Меняется здесь только то, что меняется в жизни: сумма (аренда выросла),
 * периодичность и работает ли повтор вообще. Категорию и счёт не трогаем —
 * это уже другой платёж, и завести его отдельной операцией честнее, чем
 * превращать историю подписки в историю чего-то другого.
 */
export function RecurrenceSheet({ open, rule, onClose }: RecurrenceSheetProps) {
  const data = useFinance()

  const [amount, setAmount] = useState(() => toAmountInput(rule.amount))
  const [period, setPeriod] = useState<RecurrencePeriod>(rule.period)
  const [note, setNote] = useState(rule.note ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const account = accountById(data, rule.accountId)
  const category = categoryById(data, rule.categoryId)
  const currency = account?.currency ?? BASE_CURRENCY

  const parsed = parseAmount(amount)
  const next = nextOccurrence({ ...rule, period })
  const paused = Boolean(rule.pausedAt)

  function handleSave() {
    if (parsed === null) return

    actions.updateRecurrence(rule.id, {
      amount: parsed,
      period,
      note: note.trim() || undefined,
    })

    onClose()
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    actions.deleteRecurrence(rule.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Повтор">
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl bg-surface px-4 py-3.5">
          <p className="text-[15px] font-medium">
            {note.trim() || category?.title || 'Повторяющаяся операция'}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            {PERIOD_TITLES[period]} ·{' '}
            {rule.accountId ? (account?.title ?? 'счёт удалён') : 'без счёта'}
            {paused ? (
              <span style={{ color: 'var(--color-danger)' }}> · на паузе</span>
            ) : next ? (
              ` · дальше ${formatFullDate(next)}`
            ) : (
              ''
            )}
          </p>
        </div>

        <Field label="Сумма">
          <div className="flex items-baseline gap-2 rounded-2xl bg-surface px-4 py-4">
            <input
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              inputMode="decimal"
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent text-[30px] font-semibold tabular-nums outline-none placeholder:text-muted"
            />
            <span className="text-[22px] font-medium text-muted">{currencySymbol(currency)}</span>
          </div>
        </Field>

        <Field label="Как часто">
          <Segmented
            value={period}
            options={[
              { value: 'week' as const, label: PERIOD_SHORT.week },
              { value: 'month' as const, label: PERIOD_SHORT.month },
              { value: 'year' as const, label: PERIOD_SHORT.year },
            ]}
            onChange={setPeriod}
          />
        </Field>

        <Field label="Комментарий" optional>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например, Яндекс Плюс"
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
        </Field>

        <button
          onClick={handleSave}
          disabled={parsed === null}
          className="mt-1 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-30"
        >
          {parsed === null ? 'Сохранить' : `Сохранить ${formatMoney(parsed, { currency })}`}
        </button>

        <button
          onClick={() => (paused ? actions.resumeRecurrence(rule.id) : actions.pauseRecurrence(rule.id))}
          className="-mt-2 w-full rounded-2xl bg-surface py-3.5 text-[17px] font-medium transition-all duration-200 active:scale-[0.98]"
        >
          {paused ? 'Возобновить' : 'Приостановить'}
        </button>

        <p className="-mt-3 px-1 text-[13px] leading-relaxed text-muted">
          {paused
            ? 'Пропущенное за время паузы задним числом не создаётся — повтор продолжится со следующего срока.'
            : 'Пауза останавливает только будущие операции. Всё, что уже заведено, останется в истории.'}
        </p>

        <button
          onClick={handleDelete}
          className="-mt-2 w-full rounded-2xl py-3.5 text-[17px] font-medium transition-all duration-200 active:scale-[0.98]"
          style={{
            color: 'var(--color-danger)',
            backgroundColor: confirmingDelete ? '#f4433614' : 'transparent',
          }}
        >
          {confirmingDelete ? 'Точно удалить повтор?' : 'Удалить повтор'}
        </button>
      </div>
    </Sheet>
  )
}
