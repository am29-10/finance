import { useState } from 'react'
import { Sheet } from './Sheet'
import { Field, Segmented, ToggleRow } from './Field'
import { accountBalance, actions, activeAccounts, useFinance } from '../data/store'
import type { EarlyMode, Loan, LoanKind, LoanScheme } from '../data/types'
import { formatFullDate, fromDateKey, todayKey } from '../lib/date'
import { annuityPayment, formatRate, formatTerm, loanStats, parseRate } from '../lib/loan'
import { formatAmountInput, formatMoney, parseAmount, toAmountInput } from '../lib/money'

interface LoanSheetProps {
  open: boolean
  /** Кредит для правки; без него создаём новый. */
  loan?: Loan
  onClose: () => void
  onDeleted?: () => void
}

const KINDS: Array<{ value: LoanKind; label: string }> = [
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'consumer', label: 'Потреб.' },
  { value: 'auto', label: 'Авто' },
  { value: 'other', label: 'Другой' },
]

export function LoanSheet({ open, loan, onClose, onDeleted }: LoanSheetProps) {
  const data = useFinance()
  const accounts = activeAccounts(data)
  const isEditing = Boolean(loan)

  const [title, setTitle] = useState(loan?.title ?? '')
  const [kind, setKind] = useState<LoanKind>(loan?.kind ?? 'mortgage')
  const [amount, setAmount] = useState(loan ? toAmountInput(loan.principal) : '')
  const [rate, setRate] = useState(loan ? String(loan.rate / 100).replace('.', ',') : '')

  // Ипотеку удобнее задавать в годах, потребительский — в месяцах.
  const [termUnit, setTermUnit] = useState<'years' | 'months'>(() =>
    loan ? (loan.termMonths % 12 === 0 ? 'years' : 'months') : 'years',
  )
  const [term, setTerm] = useState(() => {
    if (!loan) return ''
    return String(loan.termMonths % 12 === 0 ? loan.termMonths / 12 : loan.termMonths)
  })

  const [startDate, setStartDate] = useState(loan?.startDate ?? todayKey())
  const [paymentDay, setPaymentDay] = useState(
    String(loan?.paymentDay ?? fromDateKey(todayKey()).getDate()),
  )
  const [scheme, setScheme] = useState<LoanScheme>(loan?.scheme ?? 'annuity')
  const [earlyMode, setEarlyMode] = useState<EarlyMode>(loan?.earlyMode ?? 'term')
  const [autoExpense, setAutoExpense] = useState(loan?.autoExpense ?? true)
  const [accountId, setAccountId] = useState(() => loan?.accountId ?? accounts[0]?.id ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const principal = parseAmount(amount)
  const parsedRate = parseRate(rate)
  const termMonths = parseTerm(term, termUnit)
  const day = clampDay(paymentDay)

  const canSave =
    title.trim().length > 0 && principal !== null && parsedRate !== null && termMonths !== null

  const preview =
    principal !== null && parsedRate !== null && termMonths !== null
      ? previewOf({ principal, rate: parsedRate, termMonths, scheme, startDate, day, earlyMode })
      : null

  function handleSave() {
    if (!canSave || principal === null || parsedRate === null || termMonths === null) return

    const payload = {
      title: title.trim(),
      kind,
      principal,
      rate: parsedRate,
      termMonths,
      startDate,
      paymentDay: day,
      scheme,
      earlyMode,
      autoExpense,
      accountId,
    }

    if (loan) actions.updateLoan(loan.id, payload)
    else actions.addLoan(payload)

    onClose()
  }

  function handleDelete() {
    if (!loan) return

    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    actions.deleteLoan(loan.id)
    onClose()
    onDeleted?.()
  }

  return (
    <Sheet open={open} onClose={onClose} title={isEditing ? 'Кредит' : 'Новый кредит'}>
      <div className="flex flex-col gap-5">
        <Field label="Название">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, Ипотека Сбер"
            autoFocus={!isEditing}
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
        </Field>

        <Field label="Тип">
          <Segmented value={kind} options={KINDS} onChange={setKind} />
        </Field>

        <Field
          label="Остаток долга"
          hint="Для нового кредита — сумма, которую выдал банк. Для уже действующего — остаток, который банк показывает сегодня; тогда и дату начала ставьте сегодняшнюю."
        >
          <div className="flex items-baseline gap-2 rounded-2xl bg-surface px-4 py-4">
            <input
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              inputMode="decimal"
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent text-[30px] font-semibold tabular-nums outline-none placeholder:text-muted"
            />
            <span className="text-[22px] font-medium text-muted">₽</span>
          </div>
        </Field>

        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <Field label="Ставка в год">
              <div className="flex items-baseline gap-1.5 rounded-2xl bg-surface px-4 py-3.5">
                <input
                  value={rate}
                  onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
                  inputMode="decimal"
                  placeholder="10,5"
                  className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
                />
                <span className="text-[15px] text-muted">%</span>
              </div>
            </Field>
          </div>

          <div className="w-[104px] shrink-0">
            <Field label="День платежа">
              <input
                value={paymentDay}
                onChange={(e) => setPaymentDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                placeholder="10"
                className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
              />
            </Field>
          </div>
        </div>

        <Field label="Срок">
          <div className="flex gap-3">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              placeholder={termUnit === 'years' ? '20' : '36'}
              className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3.5 text-[17px] font-semibold tabular-nums outline-none placeholder:text-muted"
            />
            <div className="w-[168px] shrink-0">
              <Segmented
                value={termUnit}
                options={[
                  { value: 'years', label: 'лет' },
                  { value: 'months', label: 'месяцев' },
                ]}
                onChange={setTermUnit}
              />
            </div>
          </div>
        </Field>

        <Field label="Дата начала">
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => e.target.value && setStartDate(e.target.value)}
              className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none"
            />
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center bg-surface pr-3 text-[17px]">
              {formatFullDate(startDate)}
            </span>
          </div>
        </Field>

        <Field
          label="Схема платежей"
          hint={
            scheme === 'annuity'
              ? 'Платёж одинаковый весь срок. Так работает большинство кредитов.'
              : 'Тело долга гасится равными частями, платёж каждый месяц уменьшается. Переплата меньше, но первые платежи тяжелее.'
          }
        >
          <Segmented
            value={scheme}
            options={[
              { value: 'annuity', label: 'Аннуитет' },
              { value: 'differentiated', label: 'Дифференц.' },
            ]}
            onChange={setScheme}
          />
        </Field>

        <Field
          label="Досрочные погашения"
          hint={
            earlyMode === 'term'
              ? 'Платёж останется прежним, кредит закроется раньше. Так экономия на процентах максимальная.'
              : 'Срок останется прежним, ежемесячный платёж будет уменьшаться. Легче нагрузка, но переплата больше.'
          }
        >
          <Segmented
            value={earlyMode}
            options={[
              { value: 'term', label: 'Сокращать срок' },
              { value: 'payment', label: 'Снижать платёж' },
            ]}
            onChange={setEarlyMode}
          />
        </Field>

        {accounts.length > 1 && (
          <Field
            label="С какого счёта списывается"
            hint="Платежи по графику будут уменьшать остаток этого счёта."
          >
            <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setAccountId(account.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-bg"
                >
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-200"
                    style={{
                      border:
                        account.id === accountId
                          ? `6px solid ${account.color}`
                          : '2px solid #d6dbe1',
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                    {account.title}
                  </span>
                  <span className="shrink-0 text-[13px] tabular-nums text-muted">
                    {formatMoney(accountBalance(data, account.id), { currency: account.currency })}
                  </span>
                </button>
              ))}
            </div>
          </Field>
        )}

        <ToggleRow
          label="Учитывать платежи в расходах"
          hint="Банк списывает платёж сам — приложение будет добавлять его в расходы в категорию «Кредиты и ипотека»."
          checked={autoExpense}
          onChange={setAutoExpense}
        />

        {preview && (
          <div className="rounded-2xl bg-violet/8 px-4 py-4">
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-violet)' }}>
              Как это будет выглядеть
            </p>
            <p className="mt-2 text-[15px] leading-relaxed">
              Платёж <b className="tabular-nums">{formatMoney(preview.monthly)}</b> в месяц
              {scheme === 'differentiated' && ' в начале срока'}, срок {formatTerm(termMonths ?? 0)}
              {parsedRate !== null && ` под ${formatRate(parsedRate)}`}.
              <span className="mt-1 block text-muted">
                Переплата за весь срок — {formatMoney(preview.overpay)}, это{' '}
                {Math.round((preview.overpay / (principal ?? 1)) * 100)} % от суммы.
              </span>
            </p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="mt-1 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-30"
        >
          Сохранить
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
            {confirmingDelete ? 'Удалить кредит и все его платежи?' : 'Удалить кредит'}
          </button>
        )}
      </div>
    </Sheet>
  )
}

function parseTerm(input: string, unit: 'years' | 'months'): number | null {
  const value = Number(input)
  if (!Number.isFinite(value) || value <= 0) return null

  const months = unit === 'years' ? Math.round(value * 12) : Math.round(value)
  return months > 0 && months <= 600 ? months : null
}

/** День вне 1–31 приводим к границе: короткие месяцы график разрулит сам. */
function clampDay(input: string): number {
  const value = Number(input)
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.min(Math.round(value), 31)
}

/** Платёж и переплата для ещё не сохранённого кредита — предпросмотр прямо в форме. */
function previewOf(draft: {
  principal: number
  rate: number
  termMonths: number
  scheme: LoanScheme
  startDate: string
  day: number
  earlyMode: EarlyMode
}): { monthly: number; overpay: number } {
  const stats = loanStats(
    {
      id: '__preview',
      title: '',
      kind: 'other',
      principal: draft.principal,
      rate: draft.rate,
      termMonths: draft.termMonths,
      startDate: draft.startDate,
      paymentDay: draft.day,
      scheme: draft.scheme,
      earlyMode: draft.earlyMode,
      autoExpense: false,
      prepayments: [],
      createdAt: '',
    },
    // Считаем от даты начала, а не от сегодня: иначе для старого кредита
    // предпросмотр покажет платёж из середины графика.
    draft.startDate,
  )

  return {
    monthly:
      draft.scheme === 'annuity'
        ? annuityPayment(draft.principal, draft.rate, draft.termMonths)
        : (stats.schedule[0]?.payment ?? 0),
    overpay: stats.totalInterest,
  }
}
