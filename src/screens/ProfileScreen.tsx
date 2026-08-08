import { useRef, useState } from 'react'
import { BudgetSheet } from '../components/BudgetSheet'
import { InstallSheet } from '../components/InstallSheet'
import { RatesSheet } from '../components/RatesSheet'
import { PinSheet } from '../components/PinSheet'
import { actions, activeAccounts, activeRecurrences, useFinance } from '../data/store'
import type { FinanceData } from '../data/types'
import { canShareBackup, exportBackup, isBackupDue, readBackup, shareBackup } from '../lib/backup'
import { exportCsv } from '../lib/csv'
import { formatMoney } from '../lib/money'
import { plural } from '../lib/text'
import { isNativeApp, isStandalone, storageRisk } from '../lib/platform'
import { BASE_CURRENCY } from '../lib/currency'

interface ProfileScreenProps {
  onOpenRecurring: () => void
}

export function ProfileScreen({ onOpenRecurring }: ProfileScreenProps) {
  const data = useFinance()
  const fileInput = useRef<HTMLInputElement>(null)

  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [confirmingPinOff, setConfirmingPinOff] = useState(false)

  const [installOpen, setInstallOpen] = useState(false)
  const [ratesOpen, setRatesOpen] = useState(false)

  /** Какая очистка ждёт подтверждения. Два нажатия — минимум для необратимого. */
  const [clearing, setClearing] = useState<'operations' | 'all' | null>(null)

  const foreignCurrencies = [
    ...new Set(activeAccounts(data).map((a) => a.currency)),
  ].filter((code) => code !== BASE_CURRENCY)

  const loanCount = data.loans.length

  const recurring = {
    total: data.recurrences.length,
    active: activeRecurrences(data).length,
  }

  function confirmClear(kind: 'operations' | 'all') {
    if (clearing !== kind) {
      setClearing(kind)
      return
    }

    if (kind === 'operations') {
      actions.clearOperations()
      setNotice({ text: 'История операций удалена' })
    } else {
      actions.resetAll()
      setNotice({ text: 'Приложение сброшено' })
    }

    setClearing(null)
  }

  const hasPin = Boolean(data.settings.pinHash)
  const installed = isNativeApp() || isStandalone()
  const risk = storageRisk()
  const backup = backupState(data)

  function markSaved() {
    actions.updateSettings({
      lastBackupAt: new Date().toISOString(),
      // Копия есть — отложенное напоминание больше не нужно.
      backupRemindedAt: undefined,
    })
  }

  function handleBackup() {
    exportBackup(data)
    markSaved()
  }

  async function handleShare() {
    const result = await shareBackup(data)

    if (result === 'cancelled') {
      setNotice({ text: 'Отправка отменена — копия не сохранена', error: true })
      return
    }

    markSaved()
    setNotice({ text: result === 'shared' ? 'Копия отправлена' : 'Копия скачана' })
  }

  async function handleImport(file: File) {
    try {
      const imported = await readBackup(file)
      actions.replaceAll(imported)
      setNotice({ text: `Загружено операций: ${imported.operations.length}` })
    } catch (error) {
      setNotice({ text: (error as Error).message, error: true })
    }
  }

  function togglePin() {
    if (!hasPin) {
      setPinOpen(true)
      return
    }
    if (!confirmingPinOff) {
      setConfirmingPinOff(true)
      return
    }
    actions.updateSettings({ pinHash: undefined })
    setConfirmingPinOff(false)
    setNotice({ text: 'PIN-код отключён' })
  }

  return (
    <div className="px-4 pb-8">
      <header className="pt-4 pb-4">
        <h1 className="px-1 text-[28px] font-bold tracking-tight">Профиль</h1>
      </header>

      <Group title="Общее">
        <ActionRow
          label="Повторяющиеся операции"
          hint={
            recurring.total > 0
              ? `${recurring.active} ${plural(recurring.active, 'активный', 'активных', 'активных')} из ${recurring.total}`
              : 'Подписки, аренда, зарплата — заводятся сами'
          }
          onClick={onOpenRecurring}
        />
        <ActionRow
          label="Бюджет на месяц"
          value={
            data.settings.monthlyBudget > 0 ? formatMoney(data.settings.monthlyBudget) : 'не задан'
          }
          onClick={() => setBudgetOpen(true)}
        />
        <ActionRow
          label="Курсы валют"
          hint={
            foreignCurrencies.length > 0
              ? `Для счетов в ${foreignCurrencies.join(', ')}`
              : 'Понадобятся, если появится валютный счёт'
          }
          value={foreignCurrencies.length > 0 ? undefined : 'нет валютных счетов'}
          onClick={() => setRatesOpen(true)}
        />
      </Group>

      <Group title="Приложение">
        <ActionRow
          label={installed ? 'Приложение установлено' : 'Установить на телефон'}
          hint={
            installed
              ? 'Открыто как приложение, а не как вкладка'
              : 'Иконка на экране и работа без интернета'
          }
          onClick={() => setInstallOpen(true)}
        />
      </Group>

      <Group title="Данные">
        <ActionRow
          label="Экспорт в CSV"
          hint="Таблица операций для Excel"
          onClick={() => exportCsv(data)}
        />
        {canShareBackup() && (
          <ActionRow
            label="Отправить копию"
            hint="В Telegram, на диск или в «Файлы»"
            danger={backup.overdue}
            onClick={handleShare}
          />
        )}
        <ActionRow
          label="Скачать резервную копию"
          hint={backup.hint}
          danger={backup.overdue && !canShareBackup()}
          onClick={handleBackup}
        />
        <ActionRow
          label="Восстановить из копии"
          hint="Заменит всё содержимым файла"
          onClick={() => fileInput.current?.click()}
        />
      </Group>

      {backup.overdue && (
        <p
          className="-mt-3 mb-5 rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed"
          style={{ backgroundColor: '#f4433610' }}
        >
          {risk === 'fragile' ? (
            <>
              Данные привязаны к иконке на домашнем экране. Если её удалить, история операций
              исчезнет вместе с ней — на iPhone восстановить её будет неоткуда. Сохраните копию.
            </>
          ) : (
            <>
              Данные лежат в хранилище браузера, и очистка данных сайтов стирает их без
              предупреждения. Сохраните копию — это один файл.
            </>
          )}
        </p>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImport(file)
          // Сбрасываем значение, иначе повторный выбор того же файла не вызовет onChange.
          e.target.value = ''
        }}
      />

      <Group title="Очистить данные">
        <ActionRow
          label={clearing === 'operations' ? 'Точно удалить всю историю?' : 'Удалить все операции'}
          hint={
            clearing === 'operations'
              ? loanCount > 0
                ? `Вместе с ними удалятся ${loanCount} ${plural(loanCount, 'кредит', 'кредита', 'кредитов')}: их платежи считаются из графика и вернулись бы обратно`
                : 'Счета, бюджет и PIN останутся'
              : `${data.operations.length} ${plural(data.operations.length, 'операция', 'операции', 'операций')} в истории`
          }
          danger={clearing === 'operations'}
          onClick={() => confirmClear('operations')}
        />
        <ActionRow
          label={clearing === 'all' ? 'Точно стереть вообще всё?' : 'Начать с нуля'}
          hint={
            clearing === 'all'
              ? 'Операции, счета, кредиты, бюджет и PIN — без возврата'
              : 'Полный сброс приложения'
          }
          danger={clearing === 'all'}
          onClick={() => confirmClear('all')}
        />
      </Group>

      {clearing && (
        <p
          className="-mt-3 mb-5 rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed"
          style={{ backgroundColor: '#f4433610' }}
        >
          Отменить это будет нечем. Если копии за сегодня нет — закройте это окно и сначала
          сохраните её: одно нажатие выше.
          <button
            onClick={() => setClearing(null)}
            className="mt-2 block font-medium"
            style={{ color: 'var(--color-brand)' }}
          >
            Не удалять
          </button>
        </p>
      )}

      <Group title="Безопасность">
        <ActionRow
          label={
            confirmingPinOff ? 'Точно отключить?' : hasPin ? 'Отключить PIN-код' : 'Включить PIN-код'
          }
          hint={hasPin ? 'Спрашивается при запуске' : 'Закрыть приложение от посторонних'}
          danger={confirmingPinOff}
          onClick={togglePin}
        />
        {hasPin && (
          <ActionRow label="Изменить PIN-код" onClick={() => setPinOpen(true)} />
        )}
      </Group>

      {notice && (
        <p
          className="mt-3 px-1 text-[13px]"
          style={{ color: notice.error ? 'var(--color-danger)' : 'var(--color-brand)' }}
        >
          {notice.text}
        </p>
      )}

      <Group title="О приложении">
        <ActionRow label="Версия" value={__APP_VERSION__} muted />
        <ActionRow label="Операций" value={String(data.operations.length)} muted />
        <ActionRow label="Категорий" value={String(data.categories.length)} muted />
      </Group>

      <p className="mt-4 px-1 text-[13px] leading-relaxed text-muted">
        Данные хранятся только на этом устройстве и никуда не отправляются. PIN-код закрывает
        приложение от посторонних глаз, но не шифрует данные. Если очистить данные браузера,
        всё пропадёт — на этот случай есть резервная копия.
      </p>

      <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} />
      <PinSheet open={pinOpen} onClose={() => setPinOpen(false)} />
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
      <RatesSheet open={ratesOpen} onClose={() => setRatesOpen(false)} />
    </div>
  )
}

/**
 * Стоит ли поторопить с резервной копией.
 *
 * Правило то же, что у напоминания в начале месяца, — иначе Профиль говорил бы
 * «всё в порядке» ровно тогда, когда приложение просит сохраниться. Отложенное
 * напоминание здесь не учитывается: «позже» убирает всплывающее окно, но не
 * повод делать вид, что копия есть.
 */
function backupState(data: FinanceData): { hint: string; overdue: boolean } {
  const { lastBackupAt } = data.settings

  if (data.operations.length === 0) return { hint: 'Файл со всеми данными', overdue: false }

  const overdue = isBackupDue({ lastBackupAt }, data.operations)

  if (!lastBackupAt) return { hint: 'Копии ещё не было', overdue }

  const days = Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000)
  const when =
    days === 0
      ? 'сегодня'
      : days === 1
        ? 'вчера'
        : `${days} ${plural(days, 'день', 'дня', 'дней')} назад`

  return { hint: `Последняя копия — ${when}`, overdue }
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-[13px] font-medium text-muted">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">{children}</div>
    </section>
  )
}

function ActionRow({
  label,
  hint,
  value,
  danger,
  muted,
  onClick,
}: {
  label: string
  hint?: string
  value?: string
  danger?: boolean
  muted?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[16px]"
          style={{ color: danger ? 'var(--color-danger)' : 'var(--color-ink)' }}
        >
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </span>

      {value && <span className="shrink-0 text-[15px] text-muted">{value}</span>}

      {!muted && (
        <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted" fill="none">
          <path
            d="M9 5l7 7-7 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </>
  )

  if (!onClick) {
    return <div className="flex items-center gap-3 px-4 py-3.5">{content}</div>
  }

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-bg"
    >
      {content}
    </button>
  )
}
