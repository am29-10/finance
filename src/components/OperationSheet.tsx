import { useState } from 'react'
import { Sheet } from './Sheet'
import { Field } from './Field'
import { CategoryIcon } from './CategoryIcon'
import { accountBalance, actions, activeAccounts, activeLoans, categoriesOf, useFinance } from '../data/store'
import { LOAN_CATEGORY_ID } from '../data/categories'
import type { Account, FinanceData, Operation, OperationType } from '../data/types'
import { formatAmountInput, formatMoney, parseAmount, toAmountInput } from '../lib/money'
import { formatFullDate, todayKey } from '../lib/date'
import { forecastPrepayment, formatTerm, loanStats } from '../lib/loan'
import { accountIcon } from '../data/accounts'
import { BASE_CURRENCY, currencySymbol } from '../lib/currency'

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
    operation ? toAmountInput(operation.amount) : '',
  )
  const [categoryId, setCategoryId] = useState(operation?.categoryId ?? 'products')
  const [date, setDate] = useState(operation?.date ?? todayKey())
  const [note, setNote] = useState(operation?.note ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const accounts = activeAccounts(data)

  const [accountId, setAccountId] = useState(
    () => operation?.accountId ?? accounts[0]?.id ?? '',
  )
  const [toAccountId, setToAccountId] = useState(
    () => operation?.toAccountId ?? accounts[1]?.id ?? '',
  )
  const [toAmount, setToAmount] = useState(() =>
    operation?.toAmount ? toAmountInput(operation.toAmount) : '',
  )

  const isTransfer = type === 'transfer'
  const fromAccount = accounts.find((a) => a.id === accountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const crossCurrency =
    isTransfer && Boolean(fromAccount && toAccount) && fromAccount!.currency !== toAccount!.currency

  const loans = activeLoans(data)

  /**
   * Кредит, в счёт которого идёт эта сумма.
   *
   * Без него выбор категории «Кредиты и ипотека» вводил в заблуждение: расход
   * появлялся, а долг оставался прежним, потому что приложение не знало, какому
   * кредиту его засчитать. Когда кредит один, подставляем его сразу — угадывать
   * тут нечего, а выбор виден на экране и его можно снять.
   */
  const [loanId, setLoanId] = useState<string | null>(() => (loans.length === 1 ? loans[0].id : null))

  // У перевода категории нет — для списка берём расходные, он всё равно скрыт.
  const categories = categoriesOf(data, isTransfer ? 'expense' : type)
  const parsed = parseAmount(amount)

  const isLoanCategory = type === 'expense' && categoryId === LOAN_CATEGORY_ID
  // Привязка к кредиту меняет график, поэтому доступна только для новых операций:
  // превращать уже проведённый расход в досрочное погашение задним числом — верный
  // способ получить расхождение с банком, которое потом никто не распутает.
  const showLoanPicker = isLoanCategory && !isEditing && loans.length > 0

  const selectedLoan = showLoanPicker ? loans.find((l) => l.id === loanId) : undefined
  const balance = selectedLoan ? loanStats(selectedLoan).balance : 0
  // Внести больше остатка нельзя: излишек банк вернёт, а график от него поедет.
  const applied = selectedLoan && parsed !== null ? Math.min(parsed, balance) : parsed
  const forecast =
    selectedLoan && applied !== null ? forecastPrepayment(selectedLoan, applied, date) : null

  const parsedToAmount = parseAmount(toAmount)

  const canSave = isTransfer
    ? parsed !== null &&
      Boolean(fromAccount && toAccount) &&
      accountId !== toAccountId &&
      (!crossCurrency || parsedToAmount !== null)
    : parsed !== null && Boolean(fromAccount) && categories.some((c) => c.id === categoryId)

  function changeType(next: OperationType) {
    setType(next)
    if (next === 'transfer') return

    // Категории у доходов и расходов разные — переносим выбор на первую подходящую.
    const first = categoriesOf(data, next)[0]
    if (first) setCategoryId(first.id)
  }

  function handleSave() {
    if (parsed === null || !canSave) return

    /**
     * Перевод не имеет категории: он не доход и не расход, а перемещение между
     * своими счетами. Категорию всё же записываем — модель требует строку, и
     * пустая ломала бы старый код, который её читает.
     */
    if (isTransfer) {
      const payload = {
        type: 'transfer' as const,
        amount: parsed,
        categoryId: 'other-expense',
        date,
        note: note.trim() || undefined,
        accountId,
        toAccountId,
        toAmount: crossCurrency ? (parsedToAmount ?? parsed) : undefined,
      }

      if (operation) actions.updateOperation(operation.id, payload)
      else actions.addOperation(payload)

      onClose()
      return
    }

    /**
     * Платёж по кредиту записывается не расходом, а досрочным погашением:
     * расход в категории «Кредиты и ипотека» приложение создаст из него само,
     * и он останется связан с графиком. Заведи мы здесь обычную операцию —
     * деньги ушли бы в никуда, а долг не сдвинулся.
     */
    if (selectedLoan && applied !== null) {
      actions.addPrepayment(selectedLoan.id, {
        date,
        amount: applied,
        mode: selectedLoan.earlyMode,
        note: note.trim() || undefined,
      })
      onClose()
      return
    }

    const payload = {
      type,
      amount: parsed,
      categoryId,
      date,
      note: note.trim() || undefined,
      accountId,
      // Операция могла быть переводом до правки — снимаем следы второго счёта.
      toAccountId: undefined,
      toAmount: undefined,
    }

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
          {accounts.length > 1 && (
            <TypeTab active={isTransfer} tone="transfer" onClick={() => changeType('transfer')}>
              Перевод
            </TypeTab>
          )}
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
            <span className="text-[22px] font-medium text-muted">
              {currencySymbol(fromAccount?.currency ?? BASE_CURRENCY)}
            </span>
          </div>
        </Field>

        {isTransfer ? (
          <>
            <Field label="Откуда">
              <AccountPicker
                accounts={accounts}
                data={data}
                selected={accountId}
                onSelect={setAccountId}
              />
            </Field>

            <Field
              label="Куда"
              hint={
                accountId === toAccountId
                  ? 'Счёт получателя должен отличаться от счёта списания.'
                  : undefined
              }
            >
              <AccountPicker
                accounts={accounts.filter((a) => a.id !== accountId)}
                data={data}
                selected={toAccountId}
                onSelect={setToAccountId}
              />
            </Field>

            {crossCurrency && (
              <Field
                label={`Сколько пришло на счёт «${toAccount?.title}»`}
                hint="Валюты счетов разные. Курс сделки почти всегда отличается от курса в настройках, поэтому полученную сумму введите как в банке."
              >
                <div className="flex items-baseline gap-2 rounded-2xl bg-surface px-4 py-4">
                  <input
                    value={toAmount}
                    onChange={(e) => setToAmount(formatAmountInput(e.target.value))}
                    inputMode="decimal"
                    placeholder="0"
                    className="min-w-0 flex-1 bg-transparent text-[24px] font-semibold tabular-nums outline-none placeholder:text-muted"
                  />
                  <span className="text-[18px] font-medium text-muted">
                    {currencySymbol(toAccount?.currency ?? BASE_CURRENCY)}
                  </span>
                </div>
              </Field>
            )}
          </>
        ) : (
          <>
            {accounts.length > 1 && (
              <Field label="Счёт">
                <AccountPicker
                  accounts={accounts}
                  data={data}
                  selected={accountId}
                  onSelect={setAccountId}
                />
              </Field>
            )}

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

        {showLoanPicker && (
          <Field
            label="В счёт какого кредита"
            hint={
              selectedLoan
                ? undefined
                : 'Без выбора сумма попадёт только в расходы, а остаток долга не изменится.'
            }
          >
            <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
              {loans.map((loan) => (
                <LoanChoice
                  key={loan.id}
                  title={loan.title}
                  meta={`Остаток ${formatMoney(loanStats(loan).balance)}`}
                  active={loan.id === loanId}
                  onClick={() => setLoanId(loan.id)}
                />
              ))}
              <LoanChoice
                title="Не привязывать"
                meta="Кредит в другом банке, здесь не заведён"
                active={loanId === null}
                onClick={() => setLoanId(null)}
              />
            </div>
          </Field>
        )}

        {isLoanCategory && !isEditing && loans.length === 0 && (
          <p className="rounded-2xl bg-surface px-4 py-3.5 text-[13px] leading-relaxed text-muted">
            Кредитов в приложении пока нет, поэтому сумма попадёт просто в расходы. Заведите
            кредит карточкой на главной — тогда платежи будут уменьшать долг, а приложение
            посчитает остаток, переплату и выгоду от досрочных погашений.
          </p>
        )}

        {isLoanCategory && isEditing && !operation?.loanId && (
          <p className="rounded-2xl bg-surface px-4 py-3.5 text-[13px] leading-relaxed text-muted">
            Эта операция не привязана к кредиту и на остаток долга не влияет — она просто расход
            в этой категории. Чтобы уменьшить долг, внесите платёж через раздел «Кредиты».
          </p>
        )}
          </>
        )}

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

        {selectedLoan && forecast && applied !== null && (
          <div className="rounded-2xl bg-brand/8 px-4 py-3.5">
            <p className="text-[14px] leading-snug">
              <b>{formatMoney(applied)}</b> уйдёт в счёт долга — останется{' '}
              <b className="tabular-nums">{formatMoney(forecast[selectedLoan.earlyMode].balance)}</b>.
            </p>
            <p className="mt-1 text-[13px] leading-snug text-muted">
              {selectedLoan.earlyMode === 'term' ? (
                forecast.term.savedMonths > 0 ? (
                  <>
                    Срок сократится на {formatTerm(forecast.term.savedMonths)}, экономия на
                    процентах — {formatMoney(forecast.term.savedInterest)}.
                  </>
                ) : (
                  <>Суммы пока не хватает, чтобы убрать хотя бы один платёж.</>
                )
              ) : forecast.payment.savedMonthly > 0 ? (
                <>
                  Платёж снизится на {formatMoney(forecast.payment.savedMonthly)}, экономия на
                  процентах — {formatMoney(forecast.payment.savedInterest)}.
                </>
              ) : (
                <>Платёж почти не изменится.</>
              )}
            </p>
            {!selectedLoan.autoExpense && (
              <p className="mt-2 text-[12px] leading-snug" style={{ color: 'var(--color-danger)' }}>
                У этого кредита выключен учёт платежей в расходах: долг уменьшится, но в расходах
                сумма не появится. Включается при изменении кредита.
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="mt-1 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-30"
        >
          {parsed === null
            ? 'Сохранить'
            : selectedLoan
              ? `Внести ${formatMoney(applied ?? parsed)} в счёт кредита`
              : `Сохранить ${formatMoney(parsed)}`}
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

/** Выбор счёта: название, остаток и валюта — чтобы не гадать, откуда списывать. */
function AccountPicker({
  accounts,
  data,
  selected,
  onSelect,
}: {
  accounts: Account[]
  data: FinanceData
  selected: string
  onSelect: (id: string) => void
}) {
  if (accounts.length === 0) {
    return (
      <p className="rounded-2xl bg-surface px-4 py-3.5 text-[13px] leading-snug text-muted">
        Нет подходящего счёта. Заведите второй счёт на главной, чтобы переводить между ними.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {accounts.map((account) => {
        const active = account.id === selected

        return (
          <button
            key={account.id}
            onClick={() => onSelect(account.id)}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-200"
            style={{
              backgroundColor: 'var(--color-surface)',
              boxShadow: active ? `0 0 0 2px ${account.color}` : 'none',
            }}
          >
            <CategoryIcon icon={accountIcon(account.kind)} color={account.color} size={36} />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{account.title}</span>
              <span className="mt-0.5 block text-[12px] tabular-nums text-muted">
                {formatMoney(accountBalance(data, account.id), { currency: account.currency })}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function LoanChoice({
  title,
  meta,
  active,
  onClick,
}: {
  title: string
  meta: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-bg"
    >
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-200"
        style={{
          border: active ? '6px solid var(--color-brand)' : '2px solid #d6dbe1',
        }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        <span className="mt-0.5 block text-[12px] text-muted">{meta}</span>
      </span>
    </button>
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
  // Перевод не окрашиваем ни в зелёное, ни в красное: он ничего не прибавляет
  // и не отнимает, а только перекладывает деньги между своими счетами.
  const palette = {
    income: { text: 'var(--color-brand)', background: '#2e7d6b14' },
    expense: { text: 'var(--color-danger)', background: '#f4433612' },
    transfer: { text: 'var(--color-violet)', background: '#7c6cf214' },
  }[tone]

  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl py-2.5 text-[14px] font-semibold transition-all duration-200"
      style={{
        backgroundColor: active ? palette.background : 'transparent',
        color: active ? palette.text : 'var(--color-muted)',
      }}
    >
      {children}
    </button>
  )
}

