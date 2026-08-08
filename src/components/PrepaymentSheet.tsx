import { useState } from 'react'
import { Sheet } from './Sheet'
import { Field } from './Field'
import { actions } from '../data/store'
import type { EarlyMode, Loan } from '../data/types'
import { formatFullDate, todayKey } from '../lib/date'
import { forecastPrepayment, formatTerm, loanStats, type Forecast } from '../lib/loan'
import { plural } from '../lib/text'
import { formatAmountInput, formatMoney, parseAmount } from '../lib/money'

interface PrepaymentSheetProps {
  open: boolean
  loan: Loan
  onClose: () => void
}

/**
 * Досрочное погашение с расчётом до того, как деньги внесены.
 *
 * Смысл экрана — показать развилку: одна и та же сумма либо приближает
 * закрытие кредита, либо снижает ежемесячный платёж, и разница в экономии
 * между этими вариантами обычно в разы. Поэтому оба варианта считаются сразу
 * и показываются рядом, а не прячутся за переключателем.
 */
export function PrepaymentSheet({ open, loan, onClose }: PrepaymentSheetProps) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayKey())
  const [mode, setMode] = useState<EarlyMode>(loan.earlyMode)

  const parsed = parseAmount(amount)
  const stats = loanStats(loan)

  // Вносить больше остатка бессмысленно: лишнее банк вернёт, а график сломается.
  const capped = parsed !== null ? Math.min(parsed, stats.balance) : null
  const forecast = capped !== null ? forecastPrepayment(loan, capped, date) : null

  function handleSave() {
    if (capped === null) return

    actions.addPrepayment(loan.id, { date, amount: capped, mode })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Досрочное погашение">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3.5">
          <span className="text-[14px] text-muted">Остаток долга</span>
          <span className="text-[17px] font-semibold tabular-nums">{formatMoney(stats.balance)}</span>
        </div>

        <Field
          label="Сумма"
          hint={
            parsed !== null && parsed > stats.balance
              ? `Это больше остатка. Учтём ${formatMoney(stats.balance)} — кредит закроется полностью.`
              : undefined
          }
        >
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
        </Field>

        <Field label="Дата">
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none"
            />
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center bg-surface pr-3 text-[17px]">
              {formatFullDate(date)}
            </span>
          </div>
        </Field>

        {forecast ? (
          <Field label="Что это даст">
            <div className="flex flex-col gap-2.5">
              <ForecastOption
                active={mode === 'term'}
                onClick={() => setMode('term')}
                title="Сократить срок"
                forecast={forecast.term}
                current={stats.closingDate}
              />
              <ForecastOption
                active={mode === 'payment'}
                onClick={() => setMode('payment')}
                title="Снизить платёж"
                forecast={forecast.payment}
                current={stats.closingDate}
              />
            </div>

            {forecast.term.savedInterest > forecast.payment.savedInterest && (
              <p className="mt-2.5 px-1 text-[12px] leading-snug text-muted">
                Сокращение срока выгоднее на{' '}
                {formatMoney(forecast.term.savedInterest - forecast.payment.savedInterest)} — вы
                перестаёте платить проценты раньше. Снижение платежа стоит выбирать, только если
                нужно разгрузить бюджет прямо сейчас.
              </p>
            )}
          </Field>
        ) : (
          <p className="rounded-2xl bg-surface px-5 py-8 text-center text-[14px] leading-snug text-muted">
            Введите сумму — покажу, на сколько сократится кредит
            <br />и сколько вы сэкономите на процентах.
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={capped === null}
          className="mt-1 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-30"
        >
          {capped === null ? 'Внести' : `Внести ${formatMoney(capped)}`}
        </button>

        {loan.autoExpense && (
          <p className="-mt-2 px-1 text-center text-[12px] text-muted">
            Сумма попадёт в расходы за {formatFullDate(date)}.
          </p>
        )}
      </div>
    </Sheet>
  )
}

function ForecastOption({
  active,
  title,
  forecast,
  current,
  onClick,
}: {
  active: boolean
  title: string
  forecast: Forecast
  /** Дата закрытия без этого платежа — чтобы показать «вместо». */
  current: string
  onClick: () => void
}) {
  const isTerm = forecast.mode === 'term'

  return (
    <button
      onClick={onClick}
      className="rounded-2xl px-4 py-3.5 text-left transition-all duration-200"
      style={{
        backgroundColor: active ? '#2e7d6b0f' : 'var(--color-surface)',
        boxShadow: active ? '0 0 0 2px var(--color-brand)' : 'none',
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--color-brand)' }}>
          −{formatMoney(forecast.savedInterest)}
        </span>
      </div>

      <p className="mt-1.5 text-[13px] leading-snug text-muted">
        {isTerm ? (
          forecast.savedMonths > 0 ? (
            <>
              Закроется {formatFullDate(forecast.closingDate)} вместо {formatFullDate(current)} — на{' '}
              {formatTerm(forecast.savedMonths)} раньше.
            </>
          ) : (
            <>Суммы не хватает, чтобы убрать хотя бы один платёж.</>
          )
        ) : forecast.savedMonthly > 0 ? (
          <>
            Платёж станет {formatMoney(forecast.monthlyPayment)} — на{' '}
            {formatMoney(forecast.savedMonthly)} меньше. Срок прежний,{' '}
            {forecast.monthsLeft} {plural(forecast.monthsLeft, 'платёж', 'платежа', 'платежей')}.
          </>
        ) : (
          <>Платёж почти не изменится.</>
        )}
      </p>

      <p className="mt-1 text-[12px] text-muted">
        Остаток долга — {formatMoney(forecast.balance)}.
      </p>
    </button>
  )
}
