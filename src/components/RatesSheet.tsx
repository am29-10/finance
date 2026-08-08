import { useState } from 'react'
import { Sheet } from './Sheet'
import { actions, activeAccounts, useFinance } from '../data/store'
import { BASE_CURRENCY, CURRENCIES, currencyInfo, formatRateInput, parseRateInput } from '../lib/currency'

interface RatesSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Курсы валют к рублю, вводимые вручную.
 *
 * Автоматический курс потребовал бы обращения в сеть при каждом открытии
 * приложения, а оно намеренно работает офлайн и без сервера. Для вопроса
 * «сколько у меня всего» курс месячной давности ошибается на проценты — это
 * несопоставимо меньше, чем цена потери работы без интернета.
 */
export function RatesSheet({ open, onClose }: RatesSheetProps) {
  const data = useFinance()

  /**
   * Показываем не весь список валют, а только те, в которых есть счета:
   * два десятка полей, из которых нужны ноль или одно, — это не настройка,
   * а анкета.
   */
  const used = [...new Set(activeAccounts(data).map((a) => a.currency))].filter(
    (code) => code !== BASE_CURRENCY,
  )

  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      used.map((code) => [code, data.settings.rates[code] ? formatRateInput(data.settings.rates[code]) : '']),
    ),
  )

  const [adding, setAdding] = useState('')

  const shown = [...new Set([...used, ...Object.keys(drafts)])]

  function handleSave() {
    const rates: Record<string, number> = { ...data.settings.rates }

    for (const [code, value] of Object.entries(drafts)) {
      const parsed = parseRateInput(value)
      if (parsed === null) delete rates[code]
      else rates[code] = parsed
    }

    actions.updateSettings({ rates })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Курсы валют">
      <div className="flex flex-col gap-5">
        <p className="px-1 text-[14px] leading-relaxed text-muted">
          Сколько рублей стоит одна единица валюты. Нужно, чтобы валютные счета вошли в общий
          баланс. Курс из интернета приложение не берёт намеренно — оно работает без сети.
        </p>

        {shown.length === 0 ? (
          <p className="rounded-2xl bg-surface px-5 py-8 text-center text-[14px] leading-snug text-muted">
            Валютных счетов нет, курсы не нужны.
            <br />
            Заведите счёт в валюте — поле для курса появится здесь само.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map((code) => {
              const info = currencyInfo(code)

              return (
                <div key={code} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                  <span className="w-[92px] shrink-0">
                    <span className="block text-[15px] font-semibold">1 {info.symbol}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">{info.title}</span>
                  </span>

                  <span className="text-[15px] text-muted">=</span>

                  <input
                    value={drafts[code] ?? ''}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [code]: e.target.value.replace(/[^\d.,]/g, '') }))
                    }
                    inputMode="decimal"
                    placeholder="0"
                    className="min-w-0 flex-1 bg-transparent text-right text-[19px] font-semibold tabular-nums outline-none placeholder:text-muted"
                  />

                  <span className="text-[15px] text-muted">₽</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Курс можно задать заранее, ещё не заведя счёт в этой валюте. */}
        <div className="flex gap-2">
          <select
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 text-[15px] outline-none"
          >
            <option value="">Добавить валюту заранее…</option>
            {CURRENCIES.filter((c) => c.code !== BASE_CURRENCY && !shown.includes(c.code)).map((c) => (
              <option key={c.code} value={c.code}>
                {c.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              if (!adding) return
              setDrafts((d) => ({ ...d, [adding]: '' }))
              setAdding('')
            }}
            disabled={!adding}
            className="shrink-0 rounded-2xl bg-surface px-5 text-[15px] font-medium text-brand disabled:opacity-30"
          >
            Добавить
          </button>
        </div>

        <button
          onClick={handleSave}
          className="mt-1 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
        >
          Сохранить
        </button>
      </div>
    </Sheet>
  )
}
