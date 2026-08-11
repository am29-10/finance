import { useState } from 'react'
import { CategoryIcon } from '../components/CategoryIcon'
import { ScreenHeader } from '../components/ScreenHeader'
import { LoanSheet } from '../components/LoanSheet'
import { PrepaymentSheet } from '../components/PrepaymentSheet'
import { actions, activeLoans, closedLoans, loanById, useFinance } from '../data/store'
import type { Loan } from '../data/types'
import { formatFullDate } from '../lib/date'
import { formatRate, formatTerm, loanStats, loansSummary, LOAN_KIND_TITLES } from '../lib/loan'
import { plural } from '../lib/text'
import { formatMoney } from '../lib/money'

interface LoansScreenProps {
  onBack: () => void
}

const KIND_ICONS: Record<Loan['kind'], string> = {
  mortgage: 'key',
  consumer: 'bank',
  auto: 'bus',
  other: 'bank',
}

const KIND_COLORS: Record<Loan['kind'], string> = {
  mortgage: '#7c3aed',
  consumer: '#0891b2',
  auto: '#f97316',
  other: '#64748b',
}

export function LoansScreen({ onBack }: LoansScreenProps) {
  const data = useFinance()
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ loan?: Loan } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const selected = openId ? loanById(data, openId) : undefined

  function openSheet(loan?: Loan) {
    setSheet({ loan })
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setTimeout(() => setSheet(null), 260)
  }

  if (selected) {
    return (
      <>
        <LoanDetail
          loan={selected}
          onBack={() => setOpenId(null)}
          onEdit={() => openSheet(selected)}
        />
        {sheet && (
          <LoanSheet
            key={sheet.loan?.id ?? 'new'}
            open={sheetOpen}
            loan={sheet.loan}
            onClose={closeSheet}
            onDeleted={() => setOpenId(null)}
          />
        )}
      </>
    )
  }

  const active = activeLoans(data)
  const closed = closedLoans(data)
  const summary = loansSummary(active)

  return (
    <div className="px-4 pb-8">
      <ScreenHeader title="Кредиты" onBack={onBack} />

      {active.length === 0 && closed.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-surface px-6 py-10 text-center">
          <p className="text-[15px] font-medium">Кредитов пока нет</p>
          <p className="mx-auto mt-2 max-w-[280px] text-[14px] leading-snug text-muted">
            Добавьте ипотеку или кредит — приложение посчитает остаток долга, график платежей и
            выгоду от досрочных погашений.
          </p>
        </div>
      ) : (
        <>
          {summary.count > 0 && (
            <section className="rounded-3xl bg-brand px-5 py-5 text-white">
              <span className="text-[13px] opacity-80">Общий долг</span>
              <p className="mt-1 text-[32px] font-bold tabular-nums">{formatMoney(summary.debt)}</p>

              <div className="mt-4 flex gap-3">
                <div className="flex-1 rounded-2xl bg-white/10 px-3.5 py-3">
                  <span className="text-[12px] opacity-80">В месяц</span>
                  <p className="mt-0.5 text-[17px] font-semibold tabular-nums">
                    {formatMoney(summary.monthly)}
                  </p>
                </div>
                {summary.nextDate && (
                  <div className="flex-1 rounded-2xl bg-white/10 px-3.5 py-3">
                    <span className="text-[12px] opacity-80">Следующий платёж</span>
                    <p className="mt-0.5 text-[17px] font-semibold">
                      {formatFullDate(summary.nextDate).replace(/ \d{4} г\.$/, '')}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="mt-4 flex flex-col gap-2.5">
            {active.map((loan) => (
              <LoanRow key={loan.id} loan={loan} onClick={() => setOpenId(loan.id)} />
            ))}
          </div>

          {closed.length > 0 && (
            <>
              <h2 className="mt-6 mb-2 px-1 text-[15px] font-semibold text-muted">Закрытые</h2>
              <div className="flex flex-col gap-2.5">
                {closed.map((loan) => (
                  <LoanRow key={loan.id} loan={loan} onClick={() => setOpenId(loan.id)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <button
        onClick={() => openSheet()}
        className="mt-4 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
      >
        Добавить кредит
      </button>

      {sheet && (
        <LoanSheet
          key={sheet.loan?.id ?? 'new'}
          open={sheetOpen}
          loan={sheet.loan}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}

function LoanRow({ loan, onClick }: { loan: Loan; onClick: () => void }) {
  const stats = loanStats(loan)
  const done = loan.closedAt || stats.isPaidOff

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-surface px-4 py-4 text-left transition-transform active:scale-[0.99]"
      style={{ opacity: done ? 0.6 : 1 }}
    >
      <div className="flex items-center gap-3">
        <CategoryIcon icon={KIND_ICONS[loan.kind]} color={KIND_COLORS[loan.kind]} size={44} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{loan.title}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {LOAN_KIND_TITLES[loan.kind]} · {formatRate(loan.rate)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[17px] font-semibold tabular-nums">{formatMoney(stats.balance)}</p>
          <p className="mt-0.5 text-[12px] text-muted">
            {done ? 'закрыт' : `${Math.round(stats.progress * 100)} % погашено`}
          </p>
        </div>
      </div>

      {!done && <Progress value={stats.progress} color={KIND_COLORS[loan.kind]} />}
    </button>
  )
}

function LoanDetail({
  loan,
  onBack,
  onEdit,
}: {
  loan: Loan
  onBack: () => void
  onEdit: () => void
}) {
  const stats = loanStats(loan)
  const [prepayOpen, setPrepayOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)

  const upcoming = stats.schedule.filter((row) => !stats.next || row.index >= stats.next.index)
  const visible = showAll ? upcoming : upcoming.slice(0, 12)
  const done = Boolean(loan.closedAt) || stats.isPaidOff

  return (
    <div className="px-4 pb-8">
      <ScreenHeader title={loan.title} onBack={onBack} action={{ label: 'Изменить', onClick: onEdit }} />

      <section className="rounded-3xl px-5 py-5 text-white" style={{ backgroundColor: KIND_COLORS[loan.kind] }}>
        <span className="text-[13px] opacity-80">
          {done ? 'Кредит закрыт' : 'Осталось выплатить'}
        </span>
        <p className="mt-1 text-[34px] font-bold tabular-nums">{formatMoney(stats.balance)}</p>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all duration-500 ease-[var(--ease-ios)]"
            style={{ width: `${Math.max(stats.progress * 100, 1)}%` }}
          />
        </div>

        <p className="mt-2.5 text-[13px] opacity-80">
          Погашено {Math.round(stats.progress * 100)} % от {formatMoney(loan.principal)}
          {!done && stats.monthsLeft > 0 && (
            <> · осталось {stats.monthsLeft} {plural(stats.monthsLeft, 'платёж', 'платежа', 'платежей')}</>
          )}
        </p>
      </section>

      {!done && (
        <button
          onClick={() => setPrepayOpen(true)}
          className="mt-3 w-full rounded-2xl bg-brand py-4 text-[17px] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
        >
          Погасить досрочно
        </button>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Tile label="Вложено всего" value={formatMoney(stats.paidTotal)} />
        <Tile
          label="Из них проценты"
          value={formatMoney(stats.paidInterest)}
          tone="var(--color-danger)"
        />
        <Tile
          label={done ? 'Платёж был' : 'Ежемесячный платёж'}
          value={formatMoney(stats.monthlyPayment)}
        />
        <Tile
          label="Переплата за весь срок"
          value={formatMoney(stats.totalInterest)}
          hint={`${Math.round((stats.totalInterest / loan.principal) * 100)} % от суммы`}
        />
      </div>

      {!done && (
        <div className="mt-2.5 rounded-2xl bg-surface px-4 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] text-muted">Дата закрытия</span>
            <span className="text-[15px] font-semibold">{formatFullDate(stats.closingDate)}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[14px] text-muted">Ставка и срок</span>
            <span className="text-[15px] font-medium">
              {formatRate(loan.rate)} · {formatTerm(loan.termMonths)}
            </span>
          </div>
        </div>
      )}

      {stats.savedInterest > 0 && (
        <section className="mt-3 flex items-start gap-3 rounded-2xl bg-brand/8 px-4 py-4">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand/15">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="var(--color-brand)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7 10 17l-5-5" />
            </svg>
          </span>
          <p className="text-[14px] leading-snug">
            <span className="font-medium">
              Досрочные платежи сэкономили {formatMoney(stats.savedInterest)} процентов.
            </span>
            {stats.savedMonths > 0 && (
              <span className="mt-0.5 block text-[13px] text-muted">
                Кредит закроется на {formatTerm(stats.savedMonths)} раньше, чем по исходному
                графику.
              </span>
            )}
          </p>
        </section>
      )}

      {loan.prepayments.length > 0 && <Prepayments loan={loan} />}

      {!done && visible.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 px-1 text-[17px] font-semibold">График платежей</h2>

          <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
            {visible.map((row) => (
              <div key={row.index} className="flex items-center gap-3 px-4 py-3">
                <span className="w-9 shrink-0 text-[13px] tabular-nums text-muted">
                  {row.index}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">
                    {formatFullDate(row.date).replace(/ г\.$/, '')}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    долг {formatMoney(row.principal)} · проценты {formatMoney(row.interest)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[15px] font-semibold tabular-nums">
                    {formatMoney(row.payment)}
                  </p>
                  <p className="mt-0.5 text-[12px] tabular-nums text-muted">
                    остаток {formatMoney(row.balance)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {upcoming.length > visible.length && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-2.5 w-full rounded-2xl bg-surface py-3.5 text-[15px] font-medium text-brand transition-transform active:scale-[0.99]"
            >
              Показать все {upcoming.length}{' '}
              {plural(upcoming.length, 'платёж', 'платежа', 'платежей')}
            </button>
          )}
        </>
      )}

      <button
        onClick={() => {
          if (!confirmingClose && !loan.closedAt) {
            setConfirmingClose(true)
            return
          }
          if (loan.closedAt) actions.reopenLoan(loan.id)
          else actions.closeLoan(loan.id)
          setConfirmingClose(false)
        }}
        className="mt-6 w-full rounded-2xl py-3.5 text-[15px] font-medium text-muted transition-transform active:scale-[0.99]"
      >
        {loan.closedAt
          ? 'Вернуть кредит в активные'
          : confirmingClose
            ? 'Точно закрыть? Новые платежи создаваться не будут'
            : 'Кредит закрыт — убрать из активных'}
      </button>

      {!done && (
        <PrepaymentSheet open={prepayOpen} loan={loan} onClose={() => setPrepayOpen(false)} />
      )}
    </div>
  )
}

function Prepayments({ loan }: { loan: Loan }) {
  const sorted = [...loan.prepayments].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <>
      <h2 className="mt-6 mb-2 px-1 text-[17px] font-semibold">Досрочные погашения</h2>

      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
        {sorted.map((prepayment) => (
          <div key={prepayment.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold tabular-nums">
                {formatMoney(prepayment.amount)}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                {formatFullDate(prepayment.date).replace(/ г\.$/, '')} ·{' '}
                {prepayment.mode === 'term' ? 'сократил срок' : 'снизил платёж'}
              </p>
            </div>

            <button
              onClick={() => actions.deletePrepayment(loan.id, prepayment.id)}
              aria-label="Удалить погашение"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg text-muted transition-transform active:scale-90"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: string
}) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3.5">
      <p className="text-[12px] leading-snug text-muted">{label}</p>
      <p className="mt-1 text-[17px] font-semibold tabular-nums" style={{ color: tone }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  )
}

function Progress({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
      <div
        className="h-full rounded-full transition-all duration-500 ease-[var(--ease-ios)]"
        style={{ width: `${Math.max(value * 100, 1)}%`, backgroundColor: color }}
      />
    </div>
  )
}

