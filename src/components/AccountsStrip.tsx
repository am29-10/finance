import { CategoryIcon } from './CategoryIcon'
import { accountIcon } from '../data/accounts'
import type { AccountBalance } from '../data/store'
import { currencyInfo } from '../lib/currency'
import { formatMoney } from '../lib/money'

interface AccountsStripProps {
  balances: AccountBalance[]
  /** Валюты, для которых не задан курс, — их остатки не вошли в общий итог. */
  missingRates: string[]
  hidden?: boolean
  onOpen: () => void
}

/**
 * Разбивка баланса по счетам под общей суммой.
 *
 * Одно число «всего денег» не отвечает на вопрос, который задают чаще: сколько
 * лежит где. Поэтому под итогом идёт список счетов, а валютные показаны в своей
 * валюте — переводить их в рубли на карточке значило бы скрыть, что там доллары.
 */
export function AccountsStrip({ balances, missingRates, hidden, onOpen }: AccountsStripProps) {
  const money = (amount: number, currency: string) =>
    hidden ? '••• ' : formatMoney(amount, { currency })

  /**
   * Счетов нет — значит человек ещё не сказал, где лежат его деньги. Пустой
   * список тут выглядел бы поломкой, поэтому вместо него приглашение завести
   * первый счёт: без него баланс считать не из чего.
   */
  if (balances.length === 0) {
    return (
      <button
        onClick={onOpen}
        className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-left transition-colors active:bg-bg"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10">
          <svg viewBox="0 0 24 24" className="size-5 text-brand" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M12 6v12M6 12h12" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Добавить счёт</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">
            Карта, наличные или вклад — с него и начнётся баланс
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className="mt-3">
      <button
        onClick={onOpen}
        className="mb-2 flex w-full items-baseline justify-between px-1 text-left"
      >
        {/* Заголовок и есть кнопка: подпись «Счета» справа повторяла его слово в слово. */}
        <span className="text-[15px] font-semibold">Счета</span>
      </button>

      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
        {balances.map(({ account, amount, inBase }) => (
          <button
            key={account.id}
            onClick={onOpen}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-bg"
          >
            <CategoryIcon icon={accountIcon(account.kind)} color={account.color} size={38} />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{account.title}</span>
              {inBase === null && (
                <span className="mt-0.5 block text-[12px]" style={{ color: 'var(--color-danger)' }}>
                  Курс не задан — не входит в общий итог
                </span>
              )}
            </span>

            <span className="shrink-0 text-right">
              <span
                className="block text-[16px] font-semibold tabular-nums"
                style={{ color: amount < 0 ? 'var(--color-danger)' : undefined }}
              >
                {money(amount, account.currency)}
              </span>
              {/* Рублёвый эквивалент показываем только там, где он не очевиден. */}
              {inBase !== null && account.currency !== 'RUB' && (
                <span className="mt-0.5 block text-[12px] tabular-nums text-muted">
                  ≈ {money(inBase, 'RUB')}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {missingRates.length > 0 && (
        <p
          className="mt-2 rounded-2xl px-4 py-3 text-[12px] leading-snug"
          style={{ backgroundColor: '#f4433610' }}
        >
          Не задан курс для {missingRates.map((code) => currencyInfo(code).title.toLowerCase()).join(', ')}.
          Эти счета в общую сумму не попали — курс вводится в Профиле.
        </p>
      )}
    </div>
  )
}
