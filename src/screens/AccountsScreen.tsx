import { useState } from 'react'
import { AccountRow, AccountSheet } from '../components/AccountSheet'
import { accountBalance, accountBalances, totalBalance, useFinance } from '../data/store'
import type { Account } from '../data/types'
import { currencyInfo, toBase } from '../lib/currency'
import { formatMoney } from '../lib/money'
import { plural } from '../lib/text'

interface AccountsScreenProps {
  onBack: () => void
}

export function AccountsScreen({ onBack }: AccountsScreenProps) {
  const data = useFinance()
  const [sheet, setSheet] = useState<{ account?: Account } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const active = accountBalances(data)
  const archived = data.accounts.filter((a) => a.archivedAt)
  const total = totalBalance(data)

  function openSheet(account?: Account) {
    setSheet({ account })
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setTimeout(() => setSheet(null), 260)
  }

  return (
    <div className="px-4 pb-8">
      <header className="flex items-center gap-3 py-4">
        <button
          onClick={onBack}
          aria-label="Назад"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface transition-transform active:scale-90"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="flex-1 text-[20px] font-bold tracking-tight">Счета</h1>
      </header>

      <section className="rounded-3xl bg-brand px-5 py-5 text-white">
        <span className="text-[13px] opacity-80">Всего денег</span>
        <p className="mt-1 text-[32px] font-bold tabular-nums">{formatMoney(total.amount)}</p>
        <p className="mt-1 text-[13px] opacity-80">
          {active.length} {plural(active.length, 'счёт', 'счёта', 'счетов')}
          {total.missingRates.length > 0 &&
            ` · ${total.missingRates.length} без курса и не в счёт`}
        </p>
      </section>

      <div className="mt-4 flex flex-col gap-2.5">
        {active.map(({ account, amount, inBase }) => (
          <AccountRow
            key={account.id}
            account={account}
            amount={amount}
            inBase={inBase}
            onClick={() => openSheet(account)}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 px-1 text-[15px] font-semibold text-muted">В архиве</h2>
          <div className="flex flex-col gap-2.5">
            {archived.map((account) => {
              const amount = accountBalance(data, account.id)
              return (
                <AccountRow
                  key={account.id}
                  account={account}
                  amount={amount}
                  inBase={toBase(amount, account.currency, data.settings.rates)}
                  onClick={() => openSheet(account)}
                />
              )
            })}
          </div>
        </>
      )}

      <button
        onClick={() => openSheet()}
        className="mt-4 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
      >
        Добавить счёт
      </button>

      {total.missingRates.length > 0 && (
        <p
          className="mt-3 rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed"
          style={{ backgroundColor: '#f4433610' }}
        >
          Не задан курс для{' '}
          {total.missingRates.map((code) => currencyInfo(code).title.toLowerCase()).join(', ')}.
          Пока его нет, эти счета не входят в общую сумму — задать курс можно в Профиле.
        </p>
      )}

      <p className="mt-4 px-1 text-[13px] leading-relaxed text-muted">
        Счета нужны, чтобы видеть не только «сколько всего», но и «где именно». Перемещение денег
        между своими счетами заводится как перевод — тогда снятие наличных не выглядит тратой
        в тридцать тысяч, а пополнение вклада не портит структуру расходов.
      </p>

      {sheet && (
        <AccountSheet
          key={sheet.account?.id ?? 'new'}
          open={sheetOpen}
          account={sheet.account}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}
