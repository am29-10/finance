import { useState } from 'react'
import { Sheet } from './Sheet'
import { actions, useFinance } from '../data/store'
import { formatAmountInput, parseAmount } from '../lib/money'

interface BudgetSheetProps {
  open: boolean
  onClose: () => void
}

export function BudgetSheet({ open, onClose }: BudgetSheetProps) {
  const data = useFinance()
  const current = data.settings.monthlyBudget

  const [amount, setAmount] = useState(
    current > 0 ? formatAmountInput(String(current / 100).replace('.', ',')) : '',
  )

  const parsed = parseAmount(amount)

  function handleSave() {
    if (parsed === null) return
    actions.updateSettings({ monthlyBudget: parsed })
    onClose()
  }

  function handleRemove() {
    actions.updateSettings({ monthlyBudget: 0 })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Месячный бюджет">
      <div className="flex flex-col gap-5">
        <p className="px-1 text-[14px] leading-snug text-muted">
          Сколько вы готовы тратить в месяц. Лимит один на все категории и повторяется
          каждый месяц.
        </p>

        <div className="flex items-baseline gap-2 rounded-2xl bg-surface px-4 py-4">
          <input
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
            inputMode="decimal"
            placeholder="0"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[30px] font-semibold tabular-nums outline-none placeholder:text-muted"
          />
          <span className="text-[22px] font-medium text-muted">₽</span>
        </div>

        <button
          onClick={handleSave}
          disabled={parsed === null}
          className="w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-30"
        >
          Сохранить
        </button>

        {current > 0 && (
          <button
            onClick={handleRemove}
            className="w-full rounded-2xl py-3.5 text-[17px] font-medium text-muted transition-all duration-200 active:scale-[0.98]"
          >
            Убрать бюджет
          </button>
        )}
      </div>
    </Sheet>
  )
}
