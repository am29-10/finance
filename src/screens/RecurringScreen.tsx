import { useState } from 'react'
import { CategoryIcon } from '../components/CategoryIcon'
import { RecurrenceSheet } from '../components/RecurrenceSheet'
import { accountById, categoryById, useFinance } from '../data/store'
import type { Recurrence } from '../data/types'
import { formatFullDate } from '../lib/date'
import { formatMoney } from '../lib/money'
import { nextOccurrence, PERIOD_TITLES } from '../lib/recurrence'
import { plural } from '../lib/text'

interface RecurringScreenProps {
  onBack: () => void
}

export function RecurringScreen({ onBack }: RecurringScreenProps) {
  const data = useFinance()
  const [sheet, setSheet] = useState<Recurrence | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const active = data.recurrences.filter((rule) => !rule.pausedAt)
  const paused = data.recurrences.filter((rule) => rule.pausedAt)

  /** Сколько всего уходит в месяц по регулярным расходам — главное число экрана. */
  const monthly = active
    .filter((rule) => rule.type === 'expense')
    .reduce((sum, rule) => sum + perMonth(rule), 0)

  function openSheet(rule: Recurrence) {
    setSheet(rule)
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
        <h1 className="flex-1 text-[20px] font-bold tracking-tight">Повторяющиеся</h1>
      </header>

      {data.recurrences.length === 0 ? (
        <>
          <p className="rounded-2xl bg-surface px-5 py-8 text-center text-[14px] leading-relaxed text-muted">
            Пока ничего не повторяется
          </p>
          <p className="mt-4 px-1 text-[13px] leading-relaxed text-muted">
            Подписки, аренда, зарплата приходят по календарю, а не тогда, когда о них вспомнили.
            Отметьте «Повторять» при создании операции — и приложение заведёт следующую само,
            в свой срок. Месяц с забытой подпиской выглядит дешевле, чем был, и портит всю
            статистику.
          </p>
        </>
      ) : (
        <>
          <section className="rounded-3xl bg-brand px-5 py-5 text-white">
            <span className="text-[13px] opacity-80">Регулярные расходы</span>
            <p className="mt-1 text-[32px] font-bold tabular-nums">{formatMoney(monthly)}</p>
            <p className="mt-1 text-[13px] opacity-80">
              в месяц · {active.length} {plural(active.length, 'повтор', 'повтора', 'повторов')}
              {paused.length > 0 && ` · ${paused.length} на паузе`}
            </p>
          </section>

          <div className="mt-4 flex flex-col gap-2.5">
            {active.map((rule) => (
              <RecurrenceRow key={rule.id} rule={rule} onClick={() => openSheet(rule)} />
            ))}
          </div>

          {paused.length > 0 && (
            <>
              <h2 className="mt-6 mb-2 px-1 text-[15px] font-semibold text-muted">На паузе</h2>
              <div className="flex flex-col gap-2.5">
                {paused.map((rule) => (
                  <RecurrenceRow key={rule.id} rule={rule} onClick={() => openSheet(rule)} />
                ))}
              </div>
            </>
          )}

          <p className="mt-4 px-1 text-[13px] leading-relaxed text-muted">
            Созданная по повтору операция — обычная: сумму за конкретный месяц можно поправить
            или удалить её вовсе, шаблон это не отменит и заново её не заведёт.
          </p>
        </>
      )}

      {sheet && (
        <RecurrenceSheet key={sheet.id} open={sheetOpen} rule={sheet} onClose={closeSheet} />
      )}
    </div>
  )
}

/**
 * Сколько правило стоит в месяц.
 *
 * Недельные и годовые приводим к месяцу, иначе сумма «регулярных расходов»
 * складывала бы несравнимое: 400 ₽ в неделю — это не 400 ₽ в месяц.
 * 365/12/7 ≈ 4,35 недели в месяце — считаем по среднему, а не по четырём.
 */
function perMonth(rule: Recurrence): number {
  if (rule.period === 'week') return Math.round((rule.amount * 365) / 12 / 7)
  if (rule.period === 'year') return Math.round(rule.amount / 12)
  return rule.amount
}

function RecurrenceRow({ rule, onClick }: { rule: Recurrence; onClick: () => void }) {
  const data = useFinance()

  const category = categoryById(data, rule.categoryId)
  const account = accountById(data, rule.accountId)
  const isTransfer = rule.type === 'transfer'
  const next = nextOccurrence(rule)

  const icon = isTransfer ? 'repeat' : (category?.icon ?? 'dots')
  const color = isTransfer ? 'var(--color-violet)' : (category?.color ?? '#94a3b8')

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left transition-colors active:bg-bg"
      style={{ opacity: rule.pausedAt ? 0.55 : 1 }}
    >
      <CategoryIcon icon={icon} color={color} size={42} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">
          {rule.note?.trim() || category?.title || 'Повтор'}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-muted">
          {PERIOD_TITLES[rule.period]}
          {next ? ` · ${formatFullDate(next)}` : ''}
          {account ? ` · ${account.title}` : ''}
        </span>
      </span>

      <span
        className="shrink-0 text-[15px] font-semibold tabular-nums"
        style={{ color: rule.type === 'income' ? 'var(--color-income)' : 'var(--color-ink)' }}
      >
        {formatMoney(rule.type === 'income' ? rule.amount : -rule.amount, {
          sign: rule.type === 'income',
          currency: account?.currency,
        })}
      </span>
    </button>
  )
}
