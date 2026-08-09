import { useState } from 'react'
import { Sheet } from './Sheet'
import { Field } from './Field'
import { CategoryIcon } from './CategoryIcon'
import { ACCOUNT_COLORS, ACCOUNT_KINDS, accountIcon } from '../data/accounts'
import { accountBalance, actions, useFinance } from '../data/store'
import type { Account, AccountKind } from '../data/types'
import { BASE_CURRENCY, CURRENCIES, currencySymbol } from '../lib/currency'
import { formatBalanceInput, formatMoney, parseBalance, toBalanceInput } from '../lib/money'

interface AccountSheetProps {
  open: boolean
  /** Счёт для правки; без него создаём новый. */
  account?: Account
  onClose: () => void
}

export function AccountSheet({ open, account, onClose }: AccountSheetProps) {
  const data = useFinance()
  const isEditing = Boolean(account)

  const [title, setTitle] = useState(account?.title ?? '')
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'card')
  const [currency, setCurrency] = useState(account?.currency ?? BASE_CURRENCY)
  const [color, setColor] = useState(account?.color ?? ACCOUNT_COLORS[0])
  /**
   * В поле — остаток прямо сейчас, а не точка отсчёта.
   *
   * Человек знает про свой счёт ровно одно число: сколько на нём лежит по данным
   * банка. Показывать ему «начальный остаток», который после десятка операций
   * ни с чем в реальности не совпадает, значит просить подогнать величину,
   * которую он никогда не видел. Разницу пересчитаем сами при сохранении.
   */
  const current = account ? accountBalance(data, account.id) : 0
  const [balance, setBalance] = useState(() =>
    account && current !== 0 ? toBalanceInput(current) : '',
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const parsedBalance = balance.trim() === '' ? 0 : parseBalance(balance)
  const canSave = title.trim().length > 0 && parsedBalance !== null
  // Насколько сдвинется точка отсчёта — это и есть вся правка остатка.
  const delta = parsedBalance === null ? 0 : parsedBalance - current

  // Сколько операций и денег потеряется при удалении — это надо знать до нажатия.
  const affected = account
    ? data.operations.filter((o) => o.accountId === account.id || o.toAccountId === account.id).length
    : 0

  function handleSave() {
    if (!canSave || parsedBalance === null) return

    const payload = { title: title.trim(), kind, currency, color }

    if (account) {
      actions.updateAccount(account.id, payload)
      // Отдельным действием: остаток задаётся числом с экрана, а в точку
      // отсчёта ложится разница — считать её должен store, а не форма.
      actions.setAccountBalance(account.id, parsedBalance)
    } else {
      actions.addAccount({ ...payload, initialBalance: parsedBalance })
    }

    onClose()
  }

  function handleDelete() {
    if (!account) return

    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    actions.deleteAccount(account.id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={isEditing ? 'Счёт' : 'Новый счёт'}>
      <div className="flex flex-col gap-5">
        <Field label="Название">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, Сбер или Наличные"
            autoFocus={!isEditing}
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-muted"
          />
        </Field>

        <Field label="Тип">
          <div className="grid grid-cols-5 gap-2 rounded-2xl bg-surface px-3 py-4">
            {ACCOUNT_KINDS.map((option) => {
              const active = option.value === kind

              return (
                <button
                  key={option.value}
                  onClick={() => setKind(option.value)}
                  className="flex flex-col items-center gap-1.5 transition-transform duration-200 active:scale-90"
                >
                  <span
                    className="rounded-2xl transition-all duration-200"
                    style={{ boxShadow: active ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none' }}
                  >
                    <CategoryIcon icon={option.icon} color={color} size={40} />
                  </span>
                  <span
                    className="text-center text-[10px] leading-tight"
                    style={{ color: active ? 'var(--color-ink)' : 'var(--color-muted)' }}
                  >
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Цвет">
          <div className="flex gap-2.5 rounded-2xl bg-surface px-4 py-3.5">
            {ACCOUNT_COLORS.map((option) => (
              <button
                key={option}
                onClick={() => setColor(option)}
                aria-label={`Цвет ${option}`}
                className="size-8 rounded-full transition-transform duration-200 active:scale-90"
                style={{
                  backgroundColor: option,
                  boxShadow: option === color ? `0 0 0 2px white, 0 0 0 4px ${option}` : 'none',
                }}
              />
            ))}
          </div>
        </Field>

        <Field
          label="Валюта"
          hint={
            currency === BASE_CURRENCY
              ? undefined
              : 'В общий баланс такой счёт войдёт по курсу, который задаётся в Профиле. Без курса он останется отдельной строкой.'
          }
        >
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-2xl bg-surface px-4 py-3.5 text-[17px] outline-none"
          >
            {CURRENCIES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.title} · {option.symbol}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Сколько сейчас на счёте"
          hint={
            isEditing
              ? 'Поставьте столько, сколько показывает банк. Остаток можно править когда угодно — это ваше число, а не вычисленное за вас.'
              : 'Остаток на момент, когда вы заводите счёт. Он не считается доходом и в аналитику не попадает — иначе первый месяц был бы испорчен фиктивным заработком.'
          }
        >
          <div className="flex items-baseline gap-2 rounded-2xl bg-surface px-4 py-4">
            <input
              value={balance}
              onChange={(e) => setBalance(formatBalanceInput(e.target.value))}
              inputMode="decimal"
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent text-[26px] font-semibold tabular-nums outline-none placeholder:text-muted"
            />
            <span className="text-[20px] font-medium text-muted">{currencySymbol(currency)}</span>
            {/* На телефоне цифровая клавиатура минуса не даёт, а карта в минусе — обычное дело. */}
            <button
              onClick={() => setBalance((value) => (value.startsWith('−') ? value.slice(1) : `−${value}`))}
              aria-label="Сменить знак"
              className="shrink-0 self-center rounded-xl bg-bg px-2.5 py-1 text-[15px] font-semibold text-muted transition-transform active:scale-90"
            >
              ±
            </button>
          </div>
        </Field>

        {/*
          Правка остатка ничего не пишет в историю — она двигает точку отсчёта.
          Показываем это до нажатия «Сохранить»: молча изменившийся баланс на
          пару тысяч выглядел бы как потерянная операция.
        */}
        {isEditing && account && delta !== 0 && (
          <p className="-mt-2 rounded-2xl bg-surface px-4 py-3.5 text-[13px] leading-relaxed text-muted">
            Было {formatMoney(current, { currency: account.currency })} — станет{' '}
            {formatMoney(parsedBalance ?? 0, { currency: account.currency })}.{' '}
            Разница {formatMoney(Math.abs(delta), { currency: account.currency })} уйдёт в начальный
            остаток{affected > 0 ? ', история счёта останется нетронутой' : ''} — ни в доходах, ни в
            расходах она не появится.
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="mt-1 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-30"
        >
          Сохранить
        </button>

        {isEditing && account && (
          <>
            <button
              onClick={() =>
                account.archivedAt
                  ? actions.unarchiveAccount(account.id)
                  : actions.archiveAccount(account.id)
              }
              className="w-full rounded-2xl py-3.5 text-[15px] font-medium text-muted transition-all duration-200 active:scale-[0.98]"
            >
              {account.archivedAt ? 'Вернуть счёт в активные' : 'Убрать из активных, сохранив историю'}
            </button>

            <button
              onClick={handleDelete}
              className="w-full rounded-2xl py-3.5 text-[15px] font-medium transition-all duration-200 active:scale-[0.98]"
              style={{
                color: 'var(--color-danger)',
                backgroundColor: confirmingDelete ? '#f4433614' : 'transparent',
              }}
            >
              {confirmingDelete
                ? affected > 0
                  ? `Удалить счёт и ${affected} операций без возврата?`
                  : 'Точно удалить счёт?'
                : 'Удалить счёт'}
            </button>

            {affected > 0 && !confirmingDelete && (
              <p className="-mt-3 px-1 text-center text-[12px] leading-snug text-muted">
                На счёте {affected} операций. Удаление заберёт их с собой — если нужна только
                чистота в списках, лучше убрать счёт из активных.
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}

/** Строка счёта в списке. Вынесена сюда, чтобы экран и форма не разъезжались по виду. */
export function AccountRow({
  account,
  amount,
  inBase,
  onClick,
}: {
  account: Account
  amount: number
  inBase: number | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
      style={{ opacity: account.archivedAt ? 0.55 : 1 }}
    >
      <CategoryIcon icon={accountIcon(account.kind)} color={account.color} size={44} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{account.title}</span>
        <span className="mt-0.5 block text-[12px] text-muted">
          {ACCOUNT_KINDS.find((k) => k.value === account.kind)?.label}
          {account.currency !== BASE_CURRENCY && ` · ${account.currency}`}
          {account.archivedAt && ' · в архиве'}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span
          className="block text-[17px] font-semibold tabular-nums"
          style={{ color: amount < 0 ? 'var(--color-danger)' : undefined }}
        >
          {formatMoney(amount, { currency: account.currency })}
        </span>
        {inBase !== null && account.currency !== BASE_CURRENCY && (
          <span className="mt-0.5 block text-[12px] tabular-nums text-muted">
            ≈ {formatMoney(inBase)}
          </span>
        )}
      </span>
    </button>
  )
}
